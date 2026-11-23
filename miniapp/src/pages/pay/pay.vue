<template>
  <view class="page">
    <view class="body">
      <view v-if="loading" class="card center">查询中…</view>
      <view v-else-if="order && order.status === 'paid'" class="card center">
        <view class="ok">✓</view>
        <view class="title">开通成功</view>
        <view class="muted small">{{ order.packageName }} · ¥{{ (order.amountCents / 100).toFixed(2) }}</view>
        <view class="muted small">名片有效期已延长，可立即分享二维码</view>
        <button class="btn primary block" style="margin-top:28rpx" @tap="goMe">返回我的名片</button>
      </view>
      <view v-else-if="order" class="card center">
        <view class="title">等待支付</view>
        <view class="muted small mono">订单 {{ order.orderNo }} · ¥{{ (order.amountCents / 100).toFixed(2) }}</view>
        <view v-if="isWechatPay" class="pay-qr">
          <image :src="qrSrc" mode="aspectFit" />
          <view class="muted small">微信扫码支付</view>
        </view>
        <button v-else class="btn primary block" style="margin-top:28rpx" :disabled="busy" @tap="mockPay">{{ busy ? '处理中…' : '模拟支付完成（演示）' }}</button>
        <button class="btn ghost block" style="margin-top:16rpx" :disabled="busy" @tap="refresh">我已支付，刷新状态</button>
      </view>
      <view v-else class="card center">订单加载失败：{{ error }}</view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { api, baseUrl, toast } from '../../utils/request'

const id = ref(''); const payText = ref(''); const order = ref(null)
const loading = ref(true); const busy = ref(false); const error = ref('')
const isWechatPay = computed(() => payText.value.startsWith('weixin://'))
const qrSrc = computed(() => `${baseUrl}/api/cards/public/qr.png?text=${encodeURIComponent(payText.value)}&size=440`)

async function load() {
  loading.value = true
  try { order.value = await api.get(`/api/orders/${id.value}`) }
  catch (e) { error.value = e.message } finally { loading.value = false }
}
onLoad(options => { id.value = options.id; payText.value = decodeURIComponent(options.pay || ''); load() })

async function mockPay() {
  busy.value = true
  try { await api.post(`/api/orders/${id.value}/mock-pay`); toast('支付成功，名片已开通', 'success'); await load() }
  catch (e) { toast(e.message) } finally { busy.value = false }
}
async function refresh() {
  busy.value = true
  try {
    const r = await api.post(`/api/orders/${id.value}/refresh`)
    toast(r.paid ? '支付确认成功' : '尚未查询到支付结果')
    await load()
  } catch (e) { toast(e.message) } finally { busy.value = false }
}
function goMe() { uni.reLaunch({ url: '/pages/me/me' }) }
</script>

<style scoped>
.body { padding: 40rpx 24rpx; }
.card { background: #fff; border-radius: 24rpx; padding: 44rpx 26rpx; box-shadow: 0 8rpx 28rpx rgba(15,23,42,.05); }
.center { text-align: center; }
.ok { width: 110rpx; height: 110rpx; border-radius: 50%; background: #d1fae5; color: #059669; display: flex; align-items: center; justify-content: center; font-size: 56rpx; margin: 0 auto 22rpx; }
.title { font-size: 34rpx; font-weight: 800; margin-bottom: 12rpx; }
.pay-qr image { width: 360rpx; height: 360rpx; margin: 24rpx auto; border: 2rpx solid #e8edf4; border-radius: 16rpx; }
.btn { font-size: 28rpx; padding: 20rpx 0; border-radius: 14rpx; background: #eef2f7; }
.btn::after { border: 0; }
.btn.primary { background: #2563eb; color: #fff; }
.btn.ghost { background: #fff; color: #64748b; border: 2rpx solid #e8edf4; }
.btn.block { width: 100%; }
.mono { font-family: monospace; word-break: break-all; }
.muted { color: #6b7688; }
.small { font-size: 22rpx; }
</style>
