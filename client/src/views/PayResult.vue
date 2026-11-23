<template>
  <div class="page">
    <header class="topbar"><router-link to="/me" class="brand">M<em>Card</em></router-link></header>
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
          <div v-if="payText?.startsWith('weixin://')" class="pay-qr">
            <img :src="payQr" alt="微信支付二维码" />
            <p class="small muted">请用微信扫码支付</p>
          </div>
          <button v-else class="btn btn-primary btn-block" style="margin-top:18px" :disabled="busy" @click="mockPay">
            {{ busy ? '处理中…' : '模拟支付完成（演示）' }}
          </button>
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
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import QRCode from 'qrcode'
import api from '../api'
import { showToast } from '../store'

const route = useRoute()
const order = ref(null); const loading = ref(true); const busy = ref(false); const error = ref('')
let loadStarted = false
const payText = computed(() => route.query.pay || '')
const payQr = ref('')
const slug = ref('')

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
    if (payText.value.startsWith('weixin://')) payQr.value = await QRCode.toDataURL(payText.value, { width: 320, margin: 2 })
  } catch (e) { error.value = e.message } finally { loading.value = false }
}
onMounted(load)

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
</script>

<style scoped>
.ok-ico { width: 62px; height: 62px; border-radius: 50%; background: #d1fae5; color: #059669; display: grid; place-items: center; font-size: 32px; margin: 8px auto 14px; }
.pay-qr img { width: 210px; height: 210px; margin: 12px auto; border: 1px solid var(--line); padding: 8px; border-radius: 12px; }
</style>
