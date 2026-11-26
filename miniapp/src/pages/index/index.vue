<template>
  <view class="page">
    <!-- 后台配了启动图就整页显示图片（点击进入集市），不显示内置推广页；图片加载失败自愈回退 -->
    <view v-if="launchImage && launchImageOk" class="launch" @tap="enterMarket">
      <image class="launch-img" :src="launchImage" mode="widthFix" @error="launchImageOk = false" />
      <view class="launch-hint">点击进入</view>
    </view>

    <block v-else>
    <view class="hero">
      <view class="brand">唐<text class="em">笺</text></view>
      <view class="slogan">一扫即存 · 永久有效的电子名片</view>
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
        <view class="muted">{{ logged ? '还没有名片，创建后即可获得永久二维码' : '还没有名片？登录后一键创建' }}</view>
        <button class="btn primary block" style="margin-top:20rpx" @tap="logged ? go('/pages/me/me') : goLogin()">
          {{ logged ? '创建我的名片' : '登录 / 注册' }}
        </button>
      </view>

      <view class="card search-card">
        <view class="section">打开一张名片</view>
        <input v-model="keyword" class="input" placeholder="扫一扫，或输入短码 / 名片链接" />
        <view class="btn-row">
          <button class="btn primary" @tap="openKeyword">打开名片</button>
          <button class="btn" @tap="scan">扫一扫</button>
        </view>
        <button class="btn block" style="margin-top:16rpx" @tap="go('/pages/market/market')">⌖ 逛名片集市 · 发现附近业务对口</button>
      </view>
    </view>
    </block>

    <TabBar v-if="!(launchImage && launchImageOk)" active="" />
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { api, baseUrl, isLogged, goLogin, parseSlug, toast } from '../../utils/request'
import TabBar from '../../components/TabBar/TabBar.vue'

const logged = ref(false)
const myCard = ref(null)
const keyword = ref('')
const launchImage = ref('')
const launchImageOk = ref(true)

// 启动图：后台「站点基础 → 小程序启动图」配了就整页显示该图，点击进入集市；空则走内置推广页。
// 图片是构建期注入域名下的 /uploads/ 相对路径或完整 URL，统一归一化后加载。
async function loadLaunchImage() {
  try {
    const cfg = await api.get('/api/public/config', false)
    const raw = String(cfg?.miniapp_launch_image || '').trim()
    launchImage.value = raw ? (/^https?:\/\//i.test(raw) ? raw : raw.startsWith('/') ? baseUrl + raw : '') : ''
  } catch { launchImage.value = '' } // 配置拉取失败自愈回退内置推广页
}
function enterMarket() { uni.reLaunch({ url: '/pages/market/market' }) }

const go = url => uni.navigateTo({ url })
async function refresh() {
  logged.value = isLogged()
  if (!logged.value) { myCard.value = null; return }
  try { myCard.value = await api.get('/api/cards/mine') } catch { myCard.value = null }
}
onLoad(() => { loadLaunchImage(); refresh() })
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
.launch { position: relative; min-height: 100vh; background: #fff; display: flex; align-items: flex-start; justify-content: center; }
.launch-img { width: 100%; }
.launch-hint { position: fixed; left: 0; right: 0; bottom: calc(60rpx + env(safe-area-inset-bottom, 0px)); text-align: center; font-size: 24rpx; color: #8a7355; letter-spacing: 2rpx; }
.hero { background: linear-gradient(135deg,#7a1e15,#a62b2b 55%,#c9a227); padding: 60rpx 32rpx 56rpx; color: #fff; border-radius: 0 0 40rpx 40rpx; }
.brand { font-size: 44rpx; font-weight: 800; letter-spacing: 6rpx; }
.em { opacity: .8; }
.slogan { font-size: 24rpx; opacity: .85; margin-top: 10rpx; letter-spacing: 2rpx; }
.body { padding: 24rpx; margin-top: -30rpx; padding-bottom: 160rpx; }
.card { background: #fff; border-radius: 24rpx; padding: 26rpx; margin-bottom: 20rpx; box-shadow: 0 8rpx 28rpx rgba(15,23,42,.05); }
.section { font-size: 30rpx; font-weight: 700; margin-bottom: 16rpx; }
.mini-title { font-size: 30rpx; font-weight: 700; }
.row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18rpx; }
.mini-qr { width: 110rpx; height: 110rpx; }
.btn-row { display: flex; gap: 14rpx; margin-top: 14rpx; }
.btn { flex: 1; font-size: 26rpx; padding: 14rpx 0; border-radius: 14rpx; background: #f0e7d2; color: #2b2118; line-height: 1.4; }
.btn::after { border: 0; }
.btn.primary { background: #a62b2b; color: #fff; }
.btn.block { width: 100%; }
.input { height: 84rpx; line-height: 84rpx; border: 2rpx solid #e8dcc2; border-radius: 14rpx; padding: 0 20rpx; font-size: 26rpx; box-sizing: border-box; }
.muted { color: #8a7355; }
.small { font-size: 22rpx; }
.center-pad { text-align: center; padding: 40rpx 26rpx; }
</style>
