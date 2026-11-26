<template>
  <view class="page">
    <view class="hero">
      <view class="slogan">按距离找到附近、业务对口的商务伙伴</view>
      <view class="locate">
        <text class="loco">⌖</text>
        <view class="loc-text">
          <text class="b">按距离发现附近伙伴</text>
          <text class="hint">{{ locateHint }}</text>
        </view>
        <view class="loc-right">
          <text class="cur-city">{{ displayCity }}</text>
          <text class="switch-city" @tap="openCityPicker">切换城市</text>
        </view>
      </view>
    </view>

    <view class="filters">
      <view class="search-row">
        <input v-model="keyword" class="input" placeholder="搜姓名 / 公司 / 业务关键词" @confirm="applyFilter" />
        <button class="btn tiny primary" :disabled="loading" @tap="applyFilter">搜索</button>
      </view>
      <scroll-view scroll-x class="chips">
        <view class="chip-wrap">
          <text class="chip" :class="{ on: !industry }" @tap="setIndustry('')">全部</text>
          <text v-for="ind in meta.industries" :key="ind.key" class="chip" :class="{ on: industry === ind.key }" @tap="setIndustry(ind.key)">{{ ind.icon }} {{ ind.label }}</text>
        </view>
      </scroll-view>
      <view class="city-head">
        <text>范围原点：<text class="b">{{ city || (coords ? '地图选点' : '全国') }}</text></text>
        <text class="map-btn" @tap="openMapPicker">⌖ 地图选点</text>
      </view>
      <view class="sort-row">
        <text>排序：</text>
        <text class="sort-btn" :class="{ on: sort === 'distance' }" @tap="setSort('distance')">📍 离我最近</text>
        <text class="sort-btn" :class="{ on: sort === 'views' }" @tap="setSort('views')">🔥 热度</text>
        <picker :range="radiusLabels" :value="radiusIdx" @change="onRadius">
          <text class="radius-pick">范围 {{ radiusLabels[radiusIdx] }} ▾</text>
        </picker>
      </view>
    </view>

    <view class="list">
      <view v-if="loading" class="state">正在发现附近名片…</view>
      <view v-else-if="error" class="state">
        <text>加载失败：{{ error }}</text>
        <button class="btn tiny primary" style="margin-top:20rpx" @tap="load">重试</button>
      </view>
      <block v-else>
        <view class="count">共找到 {{ total }} 张公开名片<text v-if="distanceMode && sort === 'distance'"> · 按距离由近到远</text><text v-else-if="sort === 'views'"> · 按热度排序</text><text v-if="radiusKm > 0"> · {{ radiusKm }} km 内</text></view>
        <view v-if="!list.length" class="state">
          <view class="empty-ico">⌕</view>
          <text class="b">附近还没有上架的名片</text>
          <text class="hint">试试切换行业 / 城市，或邀请伙伴在资料页开启「加入名片集市」</text>
          <button class="btn tiny primary" style="margin-top:20rpx" @tap="goEdit">上架我的名片</button>
        </view>

        <view v-for="c in list" :key="c.slug" class="mk-card" @tap="openCard(c.slug)">
          <view class="card-top">
            <view class="avatar">
              <image v-if="c.avatar" :src="c.avatar" mode="aspectFill" />
              <text v-else>{{ (c.name || '名').slice(0, 1) }}</text>
            </view>
            <image v-if="c.logo" class="logo" :src="c.logo" mode="aspectFit" />
            <view class="ident">
              <view class="name">{{ c.name || c.name_en || '未填写姓名' }}</view>
              <view class="title">{{ [c.title, c.company].filter(Boolean).join(' · ') || '商务伙伴' }}</view>
            </view>
            <text v-if="c.distanceKm != null" class="dist">{{ fmtDist(c.distanceKm) }}</text>
          </view>
          <view class="meta">
            <text v-if="c.industryLabel" class="industry">{{ c.industryLabel }}</text>
            <text v-if="c.city" class="city">⌖ {{ c.city }}</text>
          </view>
          <view v-if="c.bio" class="bio">{{ c.bio }}</view>
          <view v-if="c.tags && c.tags.length" class="tags">
            <text v-for="tag in c.tags.slice(0, 4)" :key="tag">{{ tag }}</text>
          </view>
          <view class="card-bottom"><text>查看名片 · 存入通讯录</text><text class="arrow">›</text></view>
        </view>
        <view v-if="list.length && list.length < total" class="more">已显示 {{ list.length }} / {{ total }}，可缩小筛选范围</view>
      </block>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad, onPullDownRefresh, onShareAppMessage } from '@dcloudio/uni-app'
