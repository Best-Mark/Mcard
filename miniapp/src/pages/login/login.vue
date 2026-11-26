<template>
  <view class="page">
    <view class="head">
      <view class="brand">M<text class="em">Card</text></view>
      <view class="sub">{{ mode === 'login' ? '欢迎回来' : '创建账号' }}</view>
    </view>
    <view class="form">
      <!-- 小程序主推微信快捷登录：wx.login 一次性 code → 服务端换 openid 建号/登录 -->
      <button class="btn wx-login" :disabled="wxBusy || busy" @tap="wechatLogin">
        <text class="wx-ico">微</text>{{ wxBusy ? '正在登录…' : '微信快捷登录' }}
      </button>
      <view class="divider"><text>或使用手机号</text></view>
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
        <input v-model.trim="nickname" class="input" placeholder="账户显示名称（与名片姓名无关）" />
      </view>
      <button class="btn primary block" :disabled="busy" @tap="submit">{{ busy ? '请稍候…' : (mode === 'login' ? '登录' : '注册并登录') }}</button>
      <view class="switch" @tap="mode = mode === 'login' ? 'register' : 'login'">
        {{ mode === 'login' ? '还没有账号？立即注册' : '已有账号？去登录' }}
      </view>
      <view class="hint">登录即表示同意《用户协议》与《隐私政策》</view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { api, setAuth, toast, bindPendingInvite } from '../../utils/request'

const mode = ref('login')
const phone = ref(''); const password = ref(''); const nickname = ref(''); const busy = ref(false)
const wxBusy = ref(false)

// 登录后去向（与 H5 一致）：回到集市主界面，底部 tabbar 可进名片夹/名片/消息/我的。
// reLaunch 替换登录页、不留返回栈（登录页不能留在返回链里）。
function goAfterLogin(delay = 500) {
  setTimeout(() => uni.reLaunch({ url: '/pages/market/market' }), delay)
}

// 微信快捷登录：uni.login 一次性 code → 服务端 code2session → 建号/登录。
// 铁律：busy 守卫 + 按钮 disabled 成对防重入；code 只消费一次，失败必须重新 login 取新 code；
// uni.login 无回调时用超时兜底恢复 busy，绝不能永久停在「正在登录…」。
function wechatLogin() {
  if (wxBusy.value || busy.value) return
  wxBusy.value = true
  let settled = false
  const done = () => { settled = true; wxBusy.value = false }
  const guard = setTimeout(() => { if (!settled) { done(); toast('微信登录超时，请重试') } }, 15000)

  uni.login({
    provider: 'weixin',
    success: (loginRes) => {
      const code = loginRes?.code
      if (!code || settled) { clearTimeout(guard); done(); toast('微信登录失败，请重试'); return }
      const invite = uni.getStorageSync('mcard_invite') || ''
      api.post('/api/auth/miniapp-login', { code, invite }, false)
        .then((data) => {
          clearTimeout(guard); done()
          if (!data?.token) { toast(data?.msg || '微信登录失败'); return }
          setAuth(data.token, data.user)
          bindPendingInvite().catch(() => {})
          toast(data.created ? '已为你创建账号' : '登录成功', 'success')
          goAfterLogin(500)
        })
        .catch((e) => { clearTimeout(guard); done(); toast(e?.message || '微信登录失败，请重试') })
    },
    fail: () => { clearTimeout(guard); done(); toast('微信登录失败，请重试') }
  })
}

async function submit() {
  if (!/^1\d{10}$/.test(phone.value)) return toast('请输入 11 位手机号')
  if (password.value.length < 6) return toast('密码至少 6 位')
  busy.value = true
  try {
    const url = mode.value === 'login' ? '/api/auth/login' : '/api/auth/register'
    const invite = uni.getStorageSync('mcard_invite') || ''
    const payload = { phone: phone.value, password: password.value, nickname: nickname.value }
    if (mode.value === 'register' && invite) payload.invite = invite
    const data = await api.post(url, payload, false)
    setAuth(data.token, data.user)
    await bindPendingInvite()
    toast('登录成功', 'success')
    goAfterLogin(600)
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
/* 小程序 input 必须显式定高+line-height，否则原生渲染下文字半截被裁（截图实锤） */
.input { width: 100%; height: 88rpx; line-height: 88rpx; border: 2rpx solid #e8edf4; border-radius: 14rpx; padding: 0 20rpx; font-size: 28rpx; box-sizing: border-box; }
.btn { font-size: 28rpx; padding: 20rpx 0; border-radius: 14rpx; background: #eef2f7; }
.btn::after { border: 0; }
.btn.primary { background: #2563eb; color: #fff; }
.btn.block { width: 100%; }
/* 微信快捷登录按钮：微信绿，与下方手机号登录蓝形成色相区分（项目配色约定） */
.btn.wx-login { background: #07c160; color: #fff; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 12rpx; }
.wx-ico { width: 36rpx; height: 36rpx; line-height: 36rpx; text-align: center; border-radius: 8rpx; background: rgba(255,255,255,.22); font-size: 22rpx; }
.btn.wx-login[disabled] { opacity: .6; }
.divider { display: flex; align-items: center; gap: 16rpx; color: #94a3b8; font-size: 22rpx; margin: 24rpx 0; }
.divider::before, .divider::after { content: ''; flex: 1; height: 2rpx; background: #e8edf4; }
.switch { text-align: center; color: #2563eb; font-size: 26rpx; margin-top: 24rpx; }
.hint { font-size: 22rpx; color: #94a3b8; margin-top: 30rpx; line-height: 1.6; }
</style>
