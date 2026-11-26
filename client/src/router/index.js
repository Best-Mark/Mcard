import { createRouter, createWebHistory } from 'vue-router'
import api from '../api'
import { setAuth, showToast, siteConfig, ensureSiteConfig, bindPendingInvite, auth, authReady } from '../store'
import { isWeChat } from '../utils/save-image'
import { scheduleDefaultShare } from '../utils/wx-share'
import { isPC } from '../utils/device'

// 路由懒加载：按访问分块加载，减小首屏 JS 体积。
// 根路径按设备分流：PC 进大气搜索门户 /portal，H5 直接进集市 /market（底部导航正常显示）。
const PortalHome = () => import('../views/desktop/PortalHome.vue')
const CardView = () => import('../views/CardView.vue')
const Market = () => import('../views/Market.vue')
const Login = () => import('../views/Login.vue')
const WechatCallback = () => import('../views/WechatCallback.vue')
const WechatQrLogin = () => import('../views/WechatQrLogin.vue')
const WechatQrResult = () => import('../views/WechatQrResult.vue')
const Dashboard = () => import('../views/Dashboard.vue')
const Profile = () => import('../views/Profile.vue')
const AccountProfile = () => import('../views/AccountProfile.vue')
const CardEdit = () => import('../views/CardEdit.vue')
const CardStyle = () => import('../views/CardStyle.vue')
const CardMarket = () => import('../views/CardMarket.vue')
const Plans = () => import('../views/Plans.vue')
const PayResult = () => import('../views/PayResult.vue')
const Contacts = () => import('../views/Contacts.vue')
const Stats = () => import('../views/Stats.vue')
const PrintDesign = () => import('../views/PrintDesign.vue')
const Notifications = () => import('../views/Notifications.vue')
const MaterialView = () => import('../views/MaterialView.vue')
const BatchScan = () => import('../views/BatchScan.vue')
const Admin = () => import('../views/Admin.vue')
const PromoCenter = () => import('../views/PromoCenter.vue')
const WithdrawAccount = () => import('../views/WithdrawAccount.vue')
const WithdrawAccountEdit = () => import('../views/WithdrawAccountEdit.vue')

