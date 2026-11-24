<template>
  <div class="market-page">
    <header class="topbar market-nav">
      <button class="nav-back" @click="router.back ? router.back() : router.push('/')" aria-label="返回">‹</button>
      <span class="nav-title">名片集市 · 发现对口伙伴</span>
      <button class="nav-menu-btn" aria-label="菜单" @click="toggleDrawer"><i class="menu-glyph"></i></button>
      <router-link to="/me" class="nav-me">我的</router-link>
    </header>

    <div class="mk-hero">
      <p class="mk-slogan">按距离找到附近、业务对口的商务伙伴</p>
      <div class="mk-locate">
        <span class="mk-locate-ico">⌖</span>
        <div class="mk-locate-text">
          <b>{{ locateLabel }} <span v-if="positionMeta.label" class="mk-quality" :class="positionMeta.level">{{ positionMeta.label }}</span></b>
          <span class="small">{{ locateHint }}</span>
        </div>
        <button class="btn btn-sm" :disabled="locating" @click="relocate">{{ locating ? '定位中…' : '重新定位' }}</button>
      </div>
    </div>

    <div class="mk-filters">
      <div class="mk-search">
        <input v-model="keyword" class="input" placeholder="搜姓名 / 公司 / 业务关键词，如「设计」「财税」" @keyup.enter="applyFilter" />
        <button class="btn btn-primary btn-sm" :disabled="loading" @click="applyFilter">搜索</button>
      </div>
      <div v-if="meta.industries.length" class="mk-chips">
        <button class="chip" :class="{ on: !industry }" @click="setIndustry('')">全部</button>
        <button v-for="ind in meta.industries" :key="ind.key" class="chip" :class="{ on: industry === ind.key }" @click="setIndustry(ind.key)">
          {{ ind.icon }} {{ ind.label }}
        </button>
      </div>
      <div class="mk-city-head">
        <span>选择城市：</span>
        <button class="mk-map-btn" :disabled="loading" @click="openMapPicker">⌖ 地图选点</button>
      </div>
      <div class="mk-city-chips">
        <button v-for="c in cityChips" :key="c.name" class="city-chip" :class="{ on: isCityActive(c.name) }" @click="pickCity(c)">
          <span v-if="c.isCurrent" class="current-dot"></span>{{ c.name }}
        </button>
        <button class="city-chip more" :class="{ on: !!province && !isCityActive(city) }" @click="showMoreCity = !showMoreCity">更多 ▾</button>
      </div>
      <div v-if="showMoreCity" class="mk-city-more">
        <select v-model="province" class="select" @change="onProvinceChange">
          <option value="">全部省份</option>
          <option v-for="p in provinceOptions" :key="p.code" :value="p.name">{{ p.name }}</option>
        </select>
        <select v-model="city" class="select" @change="onCityChange">
          <option value="">全部城市</option>
          <option v-for="c in cityOptions" :key="c.name" :value="c.name">{{ c.name }}</option>
        </select>
        <select v-if="districtOptions.length" v-model="district" class="select" @change="applyFilter">
          <option value="">全部区县</option>
          <option v-for="d in districtOptions" :key="d.name" :value="d.name">{{ d.name }}</option>
        </select>
      </div>
      <div class="mk-sort-row">
        <span>排序：</span>
        <button class="sort-btn" :class="{ on: sort === 'distance' }" :disabled="!distanceMode" @click="setSort('distance')">📍 离我最近</button>
        <button class="sort-btn" :class="{ on: sort === 'views' }" @click="setSort('views')">🔥 热度优先</button>
        <span class="mk-radius">
          范围：
          <select v-model.number="radiusKm" class="select select-sm" :disabled="!distanceMode" @change="applyFilter">
            <option :value="0">不限</option>
            <option :value="5">5 km</option>
            <option :value="20">20 km</option>
            <option :value="50">50 km</option>
            <option :value="100">100 km</option>
            <option :value="500">500 km</option>
          </select>
        </span>
      </div>
    </div>

    <div class="container mk-list">
      <div v-if="loading" class="mk-state">正在发现附近名片…</div>
      <div v-else-if="error" class="mk-state">
        <b>加载失败</b><p class="small muted">{{ error }}</p>
        <button class="btn btn-primary btn-sm" @click="load">重试</button>
      </div>
      <template v-else>
        <div class="mk-count small muted">共找到 {{ total }} 张公开名片<span v-if="distanceMode && sort === 'distance'"> · 按距离由近到远</span><span v-else-if="sort === 'views'"> · 按热度排序</span><span v-if="radiusKm > 0"> · {{ radiusKm }} km 内</span></div>
        <div v-if="!list.length" class="mk-empty">
          <div class="mk-empty-ico">⌕</div>
          <b>附近还没有上架的名片</b>
          <p class="small muted">试试切换行业 / 城市，或邀请伙伴在资料页开启「加入名片集市」。</p>
          <router-link to="/me/card" class="btn btn-primary btn-sm">上架我的名片</router-link>
        </div>

        <router-link v-for="c in list" :key="c.slug" :to="'/c/' + c.slug + '?src=market'" class="mk-card">
          <div class="mk-card-top">
            <div class="mk-avatar">
              <img v-if="c.avatar" :src="c.avatar" :alt="c.name" loading="lazy" />
              <span v-else>{{ (c.name || '名').slice(0, 1) }}</span>
            </div>
            <img v-if="c.logo" class="mk-logo" :src="c.logo" :alt="(c.company || '公司') + ' LOGO'" loading="lazy" />
            <div class="mk-ident">
              <div class="mk-name">{{ c.name || c.name_en || '未填写姓名' }}</div>
              <div class="mk-title">{{ [c.title, c.company].filter(Boolean).join(' · ') || '商务伙伴' }}</div>
            </div>
            <span v-if="c.distanceKm != null" class="mk-dist">{{ fmtDist(c.distanceKm) }}</span>
          </div>
          <div class="mk-meta">
            <span v-if="c.industryLabel" class="mk-industry">{{ c.industryLabel }}</span>
            <span v-if="c.city" class="mk-city">⌖ {{ c.city }}</span>
          </div>
          <p v-if="c.bio" class="mk-bio">{{ c.bio }}</p>
          <div v-if="c.tags?.length" class="mk-tags">
            <span v-for="tag in c.tags.slice(0, 4)" :key="tag">{{ tag }}</span>
          </div>
          <div class="mk-card-bottom"><span>查看名片 · 一键存入通讯录</span><span class="mk-arrow">›</span></div>
        </router-link>

        <div v-if="list.length && list.length < total" class="mk-more small muted">已显示 {{ list.length }} / {{ total }}，可缩小筛选范围查看更多</div>
      </template>
    </div>

    <MapPicker v-if="mapPickerOpen" @confirm="onMapPicked" @close="mapPickerOpen = false" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import api from '../api'
