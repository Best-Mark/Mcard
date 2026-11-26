<template>
  <view class="page">
    <view v-if="needLogin" class="login-gate">
      <view class="lg-ico">👤</view>
      <view class="lg-title">登录查看我的资料</view>
      <view class="lg-sub">账户资料、套餐状态与名片入口登录后可用</view>
      <button class="btn primary" style="margin-top:28rpx" @tap="goLogin">去登录</button>
    </view>
    <block v-else>
    <!-- 账户层信息（users）：头像/昵称/套餐，卡片层的姓名/职位/名片头像一律不在此展示 -->
    <view class="hero">
      <view class="user" @tap="go('/pages/account/account')">
        <image v-if="avatar" class="avatar" :src="avatar" mode="aspectFill" />
        <view v-else class="avatar ph">{{ (user.phone || user.nickname || '名').slice(0, 1) }}</view>
        <view class="who">
          <view class="name">{{ user.nickname || user.phone || '我的账户' }}</view>
          <view class="slogan">账号中心 · 管理登录资料</view>
        </view>
        <text class="arrow">›</text>
      </view>
      <view class="plan" @tap="go('/pages/plans/plans')">
        <view class="plan-l">
          <text class="plan-label">套餐有效期</text>
          <text class="plan-date">{{ planInfo.dateText }}</text>
          <text class="plan-sub">{{ planInfo.subText }}</text>
        </view>
        <text class="plan-btn">{{ planInfo.expired ? '立即续期' : '续期 ›' }}</text>
      </view>
    </view>

    <view class="quick">
      <view class="q" @tap="switchTab('/pages/contacts/contacts')"><text class="qi">▦</text><text>名片夹</text></view>
      <view class="q" @tap="go('/pages/plans/plans')"><text class="qi">¥</text><text>套餐续期</text></view>
      <view class="q" @tap="go('/pages/print/print')"><text class="qi">▤</text><text>实体版式</text></view>
      <view class="q" @tap="go('/pages/index/index')"><text class="qi">⌗</text><text>扫一扫</text></view>
    </view>

    <view class="group">
      <view class="g-title">我的名片</view>
      <view v-if="card" class="cell" @tap="go('/pages/card/card?slug=' + card.slug)">
        <text class="ci">◎</text><text class="ct">查看我的名片</text><text class="ce">二维码 · 链接</text><text class="ca">›</text>
      </view>
      <view v-else class="cell muted">还没有名片，在「名片」栏创建</view>
      <view v-if="card" class="cell" @tap="go('/pages/edit/edit')"><text class="ci">✎</text><text class="ct">编辑名片资料</text><text class="ca">›</text></view>
    </view>

    <view v-if="isPromoter" class="group">
      <view class="g-title">推广</view>
      <view class="cell" @tap="go('/pages/promo/promo')"><text class="ci">➤</text><text class="ct">推广中心</text><text class="ce">邀请 · 收益 · 提现</text><text class="ca">›</text></view>
    </view>

    <view class="group">
      <view class="g-title">账号与服务</view>
      <view class="cell" @tap="switchTab('/pages/notifications/notifications')"><text class="ci">♢</text><text class="ct">消息通知</text><text v-if="unread" class="badge">{{ unread > 99 ? '99+' : unread }}</text><text class="ca">›</text></view>
      <view class="cell" @tap="go('/pages/account/account')"><image class="ci-gear" src="/static/icons/gear.png" mode="aspectFit" /><text class="ct">账号资料</text><text class="ce">头像 · 昵称</text><text class="ca">›</text></view>
    </view>

    <view class="version">唐笺 电子名片</view>
    </block>

    <TabBar active="profile" />
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api, toast, getUnreadCount, isPromoterUser, isLogged, ensureLogin } from '../../utils/request'
import TabBar from '../../components/TabBar/TabBar.vue'

const needLogin = ref(false)
const user = ref(uni.getStorageSync('mcard_user') || {})
const avatar = ref('')
const card = ref(null)
const unread = ref(0)
const isPromoter = ref(isPromoterUser())
const go = url => uni.navigateTo({ url })
const switchTab = url => uni.reLaunch({ url })

const planInfo = computed(() => {
  if (!card.value) return { dateText: '未开通', subText: '在「名片」栏创建后可开通', expired: true }
  const exp = card.value.expires_at || card.value.expiresAt
  if (card.value.active === false) {
    return { dateText: exp ? '已到期 / 未开通' : '未开通', subText: '续期后恢复展示与配色/上架能力', expired: true }
  }
  if (!exp) return { dateText: '永久有效', subText: '当前套餐长期可用', expired: false }
  const d = new Date(String(exp).replace(' ', 'T') + 'Z')
  const days = Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86400000))
  return {
    dateText: String(exp).slice(0, 10),
    subText: days > 0 ? `剩余 ${days} 天` : '已到期，续期后恢复展示',
    expired: days <= 0
  }
})

