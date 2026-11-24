<template>
  <div v-if="show" class="member-shell-root">
    <div v-if="ui.drawerOpen" class="m-mask" @click="closeDrawer"></div>
    <aside class="m-drawer" :class="{ open: ui.drawerOpen }">
      <div class="m-drawer-head">
        <div class="m-drawer-ava">{{ (auth.user?.phone || '名').slice(0, 1) }}</div>
        <div class="m-drawer-who">
          <b>{{ auth.user?.phone || '我的账户' }}</b>
          <span>名片工作台</span>
        </div>
        <button class="m-drawer-close" aria-label="关闭菜单" @click="closeDrawer">✕</button>
      </div>

      <div class="m-drawer-body">
        <section class="m-group">
          <div class="m-group-title">名片</div>
          <button @click="go('/me')"><i>▤</i>我的名片</button>
          <button @click="goPublic('')"><i>↗</i>公开名片页</button>
          <button @click="goPublic('?save=1')"><i>▦</i>存入通讯录二维码</button>
          <button @click="go('/market')"><i>⌕</i>名片集市</button>
          <button @click="doShare"><i>↗</i>分享名片</button>
        </section>

        <section class="m-group">
          <div class="m-group-title">资料</div>
          <button @click="go('/me/card')"><i>✎</i>编辑资料</button>
          <button @click="go('/me/card?focus=appearance')"><i>🎨</i>模板与配色</button>
          <button @click="go('/me/card?focus=bio')"><i>📝</i>完善资料</button>
          <button @click="go('/me/print')"><i>🖨</i>实体名片版式</button>
        </section>

        <section class="m-group">
          <div class="m-group-title">我的</div>
          <button @click="go('/me/profile')"><i>◉</i>账户信息</button>
          <button @click="go('/me/contacts')"><i>▤</i>我的名片夹</button>
          <button @click="go('/me/stats')"><i>📊</i>浏览统计 / 订单</button>
          <button @click="go('/me/plans')"><i>💎</i>套餐 / 续期</button>
          <button class="danger" @click="logoutNow"><i>⏻</i>退出登录</button>
        </section>
        <p class="m-drawer-note">名片的模板与配色跟随当前账号，分享出去的名片页即用户调整后的效果。</p>
      </div>
    </aside>

    <nav class="m-tabs">
      <button v-for="t in tabs" :key="t.path" :class="{ on: isActive(t), feature: t.feature }" @click="go(t.path)">
        <i>{{ t.ico }}</i><span>{{ t.label }}</span>
      </button>
    </nav>
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../api'
import { auth, ui, closeDrawer, logout, showToast } from '../store'
import { shareOrCopy } from '../utils/share'
import { isWeChat } from '../utils/save-image'

const route = useRoute()
const router = useRouter()
const show = computed(() => (route.path.startsWith('/me') && !route.path.startsWith('/me/pay')) || route.path === '/market')
// 集市放在正中并做凸起强调：当前阶段以发现对口伙伴为重点
const tabs = [
  { path: '/me', label: '名片', ico: '▤', exact: true },
  { path: '/me/stats', label: '统计', ico: '📊', exact: false },
  { path: '/market', label: '集市', ico: '⌕', exact: true, feature: true },
  { path: '/me/contacts', label: '名片夹', ico: '▤', exact: false },
  { path: '/me/profile', label: '我的', ico: '◉', exact: false }
]
const slug = ref('')
let slugBusy = false

function isActive(t) { return t.exact ? route.path === t.path : route.path.startsWith(t.path) }
function go(path) {
  closeDrawer()
  if (route.fullPath !== path) router.push(path)
}
async function loadSlug(force) {
  if (slugBusy || (slug.value && !force)) return
  slugBusy = true
  try {
    const { data } = await api.get('/api/cards/mine')
    slug.value = data?.data?.slug || ''
  } catch { /* 菜单其余入口不依赖 slug，失败不阻断 */ }
  finally { slugBusy = false }
}
async function goPublic(query) {
  closeDrawer()
  await loadSlug()
  if (!slug.value) return showToast('还没有名片，请先创建', 'error')
  router.push(`/c/${slug.value}${query}`)
}
async function doShare() {
  closeDrawer()
  await loadSlug()
  const url = slug.value ? `${location.origin}/c/${slug.value}` : location.origin
  if (isWeChat()) return showToast('点右上角「···」→ 发送给朋友 / 分享到朋友圈', 'error')
  const r = await shareOrCopy({ title: '我的电子名片', text: '扫一扫保存我的名片', url })
  if (r === 'copied') showToast('链接已复制', 'success')
  else if (r === 'failed') showToast('复制失败，请手动复制地址栏链接', 'error')
}
function logoutNow() {
  logout()
  closeDrawer()
  router.push('/')
}