import { showToast, toggleDrawer } from '../store'
import { getCurrentPosition, getPositionQualityLabel, setManualPosition } from '../utils/geo'
import { CITIES as FALLBACK_CITIES, HOT_CITIES as FALLBACK_HOT } from '../utils/city-data'
import MapPicker from '../components/MapPicker.vue'

const router = useRouter()
const route = useRoute()
const meta = ref({ industries: [], cities: [], hotCities: [], regions: [] })
const list = ref([])
const total = ref(0)
const loading = ref(true)
const error = ref('')
const keyword = ref('')
const industry = ref('')
const city = ref('')
const province = ref('')
const district = ref('')
const coords = ref(null)
const locating = ref(false)
const positionMeta = ref({ label: '', level: '' })
const currentCity = ref('')          // 定位到的当前城市（标签栏首位）
const showMoreCity = ref(false)
const mapPickerOpen = ref(false)
const sort = ref('distance')
const radiusKm = ref(0)
const distanceMode = computed(() => !!(coords.value || city.value))

const locateLabel = computed(() => {
  if (coords.value) return '已获取你的位置'
  if (city.value) return `以 ${city.value} 为中心`
  return '未定位 · 按热度推荐'
})
const locateHint = computed(() => {
  if (coords.value) return '正在按到你的实际距离排序'
  if (city.value) return '选择城市或重新定位可按距离排序'
  return '点「重新定位」或选择城市以按距离发现伙伴'
})

function fmtDist(km) {
  if (km == null) return ''
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}

async function loadMeta() {
  try {
    const { data } = await api.get('/api/cards/public/market/meta')
    meta.value = data.data
  } catch { /* 元数据失败仅影响筛选项，列表仍可用 */ }
  try {
    const { data } = await api.get('/api/geo/regions')
    meta.value.regions = data?.data?.regions || []
  } catch { /* 区域数据失败不影响基础筛选 */ }
}

