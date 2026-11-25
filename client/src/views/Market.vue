<template>
  <div class="market-page">
    <header class="topbar market-nav">
      <span class="nav-title">名片集市 · 发现对口伙伴</span>
      <button class="nav-menu-btn" aria-label="菜单" @click="toggleDrawer"><i class="menu-glyph"></i></button>
      <router-link to="/me" class="nav-me">我的</router-link>
    </header>

    <div class="mk-hero">
      <p class="mk-slogan">按距离找到附近、业务对口的商务伙伴</p>
      <div class="mk-locate">
        <span class="mk-locate-ico">⌖</span>
        <div class="mk-locate-text">
          <b>按距离发现附近伙伴 <span v-if="positionMeta.label" class="mk-quality" :class="positionMeta.level">{{ positionMeta.label }}</span></b>
          <span class="small">{{ locateHint }}</span>
        </div>
        <div class="mk-locate-right">
          <b class="mk-cur-city">{{ displayCity }}</b>
          <button class="btn btn-sm" @click="openCityPicker">切换城市</button>
        </div>
      </div>
    </div>

    <div class="mk-filters">
      <div class="mk-search">
        <input v-model="keyword" class="input" placeholder="搜姓名 / 公司 / 业务关键词，如「设计」「财税」" @keyup.enter="applyFilter" />
        <button class="btn btn-primary btn-sm" :disabled="loading" @click="applyFilter">搜索</button>
      </div>
      <div v-if="meta.industries.length" class="mk-chips">
        <ScrollChips>
          <button class="chip" :class="{ on: !industry }" @click="setIndustry('')">全部</button>
          <button v-for="ind in meta.industries" :key="ind.key" class="chip" :class="{ on: industry === ind.key }" @click="setIndustry(ind.key)">
            {{ ind.icon }} {{ ind.label }}
          </button>
        </ScrollChips>
      </div>
      <!-- 搜索范围：原点与范围压成一行。原点本身可点即地图选点（唯一入口），选点弹层内可一键回到原点；范围以原点为圆心。 -->
      <div class="mk-range-box">
        <button class="mk-origin-btn" :disabled="loading" title="点击在地图上选原点" @click="openMapPicker">
          <span class="mk-range-label">原点</span>
          <b class="mk-origin">⌖ {{ originLabel }}</b>
        </button>
        <span class="mk-range-sep"></span>
        <span class="mk-range-label">范围</span>
        <BottomSelect v-model="radiusKm" :options="RADIUS_OPTIONS" title="选择范围" :disabled="!distanceMode" trigger-class="select select-sm" @change="applyFilter" />
      </div>
      <div class="mk-sort-row">
        <span>排序：</span>
        <button class="sort-btn" :class="{ on: sort === 'distance' }" :disabled="!distanceMode" @click="setSort('distance')">📍 离我最近</button>
        <button class="sort-btn" :class="{ on: sort === 'views' }" @click="setSort('views')">🔥 热度优先</button>
      </div>
    </div>

    <div class="container mk-list">
      <div v-if="loading" class="mk-state">正在发现附近名片…</div>
      <div v-else-if="error" class="mk-state">
        <b>加载失败</b><p class="small muted">{{ error }}</p>
        <button class="btn btn-primary btn-sm" @click="load">重试</button>
      </div>
      <template v-else>
        <div class="mk-count small muted">共找到 {{ total }} 张公开名片<span v-if="matchedTokens.length > 1"> · 已智能分词：{{ matchedTokens.join(' / ') }}</span><span v-if="distanceMode && sort === 'distance'"> · 按距离由近到远</span><span v-else-if="sort === 'views'"> · 按热度排序</span><span v-if="radiusKm > 0"> · {{ radiusKm }} km 内</span></div>
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
          <p class="mk-bio">{{ c.bio || '' }}</p>
          <div class="mk-tags">
            <span v-for="tag in (c.tags || []).slice(0, 4)" :key="tag">{{ tag }}</span>
          </div>
          <div class="mk-card-bottom"><span>查看名片 · 一键存入通讯录</span><span class="mk-arrow">›</span></div>
        </router-link>

        <div v-if="list.length && list.length < total" class="mk-more small muted">已显示 {{ list.length }} / {{ total }}，可缩小筛选范围查看更多</div>
      </template>
    </div>

    <BottomSheet :show="mapPickerOpen" @update:show="mapPickerOpen = $event" height="72vh">
      <div class="mp-sheet-head">
        <b>地图选点</b>
        <button @click="mapPickerOpen = false">×</button>
      </div>
      <div v-if="mapPickerOpen" class="mp-sheet-body"><MapPicker :lat="coords?.lat" :lng="coords?.lng" @confirm="onMapPicked" /></div>
    </BottomSheet>
    <CityPicker v-model:show="cityPickerOpen" :current="city || currentCity" :located-city="currentCity" :cities="meta.cities" :relocating="locating" @select="onCitySelected" @relocate="relocate" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import api from '../api'
