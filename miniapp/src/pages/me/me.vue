<template>
  <!-- 「名片」tab：对齐 H5 Dashboard——没名片只给创建入口；有名片整页就是名片本身（owner 视角）+ 编辑入口。
       名片正文复用共享组件 CardBody（与名片详情页同一套渲染、同 24 套模板样式），绝不复制两套名片样式。
       功能（相册/集市/消息/推广等）已分散到各自 tab 与子页，本页不再堆功能宫格。 -->
  <view class="page" :class="card ? 'tpl-' + tpl : ''" :style="card ? { '--t-accent': card.accent || '#a62b2b', '--glow-rgb': glowRgb } : null">
    <view v-if="!logged" class="state">
      <view class="big">▤</view>
      <view>登录后管理你的名片</view>
      <button class="btn primary block" style="margin-top:24rpx" @tap="goLogin">登录 / 注册</button>
    </view>
    <view v-else-if="loading" class="state">加载中…</view>
    <view v-else-if="loadError" class="state">
      <view class="big">⚠️</view>
      <view>数据加载失败</view>
      <view class="muted small">{{ loadError }}</view>
      <button class="btn primary block" style="margin-top:24rpx" @tap="load">重新加载</button>
    </view>
    <!-- 无名片引导：对齐 H5 Dashboard 的温和卡片体验，不是强制表单 -->
    <view v-else-if="!card" class="create-card">
      <view class="create-ico">▤</view>
      <view class="create-title">还没有名片</view>
      <view class="create-desc">创建后即可获得永久二维码，之后换资料不用换码。</view>
      <button class="btn primary block" :disabled="busy" @tap="create">{{ busy ? '创建中…' : '立即创建我的名片' }}</button>
      <!-- 不强推创建：给「先看看别人怎么做」的出口，避免一进来就只剩创建一条路 -->
      <button class="btn ghost block" style="margin-top:16rpx" @tap="go('/pages/market/market')">先去逛逛名片集市</button>
    </view>

    <!-- 有名片：整页就是名片本身 + owner 编辑 dock（四键与 H5 Dashboard 完全一致；相册管理在「编辑名片」页内的公司相册分节） -->
    <block v-else>
      <CardBody :card="card" :materials="materials" :is-self="true" :self-check-done="true" :top-inset="topInset"
        @edit="go('/pages/edit/edit')" @activate="go('/pages/plans/plans')" @update="onCardPatch" />
      <!-- dock 三态翻转（2026-11-26 用户定稿）：main=编辑/配色/二维码；点「配色」整行翻转成模板缩略行
           （与 H5 配色风格页同款 template-thumbs 缩略，点中即换、上面名片实时变、可连着试）；
           点「二维码」翻转成二维码预设调节行（改的是二维码风格本身，不是弹码展示）；行首 ✕ 收起回 main。
           集市在底部 TabBar，分享走右上角 ⋯ 菜单，不占 dock -->
      <view v-if="dockMode === 'main'" class="dock">
        <button class="dock-btn primary" @tap="go('/pages/edit/edit')"><text class="dico">✎</text><text>编辑</text></button>
        <button class="dock-btn" @tap="toggleDock('tpl')"><text class="dico">▦</text><text>配色</text></button>
        <button class="dock-btn" @tap="toggleDock('qr')"><text class="dico">▣</text><text>二维码</text></button>
      </view>
      <!-- 模板行：左右滑动点中即应用整套配色并保存，页面即实时预览 -->
      <view v-else-if="dockMode === 'tpl'" class="dock dock-flip">
        <button class="dock-back" @tap="dockMode = 'main'">✕</button>
        <scroll-view scroll-x class="dock-scroll" :show-scrollbar="false">
          <view class="dock-flow">
            <button v-for="t in tpls" :key="t.key" :class="['dock-tpl', { on: card.template === t.key, busy: tplBusy }]" @tap="chooseTpl(t)">
              <view class="tpl-thumb" :class="'thumb-' + t.key"><i class="tpl-ava"></i></view>
              <text class="dock-tpl-label">{{ t.label }}</text>
            </button>
          </view>
          <view v-if="!tpls.length" class="dock-tpl-loading">模板清单加载中…</view>
        </scroll-view>
      </view>
      <!-- 二维码调节行：一键风格预设（码点/定位角/渐变组合，与 H5 配色风格页同款 4 个），点中即保存实时生效 -->
      <view v-else class="dock dock-flip">
        <button class="dock-back" @tap="dockMode = 'main'">✕</button>
        <scroll-view scroll-x class="dock-scroll" :show-scrollbar="false">
          <view class="dock-flow">
            <button v-for="p in QR_PRESETS" :key="p.key" :class="['dock-tpl', { on: qrPresetActive(p), busy: qrBusy }]" @tap="applyQrPreset(p)">
              <view class="dock-qr-swatch" :style="{ background: p.swatch }"></view>
              <text class="dock-tpl-label">{{ p.label }}</text>
            </button>
          </view>
        </scroll-view>
      </view>
    </block>

    <TabBar active="card" />
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow, onReady, onShareAppMessage } from '@dcloudio/uni-app'
import { api, baseUrl, isLogged, goLogin, toast, getPublicMaterials, getShareCardImage, withInvite } from '../../utils/request'
import CardBody from '../../components/CardBody/CardBody.vue'
import TabBar from '../../components/TabBar/TabBar.vue'