watch(show, v => {
  document.body.classList.toggle('member-shell', v)
  if (!v) closeDrawer()
}, { immediate: true })
watch(() => route.path, () => closeDrawer())
watch(() => ui.drawerOpen, v => {
  document.body.classList.toggle('drawer-open', v) // 菜单图标三横↔三竖状态
  if (v) loadSlug()
})
onBeforeUnmount(() => {
  document.body.classList.remove('member-shell')
  document.body.classList.remove('drawer-open')
})
</script>

<style scoped>
.m-mask { position: fixed; inset: 0; z-index: 120; background: rgba(15,23,42,.5); }
.m-drawer {
  position: fixed; top: 0; right: 0; bottom: 0; z-index: 121; width: min(84vw, 340px);
  background: #fff; color: #162033; display: flex; flex-direction: column;
  transform: translateX(100%); transition: transform .22s ease; box-shadow: -12px 0 40px rgba(0,0,0,.22);
}
.m-drawer.open { transform: translateX(0); }
.m-drawer-head { display: flex; align-items: center; gap: 10px; padding: 18px 16px; background: linear-gradient(135deg, #17357c, #2563eb); color: #fff; flex: 0 0 auto; }
.m-drawer-ava { width: 38px; height: 38px; border-radius: 50%; background: rgba(255,255,255,.18); display: grid; place-items: center; font-weight: 700; }
.m-drawer-who { flex: 1; min-width: 0; }
.m-drawer-who b { display: block; font-size: 13px; }
.m-drawer-who span { font-size: 11px; opacity: .75; }
.m-drawer-close { width: 30px; height: 30px; border-radius: 50%; background: rgba(255,255,255,.16); color: #fff; font-size: 13px; }
.m-drawer-body { flex: 1; overflow-y: auto; padding: 10px 0 calc(20px + env(safe-area-inset-bottom)); }
.m-group { padding: 8px 0; border-bottom: 1px solid var(--line); }
.m-group-title { padding: 4px 18px 8px; font-size: 11px; letter-spacing: .16em; color: var(--muted); font-weight: 700; }
.m-group button { display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 18px; font-size: 14px; text-align: left; color: var(--text); }
.m-group button:active { background: #f1f5f9; }
.m-group button i { width: 22px; text-align: center; font-style: normal; color: var(--primary); }
.m-group button.danger { color: var(--danger); }
.m-group button.danger i { color: var(--danger); }
.m-drawer-note { padding: 14px 18px 0; font-size: 11px; line-height: 1.6; color: var(--muted); }
.m-tabs {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 110; display: grid; grid-template-columns: repeat(5, 1fr);
  padding-bottom: env(safe-area-inset-bottom); background: #fff; border-top: 1px solid var(--line); box-shadow: 0 -4px 18px rgba(15,23,42,.06);
}
.m-tabs button { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 0 7px; font-size: 11px; color: var(--muted); }
.m-tabs button i { font-style: normal; font-size: 18px; line-height: 1.2; }
.m-tabs button.on { color: var(--primary); font-weight: 700; }
/* 名片集市为重点入口：中间凸起圆钮，不随页面主题变化 */
.m-tabs button.feature i {
  width: 42px; height: 42px; margin-top: -16px; border-radius: 50%; display: grid; place-items: center;
  background: linear-gradient(135deg, var(--primary), #4338ca); color: #fff; font-size: 22px;
  box-shadow: 0 6px 18px rgba(37,99,235,.42); border: 3px solid #fff; box-sizing: border-box;
}
.m-tabs button.feature span { margin-top: -2px; }
.m-tabs button.feature.on span { color: var(--primary); }
</style>
