<template>
  <!-- 我的名片：加载/错误/未创建三态由本页处理；已有名片时整页交给 CardView owner 渲染。
       ⚠️ owner 与公开名片页必须同模板、同内容、同样式，唯一差异是 dock 首按钮「编辑名片」vs「打电话」。
       本页不再画任何名片内容（封面/联系方式/二维码/简介），否则就是两套样式（2026-11-25 用户定稿）。 -->
  <div v-if="loading" class="dash-loading"><div class="card card-pad">加载中…</div></div>
  <div v-else-if="loadError" class="dash-loading">
    <div class="card card-pad center" style="padding:44px 20px">
      <div style="font-size:40px;opacity:.3">⚠️</div>
      <h2 style="margin:10px 0">数据加载失败</h2>
      <p class="muted small">{{ loadError }}</p>
      <button class="btn btn-primary" style="margin-top:16px" :disabled="loading" @click="load">重新加载</button>
    </div>
  </div>
  <div v-else-if="!card" class="dash-loading">
    <div class="card card-pad center" style="padding:44px 20px">
      <div style="font-size:46px;opacity:.25">▤</div>
      <h2 style="margin:10px 0">还没有名片</h2>
      <p class="muted small">创建后即可获得永久二维码，之后换资料不用换码。</p>
      <div style="max-width:320px;margin:20px auto 0">
        <input v-model.trim="newSlug" class="input" placeholder="自定义短码（选填，如 zhangsan）" />
        <button class="btn btn-primary btn-block" style="margin-top:10px" :disabled="busy" @click="createCard">
          {{ busy ? '创建中…' : '立即创建我的名片' }}
        </button>
      </div>
    </div>
  </div>
  <CardView v-else owner :embed-slug="card.slug" />
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api'
import { showToast } from '../store'
import CardView from './CardView.vue'

const card = ref(null)
const loading = ref(true)
const busy = ref(false)
const newSlug = ref('')
const loadError = ref('')
let loadStarted = false

async function load() {
  if (loadStarted && loading.value) return
  loadStarted = true
  loading.value = true
  loadError.value = ''
  try {
    const { data } = await api.get('/api/cards/mine')
    const c = data?.data
    if (!c || typeof c !== 'object') {
      card.value = null
      return
    }
    card.value = c
  } catch (e) { loadError.value = e.message || '网络异常' } finally { loading.value = false }
}
onMounted(load)

async function createCard() {
  if (busy.value) return
  busy.value = true
  try {
    const { data } = await api.post('/api/cards/mine', { slug: newSlug.value })
    card.value = data.data
    showToast('名片已创建，开始完善资料吧', 'success')
  } catch (e) { showToast(e.message, 'error') } finally { busy.value = false }
}
</script>

<style scoped>
.dash-loading { padding-top: 20px; }
</style>
