<template>
  <div class="page">
    <header class="topbar"><router-link to="/" class="brand">M<em>Card</em></router-link></header>
    <div class="container" style="max-width:420px;margin-top:34px">
      <div class="card card-pad">
        <template v-if="bindTicket">
          <h2 style="margin-bottom:6px">绑定手机号</h2>
          <p class="small muted" style="margin-bottom:14px">微信授权成功，绑定手机号后即可完成登录；此手机号将作为账号凭证。</p>
          <div v-if="wxNickname" class="wx-user">
            <span class="wx-avatar"><img v-if="wxAvatar" :src="wxAvatar" alt="" /><template v-else>微</template></span>
            <span>{{ wxNickname }}</span><span class="badge ok">已授权</span>
          </div>
          <div class="field"><label>手机号</label><input v-model.trim="phone" class="input" inputmode="numeric" maxlength="11" placeholder="11 位手机号" /></div>
          <div class="field"><label>设置密码（至少 6 位）</label><input v-model="password" class="input" type="password" placeholder="已有账号请填原密码" @keyup.enter="submitBind" /></div>
          <button class="btn btn-primary btn-block btn-lg" :disabled="busy" @click="submitBind">{{ busy ? '请稍候…' : '确认绑定并登录' }}</button>
          <button class="btn btn-ghost btn-block" style="margin-top:10px" @click="cancelBind">取消，用其他方式登录</button>
        </template>
        <template v-else>
          <h2 style="margin-bottom:6px">{{ mode === 'login' ? '欢迎回来' : '创建账号' }}</h2>
          <p class="small muted" style="margin-bottom:20px">登录后即可管理你的数字名片</p>
          <div v-if="errMsg" class="hint warm" style="margin-bottom:14px">{{ errMsg }}</div>
          <div class="field"><label>手机号</label><input v-model.trim="phone" class="input" inputmode="numeric" maxlength="11" placeholder="11 位手机号" /></div>
          <div class="field"><label>密码</label><input v-model="password" class="input" type="password" placeholder="至少 6 位" @keyup.enter="submit" /></div>
          <div v-if="mode === 'register'" class="field"><label>昵称（选填）</label><input v-model.trim="nickname" class="input" placeholder="展示用名称" /></div>
          <button class="btn btn-primary btn-block btn-lg" :disabled="busy" @click="submit">{{ busy ? '请稍候…' : (mode === 'login' ? '登录' : '注册并登录') }}</button>

          <div v-if="wxEnabled && isWechat" class="wx-divider"><span>或</span></div>
          <button v-if="wxEnabled && isWechat" class="btn btn-wechat btn-block btn-lg" :disabled="wxBusy" @click="startWxLogin">
            <svg class="wx-ico" viewBox="0 0 24 24" fill="currentColor"><path d="M9.1 4C5.2 4 2 6.7 2 10c0 2 .9 3.8 2.4 5L4 17l2.3-1.1c.9.3 1.8.5 2.8.5h.6a5.5 5.5 0 0 1-.2-1.4c0-3.4 3.3-6.1 7.3-6.1h.6C16.2 6.3 13 4 9.1 4ZM6.6 8.6a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8Zm5 0a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8Z"/><path d="M22 14.3c0-2.7-2.7-4.9-6-4.9s-6 2.2-6 4.9 2.7 4.9 6 4.9c.7 0 1.4-.1 2-.3l1.9 1-.5-1.7c1.6-.9 2.6-2.3 2.6-3.9Zm-8-1.3a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6Zm4 0a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6Z"/></svg>
            {{ wxBusy ? '正在跳转…' : '微信快捷登录' }}
          </button>

          <p class="center small muted" style="margin-top:16px">
            {{ mode === 'login' ? '还没有账号？' : '已有账号？' }}
            <button style="color:var(--primary);font-weight:700" @click="mode = mode === 'login' ? 'register' : 'login'">
              {{ mode === 'login' ? '立即注册' : '去登录' }}
            </button>
          </p>
        </template>
      </div>
      <p class="hint" style="margin-top:14px">演示环境可直接注册。正式上线建议接入短信验证码登录与图形验证码风控。</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../api'
import { setAuth, showToast, siteConfig } from '../store'

const route = useRoute(); const router = useRouter()
const mode = ref('login'); const phone = ref(''); const password = ref(''); const nickname = ref(''); const busy = ref(false)
const wxBusy = ref(false)
// computed 跟随 siteConfig，避免 main.js 里 loadSiteConfig 未 await 导致按钮竞态不显示
const wxEnabled = computed(() => !!siteConfig.wechat_login_enabled)
const bindTicket = ref(''); const wxNickname = ref(''); const wxAvatar = ref(''); const errMsg = ref('')
const isWechat = /MicroMessenger/i.test(navigator.userAgent)

const ERR_TEXT = {
  state: '授权状态校验失败，请重新发起登录',
  denied: '你取消了微信授权',
  disabled: '账号已被停用，请联系管理员',
  oauth: '微信授权失败，请稍后重试或改用手机号登录',
  expired: '微信授权已过期，请重新发起登录'
}

onMounted(() => {
  const err = route.query.err
  if (err) errMsg.value = ERR_TEXT[err] || '微信登录失败，请重试'
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''))
  if (hash.get('bind')) {
    bindTicket.value = hash.get('bind')
    wxNickname.value = hash.get('nickname') || ''
    wxAvatar.value = hash.get('avatar') || ''
    history.replaceState(null, '', location.pathname)
  }
})

async function startWxLogin() {
  if (wxBusy.value) return
  wxBusy.value = true
  try {
    const { data } = await api.get('/api/auth/wechat/url', { params: { redirect: route.query.redirect || '' } })
    location.href = data.data.url
  } catch (e) { showToast(e.message, 'error'); wxBusy.value = false }
}

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

async function submitBind() {
  if (busy.value) return
  if (!/^1\d{10}$/.test(phone.value)) return showToast('请输入 11 位手机号', 'error')
  if (password.value.length < 6) return showToast('密码至少 6 位', 'error')
  busy.value = true
  try {
    const { data } = await api.post('/api/auth/wechat/bind', { phone: phone.value, password: password.value, ticket: bindTicket.value })
    setAuth(data.data.token, data.data.user)
    showToast('绑定成功，已登录', 'success')
    router.replace(route.query.redirect || '/me')
  } catch (e) { showToast(e.message, 'error') } finally { busy.value = false }
}

function cancelBind() {
  bindTicket.value = ''
  wxNickname.value = ''
  wxAvatar.value = ''
  phone.value = ''
  password.value = ''
}
</script>

<style scoped>
.btn-wechat { background: #07c160; color: #fff; box-shadow: 0 4px 14px rgba(7,193,96,.22); }
.wx-ico { width: 18px; height: 18px; }
.wx-divider { display: flex; align-items: center; gap: 12px; margin: 18px 0 14px; color: var(--muted); font-size: 12px; }
.wx-divider::before, .wx-divider::after { content: ''; flex: 1; height: 1px; background: var(--line); }
.wx-user { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; background: #f0fdf4; margin-bottom: 16px; font-size: 13px; }
.wx-avatar { width: 34px; height: 34px; border-radius: 50%; overflow: hidden; background: #07c160; color: #fff; display: grid; place-items: center; font-weight: 700; }
.wx-avatar :deep(img) { width: 100%; height: 100%; object-fit: cover; }
</style>
