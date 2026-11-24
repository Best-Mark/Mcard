<template>
  <div class="ap-wrap">
    <button type="button" class="ap-trigger" @click="open">{{ label }}<span class="ap-count" v-if="assets.length">{{ assets.length }}</span></button>

    <div v-if="show" class="ap-mask" @click.self="show = false">
      <div class="ap-panel">
        <div class="ap-head">
          <b>图片素材库</b>
          <button class="ap-close" @click="show = false">✕</button>
        </div>
        <div class="ap-actions">
          <label class="ap-upload">
            <input type="file" accept="image/*" @change="onUpload" />
            {{ uploading ? '上传中…' : '上传图片' }}
          </label>
          <button class="ap-refresh" :disabled="loading" @click="load">刷新</button>
        </div>
        <div v-if="loading" class="ap-state">加载中…</div>
        <div v-else-if="!assets.length" class="ap-state">还没有素材，点上方上传一张。</div>
        <div v-else class="ap-grid">
          <div v-for="a in assets" :key="a.id" class="ap-item" :class="{ on: modelValue === a.url }" @click="choose(a)">
            <img :src="a.url" :alt="a.name" loading="lazy" />
            <span class="ap-del" @click.stop="remove(a)">✕</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api'
import { showToast } from '../store'

const props = defineProps({ modelValue: { type: String, default: '' }, label: { type: String, default: '素材库' } })
const emit = defineEmits(['update:modelValue'])
const show = ref(false)
const loading = ref(false)
const uploading = ref(false)
const assets = ref([])

async function load() {
  loading.value = true
  try { assets.value = (await api.get('/api/assets')).data.data?.list || [] }
  catch (e) { showToast(e.message || '加载素材失败', 'error') } finally { loading.value = false }
}
function open() { show.value = true; load() }
function choose(a) { emit('update:modelValue', a.url); show.value = false; showToast('已选用素材，记得点保存', 'success') }
async function onUpload(e) {
  const file = e.target.files?.[0]
  if (!file) return
  uploading.value = true
  try {
    const fd = new FormData()
    fd.append('file', file)
    const { data } = await api.post('/api/assets/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    assets.value.unshift({ id: data.data.id, url: data.data.url, name: data.data.name, width: data.data.width, height: data.data.height })
    showToast(data.data.converted ? '已上传并自动压缩' : '已上传', 'success')
  } catch (err) { showToast(err.message || '上传失败', 'error') } finally { uploading.value = false; e.target.value = '' }
}
async function remove(a) {
  try { await api.delete(`/api/assets/${a.id}`); assets.value = assets.value.filter(x => x.id !== a.id); showToast('已移除素材', 'success') }
  catch (e) { showToast(e.message || '删除失败', 'error') }
}
onMounted(() => { /* 打开时才加载，避免编辑页挂载即请求 */ })
</script>

<style scoped>
.ap-wrap { display: inline-block; }
.ap-trigger { font-size: 12px; padding: 5px 10px; border: 1px dashed var(--line, #e8edf4); border-radius: 8px; background: transparent; color: var(--primary, #2563eb); cursor: pointer; }
.ap-count { margin-left: 4px; font-size: 10px; background: var(--primary, #2563eb); color: #fff; border-radius: 999px; padding: 1px 6px; }
.ap-mask { position: fixed; inset: 0; z-index: 300; background: rgba(0,0,0,.55); display: grid; place-items: center; padding: 18px; }
.ap-panel { width: 100%; max-width: 520px; max-height: 82vh; overflow: auto; background: var(--bg-card, #fff); border-radius: 16px; padding: 18px; }
.ap-head { display: flex; align-items: center; justify-content: space-between; }
.ap-head b { font-size: 16px; }
.ap-close { border: 0; background: transparent; font-size: 18px; cursor: pointer; }
.ap-actions { display: flex; gap: 8px; margin-bottom: 12px; }
.ap-upload { flex: 1; text-align: center; font-size: 13px; padding: 9px; border-radius: 9px; background: var(--primary, #2563eb); color: #fff; cursor: pointer; }
.ap-upload input { display: none; }
.ap-refresh { font-size: 13px; padding: 9px 14px; border-radius: 9px; border: 1px solid var(--line, #e8edf4); background: transparent; cursor: pointer; }
.ap-state { text-align: center; color: var(--muted, #6b7688); padding: 30px 10px; font-size: 13px; }
.ap-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.ap-item { position: relative; aspect-ratio: 1; border-radius: 10px; overflow: visible; border: 2px solid transparent; cursor: pointer; background: var(--bg-page, #f4f6fb); }
.ap-item.on { border-color: var(--primary, #2563eb); }
.ap-item img { width: 100%; height: 100%; object-fit: cover; border-radius: 8px; display: block; }
.ap-del { position: absolute; top: -6px; right: -6px; width: 20px; height: 20px; line-height: 18px; text-align: center; border-radius: 50%; background: #ef4444; color: #fff; font-size: 12px; }
</style>
