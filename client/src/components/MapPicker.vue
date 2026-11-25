<template>
  <div class="mp-wrap">
    <div class="mp-search-row">
      <div class="mp-input-wrap">
        <input
          v-model="query"
          class="input mp-search"
          placeholder="搜索地址 / 地标，输入即联想"
          autocomplete="off"
          @input="onInput"
          @keyup.enter="onEnter"
          @focus="onFocus"
        />
        <!-- POI 联想下拉：点到建议直接把地图飞过去，坐标最终仍以「用这里」的地图中心为准 -->
        <div v-if="suggestOpen && suggestions.length" class="mp-suggest">
          <button
            v-for="(p, i) in suggestions"
            :key="i"
            class="mp-suggest-item"
            @mousedown.prevent="pickSuggestion(p)"
            @touchstart.prevent="pickSuggestion(p)"
          >
            <span class="mp-sg-name">{{ p.name }}</span>
            <span class="mp-sg-addr">{{ [p.district, p.address].filter(Boolean).join(' ') }}</span>
          </button>
        </div>
        <div v-else-if="suggestOpen && searching" class="mp-suggest mp-suggest-loading">搜索中…</div>
      </div>
      <button class="btn btn-sm btn-primary" :disabled="loading" @click="useHere">用这里</button>
    </div>
    <div class="mp-map-wrap">
      <div ref="mapEl" class="mp-map"></div>
      <!-- 选点指针固定在地图正中心（相对地图容器，不受搜索栏高度影响） -->
      <div class="mp-cross" aria-hidden="true">＋</div>
      <!-- 左下角悬浮「回到原点」定位钮（参照 SMARTBNB 的当前位置钮：纯图标+文字，不占搜索行） -->
      <button v-if="hasOrigin" class="mp-locate" :disabled="loading" title="回到本次选点的出发点" @click="backToOrigin">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
          <circle cx="12" cy="12" r="10.5" />
          <line x1="12" y1="1.5" x2="12" y2="9" />
          <line x1="12" y1="15" x2="12" y2="22.5" />
          <line x1="1.5" y1="12" x2="9" y2="12" />
          <line x1="15" y1="12" x2="22.5" y2="12" />
          <line x1="10.5" y1="4.5" x2="13.5" y2="4.5" />
          <line x1="4.5" y1="10.5" x2="4.5" y2="13.5" />
          <line x1="19.5" y1="10.5" x2="19.5" y2="13.5" />
          <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
        </svg>
        <span>当前位置</span>
      </button>
    </div>
    <div class="mp-hint small muted">拖动地图让十字准星对准位置，点「用这里」确认</div>
    <div v-if="centerHint" class="mp-center small">{{ centerHint }}</div>
    <div v-if="error" class="mp-error small">{{ error }}</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import api from '../api'
import { getCurrentPosition } from '../utils/geo'

// 地图选点（H5）——参照 smart-bnb 的成熟做法：
// ① 底图用高德瓦片（国内可达，实测 OSM tile.openstreetmap.org 在国内超时导致空白灰底）；
// ② 高德瓦片是 GCJ-02，与名片存库口径一致，全链路不再做 WGS84↔GCJ02 转换；
// ③ 初始中心：已有坐标 > 按已填地区正解 > 当前定位 > 中国中心占位（绝不写死北京）；
// ④ 地址输入走后端 /api/geo/poi/search（高德 place/text，key 不下发前端）做联想，点击飞到该点。
const props = defineProps({
  lat: { type: Number, default: null },
  lng: { type: Number, default: null },
  region: { type: String, default: '' } // 已填省市区文本，用于无坐标时推导中心
})
const emit = defineEmits(['confirm', 'close'])

const mapEl = ref(null)
const query = ref('')
const searching = ref(false)
const loading = ref(true)
const error = ref('')
const centerHint = ref('')
const suggestions = ref([])
const suggestOpen = ref(false)
let map = null
let L = null
let touched = false    // 用户是否拖动/搜索/点过 POI（未定位不允许确认）
let startReady = false // 初始中心是否可信（来自已存坐标或定位/正解）
let suggestTimer = null
let suggestSeq = 0     // 联想请求序号，防竞态（旧响应不得覆盖新结果）

