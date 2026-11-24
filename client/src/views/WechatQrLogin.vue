<template>
  <div class="page">
    <div class="container" style="max-width:420px;margin-top:60px">
      <div class="card card-pad center">
        <div v-if="failed">
          <div style="font-size:40px">⚠️</div>
          <h2 style="margin:10px 0 6px">无法发起微信授权</h2>
          <p class="small muted">{{ msg }}</p>
        </div>
        <div v-else-if="cancelled">
          <div style="font-size:40px">🚫</div>
          <h2 style="margin:10px 0 6px">已取消登录</h2>
          <p class="small muted">本次扫码已取消，可关闭本页返回微信。</p>
        </div>
        <div v-else-if="jumping || loading">
          <div class="spinner"></div>
          <h2 style="margin:16px 0 6px">{{ loading ? '正在校验登录请求…' : '正在唤起微信授权…' }}</h2>
          <p class="small muted">请稍候，授权完成后即可返回电脑</p>
        </div>
        <div v-else>
          <div style="font-size:40px">🔐</div>
          <h2 style="margin:10px 0 6px">确认登录到电脑？</h2>
          <p class="small muted" style="margin-bottom:18px">确认后才继续微信授权；若不是你本人操作，请点取消。</p>
          <button class="btn btn-primary btn-block btn-lg" :disabled="confirmBusy" @click="confirmLogin">{{ confirmBusy ? '请稍候…' : '确认登录' }}</button>
          <button class="btn btn-ghost btn-block" style="margin-top:10px" :disabled="confirmBusy" @click="cancelLogin">取消</button>
          <p v-if="errMsg" class="small" style="color:var(--danger);margin-top:10px">{{ errMsg }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import api from '../api'
import { isWeChat } from '../utils/save-image'

const route = useRoute()
const sid = ref('')
const failed = ref(false)
const msg = ref('')
const loading = ref(true)
const cancelled = ref(false)
const jumping = ref(false)
const confirmBusy = ref(false)
const errMsg = ref('')
let handled = false // 防重入：热重载不得重复处理同一次扫码
let jumpTimer = null
function withTimeout(promise, ms, message) {
  let timer
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms) })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

onMounted(async () => {
  if (handled) return
  handled = true
  const s = String(route.query.sid || '')
  if (!/^[a-f0-9]{32}$/.test(s)) { failed.value = true; msg.value = '登录二维码无效，请在电脑端重新扫码'; loading.value = false; return }
  if (!isWeChat()) { failed.value = true; msg.value = '请用手机微信扫一扫此二维码'; loading.value = false; return }
  sid.value = s
  // 只上报「已扫描」，不自动跳授权：必须等用户显式确认。
  // 上报不阻塞确认 UI（服务端 qr-confirm 也兼容 pending），避免网络慢时卡在转圈。
  api.post('/api/auth/wechat/qr-scanned', { sid: s }).catch(() => {})
  loading.value = false
})
onBeforeUnmount(() => clearTimeout(jumpTimer))

async function confirmLogin() {
  if (confirmBusy.value || !sid.value) return
  confirmBusy.value = true
  errMsg.value = ''
  try {
    await withTimeout(api.post('/api/auth/wechat/qr-confirm', { sid: sid.value }), 8000, '确认请求超时，请重试')
    const { data } = await withTimeout(api.get('/api/auth/wechat/url', { params: { sid: sid.value } }), 8000, '获取授权地址超时，请重试')
    if (!data?.data?.url) throw new Error('未获取到微信授权地址')
    jumping.value = true
    // 授权页打开慢时给用户可重试出口，避免永久停在「正在跳转」
    jumpTimer = setTimeout(() => {
      if (jumping.value) { jumping.value = false; confirmBusy.value = false; errMsg.value = '授权页打开较慢，请再点一次确认' }
    }, 8000)
    location.href = data.data.url
  } catch (e) {
    jumping.value = false
    failed.value = true
    msg.value = e.message || '确认失败，请重新扫码'
  } finally {
    if (!jumping.value) confirmBusy.value = false
  }
}

async function cancelLogin() {
  if (confirmBusy.value || !sid.value) return
  confirmBusy.value = true
  errMsg.value = ''
  try {
    await withTimeout(api.post('/api/auth/wechat/qr-cancel', { sid: sid.value }), 8000, '取消请求超时，请重试')
    cancelled.value = true // 电脑端立即拿到 failed，不再空等
  } catch (e) { errMsg.value = e.message || '取消失败，请关闭本页' }
  finally { confirmBusy.value = false }
}
</script>

<style scoped>
.spinner { width: 34px; height: 34px; border: 3px solid #e8edf4; border-top-color: var(--primary); border-radius: 50%; margin: 0 auto; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
