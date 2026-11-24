<template>
  <div class="scroll-chips" :class="{ 'sc-wrap': isPC }">
    <div class="sc-track">
      <slot />
    </div>
  </div>
</template>

<script setup>
// PC 桌面：行业数量有限，改为换行全部展示（一眼看全，无需滑动/方向符）；
// 移动端保持横向滑动（触摸滑动自然）。复用 device.js 的 isPC，响应窗口缩放实时切换。
import { isPC } from '../utils/device'
</script>

<style scoped>
.scroll-chips { position: relative; }
.sc-track { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; -webkit-overflow-scrolling: touch; scrollbar-width: none; -ms-overflow-style: none; }
.sc-track::-webkit-scrollbar { display: none; }
/* 桌面壳内：flex 换行，全部 chips 一行放不下就折到第二行，不再需要横向滑动 */
.sc-wrap .sc-track { flex-wrap: wrap; overflow-x: visible; row-gap: 8px; padding-bottom: 0; }
</style>
