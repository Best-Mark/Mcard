<template>
  <div class="page">
    <header class="topbar">
      <span class="title">消息通知</span>
      <div class="spacer"></div>
      <button v-if="unread" class="btn btn-sm btn-ghost" :disabled="marking" @click="markAll">{{ marking ? '处理中…' : '全部已读' }}</button>
      <button class="nav-menu-btn" aria-label="菜单" @click="toggleDrawer"><i class="menu-glyph"></i></button>
    </header>

    <div class="container" style="margin-top:16px">
      <div v-if="loading" class="card card-pad center">加载中…</div>
      <div v-else-if="error" class="card card-pad center" style="padding:40px 16px">
        <b>加载失败</b><p class="small muted">{{ error }}</p>
        <button class="btn btn-primary" style="margin-top:12px" @click="load">重新加载</button>
      </div>
      <div v-else-if="!list.length" class="card card-pad center" style="padding:48px 16px">
        <div style="font-size:40px;opacity:.25">🔔</div>
        <h3 style="margin:10px 0">暂无通知</h3>
        <p class="small muted">有人收藏、交换你的名片，或你关注的名片更新资料时，会在这里提醒你。</p>
      </div>
      <template v-else>
        <div class="notif-list">
          <div v-for="n in list" :key="n.id" class="card notif-item" :class="{ unread: !n.isRead }" @click="open(n)">
            <div class="ni-ico">{{ iconOf(n.type) }}</div>
            <div class="ni-body">
              <div class="ni-head"><b>{{ n.title }}</b><span class="small muted">{{ timeOf(n.createdAt) }}</span></div>
              <p class="small">{{ n.body }}</p>
            </div>
            <button class="ni-del" aria-label="删除" @click.stop="remove(n)">✕</button>
          </div>
        </div>
        <button v-if="hasMore" class="btn btn-ghost" style="width:100%;margin-top:12px" :disabled="loadingMore" @click="loadMore">{{ loadingMore ? '加载中…' : '加载更多' }}</button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api'
import { toggleDrawer, showToast } from '../store'

const router = useRouter()
const list = ref([])
const unread = ref(0)
const loading = ref(true)
const loadingMore = ref(false)
const marking = ref(false)
const error = ref('')
const hasMore = ref(false)
let loadStarted = false

async function load() {
  if (loadStarted && loading.value) return
  loadStarted = true
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.get('/api/notifications', { params: { size: 20 } })
    list.value = data.data?.list || []
    unread.value = data.data?.unread || 0
    hasMore.value = !!data.data?.hasMore
  } catch (e) { error.value = e.message || '网络异常' } finally { loading.value = false }
}
async function loadMore() {
  if (loadingMore.value || !list.value.length) return
  loadingMore.value = true
  try {
    const before = list.value[list.value.length - 1].id
    const { data } = await api.get('/api/notifications', { params: { size: 20, before } })
    list.value.push(...(data.data?.list || []))
    hasMore.value = !!data.data?.hasMore
  } catch (e) { showToast(e.message || '加载失败', 'error') } finally { loadingMore.value = false }
}
async function open(n) {
  if (!n.isRead) {
    try {
      await api.post('/api/notifications/read', { id: n.id })
      n.isRead = true
      unread.value = Math.max(0, unread.value - 1)
    } catch { /* 已读失败不影响跳转 */ }
  }
  if (n.link) router.push(n.link)
}
async function markAll() {
  if (marking.value) return
  marking.value = true
  try {
    await api.post('/api/notifications/read', { all: true })
    list.value.forEach(n => { n.isRead = true })
    unread.value = 0
    showToast('已全部标为已读', 'success')
  } catch (e) { showToast(e.message || '操作失败', 'error') } finally { marking.value = false }
}
async function remove(n) {
  try {
    await api.delete(`/api/notifications/${n.id}`)
    list.value = list.value.filter(x => x.id !== n.id)
    if (!n.isRead) unread.value = Math.max(0, unread.value - 1)
  } catch (e) { showToast(e.message || '删除失败', 'error') }
}
function iconOf(type) { return ({ card_update: '🔄', new_favorite: '⭐', new_exchange: '🤝', new_view: '👀' })[type] || '🔔' }
function timeOf(s) {
  if (!s) return ''
  const t = new Date(String(s).replace(' ', 'T') + (String(s).includes('Z') ? '' : 'Z'))
  if (isNaN(t)) return s
  const diff = Date.now() - t.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前'
  if (diff < 7 * 86400000) return Math.floor(diff / 86400000) + ' 天前'
  return String(s).slice(0, 10)
}
onMounted(load)
</script>

<style scoped>
.back { width: 34px; height: 34px; display: grid; place-items: center; font-size: 26px; color: var(--primary); }
.title { font-size: 15px; font-weight: 700; }
.spacer { flex: 1; }
.notif-list { display: flex; flex-direction: column; gap: 10px; }
.notif-item { display: flex; align-items: flex-start; gap: 12px; padding: 14px; border-left: 3px solid transparent; cursor: pointer; }
.notif-item.unread { border-left-color: var(--primary); background: color-mix(in srgb, var(--primary) 5%, var(--bg-card)); }
.ni-ico { font-size: 22px; line-height: 1.2; }
.ni-body { flex: 1; min-width: 0; }
.ni-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.ni-head b { font-size: 14px; }
.ni-body p { margin: 4px 0 0; line-height: 1.5; }
.ni-del { color: var(--muted); font-size: 12px; padding: 2px 6px; }
</style>
