<template>
  <view class="page">
    <!-- 协议正文页：微信审核要求登录前可查看；内容读后台「协议与隐私」配置，空值回落内置默认 -->
    <view class="head">
      <view class="brand">{{ title }}</view>
      <view class="gold-line"></view>
    </view>

    <view v-if="loading" class="state">加载中…</view>
    <view v-else-if="error" class="state">
      <view>加载失败：{{ error }}</view>
      <button class="btn tiny primary" style="margin-top:20rpx" @tap="load">重新加载</button>
    </view>
    <view v-else class="body">
      <view v-for="(line, i) in lines" :key="i" class="line" :class="{ title: isTitle(line), blank: !line }">{{ line }}</view>
      <!-- 合规公示：经营主体 / ICP 备案号 / 联系方式（微信审核要求协议页可公示主体信息；留空项不显示） -->
      <view class="legal-foot">
        <view v-if="siteName">{{ siteName }}</view>
        <view v-if="icp">{{ icp }}</view>
        <view v-if="contact">联系客服：{{ contact }}</view>
      </view>
    </view>

    <view class="foot">
      <button class="btn primary block" @tap="goBack">我已阅读</button>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { api, toast } from '../../utils/request'

const type = ref('user_agreement')
const content = ref('')
const loading = ref(true)
const error = ref('')
// 合规公示信息：来自公开配置（同一次请求顺带取，不单独发请求）
const siteName = ref('')
const icp = ref('')
const contact = ref('')

// 兜底正文：网络/配置失败时也能看到完整可读协议（与后端 LEGAL_DEFAULTS 同口径的精简兜底）
const FALLBACK = {
  user_agreement: '《唐笺·用户协议》\n\n欢迎您使用「唐笺」电子名片服务。请在使用前阅读并理解协议内容。您勾选同意并开始使用，即表示接受本协议全部条款。\n\n本服务提供电子名片的创建、展示、分享、交换与管理。您应保证所填资料真实合法，不得冒用他人身份或发布违法违规内容。\n\n您上传资料的知识产权归您或合法权利人所有，平台在实现服务目的所必需范围内展示使用。因网络、设备等不可控因素导致的服务中断，我们将尽合理努力保障服务稳定。\n\n如对协议有任何疑问，可通过「联系客服」与我们取得联系。',
  privacy_policy: '《唐笺·隐私政策》\n\n「唐笺」高度重视您的个人信息保护。我们依据相关法律法规，遵循合法、正当、必要原则处理您的个人信息。\n\n为提供服务，我们可能收集账号信息（手机号、微信授权信息）、您填写的名片资料、设备与日志信息、您主动授权的位置信息等。上述信息用于账号登录、名片创建展示、名片夹管理、按您设置展示名片等服务目的。\n\n除获取您的明示同意或法律法规另有规定外，我们不会向第三方共享您的个人信息。您有权查阅、更正、删除您的个人信息，可联系客服申请注销账号。\n\n如对本政策有任何疑问，可通过「联系客服」与我们取得联系。'
}

const title = computed(() => (type.value === 'privacy_policy' ? '隐私政策' : '用户协议'))
const lines = computed(() => String(content.value || '').split('\n'))
// 正文标题行（以《 开头或首行）加粗放大，段落层次更清晰
function isTitle(line) { return /^《.+》$/.test(String(line || '').trim()) }

async function load() {
  loading.value = true; error.value = ''
  try {
    const cfg = await api.get('/api/public/config', false)
    content.value = String(cfg?.[type.value] || '').trim() || FALLBACK[type.value]
    // 合规公示：站点名 / ICP 备案号 / 联系方式（留空项前端不显示）
    siteName.value = String(cfg?.site_name || '').trim()
    icp.value = String(cfg?.icp || '').trim()
    contact.value = String(cfg?.contact || '').trim()
  } catch (e) {
    // 拉取失败不阻断：回落兜底正文，保证审核场景任何时候都有可读协议
    content.value = FALLBACK[type.value]
    if (!content.value) error.value = e.message || '网络异常'
  } finally { loading.value = false }
}
onLoad(options => {
  if (options?.type === 'privacy_policy') type.value = 'privacy_policy'
  load()
})
function goBack() {
  toast('请返回登录页勾选同意后继续', 'none')
  setTimeout(() => uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/login/login' }) }), 600)
}
</script>

<style scoped>
/* 唐笺古风：宣纸底 + 唐红标题 + 鎏金细线 */
.page { min-height: 100vh; background: #f7f2e7; padding-bottom: calc(180rpx + env(safe-area-inset-bottom, 0px)); }
.head { background: linear-gradient(160deg, #8c2318 0%, #a62b2b 60%, #c0392b 100%); padding: 56rpx 32rpx 48rpx; color: #f3e2b3; border-radius: 0 0 36rpx 36rpx; }
.brand { font-size: 42rpx; font-weight: 800; letter-spacing: 8rpx; color: #f3e2b3; text-shadow: 0 2rpx 12rpx rgba(0,0,0,.18); }
.gold-line { margin-top: 18rpx; width: 110rpx; height: 6rpx; border-radius: 4rpx; background: linear-gradient(90deg, #d4af37, #f3e2b3, #d4af37); }
.state { padding: 120rpx 40rpx; text-align: center; color: #8a7355; font-size: 26rpx; }
.body { margin: 24rpx; padding: 30rpx 28rpx; background: #fffdf8; border-radius: 20rpx; border: 2rpx solid rgba(212,175,55,.18); }
.line { font-size: 27rpx; line-height: 1.85; color: #2b2118; margin-bottom: 14rpx; }
.line.title { font-size: 32rpx; font-weight: 800; color: #8c2318; letter-spacing: 3rpx; text-align: center; margin: 12rpx 0 22rpx; }
.line.blank { height: 12rpx; margin-bottom: 0; }
/* 合规公示：经营主体 / ICP / 联系方式，弱化处理但可读 */
.legal-foot { margin-top: 32rpx; padding-top: 22rpx; border-top: 2rpx solid #e8dcc2; text-align: center; font-size: 22rpx; color: #8a7355; line-height: 1.8; }
.foot { position: fixed; left: 0; right: 0; bottom: 0; padding: 20rpx 32rpx calc(20rpx + env(safe-area-inset-bottom, 0px)); background: #fffdf8; border-top: 2rpx solid rgba(212,175,55,.18); }
.btn { font-size: 28rpx; padding: 20rpx 0; border-radius: 14rpx; background: #f0e7d2; color: #2b2118; }
.btn::after { border: 0; }
.btn.primary { background: linear-gradient(135deg, #a62b2b, #8c2318); color: #f8e8c8; font-weight: 700; letter-spacing: 4rpx; }
.btn.tiny { padding: 12rpx 28rpx; }
.btn.block { width: 100%; }
</style>
