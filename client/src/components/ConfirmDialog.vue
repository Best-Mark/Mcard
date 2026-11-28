<template>
  <!-- 项目统一确认弹层（2026-11-28 用户定稿「所有提示样式一定要与项目搭配」）：替代浏览器原生 confirm。
       轻奢去线条：居中小卡、留白分层、无描边/分割线；主按钮实心（danger 时红）、次按钮纯文字；
       复用全局 .modal-mask/.modal（z-index 900，高于全站常驻条与编辑器弹层）。 -->
  <transition name="cf">
    <div v-if="show" class="modal-mask cf-mask" @click.self="cancel">
      <div class="modal cf-card" role="dialog" aria-modal="true" :aria-label="title">
        <b class="cf-title">{{ title }}</b>
        <p class="cf-text">{{ text }}</p>
        <div class="cf-actions">
          <button type="button" class="cf-btn-ghost" @click="cancel">{{ cancelText }}</button>
          <button type="button" :class="['cf-btn-main', { danger }]" @click="$emit('confirm')">{{ confirmText }}</button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
defineProps({
  show: Boolean,
  title: { type: String, default: '确认操作' },
  text: { type: String, default: '' },
  confirmText: { type: String, default: '确定' },
  cancelText: { type: String, default: '取消' },
  danger: Boolean
})
const emit = defineEmits(['confirm', 'cancel'])
function cancel() { emit('cancel') }
</script>

<style scoped>
.cf-mask { align-items: center; }
.cf-card { width: min(100%, 320px); padding: 24px 22px 18px; box-sizing: border-box; }
.cf-title { display: block; font-size: 16px; font-weight: 800; color: #1f2937; letter-spacing: .5px; }
.cf-text { margin: 10px 0 0; font-size: 14px; line-height: 1.7; color: #6b7280; word-break: break-all; }
.cf-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-top: 20px; }
.cf-btn-ghost { border: 0; background: none; padding: 10px 14px; font-size: 14px; font-weight: 700; color: #6b7280; cursor: pointer; -webkit-tap-highlight-color: transparent; border-radius: 10px; }
.cf-btn-ghost:active { background: #f5f3f0; }
.cf-btn-main { border: 0; padding: 10px 22px; font-size: 14px; font-weight: 700; color: #fff; background: var(--primary, #a62b2b); border-radius: 999px; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.cf-btn-main:active { filter: brightness(.92); }
.cf-btn-main.danger { background: #b91c1c; }
/* 老内核过渡降级：不支持动画时直接显隐，无害 */
.cf-enter-active, .cf-leave-active { transition: opacity .18s ease; }
.cf-enter-from, .cf-leave-to { opacity: 0; }
</style>
