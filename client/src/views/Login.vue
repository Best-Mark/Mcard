<template>
  <div class="page">
    <header class="topbar"><router-link to="/" class="brand">M<em>Card</em></router-link></header>
    <div class="container" style="max-width:420px;margin-top:34px">
      <div class="card card-pad">
        <h2 style="margin-bottom:6px">{{ mode === 'login' ? '欢迎回来' : '创建账号' }}</h2>
        <p class="small muted" style="margin-bottom:20px">登录后即可管理你的数字名片</p>
        <div class="field"><label>手机号</label><input v-model.trim="phone" class="input" inputmode="numeric" maxlength="11" placeholder="11 位手机号" /></div>
        <div class="field"><label>密码</label><input v-model="password" class="input" type="password" placeholder="至少 6 位" @keyup.enter="submit" /></div>
        <div v-if="mode === 'register'" class="field"><label>昵称（选填）</label><input v-model.trim="nickname" class="input" placeholder="展示用名称" /></div>
        <button class="btn btn-primary btn-block btn-lg" :disabled="busy" @click="submit">{{ busy ? '请稍候…' : (mode === 'login' ? '登录' : '注册并登录') }}</button>
        <p class="center small muted" style="margin-top:16px">
          {{ mode === 'login' ? '还没有账号？' : '已有账号？' }}
          <button style="color:var(--primary);font-weight:700" @click="mode = mode === 'login' ? 'register' : 'login'">
            {{ mode === 'login' ? '立即注册' : '去登录' }}
          </button>
        </p>
      </div>
      <p class="hint" style="margin-top:14px">演示环境可直接注册。正式上线建议接入短信验证码登录与图形验证码风控。</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../api'
import { setAuth, showToast } from '../store'

const route = useRoute(); const router = useRouter()
const mode = ref('login'); const phone = ref(''); const password = ref(''); const nickname = ref(''); const busy = ref(false)

async function submit() {
  if (!/^1\d{10}$/.test(phone.value)) return showToast('请输入 11 位手机号', 'error')
  if (password.value.length < 6) return showToast('密码至少 6 位', 'error')
  busy.value = true
  try {
    const url = mode.value === 'login' ? '/api/auth/login' : '/api/auth/register'
    const { data } = await api.post(url, { phone: phone.value, password: password.value, nickname: nickname.value })
    setAuth(data.data.token, data.data.user)
    showToast('登录成功', 'success')
    router.replace(route.query.redirect || '/me')
  } catch (e) { showToast(e.message, 'error') } finally { busy.value = false }
}
</script>
