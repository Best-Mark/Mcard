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
        <view v-if="isNative" class="pay-qr">
          <image :src="qrSrc" mode="aspectFit" />
          <view class="muted small">微信扫码支付</view>
        </view>
        <button v-else-if="isJsapi" class="btn primary block" style="margin-top:28rpx" :disabled="busy" @tap="launchPay">{{ busy ? '正在拉起…' : '微信支付' }}</button>
        <button v-else-if="isAliMini" class="btn primary block" style="margin-top:28rpx" :disabled="busy" @tap="launchPay">{{ busy ? '正在拉起…' : '支付宝付款' }}</button>
        <button v-else class="btn primary block" style="margin-top:28rpx" :disabled="busy" @tap="mockPay">{{ busy ? '处理中…' : '模拟支付完成（演示）' }}</button>
        <button class="btn ghost block" style="margin-top:16rpx" :disabled="busy" @tap="refresh">我已支付，刷新状态</button>
      </view>
      <view v-else class="card center">订单加载失败：{{ error }}</view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { api, baseUrl, toast } from '../../utils/request'

const id = ref(''); const payText = ref(''); const payType = ref(''); const payParams = ref(null); const order = ref(null)
const loading = ref(true); const busy = ref(false); const error = ref('')
let pollTimer = null

const isNative = computed(() => payType.value === 'wechat_native' || payText.value.startsWith('weixin://'))
const isJsapi = computed(() => payType.value === 'wechat_miniapp' || payType.value === 'wechat_jsapi')
const isAliMini = computed(() => payType.value === 'alipay_miniapp')
const qrSrc = computed(() => `${baseUrl}/api/cards/public/qr.png?text=${encodeURIComponent(payText.value)}&size=440`)

async function load() {
  loading.value = true
  try { order.value = await api.get(`/api/orders/${id.value}`) }
  catch (e) { error.value = e.message } finally { loading.value = false }
}
onLoad(options => {
  id.value = options.id
  payText.value = decodeURIComponent(options.pay || '')
  payType.value = decodeURIComponent(options.payType || '')
  try { payParams.value = options.payParams ? JSON.parse(decodeURIComponent(options.payParams)) : null } catch { payParams.value = null }
  load()
  pollTimer = setInterval(async () => {
    if (order.value?.status === 'paid' || busy.value) return
    try { const r = await api.post(`/api/orders/${id.value}/refresh`); if (r.paid) { toast('支付确认成功', 'success'); await load() } } catch { /* 静默 */ }
  }, 4000)
})
onUnload(() => { if (pollTimer) clearInterval(pollTimer) })

// 小程序统一拉起：微信 requestPayment / 支付宝 tradePay（对齐 MShop 的 launchMpPayment 口径）
function launchPay() {
  if (busy.value) return
  busy.value = true
  const p = payParams.value || {}
  const done = (ok, msg) => {
    busy.value = false
    if (ok) { toast('支付已拉起，请完成付款', 'success'); setTimeout(load, 1500) }
    else if (msg && !/cancel/i.test(msg)) toast(msg)
  }
  try {
    if (isJsapi.value) {
      // #ifdef MP-WEIXIN
      uni.requestPayment({
        provider: 'wxpay', timeStamp: p.timeStamp, nonceStr: p.nonceStr,
        package: p.package, signType: p.signType || 'RSA', paySign: p.paySign,
        success: () => done(true), fail: e => done(false, e.errMsg)
      })
      // #endif
      // #ifndef MP-WEIXIN
      done(false, '请在微信客户端完成支付')
      // #endif
    } else if (isAliMini.value) {
      // #ifdef MP-ALIPAY
      my.tradePay({ tradeNO: payText.value, success: r => done(r.resultCode === '9000', r.resultMsg), fail: e => done(false, e.errorMessage) })
      // #endif
      // #ifndef MP-ALIPAY
      done(false, '请在支付宝客户端完成支付')
      // #endif
    } else done(false, '当前支付方式无需拉起')
  } catch (e) { done(false, e.message) }
}

async function mockPay() {
  if (busy.value) return
  busy.value = true
  try { await api.post(`/api/orders/${id.value}/mock-pay`); toast('支付成功，名片已开通', 'success'); await load() }
  catch (e) { toast(e.message) } finally { busy.value = false }
}
async function refresh() {
  if (busy.value) return
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
.pay-qr image { width: 360rpx; height: 360rpx; margin: 24rpx auto; border: 2rpx solid #e8dcc2; border-radius: 16rpx; }
.btn { font-size: 28rpx; padding: 20rpx 0; border-radius: 14rpx; background: #f0e7d2; }
.btn::after { border: 0; }
.btn.primary { background: #a62b2b; color: #fff; }
.btn.ghost { background: #fff; color: #8a7355; border: 2rpx solid #e8dcc2; }
.btn.block { width: 100%; }
.mono { font-family: monospace; word-break: break-all; }
.muted { color: #8a7355; }
.small { font-size: 22rpx; }
</style>
