<template>
  <view class="page">
    <view v-if="loading" class="state">加载中…</view>
    <view v-else-if="error" class="state">
      <view>推广数据加载失败</view>
      <view class="muted small">{{ error }}</view>
      <button class="btn primary" style="margin-top:24rpx" @tap="load">重新加载</button>
    </view>
    <view v-else class="body">
      <view class="hero">
        <view class="h-label">可提现佣金</view>
        <view class="h-amount">¥{{ ((summary.balanceCents || 0) / 100).toFixed(2) }}</view>
        <view class="h-sub">累计 ¥{{ ((summary.totalEarnedCents || 0) / 100).toFixed(2) }} · 邀请 {{ summary.invitees || 0 }} 人</view>
      </view>

      <view class="card invite">
        <view class="i-title">我的邀请码</view>
        <view class="i-code">{{ summary.inviteCode || '-' }}</view>
        <view class="i-link">{{ summary.inviteUrl || '-' }}</view>
        <view class="i-actions">
          <button class="btn primary sm" :disabled="!summary.inviteUrl" @tap="copy(summary.inviteUrl, '邀请链接')">复制邀请链接</button>
          <button class="btn ghost sm" :disabled="!summary.inviteCode" @tap="copy(summary.inviteCode, '邀请码')">复制邀请码</button>
        </view>
        <view class="muted small i-tip">好友通过链接注册并消费，你即可获得返佣。</view>
      </view>

      <view class="rule muted small">注册奖 ¥{{ ((rules.registerRewardCents || 0) / 100).toFixed(2) }} · 消费返佣 {{ rules.orderRate || 0 }}% · 满 ¥{{ ((rules.withdrawMinCents || 0) / 100).toFixed(2) }} 可提现</view>

      <view class="seg">
        <button v-for="t in tabs" :key="t.k" :class="{ on: tab === t.k }" @tap="switchTab(t.k)">{{ t.label }}</button>
      </view>
      <view class="card list">
        <view v-if="!rows.length" class="muted small empty">暂无记录</view>
        <view v-for="r in rows" :key="r.id" class="item">
          <view class="it-main">
            <view class="b">{{ rowTitle(r) }}</view>
            <view class="muted small">{{ rowSub(r) }}</view>
          </view>
          <view class="it-right">{{ rowRight(r) }}</view>
        </view>
      </view>

      <button class="btn primary block dock" :disabled="busy" @tap="openWithdraw">申请提现</button>
    </view>

    <!-- 提现弹层：原生 picker 选收款方式（小程序统一用 picker，不用 web select） -->
    <view v-if="sheetOpen" class="sheet-mask" @tap="sheetOpen = false"></view>
    <view class="sheet" :class="{ show: sheetOpen }">
      <view class="sh-head"><b>申请提现</b><text @tap="sheetOpen = false">关闭</text></view>
      <view class="sh-body">
        <view class="muted small">可提现 ¥{{ ((summary.balanceCents || 0) / 100).toFixed(2) }}</view>
        <view class="field"><text class="label">提现金额（元）</text><input v-model.trim="amount" class="input" inputmode="decimal" placeholder="如 100.00" /></view>
        <view class="field"><text class="label">收款方式</text>
          <picker :range="channelLabels" :value="channelIdx" @change="onChannelChange">
            <view class="picker">{{ channelLabels[channelIdx] }} ›</view>
          </picker>
        </view>
        <view class="field"><text class="label">收款账号</text><input v-model.trim="account" class="input" placeholder="微信/支付宝账号或银行卡号" /></view>
        <button class="btn primary block" :disabled="busy" @tap="submitWithdraw">{{ busy ? '提交中…' : '提交申请' }}</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api, toast, copyText } from '../../utils/request'

const tabs = [{ k: 'commissions', label: '收益明细' }, { k: 'invitees', label: '邀请的人' }, { k: 'withdrawals', label: '提现记录' }]
const channels = [{ value: 'wechat', label: '微信' }, { value: 'alipay', label: '支付宝' }, { value: 'bank', label: '银行卡' }]
const channelLabels = channels.map(c => c.label)

const loading = ref(true); const error = ref('')
const summary = ref({}); const rules = ref({})
const tab = ref('commissions'); const rows = ref([])

async function load() {
  loading.value = true; error.value = ''
  try {
    const s = await api.get('/api/promo/summary')
    summary.value = s || {}; rules.value = s?.rules || {}
    await loadList()
  } catch (e) { error.value = e.message || '网络异常' }
  finally { loading.value = false }
}
async function loadList() {
  rows.value = (await api.get(`/api/promo/${tab.value}`)) || []
}
function switchTab(k) {
  if (tab.value === k) return
  tab.value = k
  loadList().catch(e => toast(e.message))
}
onShow(() => { load() })

const statusText = s => ({ pending: '审核中', paid: '已打款', rejected: '已驳回' })[s] || s
function rowTitle(r) {
  if (tab.value === 'commissions') return r.type === 'register' ? '注册奖励' : '消费返佣'
  if (tab.value === 'invitees') return r.nickname
  return `¥${(r.amountCents / 100).toFixed(2)} · ${r.channel}`
}
function rowSub(r) {
  if (tab.value === 'commissions') return `${r.invitee} · ${r.createdAt}`
  if (tab.value === 'invitees') return `${r.phone} · ${r.createdAt}`
  return r.createdAt
}
function rowRight(r) {
  if (tab.value === 'commissions') return `+¥${(r.amountCents / 100).toFixed(2)}`
  if (tab.value === 'invitees') return `已付 ${r.paidOrders} 单`
  return statusText(r.status)
}

