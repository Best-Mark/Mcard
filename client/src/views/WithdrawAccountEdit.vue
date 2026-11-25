<template>
  <div class="page">
    <header class="topbar">
      <button class="back-btn" aria-label="返回" @click="router.push('/me/withdraw-account')">‹</button>
      <span class="title">绑定{{ typeLabel }}</span>
      <div class="spacer"></div>
    </header>

    <div v-if="loadError" class="container">
      <div class="card card-pad" style="border-color:#fecaca;background:#fef2f2">
        <b style="color:#b91c1c">无法读取账户状态</b>
        <p class="small muted" style="margin:6px 0 12px">{{ loadError }}</p>
        <button class="btn btn-sm btn-primary" :disabled="loading" @click="load">重新加载</button>
      </div>
    </div>
    <div v-else class="container">
      <div class="card card-pad">
        <div v-if="type === 'wechat'" class="wechat-box">
          <div v-if="wxReady">
            <b>微信身份已授权</b>
            <p class="small muted">提现将在后台审核后打款到当前微信账号，无需手填账号。</p>
            <button class="btn btn-primary btn-block" :disabled="busy" @click="saveWechat">{{ busy ? '保存中…' : '保存为微信收款账户' }}</button>
          </div>
          <div v-else>
            <b>需要微信授权</b>
            <p class="small muted">微信收款只认微信授权身份，不能手填。请在微信内打开本页并完成授权。</p>
            <button class="btn btn-primary btn-block" :disabled="busy" @click="authorizeWechat">微信授权并绑定</button>
          </div>
        </div>
        <div v-else class="form-box">
          <p class="small muted">请填写本人实名的收款信息，后台审核通过后才会打款。</p>
          <label class="field-label">收款账号</label>
          <input v-model.trim="account" class="field" type="text" maxlength="100" :placeholder="type === 'alipay' ? '支付宝账号（手机号/邮箱）' : '银行卡号'" />
          <label class="field-label">收款人姓名</label>
          <input v-model.trim="name" class="field" type="text" maxlength="40" placeholder="须与实名一致" />
          <label v-if="type === 'bank'" class="field-label">开户银行</label>
          <input v-if="type === 'bank'" v-model.trim="bank" class="field" type="text" maxlength="60" placeholder="如：招商银行" />
          <button class="btn btn-primary btn-block" style="margin-top:16px" :disabled="busy || !account || !name" @click="saveForm">{{ busy ? '保存中…' : '保存' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../api'
import { showToast } from '../store'
import { isWeChat } from '../utils/save-image'

const route = useRoute()
const router = useRouter()
const type = ref(['wechat', 'alipay', 'bank'].includes(route.query.type) ? route.query.type : 'wechat')
const typeLabel = computed(() => ({ wechat: '微信', alipay: '支付宝', bank: '银行卡' })[type.value])
const wxReady = ref(false)
const account = ref('')
const name = ref('')
const bank = ref('')
const busy = ref(false)
const loading = ref(true)
const loadError = ref('')

const TYPES = ['wechat', 'alipay', 'bank']

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const { data } = await api.get('/api/promo/withdraw-accounts')
    const list = data.data?.accounts || []
    wxReady.value = !!list.find(a => a.type === 'wechat')?.wxReady
    if (route.query.wx_bound === '1') {
      wxReady.value = true
      showToast('微信身份已绑定，请保存为收款账户', 'success')
    } else if (route.query.wx_bind_err) {
      showToast('微信授权未完成：' + String(route.query.wx_bind_err), 'error')
    }
  } catch (e) { loadError.value = e.message || '网络异常' }
  finally { loading.value = false }
}
onMounted(load)

function done() { router.replace('/me/withdraw-account') }
async function saveWechat() {
  if (busy.value || !wxReady.value) return
  busy.value = true
  try {
    await api.put('/api/promo/withdraw-account', { type: 'wechat' })
    showToast('微信收款账户已绑定', 'success')
    done()
  } catch (e) { showToast(e.message || '绑定失败', 'error') }
  finally { busy.value = false }
}
async function saveForm() {
  if (busy.value || !account.value || !name.value) return
  busy.value = true
  try {
    await api.put('/api/promo/withdraw-account', { type: type.value, account: account.value, name: name.value, bank: bank.value })
    showToast('收款账户已保存', 'success')
    done()
  } catch (e) { showToast(e.message || '保存失败', 'error') }
  finally { busy.value = false }
}
async function authorizeWechat() {
  if (busy.value) return
  if (!isWeChat()) return showToast('请在微信内打开本页完成授权', 'error')
  busy.value = true
  try {
    const { data } = await api.get('/api/auth/wechat-bind/url', { params: { redirect: '/me/withdraw-account-edit?type=wechat' } })
    if (!data.data?.url) throw new Error('授权地址获取失败')
    window.location.href = data.data.url
  } catch (e) { showToast(e.message || '授权失败', 'error'); busy.value = false }
}
</script>

<style scoped>
.wechat-box p, .form-box p { margin: 8px 0 14px; line-height: 1.6; }
.field-label { display: block; margin: 12px 0 6px; font-size: 13px; color: var(--muted); }
.field { width: 100%; height: 42px; padding: 0 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg-page); color: var(--text); font-size: 14px; }
</style>
