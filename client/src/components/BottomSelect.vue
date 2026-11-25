<template>
  <!-- 移动端统一选择器：触发项 + 底部弹窗选项，替代网页原生 select（强制约定见 .codebuddy/rules/ui-conventions.md） -->
  <div class="bsel" :class="{ disabled: disabled }">
    <button type="button" class="bsel-trigger" :class="triggerClass" :disabled="disabled" @click="open = true">
      <span class="bsel-label" :title="currentLabel">{{ currentLabel || placeholder }}</span>
      <span class="bsel-arrow">›</span>
    </button>
    <BottomSheet :show="open" @update:show="open = $event">
      <div class="bsel-head"><b>{{ title }}</b><button class="btn btn-sm btn-ghost" @click="open = false">关闭</button></div>
      <div class="bsel-list">
        <button v-for="op in normalized" :key="String(op.value)" class="bsel-option" :class="{ on: op.value === modelValue }" @click="pick(op.value)">
          <span>{{ op.label }}</span><span v-if="op.value === modelValue" class="bsel-check">✓</span>
        </button>
      </div>
    </BottomSheet>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import BottomSheet from './BottomSheet.vue'

const props = defineProps({
  modelValue: { type: [String, Number, Boolean], default: '' },
  options: { type: Array, default: () => [] }, // [{ value, label }] 或 ['a','b']
  title: { type: String, default: '请选择' },
  placeholder: { type: String, default: '未选择' },
  disabled: { type: Boolean, default: false },
  triggerClass: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue', 'change'])
const open = ref(false)
const normalized = computed(() => props.options.map(o =>
  (o !== null && typeof o === 'object' && 'value' in o) ? o : { value: o, label: String(o) }
))
const currentLabel = computed(() => normalized.value.find(o => o.value === props.modelValue)?.label || '')
function pick(v) {
  emit('update:modelValue', v)
  emit('change', v)
  open.value = false
}
</script>

<style scoped>
.bsel { display: block; }
.bsel.disabled { opacity: .55; }
.bsel-trigger { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 9px 12px; border: 1px solid var(--line, #e8edf4); border-radius: 8px; background: #fff; color: var(--text, #162033); font-size: 14px; text-align: left; }
.bsel-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bsel-arrow { color: var(--muted, #6b7688); font-size: 18px; flex: 0 0 auto; }
.bsel-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--line); }
.bsel-list { max-height: 56vh; overflow-y: auto; overscroll-behavior: contain; padding: 6px 0 10px; }
.bsel-option { width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 13px 18px; font-size: 14px; border-bottom: 1px solid var(--line); }
/* 先给老 WebView 认识的纯色底，再用 color-mix 覆盖成淡主题色（不支持则保留前者） */
.bsel-option.on { color: var(--primary, #2563eb); font-weight: 700; background: #f0f6ff; background: color-mix(in srgb, var(--primary, #2563eb) 6%, transparent); }
.bsel-check { color: var(--primary, #2563eb); font-weight: 800; }
</style>
