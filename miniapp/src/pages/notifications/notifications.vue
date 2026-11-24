<template>
  <view class="page">
    <view class="bar">
      <text class="back" @tap="back">‹</text>
      <text class="title">消息通知</text>
      <text v-if="unread" class="mark" @tap="markAll">全部已读</text>
    </view>

    <view v-if="loading" class="state">加载中…</view>
    <view v-else-if="!list.length" class="state">
      <view style="font-size:72rpx;opacity:.3">🔔</view>
      <view>暂无通知</view>
      <view class="muted small" style="margin-top:12rpx">有人收藏/交换你的名片，或你关注的名片更新时会提醒你。</view>
    </view>
    <view v-else class="list">
      <view v-for="n in list" :key="n.id" class="item" :class="{ unread: !n.isRead }" @tap="open(n)">
        <view class="ico">{{ iconOf(n.type) }}</view>
        <view class="body">
          <view class="head"><text class="b">{{ n.title }}</text><text class="muted small">{{ timeOf(n.createdAt) }}</text></view>
          <view class="small content">{{ n.body }}</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getNotifications, markNotificationRead } from '../../utils/request'

const list = ref([])
const unread = ref(0)
const loading = ref(true)
const busy = ref(false)

async function load() {
  loading.value = true
  try {
    const d = await getNotifications()
    list.value = d.list || []
    unread.value = d.unread || 0
  } finally { loading.value = false }
}
onLoad(load)
function back() { uni.navigateBack() }
async function open(n) {
  if (busy.value) return
  if (!n.isRead) {
    busy.value = true
    try { await markNotificationRead(n.id); n.isRead = true; unread.value = Math.max(0, unread.value - 1) } catch {} finally { busy.value = false }
  }
  if (n.link) {
    if (n.link.startsWith('/c/')) uni.navigateTo({ url: '/pages/card/card?slug=' + n.link.split('/')[2] })
    else if (n.link.includes('contacts')) uni.navigateTo({ url: '/pages/me/me' })
  }
}
async function markAll() {
  if (busy.value) return
  busy.value = true
  try { await markNotificationRead(0); list.value.forEach(n => { n.isRead = true }); unread.value = 0 } catch {} finally { busy.value = false }
}
function iconOf(t) { return ({ card_update: '🔄', new_favorite: '⭐', new_exchange: '🤝' })[t] || '🔔' }
function timeOf(s) {
  if (!s) return ''
  const t = new Date(String(s).replace(' ', 'T') + (String(s).includes('Z') ? '' : 'Z'))
  const diff = Date.now() - t.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前'
  return String(s).slice(0, 10)
}
</script>

<style scoped>
.page { min-height: 100vh; background: #f5f7fb; padding-bottom: 40rpx; }
.bar { height: 88rpx; display: flex; align-items: center; gap: 20rpx; padding: 0 28rpx; background: #fff; border-bottom: 1rpx solid #e8edf4; }
.back { font-size: 48rpx; color: #2563eb; line-height: 1; }
.title { font-size: 30rpx; font-weight: 700; }
.mark { margin-left: auto; font-size: 24rpx; color: #2563eb; }
.state { padding: 100rpx 40rpx; text-align: center; color: #64748b; }
.muted { color: #94a3b8; }
.small { font-size: 24rpx; }
.list { padding: 20rpx 0; }
.item { display: flex; gap: 20rpx; padding: 26rpx 28rpx; background: #fff; margin-bottom: 2rpx; border-left: 6rpx solid transparent; }
.item.unread { border-left-color: #2563eb; background: #f5f8ff; }
.ico { font-size: 40rpx; }
.body { flex: 1; min-width: 0; }
.head { display: flex; justify-content: space-between; gap: 12rpx; }
.b { font-size: 28rpx; font-weight: 600; }
.content { margin-top: 8rpx; line-height: 1.5; color: #475569; }
</style>
