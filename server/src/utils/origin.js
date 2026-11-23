// 对外 URL 的域名唯一真相源：一律按当前请求动态推导，禁止在业务代码里写死任何域名。
// nginx 反代需透传 Host / X-Forwarded-*；本地开发的 localhost 才回落 config.BASE_URL。
const config = require('../config')

const pick = v => String(v || '').split(',')[0].trim()
const isLocalHost = h => /^(localhost|127\.|\[?::1\]?|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)|\.(local|internal)$/i.test(h)

// 从当前请求取公网 origin；本地/内网地址返回空串，交给配置兜底（仅供开发）
function requestOrigin(req) {
  const host = pick(req?.headers?.['x-forwarded-host']) || pick(req?.headers?.host) || ''
  if (!host || isLocalHost(host)) return ''
  const proto = pick(req?.headers?.['x-forwarded-proto']) || pick(req?.headers?.['x-forwarded-scheme']) || 'https'
  return `${proto}://${host}`
}

// 生产一律用请求域名；无请求上下文（启动任务）时才用显式配置，且拒绝 localhost 默认值的误用
function originOf(req) {
  return requestOrigin(req) || String(config.BASE_URL || '').replace(/\/$/, '')
}

function requestUrl(req, path) {
  const p = String(path || '')
  if (/^https?:\/\//i.test(p)) return p
  return `${originOf(req)}${p.startsWith('/') ? '' : '/'}${p}`
}

module.exports = { requestOrigin, originOf, requestUrl }
