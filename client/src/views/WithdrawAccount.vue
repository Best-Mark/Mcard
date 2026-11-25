<template>
  <div class="page">
    <header class="topbar">
      <button class="back-btn" aria-label="返回" @click="router.push('/me/promo')">‹</button>
      <span class="title">收款账户</span>
      <div class="spacer"></div>
    </header>

    <div class="container">
      <div v-if="loadError" class="card card-pad" style="border-color:#fecaca;background:#fef2f2">
        <b style="color:#b91c1c">收款账户加载失败</b>
        <p class="small muted" style="margin:6px 0 12px">{{ loadError }}</p>
        <button class="btn btn-sm btn-primary" :disabled="loading" @click="load">重新加载</button>
      </div>
      <div v-else-if="loading" class="card card-pad">加载中…</div>
      <template v-else>
        <p class="wa-tip small muted">提现只能提现到已绑定的账户；微信收款使用微信授权身份，不需要手填账号。</p>
        <div v-for="a in accounts" :key="a.type" class="card card-pad wa-card">
          <div class="wa-head">
            <b>{{ a.label }}</b>
            <span v-if="a.default" class="badge">默认</span>
            <span v-else-if="!a.bound" class="badge muted-badge">未绑定</span>
          </div>
          <div v-if="a.bound" class="wa-body">
            <div class="wa-account">{{ a.account }}</div>
            <div class="small muted">{{ a.type === 'wechat' ? '微信授权身份' : '收款人' }}：{{ a.name || '—' }}</div>
            <div class="wa-actions">
              <button v-if="!a.default" class="btn btn-sm btn-ghost" :disabled="busy" @click="setDefault(a)">设为默认</button>
              <button class="btn btn-sm btn-ghost" :disabled="busy" @click="goEdit(a)">编辑</button>
              <button class="btn btn-sm btn-danger" :disabled="busy" @click="askUnbind(a)">解绑</button>
            </div>
          </div>
          <div v-else class="wa-body">
            <button class="btn btn-sm btn-primary" @click="goEdit(a)">绑定{{ a.label }}</button>
          </div>
        </div>
      </template>
    </div>

    <BottomSheet :show="!!pendingUnbind" @update:show="pendingUnbind = null">
      <div class="ws-head"><b>解绑收款账户</b><button class="btn btn-sm btn-ghost" @click="pendingUnbind = null">取消</button></div>
      <div class="ws-body">
        <p class="small muted">解绑后「{{ pendingUnbind?.label }}」不能再用于提现，已提交的提现单不受影响。</p>
        <button class="btn btn-danger btn-block" :disabled="busy" @click="confirmUnbind">确认解绑</button>
      </div>
    </BottomSheet>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api'
import { showToast } from '../store'
import BottomSheet from '../components/BottomSheet.vue'

const router = useRouter()
const accounts = ref([])
const loading = ref(true)
const loadError = ref('')
const busy = ref(false)
const pendingUnbind = ref(null)

async function load() {
  if (loading.value && accounts.value.length) return
  loading.value = true
  loadError.value = ''
  try {
    const { data } = await api.get('/api/promo/withdraw-accounts')
    accounts.value = data.data?.accounts || []
  } catch (e) { loadError.value = e.message || '网络异常' }
  finally { loading.value = false }
}
onMounted(load)

function goEdit(a) { router.push(`/me/withdraw-account-edit?type=${a.type}`) }
function askUnbind(a) { pendingUnbind.value = a }
async function setDefault(a) {
  if (busy.value || a.default) return
  busy.value = true
  try {
    const { data } = await api.put('/api/promo/withdraw-account', { type: a.type, setDefault: true })
    accounts.value = data.data?.accounts || []
    showToast('默认收款账户已更新', 'success')
  } catch (e) { showToast(e.message || '设置失败', 'error') }
  finally { busy.value = false }
}
async function confirmUnbind() {
  if (busy.value || !pendingUnbind.value) return
  const a = pendingUnbind.value
  busy.value = true
  try {
    const { data } = await api.delete(`/api/promo/withdraw-account/${a.type}`)
    accounts.value = data.data?.accounts || []
    pendingUnbind.value = null
    showToast('已解绑', 'success')
  } catch (e) { showToast(e.message || '解绑失败', 'error') }
  finally { busy.value = false }
}
</script>

<style scoped>
.wa-tip { margin: 12px 2px 2px; line-height: 1.6; }
.wa-card { margin-top: 10px; }
.wa-head { display: flex; align-items: center; gap: 8px; }
.wa-head b { font-size: 15px; }
.badge { padding: 2px 8px; border-radius: 999px; background: #d1fae5; color: #059669; font-size: 11px; font-weight: 700; }
.muted-badge { background: #f1f5f9; color: #94a3b8; }
.wa-body { margin-top: 10px; }
.wa-account { font-size: 17px; font-weight: 700; letter-spacing: .5px; margin-bottom: 4px; }
.wa-actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.ws-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--line); }
.ws-body { padding: 16px; }
</style>