function copy(v, label) { copyText(v, `${label}已复制`) }

const sheetOpen = ref(false); const amount = ref(''); const account = ref('')
const channelIdx = ref(0); const busy = ref(false)
function openWithdraw() {
  if (busy.value) return
  amount.value = ''; account.value = ''; channelIdx.value = 0
  sheetOpen.value = true
}
function onChannelChange(e) { channelIdx.value = Number(e.detail.value) || 0 }
async function submitWithdraw() {
  if (busy.value) return
  const n = Number(amount.value)
  if (!Number.isFinite(n) || n <= 0) return toast('请输入正确的金额')
  if (!account.value) return toast('请填写收款账号')
  busy.value = true
  try {
    await api.post('/api/promo/withdraw', { amount_cents: Math.round(n * 100), channel: channels[channelIdx.value].value, account: account.value })
    toast('提现申请已提交', 'success')
    sheetOpen.value = false
    await load()
  } catch (e) { toast(e.message) }
  finally { busy.value = false }
}
</script>

<style scoped>
.state { padding: 140rpx 40rpx; text-align: center; color: #6b7688; }
.body { padding: 24rpx; padding-bottom: 140rpx; }
.hero { padding: 36rpx 30rpx; border-radius: 24rpx; color: #fff; background: linear-gradient(122deg,#7c5a12,#b8860b 52%,#d4a72c); box-shadow: 0 10rpx 28rpx rgba(184,134,11,.22); }
.h-label { font-size: 24rpx; opacity: .9; }
.h-amount { font-size: 68rpx; font-weight: 800; margin-top: 6rpx; }
.h-sub { font-size: 24rpx; opacity: .92; margin-top: 8rpx; }
.card { background: #fff; border-radius: 24rpx; padding: 26rpx; margin-top: 18rpx; box-shadow: 0 8rpx 28rpx rgba(15,23,42,.05); }
.i-title { font-size: 24rpx; color: #94a3b8; }
.i-code { font-size: 44rpx; font-weight: 800; letter-spacing: 4rpx; margin-top: 8rpx; }
.i-link { font-size: 22rpx; color: #2563eb; word-break: break-all; margin-top: 10rpx; }
.i-actions { display: flex; gap: 16rpx; margin-top: 20rpx; }
.i-tip { margin-top: 18rpx; line-height: 1.6; }
.rule { margin: 18rpx 6rpx 0; line-height: 1.5; font-size: 22rpx; }
.seg { display: flex; gap: 10rpx; margin-top: 24rpx; }
.seg button { flex: 1; font-size: 24rpx; padding: 14rpx 0; border-radius: 14rpx; background: #eef2f7; color: #6b7688; }
.seg button.on { background: #eff6ff; color: #2563eb; font-weight: 700; }
.list { padding-top: 8rpx; padding-bottom: 8rpx; }
.item { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; padding: 22rpx 0; border-bottom: 2rpx solid #f1f5f9; }
.item:last-child { border-bottom: 0; }
.it-main { min-width: 0; display: flex; flex-direction: column; gap: 6rpx; }
.it-main .b { font-size: 26rpx; }
.it-right { font-weight: 700; color: #b8860b; flex-shrink: 0; font-size: 26rpx; }
.empty { padding: 50rpx 0; text-align: center; }
.dock { position: fixed; left: 24rpx; right: 24rpx; bottom: calc(20rpx + env(safe-area-inset-bottom)); }
.sheet-mask { position: fixed; left: 0; top: 0; right: 0; bottom: 0; z-index: 120; background: rgba(15,23,42,.45); }
.sheet { position: fixed; left: 0; right: 0; bottom: 0; z-index: 121; background: #fff; border-radius: 28rpx 28rpx 0 0; transform: translateY(105%); transition: transform .24s ease; padding-bottom: env(safe-area-inset-bottom); }
.sheet.show { transform: translateY(0); }
.sh-head { display: flex; align-items: center; justify-content: space-between; padding: 28rpx 30rpx; border-bottom: 2rpx solid #f1f5f9; font-size: 30rpx; }
.sh-head text { color: #2563eb; font-size: 26rpx; }
.sh-body { padding: 26rpx 30rpx 40rpx; }
.field { margin-top: 24rpx; }
.label { display: block; font-size: 24rpx; color: #6b7688; margin-bottom: 10rpx; font-weight: 600; }
.input, .picker { width: 100%; box-sizing: border-box; border: 2rpx solid #e8edf4; border-radius: 14rpx; padding: 18rpx 20rpx; font-size: 28rpx; }
.btn { font-size: 28rpx; padding: 20rpx 0; border-radius: 14rpx; }
.btn.sm { flex: 1; font-size: 26rpx; padding: 16rpx 0; }
.btn.primary { background: #2563eb; color: #fff; }
.btn.ghost { background: #eef2f7; color: #334155; }
.btn.block { width: 100%; }
</style>
