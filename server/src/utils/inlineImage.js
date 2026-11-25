// 远程图片内联唯一真相源：服务端拉取图片转 dataURL，绕开浏览器 CORS，
// 供「二维码中心图」「打印名片」「分享缩略图」共用（前端 fetch 直连 OSS 会被 CORS 拦截）。
// 安全：只放行本站上传目录与已配置的 OSS 域名，防止接口被当任意 URL 代理（SSRF）；
//       带 4s 超时、类型白名单、2MB 大小上限、缓存上限，失败静默回落空串由调用方兜底。
const fs = require('fs')
const path = require('path')
const config = require('../config')
const settings = require('../utils/settings')

const MAX_BYTES = 2 * 1024 * 1024
const TTL = 30 * 60 * 1000
const cache = new Map()
const ALLOWED_TYPE = /^image\/(png|jpe?g|webp|gif)$/

// 本地 /uploads/xxx 或 /media/xxx → dataURL（同步，服务端磁盘直读，无网络/CORS）
function localDataUrl(url) {
  const m = typeof url === 'string' && url.match(/^\/(?:uploads|media)\/([A-Za-z0-9_.-]{4,120})$/)
  if (!m) return ''
  const file = path.join(config.UPLOAD_DIR, m[1])
  if (!fs.existsSync(file)) return ''
  try {
    const buf = fs.readFileSync(file)
    if (!buf.length || buf.length > MAX_BYTES) return ''
    const ext = path.extname(m[1]).toLowerCase()
    const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
      : ext === '.webp' ? 'image/webp' : ext === '.gif' ? 'image/gif' : 'image/png'
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch (e) { console.warn('[inline-image] 本地图片读取失败:', e.message); return '' }
}

// 允许的远程主机：后台配置的 OSS 自定义域名 + OSS 官方域名（bucket.region.aliyuncs.com / cos.*.myqcloud.com）
// 动态读取配置（配置变更无需重启）；未配置 OSS 时只放行本地，远程一律拒绝。
function allowedHosts() {
  const hosts = new Set()
  const cfg = settings.ossConfig()
  if (cfg.customDomain) hosts.add(cfg.customDomain.toLowerCase())
  if (cfg.bucket && cfg.region) {
    if (cfg.provider === 'aliyun') hosts.add(`${cfg.bucket}.${cfg.region}.aliyuncs.com`.toLowerCase())
    if (cfg.provider === 'tencent') hosts.add(`${cfg.bucket}.cos.${cfg.region}.myqcloud.com`.toLowerCase())
  }
  return hosts
}

function isAllowedRemote(url) {
  let u
  try { u = new URL(url) } catch { return false }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
  const host = u.hostname.toLowerCase()
  // 本机/内网地址一律拒绝，杜绝 SSRF 探测内网服务
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || /^10\./.test(host) ||
      /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || host.endsWith('.local')) return false
  return allowedHosts().has(host)
}

// 远程图片 → dataURL；公开接口必须白名单，服务端内部调用（二维码中心图）可传 allowAny 兼容存量外链头像。
// allowAny 仍拒绝本机/内网地址，杜绝 SSRF 探测内网服务。
async function remoteDataUrl(url, opts = {}) {
  if (!/^https?:\/\//i.test(String(url || ''))) return ''
  const allowed = opts.allowAny ? (() => { try { const u = new URL(url); const h = u.hostname.toLowerCase(); return !['localhost','127.0.0.1','::1'].includes(h) && !/^10\./.test(h) && !/^192\.168\./.test(h) && !/^172\.(1[6-9]|2\d|3[01])\./.test(h) && !h.endsWith('.local') } catch { return false } })() : isAllowedRemote(url)
  if (!allowed) return ''
  const cached = cache.get(url)
  if (cached && Date.now() - cached.t < TTL) return cached.v
  let timer
  try {
    const ctl = new AbortController()
    timer = setTimeout(() => ctl.abort(), 4000)
    const resp = await fetch(url, { signal: ctl.signal, redirect: 'follow' })
    if (!resp || !resp.ok) return ''
    const type = String(resp.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    if (!ALLOWED_TYPE.test(type)) return ''
    const buf = Buffer.from(await resp.arrayBuffer())
    if (!buf.length || buf.length > MAX_BYTES) return ''
    const mime = type === 'image/jpg' ? 'image/jpeg' : type
    const data = `data:${mime};base64,${buf.toString('base64')}`
    cache.set(url, { t: Date.now(), v: data })
    if (cache.size > 100) cache.delete(cache.keys().next().value)
    return data
  } catch (e) {
    console.warn('[inline-image] 远程图片读取失败:', e.message)
    return ''
  } finally { if (timer) clearTimeout(timer) }
}

// 统一入口：本地直读；远程走白名单校验；其余返回空串
async function inlineImage(url, opts = {}) {
  if (!url || typeof url !== 'string') return ''
  if (url.startsWith('data:image/')) return url
  if (url.startsWith('/')) return localDataUrl(url)
  return remoteDataUrl(url, opts)
}

module.exports = { inlineImage, localDataUrl, remoteDataUrl, isAllowedRemote, allowedHosts, MAX_BYTES }
