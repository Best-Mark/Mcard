// 对象存储服务：本地 / 阿里云 OSS / 腾讯云 COS
// 配置来自 site_config（后台配置中心），敏感密钥服务端直读、绝不下发。
// 多项目共用一个 Bucket：所有对象 key = `${pathPrefix}/uploads/<file>`，pathPrefix 即项目路径隔离维度。
// 外部 SDK 调用统一 try/catch + 明确错误；未配置或异常一律降级，绝不拖垮上传主流程。
const path = require('path')
const fs = require('fs')
const config = require('../config')
const db = require('../db')
const settings = require('../utils/settings')

const CACHE_HEADERS = { 'Cache-Control': 'public, max-age=31536000, immutable' }

// 地域下拉：按 provider 给常用地域，不在列表的「其它」手输。
// 与 admin 配置中心的下拉共用这份常量（唯一真相源），新增地域只改这里。
const OSS_REGIONS = {
  aliyun: [
    { v: 'oss-cn-hangzhou', label: '华东1 · 杭州' },
    { v: 'oss-cn-shanghai', label: '华东2 · 上海' },
    { v: 'oss-cn-qingdao', label: '华北1 · 青岛' },
    { v: 'oss-cn-beijing', label: '华北2 · 北京' },
    { v: 'oss-cn-zhangjiakou', label: '华北3 · 张家口' },
    { v: 'oss-cn-wulanchabu', label: '华北6 · 乌兰察布' },
    { v: 'oss-cn-shenzhen', label: '华南1 · 深圳' },
    { v: 'oss-cn-heyuan', label: '华南2 · 河源' },
    { v: 'oss-cn-guangzhou', label: '华南3 · 广州' },
    { v: 'oss-cn-chengdu', label: '西南1 · 成都' },
    { v: 'oss-cn-chongqing', label: '西南2 · 重庆' },
    { v: 'oss-cn-hongkong', label: '中国香港' },
    { v: 'oss-ap-southeast-1', label: '新加坡' },
    { v: 'oss-ap-northeast-1', label: '日本 · 东京' },
    { v: 'oss-us-west-1', label: '美国 · 硅谷' },
    { v: 'oss-eu-central-1', label: '德国 · 法兰克福' }
  ],
  tencent: [
    { v: 'ap-guangzhou', label: '华南 · 广州' },
    { v: 'ap-shanghai', label: '华东 · 上海' },
    { v: 'ap-beijing', label: '华北 · 北京' },
    { v: 'ap-nanjing', label: '华东 · 南京' },
    { v: 'ap-chengdu', label: '西南 · 成都' },
    { v: 'ap-chongqing', label: '西南 · 重庆' },
    { v: 'ap-hongkong', label: '中国香港' },
    { v: 'ap-singapore', label: '新加坡' },
    { v: 'ap-tokyo', label: '日本 · 东京' },
    { v: 'ap-seoul', label: '韩国 · 首尔' },
    { v: 'ap-silicon-valley', label: '美国 · 硅谷' },
    { v: 'ap-frankfurt', label: '德国 · 法兰克福' }
  ]
}

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

// ============ 存量图片同步（适配 MCard 架构）============
// 与 MShop 的差异：MShop 图片 URL 存本地路径、访问时 302 切 OSS；
// MCard 上传成功就把 OSS URL 写库，所以同步必须「上传 + 回填数据库 URL」两步，
// 并写 oss_sync_state 标记代表新上传/存量都已走 OSS（OSS 优先）。
const migrate = {
  running: false, total: 0, done: 0, failed: 0, skipped: 0,
  startedAt: null, finishedAt: null, lastError: '', stopRequested: false
}
const SYNC_STATE_KEY = 'oss_sync_state'

function listLocalFiles(dir, base, out = []) {
  let entries = []
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return out }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) listLocalFiles(full, base, out)
    else if (e.isFile()) out.push(path.relative(base, full).split(path.sep).join('/'))
  }
  return out
}

function readSyncState() {
  try {
    const row = db.prepare('SELECT value FROM site_config WHERE key = ?').get(SYNC_STATE_KEY)
    return row ? JSON.parse(row.value || '{}') : {}
  } catch { return {} }
}
function writeSyncState(patch) {
  const st = { ...readSyncState(), ...patch }
  db.prepare("INSERT INTO site_config (key,value,updated_at) VALUES (?,?,datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')")
    .run(SYNC_STATE_KEY, JSON.stringify(st))
}