// 城市标签栏：当前定位城市排第一（带圆点），其后为热门城市，去重
const cityChips = computed(() => {
  const hot = (meta.value.hotCities?.length ? meta.value.hotCities : FALLBACK_HOT).slice()
  const cur = currentCity.value
  const list = []
  if (cur) list.push({ name: cur, isCurrent: true })
  for (const name of hot) {
    if (list.some(x => x.name === name)) continue
    list.push({ name, isCurrent: false })
  }
  return list
})
function cityOf(name) {
  const all = (meta.value.cities?.length ? meta.value.cities : FALLBACK_CITIES)
  return all.find(c => c.name === name) || all.find(c => c.name.includes(name) || name.includes(c.name)) || null
}
function isCityActive(name) {
  if (coords.value && !city.value) return false // 地图选点模式不高亮城市标签
  return city.value === name || (!!coords.value && currentCity.value === name && !city.value)
}
// 点城市标签：设为原点（城市中心坐标），立即按距离排序
function pickCity(c) {
  showMoreCity.value = false
  city.value = c.name
  province.value = ''
  district.value = ''
  const hit = cityOf(c.name)
  coords.value = hit ? { lat: hit.lat, lng: hit.lng } : null
  if (sort.value === 'views') sort.value = 'distance'
  load()
}
function setSort(s) {
  if (s === 'distance' && !distanceMode.value) return
  sort.value = s
  load()
}
function openMapPicker() { mapPickerOpen.value = true }
function onMapPicked(p) {
  mapPickerOpen.value = false
  if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return
  coords.value = { lat: p.lat, lng: p.lng }
  city.value = ''  // 自定义原点不再按城市名过滤
  province.value = ''
  district.value = ''
  setManualPosition(p.lat, p.lng, '')
  sort.value = 'distance'
  showToast('已按地图选点位置排序', 'success')
  load()
}

// 省级选项（level=1）
const provinceOptions = computed(() => (meta.value.regions || []).filter(r => r.level === 1))
// 城市选项：选中省份后取子级，否则用内置热门城市
const cityOptions = computed(() => {
  if (province.value) {
    const p = (meta.value.regions || []).find(r => r.level === 1 && r.name === province.value)
    return p ? (meta.value.regions || []).filter(r => r.level === 2 && r.parent_code === p.code).map(r => ({ name: r.name })) : []
  }
  return meta.value.cities || []
})
// 区选项：选中城市后取子级
const districtOptions = computed(() => {
  if (!city.value) return []
  const c = (meta.value.regions || []).find(r => r.level === 2 && r.name === city.value)
  return c ? (meta.value.regions || []).filter(r => r.level === 3 && r.parent_code === c.code).map(r => ({ name: r.name })) : []
})
function onProvinceChange() { city.value = ''; district.value = ''; applyFilter() }
function onCityChange() { district.value = ''; applyFilter() }

async function load() {
  loading.value = true; error.value = ''
  try {
    const params = { limit: 40 }
    if (industry.value) params.industry = industry.value
    if (province.value) params.province = province.value
    if (city.value) params.city = city.value
    if (district.value) params.district = district.value
    if (keyword.value.trim()) params.q = keyword.value.trim()
    if (coords.value) { params.lat = coords.value.lat; params.lng = coords.value.lng }
    if (sort.value) params.sort = sort.value
    if (radiusKm.value > 0 && distanceMode.value) params.radiusKm = radiusKm.value
    const { data } = await api.get('/api/cards/public/market', { params })
    list.value = data.data.list
    total.value = data.data.total
  } catch (e) { error.value = e.message } finally { loading.value = false }
}

function applyFilter() { load() }
function setIndustry(key) { industry.value = key; load() }

async function relocate() {
  if (locating.value) return
  locating.value = true
  try {
    // 四级降级：微信 JS-SDK → GPS → IP → 城市兜底，永不为空
    const pos = await getCurrentPosition({ city: city.value || undefined, forceRefresh: true, timeout: 10000 })
    coords.value = { lat: pos.lat, lng: pos.lng }
    positionMeta.value = getPositionQualityLabel()
    if (pos.city && pos.source !== 'default') currentCity.value = pos.city
    if (!city.value && pos.city) city.value = pos.city
    sort.value = 'distance'
    showToast(pos.source === 'default' ? '已用城市中心坐标排序，可点「重新定位」再试' : '定位成功，按附近距离排序', pos.source === 'default' ? 'error' : 'success')
    load()
  } catch (e) {
    showToast(e.message || '定位失败，请改用城市选择', 'error')
  } finally { locating.value = false }
}