const CHINA_CENTER = { lat: 35.8617, lng: 104.1954, zoom: 4 }
// 原点 = 调用方传入的坐标（集市=当前搜索原点；名片编辑=名片原坐标）。有原点才显示「回到原点」按钮。
const hasOrigin = computed(() => Number.isFinite(props.lat) && Number.isFinite(props.lng))

function backToOrigin() {
  if (!map || !hasOrigin.value) return
  map.flyTo([props.lat, props.lng], 15, { duration: 0.5 })
  touched = false
  centerHint.value = '已回到原点，可拖动微调后点「用这里」'
  error.value = ''
  closeSuggest()
}

async function resolveStartCenter() {
  // 1) 已填省市区优先：用户前面选了地区，选点就必须按地区进来（而不是沿用名片里可能错误的旧坐标）
  const region = String(props.region || '').trim()
  if (region) {
    try {
      const { data } = await api.get('/api/geo/geocode', { params: { address: region }, timeout: 5000 })
      const g = data?.data
      if (g && Number.isFinite(Number(g.lat)) && Number.isFinite(Number(g.lng))) {
        return { lat: Number(g.lat), lng: Number(g.lng), zoom: 15, hint: `已按「${region}」定位（已有坐标不作为初始位置），请拖动微调`, fromSaved: false }
      }
    } catch { /* 正解失败退回已有坐标 */ }
  }
  // 2) 已有坐标（库里 GCJ-02，高德瓦片同坐标系，直接用）
  if (Number.isFinite(props.lat) && Number.isFinite(props.lng)) {
    return { lat: props.lat, lng: props.lng, zoom: 15, hint: '已用名片原有位置，可拖动微调', fromSaved: true }
  }
  // 3) 当前定位（geo.js 四级降级，统一 GCJ-02，带超时兜底）
  try {
    const pos = await Promise.race([
      getCurrentPosition({ timeout: 3500 }),
      new Promise(resolve => setTimeout(() => resolve(null), 4000))
    ])
    if (pos && Number.isFinite(pos.lat) && Number.isFinite(pos.lng)) {
      return { lat: pos.lat, lng: pos.lng, zoom: 14, hint: '已按当前定位，可拖动微调', fromSaved: false }
    }
  } catch { /* 定位失败走中国中心占位 */ }
  // 4) 都没有 → 中国中心占位，强制提示
  return { ...CHINA_CENTER, hint: '未定位到具体城市：请搜索地址或拖动地图到实际位置，再点「用这里」', fromSaved: false }
}

async function initMap() {
  loading.value = true; error.value = ''; centerHint.value = ''
  touched = false
  startReady = false
  const start = await resolveStartCenter()
  startReady = !!start.fromSaved || /已按/.test(start.hint || '')
  centerHint.value = start.hint
  try {
    map = L.map(mapEl.value, { zoomControl: true, attributionControl: true }).setView([start.lat, start.lng], start.zoom)
    // 高德矢量瓦片（GCJ-02，国内稳定）：style=8 为标准路网图
    L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
      subdomains: ['1', '2', '3', '4'],
      maxZoom: 18,
      attribution: '&copy; 高德地图'
    }).addTo(map)
    map.on('dragend', () => { touched = true; centerHint.value = ''; closeSuggest() })
    loading.value = false
  } catch (e) {
    error.value = '地图加载失败，请检查网络'
    loading.value = false
  }
}

function useHere() {
  if (!map) return
  if (!touched && !startReady) {
    error.value = '请先把地图拖动到你的实际位置（或搜索地址）再点「用这里」，否则会存入错误的默认位置'
    return
  }
  const c = map.getCenter()
  // 高德瓦片 = GCJ-02，与名片库/小程序定位一致，直接存
  emit('confirm', { lat: Number(c.lat.toFixed(6)), lng: Number(c.lng.toFixed(6)) })
}

// ---------- POI 联想 ----------
function closeSuggest() { suggestOpen.value = false; suggestions.value = [] }

