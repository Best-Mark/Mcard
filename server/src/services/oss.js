// 对象存储服务：本地 / 阿里云 OSS / 腾讯云 COS
// 配置来自 site_config（后台配置中心），敏感密钥服务端直读、绝不下发。
// 多项目共用一个 Bucket：所有对象 key = `${pathPrefix}/uploads/<file>`，pathPrefix 即项目路径隔离维度。
// 外部 SDK 调用统一 try/catch + 明确错误；未配置或异常一律降级，绝不拖垮上传主流程。
const path = require('path')
const fs = require('fs')
const settings = require('../utils/settings')

const CACHE_HEADERS = { 'Cache-Control': 'public, max-age=31536000, immutable' }
let cachedClient = null
let cachedSignature = '' // 配置指纹，配置变化时自动重建客户端（无需重启）

// 拼接项目路径下的对象 key。objectName 形如 'uploads/xxx.png' 或 'xxx.png'
function buildKey(objectName) {
  const cfg = settings.ossConfig()
  const clean = String(objectName || '').replace(/^\/+/, '')
  const rel = clean.startsWith('uploads/') ? clean : `uploads/${clean}`
  return `${cfg.pathPrefix}/${rel}`
}

function removeLeadingPrefix(key, prefix) {
  const p = `${prefix}/uploads/`
  return String(key || '').startsWith(p) ? key.slice(p.length) : key
}

function signatureOf(cfg) {
  return [cfg.provider, cfg.pathPrefix, cfg.region, cfg.bucket, cfg.accessKey, cfg.secretKey, cfg.customDomain].join('|')
}

function getClient() {
  const cfg = settings.ossConfig()
  const sig = signatureOf(cfg)
  if (cachedClient !== null && cachedSignature === sig) return cachedClient

  const provider = cfg.provider
  if (provider === 'aliyun' || provider === 'aliyun-oss') cachedClient = createAliyun(cfg)
  else if (provider === 'tencent' || provider === 'cos') cachedClient = createTencent(cfg)
  else cachedClient = false // local：未启用云存储

  cachedSignature = sig
  return cachedClient
}

function createAliyun(cfg) {
  if (!cfg.bucket || !cfg.accessKey || !cfg.secretKey) {
    console.warn('[OSS] 阿里云配置不完整，降级本地存储')
    return false
  }
  try {
    const OSS = require('ali-oss')
    const region = cfg.region || 'oss-cn-hangzhou'
    const client = new OSS({
      region, bucket: cfg.bucket, accessKeyId: cfg.accessKey,
      accessKeySecret: cfg.secretKey, endpoint: `https://${region}.aliyuncs.com`, secure: true
    })
    console.log(`[OSS] 已启用阿里云 OSS (${region}/${cfg.bucket}) 前缀=${cfg.pathPrefix}`)
    return {
      provider: 'aliyun',
      async put(key, localPath) { return client.put(key, path.resolve(localPath), { headers: { ...CACHE_HEADERS } }) },
      async delete(key) { return client.delete(key) },
      async exists(key) { try { await client.head(key); return true } catch { return false } },
      async list(prefix, max = 100) {
        const r = await client.list({ prefix, delimiter: '', 'max-keys': max })
        return (r.objects || []).map(o => ({ key: o.name, size: o.size, lastModified: o.lastModified }))
      },
      getUrl(key) {
        if (cfg.customDomain) return `https://${cfg.customDomain}/${key}`
        try { return client.signatureUrl(key, { expires: 3600 * 24 * 365 * 10 }) } catch { return '' }
      }
    }
  } catch (e) {
    console.warn('[OSS] 阿里云客户端初始化失败，降级本地存储：', e.message)
    return false
  }
}

function createTencent(cfg) {
  if (!cfg.bucket || !cfg.accessKey || !cfg.secretKey) {
    console.warn('[OSS] 腾讯云配置不完整，降级本地存储')
    return false
  }
  try {
    const COS = require('cos-nodejs-sdk-v5')
    const region = cfg.region || 'ap-guangzhou'
    const cos = new COS({ SecretId: cfg.accessKey, SecretKey: cfg.secretKey })
    const call = (method, params) => new Promise((resolve, reject) => {
      cos[method](params, (err, data) => err ? reject(err) : resolve(data))
    })
    console.log(`[OSS] 已启用腾讯云 COS (${region}/${cfg.bucket}) 前缀=${cfg.pathPrefix}`)
    return {
      provider: 'tencent',
      async put(key, localPath) {
        return call('putObject', { Bucket: cfg.bucket, Region: region, Key: key, Body: fs.createReadStream(path.resolve(localPath)), Headers: { CacheControl: CACHE_HEADERS['Cache-Control'] } })
      },
      async delete(key) { return call('deleteObject', { Bucket: cfg.bucket, Region: region, Key: key }) },
      async exists(key) { try { await call('headObject', { Bucket: cfg.bucket, Region: region, Key: key }); return true } catch { return false } },
      async list(prefix, max = 100) {
        const r = await call('getBucket', { Bucket: cfg.bucket, Region: region, Prefix: prefix, MaxKeys: max })
        return (r.Contents || []).map(o => ({ key: o.Key, size: o.Size, lastModified: o.LastModified }))
      },
      getUrl(key) {
        if (cfg.customDomain) return `https://${cfg.customDomain}/${key}`
        return `https://${cfg.bucket}.cos.${region}.myqcloud.com/${key}`
      }
    }
  } catch (e) {
    console.warn('[OSS] 腾讯云客户端初始化失败，降级本地存储：', e.message)
    return false
  }
}

// 是否已启用云存储
function configured() {
  const client = getClient()
  return !!(client && client.put)
}

function currentProvider() {
  const cfg = settings.ossConfig()
  return cfg.provider
}

function currentPrefix() {
  return settings.ossConfig().pathPrefix
}

// 上传本地文件到 OSS，返回公网 URL；失败返回 null（由调用方降级本地 URL）
async function putLocalFile(localPath, objectName) {
  const client = getClient()
  if (!client || !client.put) return null
  const key = buildKey(objectName)
  try {
    await client.put(key, localPath)
    return client.getUrl(key)
  } catch (e) {
    console.warn('[OSS] 上传失败，降级本地存储：', e.message)
    return null
  }
}

// 删除对象（仅允许删当前项目路径下）
async function remove(objectKey) {
  const client = getClient()
  if (!client || !client.delete) return false
  const prefix = `${currentPrefix()}/uploads/`
  if (!String(objectKey || '').startsWith(prefix)) return false
  try { await client.delete(objectKey); return true } catch { return false }
}

// 列出当前项目路径下的文件
async function listFiles() {
  const client = getClient()
  if (!client || !client.list) return []
  const prefix = `${currentPrefix()}/uploads/`
  try {
    const rows = await client.list(prefix, 200)
    return rows
      .filter(r => !r.key.endsWith('/'))
      .map(r => ({
        key: r.key,
        name: removeLeadingPrefix(r.key, currentPrefix()),
        url: client.getUrl(r.key),
        size: Number(r.size) || 0,
        lastModified: r.lastModified || ''
      }))
      .sort((a, b) => String(b.lastModified).localeCompare(String(a.lastModified)))
  } catch (e) {
    console.warn('[OSS] 列举失败：', e.message)
    return []
  }
}

function clearCache() { cachedClient = null; cachedSignature = '' }

module.exports = { configured, currentProvider, currentPrefix, buildKey, putLocalFile, remove, listFiles, clearCache }
