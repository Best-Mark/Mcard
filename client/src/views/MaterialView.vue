<template>
  <div class="mv-page">
    <div class="mv-top">
      <button class="mv-back" @click="router.back ? router.back() : goCard()" aria-label="返回">‹</button>
      <div class="mv-brand">M<em>Card</em></div>
    </div>

    <div v-if="loading" class="container mv-loading">资料加载中…</div>
    <div v-else-if="error" class="container mv-loading">
      <b>资料加载失败</b><p class="small muted">{{ error }}</p>
      <button class="btn btn-primary" @click="load">重新加载</button>
    </div>

    <template v-else-if="info">
      <div class="container mv-main">
        <div class="mv-head card card-pad">
          <h1>{{ info.owner.name || '名片主人' }} 分享的相册</h1>
          <p class="small muted">共 {{ list.length }} 项 · 点开查看</p>
        </div>

        <div v-for="m in list" :key="m.id" class="card card-pad mv-item">
          <div class="mv-item-head">
            <span class="mv-type"><AppIcon :name="m.type === 'file' ? 'file' : 'link'" :size="20" /></span>
            <div class="mv-item-title">
              <b>{{ m.title }}</b>
              <span class="small muted">{{ m.type === 'file' ? '文件资料' : '网页链接' }} · {{ m.views }} 次查看</span>
            </div>
          </div>
          <div class="mv-item-body">
            <a v-if="m.type === 'link'" :href="safeUrl(m.url)" target="_blank" rel="noopener" class="btn btn-primary" @click="countView(m)">打开链接 ↗</a>
            <template v-else>
              <a :href="fullUrl(m.url)" target="_blank" rel="noopener" class="btn btn-primary" @click="countView(m)">查看 / 下载文件 ↗</a>
              <button class="btn btn-ghost" @click="copy(fullUrl(m.url), '文件链接')">复制链接</button>
            </template>
          </div>
        </div>

      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../api'
import { showToast } from '../store'
import AppIcon from '../components/AppIcon.vue'

const route = useRoute()
const router = useRouter()
const info = ref(null)
const list = ref([])
const loading = ref(true)
const error = ref('')
let loadStarted = false

async function load() {
  if (loadStarted && loading.value) return
  loadStarted = true
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.get(`/api/cards/public/${route.params.slug}/materials`)
    info.value = data.data
    list.value = data.data?.list || []
  } catch (e) { error.value = e.message || '网络异常' } finally { loading.value = false }
}
function goCard() { router.push(`/c/${route.params.slug}`) }
function safeUrl(u) { try { const x = new URL(u); return ['http:', 'https:'].includes(x.protocol) ? x.href : '#' } catch { return '#' } }
function fullUrl(u) { return u ? new URL(u, location.origin).href : '' }
function copy(v, label) {
  navigator.clipboard.writeText(v).then(() => showToast(`${label}已复制`, 'success')).catch(() => showToast('复制失败', 'error'))
}
async function countView(m) {
  try { await api.post(`/api/cards/public/materials/${m.id}/view`) } catch { /* 计数失败不影响查看 */ }
}
onMounted(load)
</script>

<style scoped>
.mv-page { min-height: 100vh; background: var(--bg-page, #f4f6fb); padding-bottom: 40px; }
.mv-top { height: calc(52px + env(safe-area-inset-top, 0px)); display: flex; align-items: center; gap: 12px; padding: env(safe-area-inset-top, 0px) 16px 0; background: var(--bg-card, #fff); border-bottom: 1px solid var(--line, #e8edf4); }
.mv-back { width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; color: var(--primary); font-size: 26px; line-height: 1; }
.mv-brand { margin-left: auto; font-weight: 800; font-size: 17px; color: var(--primary); }
.mv-brand em { font-style: normal; opacity: .6; }
.mv-loading { margin-top: 30px; }
.mv-main { padding-top: 16px; }
.mv-head h1 { font-size: 18px; margin: 0 0 6px; }
.mv-item { margin-top: 12px; }
.mv-item-head { display: flex; align-items: center; gap: 12px; }
.mv-type { font-size: 22px; }
.mv-item-title { flex: 1; min-width: 0; }
.mv-item-title b { display: block; font-size: 15px; }
.mv-item-body { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }

</style>
