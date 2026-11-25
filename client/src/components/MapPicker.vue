<template>
  <div class="mp-wrap">
    <div class="mp-tools">
      <input v-model="query" class="input mp-search" placeholder="搜索地址 / 地标（选填）" @keyup.enter="search" />
      <button class="btn btn-sm" :disabled="searching" @click="search">{{ searching ? '搜索中…' : '搜索' }}</button>
      <button class="btn btn-sm btn-primary" :disabled="loading" @click="useHere">用这里</button>
    </div>
    <div ref="mapEl" class="mp-map"></div>
    <div class="mp-cross" aria-hidden="true">＋</div>
    <div class="mp-hint small muted">拖动地图让十字准星对准位置，点「用这里」确认</div>
    <div v-if="centerHint" class="mp-center small">{{ centerHint }}</div>
    <div v-if="error" class="mp-error small">{{ error }}</div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import api from '../api'
import { wgs84ToGcj02, gcj02ToWgs84 } from '../utils/geo-coord'

// ⚠️ 地图默认中心绝不写死北京：历史 bug——没定位就开地图直接点「用这里」会把北京坐标存进名片，
// 但地址文本是用户填的其它城市 → 导航把人带到北京。坐标来源优先级：已有坐标 > 按省市区正解 > 中国中心（仅占位）。
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
let map = null
let L = null
let touched = false   // 用户是否拖动/搜索过地图
let startReady = false // 初始中心是否可信（来自已存坐标）

// 中国中心仅作占位：未定位到具体城市时给出明确提示，避免误把默认点当成用户位置
const CHINA_CENTER = { lat: 35.8617, lng: 104.1954 }

async function resolveStartCenter() {
  // 1) 已有坐标（库中 GCJ-02）→ 反解为 WGS84 给 OSM
  if (Number.isFinite(props.lat) && Number.isFinite(props.lng)) {
    return { ...gcj02ToWgs84(props.lat, props.lng), zoom: 15, hint: '', fromSaved: true }
  }
  // 2) 已填省市区 → 正解（后端返回 GCJ-02）→ 反解为 WGS84
  const region = String(props.region || '').trim()
  if (region) {
    try {
      const { data } = await api.get('/api/geo/geocode', { params: { address: region }, timeout: 5000 })
      const g = data?.data
      if (g && Number.isFinite(Number(g.lat)) && Number.isFinite(Number(g.lng))) {
        return { ...gcj02ToWgs84(Number(g.lat), Number(g.lng)), zoom: 14, hint: `已按「${region}」定位，请拖动微调到具体位置`, fromSaved: false }
      }
    } catch { /* 正解失败走中国中心占位 */ }
  }
  // 3) 都没有 → 中国中心，且强制提示（不写死任何具体城市）
  return { ...CHINA_CENTER, zoom: 4, hint: '未定位到具体城市：请先搜索地址或拖动地图到你的实际位置，再点「用这里」', fromSaved: false }
}

async function initMap() {
  loading.value = true; error.value = ''; centerHint.value = ''
  touched = false
  const start = await resolveStartCenter()
  startReady = !!start.fromSaved
  centerHint.value = start.hint
  try {
    map = L.map(mapEl.value, { zoomControl: true, attributionControl: true }).setView([start.lat, start.lng], start.zoom)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map)
    map.on('dragend', () => { touched = true; centerHint.value = '' })
    loading.value = false
  } catch (e) {
    error.value = '地图加载失败，请检查网络'
    loading.value = false
  }
}

function useHere() {
  if (!map) return
  // 只有「已有坐标」或「用户主动拖动/搜索」才算可信定位；中国中心/省市区正解占位不可直接确认
  if (!touched && !startReady) {
    error.value = '请先把地图拖动到你的实际位置（或搜索地址）再点「用这里」，否则会存入错误的默认位置'
    return
  }
  const c = map.getCenter()
  // Leaflet + OSM 瓦片是 WGS84，必须转 GCJ-02 才能与名片库/小程序定位一致，否则集市距离偏 300~700m
  const g = wgs84ToGcj02(c.lat, c.lng)
  emit('confirm', { lat: Number(g.lat.toFixed(6)), lng: Number(g.lng.toFixed(6)) })
}

async function search() {
  const q = query.value.trim()
  if (!q || searching.value) return
  searching.value = true; error.value = ''
  try {
    // Nominatim 公共地理编码，无需 Key；国内访问较慢，失败不阻断手动拖拽
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`
    const res = await fetch(url, { headers: { 'Accept-Language': 'zh-CN' } })
    const rows = await res.json()
    if (rows?.length) {
      touched = true
      centerHint.value = ''
      map.flyTo([Number(rows[0].lat), Number(rows[0].lon)], 15, { duration: 1 })
    } else {
      error.value = '未找到该地址，请直接拖动地图选点'
    }
  } catch {
    error.value = '搜索服务暂不可用，请直接拖动地图选点'
  } finally { searching.value = false }
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
onBeforeUnmount(() => { if (map) { map.remove(); map = null } })
</script>

<style scoped>
.mp-wrap { position: relative; }
.mp-tools { display: flex; gap: 8px; margin-bottom: 8px; }
.mp-search { flex: 1; min-width: 0; }
.mp-map { height: 320px; border-radius: 10px; border: 1px solid var(--line, #e8edf4); background: #e8edf4; }
.mp-cross { position: absolute; left: 50%; top: calc(50% + 20px); transform: translate(-50%, -50%); font-size: 30px; color: #dc2626; text-shadow: 0 1px 3px #fff; pointer-events: none; font-weight: 700; }
.mp-hint { margin-top: 6px; }
.mp-center { margin-top: 6px; padding: 6px 9px; border-radius: 8px; background: #eff6ff; color: #2563eb; line-height: 1.5; }
.mp-error { margin-top: 6px; color: #b45309; }
</style>
