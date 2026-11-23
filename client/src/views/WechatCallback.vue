<template>
  <div class="page">
    <div class="container" style="max-width:420px;margin-top:60px">
      <div class="card card-pad center">
        <div v-if="failed">
          <div style="font-size:40px">⚠️</div>
          <h2 style="margin:10px 0 6px">微信登录失败</h2>
          <p class="small muted">{{ msg }}</p>
          <router-link to="/login" class="btn btn-primary" style="margin-top:16px">返回登录</router-link>
        </div>
        <div v-else>
          <div class="spinner"></div>
          <h2 style="margin:16px 0 6px">正在完成登录…</h2>
          <p class="small muted">请稍候</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { setAuth, showToast } from '../store'

const router = useRouter()
const route = useRoute()
const failed = ref(false)
const msg = ref('')

onMounted(() => {
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''))
  const token = hash.get('token') || ''
  const raw = hash.get('user') || ''
  if (!token) {
    failed.value = true
    msg.value = '未获取到登录凭证，请重新发起微信登录'
    return
  }
  try {
    const user = JSON.parse(decodeURIComponent(raw))
    setAuth(token, user)
    showToast('微信登录成功', 'success')
    history.replaceState(null, '', '/')
    router.replace(route.query.redirect || '/me')
  } catch (e) {
    failed.value = true
    msg.value = '登录信息解析失败，请重试'
  }
})
</script>

<style scoped>
.spinner { width: 34px; height: 34px; border: 3px solid #e8edf4; border-top-color: var(--primary); border-radius: 50%; margin: 0 auto; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
