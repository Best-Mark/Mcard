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
    <div v-if="error" class="mp-error small">{{ error }}</div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  lat: { type: Number, default: 39.9042 },
  lng: { type: Number, default: 116.4074 }
})
const emit = defineEmits(['confirm', 'close'])

const mapEl = ref(null)
const query = ref('')
const searching = ref(false)
const loading = ref(true)
const error = ref('')
let map = null
let L = null

function initMap() {
  loading.value = true; error.value = ''
  try {
    map = L.map(mapEl.value, { zoomControl: true, attributionControl: true }).setView([props.lat, props.lng], 13)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map)
    loading.value = false
  } catch (e) {
    error.value = '地图加载失败，请检查网络'
    loading.value = false
  }
}

function useHere() {
  if (!map) return
  const c = map.getCenter()
  emit('confirm', { lat: Number(c.lat.toFixed(6)), lng: Number(c.lng.toFixed(6)) })
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
.mp-error { margin-top: 6px; color: #b45309; }
</style>
