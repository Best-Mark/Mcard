<template>
  <div class="page">
    <header class="topbar">
      <router-link to="/me" class="back" aria-label="返回">‹</router-link>
      <span class="title">支付结果</span>
    </header>
    <div class="container" style="max-width:480px;margin-top:26px">
      <div class="card card-pad center">
        <template v-if="loading">查询中…</template>
        <template v-else-if="order?.status === 'paid'">
          <div class="ok-ico">✓</div>
          <h2>开通成功</h2>
          <p class="muted small">已到账：{{ order.packageName }} · {{ order.amountCents / 100 }} 元</p>
          <p class="muted small">名片有效期已延长，可立即分享二维码。</p>
          <div class="btn-row" style="justify-content:center;margin-top:18px">
            <router-link to="/me" class="btn btn-primary">返回个人中心</router-link>
            <router-link :to="`/c/${slug}`" class="btn btn-ghost">查看名片</router-link>
          </div>
        </template>
        <template v-else-if="order">
          <h2>等待支付</h2>
          <p class="muted small">订单 <span class="mono">{{ order.orderNo }}</span> · ¥{{ order.amountCents / 100 }}</p>

          <!-- PC 扫码：微信 Native 二维码 -->
          <div v-if="isNative" class="pay-qr">
            <img :src="payQr" alt="微信支付二维码" />
            <p class="small muted">请用微信扫码支付</p>
          </div>
          <!-- 微信内 JSAPI：点按钮调起微信收银台 -->
          <button v-else-if="isJsapi" class="btn btn-primary btn-block" style="margin-top:18px" :disabled="busy" @click="launchJsapi">
            {{ busy ? '正在拉起支付…' : '微信支付' }}
          </button>
          <!-- 支付宝 / 微信 H5：跳到三方收银台 -->
          <button v-else-if="isRedirect" class="btn btn-primary btn-block" style="margin-top:18px" :disabled="busy" @click="goGateway">
            {{ busy ? '正在跳转…' : (payType === 'alipay_page' || payType === 'alipay_wap' ? '前往支付宝付款' : '前往微信支付') }}
          </button>
          <!-- mock 演示 -->
          <button v-else class="btn btn-primary btn-block" style="margin-top:18px" :disabled="busy" @click="mockPay">
            {{ busy ? '处理中…' : '模拟支付完成（演示）' }}
          </button>

          <!-- 支付方式切换（多通道时）：重付走 /:id/pay，换 _X 新单号 -->
          <div v-if="methodOptions.length > 1" class="pay-switch">
            <span class="small muted">切换支付方式：</span>
            <button v-for="m in methodOptions" :key="m.method" class="btn btn-sm"
              :class="m.method === currentMethod ? 'btn-primary' : 'btn-ghost'"
              :disabled="busy" @click="switchMethod(m.method)">{{ m.label }}</button>
          </div>

          <button class="btn btn-ghost btn-block" style="margin-top:8px" :disabled="busy" @click="refresh">我已支付，刷新状态</button>
          <p class="small muted" style="margin-top:14px">支付完成后系统自动开通；若长时间未到账，请点击刷新状态。</p>
        </template>
        <template v-else>
          <b>订单加载失败</b><p class="small muted">{{ error }}</p>
          <button class="btn btn-primary" style="margin-top:12px" :disabled="loading" @click="load">重试</button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import QRCode from 'qrcode'
import api from '../api'
import { showToast } from '../store'
import { payPreference, payMethodOptions } from '../utils/pay-env'
import { wxPay } from '../utils/wx-sdk'

