<template>
  <div class="scroll-chips" :class="{ 'sc-left': canLeft, 'sc-right': canRight }">
    <div ref="track" class="sc-track" @scroll="onScroll" @click.capture="onClickCapture">
      <slot />
    </div>
  </div>
</template>

<script setup>
// 单行横向滑动容器：移动端手指滑动；PC 端滚轮转横向 + 按住拖拽。
// 两端渐隐遮罩提示「还有更多」，替代生硬的方向箭头，任意主题下与卡片背景同色。
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'

const props = defineProps({
  resetKey: { type: [String, Number], default: '' }
})

const track = ref(null)
const canLeft = ref(false)
const canRight = ref(false)
let ro = null
let dragging = false
let moved = false
let startX = 0
let startScroll = 0

function measure() {
  const el = track.value
  if (!el) return
  const max = el.scrollWidth - el.clientWidth
  canLeft.value = el.scrollLeft > 2
  canRight.value = el.scrollLeft < max - 2
}
function onScroll() { measure() }
watch(() => props.resetKey, () => nextTick(measure))

// PC：垂直滚轮在 chips 上转为横向滚动（到两端后放行页面纵向滚动，不劫持整页）
function onWheel(e) {
  const el = track.value
  if (!el) return
  const max = el.scrollWidth - el.clientWidth
  if (max <= 2) return
  const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
  if (!delta) return
  const next = el.scrollLeft + delta
  if ((delta > 0 && el.scrollLeft < max - 1) || (delta < 0 && el.scrollLeft > 1)) {
    e.preventDefault()
    el.scrollLeft = Math.max(0, Math.min(max, next))
  }
}

// PC：按住拖拽滑动（指针 event 统一处理；移动端仍走原生 touch，不干扰）
function onPointerDown(e) {
  if (e.pointerType === 'touch') return
  const el = track.value
  if (!el) return
  dragging = true
  moved = false
  startX = e.clientX
  startScroll = el.scrollLeft
  el.setPointerCapture?.(e.pointerId)
}
function onPointerMove(e) {
  if (!dragging) return
  const el = track.value
  if (!el) return
  const dx = e.clientX - startX
  if (Math.abs(dx) > 4) moved = true
  el.scrollLeft = startScroll - dx
}
function onPointerUp() { dragging = false }
// 拖拽产生的 click 不应触发 chip 筛选
function onClickCapture(e) {
  if (moved) { e.stopPropagation(); e.preventDefault(); moved = false }
}

onMounted(() => {
  const el = track.value
  if (!el) return
  nextTick(measure)
  el.addEventListener('wheel', onWheel, { passive: false })
  el.addEventListener('pointerdown', onPointerDown)
  el.addEventListener('pointermove', onPointerMove)
  el.addEventListener('pointerup', onPointerUp)
  el.addEventListener('pointercancel', onPointerUp)
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(measure)
    ro.observe(el)
    Array.from(el.children).forEach(c => ro.observe(c))
  } else {
    window.addEventListener('resize', measure)
  }
})
onBeforeUnmount(() => {
  const el = track.value
  if (el) {
    el.removeEventListener('wheel', onWheel)
    el.removeEventListener('pointerdown', onPointerDown)
    el.removeEventListener('pointermove', onPointerMove)
    el.removeEventListener('pointerup', onPointerUp)
    el.removeEventListener('pointercancel', onPointerUp)
  }
  if (ro) ro.disconnect()
  else window.removeEventListener('resize', measure)
})
</script>

<style scoped>
.scroll-chips { position: relative; }
/* 两端渐隐：伪元素盖在轨道边缘，指示可滑动；用卡片背景色渐变到透明 */
.scroll-chips::before,
.scroll-chips::after { content: ''; position: absolute; top: 0; bottom: 4px; width: 36px; pointer-events: none; z-index: 2; opacity: 0; transition: opacity .18s; }
.scroll-chips::before { left: 0; background: linear-gradient(to right, var(--bg-card, #fff), transparent); }
.scroll-chips::after { right: 0; background: linear-gradient(to left, var(--bg-card, #fff), transparent); }
.scroll-chips.sc-left::before { opacity: 1; }
.scroll-chips.sc-right::after { opacity: 1; }
.sc-track { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; -webkit-overflow-scrolling: touch; scrollbar-width: none; -ms-overflow-style: none; cursor: grab; }
.sc-track:active { cursor: grabbing; }
.sc-track::-webkit-scrollbar { display: none; }
</style>
