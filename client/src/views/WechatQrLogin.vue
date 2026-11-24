<template>
  <div class="page">
    <div class="container" style="max-width:420px;margin-top:60px">
      <div class="card card-pad center">
        <div v-if="failed">
          <div style="font-size:40px">⚠️</div>
          <h2 style="margin:10px 0 6px">无法发起微信授权</h2>
          <p class="small muted">{{ msg }}</p>
        </div>
        <div v-else>
          <div class="spinner"></div>
          <h2 style="margin:16px 0 6px">正在唤起微信授权…</h2>
          <p class="small muted">请稍候，授权完成后即可返回电脑</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '../api'
import { isWeChat } from '../utils/save-image'

const route = useRoute()
const failed = ref(false)
const msg = ref('')
let handled = false // 防重入：一次性凭证 + 热重载不得重复发起 OAuth

onMounted(async () => {
  if (handled) return
  handled = true
  const sid = String(route.query.sid || '')
  if (!/^[a-f0-9]{32}$/.test(sid)) { failed.value = true; msg.value = '登录二维码无效，请在电脑端重新扫码'; return }
  if (!isWeChat()) { failed.value = true; msg.value = '请用手机微信扫一扫此二维码'; return }
  try {
    api.post('/api/auth/wechat/qr-scanned', { sid }).catch(() => {}) // 上报已扫描，电脑端切到「请在手机确认」
    const { data } = await api.get('/api/auth/wechat/url', { params: { sid } })
    if (!data?.data?.url) throw new Error('未获取到微信授权地址')
    location.href = data.data.url
  } catch (e) {
    failed.value = true
    msg.value = e.message || '发起授权失败，请重试'
  }
})
</script>

<style scoped>
.spinner { width: 34px; height: 34px; border: 3px solid #e8edf4; border-top-color: var(--primary); border-radius: 50%; margin: 0 auto; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
