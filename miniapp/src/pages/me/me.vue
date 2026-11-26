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

    <!-- 有名片：整页就是名片本身 + owner 编辑 dock -->
    <block v-else>
      <CardBody :card="card" :materials="materials" :is-self="true" :self-check-done="true" />
      <view class="dock">
        <button class="dock-btn" @tap="go('/pages/edit/edit')"><text class="dico">✎</text><text>编辑名片</text></button>
        <button class="dock-btn" @tap="go('/pages/edit/edit?focus=theme')"><text class="dico">◐</text><text>配色风格</text></button>
        <button class="dock-btn" @tap="go('/pages/market/market')"><text class="dico">⌕</text><text>名片集市</text></button>
        <button class="dock-btn" @tap="go('/pages/materials/materials?slug=' + card.slug)"><text class="dico">📚</text><text>相册</text></button>
        <button class="dock-btn primary" open-type="share"><text class="dico">↗</text><text>分享</text></button>
      </view>
    </block>

    <TabBar active="card" />
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow, onShareAppMessage } from '@dcloudio/uni-app'
import { api, baseUrl, isLogged, goLogin, toast, getPublicMaterials, getShareCardImage, withInvite } from '../../utils/request'
import CardBody from '../../components/CardBody/CardBody.vue'
import TabBar from '../../components/TabBar/TabBar.vue'

const logged = ref(false)
const loading = ref(true)
const loadError = ref('')
const card = ref(null)
const materials = ref([])
const busy = ref(false)

const tpl = computed(() => card.value?.template || 'classic')
const glowRgb = computed(() => {
  const h = /^#?([0-9a-f]{6})$/i.exec(String(card.value?.accent || ''))
  if (!h) return '37,99,235'
  const n = parseInt(h[1], 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
})

const go = url => uni.navigateTo({ url })

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
.dock { position: fixed; left: 0; right: 0; bottom: calc(110rpx + env(safe-area-inset-bottom, 0px)); display: grid; grid-template-columns: repeat(3, 1fr); gap: 12rpx 16rpx; padding: 16rpx 24rpx; background: rgba(255,255,255,.96); box-shadow: 0 -4rpx 20rpx rgba(15,23,42,.06); z-index: 50; }
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
