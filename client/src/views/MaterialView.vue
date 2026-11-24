<template>
  <div class="mv-page">
    <div class="mv-top">
      <button class="mv-back" @click="router.back ? router.back() : goCard()">‹ 返回</button>
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

        <!-- 每份资料都能看到名片落款二维码：内容是 /c/{slug} 网页 URL，微信扫一扫可直接打开 -->
        <div class="card card-pad mv-owner">
          <div class="mv-owner-ava">{{ (info.owner.name || '名').slice(0, 1) }}</div>
          <div class="mv-owner-info">
            <b>{{ info.owner.name || '名片主人' }}</b>
            <span class="small muted">扫码保存名片 · 资料随时更新，二维码永久不变</span>
          </div>
          <button class="mv-owner-qr" @click="qrOpen = true" title="点击放大">
            <img :src="info.owner.qr" alt="名片二维码" />
          </button>
        </div>
        <p class="mv-tip small muted">用微信「扫一扫」或手机相机扫描上方二维码，即可打开名片并存入通讯录。</p>
      </div>
    </template>

    <div v-if="qrOpen" class="modal-mask" @click.self="qrOpen = false">
      <div class="modal center">
        <h3>{{ info?.owner?.name || '名片' }} 的二维码</h3>
        <img :src="(info?.owner?.qr || '') + '&size=640'" style="width:240px;height:240px;margin:12px auto" alt="二维码大图" />
        <p class="small">微信扫一扫打开名片网页；长按可保存</p>
        <button class="btn btn-ghost" @click="qrOpen = false">关闭</button>
      </div>
    </div>
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
const qrOpen = ref(false)
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
.mv-top { height: 52px; display: flex; align-items: center; gap: 12px; padding: 0 16px; background: var(--bg-card, #fff); border-bottom: 1px solid var(--line, #e8edf4); }
.mv-back { color: var(--primary); font-size: 14px; }
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
.mv-owner { margin-top: 18px; display: flex; align-items: center; gap: 12px; background: linear-gradient(135deg, #1e3a8a, #4f46e5); color: #fff; border: 0; }
.mv-owner-ava { width: 42px; height: 42px; border-radius: 50%; background: rgba(255,255,255,.2); display: grid; place-items: center; font-weight: 700; flex: 0 0 auto; }
.mv-owner-info { flex: 1; min-width: 0; }
.mv-owner-info b { display: block; font-size: 15px; }
.mv-owner-info .small { color: rgba(255,255,255,.8); }
.mv-owner-qr { width: 64px; height: 64px; background: #fff; border-radius: 8px; padding: 4px; flex: 0 0 auto; }
.mv-owner-qr img { width: 100%; height: 100%; }
.mv-tip { text-align: center; margin-top: 10px; }
.modal-mask { position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,.6); display: grid; place-items: center; padding: 20px; }
.modal { background: #fff; border-radius: 16px; padding: 22px; max-width: 340px; width: 100%; color: #162033; }
.modal.center { text-align: center; }
.modal h3 { margin: 0 0 8px; font-size: 16px; }
</style>
