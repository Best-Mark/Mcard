<template>
  <!-- 底部主导航：与 H5 client/src/config/nav.js BOTTOM_TABS 同项同序（唯一定义在本组件 TABS）。
       中间「集市」凸起蓝钮，与 H5 MemberNav 观感一致；切换用 reLaunch，不给页面栈留历史页。 -->
  <view class="m-tabs">
    <view v-for="t in tabs" :key="t.key" class="m-tab" :class="{ on: active === t.key, feature: t.feature }" @tap="go(t)">
      <view class="m-ico-wrap">
        <image class="m-ico" :src="active === t.key ? t.on : t.off" mode="aspectFit" />
        <text v-if="t.key === 'notifications' && unread" class="m-badge">{{ unread > 99 ? '99+' : unread }}</text>
      </view>
      <text class="m-label">{{ t.label }}</text>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { getUnreadCount, ensureLogin } from '../../utils/request'

// 与 H5 BOTTOM_TABS 完全同项同序；改这里必须同步 client/src/config/nav.js。
// path 用小程序原生页：名片=工作台(me)、名片夹=contacts、集市=market、消息=notifications、我的=profile(账户中心)。
const tabs = [
  { key: 'card', label: '名片', path: '/pages/me/me', on: '/static/tabs/card-on.png', off: '/static/tabs/card-off.png' },
  { key: 'contacts', label: '名片夹', path: '/pages/contacts/contacts', on: '/static/tabs/contacts-on.png', off: '/static/tabs/contacts-off.png' },
  { key: 'market', label: '集市', path: '/pages/market/market', feature: true, on: '/static/tabs/market-on.png', off: '/static/tabs/market-off.png' },
  { key: 'notifications', label: '消息', path: '/pages/notifications/notifications', on: '/static/tabs/bell-on.png', off: '/static/tabs/bell-off.png' },
  { key: 'profile', label: '我的', path: '/pages/profile/profile', on: '/static/tabs/user-on.png', off: '/static/tabs/user-off.png' }
]
defineProps({ active: { type: String, required: true } })

const unread = ref(0)
let timer = null
async function loadUnread() {
  if (!uni.getStorageSync('mcard_token')) { unread.value = 0; return }
  try { unread.value = await getUnreadCount() } catch { /* 角标失败静默 */ }
}
onMounted(() => { loadUnread(); timer = setInterval(loadUnread, 60000) })
onBeforeUnmount(() => { if (timer) clearInterval(timer) })

function go(t) {
  // 集市匿名可逛；其余四个 tab 都要登录，未登录跳登录页并记住回跳目标。
  if (!t.feature && !ensureLogin(t.path)) return
  // reLaunch 切 tab：关掉当前所有页面再打开目标，页面栈不会越积越深。
  uni.reLaunch({ url: t.path })
}
</script>

<style scoped>
.m-tabs {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 90;
  display: grid; grid-template-columns: repeat(5, 1fr);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  background: #fff; border-top: 2rpx solid #e8edf4;
  box-shadow: 0 -6rpx 24rpx rgba(15,23,42,.06);
}
.m-tab { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2rpx; padding: 12rpx 0 10rpx; }
.m-ico-wrap { position: relative; width: 44rpx; height: 44rpx; display: flex; align-items: center; justify-content: center; }
.m-ico { width: 42rpx; height: 42rpx; }
.m-label { font-size: 20rpx; color: #94a3b8; line-height: 1.2; }
.m-tab.on .m-label { color: #2563eb; font-weight: 700; }
.m-badge {
  position: absolute; top: -8rpx; right: -20rpx; min-width: 30rpx; height: 30rpx; padding: 0 6rpx;
  border-radius: 15rpx; background: #ef4444; color: #fff; font-size: 18rpx; line-height: 30rpx; text-align: center;
}
/* 集市为重点入口：中间凸起蓝圆钮，不随页面主题变化 */
.m-tab.feature .m-ico-wrap {
  width: 84rpx; height: 84rpx; margin-top: -34rpx; border-radius: 50%;
  background: linear-gradient(135deg, #2563eb, #4338ca);
  box-shadow: 0 8rpx 24rpx rgba(37,99,235,.42); border: 6rpx solid #fff; box-sizing: border-box;
}
.m-tab.feature .m-ico { width: 44rpx; height: 44rpx; }
.m-tab.feature .m-label { margin-top: -2rpx; }
</style>
