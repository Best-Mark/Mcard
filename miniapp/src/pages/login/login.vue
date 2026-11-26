<template>
  <view class="page">
    <!-- 古风头卡：唐红渐变 + 鎏金细线，品牌「唐笺」竖排装饰 -->
    <view class="head">
      <view class="seal">唐笺</view>
      <view class="brand">唐笺</view>
      <view class="sub">{{ mode === 'login' ? '一笺相逢 · 名传天下' : '一笺相逢 · 开启你的名片' }}</view>
      <view class="gold-line"></view>
    </view>
    <view class="form">
      <!-- 小程序主推一键登录（置顶）：wx.login 一次性 code → 服务端换 openid 建号/登录。
           ⚠️ 按钮文案不得出现「微信」字样或官方 logo（平台审核「混淆行为」红线，参照 MShop）。 -->
      <button class="btn wx-login" :disabled="wxBusy || busy" @tap="wechatLogin">
        {{ wxBusy ? '正在登录…' : '一键登录' }}
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
      <button class="btn primary block" :disabled="busy || !agreed" @tap="submit">{{ busy ? '请稍候…' : (mode === 'login' ? '登录' : '注册并登录') }}</button>
      <view class="switch" @tap="mode = mode === 'login' ? 'register' : 'login'">
        {{ mode === 'login' ? '还没有账号？立即注册' : '已有账号？去登录' }}
      </view>

      <!-- 微信小程序审核硬要求：登录前须能查看并主动勾选同意《用户协议》《隐私政策》，默认不勾选 -->
      <view class="agree" @tap="agreed = !agreed">
        <view class="agree-box" :class="{ checked: agreed }">{{ agreed ? '✓' : '' }}</view>
        <view class="agree-text">已阅读并同意
          <text class="agree-link" @tap.stop="openLegal('user_agreement')">《用户协议》</text>
          与
          <text class="agree-link" @tap.stop="openLegal('privacy_policy')">《隐私政策》</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { api, setAuth, toast, bindPendingInvite, takeLoginRedirect } from '../../utils/request'

const mode = ref('login')
const phone = ref(''); const password = ref(''); const nickname = ref(''); const busy = ref(false)
const wxBusy = ref(false)
// 协议勾选：微信审核硬要求，必须用户主动勾选且默认不勾选，未勾选拦截所有登录。
// ⚠️ 审核红线：agreed 初值必须 false，不得为少一次点击改成 true（默认自动同意会被驳回）。
const agreed = ref(false)
// 未勾选时不逼用户翻页找勾选框，弹 showModal 一键「同意并继续 / 暂不同意」（MShop 成熟做法）：
// 弹窗由用户主动确认即满足「用户自主选择」口径。
function ensureAgreed() {
  if (agreed.value) return Promise.resolve(true)
  return new Promise(resolve => {
    uni.showModal({
      title: '用户协议与隐私政策',
      content: '登录前请阅读并同意《用户协议》与《隐私政策》，我们将依法保护你的个人信息。',
      confirmText: '同意并继续',
      cancelText: '暂不同意',
      success: r => {
        agreed.value = !!r.confirm
        resolve(!!r.confirm)
      },
      fail: () => resolve(false)
    })
  })
}
function openLegal(type) {
  uni.navigateTo({ url: '/pages/legal/legal?type=' + type })
}

// 登录后去向：优先回跳登录前想去的页面（如未登录点名片夹/消息/我的），否则与 H5 一致回集市。
// reLaunch 替换登录页、不留返回栈（登录页不能留在返回链里）。
function goAfterLogin(delay = 500) {
  const redirect = takeLoginRedirect()
  const url = redirect && redirect.startsWith('/pages/') ? redirect : '/pages/market/market'
  setTimeout(() => uni.reLaunch({ url }), delay)
}

