<template>
  <svg class="app-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"
       :fill="isBrand ? 'currentColor' : 'none'"
       :stroke="isBrand ? 'none' : 'currentColor'"
       :style="{ width: size + 'px', height: size + 'px', color: color || iconColor || 'currentColor' }"
       stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" v-html="pathData" />
</template>

<script setup>
import { computed } from 'vue'
import { BRAND_ICONS, FUNC_ICONS } from '../utils/icons'

const props = defineProps({
  name: { type: String, required: true },
  color: { type: String, default: '' },
  size: { type: [Number, String], default: 20 }
})

// 品牌图标（simple-icons）是实心 path；功能图标是描边 path。
const isBrand = computed(() => !!BRAND_ICONS[props.name])
const icon = computed(() => BRAND_ICONS[props.name] || FUNC_ICONS[props.name] || FUNC_ICONS.link)
const iconColor = computed(() => isBrand.value ? (icon.value.color || '') : '')
const pathData = computed(() => icon.value.path)
</script>

<style scoped>
.app-icon { display: block; flex: 0 0 auto; }
</style>