onMounted(async () => {
  // 门户首页跳转来的筛选：q=关键词、industry=行业、city=城市(+lat/lng=地图原点)、sort=排序
  const q = String(route.query.q || '').trim()
  if (q) keyword.value = q
  const ind = String(route.query.industry || '').trim()
  if (ind) industry.value = ind
  const cityQ = String(route.query.city || '').trim()
  const latQ = Number(route.query.lat)
  const lngQ = Number(route.query.lng)
  if (Number.isFinite(latQ) && Number.isFinite(lngQ)) coords.value = { lat: latQ, lng: lngQ }

  await loadMeta()
  if (cityQ) {
    city.value = cityQ
    if (!coords.value) {
      const hit = cityOf(cityQ)
      if (hit) coords.value = { lat: hit.lat, lng: hit.lng }
    }
  }
  const sortQ = String(route.query.sort || '')
  if (sortQ === 'views' || sortQ === 'distance') sort.value = sortQ

  // 无 query 城市/坐标时才预热定位；带明确筛选时尊重用户选择，不覆盖原点
  if (!cityQ && !coords.value) {
    try {
      const pos = await getCurrentPosition({})
      coords.value = { lat: pos.lat, lng: pos.lng }
      positionMeta.value = getPositionQualityLabel()
      if (pos.city && pos.source !== 'default') currentCity.value = pos.city
    } catch {}
  }
  load()
})
</script>

