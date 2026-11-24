<template>
  <div class="scroll-chips">
    <button v-if="canLeft" class="sc-arrow left" aria-label="向左" @click="scrollBy(-1)">‹</button>
    <div ref="track" class="sc-track" @scroll="onScroll">
      <slot />
    </div>
    <button v-if="canRight" class="sc-arrow right" aria-label="向右" @click="scrollBy(1)">›</button>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'

const props = defineProps({
  // 外部数据变化时重新测量（如定位完成后新增「当前城市」标签）
  resetKey: { type: [String, Number], default: '' }
})

const track = ref(null)
const canLeft = ref(false)
const canRight = ref(false)
let ro = null

function measure() {
  const el = track.value
  if (!el) return
  const max = el.scrollWidth - el.clientWidth
  canLeft.value = el.scrollLeft > 2
  canRight.value = el.scrollLeft < max - 2
}
function onScroll() { measure() }
watch(() => props.resetKey, () => nextTick(measure))
function scrollBy(dir) {
  const el = track.value
  if (!el) return
  el.scrollBy({ left: dir * Math.max(220, el.clientWidth * 0.7), behavior: 'smooth' })
}

onMounted(() => {
  nextTick(measure)
  if (typeof ResizeObserver !== 'undefined' && track.value) {
    ro = new ResizeObserver(measure)
    ro.observe(track.value)
    Array.from(track.value.children).forEach(c => ro.observe(c))
  } else {
    window.addEventListener('resize', measure)
  }
})
onBeforeUnmount(() => {
  if (ro) ro.disconnect()
  else window.removeEventListener('resize', measure)
})
</script>

<script>
export default { inheritAttrs: false }
</script>

<style scoped>
.scroll-chips { position: relative; }
.sc-track { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; -webkit-overflow-scrolling: touch; scrollbar-width: none; -ms-overflow-style: none; }
.sc-track::-webkit-scrollbar { display: none; }
.sc-arrow { position: absolute; top: 50%; transform: translateY(-50%); z-index: 2; width: 34px; height: 34px; border-radius: 50%; border: 1px solid #dbe3ef; background: #fff; color: #2563eb; font-size: 22px; line-height: 1; font-weight: 700; cursor: pointer; box-shadow: 0 4px 14px rgba(15,23,42,.16); display: grid; place-items: center; padding: 0 0 3px; }
.sc-arrow:hover { background: #eff6ff; }
.sc-arrow.left { left: -12px; }
.sc-arrow.right { right: -12px; }
</style>
