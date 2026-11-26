<template>
  <view class="page">
    <view class="cp-head">
      <view class="cp-title">选择城市<text class="cp-sub">仅市级 · A-Z 快捷查找</text></view>
      <text class="cp-close" @tap="close">✕</text>
    </view>
    <view class="cp-search">
      <input v-model="keyword" class="input" placeholder="输入城市名或拼音首字母，如 北京 / BJ" confirm-type="search" />
      <text class="cp-relocate" @tap="relocate">⌖ 重新定位</text>
    </view>
    <view v-if="current" class="cp-current">当前选择：<text class="b">{{ current }}</text></view>
    <scroll-view scroll-y class="cp-body" :scroll-into-view="scrollInto" scroll-with-animation>
      <view v-if="!keyword && locatedCity" class="cp-located-wrap">
        <view class="cp-located" @tap="chooseByName(locatedCity)">⌖ 当前定位城市 <text class="b">{{ locatedCity }}</text></view>
      </view>
      <view v-if="filteredGroups.length">
        <view v-for="g in filteredGroups" :key="g.letter" class="cp-group" :id="'letter-' + g.letter">
          <view class="cp-letter">{{ g.letter }}</view>
          <view v-for="c in g.cities" :key="c.name" class="cp-city" :class="{ on: c.name === current }" @tap="choose(c)">{{ c.name }}</view>
        </view>
      </view>
      <view v-else class="cp-empty">没有匹配的城市，试试拼音首字母</view>
    </scroll-view>
    <view v-if="!keyword" class="cp-index">
      <text v-for="l in ALL_LETTERS" :key="l" class="cp-idx-item" :class="{ on: activeLetter === l, muted: !letters.includes(l) }" @tap="jumpTo(l)">{{ l }}</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { api } from '../../utils/request'

const ALL_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

const CITY_FALLBACK = [
  { name: '北京', py: 'BJ' }, { name: '上海', py: 'SH' }, { name: '广州', py: 'GZ' }, { name: '深圳', py: 'SZ' },
  { name: '杭州', py: 'HZ' }, { name: '成都', py: 'CD' }, { name: '重庆', py: 'CQ' }, { name: '武汉', py: 'WH' },
  { name: '西安', py: 'XA' }, { name: '南京', py: 'NJ' }, { name: '苏州', py: 'SZ' }, { name: '天津', py: 'TJ' },
  { name: '长沙', py: 'CS' }, { name: '郑州', py: 'ZZ' }, { name: '青岛', py: 'QD' }, { name: '厦门', py: 'XM' },
  { name: '福州', py: 'FZ' }, { name: '济南', py: 'JN' }, { name: '合肥', py: 'HF' }, { name: '昆明', py: 'KM' },
  { name: '大连', py: 'DL' }, { name: '沈阳', py: 'SY' }, { name: '宁波', py: 'NB' }, { name: '东莞', py: 'DG' },
  { name: '佛山', py: 'FS' }, { name: '南宁', py: 'NN' }, { name: '贵阳', py: 'GY' }, { name: '海口', py: 'HK' },
  { name: '无锡', py: 'WX' }, { name: '温州', py: 'WZ' }, { name: '三亚', py: 'SY' }, { name: '濮阳', py: 'PY' },
  { name: '哈尔滨', py: 'HEB' }
]

const cities = ref([])
const current = ref('')
const locatedCity = ref('')
const keyword = ref('')
const activeLetter = ref('')
const scrollInto = ref('')

const grouped = computed(() => {
  const map = {}
  for (const c of cities.value) {
    const l = String(c.py || c.name || '#').charAt(0).toUpperCase()
    const key = /[A-Z]/.test(l) ? l : '#'
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
  uni.$emit('city-picked', c)
  uni.navigateBack()
}
function chooseByName(name) {
  choose(cities.value.find(c => c.name === name) || { name })
}
function close() { uni.navigateBack() }
function jumpTo(letter) {
  if (!letters.value.includes(letter)) return
  activeLetter.value = letter
  scrollInto.value = ''
  setTimeout(() => { scrollInto.value = 'letter-' + letter }, 0)
}
function relocate() {
  uni.$emit('city-relocate')
  uni.navigateBack()
}
onLoad(async options => {
  current.value = options?.current || ''
  locatedCity.value = options?.located || ''
  try {
    const meta = await api.get('/api/cards/public/market/meta', false)
    cities.value = meta?.cities?.length ? meta.cities : CITY_FALLBACK
  } catch { cities.value = CITY_FALLBACK }
  if (letters.value.length) activeLetter.value = letters.value[0]
})
</script>

<style scoped>
.page { min-height: 100vh; background: #fff; display: flex; flex-direction: column; }
.cp-head { position: relative; display: flex; align-items: center; padding: 28rpx 32rpx 20rpx; border-bottom: 2rpx solid #eef1f6; }
.cp-title { font-size: 34rpx; font-weight: 800; }
.cp-sub { font-size: 22rpx; font-weight: 400; color: #b09a72; margin-left: 16rpx; }
.cp-close { position: absolute; right: 28rpx; top: 24rpx; width: 56rpx; height: 56rpx; line-height: 56rpx; text-align: center; font-size: 32rpx; color: #8a7355; background: #f1f5f9; border-radius: 50%; }
.cp-search { display: flex; align-items: center; gap: 16rpx; padding: 18rpx 32rpx; }
.cp-search .input { flex: 1; min-width: 0; }
.cp-relocate { flex-shrink: 0; font-size: 22rpx; font-weight: 700; color: #a62b2b; border: 2rpx solid #dbe3ef; border-radius: 12rpx; padding: 10rpx 16rpx; }
.cp-current { padding: 8rpx 32rpx 16rpx; font-size: 24rpx; color: #8a7355; }
.cp-current .b { color: #a62b2b; font-weight: 700; }
.cp-body { flex: 1; height: 0; padding: 0 110rpx 20rpx 32rpx; box-sizing: border-box; }
.cp-located-wrap { margin: 16rpx 0 20rpx; }
.cp-located { font-size: 26rpx; color: #a62b2b; background: #f7ecd9; border: 2rpx solid #bfdbfe; border-radius: 16rpx; padding: 20rpx 24rpx; }
.cp-located .b { font-size: 30rpx; font-weight: 800; margin-left: 12rpx; }
.cp-group { margin-bottom: 12rpx; }
.cp-letter { font-size: 24rpx; font-weight: 800; color: #a62b2b; padding: 12rpx 0 8rpx; }
.cp-city { font-size: 28rpx; color: #334155; padding: 20rpx 8rpx; border-bottom: 2rpx solid #f3f5f9; }
.cp-city.on { color: #a62b2b; font-weight: 700; }
.cp-empty { padding: 80rpx 0; text-align: center; color: #b09a72; font-size: 26rpx; }
.cp-index { position: absolute; right: 8rpx; top: 220rpx; bottom: 24rpx; display: flex; flex-direction: column; justify-content: center; }
.cp-idx-item { width: 44rpx; text-align: center; font-size: 19rpx; font-weight: 700; color: #a62b2b; padding: 3rpx 0; }
.cp-idx-item.muted { color: #d8c9a8; }
.cp-idx-item.on { color: #fff; background: #a62b2b; border-radius: 12rpx; }
</style>
