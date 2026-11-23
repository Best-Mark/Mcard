<template>
  <view class="page">
    <view class="notice">🔒 改资料不会改变二维码，已印刷的名片无需重做。链接固定为 /c/{{ form.slug }}</view>

    <view class="body">
      <view class="card">
        <view class="section">基本信息</view>
        <view class="avatar-row" @tap="chooseAvatar">
          <image v-if="form.avatar" class="avatar" :src="form.avatar" mode="aspectFill" />
          <view v-else class="avatar ph">{{ (form.name || 'M').slice(0, 1) }}</view>
          <view class="muted small">点击上传头像（jpg/png/webp，≤5MB）</view>
        </view>
        <view class="field">
          <text class="label">公司 LOGO（自动去透明底）</text>
          <view v-if="form.logo" class="logo-current">
            <image :src="form.logo" mode="aspectFit" />
            <text class="muted small">当前 LOGO · 重新上传可替换</text>
          </view>
          <button class="btn tiny" :disabled="logoBusy" @tap="chooseLogo">{{ logoBusy ? '处理中…' : '上传 LOGO 并自动去底' }}</button>
          <block v-if="logoProcessed">
            <picker :range="logoModeLabels" :value="logoModeIdx" @change="onLogoMode">
              <view class="picker">去底方式：{{ logoModeLabels[logoModeIdx] }}（点击切换）</view>
            </picker>
            <view v-if="logoMode !== 'none'" class="slider-label">去底强度 {{ logoTolerance }}</view>
            <slider v-if="logoMode !== 'none'" :value="logoTolerance" min="0" max="90" activeColor="#2563eb" @change="onLogoTolerance" />
            <image class="logo-preview" :src="logoProcessed" mode="aspectFit" />
            <view class="muted small">透明底已在服务端生成，可切换到「保留原图」对比</view>
            <button class="btn tiny primary" style="margin-top:12rpx" @tap="applyLogo">应用这张 LOGO</button>
          </block>
        </view>
        <view class="field"><text class="label">姓名 *</text><input v-model="form.name" class="input" placeholder="姓名" /></view>
        <view class="field"><text class="label">英文名</text><input v-model="form.name_en" class="input" /></view>
        <view class="field"><text class="label">职位</text><input v-model="form.title" class="input" /></view>
        <view class="field"><text class="label">公司</text><input v-model="form.company" class="input" /></view>
        <view class="field"><text class="label">公司简介</text><textarea v-model="form.company_intro" class="textarea" placeholder="介绍公司业务、优势与服务，展示在名片「公司简介」区块" /></view>
        <view class="field"><text class="label">部门</text><input v-model="form.department" class="input" /></view>
        <view class="field"><text class="label">公司主页 URL</text><input v-model="form.website" class="input" placeholder="https://" /></view>
        <view class="field"><text class="label">店铺 URL</text><input v-model="form.shop_url" class="input" placeholder="https:// 淘宝 / 抖音 / 微店等" /></view>
        <view class="field"><text class="label">个人简介</text><textarea v-model="form.bio" class="textarea" /></view>
        <view class="field"><text class="label">标签（逗号分隔）</text><input v-model="tagsText" class="input" placeholder="设计, 品牌" /></view>
      </view>

      <view class="card">
        <view class="section">联系方式</view>
        <view class="field"><text class="label">手机号</text><input v-model="form.mobile" class="input" inputmode="tel" /></view>
        <view class="field"><text class="label">座机</text><input v-model="form.phone" class="input" /></view>
        <view class="field"><text class="label">邮箱</text><input v-model="form.email" class="input" /></view>
        <view class="field"><text class="label">微信号</text><input v-model="form.wechat" class="input" /></view>
        <view class="field"><text class="label">支付宝账号</text><input v-model="form.alipay" class="input" /></view>
        <view class="field"><text class="label">WhatsApp</text><input v-model="form.whatsapp" class="input" /></view>
        <view class="field"><text class="label">地址</text><input v-model="form.address" class="input" placeholder="省市区街道门牌，越详细越好导航" /></view>
        <view class="field"><text class="label">门牌补充</text><input v-model="form.address_detail" class="input" /></view>
      </view>

      <view class="card">
        <view class="section">加好友 / 收付款二维码</view>
        <block v-for="q in qrFields" :key="q.key">
          <view class="qr-upload-row">
            <image v-if="form[q.key]" class="qr-thumb" :src="form[q.key]" mode="aspectFit" />
            <view class="qr-upload-info">
              <text class="b">{{ q.label }}</text>
              <button class="btn tiny" :disabled="busy" @tap="chooseQr(q.key)">{{ form[q.key] ? '更换' : '上传' }}</button>
            </view>
          </view>
        </block>
        <view class="muted small" style="margin-top:12rpx">上传微信/支付宝的加好友码或收款码原图，访客可在对应环境识别或保存后扫码。</view>
      </view>

      <view class="card">
        <view class="section">更多链接</view>
        <view v-for="(l, i) in form.links" :key="i" class="link-row">
          <input v-model="l.label" class="input" placeholder="标题" />
          <input v-model="l.url" class="input" placeholder="https://" />
          <text class="del" @tap="form.links.splice(i, 1)">删</text>
        </view>
        <button class="btn tiny" @tap="form.links.push({ label: '', url: '' })">+ 添加链接</button>
      </view>

      <view class="card">
        <view class="section">展示模板</view>
        <view class="muted small" style="margin-bottom:16rpx">模板决定排版结构，主题决定配色，可自由搭配。</view>
        <view class="tpl-list">
          <view v-for="tpl in templates" :key="tpl.key" class="tpl-item" :class="{ on: form.template === tpl.key }" @tap="form.template = tpl.key">
            <view class="tpl-thumb" :style="{ background: tpl.cover }">
              <view class="tpl-ava" :class="'ava-' + tpl.key"></view>
            </view>
            <text class="tpl-name">{{ tpl.label }}</text>
            <text class="tpl-desc">{{ tpl.desc }}</text>
            <text v-if="form.template === tpl.key" class="tpl-check">✓ 使用中</text>
          </view>
        </view>
      </view>

      <view class="card">
        <view class="section">主题风格与二维码</view>
        <view class="themes">
          <view v-for="(v, k) in themes" :key="k" class="theme" :class="{ on: form.theme === k }" :style="{ background: v.accent }" @tap="chooseTheme(k, v.accent)">
            {{ v.label }}
          </view>
        </view>
        <view class="field"><text class="label">强调色</text><input v-model="form.accent" class="input" placeholder="#2563eb" /></view>
        <view class="field"><text class="label">二维码前景色</text><input v-model="form.qr_fg" class="input" placeholder="#0f172a" /></view>
        <view class="field"><text class="label">中心 Logo</text><switch :checked="form.qr_logo" @change="e => form.qr_logo = e.detail.value" /></view>
      </view>

      <button class="btn primary block big" :disabled="saving" @tap="save">{{ saving ? '保存中…' : '保存资料' }}</button>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { api, toast, uploadImage, uploadLogo, processLogo } from '../../utils/request'

