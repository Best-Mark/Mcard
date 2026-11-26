<template>
  <view class="page">
    <view class="body">
      <view class="card">
        <view class="section">👤 账号头像</view>
        <view class="avatar-row">
          <image v-if="avatar" class="avatar" :src="avatar" mode="aspectFill" />
          <view v-else class="avatar ph">{{ (user.phone || '名').slice(0, 1) }}</view>
          <view class="muted small">属于账号资料，与名片 LOGO 分开管理；支持微信头像或自定义图片</view>
        </view>
        <!-- 账户头像两条独立通道：微信头像 / 自定义上传（不走素材库） -->
        <button v-if="wxAvatar" class="btn tiny" :disabled="busy || avatar === wxAvatar" style="margin-top:16rpx" @tap="useWxAvatar">使用已绑定微信头像</button>
        <!-- #ifdef MP-WEIXIN -->
        <button class="btn tiny" open-type="chooseAvatar" :disabled="busy" style="margin-top:12rpx" @chooseavatar="onChooseWxAvatar">选择微信头像</button>
        <!-- #endif -->
        <button class="btn tiny primary" :disabled="busy" style="margin-top:12rpx" @tap="chooseAvatar">{{ busy ? '上传中…' : '上传自定义头像' }}</button>
      </view>
      <view class="card">
        <view class="section">账号信息</view>
        <view class="row"><text class="label">手机号</text><text>{{ user.phone || '—' }}</text></view>
        <view class="row">
          <text class="label">昵称</text>
          <input v-model.trim="nickname" class="nickname-input" maxlength="30" placeholder="账户显示名称" />
        </view>
        <button class="btn tiny primary" :disabled="saving" style="margin-top:16rpx" @tap="saveNickname">{{ saving ? '保存中…' : '保存昵称' }}</button>
        <view class="muted small" style="margin-top:12rpx">昵称属于账号资料，与名片上的姓名互不影响。</view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api, baseUrl, toast } from '../../utils/request'

const avatar = ref('')
const wxAvatar = ref('')
const busy = ref(false)
const saving = ref(false)
const nickname = ref('')
const user = ref(uni.getStorageSync('mcard_user') || {})

async function load() {
  nickname.value = user.value.nickname || ''
  try {
    const info = await api.get('/api/auth/avatar', true)
    avatar.value = info?.avatar || ''
    wxAvatar.value = info?.wxAvatar || ''
  } catch {}
}
async function useWxAvatar() {
  if (busy.value || !wxAvatar.value) return
  busy.value = true
  try {
    const d = await api.put('/api/auth/avatar', { useWxAvatar: true }, true)
    avatar.value = d?.avatar || wxAvatar.value
    toast('已切换为微信头像', 'success')
  } catch (e) { toast(e.message || '切换失败') }
  finally { busy.value = false }
}
function onChooseWxAvatar(e) {
  if (busy.value) return
  const filePath = e?.detail?.avatarUrl || ''
  if (filePath) uploadAvatar(filePath)
}
async function saveNickname() {
  if (saving.value) return
  if (!nickname.value) return toast('昵称不能为空')
  saving.value = true
  try {
    const d = await api.put('/api/auth/profile', { nickname: nickname.value }, true)
    const u = d?.user || d
    if (u?.nickname) {
      user.value = { ...user.value, nickname: u.nickname }
      uni.setStorageSync('mcard_user', user.value)
    }
    toast('昵称已保存', 'success')
  } catch (e) { toast(e.message || '保存失败') }
  finally { saving.value = false }
}
onShow(load)

function chooseAvatar() {
  if (busy.value) return
  busy.value = true
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    success: res => uploadAvatar(res.tempFilePaths?.[0]),
    fail: err => { toast(err.errMsg || '选择图片失败'); busy.value = false }
  })
}
function uploadAvatar(filePath) {
  if (!filePath) { busy.value = false; return }
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
.ph { background: #a62b2b; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 44rpx; font-weight: 800; }
.row { display: flex; justify-content: space-between; align-items: center; padding: 16rpx 0; border-bottom: 2rpx solid #f1f5f9; font-size: 26rpx; }
.row:last-child { border-bottom: 0; }
.label { color: #8a7355; }
.nickname-input { flex: 1; text-align: right; font-size: 26rpx; color: #2b2118; }
</style>
