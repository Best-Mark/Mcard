import axios from 'axios'
import router from '../router'

const api = axios.create({ baseURL: '', timeout: 20000 })
api.interceptors.request.use(cfg => {
  const adminPath = cfg.url?.startsWith('/api/admin')
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
      localStorage.removeItem(admin ? 'mcard_admin_token' : 'mcard_token')
      router.push(admin ? '/admin/login' : '/login').catch(() => {})
    }
    return Promise.reject(new Error(msg))
  }
)
export default api
