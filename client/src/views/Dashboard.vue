<template>
  <!-- 我的名片：加载/错误/未创建三态由本页处理；已有名片时整页交给 CardView owner 渲染。
       ⚠️ owner 与公开名片页必须同模板、同内容、同样式，唯一差异是 dock 首按钮「编辑名片」vs「打电话」。
       本页不再画任何名片内容（封面/联系方式/二维码/简介），否则就是两套样式（2026-11-25 用户定稿）。
       顶部 header 属于工作台 chrome（与统计/名片夹等页同款），不属于名片模板，公开页没有是正常的。 -->
  <div :class="{ 'dash-collapsed': topCollapsed }" :style="card ? { paddingTop: 'calc(50px + var(--safe-top))' } : null">
    <header v-if="card" class="dash-top">
      <span class="dash-brand">M<em>Card</em></span>
      <span class="dash-sub">我的名片</span>
      <span class="spacer"></span>
      <button class="dash-icon" aria-label="分享名片" @click="doShare">↗</button>
      <button class="dash-icon" aria-label="查看二维码" @click="router.push(`/c/${card.slug}?save=1`)"><AppIcon name="qrcode" :size="19" /></button>
      <!-- 与其它页面一致：纯图标（无「菜单」文字），图标用 global.css 的 .menu-glyph 三横线，抽屉打开时旋转 -->
      <button class="nav-menu-btn dash-menu-btn" aria-label="菜单" @click="toggleDrawer"><i class="menu-glyph"></i></button>
    </header>

    <div v-if="loading" class="dash-loading"><div class="card card-pad">加载中…</div></div>
    <div v-else-if="loadError" class="dash-loading">
      <div class="card card-pad center" style="padding:44px 20px">
        <div style="font-size:40px;opacity:.3">⚠️</div>
        <h2 style="margin:10px 0">数据加载失败</h2>
        <p class="muted small">{{ loadError }}</p>
        <button class="btn btn-primary" style="margin-top:16px" :disabled="loading" @click="load">重新加载</button>
      </div>
    </div>
    <div v-else-if="!card" class="dash-loading">
      <div class="card card-pad center" style="padding:44px 20px">
        <div style="font-size:46px;opacity:.25">▤</div>
        <h2 style="margin:10px 0">还没有名片</h2>
        <p class="muted small">创建后即可获得永久二维码，之后换资料不用换码。</p>
        <!-- 短码由系统随机生成（后端 makeSlug），无需用户输入；创建后可在「编辑名片」里自定义 -->
        <div style="max-width:320px;margin:20px auto 0">
          <button class="btn btn-primary btn-block" :disabled="busy" @click="createCard">
            {{ busy ? '创建中…' : '立即创建我的名片' }}
          </button>
          <p class="muted small" style="margin-top:10px">短码将自动生成，之后可在编辑名片里修改</p>
        </div>
      </div>
    </div>
    <CardView v-else owner :embed-slug="card.slug" />
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api'
import { showToast, toggleDrawer } from '../store'
import { isWeChat } from '../utils/save-image'
import { shareOrCopy } from '../utils/share'
import { setCardShare } from '../utils/wx-share'
import CardView from './CardView.vue'
import AppIcon from '../components/AppIcon.vue'

const router = useRouter()

const card = ref(null)
const loading = ref(true)
const busy = ref(false)
const loadError = ref('')
let loadStarted = false

// 顶栏随滚动方向收起/出现：往下推（页面向下滚）收起，往上拉（页面向上滚）出现，停在顶部必现。
// 用 rAF 节流 + 6px 阈值，避免轻微抖动反复切换；独立标志不与业务状态耦合。
const topCollapsed = ref(false)
let lastScrollY = 0
let scrollRaf = 0
function onScroll() {
  if (scrollRaf) return
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0
    const y = window.scrollY || document.documentElement.scrollTop || 0
    const delta = y - lastScrollY
    if (y <= 8) topCollapsed.value = false
    else if (delta > 6) topCollapsed.value = true   // 向下滚 → 收起
    else if (delta < -6) topCollapsed.value = false // 向上滚 → 出现
    lastScrollY = y
  })
}
onMounted(() => { lastScrollY = window.scrollY || 0; window.addEventListener('scroll', onScroll, { passive: true }) })
onBeforeUnmount(() => { window.removeEventListener('scroll', onScroll); if (scrollRaf) cancelAnimationFrame(scrollRaf) })

