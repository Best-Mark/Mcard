<template>
  <!--
    省市区三列同屏滚轮（H5）——严格对齐 MShop client/src/components/RegionTriplePicker.vue：
    van-picker 标准 iOS 滚轮（上下渐变遮罩 + 贯穿横线 + 44px 项高 + 6 行可见），
    替代原来手写列表 + 三列圆角蓝框 + 三条蓝色下划线标题（用户反馈"很怪"的观感来源）。
    数据源仍用 MCard 自己的 /api/geo/regions（地区唯一真相源），不引入第二份地区库。
  -->
  <div v-if="ready" ref="hostRef" class="rp-host">
    <van-picker
      :columns="columns"
      :model-value="selValues"
      title="选择所在地区"
      confirm-button-text="确定"
      cancel-button-text="取消"
      @confirm="onConfirm"
      @cancel="emit('close')"
    />
  </div>
  <div v-else class="rp-loading small muted">地区数据加载中…</div>
</template>

<script setup>
/**
 * 省市区三列联动选择器（H5）——逻辑逐行对齐 MShop RegionTriplePicker（已上线验证）：
 * · van-picker 普通三列（非级联树），三列始终同屏，不逐层下钻；
 * · 停驻检测轮询每列 wrapper 的 transform 位移驱动级联，不依赖 transitionend
 *   （部分 WebView 丢该事件导致转动不联动，见 MShop pickup/Apply.vue、Verify.vue 实踩）；
 * · 打开时按已有省市区文本反查编码定位三列；没动过就点确定则原样回传，绝不静默改成第一个省。
 */
import { ref, computed, onBeforeUnmount } from 'vue'
import { Picker as VanPicker } from 'vant'
import 'vant/es/picker/index.css'
import api from '../api'

const props = defineProps({
  province: { type: String, default: '' },
  city: { type: String, default: '' },
  district: { type: String, default: '' },
  street: { type: String, default: '' }
})
const emit = defineEmits(['confirm', 'close'])

const hostRef = ref(null)
const ready = ref(false)
const all = ref([])
const selValues = ref(['', '', ''])
let initialSel = ['', '', '']

function childrenOf(level, parentCode) {
  return all.value.filter(r => r.level === level && (level === 1 ? !r.parent_code : r.parent_code === parentCode))
}
const toOption = r => ({ text: r.name, value: r.code })
const provCol = computed(() => childrenOf(1, '').map(toOption))
const cityCol = ref([])
const distCol = ref([])
const columns = computed(() => [provCol.value, cityCol.value, distCol.value])

// 街道（第 4 级）稀疏，仍由外层 CardEdit 以 chips 形式给出；本组件只管省/市/区三列。
const findByText = (list, name) => {
  if (!name) return null
  return list.find(r => r.name === name) || list.find(r => r.name.includes(name) || name.includes(r.name)) || null
}

// 由已有省市区文本反查编码定位三列（MShop locate 同款）；反算不到旧值时按首项停靠，
// 但靠 onConfirm 的 unchanged 判断保证「用户没动过就原样回传」，绝不悄悄改数据。
function locate() {
  const p = findByText(provCol.value, props.province) || provCol.value[0] || null
  const cList = p ? childrenOf(2, p.code).map(toOption) : []
  const c = findByText(cList, props.city) || cList[0] || null
  const dList = c ? childrenOf(3, c.code).map(toOption) : []
  const d = findByText(dList, props.district) || dList[0] || null
  cityCol.value = cList
  distCol.value = dList
  initialSel = [p?.code || '', c?.code || '', d?.code || '']
  selValues.value = initialSel.slice()
}

// 读一列滚轮当前停在哪个选项（按 transform 位移算，不依赖任何事件）
function readWheelIdx(colEl) {
  const wrapper = colEl.querySelector('.van-picker-column__wrapper')
  const items = colEl.querySelectorAll('.van-picker-column__item')
  if (!wrapper || !items.length) return -1
  const m = getComputedStyle(wrapper).transform || ''
  const parts = m.match(/matrix\(([^)]+)\)/)
  if (!parts) return -1
  const ty = parseFloat(parts[1].split(',')[5]) || 0
  const h = items[0].offsetHeight || 44
  const base = (colEl.clientHeight - h) / 2
  return Math.max(0, Math.min(items.length - 1, Math.round(-(ty - base) / h)))
}

let pollTimer = null
let prevTy = ['', '', '']
let lastIdx = [-1, -1, -1]
let touching = false
let settledOnce = false

