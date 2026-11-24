<template>
  <view class="page">
    <view class="body">
      <view class="card">
        <view class="section">👤 账号头像</view>
        <view class="avatar-row" @tap="chooseAvatar">
          <image v-if="avatar" class="avatar" :src="avatar" mode="aspectFill" />
          <view v-else class="avatar ph">{{ (user.phone || '名').slice(0, 1) }}</view>
          <view class="muted small">点击更换账号头像（自动压缩转 WebP，≤5MB）<br />属于账号资料，与名片 LOGO 分开管理</view>
        </view>
        <button class="btn tiny primary" :disabled="busy" style="margin-top:16rpx" @tap="chooseAvatar">{{ busy ? '上传中…' : '上传头像' }}</button>
      </view>
      <view class="card">
        <view class="section">账号信息</view>
        <view class="row"><text class="label">手机号</text><text>{{ user.phone || '—' }}</text></view>
        <view class="row"><text class="label">昵称</text><text>{{ user.nickname || '未设置' }}</text></view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api, baseUrl, toast } from '../../utils/request'

const avatar = ref('')
const busy = ref(false)
const user = ref(uni.getStorageSync('mcard_user') || {})

async function load() {
  try { avatar.value = (await api.get('/api/auth/avatar', true))?.avatar || '' } catch {}
}
onShow(load)

function chooseAvatar() {
  if (busy.value) return
  uni.chooseImage({ count: 1, sizeType: ['compressed'], success: res => uploadAvatar(res.tempFilePaths[0]) })
}
function uploadAvatar(filePath) {
  busy.value = true
  const token = uni.getStorageSync('mcard_token')
  uni.uploadFile({
    url: baseUrl + '/api/upload',
    filePath,
    name: 'file',
    header: token ? { Authorization: 'Bearer ' + token } : {},
    success: async res => {
      try {
        const d = JSON.parse(res.data)
        if (d.code !== 0) throw new Error(d.msg || '上传失败')
        await api.put('/api/auth/avatar', { avatar: d.data.url })
        avatar.value = d.data.url
        toast('账号头像已更新', 'success')
      } catch (e) { toast(e.message || '头像更新失败') }
    },
    fail: err => toast(err.errMsg || '上传失败'),
    complete: () => { busy.value = false }
  })
}
</script>

<style scoped>
.body { padding: 24rpx; }
.card { background: #fff; border-radius: 24rpx; padding: 26rpx; margin-bottom: 18rpx; box-shadow: 0 8rpx 28rpx rgba(15,23,42,.05); }
.section { font-size: 30rpx; font-weight: 700; margin-bottom: 16rpx; }
.avatar-row { display: flex; align-items: center; gap: 20rpx; }
.avatar { width: 110rpx; height: 110rpx; border-radius: 22rpx; flex-shrink: 0; }
.ph { background: #2563eb; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 44rpx; font-weight: 800; }
.row { display: flex; justify-content: space-between; align-items: center; padding: 16rpx 0; border-bottom: 2rpx solid #f1f5f9; font-size: 26rpx; }
.row:last-child { border-bottom: 0; }
.label { color: #64748b; }
</style>
