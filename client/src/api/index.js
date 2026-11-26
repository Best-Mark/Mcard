import axios from 'axios'
import router from '../router'
import { setAuth, setAdminAuth } from '../store'

const api = axios.create({ baseURL: '', timeout: 20000 })
let redirecting = false
api.interceptors.request.use(cfg => {
  // 后台接口不只有 /api/admin 前缀：行政区划管理 /api/geo/admin/*、后台标记支付
  // /api/orders/:id/mark-paid 也走后台鉴权，必须用 mcard_admin_token。
  // 否则会误带 C 端 mcard_token（role=user）→ 403「需要管理权限」。
  const url = cfg.url || ''
  const adminPath = url.startsWith('/api/admin') || url.startsWith('/api/geo/admin/') || /^\/api\/orders\/[^/]+\/mark-paid$/.test(url)
  const token = adminPath ? localStorage.getItem('mcard_admin_token') : localStorage.getItem('mcard_token')
  // 调用方显式指定的 Authorization 优先（如后台裁剪上传带 mcard_admin_token 调 /api/upload），
  // 拦截器只在未指定时兜底，避免 C 端 token 覆盖后台 token
  if (token && !cfg.headers?.Authorization) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})
// 网关/重启窗口：502/503/504 是 nginx「上游 pm2 进程正在重启」的暂时断连，不是业务错误。
// GET 幂等请求自动重试（自愈），避免版本更新重启那 1~3 秒把英文 raw message 弹成红色 Toast。
const TRANSIENT_STATUS = new Set([502, 503, 504])
const TRANSIENT_RETRIES = 3

api.interceptors.response.use(
  res => {
    if (res.data && typeof res.data.code === 'number' && res.data.code !== 0) {
      return Promise.reject(new Error(res.data.msg || '请求失败'))
    }
    return res
  },
  async err => {
    const status = err.response?.status
    const cfg = err.config
    if (status === 401 && !cfg?.url?.includes('/login')) {
      // 静默鉴权请求（X-Silent-Auth）：调用方自带 catch 兜底的「锦上添花」接口（如分享取码），
      // 401 不代表会话失效场景需要处理，绝不跳登录页——否则匿名访客会被踢离当前页面。
      if (cfg?.headers?.['X-Silent-Auth']) {
        return Promise.reject(new Error(err.response?.data?.msg || err.message || '请求失败'))
      }
      const admin = cfg?.url?.startsWith('/api/admin')
      // 同步清空响应式 store，避免「localStorage 已删但页面仍显示已登录」的假登录态
      if (admin) setAdminAuth('', null)
      else setAuth('', null)
      if (!redirecting) {
        redirecting = true
        // 带回跳地址：正在编辑长表单时被踢登录，登录后回原页面；避免丢用户上下文。
        const from = router.currentRoute?.value
        const redirect = from && !['/login', '/admin/login'].includes(from.path) ? from.fullPath : ''
        const target = admin ? '/admin/login' : '/login'
        router.push(redirect && !admin ? { path: target, query: { redirect } } : target)
          .catch(() => {}).finally(() => { setTimeout(() => { redirecting = false }, 800) })
      }
    }
    // 重启窗口自愈：仅 GET 重试（POST 不重试防重复提交），递增间隔覆盖典型 pm2 拉起时间。
    if (TRANSIENT_STATUS.has(status) && cfg && String(cfg.method || 'get').toLowerCase() === 'get') {
      cfg.__transientRetries = cfg.__transientRetries || 0
      if (cfg.__transientRetries < TRANSIENT_RETRIES) {
        cfg.__transientRetries += 1
        await new Promise(r => setTimeout(r, 700 * cfg.__transientRetries))
        return api(cfg)
      }
    }
    // nginx 502 是 HTML，没有 JSON msg；别把 axios 英文原文「Request failed with status code 502」透给用户。
    const friendly = status === 502 ? '服务正在重启或网关暂不可用，请稍后再试'
      : status === 503 ? '服务维护中，请稍后再试'
      : status === 504 ? '服务响应超时，请稍后再试'
      : status >= 500 ? '服务暂时不可用，请稍后再试' : ''
    const msg = err.response?.data?.msg || friendly || err.message || '网络异常'
    return Promise.reject(new Error(msg))
  }
)
export default api
