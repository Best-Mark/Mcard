<template>
  <view class="page">
    <map
      id="map"
      class="map"
      :longitude="lng"
      :latitude="lat"
      :show-location="false"
      :enable-rotate="false"
      @regionchange="onRegionChange"
    />
    <view class="cross" aria-hidden="true">＋</view>
    <view class="panel">
      <view class="row"><text class="small muted">拖动地图，让十字准星对准你的位置</text></view>
      <view class="row coord"><text class="mono small">{{ lat.toFixed(6) }}, {{ lng.toFixed(6) }}</text></view>
      <view class="btn-row">
        <button class="btn" @tap="cancel">取消</button>
        <button class="btn primary" @tap="confirm">用这里</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'

const lat = ref(39.9042)
const lng = ref(116.4074)
let pending = { lat: lat.value, lng: lng.value }
let mapCtx = null

function onRegionChange(e) {
  if (e.type !== 'end') return
  // 微信/支付宝：拖动结束用 MapContext 取地图中心
  // #ifdef MP-WEIXIN || MP-ALIPAY
  if (!mapCtx) mapCtx = uni.createMapContext('map')
  mapCtx.getCenterLocation({
    success: res => { pending = { lat: res.latitude, lng: res.longitude }; lat.value = res.latitude; lng.value = res.longitude },
    fail: () => {}
  })
  // #endif
  // #ifndef MP-WEIXIN || MP-ALIPAY
  // 抖音等平台 map 上下文能力有限：用 regionchange 携带的中心坐标兜底
  if (e.detail?.centerLocation) {
    pending = { lat: e.detail.centerLocation.latitude, lng: e.detail.centerLocation.longitude }
    lat.value = pending.lat; lng.value = pending.lng
  }
  // #endif
}

function confirm() {
  uni.$emit('map-picked', { lat: pending.lat, lng: pending.lng })
  uni.navigateBack()
}
function cancel() { uni.navigateBack() }

onLoad(options => {
  const la = Number(options.lat), ln = Number(options.lng)
  if (Number.isFinite(la) && Math.abs(la) <= 90) lat.value = la
  if (Number.isFinite(ln) && Math.abs(ln) <= 180) lng.value = ln
  pending = { lat: lat.value, lng: lng.value }
})
onUnmounted(() => { mapCtx = null })
</script>

<style scoped>
.page { position: relative; height: 100vh; width: 100%; }
.map { width: 100%; height: 100%; }
.cross { position: absolute; left: 50%; top: 45%; transform: translate(-50%, -50%); font-size: 60rpx; color: #dc2626; text-shadow: 0 2rpx 6rpx #fff; pointer-events: none; font-weight: 700; }
.panel { position: absolute; left: 0; right: 0; bottom: 0; background: #fff; padding: 24rpx 24rpx calc(24rpx + env(safe-area-inset-bottom)); box-shadow: 0 -8rpx 30rpx rgba(15,23,42,.12); border-radius: 24rpx 24rpx 0 0; }
.row { margin-bottom: 14rpx; }
.coord { font-weight: 600; }
.btn-row { display: flex; gap: 16rpx; margin-top: 8rpx; }
.btn { flex: 1; font-size: 28rpx; padding: 18rpx 0; border-radius: 12rpx; background: #eef2f7; }
.btn::after { border: 0; }
.btn.primary { background: #2563eb; color: #fff; }
.mono { font-family: monospace; }
.small { font-size: 24rpx; }
.muted { color: #6b7688; }
</style>
