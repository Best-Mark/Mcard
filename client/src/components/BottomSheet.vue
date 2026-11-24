<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="show" class="bs-mask" @click.self="close">
        <div class="bs-panel" :class="{ wide: wide }" :style="panelStyle">
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  wide: { type: Boolean, default: false },
  height: { type: String, default: '' }
})
const emit = defineEmits(['update:show', 'close'])
const panelStyle = computed(() => props.height ? { height: props.height } : {})
function close() { emit('update:show', false); emit('close') }
</script>

<style scoped>
.bs-mask { position: fixed; inset: 0; z-index: 9999; background: rgba(15,23,42,.55); display: flex; align-items: flex-end; }
.bs-panel { width: 100%; max-height: 88vh; background: #fff; border-radius: 20px 20px 0 0; box-shadow: 0 -12px 40px rgba(15,23,42,.2); overflow: hidden; display: flex; flex-direction: column; padding-bottom: env(safe-area-inset-bottom); }
.bs-panel.wide { max-width: 720px; margin: 0 auto; border-radius: 20px 20px 0 0; }
.sheet-enter-active, .sheet-leave-active { transition: opacity .2s; }
.sheet-enter-active .bs-panel, .sheet-leave-active .bs-panel { transition: transform .24s; }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
.sheet-enter-from .bs-panel, .sheet-leave-to .bs-panel { transform: translateY(100%); }
</style>
