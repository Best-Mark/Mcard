<template>
  <van-popup v-model:show="visible" position="bottom" :style="{ height: '76vh' }" round class="city-picker">
    <div class="cp-head">
      <div class="cp-title">选择城市 <small>仅市级 · 按拼音首字母查找</small></div>
      <button class="cp-close" aria-label="关闭" @click="visible = false">×</button>
    </div>
    <div class="cp-current" v-if="current">
      <span>当前选择</span><b>{{ current }}</b>
    </div>
    <div class="cp-search">
      <input v-model.trim="keyword" class="input" placeholder="输入城市名或拼音首字母，如「北京」「BJ」" />
      <button class="cp-relocate" :disabled="relocating" @click="emit('relocate')">{{ relocating ? '定位中…' : '⌖ 重新定位' }}</button>
    </div>
    <div class="cp-body" ref="body" @scroll="onScroll">
      <template v-if="filteredGroups.length">
        <div v-for="g in filteredGroups" :key="g.letter" class="cp-group" :data-letter="g.letter">
          <div class="cp-letter">{{ g.letter }}</div>
          <button v-for="c in g.cities" :key="c.name" class="cp-city" :class="{ on: c.name === current }" @click="choose(c)">
            {{ c.name }}
          </button>
        </div>
      </template>
      <div v-else class="cp-empty">没有匹配的城市，试试输入拼音首字母</div>
    </div>
    <div class="cp-index" v-if="!keyword">
      <button v-for="l in ALL_LETTERS" :key="l" :disabled="!letters.includes(l)" :class="{ on: activeLetter === l }" @click="jumpTo(l)">{{ l }}</button>
    </div>
  </van-popup>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { CITIES as FALLBACK } from '../utils/city-data'

const ALL_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

const props = defineProps({
  show: { type: Boolean, default: false },
  current: { type: String, default: '' },
  cities: { type: Array, default: () => [] },
  relocating: { type: Boolean, default: false }
})
const emit = defineEmits(['update:show', 'select', 'relocate'])

const visible = computed({ get: () => props.show, set: v => emit('update:show', v) })
const keyword = ref('')
const activeLetter = ref('')
const body = ref(null)

const source = computed(() => (props.cities?.length ? props.cities : FALLBACK))
const grouped = computed(() => {
  const map = {}
  for (const c of source.value) {
    const letter = String(c.py || c.name || '#').trim().charAt(0).toUpperCase()
    const key = /[A-Z]/.test(letter) ? letter : '#'
    ;(map[key] || (map[key] = [])).push(c)
  }
  return Object.keys(map).sort().map(letter => ({ letter, cities: map[letter] }))
})
const letters = computed(() => grouped.value.map(g => g.letter))
const filteredGroups = computed(() => {
  const q = keyword.value.toUpperCase()
  if (!q) return grouped.value
  return grouped.value
    .map(g => ({ ...g, cities: g.cities.filter(c => c.name.includes(keyword.value) || String(c.py || '').toUpperCase().includes(q)) }))
    .filter(g => g.cities.length)
})

function choose(c) {
  emit('select', c)
  visible.value = false
}
function jumpTo(letter) {
  activeLetter.value = letter
  const el = body.value?.querySelector(`[data-letter="${letter}"]`)
  if (el && body.value) body.value.scrollTop = el.offsetTop - body.value.offsetTop
}
function onScroll() {
  const host = body.value
  if (!host || !letters.value.length) return
  const groups = host.querySelectorAll('[data-letter]')
  let cur = letters.value[0]
  for (const g of groups) {
    if (g.offsetTop - host.offsetTop <= host.scrollTop + 8) cur = g.getAttribute('data-letter')
  }
  activeLetter.value = cur
}
watch(visible, v => { if (v) { keyword.value = ''; nextTick(() => { activeLetter.value = letters.value[0] || '' }) } })
</script>

<style scoped>
.city-picker { padding: 0; }
.cp-head { position: relative; display: flex; align-items: center; padding: 18px 20px 12px; border-bottom: 1px solid #eef1f6; }
.cp-title { font-size: 17px; font-weight: 800; }
.cp-title small { font-size: 11px; font-weight: 400; color: #94a3b8; margin-left: 8px; }
.cp-close { position: absolute; right: 16px; top: 14px; width: 32px; height: 32px; border: 0; border-radius: 50%; background: #f1f5f9; font-size: 20px; color: #64748b; cursor: pointer; }
.cp-current { display: flex; align-items: center; gap: 10px; padding: 10px 20px; background: #eff6ff; font-size: 13px; color: #64748b; }
.cp-current b { color: #1d4ed8; font-size: 15px; }
.cp-search { display: flex; align-items: center; gap: 8px; padding: 12px 20px; }
.cp-search .input { flex: 1; min-width: 0; box-sizing: border-box; }
.cp-relocate { flex-shrink: 0; padding: 8px 10px; border: 1px solid #dbe3ef; border-radius: 8px; background: #fff; color: #2563eb; font-size: 12px; font-weight: 700; cursor: pointer; }
.cp-relocate:disabled { opacity: .5; cursor: wait; }
.cp-body { position: relative; height: calc(76vh - 180px); overflow-y: auto; padding: 0 64px 20px 20px; -webkit-overflow-scrolling: touch; }
.cp-group { margin-bottom: 8px; }
.cp-letter { position: sticky; top: 0; z-index: 1; padding: 6px 0; font-size: 12px; font-weight: 800; color: #2563eb; background: #fff; }
.cp-city { display: block; width: 100%; text-align: left; padding: 11px 4px; border: 0; border-bottom: 1px solid #f3f5f9; background: transparent; font-size: 14px; color: #334155; cursor: pointer; }
.cp-city:hover { color: #1d4ed8; }
.cp-city.on { color: #1d4ed8; font-weight: 700; }
.cp-index { position: absolute; right: 6px; top: 168px; bottom: 12px; display: flex; flex-direction: column; justify-content: center; gap: 0; z-index: 3; }
.cp-index button { width: 24px; padding: 2px 0; border: 0; background: transparent; font-size: 10px; font-weight: 700; color: #2563eb; cursor: pointer; line-height: 1.15; }
.cp-index button:disabled { color: #cbd5e1; cursor: default; }
.cp-index button.on { color: #fff; background: #2563eb; border-radius: 6px; }
.cp-index button:not(:disabled):hover { background: #eff6ff; border-radius: 6px; }
.cp-empty { padding: 40px 0; text-align: center; color: #94a3b8; font-size: 13px; }
</style>