import { showToast, toggleDrawer } from '../store'
import { getCurrentPosition, getPositionQualityLabel, setManualPosition } from '../utils/geo'
import { wgs84ToGcj02 } from '../utils/geo-coord'
import { CITIES as FALLBACK_CITIES } from '../utils/city-data'
import MapPicker from '../components/MapPicker.vue'
import ScrollChips from '../components/ScrollChips.vue'
import CityPicker from '../components/CityPicker.vue'
import BottomSheet from '../components/BottomSheet.vue'
import BottomSelect from '../components/BottomSelect.vue'

const router = useRouter()
const route = useRoute()
const meta = ref({ industries: [], cities: [], hotCities: [] })
const list = ref([])
const total = ref(0)
const matchedTokens = ref([])
const loading = ref(true)
const error = ref('')
const keyword = ref('')
const industry = ref('')
const city = ref('')
const coords = ref(null)
const locating = ref(false)
const positionMeta = ref({ label: '', level: '' })
const currentCity = ref('')          // 定位到的当前城市（蓝卡显示）
const cityPickerOpen = ref(false)
const mapPickerOpen = ref(false)
const sort = ref('distance')
const RADIUS_OPTIONS = [
  { value: 0, label: '不限' }, { value: 5, label: '5 km' }, { value: 20, label: '20 km' },
  { value: 50, label: '50 km' }, { value: 100, label: '100 km' }, { value: 500, label: '500 km' }
]
const radiusKm = ref(0)
const originSource = ref('') // map=地图选点 / current=当前定位 / city=城市中心
const originPlace = ref('') // 原点的具体位置（逆地理编码：省市区街道），选点后显示真实地名而非「地图选点」
const distanceMode = computed(() => !!(coords.value || city.value))
// 原点文案：具体位置地名 > 城市 > 当前定位 > 全国（未定位）
// 地图选点后 originPlace 由逆地理编码填入，显示选中的位置信息，不再是「地图选点」四个字。
const originLabel = computed(() => {
  if (originPlace.value) return originPlace.value
  if (city.value) return city.value
  if (coords.value) return currentCity.value ? `当前位置 · ${currentCity.value}` : '当前位置'
  return '全国'
})

// 蓝卡始终显示一个城市：手动选择 > 定位城市 > 城市中心兜底
const displayCity = computed(() => city.value || currentCity.value || '全国')
const locateHint = computed(() => {
  if (city.value) return `以 ${city.value} 为中心，按距离发现伙伴`
  if (coords.value) return '正在按到你的实际距离排序'
  return '点「切换城市」选城市，按距离发现伙伴'
})

