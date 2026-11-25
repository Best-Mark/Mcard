<template>
  <div class="ap-wrap">
    <button type="button" class="ap-trigger" @click="open">{{ label }}<span class="ap-count" v-if="count">{{ count }}</span></button>

    <div v-if="show" class="ap-mask" @click.self="show = false">
      <div class="ap-panel">
        <div class="ap-head">
          <b>图片素材库</b>
          <button class="ap-close" aria-label="关闭" @click="show = false">✕</button>
        </div>
        <p class="small muted ap-tip">{{ multiple ? '点图片多选，选好点「确定」；可继续上传新图。' : '点一张图片选用；可继续上传新图。' }}素材上限 {{ assetMax }} 张，正在使用的图片需先替换才能删除。</p>
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
          <div v-for="a in assets" :key="a.id" class="ap-item" :class="{ on: isPicked(a) }" @click="choose(a)">
            <img :src="a.url" :alt="a.name" loading="lazy" />
            <span v-if="isPicked(a)" class="ap-picked">✓</span>
            <span class="ap-del" role="button" aria-label="移除素材" @click.stop="remove(a)">✕</span>
          </div>
        </div>
        <div v-if="multiple" class="ap-foot">
          <button class="btn btn-sm btn-ghost" @click="show = false">取消</button>
          <button class="btn btn-sm btn-primary" :disabled="!picked.length" @click="confirm">确定（{{ picked.length }}）</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import api from '../api'
import { showToast } from '../store'

// multiple=false（默认）：单选，点图即回写并关闭，LOGO 等旧调用点无需改动。
// multiple=true：多选，点图切换选中态，点「确定」才回写数组；取消不改动外部值。
const props = defineProps({
  modelValue: { type: [String, Array], default: '' },
  label: { type: String, default: '素材库' },
  multiple: { type: Boolean, default: false },
  max: { type: Number, default: 20 }
})
const emit = defineEmits(['update:modelValue'])
const show = ref(false)
const loading = ref(false)
const uploading = ref(false)
const assets = ref([])
const picked = ref([])
const assetMax = ref(50) // 从服务端 GET /api/assets 的 max 读取（唯一真相源）
const count = computed(() => props.multiple ? (Array.isArray(props.modelValue) ? props.modelValue.length : 0) : (props.modelValue ? 1 : 0))

async function load() {
  loading.value = true
  try {
    const d = (await api.get('/api/assets')).data.data || {}
    assets.value = d.list || []
    if (d.max) assetMax.value = d.max
    picked.value = props.multiple ? [...(Array.isArray(props.modelValue) ? props.modelValue : [])] : []
  } catch (e) { showToast(e.message || '加载素材失败', 'error') } finally { loading.value = false }
}
function open() { show.value = true; load() }
function isPicked(a) { return props.multiple ? picked.value.includes(a.url) : props.modelValue === a.url }
function choose(a) {
  if (!props.multiple) {
    emit('update:modelValue', a.url)
    show.value = false
    showToast('已选用素材，记得点保存', 'success')
    return
  }
  const i = picked.value.indexOf(a.url)
  if (i >= 0) picked.value.splice(i, 1)
  else if (picked.value.length >= props.max) { showToast(`最多选 ${props.max} 张`, 'error'); return }
  else picked.value.push(a.url)
}
function confirm() { emit('update:modelValue', [...picked.value]); show.value = false }
async function onUpload(e) {
  const file = e.target.files?.[0]
  if (!file) return
  uploading.value = true
  try {
    const fd = new FormData()
    fd.append('file', file)
    const { data } = await api.post('/api/assets/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    const a = data.data
    assets.value.unshift({ id: a.id, url: a.url, name: a.name, width: a.width, height: a.height })
    // 新上传的图直接选中，省一次点击（多选达上限时不强行塞入）
    if (props.multiple && picked.value.length < props.max) picked.value.push(a.url)
    showToast(data.converted ? '已上传并自动压缩' : '已上传', 'success')
  } catch (err) { showToast(err.message || '上传失败', 'error') } finally { uploading.value = false; e.target.value = '' }
}
async function remove(a) {
  try {
    await api.delete(`/api/assets/${a.id}`)
    assets.value = assets.value.filter(x => x.id !== a.id)
    picked.value = picked.value.filter(u => u !== a.url)
    showToast('已移除素材', 'success')
  } catch (e) { showToast(e.message || '删除失败', 'error') }
}
</script>

<style scoped>
.ap-wrap { display: inline-block; }
.ap-trigger { font-size: 12px; padding: 5px 10px; border: 1px dashed var(--line, #e8edf4); border-radius: 8px; background: transparent; color: var(--primary, #2563eb); cursor: pointer; }
.ap-count { margin-left: 4px; font-size: 10px; background: var(--primary, #2563eb); color: #fff; border-radius: 999px; padding: 1px 6px; }
/* 全屏弹层用四边定位（老 WebView 不认 inset:0），层级高于 tabbar(110) */
.ap-mask { position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 300; background: rgba(0,0,0,.55); display: grid; place-items: center; padding: 18px; }
.ap-panel { width: 100%; max-width: 520px; max-height: 82vh; overflow-y: auto; overscroll-behavior: contain; background: var(--bg-card, #fff); border-radius: 16px; padding: 18px; }
.ap-head { display: flex; align-items: center; justify-content: space-between; }
.ap-head b { font-size: 16px; }
.ap-close { border: 0; background: transparent; font-size: 18px; cursor: pointer; }
.ap-tip { margin: 6px 0 10px; }
.ap-actions { display: flex; gap: 8px; margin-bottom: 12px; }
.ap-upload { flex: 1; text-align: center; font-size: 13px; padding: 9px; border-radius: 9px; background: var(--primary, #2563eb); color: #fff; cursor: pointer; }
.ap-upload input { display: none; }
.ap-refresh { font-size: 13px; padding: 9px 14px; border-radius: 9px; border: 1px solid var(--line, #e8edf4); background: transparent; cursor: pointer; }
.ap-state { text-align: center; color: var(--muted, #6b7688); padding: 30px 10px; font-size: 13px; }
.ap-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.ap-item { position: relative; aspect-ratio: 1; border-radius: 10px; overflow: visible; border: 2px solid transparent; cursor: pointer; background: var(--bg-page, #f4f6fb); }
.ap-item.on { border-color: var(--primary, #2563eb); }
.ap-item img { width: 100%; height: 100%; object-fit: cover; border-radius: 8px; display: block; }
.ap-picked { position: absolute; left: 4px; bottom: 4px; width: 20px; height: 20px; border-radius: 50%; background: var(--primary, #2563eb); color: #fff; font-size: 12px; display: grid; place-items: center; }
.ap-del { position: absolute; top: -6px; right: -6px; width: 20px; height: 20px; line-height: 18px; text-align: center; border-radius: 50%; background: #ef4444; color: #fff; font-size: 12px; }
.ap-foot { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--line, #e8edf4); }
</style>