const themes = {
  ocean: { label: '深海蓝', accent: '#2563eb' },
  ink: { label: '墨黑金', accent: '#c9a227' },
  sunset: { label: '暖阳橘', accent: '#ea580c' },
  mint: { label: '青竹绿', accent: '#0d9488' },
  royal: { label: '典雅紫', accent: '#7c3aed' }
}
const blank = {
  slug: '', name: '', name_en: '', title: '', company: '', company_intro: '', department: '',
  website: '', shop_url: '',
  bio: '', tags: [], links: [], avatar: '', logo: '', mobile: '', phone: '', email: '', wechat: '', alipay: '', whatsapp: '',
  wechat_qr: '', alipay_qr: '', wechat_pay_qr: '', alipay_pay_qr: '',
  address: '', address_detail: '', template: 'classic', theme: 'ocean', accent: '#2563eb', qr_fg: '#0f172a', qr_bg: '#ffffff', qr_logo: true
}
const form = ref({ ...blank })
const tagsText = ref('')
const saving = ref(false)
// 模板清单是静态数据：模块级缓存让二次进入瞬时渲染，随后静默刷新
let templatesCache = []
const templates = ref(templatesCache)

const logoOriginal = ref(''); const logoProcessed = ref('')
const logoMode = ref('auto'); const logoTolerance = ref(32); const logoBusy = ref(false)
const qrFields = [
  { key: 'wechat_qr', label: '微信 · 加好友码' },
  { key: 'alipay_qr', label: '支付宝 · 加好友码' },
  { key: 'wechat_pay_qr', label: '微信 · 收款码' },
  { key: 'alipay_pay_qr', label: '支付宝 · 收款码' }
]
const logoModes = ['auto', 'white', 'none']
const logoModeLabels = ['智能识别背景', '只去白底', '保留原图']
const logoModeIdx = ref(0)

