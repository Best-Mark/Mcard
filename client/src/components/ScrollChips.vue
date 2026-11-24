<template>
  <div class="scroll-chips">
    <div class="sc-track">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.scroll-chips { position: relative; }
.sc-track { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; -webkit-overflow-scrolling: touch; scrollbar-width: none; -ms-overflow-style: none; }
.sc-track::-webkit-scrollbar { display: none; }
</style>
