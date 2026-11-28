<template>
  <!-- 通用图片字段（2026-11-28 用户定稿「点图即换、去按钮、弹层能小就不大」）：
       点缩略图/＋占位直接选图上传，右上角 × 移除；不再放「更换图片/移除」旁挂按钮。
       上传走 /api/upload（服务端统一压 WebP）。 -->
  <div class="if">
    <span v-if="label" class="if-label">{{ label }}</span>
    <div class="if-box" :class="{ busy }" @click="pick">
      <img v-if="modelValue" :src="modelValue" class="if-thumb" alt="图片预览" />
      <div v-else class="if-empty">＋</div>
      <span v-if="busy" class="if-busy">上传中…</span>
      <button v-else-if="modelValue" type="button" class="if-del" aria-label="移除" @click.stop="$emit('update:modelValue', '')">×</button>
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

function pick() { if (!busy.value) fileEl.value?.click() }
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
.if-label { font-size: 12px; color: #a9afb9; }
.if-box { position: relative; width: 88px; height: 88px; border-radius: 14px; overflow: hidden; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.if-box:active { transform: scale(.97); }
.if-thumb { width: 100%; height: 100%; object-fit: cover; display: block; border-radius: 14px; box-shadow: 0 6px 18px rgba(38,42,51,.10); }
.if-empty { width: 100%; height: 100%; border: 0; border-radius: 14px; display: grid; place-items: center; font-size: 26px; color: #c6cbd3; background: #f5f3f0; }
.if-busy { position: absolute; top: 0; right: 0; bottom: 0; left: 0; display: grid; place-items: center; background: rgba(38,42,51,.5); color: #fff; font-size: 11px; font-weight: 600; border-radius: 14px; }
.if-del { position: absolute; top: 4px; right: 4px; width: 22px; height: 22px; border: 0; border-radius: 50%; background: rgba(38,42,51,.55); color: #fff; font-size: 13px; line-height: 1; cursor: pointer; display: grid; place-items: center; padding: 0; }
</style>
