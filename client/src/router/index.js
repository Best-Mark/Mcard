import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import api from '../api'
import { setAuth, showToast } from '../store'
import { isWeChat } from '../utils/save-image'

// 路由懒加载：首页同步首屏直达，其余按访问分块加载，减小首屏 JS 体积。
const CardView = () => import('../views/CardView.vue')
const Market = () => import('../views/Market.vue')
const Login = () => import('../views/Login.vue')
const WechatCallback = () => import('../views/WechatCallback.vue')
const WechatQrLogin = () => import('../views/WechatQrLogin.vue')
const WechatQrResult = () => import('../views/WechatQrResult.vue')
const Dashboard = () => import('../views/Dashboard.vue')
const Profile = () => import('../views/Profile.vue')
const CardEdit = () => import('../views/CardEdit.vue')
const Plans = () => import('../views/Plans.vue')
const PayResult = () => import('../views/PayResult.vue')
const Contacts = () => import('../views/Contacts.vue')
const Stats = () => import('../views/Stats.vue')
const PrintDesign = () => import('../views/PrintDesign.vue')
const Admin = () => import('../views/Admin.vue')

const routes = [
  { path: '/', name: 'home', component: Home },
  { path: '/c/:slug', name: 'card', component: CardView },
  { path: '/market', name: 'market', component: Market },
  { path: '/login', name: 'login', component: Login },
  { path: '/wechat/callback', name: 'wechat-callback', component: WechatCallback },
  { path: '/wechat/qr-login', name: 'wechat-qr-login', component: WechatQrLogin },
  { path: '/wechat/qr-result', name: 'wechat-qr-result', component: WechatQrResult },
  { path: '/me', name: 'dashboard', component: Dashboard, meta: { auth: true } },
  { path: '/me/profile', name: 'profile', component: Profile, meta: { auth: true } },
  { path: '/me/card', name: 'card-edit', component: CardEdit, meta: { auth: true } },
  { path: '/me/plans', name: 'plans', component: Plans, meta: { auth: true } },
  { path: '/me/pay/:id', name: 'pay', component: PayResult, meta: { auth: true } },
  { path: '/me/print', name: 'print', component: PrintDesign, meta: { auth: true } },
  { path: '/me/contacts', name: 'contacts', component: Contacts, meta: { auth: true } },
  // 收藏夹复用名片夹列表（同一真相源），仅默认筛选为「收藏」
  { path: '/me/favorites', name: 'favorites', component: Contacts, meta: { auth: true } },
  { path: '/me/stats', name: 'stats', component: Stats, meta: { auth: true } },
  { path: '/admin/login', name: 'admin-login', component: Admin },
  { path: '/admin', name: 'admin', component: Admin, meta: { admin: true } },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({ history: createWebHistory(), routes, scrollBehavior: () => ({ top: 0 }) })

// 微信内 → 外部浏览器免二次登录：外部浏览器打开带 wx_ticket 的 URL 时，
// 用一次性凭证换登录态，成功后立即从 URL 清除 ticket（防泄露/防刷新重放）。
let ticketHandled = false
router.beforeEach(async (to, _from, next) => {
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
  if (to.meta.auth && !localStorage.getItem('mcard_token')) return next({ path: '/login', query: { redirect: to.fullPath } })
  if (to.meta.admin && !localStorage.getItem('mcard_admin_token')) return next('/admin/login')
  next()
})
export default router
