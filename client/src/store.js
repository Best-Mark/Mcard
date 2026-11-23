import { reactive } from 'vue'

const read = key => { try { return JSON.parse(localStorage.getItem(key) || 'null') } catch { return null } }

export const auth = reactive({
  token: localStorage.getItem('mcard_token') || '',
  user: read('mcard_user'),
  isAdmin: false
})

export const adminAuth = reactive({
  token: localStorage.getItem('mcard_admin_token') || '',
  user: read('mcard_admin_user')
})

export function setAuth(token, user) {
  auth.token = token || ''
  auth.user = user || null
  auth.isAdmin = !!user && ['admin', 'super_admin'].includes(user.role)
  localStorage.setItem('mcard_token', auth.token)
  localStorage.setItem('mcard_user', JSON.stringify(auth.user))
}

export function setAdminAuth(token, user) {
  adminAuth.token = token || ''
  adminAuth.user = user || null
  localStorage.setItem('mcard_admin_token', adminAuth.token)
  localStorage.setItem('mcard_admin_user', JSON.stringify(adminAuth.user))
}

export function logout() {
  setAuth('', null)
}

export function adminLogout() {
  setAdminAuth('', null)
}

export const toast = reactive({ text: '', type: '' })
let timer = null
export function showToast(text, type = '') {
  toast.text = text
  toast.type = type
  clearTimeout(timer)
  timer = setTimeout(() => { toast.text = '' }, 3200)
}

export const siteConfig = reactive({ site_name: 'MCard 电子名片', site_desc: '一扫即存，永久有效', wechat_login_enabled: false })
export async function loadSiteConfig(api) {
  try {
    const { data } = await api.get('/api/public/config')
    Object.assign(siteConfig, data.data || {})
  } catch { /* 使用默认值 */ }
}
