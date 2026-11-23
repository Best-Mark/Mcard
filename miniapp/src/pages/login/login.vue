<template>
  <view class="page">
    <view class="head">
      <view class="brand">M<text class="em">Card</text></view>
      <view class="sub">{{ mode === 'login' ? '欢迎回来' : '创建账号' }}</view>
    </view>
    <view class="form">
      <view class="field">
        <text class="label">手机号</text>
        <input v-model.trim="phone" class="input" inputmode="numeric" maxlength="11" placeholder="11 位手机号" />
      </view>
      <view class="field">
        <text class="label">密码</text>
        <input v-model="password" class="input" password placeholder="至少 6 位" />
      </view>
      <view v-if="mode === 'register'" class="field">
        <text class="label">昵称（选填）</text>
        <input v-model.trim="nickname" class="input" placeholder="展示用名称" />
      </view>
      <button class="btn primary block" :disabled="busy" @tap="submit">{{ busy ? '请稍候…' : (mode === 'login' ? '登录' : '注册并登录') }}</button>
      <view class="switch" @tap="mode = mode === 'login' ? 'register' : 'login'">
        {{ mode === 'login' ? '还没有账号？立即注册' : '已有账号？去登录' }}
      </view>
      <view class="hint">正式上线建议接入短信验证码登录与风控；当前手机号+密码用于快速体验。</view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { api, setAuth, toast } from '../../utils/request'

const mode = ref('login')
const phone = ref(''); const password = ref(''); const nickname = ref(''); const busy = ref(false)

async function submit() {
  if (!/^1\d{10}$/.test(phone.value)) return toast('请输入 11 位手机号')
  if (password.value.length < 6) return toast('密码至少 6 位')
  busy.value = true
  try {
    const url = mode.value === 'login' ? '/api/auth/login' : '/api/auth/register'
    const data = await api.post(url, { phone: phone.value, password: password.value, nickname: nickname.value }, false)
    setAuth(data.token, data.user)
    toast('登录成功', 'success')
    setTimeout(() => uni.navigateBack({ delta: 1, fail: () => uni.redirectTo({ url: '/pages/index/index' }) }), 600)
  } catch (e) { toast(e.message) } finally { busy.value = false }
}
</script>

<style scoped>
.head { background: linear-gradient(135deg,#17357c,#2563eb); padding: 70rpx 32rpx 80rpx; color: #fff; border-radius: 0 0 36rpx 36rpx; }
.brand { font-size: 44rpx; font-weight: 800; }
.em { opacity: .8; }
.sub { font-size: 30rpx; margin-top: 10rpx; opacity: .9; }
.form { padding: 32rpx; margin-top: -30rpx; background: #fff; border-radius: 28rpx; margin-left: 24rpx; margin-right: 24rpx; box-shadow: 0 10rpx 30rpx rgba(15,23,42,.06); }
.field { margin-bottom: 24rpx; }
.label { display: block; font-size: 24rpx; color: #6b7688; margin-bottom: 10rpx; font-weight: 600; }
.input { width: 100%; border: 2rpx solid #e8edf4; border-radius: 14rpx; padding: 18rpx 20rpx; font-size: 28rpx; box-sizing: border-box; }
.btn { font-size: 28rpx; padding: 20rpx 0; border-radius: 14rpx; background: #eef2f7; }
.btn::after { border: 0; }
.btn.primary { background: #2563eb; color: #fff; }
.btn.block { width: 100%; }
.switch { text-align: center; color: #2563eb; font-size: 26rpx; margin-top: 24rpx; }
.hint { font-size: 22rpx; color: #94a3b8; margin-top: 30rpx; line-height: 1.6; }
</style>
