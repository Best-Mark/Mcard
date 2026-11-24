<template>
  <router-view v-slot="{ Component }">
    <component :is="Component" />
  </router-view>
  <MemberNav />
  <div v-if="toast.text" class="toast" :class="toast.type">{{ toast.text }}</div>
</template>

<script setup>
import { reactive } from 'vue'
import { toast } from './store'
import MemberNav from './components/MemberNav.vue'
</script>

<style scoped>
.toast {
  position: fixed; left: 50%; bottom: 88px; transform: translateX(-50%);
  background: #0f172a; color: #fff; padding: 10px 18px; border-radius: 24px;
  font-size: 13px; z-index: 9999; box-shadow: 0 8px 30px rgba(0,0,0,.25);
  max-width: min(86vw, 420px); text-align: center; line-height: 1.5;
}
.toast.error { background: #b91c1c; }
.toast.success { background: #047857; }
</style>