function onFocus() {
  if (suggestions.value.length) suggestOpen.value = true
}

function onInput() {
  clearTimeout(suggestTimer)
  const q = query.value.trim()
  if (!q) { closeSuggest(); return }
  error.value = ''
  const seq = ++suggestSeq
  suggestTimer = setTimeout(async () => {
    searching.value = true
    suggestOpen.value = true
    try {
      const { data } = await api.get('/api/geo/poi/search', { params: { keyword: q, city: '' }, timeout: 5000 })
      if (seq !== suggestSeq) return // 过期响应丢弃
      suggestions.value = data?.data?.list || []
      if (!suggestions.value.length) error.value = '未找到相关地点，可直接拖动地图选点'
    } catch {
      if (seq !== suggestSeq) return
      suggestions.value = []
      error.value = '搜索服务暂不可用，请直接拖动地图选点'
    } finally {
      if (seq === suggestSeq) searching.value = false
    }
  }, 350) // 350ms 防抖，参照 smart-bnb
}

function onEnter() {
  clearTimeout(suggestTimer)
  if (suggestions.value.length) pickSuggestion(suggestions.value[0])
}

function pickSuggestion(p) {
  if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return
  query.value = p.name
  closeSuggest()
  touched = true
  centerHint.value = ''
  error.value = ''
  map?.flyTo([p.lat, p.lng], 16, { duration: 0.6 })
}

onMounted(async () => {
  // 动态引入 leaflet：只在用户打开地图选点时加载，不进编辑页首屏包
  try {
    L = (await import('leaflet')).default
    await import('leaflet/dist/leaflet.css')
    initMap()
  } catch {
    error.value = '地图组件加载失败，请稍后重试'
    loading.value = false
  }
})
onBeforeUnmount(() => {
  clearTimeout(suggestTimer)
  if (map) { map.remove(); map = null }
})
</script>

<style scoped>
.mp-wrap { position: relative; }
.mp-search-row { display: flex; gap: 8px; margin-bottom: 8px; }
.mp-input-wrap { position: relative; flex: 1; min-width: 0; }
.mp-search { width: 100%; }
.mp-suggest { position: absolute; left: 0; right: 0; top: calc(100% + 4px); z-index: 30; max-height: 240px; overflow-y: auto; background: var(--bg-card, #fff); border: 1px solid var(--line, #e8edf4); border-radius: 10px; box-shadow: 0 8px 24px rgba(15,23,42,.14); }
.mp-suggest-item { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; width: 100%; padding: 9px 12px; text-align: left; border-bottom: 1px solid var(--line, #eef2f7); }
.mp-suggest-item:last-child { border-bottom: 0; }
.mp-sg-name { font-size: 13px; font-weight: 600; color: var(--text, #0f172a); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.mp-sg-addr { font-size: 11px; color: var(--muted, #6b7688); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.mp-suggest-loading { padding: 10px 12px; font-size: 12px; color: var(--muted, #6b7688); }
.mp-map-wrap { position: relative; }
.mp-map { height: 320px; border-radius: 10px; border: 1px solid var(--line, #e8edf4); background: #eef2f7; }
.mp-cross { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-size: 36px; line-height: 1; color: #dc2626; text-shadow: 0 1px 4px #fff, 0 0 2px #fff; pointer-events: none; font-weight: 700; z-index: 500; }
/* 回到原点：地图左下角悬浮定位钮（对齐 SMARTBNB 当前位置钮：纯图标 + 白字阴影，无按钮框） */
.mp-locate { position: absolute; left: 12px; bottom: 16px; z-index: 500; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 0; border: 0; background: transparent; color: #22c55e; cursor: pointer; }
.mp-locate:disabled { opacity: .5; }
.mp-locate span { font-size: 10px; line-height: 1; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,.6); white-space: nowrap; }
.mp-hint { margin-top: 6px; }
.mp-center { margin-top: 6px; padding: 6px 9px; border-radius: 8px; background: #eff6ff; color: #2563eb; line-height: 1.5; }
.mp-error { margin-top: 6px; color: #b45309; }
</style>