const logged = ref(false)
const loading = ref(true)
const loadError = ref('')
const card = ref(null)
const materials = ref([])
const busy = ref(false)

// ===== dock 翻转状态机：main（编辑/配色/二维码）→ tpl（模板缩略行）/ qr（二维码预设行），✕ 收起 =====
const dockMode = ref('main')
function toggleDock(m) {
  dockMode.value = dockMode.value === m ? 'main' : m
  if (dockMode.value === 'tpl') loadTpls()
}

// 模板清单（与 H5 CardStyle/CardEdit 同源公开接口，缓存一次）
const tpls = ref([])
const tplBusy = ref(false)
let tplsLoaded = false
function loadTpls() {
  if (tplsLoaded) return
  api.get('/api/cards/public/templates?t=' + Date.now(), false).then(r => {
    if (r?.templates?.length) { tpls.value = r.templates; tplsLoaded = true }
  }).catch(() => { /* 拉取失败静默，行内显示「加载中」可收起再开重试 */ })
}

// 模板 → 整套配色映射：⚠️ 与 edit.vue 的 TEMPLATE_PALETTES / client/src/utils/themes.js 三端同步
const TEMPLATE_PALETTES = {
  tang: { theme: 'tang', qrFg: '#7a1e15', qrBg: '#f7ecd9' },
  vanna: { theme: 'vanna', qrFg: '#0c2a4d', qrBg: '#eaf2f9' },
  phantom: { theme: 'phantom', qrFg: '#052e1c', qrBg: '#e8f5ee' },
  lava: { theme: 'lava', qrFg: '#1a1a1e', qrBg: '#f1f1f2' },
  star: { theme: 'star', qrFg: '#8a8aa0', qrBg: '#12121a' },
  alas: { theme: 'alas', qrFg: '#4a0d14', qrBg: '#f9eaea' },
  classic: { theme: 'ocean', qrFg: '#12306b', qrBg: '#f2f7ff' },
  minimal: { theme: 'ocean', qrFg: '#2b2118', qrBg: '#ffffff' },
  elite: { theme: 'ink', qrFg: '#b99355', qrBg: '#15171c' },
  vivid: { theme: 'royal', qrFg: '#7c3aed', qrBg: '#fff7ed' },
  seal: { theme: 'ocean', qrFg: '#2b2118', qrBg: '#ffffff' },
  contact: { theme: 'ink', qrFg: '#12202e', qrBg: '#ffffff' },
  navygold: { theme: 'ink', qrFg: '#1d3a55', qrBg: '#f7f1e3' },
  paper: { theme: 'ocean', qrFg: '#3f4a5a', qrBg: '#f7f6f3' },
  glass: { theme: 'mint', qrFg: '#0b2e2a', qrBg: '#eaf8f4' },
  wood: { theme: 'sunset', qrFg: '#5b3a1f', qrBg: '#f6eee1' },
  neon: { theme: 'royal', qrFg: '#3d1a72', qrBg: '#f3e9ff' },
  acid: { theme: 'mint', qrFg: '#0a0a0a', qrBg: '#dfff5e' },
  pop: { theme: 'sunset', qrFg: '#1a1a1a', qrBg: '#fff4e8' },
  magazine: { theme: 'sunset', qrFg: '#b91c1c', qrBg: '#f7f3ec' },
  poster: { theme: 'ink', qrFg: '#1d3a55', qrBg: '#ffffff' },
  ticket: { theme: 'ocean', qrFg: '#1f2937', qrBg: '#f7f5ee' },
  horizontal: { theme: 'ocean', qrFg: '#1d3a55', qrBg: '#eef1f4' },
  sidebar: { theme: 'sunset', qrFg: '#44291a', qrBg: '#f7f3ec' }
}
// 主题 accent（chooseTpl 需要连带强调色）
const THEMES = {
  tang: { accent: '#a62b2b' }, ocean: { accent: '#2563eb' }, ink: { accent: '#b99355' },
  sunset: { accent: '#ea580c' }, mint: { accent: '#0f766e' }, royal: { accent: '#7c3aed' },
  vanna: { accent: '#155a96' }, phantom: { accent: '#0f6b3f' }, lava: { accent: '#c2410c' },
  star: { accent: '#8a8aa0' }, alas: { accent: '#a01722' }
}
async function chooseTpl(t) {
  if (tplBusy.value || card.value?.template === t.key) return
  const pal = TEMPLATE_PALETTES[t.key] || { theme: 'ocean', qrFg: '#0f172a', qrBg: '#ffffff' }
  const patch = {
    template: t.key,
    theme: pal.theme,
    accent: (THEMES[pal.theme] || THEMES.ocean).accent,
    qr_fg: pal.qrFg,
    qr_bg: pal.qrBg
  }
  tplBusy.value = true
  try {
    await api.put('/api/cards/mine', patch)
    toast(`已应用「${t.label}」整套配色`, 'success')
    card.value = { ...(card.value || {}), ...patch }
  } catch (e) { toast(e.message) } finally { tplBusy.value = false }
}

