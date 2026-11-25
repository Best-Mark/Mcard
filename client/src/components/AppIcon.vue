<template>
  <svg class="app-icon" :viewBox="icon.viewBox || '0 0 24 24'" aria-hidden="true" focusable="false"
       :fill="filled ? 'currentColor' : 'none'"
       :stroke="filled ? 'none' : 'currentColor'"
       :style="{ width: size + 'px', height: size + 'px', color: color || iconColor || 'currentColor' }"
       :stroke-width="icon.stroke ? 2.4 : 1.9" stroke-linecap="round" stroke-linejoin="round">
    <!-- 必须是真正的 <path> 节点：v-html 塞一段裸 d 字符串只会被 SVG 当文本，图标整排不可见 -->
    <path :d="pathData" />
  </svg>
</template>

<script setup>
import { computed } from 'vue'
import { BRAND_ICONS, FUNC_ICONS } from '../utils/icons'

const props = defineProps({
  name: { type: String, required: true },
  color: { type: String, default: '' },
  size: { type: [Number, String], default: 20 }
})

// 品牌图标（simple-icons）是实心 path；功能图标是描边 path；描边型品牌（高德等）例外。
const isBrand = computed(() => !!BRAND_ICONS[props.name])
const icon = computed(() => BRAND_ICONS[props.name] || FUNC_ICONS[props.name] || FUNC_ICONS.link)
const filled = computed(() => isBrand.value && !icon.value.stroke)
const iconColor = computed(() => isBrand.value ? (icon.value.color || '') : '')
const pathData = computed(() => icon.value.path)
</script>

<style scoped>
.app-icon { display: block; flex: 0 0 auto; }
</style>