// 回填数据库里以 /uploads/ 开头的图片 URL 为 OSS URL。
// 按文件名匹配：本地 /uploads/foo.png → OSS URL（client.getUrl 生成）。
// 只更新确实存在的文件名，避免误改外部链接；card_materials 的 url 也可能是外链，同样只改 /uploads/ 前缀。
// user_assets（历史素材库）已停用，不再参与回填。
const DB_IMAGE_FIELDS = {
  cards: ['avatar', 'cover', 'logo', 'wechat_qr', 'alipay_qr', 'wechat_pay_qr', 'alipay_pay_qr'],
  users: ['avatar'],
  card_materials: ['url']
}
function backfillDbUrls(urlOf) {
  let updated = 0
  const tx = db.transaction(() => {
    for (const [table, cols] of Object.entries(DB_IMAGE_FIELDS)) {
      for (const col of cols) {
        // 只取该列里 /uploads/ 开头的行，逐条按文件名换 OSS URL
        const rows = db.prepare(`SELECT id, ${col} AS v FROM ${table} WHERE ${col} LIKE '/uploads/%'`).all()
        for (const r of rows) {
          const name = String(r.v || '').replace(/^\/uploads\//, '')
          const url = urlOf(name)
          if (!url) continue
          db.prepare(`UPDATE ${table} SET ${col} = ? WHERE id = ?`).run(url, r.id)
          updated++
        }
      }
    }
  })
  try { tx() } catch (e) { console.warn('[OSS] URL 回填失败：', e.message) }
  return updated
}

// 启动同步：扫描本地文件 → 并发上传到 OSS（已存在跳过，可续跑）→ 回填数据库 URL → 标记 OSS 优先。
// 任何失败都不标记完成（OSS 不是全量，不能切优先），修好后重跑即可。
function startMigrate() {
  const client = getClient()
  if (!client || !client.put) return { skipped: 'oss-disabled' }
  if (migrate.running) return { alreadyRunning: true }

  const files = listLocalFiles(config.UPLOAD_DIR, config.UPLOAD_DIR)
  Object.assign(migrate, {
    running: true, total: files.length, done: 0, failed: 0, skipped: 0,
    startedAt: Date.now(), finishedAt: null, lastError: '', stopRequested: false
  })
  if (!files.length) {
    // 本地无存量：仍需回填一次数据库（可能历史 URL 已指向不存在的本地文件），再标记完成
    migrate.running = false
    migrate.finishedAt = Date.now()
    const backfilled = backfillDbUrls(n => client.getUrl(buildKey(`uploads/${n}`)))
    writeSyncState({ syncedAt: Date.now(), provider: currentProvider(), pathPrefix: currentPrefix(), backfilled })
    return { started: true, total: 0, backfilled }
  }

  let idx = 0
  const worker = async () => {
    while (idx < files.length && migrate.running && !migrate.stopRequested) {
      const rel = files[idx++]
      const key = buildKey(`uploads/${rel}`)
      try {
        // 已存在则跳过（断点续跑）；不存在才上传。
        if (await client.exists(key)) migrate.skipped++
        else { await client.put(key, path.join(config.UPLOAD_DIR, rel)); migrate.done++ }
      } catch (e) {
        migrate.failed++
        migrate.lastError = `${rel}: ${e.message || e.code || '上传失败'}`
      }
    }
  }
  const allDone = Promise.all(Array.from({ length: 3 }, worker))
  allDone.catch(e => { migrate.lastError = e.message || String(e) }).finally(() => {
    migrate.running = false
    migrate.finishedAt = Date.now()
    if (migrate.failed === 0 && !migrate.stopRequested) {
      const backfilled = backfillDbUrls(n => client.getUrl(buildKey(`uploads/${n}`)))
      writeSyncState({
        syncedAt: Date.now(), provider: currentProvider(), pathPrefix: currentPrefix(),
        total: migrate.total, done: migrate.done, skipped: migrate.skipped, backfilled
      })
      console.log(`[OSS] 存量同步完成（${migrate.total} 个文件，回填 ${backfilled} 条 URL），图片访问已切换为 OSS 优先，本地文件保留兜底`)
    }
  })
  return { started: true, total: files.length }
}

function stopMigrate() {
  if (migrate.running) migrate.stopRequested = true
  return { stopRequested: true }
}

function migrateProgress() {
  const st = readSyncState()
  return {
    running: migrate.running, total: migrate.total, done: migrate.done,
    failed: migrate.failed, skipped: migrate.skipped,
    startedAt: migrate.startedAt, finishedAt: migrate.finishedAt, lastError: migrate.lastError,
    syncedAt: st.syncedAt || null,
    ossPrefer: !!st.syncedAt,
    backfilled: st.backfilled || 0
  }
}

module.exports = {
  configured, currentProvider, currentPrefix, buildKey, putLocalFile, remove, listFiles, clearCache,
  OSS_REGIONS, startMigrate, stopMigrate, migrateProgress
}
