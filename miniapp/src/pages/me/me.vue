<template>
  <view class="page">
    <view v-if="!logged" class="state">
      <view class="big">▤</view>
      <view>登录后管理你的名片</view>
      <button class="btn primary block" style="margin-top:24rpx" @tap="goLogin">登录 / 注册</button>
    </view>
    <view v-else-if="loading" class="state">加载中…</view>
    <!-- 无名片引导：对齐 H5 Dashboard 的温和卡片体验（有说明、短码明确选填），不是强制表单 -->
    <view v-else-if="!card" class="create-card">
      <view class="create-ico">▤</view>
      <view class="create-title">还没有名片</view>
      <view class="create-desc">创建后即可获得永久二维码，之后换资料不用换码。</view>
      <button class="btn primary block" :disabled="busy" @tap="create">{{ busy ? '创建中…' : '立即创建我的名片' }}</button>
      <view class="create-tip">短码将自动生成，之后可在「编辑名片」里改</view>
    </view>

    <view v-else class="body">
      <view class="card head">
        <view class="row">
          <view>
            <view class="badge" :class="card.active ? 'ok' : 'warn'">{{ card.active ? '已开通' : '未开通 / 已到期' }}</view>
            <view class="name">{{ card.name || '我的名片' }}</view>
            <view class="muted small">/c/{{ card.slug }} · 永久固定</view>
          </view>
          <image class="qr" :src="baseUrl + '/api/cards/public/' + card.slug + '/qr.png?size=180'" mode="aspectFit" />
        </view>
        <view class="expire" v-if="card.expires_at">有效期至 {{ card.expires_at }}</view>
      </view>

      <view class="grid">
        <view class="cell" @tap="go('/pages/card/card?slug=' + card.slug)"><view class="ico">◎</view><view>查看名片</view></view>
        <!-- 明确是「编辑名片」（改 cards 表），与下方「账号资料」（改 users 表）严格分开 -->
        <view class="cell" @tap="go('/pages/edit/edit')"><view class="ico">✎</view><view>编辑名片</view></view>
        <view class="cell" @tap="go('/pages/materials/materials?slug=' + card.slug)"><view class="ico">📚</view><view>相册</view></view>
        <view class="cell" @tap="go('/pages/notifications/notifications')"><view class="ico">🔔</view><view>消息通知<text v-if="unread" class="cdot">{{ unread }}</text></view></view>
        <view class="cell" @tap="go('/pages/batch-scan/batch-scan')"><view class="ico">📷</view><view>展会连扫</view></view>
        <view class="cell" @tap="go('/pages/plans/plans')"><view class="ico">¥</view><view>开通 / 续期</view></view>
        <view class="cell" @tap="go('/pages/print/print')"><view class="ico">▤</view><view>实体版式</view></view>
        <view class="cell" @tap="go('/pages/market/market')"><view class="ico">⌕</view><view>名片集市</view></view>
        <view class="cell" @tap="go('/pages/account/account')"><view class="ico">👤</view><view>账号资料</view></view>
        <!-- 推广中心：仅推广员可见（后台在用户管理开启），普通用户完全不渲染 -->
        <view v-if="isPromoter" class="cell cell-promo" @tap="go('/pages/promo/promo')"><view class="ico">➤</view><view>推广中心</view></view>
      </view>

      <!-- 上架集市：把名片变成 7×24 小时获客入口 -->
      <view class="market-banner" :class="{ listed: card.market_opt_in }" @tap="go('/pages/edit/edit?focus=market')">
        <view class="mb-ico">⌖</view>
        <view class="mb-body">
          <view class="mb-title">{{ card.market_opt_in ? '✅ 已在名片集市上架' : '🚀 上架名片集市 · 获取更多业务流量' }}</view>
          <view class="mb-desc">{{ card.market_opt_in ? '附近及同行业的人可按距离/行业找到你。点此管理上架信息。' : '让附近、业务对口的客户主动找到你，点击名片即可存入通讯录，持续带来咨询与订单。点此立即上架。' }}</view>
        </view>
        <view class="mb-arrow">›</view>
      </view>

      <view class="card stats">
        <view class="section">数据概览</view>
        <view class="stat-row">
          <view><view class="num">{{ stats.views || 0 }}</view><view class="muted small">累计浏览</view></view>
          <view><view class="num">{{ stats.exchanges || 0 }}</view><view class="muted small">交换名片</view></view>
          <view><view class="num">{{ days }}</view><view class="muted small">剩余天数</view></view>
        </view>
      </view>

      <view class="card orders">
        <view class="section">最近订单</view>
        <view v-if="!orders.length" class="muted small">暂无订单</view>
        <view v-for="o in orders" :key="o.id" class="order">
          <view>
            <view class="b">{{ o.packageName }}</view>
            <view class="muted small mono">{{ o.orderNo }}</view>
          </view>
          <view class="right">
            <view class="b">¥{{ (o.amountCents / 100).toFixed(2) }}</view>
            <view class="muted small">{{ o.status === 'paid' ? '已支付' : '待支付' }}</view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api, baseUrl, isLogged, goLogin, toast, getUnreadCount, isPromoterUser } from '../../utils/request'

const logged = ref(false); const loading = ref(true); const card = ref(null); const isPromoter = ref(false)
const stats = ref({}); const orders = ref([]); const busy = ref(false)
const unread = ref(0)
const go = url => uni.navigateTo({ url })
const days = computed(() => card.value?.expires_at
  ? Math.max(0, Math.ceil((new Date(String(card.value.expires_at).replace(' ', 'T') + 'Z').getTime() - Date.now()) / 86400000))
  : 0)

