<template>
  <!--
    省市区三列同屏滚轮（H5）——视觉对齐 MShop 的 van-picker 标准 iOS 滚轮：
    上下渐变遮罩 + 贯穿三列的细横线 + 44px 项高 + 6 行可见 + 统一工具栏。
    纯手写实现，不引入 vant（服务器自动更新只做 git pull+build，不会 npm install 新依赖，
    曾因 import vant 导致线上构建失败回滚）。数据仍用 /api/geo/regions（地区唯一真相源）。
  -->
  <div class="rp-host">
    <div class="rp-toolbar">
      <button class="rp-action rp-cancel" @click="emit('close')">取消</button>
      <span class="rp-title">选择所在地区</span>
      <button class="rp-action rp-confirm" @click="confirm">确定</button>
    </div>
    <div v-if="!ready" class="rp-loading small muted">地区数据加载中…</div>
    <div v-else ref="columnsRef" class="rp-columns">
      <!-- 贯穿三列的选中横线（不是每列一个圆角蓝框） -->
      <div class="rp-frame" aria-hidden="true"></div>
      <!-- 上下渐变遮罩，消除滚轮硬切边 -->
      <div class="rp-mask" aria-hidden="true"></div>
      <div v-for="(col, ci) in wheels" :key="ci" class="rp-column" :ref="el => setWheelRef(el, ci)">
        <div class="rp-pad"></div>
        <button
          v-for="(r, ri) in col.list" :key="r.code"
          class="rp-item"
          :class="{ sel: ri === col.index }"
          @click="clickItem(ci, ri)"
        >{{ r.name }}</button>
        <div class="rp-pad"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * 省市区三列同屏滚轮：scrollTop 轮询检测停驻（不依赖 transitionend，部分 WebView 会丢该事件
 * 导致不联动，见 MShop pickup/Apply.vue、Verify.vue 实踩），手指按住时不提交，停稳后重建下级列。
 * 视觉复刻 van-picker：44px 项高、上下渐变遮罩、贯穿横线、无每列独立标题。
 */
import { ref, nextTick, onBeforeUnmount } from 'vue'
import api from '../api'

const props = defineProps({
  province: { type: String, default: '' },
  city: { type: String, default: '' },
  district: { type: String, default: '' },
  street: { type: String, default: '' }
})
const emit = defineEmits(['confirm', 'close'])

const ITEM_H = 44       // 与 .rp-item 高度一致
const VISIBLE = 6       // 可见行数，与 .rp-columns height = 44*6 一致
const PAD = ((VISIBLE - 1) / 2) * ITEM_H // 上下留白，让首尾项能停在中间横线

const ready = ref(false)
const columnsRef = ref(null)
const all = ref([])
const selected = ref({ 1: null, 2: null, 3: null })
const wheels = ref([
  { list: [], index: 0 },
  { list: [], index: 0 },
  { list: [], index: 0 }
])

function childrenOf(level, parentCode) {
  return all.value.filter(r => r.level === level && (level === 1 ? !r.parent_code : r.parent_code === parentCode))
}
const findByText = (list, name) => {
  if (!name) return null
  return list.find(r => r.name === name) || list.find(r => r.name.includes(name) || name.includes(r.name)) || null
}

// 打开时的原值：用户没动过滚轮就原样回传，已有地区不在下拉数据里也不会被悄悄改成第一项
let initialVal = { province: '', city: '', district: '', street: '' }
let dirty = false

const wheelEls = [null, null, null]
function setWheelRef(el, ci) { if (el) wheelEls[ci] = el }
let pollTimer = null
let touching = false
let prevTop = [null, null, null]
let lastIdx = [-1, -1, -1]
let settledOnce = false
let firstPoll = true