async function load() {
  if (loadStarted && loading.value) return
  loadStarted = true
  loading.value = true
  loadError.value = ''
  try {
    const { data } = await api.get('/api/cards/mine')
    const c = data?.data
    if (!c || typeof c !== 'object') {
      card.value = null
      return
    }
    card.value = c
    // 工作台自己配微信转发卡片：嵌入的 CardView 是异步组件且要再拉一次公开接口，
    // 只靠它配置会在加载慢时被路由 900ms 兜底抢先（转发成「MCard 电子名片」+灰块）。
    setCardShare(api, c, c.url || '')
  } catch (e) { loadError.value = e.message || '网络异常' } finally { loading.value = false }
}
onMounted(load)

async function createCard() {
  if (busy.value) return
  busy.value = true
  try {
    const { data } = await api.post('/api/cards/mine', {})
    card.value = data.data
    showToast('名片已创建，开始完善资料吧', 'success')
  } catch (e) { showToast(e.message, 'error') } finally { busy.value = false }
}

async function doShare() {
  // 优先用服务端下发的公开 URL（动态域名、干净无 query），绝不带地址栏上的内部参数
  const url = card.value?.url || (card.value?.slug ? `${location.origin}/c/${card.value.slug}` : location.origin)
  if (isWeChat()) return showToast('点右上角「···」→ 发送给朋友 / 分享到朋友圈', 'error')
  const r = await shareOrCopy({ title: '我的电子名片', text: '扫一扫保存我的名片', url })
  if (r === 'copied') showToast('链接已复制，快分享给朋友', 'success')
  else if (r === 'failed') showToast('复制失败，请手动复制地址栏链接', 'error')
}
</script>

<style scoped>
/* 工作台头部：中性品牌蓝，不随名片模板变化（它是工作台 chrome，不属于名片本身） */
/* 沉浸式顶到物理屏幕最上：状态栏区域也绘制品牌蓝，左右统一 16px。
   fixed + 滚动方向收起：往下推收起、往上拉出现；根 div 的 padding-top 补偿 fixed 脱离的文档流。 */
.dash-top { position: fixed; top: 0; left: 0; right: 0; z-index: 50; height: calc(50px + var(--safe-top)); display: flex; align-items: center; gap: 8px; padding: var(--safe-top) 16px 0; background: linear-gradient(90deg,#143b8f,#2563eb 60%,#06b6d4); color: #fff; transition: transform .26s ease; }
.dash-collapsed .dash-top { transform: translateY(-105%); }
.dash-brand { font-weight: 800; font-size: 18px; }
.dash-brand em { font-style: normal; opacity: .75; }
.dash-sub { font-size: 12px; opacity: .8; }
.dash-top .spacer { flex: 1; }
.dash-icon { width: 34px; height: 34px; border-radius: 50%; background: rgba(255,255,255,.16); color: #fff; font-size: 17px; display: grid; place-items: center; }
/* 与其它页面同款三横线图标（global.css 的 .menu-glyph）；深蓝头上只覆写颜色，不重画图标，
   否则局部 border 画法会盖掉全局 background 画法，变成「=」且抽屉打开不旋转（2026-11-25 实锤）。 */
.dash-menu-btn { background: rgba(255,255,255,.18); color: #fff; }
.dash-menu-btn:active { background: rgba(255,255,255,.28); }
.dash-loading { padding-top: 20px; }
</style>
