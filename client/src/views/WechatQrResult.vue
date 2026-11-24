<template>
  <div class="page">
    <div class="container" style="max-width:420px;margin-top:60px">
      <div class="card card-pad center">
        <template v-if="bindTicket">
          <div style="font-size:40px">📱</div>
          <h2 style="margin:10px 0 6px">首次微信登录</h2>
          <p class="small muted" style="margin-bottom:16px">绑定手机号后即可完成登录，与电脑端使用同一账号</p>
          <div v-if="wxNickname" class="wx-user">
            <span class="wx-avatar"><img v-if="wxAvatar" :src="wxAvatar" alt="" /><template v-else>微</template></span>
            <span>{{ wxNickname }}</span><span class="badge ok">已授权</span>
          </div>
          <div class="field"><label>手机号</label><input v-model.trim="phone" class="input" inputmode="numeric" maxlength="11" placeholder="11 位手机号" /></div>
          <div class="field"><label>设置密码（至少 6 位）</label><input v-model.trim="password" class="input" type="password" placeholder="已有账号请填原密码" /></div>
          <button class="btn btn-primary btn-block btn-lg" :disabled="busy" @click="submitBind">{{ busy ? '请稍候…' : '确认绑定' }}</button>
          <p v-if="errMsg" class="small" style="color:var(--danger);margin-top:10px">{{ errMsg }}</p>
        </template>
        <template v-else-if="errText">
          <div style="font-size:40px">⚠️</div>
          <h2 style="margin:10px 0 6px">微信授权未完成</h2>
          <p class="small muted">{{ errText }}</p>
        </template>
        <template v-else>
          <div style="font-size:46px;color:#07c160">✓</div>
          <h2 style="margin:10px 0 6px">扫码成功</h2>
          <p class="small muted">请返回电脑浏览器完成登录</p>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '../api'

const route = useRoute()
const bindTicket = ref(''); const sid = ref(''); const wxNickname = ref(''); const wxAvatar = ref('')
const phone = ref(''); const password = ref(''); const busy = ref(false); const errMsg = ref(''); const errText = ref('')
const ERR_TEXT = { state: '授权状态校验失败，请重新扫码', denied: '你取消了微信授权', disabled: '账号已被停用', oauth: '微信授权失败，请重新扫码' }

onMounted(() => {
  bindTicket.value = String(route.query.bind || '')
  sid.value = String(route.query.sid || '')
  wxNickname.value = String(route.query.nickname || '')
  wxAvatar.value = String(route.query.avatar || '')
  const err = String(route.query.err || '')
  if (err) errText.value = ERR_TEXT[err] || '微信登录失败，请重新扫码'
})

async function submitBind() {
  if (busy.value) return
  if (!/^1\d{10}$/.test(phone.value)) return (errMsg.value = '请输入 11 位手机号')
  if (password.value.length < 6) return (errMsg.value = '密码至少 6 位')
  busy.value = true; errMsg.value = ''
  try {
    await api.post('/api/auth/wechat/bind', { phone: phone.value, password: password.value, ticket: bindTicket.value, qrSid: sid.value })
    bindTicket.value = '' // 成功：切换到「扫码成功」态
  } catch (e) { errMsg.value = e.message } finally { busy.value = false }
}
</script>

<style scoped>
.wx-user { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; background: #f0fdf4; margin-bottom: 16px; font-size: 13px; }
.wx-avatar { width: 34px; height: 34px; border-radius: 50%; overflow: hidden; background: #07c160; color: #fff; display: grid; place-items: center; font-weight: 700; }
.wx-avatar :deep(img) { width: 100%; height: 100%; object-fit: cover; }
.field { text-align: left; margin-bottom: 12px; }
.field label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 5px; }
</style>
