<template>
  <div class="page">
    <header class="topbar">
      <button class="back" @click="done" aria-label="返回">‹</button>
      <span class="title">账户资料</span>
      <span class="spacer"></span>
      <button class="btn btn-sm btn-primary" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存' }}</button>
    </header>

    <div class="container">
      <div class="card card-pad">
        <p class="small muted acct-hint">账户资料属于登录账号本身，与名片资料相互独立。修改昵称不会影响名片上的姓名、职位与公司；名片资料请在「编辑名片」里修改。</p>

        <div class="field">
          <label>昵称</label>
          <input v-model.trim="nickname" class="input" maxlength="30" placeholder="账户显示名称（与名片姓名无关）" />
        </div>

        <div class="field">
          <label>手机号</label>
          <input class="input" :value="phone" disabled />
          <p class="small muted">手机号是登录凭证，暂不支持在此修改。</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api'
import { auth, setAuth, showToast } from '../store'

const router = useRouter()
const nickname = ref('')
const phone = computed(() => auth.user?.phone || '')
const saving = ref(false)

onMounted(async () => {
  nickname.value = auth.user?.nickname || ''
  try {
    const { data } = await api.get('/api/auth/me')
    const u = data?.data || {}
    if (u.nickname) nickname.value = u.nickname
  } catch { /* 用本地缓存兜底，不影响编辑 */ }
})

async function save() {
  if (saving.value) return
  if (!nickname.value) return showToast('昵称不能为空', 'error')
  saving.value = true
  try {
    const { data } = await api.put('/api/auth/profile', { nickname: nickname.value })
    const u = data?.data?.user
    if (u) setAuth(auth.token, u)
    showToast('账户昵称已保存', 'success')
    router.back()
  } catch (e) { showToast(e.message || '保存失败', 'error') }
  finally { saving.value = false }
}

function done() { router.back() }
</script>

<style scoped>
.acct-hint { margin: 0 0 16px; line-height: 1.6; }
.field { margin-bottom: 16px; }
.field > label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; }
</style>
