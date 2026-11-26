<template>
  <view class="page">
    <view class="hint">套餐按<b>时段</b>计费，支付后立即开通；续期时长叠加，不会浪费。</view>
    <view class="body">
      <view v-for="p in packages" :key="p.id" class="plan">
        <view v-if="p.sort === 3" class="hot">推荐</view>
        <view class="name">{{ p.name }}</view>
        <view class="muted small">{{ p.description }}</view>
        <view class="price"><text class="sym">¥</text>{{ (p.price_cents / 100).toFixed(p.price_cents % 100 ? 2 : 0) }}<text class="unit"> / {{ p.duration_days }} 天</text></view>
        <view class="feat"><text v-for="f in p.features" :key="f">✓ {{ f }}</text></view>
        <button class="btn primary block" :disabled="busy === p.id" @tap="buy(p)">{{ busy === p.id ? '下单中…' : '立即开通' }}</button>
      </view>
      <view class="muted small center" style="margin:24rpx 0">资金直达商户号，本系统不经手、不沉淀资金。</view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { api, toast } from '../../utils/request'

const packages = ref([]); const busy = ref(0)
onLoad(async () => {
  try { packages.value = await api.get('/api/packages', false) } catch (e) { toast(e.message) }
})

// 小程序支付场景：微信取 code 换 openid（服务端换，前端只传 code），支付宝用 trade.create
function mpEnv() {
  // #ifdef MP-WEIXIN
  return { method: 'wechat', scene: 'miniapp', platform: 'wechat' }
  // #endif
  // #ifdef MP-ALIPAY
  return { method: 'alipay', scene: 'alipay-mini', platform: 'alipay' }
  // #endif
  // #ifndef MP-WEIXIN || MP-ALIPAY
  return { method: 'mock', scene: 'h5', platform: 'other' }
  // #endif
}

function loginCode() {
  return new Promise(resolve => {
    // #ifdef MP-WEIXIN
    uni.login({ provider: 'weixin', success: r => resolve(r.code || ''), fail: () => resolve('') })
    // #endif
    // #ifndef MP-WEIXIN
    resolve('')
    // #endif
  })
}

async function buy(p) {
  if (busy.value) return
  busy.value = p.id
  try {
    const env = mpEnv()
    const code = env.platform === 'wechat' ? await loginCode() : ''
    if (env.platform === 'wechat' && !code) throw new Error('微信登录失败，请重试')
    const data = await api.post('/api/orders', { package_id: p.id, ...env, code })
    const pay = data.pay || {}
    uni.navigateTo({
      url: `/pages/pay/pay?id=${data.order.id}&pay=${encodeURIComponent(pay.payText || '')}&payType=${encodeURIComponent(pay.payType || pay.mode || '')}&payParams=${encodeURIComponent(pay.payParams ? JSON.stringify(pay.payParams) : '')}`
    })
  } catch (e) { toast(e.message) } finally { busy.value = 0 }
}
</script>

<style scoped>
.hint { background: #fffbeb; color: #92400e; font-size: 24rpx; padding: 20rpx 24rpx; line-height: 1.6; }
.body { padding: 24rpx; }
.plan { background: #fff; border-radius: 24rpx; padding: 28rpx; margin-bottom: 18rpx; position: relative; box-shadow: 0 8rpx 28rpx rgba(15,23,42,.05); }
.plan:nth-child(3) { border: 2rpx solid #2563eb; }
.hot { position: absolute; right: 24rpx; top: 24rpx; background: #2563eb; color: #fff; font-size: 20rpx; padding: 4rpx 14rpx; border-radius: 999rpx; }
.name { font-size: 32rpx; font-weight: 800; }
.price { font-size: 52rpx; font-weight: 800; margin: 16rpx 0 10rpx; letter-spacing: -2rpx; }
.sym { font-size: 28rpx; }
.unit { font-size: 24rpx; color: #6b7688; font-weight: 400; letter-spacing: 0; }
.feat { display: flex; flex-wrap: wrap; gap: 10rpx; margin-bottom: 22rpx; }
.feat text { font-size: 22rpx; color: #64748b; background: #f1f5f9; padding: 6rpx 12rpx; border-radius: 8rpx; }
.btn { font-size: 28rpx; padding: 18rpx 0; border-radius: 14rpx; }
.btn::after { border: 0; }
.btn.primary { background: #2563eb; color: #fff; }
.btn.block { width: 100%; }
.muted { color: #6b7688; }
.small { font-size: 22rpx; }
.center { text-align: center; }
</style>
