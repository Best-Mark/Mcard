<template>
  <view class="page">
    <view class="hero">
      <view class="brand">M<text class="em">Card</text></view>
      <view class="slogan">一扫即存 · 永久有效的电子名片</view>
      <view class="hero-card">
        <view class="avatar">李</view>
        <view class="who">
          <view class="name">李知远</view>
          <view class="title">品牌顾问 · 远见设计</view>
          <view class="tags"><text>扫码存通讯录</text><text>地图导航</text><text>实体名片</text></view>
        </view>
      </view>
    </view>

    <view class="body">
      <view v-if="logged && myCard" class="card mine">
        <view class="row">
          <view>
            <view class="mini-title">{{ myCard.name || '我的名片' }}</view>
            <view class="muted small">/c/{{ myCard.slug }} · {{ myCard.active ? '已开通' : '未开通' }}</view>
          </view>
          <image class="mini-qr" :src="baseUrl + '/api/cards/public/' + myCard.slug + '/qr.png?size=180'" mode="aspectFit" />
        </view>
        <view class="btn-row">
          <button class="btn primary" @tap="go('/pages/card/card?slug=' + myCard.slug)">查看名片</button>
          <button class="btn" @tap="go('/pages/edit/edit')">编辑资料</button>
        </view>
        <view class="btn-row">
          <button class="btn" @tap="go('/pages/plans/plans')">开通 / 续期</button>
          <button class="btn" @tap="go('/pages/print/print')">实体版式</button>
        </view>
      </view>
      <view v-else class="card center-pad">
        <view class="muted">还没有名片？登录后一键创建</view>
        <button class="btn primary block" style="margin-top:20rpx" @tap="logged ? go('/pages/me/me') : goLogin()">
          {{ logged ? '进入我的名片' : '登录 / 注册' }}
        </button>
      </view>

      <view class="card search-card">
        <view class="section">打开一张名片</view>
        <input v-model="keyword" class="input" placeholder="扫一扫，或输入短码 / 名片链接" />
        <view class="btn-row">
          <button class="btn primary" @tap="openKeyword">打开名片</button>
          <button class="btn" @tap="scan">扫一扫</button>
        </view>
      </view>

      <view class="card features">
        <view class="section">能做什么</view>
        <view class="feature"><text class="ico">◎</text><view><b>稳定二维码</b><view class="muted small">资料随便改，二维码永不变</view></view></view>
        <view class="feature"><text class="ico">◉</text><view><b>一键保存</b><view class="muted small">二维码存相册，电话邮箱可复制</view></view></view>
        <view class="feature"><text class="ico">⌖</text><view><b>地址导航</b><view class="muted small">复制地址，打开地图直接粘贴</view></view></view>
        <view class="feature"><text class="ico">▤</text><view><b>实体名片版式</b><view class="muted small">90×54mm 印刷稿与海报保存</view></view></view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { api, baseUrl, isLogged, goLogin, parseSlug, toast } from '../../utils/request'

const logged = ref(false)
const myCard = ref(null)
const keyword = ref('')

const go = url => uni.navigateTo({ url })
async function refresh() {
  logged.value = isLogged()
  if (!logged.value) { myCard.value = null; return }
  try { myCard.value = await api.get('/api/cards/mine') } catch { myCard.value = null }
}
onLoad(refresh)
onShow(refresh)

function openKeyword() {
  const slug = parseSlug(keyword.value)
  if (!slug) return toast('请输入正确的短码或名片链接')
  go('/pages/card/card?slug=' + slug)
}
function scan() {
  uni.scanCode({
    success: res => {
      const slug = parseSlug(res.result)
      if (slug) go('/pages/card/card?slug=' + slug)
      else toast('这不是一张名片二维码')
    },
    fail: () => {}
  })
}
</script>

<style scoped>
.hero { background: linear-gradient(135deg,#17357c,#2563eb 55%,#38bdf8); padding: 60rpx 32rpx 90rpx; color: #fff; border-radius: 0 0 40rpx 40rpx; }
.brand { font-size: 44rpx; font-weight: 800; }
.em { opacity: .8; }
.slogan { font-size: 24rpx; opacity: .85; margin-top: 6rpx; }
.hero-card { display: flex; align-items: center; gap: 24rpx; background: rgba(255,255,255,.96); color: #162033; border-radius: 24rpx; padding: 24rpx; margin-top: 40rpx; }
.avatar { width: 96rpx; height: 96rpx; border-radius: 24rpx; background: #2563eb; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 42rpx; font-weight: 800; flex-shrink: 0; }
.name { font-size: 34rpx; font-weight: 800; }
.title { font-size: 24rpx; color: #6b7688; margin-top: 4rpx; }
.tags { display: flex; gap: 10rpx; margin-top: 12rpx; flex-wrap: wrap; }
.tags text { font-size: 20rpx; color: #2563eb; background: #eff6ff; padding: 4rpx 12rpx; border-radius: 999rpx; }
.body { padding: 24rpx; margin-top: -50rpx; }
.card { background: #fff; border-radius: 24rpx; padding: 26rpx; margin-bottom: 20rpx; box-shadow: 0 8rpx 28rpx rgba(15,23,42,.05); }
.section { font-size: 30rpx; font-weight: 700; margin-bottom: 16rpx; }
.mini-title { font-size: 30rpx; font-weight: 700; }
.row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18rpx; }
.mini-qr { width: 110rpx; height: 110rpx; }
.btn-row { display: flex; gap: 14rpx; margin-top: 14rpx; }
.btn { flex: 1; font-size: 26rpx; padding: 14rpx 0; border-radius: 14rpx; background: #eef2f7; color: #162033; line-height: 1.4; }
.btn::after { border: 0; }
.btn.primary { background: #2563eb; color: #fff; }
.btn.block { width: 100%; }
.input { border: 2rpx solid #e8edf4; border-radius: 14rpx; padding: 16rpx 20rpx; font-size: 26rpx; }
.feature { display: flex; gap: 18rpx; align-items: center; padding: 14rpx 0; }
.ico { width: 60rpx; height: 60rpx; border-radius: 16rpx; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; font-size: 30rpx; flex-shrink: 0; }
.muted { color: #6b7688; }
.small { font-size: 22rpx; }
.center-pad { text-align: center; padding: 40rpx 26rpx; }
</style>