const routes = [
  // PC 门户首页；H5 访问 /portal 时也重定向回集市，避免移动端看到桌面宽屏布局
  { path: '/', redirect: () => (isPC.value ? '/portal' : '/market') },
  { path: '/portal', name: 'portal', component: PortalHome },
  { path: '/c/:slug', name: 'card', component: CardView },
  { path: '/m/:slug', name: 'material', component: MaterialView },
  { path: '/market', name: 'market', component: Market },
  { path: '/login', name: 'login', component: Login },
  { path: '/wechat/callback', name: 'wechat-callback', component: WechatCallback },
  { path: '/wechat/qr-login', name: 'wechat-qr-login', component: WechatQrLogin },
  { path: '/wechat/qr-result', name: 'wechat-qr-result', component: WechatQrResult },
  { path: '/me', name: 'dashboard', component: Dashboard, meta: { auth: true } },
  { path: '/me/profile', name: 'profile', component: Profile, meta: { auth: true } },
  { path: '/me/account', name: 'account-profile', component: AccountProfile, meta: { auth: true } },
  { path: '/me/card', name: 'card-edit', component: CardEdit, meta: { auth: true } },
  { path: '/me/card/style', name: 'card-style', component: CardStyle, meta: { auth: true } },
  { path: '/me/card/market', name: 'card-market', component: CardMarket, meta: { auth: true } },
  { path: '/me/plans', name: 'plans', component: Plans, meta: { auth: true } },
  { path: '/me/pay/:id', name: 'pay', component: PayResult, meta: { auth: true } },
  { path: '/me/print', name: 'print', component: PrintDesign, meta: { auth: true } },
  { path: '/me/contacts', name: 'contacts', component: Contacts, meta: { auth: true } },
  { path: '/me/stats', name: 'stats', component: Stats, meta: { auth: true } },
  { path: '/me/notifications', name: 'notifications', component: Notifications, meta: { auth: true } },
  { path: '/me/batch-scan', name: 'batch-scan', component: BatchScan, meta: { auth: true } },
  { path: '/me/promo', name: 'promo', component: PromoCenter, meta: { auth: true, promoter: true } },
  { path: '/me/withdraw-account', name: 'withdraw-account', component: WithdrawAccount, meta: { auth: true, promoter: true } },
  { path: '/me/withdraw-account-edit', name: 'withdraw-account-edit', component: WithdrawAccountEdit, meta: { auth: true, promoter: true } },
  { path: '/admin/login', name: 'admin-login', component: Admin },
  { path: '/admin', name: 'admin', component: Admin, meta: { admin: true } },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({ history: createWebHistory(), routes, scrollBehavior: () => ({ top: 0 }) })

// 微信内「打开页面即登录」（snsapi_base 静默授权）回调后 token 走 URL hash 回到原页面。
// 任意页面都要能消费；显式登录的 /wechat/callback 刻意跳过，由 WechatCallback.vue 独占处理，
// 避免两边抢同一份 hash（一次性凭证被先到者消费导致对方误报失败）。
function consumeAuthHash(to) {
  if (to.path === '/wechat/callback') return
  const p = new URLSearchParams(location.hash.replace(/^#/, ''))
  const token = p.get('token') || ''
  const raw = p.get('user') || ''
  if (!token || !raw) return
  let user
  try { user = JSON.parse(raw) } catch { return }
  if (!user || !user.id) return
  setAuth(token, user)
  bindPendingInvite(api) // 静默登录场景的邀请归因兜底
  history.replaceState(null, '', location.pathname + location.search)
}

// 不触发自动登录的路径：登录/回调/扫码链路与后台（后台是独立管理员 token 体系）。
const SILENT_SKIP = ['/login', '/wechat/callback', '/wechat/qr-login', '/wechat/qr-result', '/admin']
const SILENT_COOLDOWN = 10 * 60 * 1000
let silentStarted = false
async function maybeWechatSilentLogin(to) {
  if (silentStarted || !isWeChat()) return false
  if (localStorage.getItem('mcard_token')) return false
  // 服务端回调失败带 wx_err 回来：本轮不再重试，避免授权失败时来回跳死循环
  if (to.query.wx_err) return false
  if (new URLSearchParams(location.hash.replace(/^#/, '')).has('token')) return false
  if (SILENT_SKIP.some(p => to.path === p || to.path.startsWith(p + '/'))) return false
  const last = Number(localStorage.getItem('wx_silent_attempt_at') || 0)
  if (last && Date.now() - last < SILENT_COOLDOWN) return false
  await ensureSiteConfig(api)
  if (!siteConfig.wechat_login_enabled) return false
  try {
    const target = String(to.fullPath || '/').split('#')[0] || '/'
    const { data } = await api.get('/api/auth/wechat/silent-url', { params: { redirect: target } })
    const url = data?.data?.url
    if (!url) return false
    // 先记账再跳：微信授权页报错返回时靠冷却时间兜底，绝不无限重跳
    localStorage.setItem('wx_silent_attempt_at', String(Date.now()))
    silentStarted = true
    location.replace(url)
    return true
  } catch { return false }
}

// 微信内 → 外部浏览器免二次登录：外部浏览器打开带 wx_ticket 的 URL 时，
// 用一次性凭证换登录态，成功后立即从 URL 清除 ticket（防泄露/防刷新重放）。
let ticketHandled = false
router.beforeEach(async (to, _from, next) => {
  // 邀请归因零丢失：任何页面带邀请参数都落地保存，登录成功后由各登录入口回传绑定。
  const inv = to.query.invite || to.query.invite_code || to.query.ref
  if (inv) localStorage.setItem('mcard_invite', String(inv).slice(0, 20))
  consumeAuthHash(to)
  // 门户首页仅 PC 形态可见；H5/小程序 web-view 内访问一律回集市
  if (to.path === '/portal' && !isPC.value) return next('/market')
  const ticket = to.query.wx_ticket
  // 只在外部浏览器兑换；微信内保留 ticket 在 URL，供「在浏览器中打开」带出去
  if (ticket && !ticketHandled && !isWeChat()) {
    ticketHandled = true
    try {
      const { data } = await api.post('/api/auth/share-ticket/exchange', { ticket })
      setAuth(data.data.token, data.data.user)
      // 清除 URL 中的 ticket，保留其余 query 与目标路径
      const query = { ...to.query }
      delete query.wx_ticket
      return next({ path: to.path, query, replace: true })
    } catch (e) {
      showToast('登录凭证已失效，请重新登录', 'error')
      const query = { ...to.query }
      delete query.wx_ticket
      return next({ path: to.path, query, replace: true })
    }
  }
  if (await maybeWechatSilentLogin(to)) return next(false) // 已整页跳微信授权，当前导航取消
  if (to.meta.auth && !localStorage.getItem('mcard_token')) return next({ path: '/login', query: { redirect: to.fullPath } })
  // 推广员身份可能由后台变更：刷新后等 /api/auth/me 权威身份落地再判，避免误弹推广员。
  if (to.meta.promoter && auth.token) await authReady
  if (to.meta.promoter && !auth.isPromoter) return next('/me')
  if (to.meta.admin && !localStorage.getItem('mcard_admin_token')) return next('/admin/login')
  next()
})

// 全局分享兜底：本页 900ms 内没有页面自己配置卡片，就用素材池随机配一张默认卡片。
// 解决大量未接入分享的页面转发出去是「网址 + 空白封面」裸链接的问题（对齐 MShop）。
router.afterEach(() => scheduleDefaultShare(api))
export default router