// 微信快捷登录：uni.login 一次性 code → 服务端 code2session → 建号/登录。
// 铁律：busy 守卫 + 按钮 disabled 成对防重入；code 只消费一次，失败必须重新 login 取新 code；
// uni.login 无回调时用超时兜底恢复 busy，绝不能永久停在「正在登录…」。
async function wechatLogin() {
  if (wxBusy.value || busy.value) return
  if (!(await ensureAgreed())) return
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
  if (!(await ensureAgreed())) return
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
/* 唐笺 · 古风配色：唐红（主色）+ 鎏金（点缀）+ 宣纸（底）+ 墨（字），融入现代商务留白 */
.page { min-height: 100vh; background: #f7f2e7; }
.head { position: relative; background: linear-gradient(160deg, #8c2318 0%, #a62b2b 45%, #c0392b 100%); padding: 80rpx 32rpx 96rpx; color: #f8f0dc; border-radius: 0 0 40rpx 40rpx; overflow: hidden; }
.head::after { content: ''; position: absolute; right: -60rpx; top: -60rpx; width: 220rpx; height: 220rpx; border-radius: 50%; border: 2rpx solid rgba(212,175,55,.35); pointer-events: none; }
.seal { position: absolute; right: 32rpx; top: 34rpx; width: 76rpx; height: 76rpx; border: 3rpx solid rgba(212,175,55,.8); border-radius: 10rpx; color: #d4af37; font-size: 26rpx; font-weight: 800; display: flex; align-items: center; justify-content: center; letter-spacing: 2rpx; background: rgba(140,35,24,.35); writing-mode: vertical-rl; }
.brand { font-size: 56rpx; font-weight: 800; letter-spacing: 10rpx; color: #f3e2b3; text-shadow: 0 2rpx 12rpx rgba(0,0,0,.18); }
.sub { font-size: 26rpx; margin-top: 14rpx; opacity: .92; letter-spacing: 3rpx; color: #f8e8c8; }
.gold-line { margin-top: 22rpx; width: 120rpx; height: 6rpx; border-radius: 4rpx; background: linear-gradient(90deg, #d4af37, #f3e2b3, #d4af37); }
.form { padding: 34rpx 32rpx; margin-top: -34rpx; background: #fffdf8; border-radius: 28rpx; margin-left: 24rpx; margin-right: 24rpx; box-shadow: 0 12rpx 36rpx rgba(140,35,24,.10); border: 2rpx solid rgba(212,175,55,.18); }
.field { margin-bottom: 24rpx; }
.label { display: block; font-size: 24rpx; color: #8a7355; margin-bottom: 10rpx; font-weight: 600; }
/* 小程序 input 必须显式定高+line-height，否则原生渲染下文字半截被裁（截图实锤） */
.input { width: 100%; height: 88rpx; line-height: 88rpx; border: 2rpx solid #e8dcc2; border-radius: 14rpx; padding: 0 20rpx; font-size: 28rpx; box-sizing: border-box; background: #fffdf8; color: #2b2118; }
.btn { font-size: 28rpx; padding: 20rpx 0; border-radius: 14rpx; background: #f0e7d2; color: #2b2118; }
.btn::after { border: 0; }
.btn.primary { background: linear-gradient(135deg, #a62b2b, #8c2318); color: #f8e8c8; font-weight: 700; letter-spacing: 4rpx; box-shadow: 0 8rpx 22rpx rgba(140,35,24,.22); }
.btn.block { width: 100%; }
/* 一键登录：鎏金底，主推入口 */
.btn.wx-login { background: linear-gradient(135deg, #d4af37, #c9a227); color: #3a2a12; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 12rpx; letter-spacing: 3rpx; box-shadow: 0 8rpx 22rpx rgba(184,134,11,.22); }
.btn.wx-login[disabled], .btn.primary[disabled] { opacity: .55; }
.divider { display: flex; align-items: center; gap: 16rpx; color: #b09a72; font-size: 22rpx; margin: 26rpx 0; }
.divider::before, .divider::after { content: ''; flex: 1; height: 2rpx; background: linear-gradient(90deg, transparent, #e8dcc2, transparent); }
.switch { text-align: center; color: #a62b2b; font-size: 26rpx; margin-top: 24rpx; font-weight: 600; }
/* 协议勾选：微信审核硬要求，默认不勾选，链接可点开查看 */
.agree { display: flex; align-items: flex-start; gap: 12rpx; margin-top: 30rpx; padding: 4rpx 6rpx; }
.agree-box { width: 34rpx; height: 34rpx; flex-shrink: 0; margin-top: 2rpx; border: 2rpx solid #c9a227; border-radius: 50%; background: #fff; color: #8c2318; font-size: 22rpx; font-weight: 800; display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
.agree-box.checked { background: linear-gradient(135deg, #d4af37, #c9a227); border-color: #c9a227; color: #fff; }
.agree-text { flex: 1; font-size: 23rpx; line-height: 1.7; color: #8a7355; }
.agree-link { color: #a62b2b; font-weight: 700; }
</style>
