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
import { setAuth, showToast, bindPendingInvite } from '../store'
import api from '../api'

const router = useRouter()
const route = useRoute()
const failed = ref(false)
const msg = ref('')

let handled = false // 防重入：onMounted 只处理一次，避免热重载/重复触发重复 setAuth
onMounted(async () => {
  if (handled) return
  handled = true
  // 2026-11-27 加固：回调 302 的 hash 只带 60s 一次性兑换码（login=<code>），POST 换 token；
  // JWT 不再进 URL。旧版 hash（token+user 裸凭据）保留兼容消费，升级过渡期书签/残留链接不断链。
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''))
  const code = hash.get('login') || ''
  const oldToken = hash.get('token') || ''
  const raw = hash.get('user') || ''
  if (!code && !(oldToken && raw)) {
    failed.value = true
    msg.value = '未获取到登录凭证，请重新发起微信登录'
    return
  }
  try {
    let token = oldToken, user
    if (code) {
      const { data } = await api.post('/api/auth/wechat/exchange', { code })
      token = data.data?.token || ''
      user = data.data?.user || null
      if (!token || !user) throw new Error('bad exchange')
    } else {
      // URLSearchParams 已完成一次解码，这里绝不能再 decodeURIComponent（昵称含 % 会抛 URIError）
      user = JSON.parse(raw)
    }
    if (!user || typeof user !== 'object' || !user.id) throw new Error('bad user')
    // 时序：先同步落地 token（localStorage + 响应式 store），再让路由守卫看到凭证，
    // 最后用 router.replace 由 vue-router 自身清理 URL（不再裸调 history.replaceState 与之竞态）。
    setAuth(token, user)
    await bindPendingInvite(api) // 邀请归因兜底（失败不阻断登录）
    const target = route.query.redirect || '/me'
    await router.replace(target)
    showToast('微信登录成功', 'success')
  } catch (e) {
    failed.value = true
    msg.value = e?.message === 'bad exchange' ? '登录凭证无效或已过期，请重新发起微信登录'
      : '登录信息解析失败，请重新发起微信登录'
  }
})
</script>

<style scoped>
.spinner { width: 34px; height: 34px; border: 3px solid #e8edf4; border-top-color: var(--primary); border-radius: 50%; margin: 0 auto; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
