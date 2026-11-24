<template>
  <div class="rp-wrap">
    <div class="rp-cols">
      <!-- 三列同屏滚轮：省 / 市 / 区，滚动一列停稳后自动联动下级（MShop RegionTriplePicker 同款交互） -->
      <div v-for="(col, ci) in wheels" :key="ci" class="rp-col">
        <div class="rp-col-title">{{ col.title }}</div>
        <div class="rp-wheel" :ref="el => setWheelRef(el, ci)" :data-col="ci" @touchstart="onTouch(true)" @touchend="onTouch(false)" @touchcancel="onTouch(false)">
          <div class="rp-wheel-pad"></div>
          <button
            v-for="(r, ri) in col.list" :key="r.code"
            class="rp-item"
            :class="{ on: ri === col.index }"
            @click="clickItem(ci, ri)"
          >{{ r.name }}</button>
          <div class="rp-wheel-pad"></div>
        </div>
      </div>
    </div>
    <!-- 街道（第 4 级）数据稀疏，选中区后在滚轮下方以 chip 形式给出，不占独立滚轮列 -->
    <div v-if="streets.length" class="rp-street">
      <div class="rp-col-title">街道 / 乡镇 <span class="muted small">（可少选）</span></div>
      <div class="rp-street-chips">
        <button class="chip" :class="{ on: !selected.street }" @click="selected.street = null">不限</button>
        <button v-for="s in streets" :key="s.code" class="chip" :class="{ on: selected.street?.code === s.code }" @click="selected.street = s">{{ s.name }}</button>
      </div>
    </div>
    <div class="rp-foot">
      <div class="rp-path small muted">{{ pathText || '可只选到省 / 市，地区用于集市筛选与按距离排序' }}</div>
      <button class="btn btn-primary btn-sm" :disabled="!hasSelection" @click="confirm">确定</button>
    </div>
  </div>
</template>

<script setup>
/**
 * 省市区三列同屏滚轮联动选择器（H5）——交互对齐 MShop client/src/components/RegionTriplePicker.vue。
 * 为什么不用逐列下钻/换行堆叠：选了省才出市、选了市才换行出区，弹层越选越高、很难受。
 * 停驻检测用 scrollTop 轮询（不依赖 transitionend，部分 WebView 会丢该事件导致不联动），
 * 手指按住时不提交，停稳后再重建下级列。数据源沿用 /api/geo/regions（地区唯一真相源）。
 */
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import api from '../api'

const props = defineProps({
  province: { type: String, default: '' },
  city: { type: String, default: '' },
  district: { type: String, default: '' },
  street: { type: String, default: '' }
})
const emit = defineEmits(['confirm', 'close'])

const LEVEL_TITLES = ['省 / 直辖市', '城市', '区 / 县']
const ITEM_H = 40 // 与 CSS .rp-item 高度、.rp-wheel-pad 上/下内边距一致

const all = ref([])
const selected = ref({ 1: null, 2: null, 3: null, street: null })
// wheels[0..2] 对应省/市/区，list 为选项，index 为当前停靠序号
const wheels = ref([
  { title: LEVEL_TITLES[0], list: [], index: 0 },
  { title: LEVEL_TITLES[1], list: [], index: 0 },
  { title: LEVEL_TITLES[2], list: [], index: 0 }
])

function childrenOf(level, parentCode) {
  return all.value.filter(r => r.level === level && (level === 1 ? !r.parent_code : r.parent_code === parentCode))
}

const streets = computed(() => {
  const d = selected.value[3]
  return d ? childrenOf(4, d.code) : []
})
const pathText = computed(() => {
  const s = selected.value
  return [s[1]?.name, s[2]?.name, s[3]?.name, s.street?.name].filter(Boolean).join(' / ')
})
const hasSelection = computed(() => !!selected.value[1])

