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

// 会员区全局导航状态：右侧抽屉由各页顶部的菜单图标开合，底部三栏常驻 /me 系列页面
export const ui = reactive({ drawerOpen: false })
export function openDrawer() { ui.drawerOpen = true }
export function closeDrawer() { ui.drawerOpen = false }
export function toggleDrawer() { ui.drawerOpen = !ui.drawerOpen }

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

export const siteConfig = reactive({ site_name: 'MCard 电子名片', site_logo: '', site_desc: '一扫即存，永久有效', wechat_login_enabled: false })
export async function loadSiteConfig(api) {
  try {
    const { data } = await api.get('/api/public/config')
    Object.assign(siteConfig, data.data || {})
    return true
  } catch { return false /* 使用默认值 */ }
}
// 微信静默登录需要在路由守卫里等到权威配置；与 main.js 挂载加载共用同一份 in-flight Promise，
// 失败则清空缓存由下一次导航重试（自愈），绝不把「加载失败」永久固化为「未开启」。
let siteConfigPromise = null
export function ensureSiteConfig(api) {
  if (!siteConfigPromise) {
    siteConfigPromise = loadSiteConfig(api).then(ok => {
      if (!ok) siteConfigPromise = null
      return ok
    })
  }
  return siteConfigPromise
}
