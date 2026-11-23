<template>
  <canvas ref="cv" class="particle-field" aria-hidden="true"></canvas>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  color: { type: String, default: '#8bd3ff' },
  line: { type: String, default: 'rgba(139,211,255,.30)' },
  density: { type: Number, default: 1 }
})

const cv = ref(null)
let ctx = null
let raf = 0
let particles = []
let w = 0
let h = 0
let dpr = 1
let reduced = false

function resize() {
  if (!cv.value || !ctx) return
  const rect = cv.value.getBoundingClientRect()
  dpr = Math.min(2, window.devicePixelRatio || 1)
  w = rect.width
  h = rect.height
  cv.value.width = Math.max(1, Math.round(w * dpr))
  cv.value.height = Math.max(1, Math.round(h * dpr))
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const n = Math.max(22, Math.min(96, Math.round((w / 15) * props.density)))
  particles = Array.from({ length: n }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.34,
    vy: (Math.random() - 0.5) * 0.34,
    r: Math.random() * 1.5 + 0.7
  }))
}

function draw() {
  if (!ctx) return
  ctx.clearRect(0, 0, w, h)
  for (const p of particles) {
    p.x += p.vx
    p.y += p.vy
    if (p.x < 0 || p.x > w) p.vx *= -1
    if (p.y < 0 || p.y > h) p.vy *= -1
  }
  const LINK = 132
  ctx.lineWidth = 0.6
  ctx.strokeStyle = props.line
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const a = particles[i]
      const b = particles[j]
      const dx = a.x - b.x
      const dy = a.y - b.y
      const d2 = dx * dx + dy * dy
      if (d2 < LINK * LINK) {
        ctx.globalAlpha = 1 - Math.sqrt(d2) / LINK
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      }
    }
  }
  ctx.globalAlpha = 1
  ctx.fillStyle = props.color
  for (const p of particles) {
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
    ctx.fill()
  }
}

function loop() {
  draw()
  raf = requestAnimationFrame(loop)
}

onMounted(() => {
  ctx = cv.value.getContext('2d')
  reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  resize()
  requestAnimationFrame(resize)
  window.addEventListener('resize', resize)
  if (reduced) draw()
  else loop()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', resize)
})
</script>

<style scoped>
.particle-field { position: absolute; inset: 0; width: 100%; height: 100%; display: block; pointer-events: none; }
</style>
