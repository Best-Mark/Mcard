<template>
  <view class="page">
    <view class="card" v-for="a in accounts" :key="a.type">
      <view class="head">
        <b>{{ a.label }}</b>
        <text v-if="a.default" class="tag">默认</text>
        <text v-else-if="!a.bound" class="tag off">未绑定</text>
      </view>
      <block v-if="a.bound">
        <view class="acct">{{ a.account }}</view>
        <view class="muted small">{{ a.type === 'wechat' ? '微信授权身份' : '收款人' }}：{{ a.name || '—' }}</view>
        <view class="acts">
          <button v-if="!a.default" class="btn ghost sm" :disabled="busy" @tap="setDefault(a)">设为默认</button>
          <button class="btn ghost sm" :disabled="busy" @tap="edit(a)">编辑</button>
          <button class="btn danger sm" :disabled="busy" @tap="unbind(a)">解绑</button>
        </view>
      </block>
      <button v-else class="btn primary sm" @tap="edit(a)">绑定{{ a.label }}</button>
    </view>
    <view class="muted small tip">提现只能到已绑定账户；微信收款需要微信授权身份，不能手填。</view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api, toast } from '../../utils/request'

const accounts = ref([])
const busy = ref(false)
async function load() {
  try { accounts.value = (await api.get('/api/promo/withdraw-accounts'))?.accounts || [] }
  catch (e) { toast(e.message || '加载失败') }
}
onShow(() => { load() })
function edit(a) { uni.navigateTo({ url: `/pages/promo/withdraw-account-edit?type=${a.type}` }) }
async function setDefault(a) {
  if (busy.value || a.default) return
  busy.value = true
  try {
    accounts.value = (await api.put('/api/promo/withdraw-account', { type: a.type, setDefault: true }))?.accounts || []
    toast('默认账户已更新', 'success')
  } catch (e) { toast(e.message) }
  finally { busy.value = false }
}
async function unbind(a) {
  if (busy.value) return
  const r = await new Promise(resolve => uni.showModal({ title: '解绑收款账户', content: `解绑后「${a.label}」不能用于提现，已提交提现单不受影响。`, success: res => resolve(res.confirm) }))
  if (!r) return
  busy.value = true
  try {
    accounts.value = (await api.delete(`/api/promo/withdraw-account/${a.type}`))?.accounts || []
    toast('已解绑', 'success')
  } catch (e) { toast(e.message) }
  finally { busy.value = false }
}
</script>

<style scoped>
.page { padding: 24rpx; }
.card { background: #fff; border-radius: 24rpx; padding: 26rpx; margin-bottom: 18rpx; box-shadow: 0 8rpx 28rpx rgba(15,23,42,.05); }
.head { display: flex; align-items: center; gap: 12rpx; font-size: 30rpx; }
.tag { padding: 4rpx 12rpx; border-radius: 999rpx; background: #d1fae5; color: #059669; font-size: 20rpx; }
.tag.off { background: #f1f5f9; color: #b09a72; }
.acct { font-size: 34rpx; font-weight: 800; margin-top: 12rpx; }
.acts { display: flex; gap: 12rpx; margin-top: 20rpx; }
.tip { margin: 12rpx 6rpx; line-height: 1.6; }
.btn { font-size: 26rpx; padding: 16rpx 0; border-radius: 14rpx; }
.btn.sm { flex: 1; }
.btn.primary { background: #a62b2b; color: #fff; }
.btn.ghost { background: #f0e7d2; color: #334155; }
.btn.danger { background: #fee2e2; color: #b91c1c; }
.small { font-size: 24rpx; }
.muted { color: #b09a72; }
</style>
