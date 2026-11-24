<template>
  <div class="desktop-shell">
    <header class="ds-nav">
      <div class="ds-nav-in">
        <div class="ds-brand" @click="go('/')">
          <span class="ds-logo">M</span>
          <span class="ds-brand-txt"><b>MCard</b><small>电子名片</small></span>
        </div>
        <nav class="ds-main-links">
          <button :class="{ on: route.path === '/market' }" @click="go('/market')">名片集市</button>
          <button :class="{ on: route.path === '/me' }" @click="go('/me')">我的名片</button>
          <button :class="{ on: route.path === '/me/contacts' }" @click="go('/me/contacts')">名片夹</button>
          <button :class="{ on: route.path === '/me/stats' }" @click="go('/me/stats')">统计</button>
        </nav>
        <div class="ds-actions">
          <button class="ds-search" title="搜索名片" @click="go('/market')">⌕ <span>搜索名片 / 伙伴</span></button>
          <button class="ds-icon" title="消息通知" @click="go('/me/notifications')">🔔<em v-if="unread" class="ds-dot"></em></button>
          <button class="ds-icon" title="查看我的公开名片" @click="goPublic('')">↗</button>
          <button v-if="logged" class="ds-user" @click="go('/me/profile')">{{ (auth.user?.phone || '我').slice(0, 1) }}</button>
          <button v-else class="ds-login" @click="go('/login')">登录 / 注册</button>
        </div>
      </div>
    </header>

    <div class="ds-subbar">
      <div class="ds-subbar-in">
        <div class="ds-crumb"><span>工作台</span><b>/</b><strong>{{ pageTitle }}</strong></div>
        <nav class="ds-sub-links">
          <button v-for="it in subItems" :key="it.label" :class="{ on: isNavActive(it), danger: it.danger }" @click="onNav(it)">
            <i>{{ it.ico }}</i><span>{{ it.label }}</span>
            <em v-if="it.badge === 'unread' && unread">{{ unread }}</em>
          </button>
        </nav>
      </div>
    </div>

    <main class="ds-content"><slot /></main>
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../api'
import { auth, logout, showToast } from '../store'
import { DRAWER_GROUPS, runNavItem } from '../config/nav'
import { shareOrCopy } from '../utils/share'
import { isWeChat } from '../utils/save-image'

const route = useRoute()
const router = useRouter()
const logged = computed(() => !!auth.token)
const unread = ref(0)
let unreadTimer = null

const TITLES = {
  '/me': '我的名片', '/me/stats': '浏览统计', '/market': '名片集市', '/me/card': '编辑资料',
  '/me/plans': '套餐与续期', '/me/contacts': '我的名片夹', '/me/profile': '账户信息',
  '/me/print': '实体名片版式', '/me/notifications': '消息通知', '/me/batch-scan': '展会连扫'
}
const pageTitle = computed(() => TITLES[route.path] || (route.path.startsWith('/me/card') ? '编辑资料' : '工作台'))
// 二级导航仍取自 nav.js 唯一真相源，去掉「我的名片/名片集市/统计」（已在顶栏），避免重复
const subItems = computed(() => DRAWER_GROUPS.flatMap(g => g.items).filter(it => !['/me', '/market', '/me/contacts', '/me/stats'].includes(it.path)))

function isNavActive(it) {
  if (it.kind !== 'route' || !it.path) return false
  const base = it.path.split('?')[0]
  if (base === '/me') return route.path === '/me'
  return route.path.startsWith(base)
}
function go(path) { if (route.fullPath !== path) router.push(path) }

async function loadUnread() {
  if (!auth.token) { unread.value = 0; return }
  try { const { data } = await api.get('/api/notifications/unread'); unread.value = data?.data?.unread || 0 } catch {}
}
const slug = ref('')
let slugBusy = false
async function loadSlug() {
  if (slugBusy || slug.value) return
  slugBusy = true
  try { const { data } = await api.get('/api/cards/mine'); slug.value = data?.data?.slug || '' } catch {} finally { slugBusy = false }
}
async function goPublic(query) {
  await loadSlug()
  if (!slug.value) return showToast('还没有名片，请先创建', 'error')
  router.push(`/c/${slug.value}${query || ''}`)
}
async function doShare() {
  await loadSlug()
  const url = slug.value ? `${location.origin}/c/${slug.value}` : location.origin
  if (isWeChat()) return showToast('点右上角「···」分享', 'error')
  const r = await shareOrCopy({ title: '我的电子名片', text: '扫一扫保存我的名片', url })
  if (r === 'copied') showToast('链接已复制', 'success')
  else if (r === 'failed') showToast('复制失败，请手动复制地址栏链接', 'error')
}
function logoutNow() { logout(); router.push('/') }
const handlers = { go, goPublic, doShare, logoutNow }
function onNav(it) { runNavItem(it, handlers) }

