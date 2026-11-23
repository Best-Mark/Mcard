<template>
  <div class="logo-uploader">
    <div class="hint small">支持 PNG / JPG / WebP / GIF / SVG。系统会自动识别背景色并转成透明底 PNG，不需要你事先处理图片。</div>

    <div class="picks">
      <label class="pick">
        <input type="file" accept="image/*,.svg" @change="onFile" />
        <span>{{ busy ? '处理中…' : (original ? '重新选择文件' : '选择 LOGO 文件') }}</span>
      </label>
      <button v-if="original" class="btn btn-sm btn-ghost" :disabled="busy" @click="reprocess">按当前参数重新处理</button>
    </div>

    <div v-if="busy" class="tip">正在去底并生成透明 PNG，请稍候…</div>

    <template v-if="processed">
      <div class="mode-row">
        <button v-for="m in modes" :key="m.k" class="btn btn-sm" :class="mode === m.k ? 'btn-primary' : 'btn-ghost'" @click="mode = m.k">{{ m.t }}</button>
      </div>
      <div v-if="mode !== 'none'" class="slider-row">
        <label>去底强度 {{ tolerance }}</label>
        <input v-model.number="tolerance" type="range" min="0" max="90" @change="reprocess" />
        <span class="small muted">颜色相近度越高，去掉的背景越多；保留细节可调低</span>
      </div>

      <div class="previews">
        <div class="preview-box">
          <div class="checker"><img v-if="original" :src="original" alt="原图" /></div>
          <span>原图</span>
        </div>
        <div class="preview-box">
          <div class="checker"><img :src="processed" alt="处理后" /></div>
          <span>透明底处理后</span>
        </div>
      </div>

      <div class="result-line small">
        输出 {{ result.width }}×{{ result.height }}px · {{ result.transparent ? '已生成透明背景' : '未检测到可去除背景' }}
      </div>
      <button class="btn btn-primary btn-block" @click="apply">使用这张 LOGO</button>
    </template>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import api from '../api'
import { showToast } from '../store'

const props = defineProps({ modelValue: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue'])

const original = ref('')
const processed = ref('')
const result = ref({})
const mode = ref('auto')
const tolerance = ref(32)
const busy = ref(false)
const modes = [
  { k: 'auto', t: '智能识别背景' },
  { k: 'white', t: '只去白底' },
  { k: 'none', t: '保留原图' }
]

async function onFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const fd = new FormData()
  fd.append('file', file)
  fd.append('mode', mode.value)
  fd.append('tolerance', String(tolerance.value))
  await run('/api/upload/logo', fd)
  e.target.value = ''
}

async function reprocess() {
  if (!original.value) return
  await run('/api/upload/logo/process', { sourceUrl: original.value, mode: mode.value, tolerance: tolerance.value })
}

async function run(url, payload) {
  busy.value = true
  try {
    const isForm = payload instanceof FormData
    const { data } = await api.post(url, payload, isForm ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined)
    original.value = data.data.originalUrl || original.value
    processed.value = data.data.url
    result.value = data.data
  } catch (e) { showToast(e.message, 'error') } finally { busy.value = false }
}

function apply() {
  emit('update:modelValue', processed.value)
  showToast('LOGO 已应用，保存资料后生效', 'success')
}
</script>

<style scoped>
.logo-uploader { margin-top: 8px; }
.hint { background: #eff6ff; color: #1e40af; padding: 9px 12px; border-radius: 8px; line-height: 1.6; }
.picks { display: flex; gap: 8px; margin: 10px 0; flex-wrap: wrap; }
.pick { display: inline-flex; align-items: center; padding: 8px 14px; border-radius: 9px; background: #eef2f7; font-size: 13px; font-weight: 600; cursor: pointer; position: relative; overflow: hidden; }
.pick input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.tip { font-size: 12px; color: var(--muted); margin-bottom: 8px; }
.mode-row { display: flex; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; }
.slider-row { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
.slider-row input { width: 100%; }
.previews { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.preview-box { text-align: center; font-size: 12px; color: var(--muted); }
.checker { height: 120px; border: 1px solid var(--line); border-radius: 10px; display: grid; place-items: center; overflow: hidden;
  background-image: linear-gradient(45deg,#e5e7eb 25%,transparent 25%),linear-gradient(-45deg,#e5e7eb 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e5e7eb 75%),linear-gradient(-45deg,transparent 75%,#e5e7eb 75%);
  background-size: 16px 16px; background-position: 0 0,0 8px,8px -8px,-8px 0; }
.checker img { max-width: 92%; max-height: 92%; object-fit: contain; }
.result-line { margin: 8px 0; color: var(--muted); }
</style>