import { api, toast, geoLocate, withInvite } from '../../utils/request'

const meta = ref({ industries: [], cities: [], hotCities: [] })
const list = ref([])
const total = ref(0)
const loading = ref(true)
const error = ref('')
const keyword = ref('')
const industry = ref('')
const city = ref('')
const coords = ref(null)
const locating = ref(false)
const sourceLabel = ref('')
const currentCity = ref('')
const sort = ref('distance')
const radiusKm = ref(0)
const radiusOptions = [0, 5, 20, 50, 100, 500]
const radiusLabels = ['不限', '5 km', '20 km', '50 km', '100 km', '500 km']
const radiusIdx = ref(0)
const distanceMode = computed(() => !!(coords.value || city.value))
const displayCity = computed(() => city.value || currentCity.value || '全国')

function openCityPicker() {
  uni.$off('city-picked')
  uni.$off('city-relocate')
  uni.$once('city-picked', c => {
    if (!c?.name) return
    city.value = c.name
    coords.value = Number.isFinite(c.lat) && Number.isFinite(c.lng) ? { lat: c.lat, lng: c.lng } : null
    if (coords.value) sort.value = 'distance'
    load()
  })
  uni.$once('city-relocate', () => { relocate() })
  uni.navigateTo({ url: '/pages/city-picker/city-picker?current=' + encodeURIComponent(displayCity.value) + '&located=' + encodeURIComponent(currentCity.value) })
}
function setSort(s) {
  if (s === 'distance' && !distanceMode.value) return
  sort.value = s
  load()
}
function onRadius(e) {
  radiusIdx.value = Number(e.detail.value)
  radiusKm.value = radiusOptions[radiusIdx.value]
  load()
}
function openMapPicker() {
  uni.$off('map-picked')
  uni.$once('map-picked', p => {
    if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return
    coords.value = { lat: p.lat, lng: p.lng }
    city.value = ''
    sort.value = 'distance'
    toast('已按地图选点位置排序', 'success')
    load()
  })
  uni.navigateTo({ url: '/pages/map-picker/map-picker?lat=' + (coords.value?.lat || '') + '&lng=' + (coords.value?.lng || '') })
}

const locateHint = computed(() => city.value ? `以 ${city.value} 为中心，按距离发现伙伴` : coords.value ? `按附近距离排序${sourceLabel.value ? ' · ' + sourceLabel.value : ''}` : '点「切换城市」选城市，按距离发现伙伴')