// 原点来自城市中心/IP 定位时只是粗范围，加「约」避免把估算距离当精确定位
const distApprox = computed(() => positionMeta.value.level !== 'high' || !coords.value)
function fmtDist(km) {
  if (km == null) return ''
  const prefix = distApprox.value ? '约 ' : ''
  return prefix + (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`)
}

async function loadMeta() {
  try {
    const { data } = await api.get('/api/cards/public/market/meta')
    meta.value = data.data
  } catch { /* 元数据失败仅影响筛选项，列表仍可用 */ }
}

function cityOf(name) {
  const fromMeta = meta.value.cities?.length > 0
  const all = fromMeta ? meta.value.cities : FALLBACK_CITIES
  const hit = all.find(c => c.name === name) || all.find(c => c.name.includes(name) || name.includes(c.name)) || null
  if (!hit || !Number.isFinite(hit.lat) || !Number.isFinite(hit.lng)) return hit
  // meta 已由服务端转 GCJ-02；仅本地兜底（WGS84 原始镜像）需要转换
  return fromMeta ? hit : { ...hit, ...wgs84ToGcj02(hit.lat, hit.lng) }
}
function openCityPicker() { cityPickerOpen.value = true }
// 城市选择弹层选中：设为原点（城市中心坐标），立即按距离排序
function onCitySelected(c) {
  city.value = c.name
  originSource.value = 'city'
  originPlace.value = ''  // 切城市后显示城市名，清掉上一次选点的具体地名
  // 常用城市有精确坐标→按距离排序；其余城市无坐标→服务端按城市名筛选+热度排序
  coords.value = (Number.isFinite(c.lat) && Number.isFinite(c.lng)) ? { lat: c.lat, lng: c.lng } : null
  if (coords.value && sort.value === 'views') sort.value = 'distance'
  showToast(`已切换到 ${c.name}`, 'success')
  load()
}
function setSort(s) {
  if (s === 'distance' && !distanceMode.value) return
  sort.value = s
  load()
}
function openMapPicker() { mapPickerOpen.value = true }
// 逆地理编码回填原点地名：选点后原点行显示「濮阳市华龙区」这类真实位置，而不是「地图选点」。
// 失败静默保留城市/定位兜底，不阻塞列表加载（外部依赖失败不拖垮主流程）。
async function resolveOriginPlace(lat, lng) {
  originPlace.value = ''
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
  try {
    const { data } = await api.get('/api/geo/reverse-geocode', { params: { lat, lng }, timeout: 5000 })
    const a = data?.data
    if (!a) return
    const parts = [a.city, a.district, a.street].filter(Boolean)
    originPlace.value = (parts.length ? parts.join(' · ') : a.address || '').slice(0, 40)
  } catch { /* 逆编码不可用：回落城市/定位文案 */ }
}
function onMapPicked(p) {
  mapPickerOpen.value = false
  if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return
  coords.value = { lat: p.lat, lng: p.lng }
  city.value = ''  // 自定义原点不再按城市名过滤
  originSource.value = 'map'
  setManualPosition(p.lat, p.lng, '')
  sort.value = 'distance'
  resolveOriginPlace(p.lat, p.lng)
  showToast('已按地图选点位置排序', 'success')
  load()
}

async function load() {
  loading.value = true; error.value = ''
  try {
    const params = { limit: 40 }
    if (industry.value) params.industry = industry.value
    if (city.value) params.city = city.value
    if (keyword.value.trim()) params.q = keyword.value.trim()
    if (coords.value) { params.lat = coords.value.lat; params.lng = coords.value.lng }
    if (sort.value) params.sort = sort.value
    if (radiusKm.value > 0 && distanceMode.value) params.radiusKm = radiusKm.value
    const { data } = await api.get('/api/cards/public/market', { params })
    list.value = data.data.list
    total.value = data.data.total
    matchedTokens.value = data.data.tokens || []
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
    // 重新定位后以定位城市为原点（用户主动点的，覆盖手动选择）
    if (pos.city) city.value = pos.city
    originSource.value = 'current'
    resolveOriginPlace(pos.lat, pos.lng)
    sort.value = 'distance'
    showToast(pos.source === 'default' ? '已用城市中心坐标排序，可点「重新定位」再试' : `已定位到 ${displayCity.value}，按附近距离排序`, pos.source === 'default' ? 'error' : 'success')
    cityPickerOpen.value = false
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
  if (Number.isFinite(latQ) && Number.isFinite(lngQ)) { coords.value = { lat: latQ, lng: lngQ }; originSource.value = 'map' }

  await loadMeta()
  if (cityQ) {
    city.value = cityQ
    if (!originSource.value) originSource.value = 'city'
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
      originSource.value = 'current' // 不选地图点则视为当前定位点
      resolveOriginPlace(pos.lat, pos.lng)
    } catch {}
  }
  // URL 带坐标（门户跳转的地图原点）同样回填地名
  if (Number.isFinite(latQ) && Number.isFinite(lngQ)) resolveOriginPlace(latQ, lngQ)
  load()
})
</script>

<style scoped>
.market-page { min-height: 100vh; background: var(--bg-page, #f4f6fb); padding-bottom: 40px; }
.market-nav { position: sticky; top: 0; }
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
.mk-locate-text { flex: 1; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; min-width: 0; border: 0; background: transparent; color: #fff; text-align: left; padding: 0; }
.mk-locate-text b { font-size: 15px; }
.mk-locate-text .small { opacity: .85; font-size: 11px; }
.mk-locate-right { flex: 0 0 auto; display: flex; flex-direction: column; align-items: flex-end; gap: 5px; }
.mk-cur-city { font-size: 18px; font-weight: 800; color: #fff; }
.mk-locate .btn { background: #fff; color: #2563eb; border-color: #fff; font-size: 12px; padding: 4px 12px; }
.mp-sheet-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #eef1f6; font-size: 16px; }
.mp-sheet-head button { width: 30px; height: 30px; border: 0; border-radius: 50%; background: #f1f5f9; font-size: 18px; color: #64748b; cursor: pointer; }
.mp-sheet-body { flex: 1; min-height: 0; overflow-y: auto; padding: 16px 20px 20px; }
.mk-filters { background: var(--bg-card, #fff); padding: 14px 16px 12px; border-bottom: 1px solid var(--line, #e8edf4); }
.mk-search { display: flex; gap: 8px; }
.mk-search .input { flex: 1; min-width: 0; }
.mk-chips { margin-top: 12px; }
.chip { flex-shrink: 0; font-size: 12px; padding: 6px 12px; border-radius: 999px; border: 1px solid var(--line, #e8edf4); background: var(--bg-page, #f4f6fb); color: var(--muted, #6b7688); }
.chip.on { background: var(--primary, #2563eb); border-color: var(--primary, #2563eb); color: #fff; font-weight: 700; }
/* 搜索范围：原点(可点=地图选点) + 范围下拉压成一行，尽量不占高度 */
.mk-range-box { display: flex; align-items: center; gap: 8px; margin-top: 10px; border: 1px solid var(--line, #e8edf4); border-radius: 10px; padding: 6px 10px; background: var(--bg-page, #f7f9fc); font-size: 12px; }
.mk-origin-btn { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; text-align: left; }
.mk-origin-btn:disabled { opacity: .55; }
.mk-range-sep { width: 1px; height: 16px; background: var(--line, #e8edf4); flex-shrink: 0; }
.mk-range-label { color: var(--muted, #6b7688); white-space: nowrap; flex-shrink: 0; }
.mk-origin { color: var(--primary, #2563eb); font-weight: 700; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mk-sort-row { display: flex; align-items: center; gap: 8px; margin-top: 12px; font-size: 12px; flex-wrap: wrap; }
.sort-btn { font-size: 12px; padding: 5px 11px; border-radius: 8px; border: 1px solid var(--line, #e8edf4); background: var(--bg-page, #f4f6fb); color: var(--muted, #6b7688); }
.sort-btn.on { border-color: var(--primary, #2563eb); color: var(--primary, #2563eb); background: #eef2ff; background: color-mix(in srgb, var(--primary, #2563eb) 10%, transparent); font-weight: 700; }
.sort-btn:disabled { opacity: .45; }
.select { border: 1px solid var(--line, #e8edf4); border-radius: 8px; padding: 6px 10px; background: var(--bg-card, #fff); color: var(--text, #0f172a); }
.select-sm { padding: 4px 8px; font-size: 12px; }
.mk-list { padding-top: 14px; }
.mk-state, .mk-empty { text-align: center; padding: 48px 16px; color: var(--muted, #6b7688); }
.mk-count { margin-bottom: 10px; }
.mk-empty-ico { font-size: 46px; color: #cbd5e1; }
.mk-empty b { display: block; color: var(--text, #0f172a); margin: 8px 0; }
/* 卡片统一 flex 列 + 底部贴齐：同行 bio/tags 行数不同时高度一致，底栏不错位 */
.mk-card { display: flex; flex-direction: column; background: var(--bg-card, #fff); border: 1px solid var(--line, #e8edf4); border-radius: 14px; padding: 14px; margin-bottom: 10px; box-shadow: 0 4px 16px rgba(15,23,42,.05); transition: transform .15s, box-shadow .15s; }
.mk-card:active { transform: scale(.995); }
.mk-card:hover { box-shadow: 0 10px 26px rgba(15,23,42,.1); }
.mk-card-top { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.mk-avatar { flex: 0 0 52px; height: 52px; border-radius: 12px; overflow: hidden; background: var(--primary, #2563eb); color: #fff; display: grid; place-items: center; font-size: 22px; font-weight: 800; }
.mk-avatar img { width: 100%; height: 100%; object-fit: cover; }
.mk-logo { width: 28px; height: 28px; object-fit: contain; border-radius: 6px; background: rgba(127,127,127,.06); padding: 2px; }
.mk-ident { flex: 1; min-width: 0; }
.mk-name { font-size: 16px; font-weight: 800; }
.mk-title { font-size: 12px; color: var(--muted, #6b7688); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mk-dist { flex-shrink: 0; font-size: 12px; font-weight: 700; color: var(--primary, #2563eb); background: #eef2ff; background: color-mix(in srgb, var(--primary, #2563eb) 12%, transparent); padding: 4px 9px; border-radius: 999px; }
.mk-meta { display: flex; gap: 8px; margin-top: 10px; flex-wrap: nowrap; overflow: hidden; flex-shrink: 0; min-height: 23px; }
.mk-industry { font-size: 11px; padding: 3px 9px; border-radius: 6px; background: #eef2ff; background: color-mix(in srgb, var(--primary, #2563eb) 12%, transparent); color: var(--primary, #2563eb); font-weight: 600; }
.mk-city { font-size: 11px; color: var(--muted, #6b7688); }
/* bio 固定两行高度，空值也占位；tags 固定一行高度，避免有无标签时卡片高度不一致 */
.mk-bio { font-size: 13px; color: var(--muted, #6b7688); line-height: 1.55; margin-top: 10px; min-height: 40px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; flex-shrink: 0; }
.mk-tags { display: flex; gap: 6px; flex-wrap: nowrap; overflow: hidden; margin-top: 8px; margin-bottom: 12px; min-height: 21px; flex-shrink: 0; }
.mk-tags span { font-size: 11px; padding: 2px 8px; border-radius: 5px; background: var(--bg-page, #f4f6fb); color: var(--muted, #6b7688); white-space: nowrap; flex-shrink: 0; }
.mk-card-bottom { display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 10px; border-top: 1px solid var(--line, #e8edf4); font-size: 12px; color: var(--primary, #2563eb); font-weight: 600; flex-shrink: 0; }
.mk-arrow { font-size: 18px; }
.mk-more { text-align: center; padding: 16px; }
</style>