onMounted(() => { loadUnread(); loadSlug(); unreadTimer = setInterval(loadUnread, 60000) })
onBeforeUnmount(() => clearInterval(unreadTimer))
</script>

<style scoped>
.desktop-shell { min-height: 100vh; background: var(--bg, #f5f7fb); }
.ds-nav { position: sticky; top: 0; z-index: 40; background: rgba(255,255,255,.96); backdrop-filter: blur(14px); border-bottom: 1px solid #eef1f6; }
.ds-nav-in { max-width: 1440px; margin: 0 auto; height: 72px; padding: 0 40px; display: flex; align-items: center; gap: 40px; }
.ds-brand { display: flex; align-items: center; gap: 11px; cursor: pointer; flex: 0 0 auto; }
.ds-logo { width: 40px; height: 40px; border-radius: 12px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: #fff; display: grid; place-items: center; font-size: 21px; font-weight: 800; box-shadow: 0 6px 16px rgba(37,99,235,.25); }
.ds-brand-txt b { display: block; font-size: 17px; color: #162033; letter-spacing: .02em; }
.ds-brand-txt small { display: block; font-size: 10px; color: #94a3b8; }
.ds-main-links { display: flex; align-items: center; gap: 28px; flex: 1; }
.ds-main-links button { border: 0; background: transparent; font-size: 14px; color: #4a5568; padding: 8px 0; cursor: pointer; }
.ds-main-links button:hover, .ds-main-links button.on { color: #1d4ed8; font-weight: 700; }
.ds-actions { display: flex; align-items: center; gap: 10px; }
.ds-search { display: flex; align-items: center; gap: 8px; height: 38px; padding: 0 14px; border: 1px solid #e2e8f0; border-radius: 10px; background: #f8fafc; color: #94a3b8; font-size: 13px; cursor: pointer; }
.ds-search:hover { border-color: #93c5fd; color: #2563eb; }
.ds-icon { position: relative; width: 38px; height: 38px; border-radius: 10px; border: 1px solid #e8edf4; background: #fff; font-size: 15px; cursor: pointer; }
.ds-dot { position: absolute; top: 5px; right: 5px; width: 7px; height: 7px; border-radius: 50%; background: #ef4444; }
.ds-user { width: 38px; height: 38px; border-radius: 50%; border: 0; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: #fff; font-weight: 700; cursor: pointer; }
.ds-login { padding: 9px 16px; border-radius: 10px; border: 0; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; }
.ds-subbar { background: #fff; border-bottom: 1px solid #eef1f6; }
.ds-subbar-in { max-width: 1440px; margin: 0 auto; padding: 0 40px; min-height: 48px; display: flex; align-items: center; gap: 24px; }
.ds-crumb { display: flex; align-items: center; gap: 7px; font-size: 12px; color: #94a3b8; white-space: nowrap; }
.ds-crumb b { color: #cbd5e1; }
.ds-crumb strong { color: #334155; }
.ds-sub-links { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.ds-sub-links button { display: flex; align-items: center; gap: 6px; padding: 7px 12px; border: 0; border-radius: 8px; background: transparent; color: #64748b; font-size: 12px; cursor: pointer; }
.ds-sub-links button:hover { background: #f1f5f9; color: #1d4ed8; }
.ds-sub-links button.on { background: #eff6ff; color: #1d4ed8; font-weight: 700; }
.ds-sub-links button.danger { color: #dc2626; }
.ds-sub-links i { font-style: normal; }
.ds-sub-links em { font-style: normal; font-size: 10px; min-width: 16px; height: 16px; line-height: 16px; text-align: center; border-radius: 8px; background: #ef4444; color: #fff; }
.ds-content { max-width: 1440px; margin: 0 auto; padding: 28px 40px 64px; }
</style>
