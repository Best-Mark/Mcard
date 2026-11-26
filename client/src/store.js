import { reactive } from 'vue'

const read = key => { try { return JSON.parse(localStorage.getItem(key) || 'null') } catch { return null } }
const cachedUser = read('mcard_user')

// 身份是否恢复完成：刷新后 /api/auth/me 异步拉取推广员等后台可变身份，
// 路由守卫的 promoter 判断必须等它落地，否则推广员刷新深链会被误判弹回 /me。
let resolveAuthReady = null
export const authReady = new Promise(resolve => { resolveAuthReady = resolve })
export function markAuthReady() { if (resolveAuthReady) { resolveAuthReady(); resolveAuthReady = null } }

export const auth = reactive({
  token: localStorage.getItem('mcard_token') || '',
  user: cachedUser,
  isAdmin: !!cachedUser && ['admin', 'super_admin'].includes(cachedUser.role),
  isPromoter: !!cachedUser && !!cachedUser.is_promoter
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
  // 切换账号后邀请码可能变化（含非推广员→空码），清缓存让下次分享重新拉取
  import('./utils/invite').then(m => m.clearInviteCache()).catch(() => {})
  auth.token = token || ''
  auth.user = user || null
  auth.isAdmin = !!user && ['admin', 'super_admin'].includes(user.role)
  auth.isPromoter = !!user && !!user.is_promoter
  localStorage.setItem('mcard_token', auth.token)
  localStorage.setItem('mcard_user', JSON.stringify(auth.user))
}

// 邀请归因统一出口：登录后回传本地落地的邀请码，成功即清除。失败不阻断登录，下次仍可重试。
// 传 api 参数避免 store ↔ api 循环依赖（api 顶层 import 了本模块）。
export async function bindPendingInvite(api) {
  const invite = localStorage.getItem('mcard_invite') || ''
  if (!invite || !auth.token) return
  try {
    await api.post('/api/promo/bind-invite', { invite })
    localStorage.removeItem('mcard_invite')
  } catch { /* 归因兜底失败不影响登录，localStorage 保留待下次重试 */ }
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
