import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'

// 路由懒加载：首页同步首屏直达，其余按访问分块加载，减小首屏 JS 体积。
const CardView = () => import('../views/CardView.vue')
const Login = () => import('../views/Login.vue')
const Dashboard = () => import('../views/Dashboard.vue')
const CardEdit = () => import('../views/CardEdit.vue')
const Plans = () => import('../views/Plans.vue')
const PayResult = () => import('../views/PayResult.vue')
const PrintDesign = () => import('../views/PrintDesign.vue')
const Admin = () => import('../views/Admin.vue')

const routes = [
  { path: '/', name: 'home', component: Home },
  { path: '/c/:slug', name: 'card', component: CardView },
  { path: '/login', name: 'login', component: Login },
  { path: '/me', name: 'dashboard', component: Dashboard, meta: { auth: true } },
  { path: '/me/card', name: 'card-edit', component: CardEdit, meta: { auth: true } },
  { path: '/me/plans', name: 'plans', component: Plans, meta: { auth: true } },
  { path: '/me/pay/:id', name: 'pay', component: PayResult, meta: { auth: true } },
  { path: '/me/print', name: 'print', component: PrintDesign, meta: { auth: true } },
  { path: '/admin/login', name: 'admin-login', component: Admin },
  { path: '/admin', name: 'admin', component: Admin, meta: { admin: true } },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({ history: createWebHistory(), routes, scrollBehavior: () => ({ top: 0 }) })
router.beforeEach((to, _from, next) => {
  if (to.meta.auth && !localStorage.getItem('mcard_token')) return next({ path: '/login', query: { redirect: to.fullPath } })
  if (to.meta.admin && !localStorage.getItem('mcard_admin_token')) return next('/admin/login')
  next()
})
export default router
