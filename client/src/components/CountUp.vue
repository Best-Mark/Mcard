<template>
  <span class="count-up">{{ display }}</span>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'

// 数字滚动动效：从 0 缓动到目标值，支持千分位/前后缀/小数位/延迟。
// 兼容：尊重系统「减少动态效果」设置；组件卸载时取消 rAF，避免内存泄漏与回调竞态。
const props = defineProps({
  value: { type: [Number, String], default: 0 },
  duration: { type: Number, default: 1400 },
  decimals: { type: Number, default: 0 },
  prefix: { type: String, default: '' },
  suffix: { type: String, default: '' },
  delay: { type: Number, default: 0 }
})

const display = ref(props.prefix + '0' + props.suffix)
let rafId = null

function format(n) {
  const v = Number(n) || 0
  return v.toFixed(props.decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function cancel() {
  if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null }
}

function run() {
  cancel()
  const target = Number(props.value) || 0
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (reduced || props.duration <= 0) {
    display.value = props.prefix + format(target) + props.suffix
    return
  }
  const startAt = performance.now() + props.delay
  const step = now => {
    if (now < startAt) { rafId = requestAnimationFrame(step); return }
    const p = Math.min(1, (now - startAt) / props.duration)
    const eased = 1 - Math.pow(1 - p, 4) // easeOutQuart：起步快、收尾稳
    display.value = props.prefix + format(target * eased) + props.suffix
    if (p < 1) rafId = requestAnimationFrame(step)
    else rafId = null
  }
  rafId = requestAnimationFrame(step)
}

onMounted(run)
watch(() => props.value, run)
onBeforeUnmount(cancel)
</script>

<style scoped>
.count-up { font-variant-numeric: tabular-nums; font-feature-settings: 'tnum'; }
</style>