function fmtDist(km) {
  if (km == null) return ''
  // 原点来自城市中心/IP 定位时只是粗范围，加「约」避免把估算距离当精确定位
  const prefix = sourceLabel.value && sourceLabel.value !== '微信定位' && sourceLabel.value !== 'GPS 定位' ? '约 ' : ''
  return prefix + (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`)
}

async function loadMeta() {
  try { meta.value = await api.get('/api/cards/public/market/meta', false) } catch {}
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
    const query = Object.keys(params).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join('&')
    const r = await api.get('/api/cards/public/market?' + query, false)
    list.value = r.list; total.value = r.total
  } catch (e) { error.value = e.message } finally { loading.value = false }
}

function applyFilter() { load() }
function setIndustry(k) { industry.value = k; load() }
async function relocate() {
  if (locating.value) return
  locating.value = true
  try {
    const pos = await geoLocate(city.value || '上海')
    coords.value = pos
    sourceLabel.value = { wechat: '微信定位', gps: 'GPS 定位', ip: 'IP 定位', default: '城市兜底' }[pos.source] || ''
    if (pos.city && pos.source !== 'default') currentCity.value = pos.city
    if (pos.city) city.value = pos.city
    sort.value = 'distance'
    toast(pos.source === 'default' ? '已用城市中心坐标，可再点重新定位' : `已定位到 ${displayCity.value}，按附近距离排序`, pos.source === 'default' ? 'none' : 'success')
    load()
  } catch (e) { toast(e.message || '定位失败，请改用城市选择', 'error') }
  finally { locating.value = false }
}
function openCard(slug) { uni.navigateTo({ url: `/pages/card/card?slug=${slug}` }) }
function goEdit() { uni.navigateTo({ url: '/pages/edit/edit' }) }

onLoad(async () => {
  loadMeta()
  // 预热四级定位，拿到坐标后再加载列表以按距离排序
  try {
    const pos = await geoLocate()
    coords.value = pos
    sourceLabel.value = { wechat: '微信定位', gps: 'GPS 定位', ip: 'IP 定位', default: '城市兜底' }[pos.source] || ''
    if (pos.city && pos.source !== 'default') currentCity.value = pos.city
  } catch {}
  load()
})
onPullDownRefresh(async () => { await Promise.all([loadMeta(), load()]); uni.stopPullDownRefresh() })
onShareAppMessage(() => ({ title: '名片集市 · 发现附近业务对口伙伴', path: withInvite('/pages/market/market') }))
</script>

<style scoped>
.page { min-height: 100vh; background: #f5f7fb; }
.hero { background: linear-gradient(135deg, #1e3a8a, #2563eb 55%, #38bdf8); color: #fff; padding: 30rpx 24rpx 34rpx; }
.slogan { font-size: 32rpx; font-weight: 800; margin-bottom: 22rpx; }
.locate { display: flex; align-items: center; gap: 16rpx; background: rgba(255,255,255,.15); border: 2rpx solid rgba(255,255,255,.28); border-radius: 20rpx; padding: 18rpx 20rpx; }
.loco { font-size: 40rpx; }
.loc-text { flex: 1; display: flex; flex-direction: column; gap: 4rpx; min-width: 0; }
.loc-text .b { font-size: 28rpx; font-weight: 700; }
.loc-text .hint { font-size: 22rpx; opacity: .85; }
.loc-right { flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 8rpx; }
.cur-city { font-size: 34rpx; font-weight: 800; }
.switch-city { font-size: 22rpx; font-weight: 700; color: #2563eb; background: #fff; border-radius: 999rpx; padding: 6rpx 20rpx; }
.btn.light { background: #fff; color: #2563eb; flex-shrink: 0; }
.filters { background: #fff; padding: 22rpx 24rpx 18rpx; border-bottom: 2rpx solid #e8edf4; }
.search-row { display: flex; gap: 12rpx; }
.search-row .input { flex: 1; min-width: 0; }
.chips { margin-top: 18rpx; width: 100%; white-space: nowrap; }
.chip-wrap { display: inline-flex; gap: 14rpx; padding-bottom: 6rpx; }
.chip { flex-shrink: 0; font-size: 24rpx; padding: 10rpx 22rpx; border-radius: 999rpx; border: 2rpx solid #e8edf4; background: #f5f7fb; color: #6b7688; }
.chip.on { background: #2563eb; border-color: #2563eb; color: #fff; font-weight: 700; }
.city-head { display: flex; align-items: center; justify-content: space-between; margin-top: 20rpx; font-size: 24rpx; font-weight: 600; }
.city-head .b { color: #2563eb; }
.map-btn { font-size: 22rpx; color: #2563eb; border: 2rpx solid #2563eb; border-radius: 999rpx; padding: 6rpx 20rpx; }
.sort-row { display: flex; align-items: center; gap: 12rpx; margin-top: 18rpx; font-size: 22rpx; flex-wrap: wrap; }
.sort-btn { font-size: 22rpx; padding: 8rpx 18rpx; border-radius: 10rpx; border: 2rpx solid #e8edf4; background: #f5f7fb; color: #6b7688; }
.sort-btn.on { border-color: #2563eb; color: #2563eb; background: #eff6ff; font-weight: 700; }
.radius-pick { color: #6b7688; background: #f5f7fb; border-radius: 10rpx; padding: 8rpx 14rpx; }
.picker { margin-top: 18rpx; border: 2rpx solid #e8edf4; border-radius: 12rpx; padding: 16rpx 18rpx; font-size: 26rpx; color: #162033; }
.region-pickers { display: flex; gap: 12rpx; }
.region-pickers picker { flex: 1; min-width: 0; }
.region-pickers .picker { margin-top: 18rpx; }
.list { padding: 22rpx 24rpx 40rpx; }
.state { text-align: center; padding: 80rpx 20rpx; color: #6b7688; font-size: 26rpx; }
.state .b { display: block; color: #0f172a; font-size: 30rpx; font-weight: 700; margin: 16rpx 0; }
.state .hint { display: block; font-size: 24rpx; line-height: 1.6; }
.empty-ico { font-size: 90rpx; color: #cbd5e1; }
.count { font-size: 24rpx; color: #94a3b8; margin-bottom: 16rpx; }
.mk-card { background: #fff; border: 2rpx solid #e8edf4; border-radius: 20rpx; padding: 24rpx; margin-bottom: 18rpx; box-shadow: 0 8rpx 24rpx rgba(15,23,42,.05); }
.card-top { display: flex; align-items: center; gap: 16rpx; }
.avatar { width: 96rpx; height: 96rpx; border-radius: 20rpx; background: #2563eb; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 40rpx; font-weight: 800; overflow: hidden; flex-shrink: 0; }
.avatar image { width: 100%; height: 100%; }
.logo { width: 48rpx; height: 48rpx; border-radius: 10rpx; background: rgba(0,0,0,.04); flex-shrink: 0; }
.ident { flex: 1; min-width: 0; }
.name { font-size: 32rpx; font-weight: 800; }
.title { font-size: 24rpx; color: #6b7688; margin-top: 4rpx; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dist { flex-shrink: 0; font-size: 24rpx; font-weight: 700; color: #2563eb; background: #eff6ff; padding: 8rpx 16rpx; border-radius: 999rpx; }
.meta { display: flex; gap: 14rpx; margin-top: 18rpx; flex-wrap: wrap; }
.industry { font-size: 22rpx; padding: 6rpx 16rpx; border-radius: 10rpx; background: #eff6ff; color: #2563eb; font-weight: 600; }
.city { font-size: 22rpx; color: #6b7688; }
.bio { font-size: 26rpx; color: #6b7688; line-height: 1.6; margin-top: 16rpx; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.tags { display: flex; gap: 10rpx; flex-wrap: wrap; margin-top: 14rpx; }
.tags text { font-size: 22rpx; padding: 4rpx 14rpx; border-radius: 10rpx; background: #f1f5f9; color: #6b7688; }
.card-bottom { display: flex; justify-content: space-between; align-items: center; margin-top: 20rpx; padding-top: 18rpx; border-top: 2rpx solid #f1f5f9; font-size: 24rpx; color: #2563eb; font-weight: 600; }
.arrow { font-size: 34rpx; }
.more { text-align: center; font-size: 24rpx; color: #94a3b8; padding: 24rpx; }
.input { width: 100%; box-sizing: border-box; border: 2rpx solid #e8edf4; border-radius: 12rpx; padding: 16rpx 18rpx; font-size: 26rpx; }
.btn { font-size: 24rpx; padding: 16rpx 0; border-radius: 12rpx; }
.btn::after { border: 0; }
.btn.primary { background: #2563eb; color: #fff; }
.btn.tiny { padding: 12rpx 28rpx; flex-shrink: 0; }
</style>
