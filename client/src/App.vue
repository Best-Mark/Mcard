<template>
  <router-view v-slot="{ Component }">
    <DesktopShell v-if="useShell">
      <DesktopOverview v-if="isDesktopHome" />
      <component v-else :is="Component" />
    </DesktopShell>
    <component v-else :is="Component" />
  </router-view>
  <!-- 配色风格 / 名片集市 / 资料编辑是独立设计页，自带底部功能条与保存收敛，不再叠原来的 tabbar -->
  <MemberNav v-if="!isPC && !hideMemberNav" />
  <div v-if="toast.text" class="toast" :class="toast.type">{{ toast.text }}</div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from './store'
import MemberNav from './components/MemberNav.vue'
import DesktopShell from './layouts/DesktopShell.vue'
import DesktopOverview from './views/desktop/DesktopOverview.vue'
import { isPC } from './utils/device'

const route = useRoute()
// 独立设计/编辑页自带底部功能条与「完成」保存收敛，全局 tabbar 隐藏：
// 配色风格 / 名片集市 / 资料编辑。其余 /me 子页靠底部 tab 导航，不显示返回。
const hideMemberNav = computed(() => ['/me/card/style', '/me/card/market', '/me/card', '/me/withdraw-account', '/me/withdraw-account-edit'].includes(route.path))
// PC 首页用专属多栏概览（H5 的 /me 仍走原 Dashboard，路由表不变）
const isDesktopHome = computed(() => route.path === '/me')
// 桌面壳只套「工作台类」页面：/me 系列与 /market。
// 公开名片页 /c/:slug、登录/微信回调、后台 /admin 保持原样（后台本身已是桌面布局）。
const useShell = computed(() => {
  if (!isPC.value) return false
  const p = route.path
  return p === '/market' || (p.startsWith('/me') && !p.startsWith('/me/pay'))
})
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