function setWheelScroll(ci, idx, smooth = false) {
  const el = wheelEls[ci]
  if (!el) return
  const top = Math.max(0, idx) * ITEM_H
  try { el.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' }) }
  catch { el.scrollTop = top }
}
function scrollWheel(ci) {
  const el = wheelEls[ci]
  if (!el || !wheels.value[ci]?.list.length) return -1
  const idx = Math.round(el.scrollTop / ITEM_H)
  return Math.max(0, Math.min(wheels.value[ci].list.length - 1, idx))
}
function childList(level, parent) {
  return parent ? childrenOf(level, parent.code) : []
}

function rebuildFromSelection() {
  const s = selected.value
  const pList = childrenOf(1, '')
  const p = s[1] && pList.some(x => x.code === s[1].code) ? s[1] : (pList[0] || null)
  const cList = childList(2, p)
  const c = s[2] && cList.some(x => x.code === s[2].code) ? s[2] : (cList[0] || null)
  const dList = childList(3, c)
  const d = s[3] && dList.some(x => x.code === s[3].code) ? s[3] : (dList[0] || null)
  wheels.value = [
    { list: pList, index: Math.max(0, pList.findIndex(x => x.code === p?.code)) },
    { list: cList, index: Math.max(0, cList.findIndex(x => x.code === c?.code)) },
    { list: dList, index: Math.max(0, dList.findIndex(x => x.code === d?.code)) }
  ]
  nextTickScroll()
}
function nextTickScroll() {
  // 必须等 Vue 把新的 list 渲染进 DOM 再滚，否则 wheelEls 里还是旧选项、scrollTo 落空
  nextTick(() => wheels.value.forEach((_, i) => setWheelScroll(i, wheels.value[i].index)))
}

function clickItem(ci, ri) {
  setWheelScroll(ci, ri, true)
  applyWheel(ci, ri)
}
function applyWheel(ci, idx) {
  const list = wheels.value[ci]?.list || []
  const hit = list[idx]
  if (!hit) return
  dirty = true
  if (ci === 0) {
    if (selected.value[1]?.code === hit.code) return
    selected.value[1] = hit
    selected.value[2] = null; selected.value[3] = null
    const cList = childrenOf(2, hit.code)
    const c = cList[0] || null
    selected.value[2] = c
    const dList = c ? childrenOf(3, c.code) : []
    selected.value[3] = dList[0] || null
    wheels.value[1] = { list: cList, index: 0 }
    wheels.value[2] = { list: dList, index: 0 }
    nextTick(() => { setWheelScroll(1, 0); setWheelScroll(2, 0) })
  } else if (ci === 1) {
    if (selected.value[2]?.code === hit.code) return
    selected.value[2] = hit
    selected.value[3] = null
    const dList = childrenOf(3, hit.code)
    selected.value[3] = dList[0] || null
    wheels.value[2] = { list: dList, index: 0 }
    nextTick(() => setWheelScroll(2, 0))
  } else if (ci === 2) {
    if (selected.value[3]?.code === hit.code) return
    selected.value[3] = hit
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
  // 首帧只记账：初始定位的 scrollTo 不能当成用户滚动
  if (!firstPoll) {
    for (let i = 0; i < 3; i++) {
      if (idxs[i] !== lastIdx[i]) applyWheel(i, idxs[i])
      if (wheels.value[i] && wheels.value[i].index !== idxs[i]) wheels.value[i].index = idxs[i]
    }
  }
  lastIdx = idxs.slice()
  firstPoll = false
}

function startPoll() {
  stopPoll()
  touching = false
  prevTop = [null, null, null]
  lastIdx = [-1, -1, -1]
  settledOnce = false
  firstPoll = true
  pollTimer = setInterval(pollSettle, 120)
  nextTick(() => {
    const host = columnsRef.value
    if (host && !host.dataset.pollBound) {
      host.dataset.pollBound = '1'
      host.addEventListener('touchstart', () => { touching = true }, { passive: true })
      const onUp = () => { touching = false; prevTop = [null, null, null] }
      host.addEventListener('touchend', onUp, { passive: true })
      host.addEventListener('touchcancel', onUp, { passive: true })
    }
    setTimeout(() => { settledOnce = true }, 150)
  })
}
function stopPoll() { clearInterval(pollTimer); pollTimer = null }

function locate() {
  const p = findByText(childrenOf(1, ''), props.province) || childrenOf(1, '')[0] || null
  const cList = p ? childrenOf(2, p.code) : []
  const c = findByText(cList, props.city) || cList[0] || null
  const dList = c ? childrenOf(3, c.code) : []
  const d = findByText(dList, props.district) || dList[0] || null
  selected.value = { 1: p, 2: c, 3: d }
  initialVal = { province: props.province, city: props.city, district: props.district, street: props.street }
  dirty = false
  rebuildFromSelection()
}

function confirm() {
  if (!dirty && (initialVal.province || initialVal.city || initialVal.district)) {
    emit('confirm', { ...initialVal })
    return
  }
  const s = selected.value
  emit('confirm', {
    province: s[1]?.name || '',
    city: s[2]?.name || '',
    district: s[3]?.name || '',
    street: props.street || ''
  })
}

;(async () => {
  try {
    const { data } = await api.get('/api/geo/regions')
    all.value = data?.data?.regions || []
  } catch { all.value = [] }
  finally {
    // ⚠️ 必须等 v-if="ready" 的滚轮 DOM 渲染完再 locate：否则 wheelEls 还是 null，
    // setWheelScroll 直接 return，三列停在默认第一项（北京/…），传入的地区值根本没生效。
    ready.value = true
    nextTick(() => { locate(); startPoll() })
  }
})()

onBeforeUnmount(stopPoll)
</script>

<style scoped>
.rp-host { background: var(--bg-card, #fff); }
.rp-toolbar { display: flex; align-items: center; justify-content: space-between; height: 44px; padding: 0 4px; border-bottom: 1px solid var(--line, #eef2f7); }
.rp-action { font-size: 14px; padding: 8px 10px; color: var(--muted, #6b7688); }
.rp-confirm { color: var(--primary, #2563eb); font-weight: 700; }
.rp-title { font-size: 15px; font-weight: 700; color: var(--text, #0f172a); }
.rp-loading { padding: 60px 0; text-align: center; }
.rp-columns { position: relative; display: flex; height: 264px; overflow: hidden; }
/* 贯穿三列的选中横线：1px 上下细线，无圆角无填充（van-picker frame 同款） */
.rp-frame { position: absolute; top: 50%; left: 0; right: 0; height: 44px; transform: translateY(-50%); border-top: 1px solid var(--line, #e5e7eb); border-bottom: 1px solid var(--line, #e5e7eb); pointer-events: none; z-index: 2; }
/* 上下渐变遮罩：消除硬切边，让滚轮看起来连续 */
.rp-mask { position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 1; pointer-events: none; background-image: linear-gradient(180deg, var(--bg-card, #fff) 0%, rgba(255,255,255,.1) 100%), linear-gradient(0deg, var(--bg-card, #fff) 0%, rgba(255,255,255,.1) 100%); background-position: top, bottom; background-size: 100% 50%; background-repeat: no-repeat; }
.rp-column { flex: 1; min-width: 0; height: 264px; overflow-y: auto; scroll-snap-type: y mandatory; scrollbar-width: none; -ms-overflow-style: none; overscroll-behavior: contain; }
.rp-column::-webkit-scrollbar { display: none; }
.rp-pad { height: 110px; }
.rp-item { display: block; width: 100%; height: 44px; line-height: 44px; scroll-snap-align: center; text-align: center; font-size: 16px; color: var(--text, #0f172a); background: transparent; }
.rp-item.sel { font-weight: 600; color: var(--primary, #2563eb); }
</style>