// 二维码风格预设（与 H5 配色风格页同款 4 个）：改码点/定位角/渐变组合，点中即保存实时生效；
// 更细的前景色/背景色/背景图等微调在编辑页
const QR_PRESETS = [
  { key: 'classic', label: '经典', swatch: '#0f172a', dot: 'square', eye: 'square', gradTo: '' },
  { key: 'dots', label: '圆点', swatch: '#2563eb', dot: 'dots', eye: 'rounded', gradTo: '' },
  { key: 'tech', label: '科技渐变', swatch: 'linear-gradient(135deg,#2563eb,#06b6d4)', dot: 'rounded', eye: 'rounded', gradTo: '#06b6d4' },
  { key: 'elegant', label: '典雅', swatch: '#b45309', dot: 'rounded', eye: 'circle', gradTo: '' }
]
const qrBusy = ref(false)
function qrPresetActive(p) {
  const s = card.value?.qr_style || {}
  return s.dot === p.dot && s.eye === p.eye && (s.gradTo || '') === p.gradTo
}
async function applyQrPreset(p) {
  if (qrBusy.value) return
  const qr_style = { ...(card.value?.qr_style || {}), dot: p.dot, eye: p.eye, gradTo: p.gradTo }
  qrBusy.value = true
  try {
    await api.put('/api/cards/mine', { qr_style })
    card.value = { ...(card.value || {}), qr_style }
    toast(`二维码风格「${p.label}」已应用`, 'success')
  } catch (e) { toast(e.message) } finally { qrBusy.value = false }
}

