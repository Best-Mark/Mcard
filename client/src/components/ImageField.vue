<template>
  <!-- 通用图片上传字段：预览 + 点击上传 + 移除；上传走 /api/upload（服务端统一压 WebP）。 -->
  <div class="if">
    <span class="if-label">{{ label }}</span>
    <div class="if-row">
      <img v-if="modelValue" :src="modelValue" class="if-thumb" alt="图片预览" />
      <div v-else class="if-empty">＋</div>
      <div class="if-ops">
        <button type="button" class="if-btn" :disabled="busy" @click="pick">{{ busy ? '上传中…' : (modelValue ? '更换图片' : '上传图片') }}</button>
        <button v-if="modelValue" type="button" class="if-btn ghost" @click="$emit('update:modelValue', '')">移除</button>
      </div>
    </div>
    <input ref="fileEl" type="file" accept="image/png,image/jpeg,image/webp,image/gif" style="display:none" @change="onFile" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import api from '../api'
import { showToast } from '../store'

defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue'])
const fileEl = ref(null)
const busy = ref(false)

function pick() { fileEl.value?.click() }
async function onFile(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  busy.value = true
  try {
    const fd = new FormData()
    fd.append('file', file)
    const { data } = await api.post('/api/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    if (data?.data?.url) emit('update:modelValue', data.data.url)
    else showToast('上传失败：未返回地址', 'error')
  } catch (err) { showToast(err?.message || '上传失败', 'error') } finally { busy.value = false }
}
</script>

<style scoped>
.if { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #374151; font-weight: 600; }
.if-row { display: flex; align-items: center; gap: 10px; }
.if-thumb { width: 72px; height: 72px; object-fit: cover; border-radius: 10px; border: 1px solid var(--line); }
.if-empty { width: 72px; height: 72px; border: 2px dashed var(--line); border-radius: 10px; display: grid; place-items: center; font-size: 24px; color: #9ca3af; }
.if-ops { display: flex; flex-direction: column; gap: 6px; }
.if-btn { padding: 7px 12px; border: 1px solid var(--line); border-radius: 9px; background: #fff; font-size: 12px; font-weight: 700; cursor: pointer; color: var(--primary, #a62b2b); }
.if-btn.ghost { color: #6b7280; }
.if-btn:disabled { opacity: .55; cursor: wait; }
</style>
