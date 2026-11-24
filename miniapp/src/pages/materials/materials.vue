<template>
  <view class="page">
    <view class="bar">
      <text class="back" @tap="back">‹</text>
      <text class="title">相册</text>
    </view>

    <view v-if="loading" class="state">加载中…</view>
    <view v-else-if="error" class="state">
      <view>{{ error }}</view>
      <button class="btn" style="margin-top:20rpx" @tap="load">重新加载</button>
    </view>
    <template v-else>
      <view class="head card">
        <text class="h-title">{{ owner?.name || '名片主人' }} 分享的相册</text>
        <text class="muted small">共 {{ list.length }} 项 · 点开查看</text>
      </view>

      <view v-for="m in list" :key="m.id" class="item card">
        <view class="i-head">
          <text class="ico">{{ m.type === 'file' ? '📄' : '🔗' }}</text>
          <view class="i-title">
            <text class="b">{{ m.title }}</text>
            <text class="muted small">{{ m.type === 'file' ? '文件资料' : '网页链接' }} · {{ m.views }} 次查看</text>
          </view>
        </view>
        <button v-if="m.type === 'link'" class="btn primary" @tap="openLink(m)">打开链接 ↗</button>
        <view v-else class="btn-row">
          <button class="btn primary" @tap="openLink(m)">查看 / 下载 ↗</button>
          <button class="btn" @tap="copyLink(m)">复制链接</button>
        </view>
      </view>

    </template>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getPublicMaterials, baseUrl, copyText } from '../../utils/request'

const slug = ref('')
const list = ref([])
const owner = ref(null)
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true; error.value = ''
  try {
    const d = await getPublicMaterials(slug.value)
    list.value = d.list || []
    owner.value = d.owner || null
  } catch (e) { error.value = e.message || '加载失败' } finally { loading.value = false }
}
onLoad(opt => { slug.value = opt.slug || ''; load() })
function back() { uni.navigateBack() }
function fullUrl(u) { return u && u.startsWith('/') ? baseUrl + u : u }
function openLink(m) {
  // 小程序内不嵌 web-view（保持纯原生）；外部资料链接复制到剪贴板，提示去浏览器打开
  copyText(fullUrl(m.url), '链接已复制，请粘贴到浏览器打开')
}
function copyLink(m) { copyText(fullUrl(m.url), '链接已复制') }
</script>

<style scoped>
.page { min-height: 100vh; background: #f5f7fb; padding-bottom: 60rpx; }
.bar { height: 88rpx; display: flex; align-items: center; gap: 20rpx; padding: 0 28rpx; background: #fff; border-bottom: 1rpx solid #e8edf4; }
.back { font-size: 48rpx; color: #2563eb; }
.title { font-size: 30rpx; font-weight: 700; }
.state { padding: 100rpx 40rpx; text-align: center; color: #64748b; }
.card { background: #fff; border-radius: 16rpx; padding: 24rpx; margin: 20rpx 24rpx; }
.head .h-title { display: block; font-size: 32rpx; font-weight: 700; margin-bottom: 8rpx; }
.muted { color: #94a3b8; }
.small { font-size: 24rpx; }
.item { margin-top: 16rpx; }
.i-head { display: flex; gap: 20rpx; align-items: center; margin-bottom: 18rpx; }
.ico { font-size: 40rpx; }
.i-title { flex: 1; }
.i-title .b { display: block; font-size: 28rpx; }
.btn { font-size: 26rpx; padding: 12rpx 0; border-radius: 10rpx; background: #f1f5f9; color: #334155; }
.btn.primary { background: #2563eb; color: #fff; }
.btn-row { display: flex; gap: 16rpx; }
.btn-row .btn { flex: 1; }

</style>
