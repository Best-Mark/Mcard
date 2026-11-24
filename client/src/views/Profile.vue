<template>
  <div class="page">
    <header class="topbar">
      <router-link to="/me" class="brand">M<em>Card</em></router-link>
      <div class="spacer"></div>
      <button class="nav-menu-btn" aria-label="菜单" @click="toggleDrawer"><i class="menu-glyph"></i></button>
    </header>

    <div class="container" style="margin-top:18px">
      <div class="card card-pad me-head">
        <label class="me-ava" title="点击更换账号头像">
          <img v-if="avatar" :src="avatar" alt="账号头像" />
          <span v-else>{{ (auth.user?.phone || '名').slice(0, 1) }}</span>
          <i class="me-ava-cam">✎</i>
          <input type="file" accept="image/*" :disabled="avatarSaving" @change="onAvatarFile" />
        </label>
        <div class="me-ident">
          <b>{{ auth.user?.phone || '我的账户' }}</b>
          <span v-if="card">{{ card.name || '未设置姓名' }} · {{ card.company || '未设置公司' }}</span>
          <span v-else>还没有创建名片</span>
        </div>
        <span v-if="card" class="badge" :class="card.active ? 'ok' : 'warn'">{{ card.active ? '已开通' : '未开通' }}</span>
      </div>

      <div class="card card-pad avatar-manage">
        <div>
          <b>👤 账号头像</b>
          <p class="small muted">属于账号资料，展示在你的名片与通讯录；与名片 LOGO 分开管理。</p>
        </div>
        <div class="avatar-actions">
          <label class="btn btn-sm btn-ghost upload-btn" :class="{ disabled: avatarSaving }">{{ avatarSaving ? '上传中…' : '上传头像' }}
            <input type="file" accept="image/*" :disabled="avatarSaving" @change="onAvatarFile" />
          </label>
          <AssetPicker :model-value="avatar" label="从素材库选" @update:model-value="saveAvatar" />
        </div>
      </div>

      <div v-if="loadError" class="card card-pad" style="margin-top:14px;border-color:#fecaca;background:#fef2f2">
        <b style="color:#b91c1c">名片信息加载失败</b>
        <p class="small muted" style="margin:6px 0 12px">{{ loadError }}</p>
        <button class="btn btn-sm btn-primary" :disabled="loading" @click="load">重新加载</button>
      </div>
      <div v-else-if="loading" class="card card-pad center" style="margin-top:14px">加载中…</div>

      <div class="section-title">快捷入口</div>
      <div class="me-grid">
        <router-link to="/me/contacts" class="me-cell"><i>★</i><span>我的名片夹</span></router-link>
        <router-link to="/me/stats" class="me-cell"><i>📊</i><span>浏览统计</span></router-link>
        <router-link to="/me/plans" class="me-cell"><i>💎</i><span>套餐 / 续期</span></router-link>
        <router-link to="/me/print" class="me-cell"><i>🖨</i><span>实体版式</span></router-link>
      </div>

      <div class="section-title">我的名片</div>
      <div v-if="card" class="card card-pad me-link">
        <div><b>/c/{{ card.slug }}</b><span class="small muted">二维码永久不变，改资料不用换码</span></div>
        <button class="btn btn-sm btn-ghost" @click="copyLink">复制链接</button>
      </div>
      <div v-else class="card card-pad center small muted">还没有名片，可在「名片」栏创建。</div>

      <button class="btn btn-block btn-ghost me-logout" @click="logoutNow">退出登录</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api'
import { auth, logout, toggleDrawer, showToast } from '../store'
import AssetPicker from '../components/AssetPicker.vue'

const router = useRouter()
const card = ref(null)
const avatar = ref('')
const avatarSaving = ref(false)
const loading = ref(true)
const loadError = ref('')
let loadStarted = false

async function load() {
  if (loadStarted && loading.value) return
  loadStarted = true
  loading.value = true
  loadError.value = ''
  try {
    const [c, a] = await Promise.all([api.get('/api/cards/mine'), api.get('/api/auth/avatar')])
    card.value = c?.data?.data || null
    avatar.value = a?.data?.data?.avatar || ''
  } catch (e) { loadError.value = e.message || '网络异常' }
  finally { loading.value = false }
}
onMounted(load)

async function onAvatarFile(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file || avatarSaving.value) return
  avatarSaving.value = true
  try {
    const fd = new FormData()
    fd.append('file', file)
    const { data } = await api.post('/api/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    await saveAvatar(data?.data?.url || '')
    const d = data?.data || {}
    const saved = d.converted && d.originalSize > d.size ? ` · 已压缩 ${Math.round((1 - d.size / d.originalSize) * 100)}%` : ''
    showToast(`头像已更新${saved}`, 'success')
  } catch (err) { showToast(err.message || '头像更新失败', 'error') }
  finally { avatarSaving.value = false }
}
async function saveAvatar(url) {
  if (!url || avatarSaving.value) return
  const { data } = await api.put('/api/auth/avatar', { avatar: url })
  avatar.value = data?.data?.avatar || url
  if (card.value) card.value.avatar = avatar.value
}

async function copyLink() {
  if (!card.value?.slug) return showToast('还没有名片', 'error')
  try {
    await navigator.clipboard.writeText(`${location.origin}/c/${card.value.slug}`)
    showToast('名片链接已复制', 'success')
  } catch { showToast('复制失败，请手动复制地址栏链接', 'error') }
}
function logoutNow() { logout(); router.push('/') }
</script>

<style scoped>
.me-head { display: flex; align-items: center; gap: 12px; }
.me-ava { position: relative; width: 56px; height: 56px; flex: 0 0 56px; border-radius: 16px; background: linear-gradient(135deg, #17357c, #2563eb); color: #fff; display: grid; place-items: center; font-size: 22px; font-weight: 800; overflow: hidden; cursor: pointer; }
.me-ava img { width: 100%; height: 100%; object-fit: cover; }
.me-ava input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.me-ava-cam { position: absolute; right: 0; bottom: 0; width: 18px; height: 18px; border-radius: 50%; background: #fff; color: #2563eb; font-size: 10px; font-style: normal; display: grid; place-items: center; }
.avatar-manage { margin-top: 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.avatar-manage b { font-size: 14px; }
.avatar-manage p { margin: 5px 0 0; }
.avatar-actions { display: flex; align-items: center; gap: 8px; }
.upload-btn { position: relative; overflow: hidden; }
.upload-btn input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.upload-btn.disabled { opacity: .6; pointer-events: none; }
.me-ident { flex: 1; min-width: 0; }
.me-ident b { display: block; font-size: 15px; }
.me-ident span { display: block; font-size: 12px; color: var(--muted); margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.me-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.me-cell { display: flex; flex-direction: column; align-items: center; gap: 7px; padding: 16px 4px; border-radius: 14px; background: #fff; border: 1px solid var(--line); font-size: 12px; text-align: center; }
.me-cell i { width: 40px; height: 40px; border-radius: 12px; background: #eff6ff; color: var(--primary); display: grid; place-items: center; font-style: normal; font-size: 19px; }
.me-link { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.me-link b { display: block; font-size: 14px; }
.me-link span { display: block; margin-top: 4px; }
.me-logout { margin-top: 18px; color: var(--danger); }
@media (max-width: 520px) { .me-grid { grid-template-columns: repeat(2, 1fr); } }
</style>
