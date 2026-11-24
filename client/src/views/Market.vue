<template>
  <div class="market-page">
    <header class="topbar market-nav">
      <button class="nav-back" @click="router.back ? router.back() : router.push('/')" aria-label="返回">‹</button>
      <span class="nav-title">名片集市 · 发现对口伙伴</span>
      <button class="nav-menu-btn" aria-label="打开菜单" @click="openDrawer">☰</button>
      <router-link to="/me" class="nav-me">我的</router-link>
    </header>

    <div class="mk-hero">
      <p class="mk-slogan">按距离找到附近、业务对口的商务伙伴</p>
      <div class="mk-locate">
        <span class="mk-locate-ico">⌖</span>
        <div class="mk-locate-text">
          <b>{{ locateLabel }}</b>
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
      <div class="mk-city-row">
        <label>以城市为中心：</label>
        <select v-model="city" class="select" @change="applyFilter">
          <option value="">不使用城市</option>
          <option v-for="c in meta.cities" :key="c.name" :value="c.name">{{ c.name }}</option>
        </select>
        <span class="small muted">选城市后按到该市中心的距离排序</span>
      </div>
    </div>

    <div class="container mk-list">
      <div v-if="loading" class="mk-state">正在发现附近名片…</div>
      <div v-else-if="error" class="mk-state">
        <b>加载失败</b><p class="small muted">{{ error }}</p>
        <button class="btn btn-primary btn-sm" @click="load">重试</button>
      </div>
      <template v-else>
        <div class="mk-count small muted">共找到 {{ total }} 张公开名片<span v-if="distanceMode"> · 按距离由近到远</span></div>
        <div v-if="!list.length" class="mk-empty">
          <div class="mk-empty-ico">⌕</div>
          <b>附近还没有上架的名片</b>
          <p class="small muted">试试切换行业 / 城市，或邀请伙伴在资料页开启「加入名片集市」。</p>
          <router-link to="/me/card" class="btn btn-primary btn-sm">上架我的名片</router-link>
        </div>

        <router-link v-for="c in list" :key="c.slug" :to="'/c/' + c.slug" class="mk-card">
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api'
import { showToast, openDrawer } from '../store'

const router = useRouter()
const meta = ref({ industries: [], cities: [] })
const list = ref([])
const total = ref(0)
const loading = ref(true)
const error = ref('')
const keyword = ref('')
const industry = ref('')
const city = ref('')
const coords = ref(null)
const locating = ref(false)
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
}

async function load() {
  loading.value = true; error.value = ''
  try {
    const params = { limit: 40 }
    if (industry.value) params.industry = industry.value
    if (city.value) params.city = city.value
    if (keyword.value.trim()) params.q = keyword.value.trim()
    if (coords.value) { params.lat = coords.value.lat; params.lng = coords.value.lng }
    const { data } = await api.get('/api/cards/public/market', { params })
    list.value = data.data.list
    total.value = data.data.total
  } catch (e) { error.value = e.message } finally { loading.value = false }
}

function applyFilter() { load() }
function setIndustry(key) { industry.value = key; load() }

function relocate() {
  if (!navigator.geolocation) { showToast('当前浏览器不支持定位，请改用上方城市选择', 'error'); return }
  locating.value = true
  navigator.geolocation.getCurrentPosition(
    pos => {
      coords.value = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      locating.value = false
      showToast('定位成功，按附近距离排序', 'success')
      load()
    },
    () => {
      locating.value = false
      showToast('未获取到定位，请改用城市选择或检查定位权限', 'error')
    },
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
  )
}

onMounted(() => { loadMeta(); load() })
</script>

<style scoped>
.market-page { min-height: 100vh; background: var(--bg-page, #f4f6fb); padding-bottom: 40px; }
.market-nav { position: sticky; top: 0; z-index: 30; }
.nav-back { border: 0; background: transparent; font-size: 30px; line-height: 1; padding: 0 10px; color: var(--primary, #2563eb); }
.nav-title { flex: 1; font-weight: 700; font-size: 15px; }
.nav-me { font-size: 13px; color: var(--primary, #2563eb); }
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
.mk-city-row { display: flex; align-items: center; gap: 8px; margin-top: 12px; flex-wrap: wrap; font-size: 13px; }
.mk-city-row label { font-weight: 600; }
.select { border: 1px solid var(--line, #e8edf4); border-radius: 8px; padding: 6px 10px; background: var(--bg-card, #fff); color: var(--text, #0f172a); }
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