function pollSettle() {
  if (touching || !settledOnce) return
  const host = hostRef.value
  if (!host) return
  const cols = host.querySelectorAll('.van-picker-column')
  if (cols.length < 3) return
  const idxs = []
  let stable = true
  for (let i = 0; i < 3; i++) {
    const wrapper = cols[i].querySelector('.van-picker-column__wrapper')
    const m = wrapper ? (getComputedStyle(wrapper).transform || '') : ''
    const parts = m.match(/matrix\(([^)]+)\)/)
    const ty = parts ? (parseFloat(parts[1].split(',')[5]) || 0) : 0
    const key = ty.toFixed(1)
    if (key !== prevTy[i]) stable = false
    prevTy[i] = key
    idxs.push(readWheelIdx(cols[i]))
  }
  if (!stable || idxs.some(v => v < 0)) return
  if (lastIdx[0] === idxs[0] && lastIdx[1] === idxs[1] && lastIdx[2] === idxs[2]) return
  lastIdx = idxs.slice()

  const sel = selValues.value.slice()
  // 省变化 → 重建市/区；市变化 → 重建区（MShop 同款，三列始终同屏）
  const p = provCol.value[idxs[0]]
  if (p && p.value !== sel[0]) {
    sel[0] = p.value
    const cList = childrenOf(2, p.value).map(toOption)
    cityCol.value = cList
    const c = cList[0] || { text: '', value: '' }
    sel[1] = c.value
    const dList = c.value ? childrenOf(3, c.value).map(toOption) : []
    distCol.value = dList
    sel[2] = (dList[0] || { text: '', value: '' }).value
  }
  const c2 = cityCol.value[idxs[1]]
  if (c2 && c2.value !== sel[1]) {
    sel[1] = c2.value
    const dList = childrenOf(3, c2.value).map(toOption)
    distCol.value = dList
    sel[2] = (dList.find(o => o.value === sel[2]) || dList[0] || { text: '', value: '' }).value
  }
  const d2 = distCol.value[idxs[2]]
  if (d2 && d2.value !== sel[2]) sel[2] = d2.value
  selValues.value = sel
}

function startPoll() {
  stopPoll()
  touching = false
  prevTy = ['', '', '']
  lastIdx = [-1, -1, -1]
  settledOnce = false
  pollTimer = setInterval(pollSettle, 120)
  nextTick(() => {
    const host = hostRef.value
    if (!host || host.dataset.pollBound) return
    host.dataset.pollBound = '1'
    host.addEventListener('touchstart', () => { touching = true }, { passive: true })
    const onUp = () => { touching = false; prevTy = ['', '', ''] }
    host.addEventListener('touchend', onUp, { passive: true })
    host.addEventListener('touchcancel', onUp, { passive: true })
    setTimeout(() => { settledOnce = true }, 150)
  })
}
function stopPoll() { clearInterval(pollTimer); pollTimer = null }

function onConfirm() {
  const sel = selValues.value || []
  // 打开后没动过、且原文非空：原样回传，避免脏数据/改名被悄悄改成第一个省市区
  if (sel.every((v, i) => v === initialSel[i]) && (props.province || props.city || props.district)) {
    emit('confirm', { province: props.province, city: props.city, district: props.district, street: props.street })
    return
  }
  const opt = (col, v) => col.find(o => o.value === v)?.text || ''
  emit('confirm', {
    province: opt(provCol.value, sel[0]),
    city: opt(cityCol.value, sel[1]),
    district: opt(distCol.value, sel[2]),
    street: ''
  })
}

;(async () => {
  try {
    const { data } = await api.get('/api/geo/regions')
    all.value = data?.data?.regions || []
  } catch { all.value = [] }
  finally {
    locate()
    ready.value = true
    startPoll()
  }
})()

onBeforeUnmount(stopPoll)
</script>

<style scoped>
/* 滚轮视觉全部沿用 van-picker 默认（渐变遮罩 + 贯穿横线 + 44px 项高），只做背景对齐 */
.rp-host { background: var(--bg-card, #fff); }
.rp-host :deep(.van-picker) { background: var(--bg-card, #fff); }
.rp-host :deep(.van-picker__columns) { height: 264px; }
.rp-host :deep(.van-picker-column__item) { font-size: 15px; color: var(--text, #0f172a); }
.rp-loading { padding: 40px 0; text-align: center; }
</style>
