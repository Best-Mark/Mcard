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
          <template v-if="logged">
            <div class="ds-user-wrap" @click.stop>
              <button class="ds-user" @click="userMenuOpen = !userMenuOpen">{{ (auth.user?.phone || '我').slice(0, 1) }} <span class="ds-caret">▾</span></button>
              <div v-if="userMenuOpen" class="ds-user-menu">
                <button @click="menuGo('/me/profile')">◉ 账户信息</button>
                <button @click="menuGo('/me/plans')">💎 套餐 / 续期</button>
                <button v-if="auth.user?.is_promoter" @click="menuGo('/me/withdraw-account')">💰 收款账户</button>
                <button @click="menuDo('public')">↗ 我的公开名片</button>
                <button @click="menuDo('share')">⤴ 分享名片</button>
                <button v-if="!inWechat" class="danger" @click="menuDo('logout')">⏻ 退出登录</button>
              </div>
            </div>
          </template>
          <button v-else class="ds-login" @click="go('/login')">登录 / 注册</button>
        </div>
      </div>
    </header>

    <main class="ds-content"><slot /></main>
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../api'
import { auth, logout, showToast } from '../store'
import { shareOrCopy } from '../utils/share'
import { isWeChat } from '../utils/save-image'
import { setCardShare } from '../utils/wx-share'

const route = useRoute()
const router = useRouter()
const logged = computed(() => !!auth.token)
// 微信内打开即静默登录，退出按钮会出现「退出后又自动登录」的假死观感，故不展示。
const inWechat = isWeChat()
const unread = ref(0)
const userMenuOpen = ref(false)
let unreadTimer = null

function closeMenu() { userMenuOpen.value = false }
function go(path) { closeMenu(); if (route.fullPath !== path) router.push(path) }
function menuGo(path) { go(path) }

async function loadUnread() {
  if (!auth.token) { unread.value = 0; return }
  try { const { data } = await api.get('/api/notifications/unread'); unread.value = data?.data?.unread || 0 } catch {}
}
const slug = ref('')
const myCard = ref(null)
let slugBusy = false
async function loadSlug() {
  if (slugBusy || slug.value) return
  slugBusy = true
  try { const { data } = await api.get('/api/cards/mine'); myCard.value = data?.data || null; slug.value = myCard.value?.slug || '' } catch {} finally { slugBusy = false }
}
async function goPublic(query) {
  await loadSlug()
  if (!slug.value) return showToast('还没有名片，请先创建', 'error')
  router.push(`/c/${slug.value}${query || ''}`)
}
async function doShare() {
  await loadSlug()
  const url = myCard.value?.url || (slug.value ? `${location.origin}/c/${slug.value}` : location.origin)
  if (myCard.value) setCardShare(api, myCard.value, url)
  const name = myCard.value?.name || '名片'
  if (isWeChat()) return showToast('点右上角「···」分享', 'error')
  const r = await shareOrCopy({ title: `${name}的名片`, text: myCard.value?.bio || '扫一扫保存我的名片', url })
  if (r === 'copied') showToast('链接已复制', 'success')
  else if (r === 'failed') showToast('复制失败，请手动复制地址栏链接', 'error')
}
function logoutNow() { logout(); router.push('/') }
function menuDo(kind) {
  closeMenu()
  if (kind === 'public') goPublic('')
  else if (kind === 'share') doShare()
  else if (kind === 'logout') logoutNow()
}

function onDocClick() { closeMenu() }
onMounted(() => {
  loadUnread(); loadSlug()
  unreadTimer = setInterval(loadUnread, 60000)
  document.addEventListener('click', onDocClick)
})
onBeforeUnmount(() => {
  clearInterval(unreadTimer)
  document.removeEventListener('click', onDocClick)
})
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
.ds-user-wrap { position: relative; }
.ds-user { display: flex; align-items: center; gap: 6px; height: 38px; padding: 0 12px; border-radius: 19px; border: 0; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: #fff; font-weight: 700; font-size: 13px; cursor: pointer; }
.ds-caret { font-size: 11px; opacity: .8; }
.ds-user-menu { position: absolute; top: 46px; right: 0; z-index: 50; width: 174px; padding: 6px; border: 1px solid #e8edf4; border-radius: 12px; background: #fff; box-shadow: 0 14px 36px rgba(15,23,42,.14); }
.ds-user-menu button { display: block; width: 100%; text-align: left; padding: 10px 12px; border: 0; border-radius: 8px; background: transparent; color: #334155; font-size: 13px; cursor: pointer; }
.ds-user-menu button:hover { background: #f1f5f9; color: #1d4ed8; }
.ds-user-menu button.danger { color: #dc2626; }
.ds-user-menu button.danger:hover { background: #fef2f2; }
.ds-login { padding: 9px 16px; border-radius: 10px; border: 0; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; }
.ds-content { max-width: 1440px; margin: 0 auto; padding: 28px 40px 64px; }
</style>