// ---------- 滚轮定位 / 联动 ----------
const wheelEls = [null, null, null]
function setWheelRef(el, ci) { if (el) wheelEls[ci] = el }
let pollTimer = null
let touching = false
let prevTop = [null, null, null]
let lastIdx = [-1, -1, -1]
let initialSig = ''
let settledOnce = false

function setWheelScroll(ci, idx, smooth = false) {
  const el = wheelEls[ci]
  if (!el) return
  const top = Math.max(0, idx) * ITEM_H
  // 老 WebView 可能不支持 scrollTo 的 options 形式，兜底直接设 scrollTop
  try { el.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' }) }
  catch { el.scrollTop = top }
}

function scrollWheel(ci) {
  const el = wheelEls[ci]
  if (!el || !wheels.value[ci]?.list.length) return -1
  const idx = Math.round(el.scrollTop / ITEM_H)
  return Math.max(0, Math.min(wheels.value[ci].list.length - 1, idx))
}

function rebuildFromSelection() {
  const s = selected.value
  const pList = childrenOf(1, '')
  const p = s[1] || pList[0] || null
  const cList = p ? childrenOf(2, p.code) : []
  const c = s[2] || cList[0] || null
  const dList = c ? childrenOf(3, c.code) : []
  const d = s[3] || dList[0] || null
  wheels.value = [
    { title: LEVEL_TITLES[0], list: pList, index: Math.max(0, pList.findIndex(x => x.code === p?.code)) },
    { title: LEVEL_TITLES[1], list: cList, index: Math.max(0, cList.findIndex(x => x.code === c?.code)) },
    { title: LEVEL_TITLES[2], list: dList, index: Math.max(0, dList.findIndex(x => x.code === d?.code)) }
  ]
  nextTick(() => wheels.value.forEach((_, i) => setWheelScroll(i, wheels.value[i].index)))
}

// 点击某个选项：滚到该项并立即联动（无需等轮询）
function clickItem(ci, ri) {
  setWheelScroll(ci, ri, true)
  applyWheel(ci, ri)
}
function applyWheel(ci, idx) {
  const list = wheels.value[ci]?.list || []
  const hit = list[idx]
  if (!hit) return
  if (ci === 0) {
    if (selected.value[1]?.code === hit.code) return
    selected.value[1] = hit
    selected.value[2] = null
    selected.value[3] = null
    selected.value.street = null
    const cList = childrenOf(2, hit.code)
    const c = cList[0] || null
    selected.value[2] = c
    const dList = c ? childrenOf(3, c.code) : []
    selected.value[3] = dList[0] || null
    wheels.value[1] = { title: LEVEL_TITLES[1], list: cList, index: 0 }
    wheels.value[2] = { title: LEVEL_TITLES[2], list: dList, index: 0 }
    nextTick(() => { setWheelScroll(1, 0); setWheelScroll(2, 0) })
  } else if (ci === 1) {
    if (selected.value[2]?.code === hit.code) return
    selected.value[2] = hit
    selected.value[3] = null
    selected.value.street = null
    const dList = childrenOf(3, hit.code)
    selected.value[3] = dList[0] || null
    wheels.value[2] = { title: LEVEL_TITLES[2], list: dList, index: 0 }
    nextTick(() => setWheelScroll(2, 0))
  } else if (ci === 2) {
    if (selected.value[3]?.code === hit.code) return
    selected.value[3] = hit
    selected.value.street = null
  }
}

function pollSettle() {
  if (touching || !settledOnce) return
  let stable = true
  const idxs = []
  for (let i = 0; i < 3; i++) {
    const el = wheelEls[i]
    if (!el) return
    const top = Math.round(el.scrollTop)
    if (prevTop[i] !== null && top !== prevTop[i]) stable = false
    prevTop[i] = top
    idxs.push(scrollWheel(i))
  }
  if (!stable) return
  for (let i = 0; i < 3; i++) {
    if (idxs[i] !== lastIdx[i]) applyWheel(i, idxs[i])
  }
  lastIdx = idxs.slice()
}

function onTouch(down) { touching = down }
function startPoll() {
  stopPoll()
  touching = false
  prevTop = [null, null, null]
  lastIdx = [-1, -1, -1]
  settledOnce = false
  pollTimer = setInterval(pollSettle, 120)
  // 首帧后允许轮询，避免初始定位被当成滚动
  nextTick(() => setTimeout(() => { settledOnce = true }, 120))
}
function stopPoll() { clearInterval(pollTimer); pollTimer = null }
onBeforeUnmount(stopPoll)

// 由传入文本反查并定位各级（编辑已有地址时回显）
function locateByText() {
  const find = (level, name, parentCode) => {
    if (!name) return null
    const list = childrenOf(level, parentCode)
    return list.find(r => r.name === name) || list.find(r => r.name.includes(name) || name.includes(r.name)) || null
  }
  const p = find(1, props.province, '')
  const c = p ? find(2, props.city, p.code) : null
  const d = c ? find(3, props.district, c.code) : null
  const s = d ? find(4, props.street, d.code) : null
  selected.value = { 1: p, 2: c, 3: d, street: s }
  initialSig = [props.province, props.city, props.district].join('|')
  rebuildFromSelection()
}

function confirm() {
  const s = selected.value
  // 打开后没滚动就确认：原样回传，避免脏数据/地区改名时被悄悄改成第一项
  if (initialSig && pathText.value.split(' / ').slice(0, 3).join('|') === initialSig) {
    emit('confirm', { province: props.province, city: props.city, district: props.district, street: props.street })
    return
  }
  emit('confirm', {
    province: s[1]?.name || '',
    city: s[2]?.name || '',
    district: s[3]?.name || '',
    street: s.street?.name || ''
  })
}

watch(() => [props.province, props.city, props.district, props.street].join('|'), () => {
  if (all.value.length) { locateByText(); startPoll() }
})

;(async () => {
  try {
    const { data } = await api.get('/api/geo/regions')
    all.value = data?.data?.regions || []
  } catch { all.value = [] }
  finally { locateByText(); startPoll() }
})()
</script>

<style scoped>
.rp-wrap { min-height: 260px; }
.rp-cols { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.rp-col { min-width: 0; }
.rp-col-title { font-size: 12px; font-weight: 700; color: var(--primary, #2563eb); padding: 6px 8px; border-bottom: 2px solid var(--primary, #2563eb); margin-bottom: 6px; }
/* 滚轮：每项 40px，上下各留 80px 让首尾项能停在中间高亮行 */
.rp-wheel { height: 200px; overflow-y: auto; scroll-snap-type: y mandatory; scrollbar-width: none; -ms-overflow-style: none; overscroll-behavior: contain; position: relative; }
.rp-wheel::-webkit-scrollbar { display: none; }
.rp-wheel-pad { height: 80px; }
.rp-item { display: block; width: 100%; height: 40px; line-height: 40px; scroll-snap-align: center; text-align: center; font-size: 13px; color: var(--text, #0f172a); border-radius: 8px; }
.rp-item.on { background: var(--primary, #2563eb); color: #fff; font-weight: 700; }
.rp-street { margin-top: 14px; }
.rp-street-chips { display: flex; flex-wrap: wrap; gap: 8px; max-height: 92px; overflow-y: auto; }
.chip { font-size: 12px; padding: 5px 11px; border-radius: 999px; border: 1px solid var(--line, #e8edf4); background: var(--bg-page, #f4f6fb); color: var(--muted, #6b7688); }
.chip.on { background: var(--primary, #2563eb); border-color: var(--primary, #2563eb); color: #fff; font-weight: 700; }
.rp-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--line, #e8edf4); }
.rp-path { flex: 1; min-width: 0; }
@media (max-width: 400px) {
  .rp-wheel { height: 180px; }
}
</style>
