<template>
  <view class="page">
    <view class="card">
      <block v-if="type === 'wechat'">
        <b>微信收款账户</b>
        <view v-if="wxReady" class="muted small">微信授权身份已就绪，保存后即可用于提现。打款在后台审核后进行。</view>
        <view v-else class="muted small">当前账号还没有微信授权 openid，微信收款不能手填账号。请先在微信 H5 内完成一次微信授权登录，再回来保存。</view>
        <button class="btn primary block" :disabled="busy || !wxReady" @tap="saveWechat">{{ busy ? '保存中…' : '保存为微信收款账户' }}</button>
      </block>
      <block v-else>
        <b>绑定{{ type === 'alipay' ? '支付宝' : '银行卡' }}</b>
        <view class="muted small">请填写本人实名信息，后台审核通过后才会打款。</view>
        <view class="field"><text class="label">收款账号</text><input v-model.trim="account" class="input" :placeholder="type === 'alipay' ? '支付宝账号（手机号/邮箱）' : '银行卡号'" /></view>
        <view class="field"><text class="label">收款人姓名</text><input v-model.trim="name" class="input" placeholder="须与实名一致" /></view>
        <view v-if="type === 'bank'" class="field"><text class="label">开户银行</text><input v-model.trim="bank" class="input" placeholder="如：招商银行" /></view>
        <button class="btn primary block" :disabled="busy || !account || !name" @tap="saveForm">{{ busy ? '保存中…' : '保存' }}</button>
      </block>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { api, toast } from '../../utils/request'

const type = ref('wechat')
const wxReady = ref(false)
const account = ref('')
const name = ref('')
const bank = ref('')
const busy = ref(false)

onLoad(o => { type.value = ['wechat', 'alipay', 'bank'].includes(o?.type) ? o.type : 'wechat' })
onShow(async () => {
  try {
    const d = await api.get('/api/promo/withdraw-accounts')
    wxReady.value = !!d?.accounts?.find(a => a.type === 'wechat')?.wxReady
    if (type.value !== 'wechat') {
      const mine = d?.accounts?.find(a => a.type === type.value)
      account.value = ''; name.value = mine?.name || ''; bank.value = ''
    }
  } catch (e) { toast(e.message || '加载失败') }
})
function back() { uni.navigateBack({ fail: () => uni.redirectTo({ url: '/pages/promo/withdraw-account' }) }) }
async function saveWechat() {
  if (busy.value || !wxReady.value) return
  busy.value = true
  try { await api.put('/api/promo/withdraw-account', { type: 'wechat' }); toast('微信收款账户已绑定', 'success'); back() }
  catch (e) { toast(e.message) }
  finally { busy.value = false }
}
async function saveForm() {
  if (busy.value || !account.value || !name.value) return
  busy.value = true
  try {
    await api.put('/api/promo/withdraw-account', { type: type.value, account: account.value, name: name.value, bank: bank.value })
    toast('收款账户已保存', 'success'); back()
  } catch (e) { toast(e.message) }
  finally { busy.value = false }
}
</script>

<style scoped>
.page { padding: 24rpx; }
.card { background: #fff; border-radius: 24rpx; padding: 28rpx; box-shadow: 0 8rpx 28rpx rgba(15,23,42,.05); }
.card b { font-size: 32rpx; }
.field { margin-top: 24rpx; }
.label { display: block; font-size: 24rpx; color: #6b7688; margin-bottom: 10rpx; font-weight: 600; }
.input { width: 100%; box-sizing: border-box; border: 2rpx solid #e8edf4; border-radius: 14rpx; padding: 18rpx 20rpx; font-size: 28rpx; }
.btn { font-size: 28rpx; padding: 20rpx 0; border-radius: 14rpx; margin-top: 28rpx; }
.btn.primary { background: #2563eb; color: #fff; }
.btn.block { width: 100%; }
.small { font-size: 24rpx; }
.muted { color: #94a3b8; }
</style>