const tpl = computed(() => card.value?.template || 'classic')
const glowRgb = computed(() => {
  const h = /^#?([0-9a-f]{6})$/i.exec(String(card.value?.accent || ''))
  if (!h) return '37,99,235'
  const n = parseInt(h[1], 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
})

const go = url => uni.navigateTo({ url })

// 配色循环成功后的补丁合并：CardBody 点封面品牌位切换主题，回传 {theme, accent} 就地更新
function onCardPatch(p) { if (p && typeof p === 'object') card.value = { ...(card.value || {}), ...p } }

// 隐藏微信原生「返回首页」标：reLaunch 切 tab 后页面栈只有一页且非首页，微信会自动在左上角画 ⌂，
// 压在名片封面上很突兀；导航有底部 TabBar 承担，此标无存在必要。onReady 调（避开启动窗口），失败静默（老基础库无此 API）
const topInset = ref(0)
onReady(() => {
  try { uni.hideHomeButton && uni.hideHomeButton({ fail: () => {} }) } catch { /* 老基础库 */ }
  // custom 导航：用右上角胶囊矩形精确定位品牌行（MShop 同款做法，模拟器/真机同一坐标系零误差）；
  // 拿不到胶囊（老基础库）退回状态栏高度
  try {
    const r = uni.getMenuButtonBoundingClientRect()
    topInset.value = r && r.top > 0 ? r.top : (uni.getSystemInfoSync().statusBarHeight || 0)
  } catch {
    try { topInset.value = uni.getSystemInfoSync()?.statusBarHeight || 0 } catch { /* 兜底 0 */ }
  }
})

async function load() {
  logged.value = isLogged()
  loading.value = true
  loadError.value = ''
  if (!logged.value) { loading.value = false; return }
  try {
    const c = await api.get('/api/cards/mine')
    // 兜底：接口返回 null（无名片）或对象（有名片），绝不把异常丢到模板
    card.value = (c && typeof c === 'object') ? c : null
    if (card.value?.slug) {
      // 相册由 CardBody 渲染，这里统一拉取（失败静默，不影响名片主体）
      getPublicMaterials(card.value.slug).then(d => { materials.value = d.list || [] }).catch(() => {})
    }
  } catch (e) {
    loadError.value = e.message || '网络异常'
  } finally { loading.value = false }
}
onShow(load)

async function create() {
  if (busy.value) return
  busy.value = true
  try {
    const c = await api.post('/api/cards/mine', {})
    card.value = c
    toast('名片已创建，开始完善资料吧', 'success')
    // 建完卡就地刷新为名片视图（本页已切到 CardBody），无需跳走
    if (c?.slug) getPublicMaterials(c.slug).then(d => { materials.value = d.list || [] }).catch(() => {})
  }
  catch (e) { toast(e.message) } finally { busy.value = false }
}

// owner 在自己名片页也能分享（转发走「XXX的名片」口径）
onShareAppMessage(() => {
  const c = card.value
  const absolute = u => (!u ? '' : /^https?:\/\//i.test(u) ? u : u.startsWith('/') ? baseUrl + u : '')
  const intro = c?.bio || c?.company_intro || ''
  const imageUrl = [c?.logo, c?.avatar].map(absolute).find(u => /\.(jpe?g|png|gif)(\?|$)/i.test(u)) || getShareCardImage()
  return {
    title: c ? `${c.name}的名片` : '唐笺 电子名片',
    desc: intro,
    path: withInvite(`/pages/card/card?slug=${c?.slug || ''}`),
    imageUrl
  }
})
</script>

<style scoped>
/* 模板缩略样式与 H5 配色风格页同一份（miniapp 副本：src/styles/template-thumbs.css，两端同步维护） */
@import '../../styles/template-thumbs.css';
.page { padding-bottom: 160rpx; }
.state { padding: 140rpx 40rpx; text-align: center; color: #8a7355; }
.state .big { font-size: 90rpx; opacity: .3; }
/* 无名片引导卡：对齐 H5 Dashboard 的温和样式，不做强制表单观感 */
.create-card { margin: 48rpx 24rpx; padding: 44rpx 32rpx; background: #fff; border-radius: 24rpx; text-align: center; box-shadow: 0 8rpx 28rpx rgba(15,23,42,.05); }
.create-ico { font-size: 80rpx; opacity: .25; }
.create-title { font-size: 34rpx; font-weight: 800; color: #2b2118; margin: 16rpx 0 10rpx; }
.create-desc { font-size: 24rpx; color: #8a7355; line-height: 1.6; margin-bottom: 32rpx; }
.btn { font-size: 28rpx; padding: 18rpx 0; border-radius: 14rpx; background: #f0e7d2; }
.btn::after { border: 0; }
.btn.primary { background: #a62b2b; color: #fff; }
.btn.ghost { background: #fff; color: #8a7355; box-shadow: inset 0 0 0 2rpx #e8dcc2; }
.btn.block { width: 100%; }
.btn[disabled] { opacity: .55; }
.muted { color: #8a7355; }
.small { font-size: 22rpx; }

/* owner 编辑 dock（页面级，非名片正文；tpl-X 覆写跟模板走，与 card.vue 同口径） */
/* 三键单行等大：编辑名片 + 模板 + 二维码（2026-11-26 用户定稿）；主键只做填色区分不做尺寸区分 */
.dock { position: fixed; left: 0; right: 0; bottom: calc(110rpx + env(safe-area-inset-bottom, 0px)); display: grid; grid-template-columns: repeat(3, 1fr); gap: 12rpx; padding: 16rpx 24rpx; background: rgba(255,255,255,.96); box-shadow: 0 -4rpx 20rpx rgba(15,23,42,.06); z-index: 50; }
/* 翻转态行：模板缩略 / 二维码预设，横滑点选即换；缩略 thumb 用 px（与 H5 同源样式），选中主色描边 */
.dock-flip { display: flex; align-items: center; gap: 16rpx; --ng-gold: #d8bb85; }
.dock-back { flex: 0 0 72rpx; height: 116rpx; font-size: 30rpx; color: #8a7355; background: #f0e7d2; border-radius: 14rpx; display: flex; align-items: center; justify-content: center; }
.dock-back::after { border: 0; }
.dock-scroll { flex: 1; width: 0; white-space: nowrap; }
.dock-flow { display: inline-flex; gap: 18rpx; padding: 4rpx 8rpx; }
.dock-tpl { display: inline-flex; flex-direction: column; align-items: center; gap: 8rpx; background: transparent; padding: 0; margin: 0; line-height: 1.2; }
.dock-tpl::after { border: 0; }
.dock-tpl.busy { opacity: .5; }
.dock-tpl-label { font-size: 20rpx; color: #8a7355; max-width: 130rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dock-tpl.on .dock-tpl-label { color: #a62b2b; font-weight: 700; }
.dock-tpl.on .tpl-thumb, .dock-tpl.on .dock-qr-swatch { box-shadow: 0 0 0 4rpx #a62b2b; }
.dock-qr-swatch { width: 54px; height: 54px; border-radius: 9px; border: 2rpx solid rgba(15,23,42,.12); box-sizing: border-box; }
.dock-tpl-loading { display: inline-block; font-size: 24rpx; color: #b09a72; padding: 30rpx 20rpx; }
.dock-btn { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4rpx; min-height: 96rpx; padding: 8rpx 0; border-radius: 14rpx; background: #f0e7d2; color: #2b2118; font-size: 22rpx; line-height: 1.2; }
.dock-btn::after { border: 0; }
.dock-btn.primary { background: #a62b2b; color: #fff; }
.dico { font-size: 34rpx; line-height: 1.1; }

/* dock 的模板覆写：跟名片模板走（与 card.vue 一致） */
.tpl-minimal .dock { background: #fff; }
.tpl-elite .dock { background: #0b0d12; box-shadow: none; border-top: 4rpx solid var(--t-accent); }
.tpl-seal .dock { background: #111827; box-shadow: none; }
.tpl-contact .dock { background: #2b2118; box-shadow: none; }
</style>
