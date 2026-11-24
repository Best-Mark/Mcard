<template>
  <div class="page">
    <header class="topbar">
      <router-link to="/me" class="brand">M<em>Card</em></router-link>
      <div class="spacer"></div>
      <button class="nav-menu-btn" aria-label="打开菜单" @click="openDrawer">☰</button>
    </header>

    <div class="container" style="margin-top:18px">
      <div class="card card-pad me-head">
        <div class="me-ava">{{ (auth.user?.phone || '名').slice(0, 1) }}</div>
        <div class="me-ident">
          <b>{{ auth.user?.phone || '我的账户' }}</b>
          <span v-if="card">{{ card.name || '未设置姓名' }} · {{ card.company || '未设置公司' }}</span>
          <span v-else>还没有创建名片</span>
        </div>
        <span v-if="card" class="badge" :class="card.active ? 'ok' : 'warn'">{{ card.active ? '已开通' : '未开通' }}</span>
      </div>

      <div v-if="loadError" class="card card-pad" style="margin-top:14px;border-color:#fecaca;background:#fef2f2">
        <b style="color:#b91c1c">名片信息加载失败</b>
        <p class="small muted" style="margin:6px 0 12px">{{ loadError }}</p>
        <button class="btn btn-sm btn-primary" :disabled="loading" @click="load">重新加载</button>
      </div>
      <div v-else-if="loading" class="card card-pad center" style="margin-top:14px">加载中…</div>

      <div class="section-title">快捷入口</div>
      <div class="me-grid">
        <router-link to="/me/favorites" class="me-cell"><i>★</i><span>我的收藏夹</span></router-link>
        <router-link to="/me/contacts" class="me-cell"><i>▤</i><span>我的名片夹</span></router-link>
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
import { auth, logout, openDrawer, showToast } from '../store'

const router = useRouter()
const card = ref(null)
const loading = ref(true)
const loadError = ref('')
let loadStarted = false

async function load() {
  if (loadStarted && loading.value) return
  loadStarted = true
  loading.value = true
  loadError.value = ''
  try {
    const { data } = await api.get('/api/cards/mine')
    card.value = data?.data || null
  } catch (e) { loadError.value = e.message || '网络异常' }
  finally { loading.value = false }
}
onMounted(load)

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
.me-ava { width: 48px; height: 48px; flex: 0 0 48px; border-radius: 14px; background: linear-gradient(135deg, #17357c, #2563eb); color: #fff; display: grid; place-items: center; font-size: 20px; font-weight: 800; }
.me-ident { flex: 1; min-width: 0; }
.me-ident b { display: block; font-size: 15px; }
.me-ident span { display: block; font-size: 12px; color: var(--muted); margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.me-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
.me-cell { display: flex; flex-direction: column; align-items: center; gap: 7px; padding: 16px 4px; border-radius: 14px; background: #fff; border: 1px solid var(--line); font-size: 12px; text-align: center; }
.me-cell i { width: 40px; height: 40px; border-radius: 12px; background: #eff6ff; color: var(--primary); display: grid; place-items: center; font-style: normal; font-size: 19px; }
.me-link { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.me-link b { display: block; font-size: 14px; }
.me-link span { display: block; margin-top: 4px; }
.me-logout { margin-top: 18px; color: var(--danger); }
@media (max-width: 520px) { .me-grid { grid-template-columns: repeat(2, 1fr); } }
</style>
