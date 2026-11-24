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
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})
api.interceptors.response.use(
  res => {
    if (res.data && typeof res.data.code === 'number' && res.data.code !== 0) {
      return Promise.reject(new Error(res.data.msg || '请求失败'))
    }
    return res
  },
  err => {
    const status = err.response?.status
    const msg = err.response?.data?.msg || err.message || '网络异常'
    if (status === 401 && !err.config?.url?.includes('/login')) {
      const admin = err.config?.url?.startsWith('/api/admin')
      // 同步清空响应式 store，避免「localStorage 已删但页面仍显示已登录」的假登录态
      if (admin) setAdminAuth('', null)
      else setAuth('', null)
      if (!redirecting) {
        redirecting = true
        router.push(admin ? '/admin/login' : '/login').catch(() => {}).finally(() => { setTimeout(() => { redirecting = false }, 800) })
      }
    }
    return Promise.reject(new Error(msg))
  }
)
export default api