onLoad(async () => {
  loadTemplates()
  try {
    const c = await api.get('/api/cards/mine')
    if (!c) return uni.redirectTo({ url: '/pages/me/me' })
    form.value = { ...blank, ...c, qr_logo: !!c.qr_logo }
    tagsText.value = (c.tags || []).join(', ')
  } catch (e) { toast(e.message) }
})

async function loadTemplates() {
  if (templatesCache.length) templates.value = templatesCache
  try {
    const r = await api.get('/api/cards/public/templates', false)
    if (r?.templates?.length) {
      templatesCache = r.templates
      templates.value = r.templates
    }
  } catch { /* 清单拉取失败时使用缓存，不影响保存 */ }
}

function chooseTheme(k, accent) { form.value.theme = k; form.value.accent = accent }
function chooseAvatar() {
  uni.chooseImage({ count: 1, sizeType: ['compressed'], success: async res => {
    try { form.value.avatar = await uploadImage(res.tempFilePaths[0]); toast('上传成功，记得保存', 'success') }
    catch (e) { toast(e.message) }
  } })
}

function chooseLogo() {
  uni.chooseImage({ count: 1, sizeType: ['original'], success: async res => {
    logoBusy.value = true
    try {
      const r = await uploadLogo(res.tempFilePaths[0], logoMode.value, logoTolerance.value)
      logoOriginal.value = r.originalUrl
      logoProcessed.value = r.url
      toast(r.transparent ? '已生成透明底 LOGO' : 'LOGO 已处理', 'success')
    } catch (e) { toast(e.message) } finally { logoBusy.value = false }
  } })
}

async function onLogoMode(e) {
  logoModeIdx.value = Number(e.detail.value)
  logoMode.value = logoModes[logoModeIdx.value]
  if (logoOriginal.value) {
    logoBusy.value = true
    try { const r = await processLogo(logoOriginal.value, logoMode.value, logoTolerance.value); logoProcessed.value = r.url }
    catch (err) { toast(err.message) } finally { logoBusy.value = false }
  }
}

async function onLogoTolerance(e) {
  const v = Number(e.detail.value)
  if (v === logoTolerance.value) return
  logoTolerance.value = v
  if (!logoOriginal.value || logoMode.value === 'none') return
  logoBusy.value = true
  try { const r = await processLogo(logoOriginal.value, logoMode.value, v); logoProcessed.value = r.url }
  catch (err) { toast(err.message) } finally { logoBusy.value = false }
}

function applyLogo() {
  form.value.logo = logoProcessed.value
  toast('LOGO 已应用，保存资料后生效', 'success')
}

function chooseQr(key) {
  uni.chooseImage({ count: 1, sizeType: ['compressed'], success: async res => {
    try { form.value[key] = await uploadImage(res.tempFilePaths[0]); toast('上传成功，记得保存', 'success') }
    catch (e) { toast(e.message) }
  } })
}

async function save() {
  if (!form.value.name) return toast('请填写姓名')
  saving.value = true
  try {
    const payload = {
      ...form.value,
      tags: tagsText.value.split(/[,，]/).map(s => s.trim()).filter(Boolean).slice(0, 8),
      links: form.value.links.filter(l => l.label || l.url)
    }
    delete payload.slug
    await api.put('/api/cards/mine', payload)
    toast('资料已保存，二维码不变', 'success')
    setTimeout(() => uni.navigateBack(), 700)
  } catch (e) { toast(e.message) } finally { saving.value = false }
}
</script>

