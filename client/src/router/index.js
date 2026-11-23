import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import CardView from '../views/CardView.vue'
import Login from '../views/Login.vue'
import Dashboard from '../views/Dashboard.vue'
import CardEdit from '../views/CardEdit.vue'
import Plans from '../views/Plans.vue'
import PayResult from '../views/PayResult.vue'
import PrintDesign from '../views/PrintDesign.vue'
import Admin from '../views/Admin.vue'

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