function goLogin() { ensureLogin('/pages/profile/profile') }

async function load() {
  needLogin.value = !isLogged()
  user.value = uni.getStorageSync('mcard_user') || {}
  isPromoter.value = isPromoterUser()
  if (needLogin.value) return
  try { avatar.value = (await api.get('/api/auth/avatar', true))?.avatar || '' } catch {}
  try { card.value = await api.get('/api/cards/mine', true) } catch { card.value = null }
  getUnreadCount().then(n => { unread.value = n }).catch(() => {})
  // 自愈：后台可能刚变更推广员身份，静默拉权威用户态同步
  api.get('/api/auth/me', true).then(u => {
    if (u && u.id) {
      isPromoter.value = !!u.is_promoter
      user.value = { ...user.value, ...u }
      uni.setStorageSync('mcard_user', user.value)
    }
  }).catch(() => {})
}
onShow(load)
</script>

<style scoped>
.page { min-height: 100vh; background: #f7f2e7; padding-bottom: 160rpx; }
.login-gate { padding: 160rpx 48rpx; text-align: center; color: #8a7355; }
.lg-ico { font-size: 96rpx; opacity: .25; }
.lg-title { font-size: 34rpx; font-weight: 800; color: #2b2118; margin: 20rpx 0 8rpx; }
.lg-sub { font-size: 24rpx; line-height: 1.6; }
.hero { background: linear-gradient(135deg,#7a1e15,#a62b2b 60%,#b03a2e); color: #fff; padding: 40rpx 28rpx 90rpx; border-radius: 0 0 40rpx 40rpx; }
.user { display: flex; align-items: center; gap: 20rpx; }
.avatar { width: 96rpx; height: 96rpx; border-radius: 50%; background: rgba(255,255,255,.2); flex-shrink: 0; }
.avatar.ph { display: flex; align-items: center; justify-content: center; font-size: 42rpx; font-weight: 800; }
.who { flex: 1; min-width: 0; }
.name { font-size: 34rpx; font-weight: 800; }
.slogan { font-size: 23rpx; opacity: .8; margin-top: 6rpx; }
.arrow { font-size: 40rpx; opacity: .8; }
.plan { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; margin-top: 34rpx; padding: 22rpx 24rpx; border-radius: 20rpx; background: rgba(255,255,255,.16); border: 2rpx solid rgba(255,255,255,.3); }
.plan-l { display: flex; flex-direction: column; gap: 4rpx; }
.plan-label { font-size: 22rpx; opacity: .85; }
.plan-date { font-size: 32rpx; font-weight: 800; }
.plan-sub { font-size: 21rpx; opacity: .8; }
.plan-btn { flex-shrink: 0; font-size: 23rpx; font-weight: 700; color: #a62b2b; background: #fff; border-radius: 999rpx; padding: 10rpx 24rpx; }
.quick { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12rpx; padding: 0 24rpx; margin-top: -56rpx; }
.q { background: #fff; border-radius: 20rpx; padding: 22rpx 4rpx; text-align: center; font-size: 22rpx; box-shadow: 0 8rpx 24rpx rgba(15,23,42,.06); }
.qi { width: 56rpx; height: 56rpx; border-radius: 16rpx; background: #f7ecd9; color: #a62b2b; display: flex; align-items: center; justify-content: center; font-size: 28rpx; margin: 0 auto 10rpx; }
.group { background: #fff; margin: 20rpx 0 0; border-radius: 0; border-top: 2rpx solid #e8dcc2; border-bottom: 2rpx solid #e8dcc2; }
.g-title { font-size: 23rpx; color: #b09a72; letter-spacing: 2rpx; padding: 22rpx 28rpx 10rpx; }
.cell { display: flex; align-items: center; gap: 18rpx; min-height: 96rpx; padding: 0 28rpx; border-top: 2rpx solid #f1f5f9; }
.cell:first-of-type { border-top: 0; }
.ci { width: 44rpx; text-align: center; font-size: 32rpx; color: #a62b2b; }
/* 设置图标用齿轮 PNG（WXSS 不支持 conic-gradient/mask 画齿轮，跨端用图片更稳） */
.ci-gear { width: 36rpx; height: 36rpx; margin: 4rpx 4rpx 0; flex-shrink: 0; }
.ct { font-size: 28rpx; }
.ce { margin-left: auto; font-size: 22rpx; color: #b09a72; }
.ca { font-size: 34rpx; color: #d8c9a8; }
.cell.muted { color: #b09a72; font-size: 25rpx; }
.badge { margin-left: auto; min-width: 34rpx; height: 34rpx; line-height: 34rpx; padding: 0 8rpx; border-radius: 17rpx; background: #ef4444; color: #fff; font-size: 20rpx; text-align: center; }
.version { text-align: center; font-size: 22rpx; color: #d8c9a8; padding: 40rpx 0 20rpx; }
</style>
