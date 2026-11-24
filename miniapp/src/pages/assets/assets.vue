<template>
  <view class="page">
    <view class="bar">
      <text class="back" @tap="back">‹</text>
      <text class="title">图片素材库</text>
      <text class="hint">点一张即可替换</text>
    </view>
    <view class="intro">上传过的图片都在这里，可跨头像 / LOGO / 二维码图复用。上传自动压缩转 WebP。</view>

    <button class="btn primary block" :disabled="uploading" @tap="chooseUpload">{{ uploading ? '上传压缩中…' : '＋ 上传新图' }}</button>

    <view v-if="loading" class="state">加载中…</view>
    <view v-else-if="!list.length" class="state">还没有素材，点上方上传一张。</view>
    <view v-else class="grid">
      <view v-for="a in list" :key="a.id" class="item" @tap="pick(a)">
        <image :src="a.url" mode="aspectFill" />
        <text class="del" @tap.stop="remove(a)">✕</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getAssets, uploadAsset, deleteAsset, toast } from '../../utils/request'

const list = ref([])
const loading = ref(true)
const uploading = ref(false)

async function load() {
  loading.value = true
  try { list.value = await getAssets() } finally { loading.value = false }
}
onLoad(load)
function back() { uni.navigateBack() }
function pick(a) {
  uni.$emit('asset-picked', a.url)
  uni.navigateBack()
}
function chooseUpload() {
  if (uploading.value) return
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    success: async res => {
      uploading.value = true
      try {
        const d = await uploadAsset(res.tempFilePaths[0])
        list.value.unshift({ id: d.id, url: d.url, name: d.name })
        toast(d.converted ? '已上传并自动压缩' : '已上传', 'success')
      } catch (e) { toast(e.message || '上传失败') } finally { uploading.value = false }
    }
  })
}
async function remove(a) {
  try { await deleteAsset(a.id); list.value = list.value.filter(x => x.id !== a.id); toast('已移除', 'success') }
  catch (e) { toast(e.message || '删除失败') }
}
</script>

<style scoped>
.page { min-height: 100vh; background: #f5f7fb; padding: 24rpx; }
.bar { display: flex; align-items: center; gap: 20rpx; margin: -24rpx -24rpx 20rpx; padding: 24rpx; background: #fff; border-bottom: 2rpx solid #e8edf4; }
.back { font-size: 48rpx; color: #2563eb; }
.title { font-size: 30rpx; font-weight: 700; }
.hint { margin-left: auto; font-size: 22rpx; color: #94a3b8; }
.intro { font-size: 24rpx; color: #64748b; line-height: 1.6; margin-bottom: 20rpx; }
.btn { font-size: 26rpx; padding: 16rpx 0; border-radius: 12rpx; }
.btn::after { border: 0; }
.btn.primary { background: #2563eb; color: #fff; }
.btn.block { width: 100%; }
.state { text-align: center; color: #94a3b8; font-size: 26rpx; padding: 80rpx 20rpx; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16rpx; margin-top: 24rpx; }
.item { position: relative; aspect-ratio: 1; border-radius: 14rpx; overflow: visible; background: #fff; border: 2rpx solid #e8edf4; }
.item image { width: 100%; height: 100%; border-radius: 12rpx; display: block; }
.del { position: absolute; top: -8rpx; right: -8rpx; width: 36rpx; height: 36rpx; line-height: 34rpx; text-align: center; border-radius: 50%; background: #ef4444; color: #fff; font-size: 22rpx; }
</style>
