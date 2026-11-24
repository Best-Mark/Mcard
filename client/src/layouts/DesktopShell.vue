<template>
  <div class="desktop-shell">
    <aside class="ds-side">
      <div class="ds-brand" @click="go('/me')">
        <span class="ds-logo">M</span>
        <span class="ds-brand-text"><b>MCard</b><small>电子名片工作台</small></span>
      </div>

      <button v-if="logged" class="ds-cta" @click="go('/me/card')">✎ 编辑我的名片</button>
      <button v-else class="ds-cta" @click="go('/login')">登录 / 注册</button>

      <nav class="ds-nav">
        <div v-for="g in groups" :key="g.title" class="ds-group">
          <div class="ds-group-title">{{ g.title }}</div>
          <button v-for="it in g.items" :key="it.label"
                  :class="{ on: isNavActive(it), danger: it.danger }"
                  @click="onNav(it)">
            <i>{{ it.ico }}</i>
            <span>{{ it.label }}</span>
            <em v-if="it.badge === 'unread' && unread">{{ unread }}</em>
          </button>
        </div>
      </nav>

      <div class="ds-foot">
        <div v-if="logged" class="ds-user">
          <span class="ds-ava">{{ (auth.user?.phone || '名').slice(0, 1) }}</span>
          <span class="ds-user-text"><b>{{ auth.user?.phone || '我的账户' }}</b><small>已登录</small></span>
        </div>
        <div class="ds-ver">MCard · 让每张名片都值得保存</div>
      </div>
    </aside>

    <div class="ds-main">
      <header class="ds-topbar">
        <div class="ds-crumb"><span>工作台</span><b>/</b><strong>{{ pageTitle }}</strong></div>
        <div class="ds-top-actions">
          <button class="ds-icon-btn" title="搜索名片集市" @click="go('/market')">⌕</button>
          <button class="ds-icon-btn" title="消息通知" @click="go('/me/notifications')">🔔<em v-if="unread" class="ds-dot"></em></button>
          <button class="ds-icon-btn" title="查看我的公开名片" @click="goPublic('')">↗</button>
          <button v-if="logged" class="ds-user-chip" @click="go('/me/profile')">{{ (auth.user?.phone || '我').slice(0, 1) }}</button>
          <button v-else class="ds-login" @click="go('/login')">登录</button>
        </div>
      </header>
      <main class="ds-content">
        <slot />
      </main>
    </div>
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
const groups = DRAWER_GROUPS
const logged = computed(() => !!auth.token)
const unread = ref(0)
let unreadTimer = null

const TITLES = {
  '/me': '我的名片', '/me/stats': '浏览统计', '/market': '名片集市', '/me/card': '编辑资料',
  '/me/plans': '套餐与续期', '/me/contacts': '我的名片夹', '/me/profile': '账户信息',
  '/me/print': '实体名片版式', '/me/notifications': '消息通知', '/me/batch-scan': '展会连扫'
}
const pageTitle = computed(() => TITLES[route.path] || (route.path.startsWith('/me/card') ? '编辑资料' : '工作台'))

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
.desktop-shell { display: flex; min-height: 100vh; background: var(--bg, #f5f7fb); }
.ds-side { width: 248px; flex: 0 0 248px; background: linear-gradient(180deg, #0f172a, #111c33); color: #cbd5e1; display: flex; flex-direction: column; position: sticky; top: 0; height: 100vh; z-index: 40; }
.ds-brand { display: flex; align-items: center; gap: 11px; padding: 22px 20px 18px; cursor: pointer; }
.ds-logo { width: 40px; height: 40px; border-radius: 12px; background: linear-gradient(135deg, #60a5fa, #2563eb); color: #fff; display: grid; place-items: center; font-size: 22px; font-weight: 800; }
.ds-brand-text b { display: block; color: #fff; font-size: 17px; letter-spacing: .02em; }
.ds-brand-text small { font-size: 11px; color: #94a3b8; }
.ds-cta { margin: 4px 16px 12px; padding: 11px; border: 0; border-radius: 10px; background: linear-gradient(135deg, #2563eb, #4338ca); color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; }
.ds-cta:hover { filter: brightness(1.08); }
.ds-nav { flex: 1; overflow-y: auto; padding: 4px 10px 20px; }
.ds-group { margin-bottom: 12px; }
.ds-group-title { padding: 10px 12px 6px; font-size: 10px; letter-spacing: .18em; color: #64748b; font-weight: 700; }
.ds-group button { display: flex; align-items: center; gap: 11px; width: 100%; padding: 10px 12px; border: 0; border-radius: 9px; background: transparent; color: #cbd5e1; font-size: 13px; text-align: left; cursor: pointer; }
.ds-group button:hover { background: rgba(255,255,255,.06); color: #fff; }
.ds-group button.on { background: rgba(37,99,235,.22); color: #fff; font-weight: 700; }
.ds-group button i { width: 20px; text-align: center; font-style: normal; }
.ds-group button span { flex: 1; }
.ds-group button em { font-style: normal; font-size: 10px; min-width: 18px; height: 18px; line-height: 18px; text-align: center; border-radius: 9px; background: #ef4444; color: #fff; }
.ds-group button.danger { color: #fca5a5; }
.ds-foot { padding: 14px 18px 20px; border-top: 1px solid rgba(255,255,255,.08); }
.ds-user { display: flex; align-items: center; gap: 10px; }
.ds-ava { width: 34px; height: 34px; border-radius: 50%; background: rgba(255,255,255,.14); display: grid; place-items: center; color: #fff; font-weight: 700; }
.ds-user-text b { display: block; color: #fff; font-size: 12px; }
.ds-user-text small { font-size: 10px; color: #64748b; }
.ds-ver { margin-top: 12px; font-size: 10px; color: #475569; }
.ds-main { flex: 1; min-width: 0; }
.ds-topbar { position: sticky; top: 0; z-index: 30; height: 64px; display: flex; align-items: center; justify-content: space-between; padding: 0 28px; background: rgba(255,255,255,.92); backdrop-filter: blur(12px); border-bottom: 1px solid var(--line, #e8edf4); }
.ds-crumb { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted, #6b7688); }
.ds-crumb b { color: #cbd5e1; }
.ds-crumb strong { color: var(--text, #162033); }
.ds-top-actions { display: flex; align-items: center; gap: 8px; }
.ds-icon-btn { position: relative; width: 36px; height: 36px; border-radius: 9px; border: 1px solid var(--line, #e8edf4); background: #fff; font-size: 15px; cursor: pointer; }
.ds-dot { position: absolute; top: 6px; right: 6px; width: 7px; height: 7px; border-radius: 50%; background: #ef4444; }
.ds-user-chip { width: 36px; height: 36px; border-radius: 50%; border: 0; background: linear-gradient(135deg, #2563eb, #4338ca); color: #fff; font-weight: 700; cursor: pointer; }
.ds-login { padding: 8px 16px; border-radius: 9px; border: 0; background: var(--primary, #2563eb); color: #fff; font-size: 13px; cursor: pointer; }
.ds-content { padding: 22px 28px 60px; max-width: 1440px; margin: 0 auto; }
</style>