const route = useRoute()
const router = useRouter()
const order = ref(null); const loading = ref(true); const busy = ref(false); const error = ref('')
let loadStarted = false
let pollTimer = null
const payText = computed(() => {
  const v = route.query.pay
  return Array.isArray(v) ? (v[0] || '') : String(v || '')
})
const payType = ref(String(route.query.payType || ''))
const payParams = ref(null)
try { payParams.value = route.query.payParams ? JSON.parse(String(route.query.payParams)) : null } catch { payParams.value = null }
const payQr = ref('')
const slug = ref('')
const channels = ref(['wechat'])
const methodOptions = computed(() => payMethodOptions(channels.value))
const currentMethod = computed(() => String(order.value?.paymentMethod || '').toLowerCase())
const isNative = computed(() => payType.value === 'wechat_native' || payText.value.startsWith('weixin://'))
const isJsapi = computed(() => payType.value === 'wechat_jsapi' || payType.value === 'wechat_miniapp')
const isRedirect = computed(() => ['wechat_h5', 'alipay_page', 'alipay_wap'].includes(payType.value) || /^https?:\/\//.test(payText.value))

async function load() {
  if (loadStarted && loading.value) return
  loadStarted = true
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.get(`/api/orders/${route.params.id}`)
    order.value = data.data
    const c = await api.get('/api/cards/mine')
    slug.value = c.data.data?.slug || ''
    if (!payType.value && order.value?.paymentMethod) {
      payType.value = order.value.paymentMethod === 'alipay' ? 'alipay_page' : 'wechat_native'
    }
    if (isNative.value && payText.value) payQr.value = await QRCode.toDataURL(payText.value, { width: 320, margin: 2 })
    try { channels.value = (await api.get('/api/orders/pay-methods')).data.data?.channels || ['wechat'] } catch { /* 兜底单通道 */ }
  } catch (e) { error.value = e.message } finally { loading.value = false }
}
onMounted(() => { load(); startPoll() })
onBeforeUnmount(() => { if (pollTimer) clearInterval(pollTimer) })

// 自动轮询：三方支付完成后用户可能不点「刷新」，每 4 秒静默查一次，成功即停（对齐 MShop 补单思路）
function startPoll() {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = setInterval(async () => {
    if (order.value?.status === 'paid' || busy.value || document.hidden) return
    try {
      const { data } = await api.post(`/api/orders/${route.params.id}/refresh`)
      if (data.data?.paid) { showToast('支付确认成功', 'success'); await load() }
    } catch { /* 轮询失败静默，不打扰用户 */ }
  }, 4000)
}

async function mockPay() {
  if (busy.value) return
  busy.value = true
  try { await api.post(`/api/orders/${route.params.id}/mock-pay`); showToast('支付成功，名片已开通', 'success'); await load() }
  catch (e) { showToast(e.message, 'error') } finally { busy.value = false }
}
async function refresh() {
  if (busy.value) return
  busy.value = true
  try {
    const { data } = await api.post(`/api/orders/${route.params.id}/refresh`)
    if (data.data.paid) showToast('支付确认成功', 'success')
    else showToast('尚未查询到支付结果，请稍后再试')
    await load()
  } catch (e) { showToast(e.message, 'error') } finally { busy.value = false }
}
async function switchMethod(method) {
  if (busy.value || method === currentMethod.value) return
  busy.value = true
  try {
    const pref = payPreference()
    const { data } = await api.post(`/api/orders/${route.params.id}/pay`, { method, ...pref })
    const pay = data.data.pay || {}
    payType.value = pay.payType || pay.mode || ''
    payParams.value = pay.payParams || null
    router.replace({ query: { pay: pay.payText || '', payType: payType.value, payParams: pay.payParams ? JSON.stringify(pay.payParams) : '' } })
    await load()
    showToast('支付方式已切换，请重新付款', 'success')
  } catch (e) { showToast(e.message, 'error') } finally { busy.value = false }
}
function goGateway() {
  if (busy.value) return
  const url = payText.value
  if (!/^https?:\/\//.test(url)) return showToast('支付链接无效，请刷新状态或切换支付方式', 'error')
  busy.value = true
  window.location.href = url
}
async function launchJsapi() {
  if (busy.value) return
  if (!payParams.value?.paySign) return showToast('支付参数已失效，请切换支付方式后重试', 'error')
  busy.value = true
  try {
    await wxPay(payParams.value)
    showToast('已拉起微信支付', 'success')
  } catch (e) { showToast(e.message || '拉起支付失败', 'error') } finally { busy.value = false }
}
</script>

<style scoped>
.ok-ico { width: 62px; height: 62px; border-radius: 50%; background: #d1fae5; color: #059669; display: grid; place-items: center; font-size: 32px; margin: 8px auto 14px; }
.pay-qr img { width: 210px; height: 210px; margin: 12px auto; border: 1px solid var(--line); padding: 8px; border-radius: 12px; }
.pay-switch { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; justify-content: center; margin-top: 16px; }
.mono { font-family: monospace; }
</style>