async function load() {
  logged.value = isLogged()
  isPromoter.value = isPromoterUser()
  loading.value = true
  if (!logged.value) { loading.value = false; return }
  try {
    const [c, s, o] = await Promise.all([
      api.get('/api/cards/mine'), api.get('/api/cards/mine/stats'), api.get('/api/orders/mine')
    ])
    card.value = c; stats.value = s; orders.value = o
  } catch (e) { toast(e.message) } finally { loading.value = false }
  getUnreadCount().then(n => { unread.value = n }).catch(() => {})
  // 自愈：后台可能刚变更推广员身份，静默拉权威用户态同步（失败保留本地缓存）
  api.get('/api/auth/me').then(u => {
    if (u && u.id) {
      isPromoter.value = !!u.is_promoter
      uni.setStorageSync('mcard_user', u)
    }
  }).catch(() => {})
}
onShow(load)

async function create() {
  busy.value = true
  try { card.value = await api.post('/api/cards/mine', {}); toast('名片已创建', 'success') }
  catch (e) { toast(e.message) } finally { busy.value = false }
}
</script>

<style scoped>
.state { padding: 140rpx 40rpx; text-align: center; color: #6b7688; }
.state .big { font-size: 90rpx; opacity: .3; }
/* 无名片引导卡：对齐 H5 Dashboard 的温和样式，不做强制表单观感 */
.create-card { margin: 48rpx 24rpx; padding: 44rpx 32rpx; background: #fff; border-radius: 24rpx; text-align: center; box-shadow: 0 8rpx 28rpx rgba(15,23,42,.05); }
.create-ico { font-size: 80rpx; opacity: .25; }
.create-title { font-size: 34rpx; font-weight: 800; color: #162033; margin: 16rpx 0 10rpx; }
.create-desc { font-size: 24rpx; color: #6b7688; line-height: 1.6; margin-bottom: 32rpx; }
.create-tip { font-size: 22rpx; color: #94a3b8; margin-top: 20rpx; }
.body { padding: 24rpx; }
.card { background: #fff; border-radius: 24rpx; padding: 26rpx; margin-bottom: 18rpx; box-shadow: 0 8rpx 28rpx rgba(15,23,42,.05); }
.row { display: flex; justify-content: space-between; align-items: center; }
.name { font-size: 34rpx; font-weight: 800; margin: 12rpx 0 4rpx; }
.qr { width: 130rpx; height: 130rpx; padding: 8rpx; box-sizing: border-box; border: 2rpx solid #e8edf4; border-radius: 14rpx; }
.expire { margin-top: 16rpx; font-size: 22rpx; color: #94a3b8; }
.badge { display: inline-block; font-size: 20rpx; padding: 4rpx 14rpx; border-radius: 999rpx; }
.badge.ok { background: #d1fae5; color: #047857; }
.badge.warn { background: #fef3c7; color: #b45309; }
.grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12rpx; margin-bottom: 18rpx; }
.market-banner { display: flex; align-items: center; gap: 16rpx; padding: 24rpx 22rpx; margin-bottom: 18rpx; border-radius: 22rpx; color: #fff; background: linear-gradient(135deg, #0e7490, #2563eb 62%, #4f46e5); box-shadow: 0 10rpx 28rpx rgba(37,99,235,.22); }
.market-banner.listed { background: linear-gradient(135deg, #0f766e, #115e59); }
.mb-ico { flex: 0 0 56rpx; width: 56rpx; height: 56rpx; border-radius: 16rpx; display: grid; place-items: center; font-size: 30rpx; background: rgba(255,255,255,.18); }
.mb-body { flex: 1; min-width: 0; }
.mb-title { font-size: 28rpx; font-weight: 800; line-height: 1.3; }
.mb-desc { margin-top: 8rpx; font-size: 22rpx; line-height: 1.5; opacity: .92; }
.mb-arrow { font-size: 40rpx; opacity: .85; }
.cell { background: #fff; border-radius: 20rpx; padding: 22rpx 4rpx; text-align: center; font-size: 22rpx; box-shadow: 0 6rpx 20rpx rgba(15,23,42,.04); position: relative; }
.cell-promo .ico { color: #b8860b; }
.cdot { position: absolute; top: 14rpx; right: 20rpx; min-width: 30rpx; height: 30rpx; line-height: 30rpx; padding: 0 6rpx; border-radius: 15rpx; background: #ef4444; color: #fff; font-size: 18rpx; }
.ico { width: 56rpx; height: 56rpx; border-radius: 16rpx; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; font-size: 28rpx; margin: 0 auto 10rpx; }
.section { font-size: 30rpx; font-weight: 700; margin-bottom: 14rpx; }
.stat-row { display: flex; }
.stat-row > view { flex: 1; text-align: center; }
.num { font-size: 36rpx; font-weight: 800; }
.order { display: flex; justify-content: space-between; padding: 16rpx 0; border-bottom: 2rpx solid #f1f5f9; }
.order .b { font-size: 26rpx; font-weight: 600; }
.order .right { text-align: right; }
.mono { font-family: monospace; }
/* 小程序 input 必须显式定高+line-height，否则原生渲染下文字半截被裁（与登录页同款修复） */
.input { width: 100%; height: 84rpx; line-height: 84rpx; box-sizing: border-box; border: 2rpx solid #e8edf4; border-radius: 12rpx; padding: 0 20rpx; font-size: 26rpx; margin-bottom: 20rpx; }
.btn { font-size: 28rpx; padding: 18rpx 0; border-radius: 14rpx; background: #eef2f7; }
.btn::after { border: 0; }
.btn.primary { background: #2563eb; color: #fff; }
.btn.ghost { background: #fff; color: #6b7688; }
.btn.block { width: 100%; }
.muted { color: #6b7688; }
.small { font-size: 22rpx; }
</style>