<style scoped>
.notice { background: #eff6ff; color: #1e40af; font-size: 22rpx; padding: 20rpx 24rpx; line-height: 1.6; }
.body { padding: 24rpx; }
.card { background: #fff; border-radius: 24rpx; padding: 26rpx; margin-bottom: 18rpx; box-shadow: 0 8rpx 28rpx rgba(15,23,42,.05); }
.section { font-size: 30rpx; font-weight: 700; margin-bottom: 16rpx; }
.avatar-row { display: flex; align-items: center; gap: 20rpx; margin-bottom: 20rpx; }
.logo-current { display: flex; align-items: center; gap: 14rpx; margin-bottom: 14rpx; }
.logo-current image { width: 80rpx; height: 80rpx; background: #f1f5f9; border-radius: 12rpx; padding: 6rpx; box-sizing: border-box; }
.picker { border: 2rpx solid #e8edf4; border-radius: 12rpx; padding: 16rpx; font-size: 26rpx; margin-top: 14rpx; }
.slider-label { font-size: 24rpx; color: #6b7688; margin-top: 14rpx; }
.logo-preview { width: 220rpx; height: 160rpx; background: #f1f5f9; border-radius: 14rpx; margin: 14rpx auto; display: block; }
.avatar { width: 100rpx; height: 100rpx; border-radius: 22rpx; flex-shrink: 0; }
.ph { background: #2563eb; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 42rpx; font-weight: 800; }
.field { margin-bottom: 18rpx; }
.label { display: block; font-size: 24rpx; color: #6b7688; margin-bottom: 8rpx; font-weight: 600; }
.input, .textarea { width: 100%; box-sizing: border-box; border: 2rpx solid #e8edf4; border-radius: 12rpx; padding: 16rpx 18rpx; font-size: 26rpx; }
.textarea { height: 160rpx; }
.qr-upload-row { display: flex; align-items: center; gap: 16rpx; padding: 14rpx 0; border-bottom: 2rpx solid #f1f5f9; }
.qr-thumb { width: 96rpx; height: 96rpx; border: 2rpx solid #e8edf4; border-radius: 12rpx; background: #fff; padding: 6rpx; box-sizing: border-box; }
.qr-upload-info { display: flex; align-items: center; gap: 16rpx; }
.qr-upload-info .b { font-size: 26rpx; font-weight: 600; }
.link-row { display: flex; gap: 10rpx; align-items: center; margin-bottom: 10rpx; }
.link-row .input { flex: 1; min-width: 0; }
.del { color: #dc2626; font-size: 24rpx; padding: 0 8rpx; }
.tpl-list { display: flex; flex-direction: column; gap: 14rpx; }
.tpl-item { position: relative; border: 2rpx solid #e8edf4; border-radius: 16rpx; padding: 14rpx; display: flex; flex-direction: column; gap: 6rpx; }
.tpl-item.on { border-color: #2563eb; box-shadow: 0 0 0 4rpx rgba(37,99,235,.12); }
.tpl-thumb { height: 90rpx; border-radius: 12rpx; position: relative; overflow: hidden; }
.tpl-ava { position: absolute; width: 44rpx; height: 44rpx; left: 20rpx; bottom: -12rpx; background: #fff; box-shadow: 0 2rpx 10rpx rgba(0,0,0,.2); }
.ava-classic { border-radius: 10rpx; }
.ava-minimal { border-radius: 50%; left: 50%; transform: translateX(-50%); background: #e2e8f0; }
.ava-elite { border-radius: 50%; left: 50%; transform: translateX(-50%); width: 50rpx; height: 50rpx; border: 3rpx solid #c9a227; }
.ava-vivid { border-radius: 16rpx; width: 50rpx; height: 50rpx; }
.tpl-name { font-size: 28rpx; font-weight: 700; }
.tpl-desc { font-size: 22rpx; color: #6b7688; }
.tpl-check { font-size: 22rpx; color: #2563eb; font-weight: 700; }
.themes { display: flex; flex-wrap: wrap; gap: 12rpx; margin-bottom: 20rpx; }
.theme { padding: 10rpx 18rpx; border-radius: 12rpx; color: #fff; font-size: 24rpx; opacity: .65; }
.theme.on { opacity: 1; box-shadow: 0 0 0 4rpx rgba(0,0,0,.1); }
.btn { font-size: 26rpx; padding: 16rpx 0; border-radius: 12rpx; background: #eef2f7; }
.btn::after { border: 0; }
.btn.primary { background: #2563eb; color: #fff; }
.btn.tiny { padding: 12rpx 24rpx; font-size: 24rpx; }
.btn.big { padding: 22rpx 0; font-size: 30rpx; }
.btn.block { width: 100%; }
.muted { color: #6b7688; }
.small { font-size: 22rpx; }
</style>
