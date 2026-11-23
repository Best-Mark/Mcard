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

let handled = false // 防重入：onMounted 只处理一次，避免热重载/重复触发重复 setAuth
onMounted(async () => {
  if (handled) return
  handled = true
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''))
  const token = hash.get('token') || ''
  const raw = hash.get('user') || ''
  if (!token || !raw) {
    failed.value = true
    msg.value = '未获取到登录凭证，请重新发起微信登录'
    return
  }
  let user
  try {
    // URLSearchParams 已完成一次解码，这里绝不能再 decodeURIComponent（昵称含 % 会抛 URIError）
    user = JSON.parse(raw)
    if (!user || typeof user !== 'object' || !user.id) throw new Error('bad user')
  } catch (e) {
    failed.value = true
    msg.value = '登录信息解析失败，请重新发起微信登录'
    return
  }
  // 时序：先同步落地 token（localStorage + 响应式 store），再让路由守卫看到凭证，
  // 最后用 router.replace 由 vue-router 自身清理 URL（不再裸调 history.replaceState 与之竞态）。
  setAuth(token, user)
  const target = route.query.redirect || '/me'
  try {
    await router.replace(target)
    showToast('微信登录成功', 'success')
  } catch (e) {
    failed.value = true
    msg.value = '登录已完成，但页面跳转失败，请点击返回登录'
  }
})
</script>

<style scoped>
.spinner { width: 34px; height: 34px; border: 3px solid #e8edf4; border-top-color: var(--primary); border-radius: 50%; margin: 0 auto; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
