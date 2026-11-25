<template>
  <!--
    省市区三列同屏滚轮（H5）——完整移植 MShop client/src/components/RegionTriplePicker.vue 的成熟交互。
    用 van-picker 的标准 iOS 滚轮（上下渐变遮罩 + 贯穿横线 + 44px 项高），替代原来的手写列表+圆角蓝框
    （那个版本三列像并排列表、顶部三条蓝色下划线标题、硬切边，视觉很怪）。
    数据源仍用 MCard 自己的 /api/geo/regions（地区唯一真相源），不引入第二份地区库。
  -->
  <div ref="hostRef" class="rp-host">
    <van-picker
      :columns="columns"
      :model-value="selValues"
      title="选择所在地区"
      confirm-button-text="确定"
      cancel-button-text="取消"
      @confirm="onConfirm"
      @cancel="emit('close')"
      @change="onPickerChange"
    />
  </div>
</template>

<script setup>
/**
 * 省市区三列同屏联动选择器（H5）——与 MShop RegionTriplePicker 同款：
 * · van-picker 普通三列（非级联树），三列始终同屏，不逐层下钻；
 * · 停驻检测轮询每列 wrapper 的 transform 位移驱动级联，不依赖 transitionend
 *   （部分 WebView 丢该事件导致转动不联动，见 MShop pickup/Apply.vue、Verify.vue 实踩）；
 * · 打开时按已有省市区文本反查编码定位三列；没动过就点确认则原样回传，绝不静默改成第一个省。
 */
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
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

// 街道（第 4 级）数据稀疏，仍由外层 CardEdit 以 chips 形式给出；本组件只管省/市/区三列。

const findByText = (list, name) => {
  if (!name) return null
  return list.find(r => r.name === name) || list.find(r => r.name.includes(name) || name.includes(r.name)) || null
}

// 由传入文本反查并定位三列；找不到时用「占位项」保住原值，确认时不会被悄悄改成第一项
function locate() {
  const p = findByText(provCol.value, props.province) || (props.province ? { code: `KEEP:${props.province}`, name: props.province } : null)
  const cList = p && !String(p.code).startsWith('KEEP:') ? childrenOf(2, p.code).map(toOption) : []
  const c = findByText(cList, props.city) || (props.city ? { code: `KEEP:${props.city}`, name: props.city } : null)
  const dList = c && !String(c.code).startsWith('KEEP:') ? childrenOf(3, c.code).map(toOption) : []
  const d = findByText(dList, props.district) || (props.district ? { code: `KEEP:${props.district}`, name: props.district } : null)

  cityCol.value = cList
  distCol.value = dList
  initialSel = [p?.code || cList[0]?.value || '', c?.code || dList[0]?.value || '', d?.code || '']
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
    sel[2] = (dList[0] || { text: '', value: '' }).value
  }
  const d2 = distCol.value[idxs[2]]
  if (d2 && d2.value !== sel[2]) sel[2] = d2.value
  selValues.value = sel
}

// van-picker 的 change 事件：省/市变化时同步重建下级列（轮询之外再兜一道，响应更快）
function onPickerChange({ columnIndex, selectedValues }) {
  const sel = selectedValues.slice()
  if (columnIndex === 0 && sel[0] !== initialSel[0]) {
    const cList = sel[0] && !String(sel[0]).startsWith('KEEP:') ? childrenOf(2, sel[0]).map(toOption) : []
    cityCol.value = cList
    sel[1] = cList[0]?.value || ''
    const dList = sel[1] ? childrenOf(3, sel[1]).map(toOption) : []
    distCol.value = dList
    sel[2] = dList[0]?.value || ''
    selValues.value = sel
  } else if (columnIndex === 1) {
    const dList = sel[1] && !String(sel[1]).startsWith('KEEP:') ? childrenOf(3, sel[1]).map(toOption) : []
    distCol.value = dList
    if (!dList.some(o => o.value === sel[2])) { sel[2] = dList[0]?.value || ''; selValues.value = sel }
  }
}

function startPoll() {
  stopPoll()
  touching = false
  prevTy = ['', '', '']
  lastIdx = [-1, -1, -1]
  settledOnce = false
  pollTimer = setInterval(pollSettle, 120)
  nextTick(() => setTimeout(() => { settledOnce = true }, 150))
}
function stopPoll() { clearInterval(pollTimer); pollTimer = null }

function onConfirm() {
  const sel = selValues.value || []
  const unchanged = sel.every((v, i) => v === initialSel[i])
  if (unchanged && (props.province || props.city || props.district)) {
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
  finally { locate(); startPoll() }
})()

watch(() => [props.province, props.city, props.district].join('|'), () => {
  if (all.value.length) { locate(); startPoll() }
})

onBeforeUnmount(stopPoll)
</script>

<style scoped>
/* 滚轮视觉全部沿用 van-picker 默认（渐变遮罩 + 贯穿横线 + 44px 项高），只做背景对齐 */
.rp-host { background: var(--bg-card, #fff); }
.rp-host :deep(.van-picker) { background: var(--bg-card, #fff); }
.rp-host :deep(.van-picker__columns) { height: 264px; }
.rp-host :deep(.van-picker-column__item) { font-size: 15px; color: var(--text, #0f172a); }
</style>