<style scoped>
.market-page { min-height: 100vh; background: var(--bg-page, #f4f6fb); padding-bottom: 40px; }
.market-nav { position: sticky; top: 0; z-index: 30; }
.nav-back { border: 0; background: transparent; font-size: 30px; line-height: 1; padding: 0 10px; color: var(--primary, #2563eb); }
.nav-title { flex: 1; font-weight: 700; font-size: 15px; }
.nav-me { font-size: 13px; color: var(--primary, #2563eb); }
.mk-quality { display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 999px; margin-left: 4px; vertical-align: middle; }
.mk-quality.high { background: #16a34a; color: #fff; }
.mk-quality.medium { background: #f59e0b; color: #fff; }
.mk-quality.low { background: rgba(255,255,255,.22); color: #fff; }
.mk-hero { background: linear-gradient(135deg, #1e3a8a, #2563eb 55%, #38bdf8); color: #fff; padding: 18px 16px 20px; }
.mk-slogan { font-size: 16px; font-weight: 700; margin-bottom: 14px; }
.mk-locate { display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.25); border-radius: 14px; padding: 10px 12px; }
.mk-locate-ico { font-size: 22px; }
.mk-locate-text { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.mk-locate-text b { font-size: 14px; }
.mk-locate-text .small { opacity: .85; }
.mk-locate .btn { background: #fff; color: #2563eb; border-color: #fff; }
.mk-filters { background: var(--bg-card, #fff); padding: 14px 16px 12px; border-bottom: 1px solid var(--line, #e8edf4); }
.mk-search { display: flex; gap: 8px; }
.mk-search .input { flex: 1; min-width: 0; }
.mk-chips { display: flex; gap: 8px; overflow-x: auto; margin-top: 12px; padding-bottom: 4px; -webkit-overflow-scrolling: touch; }
.chip { flex-shrink: 0; font-size: 12px; padding: 6px 12px; border-radius: 999px; border: 1px solid var(--line, #e8edf4); background: var(--bg-page, #f4f6fb); color: var(--muted, #6b7688); }
.chip.on { background: var(--primary, #2563eb); border-color: var(--primary, #2563eb); color: #fff; font-weight: 700; }
.mk-city-head { display: flex; align-items: center; justify-content: space-between; margin-top: 13px; font-size: 13px; font-weight: 600; }
.mk-map-btn { font-size: 12px; font-weight: 600; padding: 5px 11px; border-radius: 999px; border: 1px solid var(--primary, #2563eb); background: transparent; color: var(--primary, #2563eb); }
.mk-city-chips { display: flex; gap: 8px; overflow-x: auto; margin-top: 9px; padding-bottom: 4px; -webkit-overflow-scrolling: touch; }
.city-chip { flex-shrink: 0; font-size: 13px; padding: 7px 14px; border-radius: 999px; border: 1px solid var(--line, #e8edf4); background: var(--bg-page, #f4f6fb); color: var(--muted, #6b7688); white-space: nowrap; }
.city-chip.on { background: #16a34a; border-color: #16a34a; color: #fff; font-weight: 700; }
.city-chip.more { border-style: dashed; }
.current-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: currentColor; margin-right: 5px; vertical-align: middle; }
.mk-city-more { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.mk-sort-row { display: flex; align-items: center; gap: 8px; margin-top: 12px; font-size: 12px; flex-wrap: wrap; }
.sort-btn { font-size: 12px; padding: 5px 11px; border-radius: 8px; border: 1px solid var(--line, #e8edf4); background: var(--bg-page, #f4f6fb); color: var(--muted, #6b7688); }
.sort-btn.on { border-color: var(--primary, #2563eb); color: var(--primary, #2563eb); background: color-mix(in srgb, var(--primary, #2563eb) 10%, transparent); font-weight: 700; }
.sort-btn:disabled { opacity: .45; }
.mk-radius { margin-left: auto; display: inline-flex; align-items: center; gap: 5px; color: var(--muted, #6b7688); }
.select { border: 1px solid var(--line, #e8edf4); border-radius: 8px; padding: 6px 10px; background: var(--bg-card, #fff); color: var(--text, #0f172a); }
.select-sm { padding: 4px 8px; font-size: 12px; }
.mk-list { padding-top: 14px; }
.mk-state, .mk-empty { text-align: center; padding: 48px 16px; color: var(--muted, #6b7688); }
.mk-count { margin-bottom: 10px; }
.mk-empty-ico { font-size: 46px; color: #cbd5e1; }
.mk-empty b { display: block; color: var(--text, #0f172a); margin: 8px 0; }
.mk-card { display: block; background: var(--bg-card, #fff); border: 1px solid var(--line, #e8edf4); border-radius: 14px; padding: 14px; margin-bottom: 10px; box-shadow: 0 4px 16px rgba(15,23,42,.05); transition: transform .15s, box-shadow .15s; }
.mk-card:active { transform: scale(.995); }
.mk-card:hover { box-shadow: 0 10px 26px rgba(15,23,42,.1); }
.mk-card-top { display: flex; align-items: center; gap: 10px; }
.mk-avatar { flex: 0 0 52px; height: 52px; border-radius: 12px; overflow: hidden; background: var(--primary, #2563eb); color: #fff; display: grid; place-items: center; font-size: 22px; font-weight: 800; }
.mk-avatar img { width: 100%; height: 100%; object-fit: cover; }
.mk-logo { width: 28px; height: 28px; object-fit: contain; border-radius: 6px; background: rgba(127,127,127,.06); padding: 2px; }
.mk-ident { flex: 1; min-width: 0; }
.mk-name { font-size: 16px; font-weight: 800; }
.mk-title { font-size: 12px; color: var(--muted, #6b7688); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mk-dist { flex-shrink: 0; font-size: 12px; font-weight: 700; color: var(--primary, #2563eb); background: #eef2ff; background: color-mix(in srgb, var(--primary, #2563eb) 12%, transparent); padding: 4px 9px; border-radius: 999px; }
.mk-meta { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.mk-industry { font-size: 11px; padding: 3px 9px; border-radius: 6px; background: #eef2ff; background: color-mix(in srgb, var(--primary, #2563eb) 12%, transparent); color: var(--primary, #2563eb); font-weight: 600; }
.mk-city { font-size: 11px; color: var(--muted, #6b7688); }
.mk-bio { font-size: 13px; color: var(--muted, #6b7688); line-height: 1.55; margin-top: 10px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.mk-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
.mk-tags span { font-size: 11px; padding: 2px 8px; border-radius: 5px; background: var(--bg-page, #f4f6fb); color: var(--muted, #6b7688); }
.mk-card-bottom { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--line, #e8edf4); font-size: 12px; color: var(--primary, #2563eb); font-weight: 600; }
.mk-arrow { font-size: 18px; }
.mk-more { text-align: center; padding: 16px; }
</style>
