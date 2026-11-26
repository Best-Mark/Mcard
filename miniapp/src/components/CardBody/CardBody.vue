<!-- 名片正文共享组件：封面 + 身份卡(✎编辑/小码入口/未开通角标) + 未开通提示 + 联系方式(含地址) + 简介/链接/主页店铺
     + 相册 +（访客）交换/创建引导 + 落款。信息/操作分层与 H5 CardSheet 同口径（2026-11-26 对齐定稿）：
     二维码只在身份卡右上角放小图、点击弹层放大，正文不摆大块二维码卡；联系方式一行一字段点行复制。
     card.vue（名片详情页/分享页）与 me.vue（「名片」tab）共用这一套渲染，绝不复制两套名片样式。
     模板样式（template × theme 正交）全部内聚在本组件；dock（底部操作条）属页面级，由各页面自渲染并覆写 .tpl-X .dock。 -->
<template>
  <view class="cv-root" :class="'tpl-' + tpl" :style="{ '--t-accent': accent, '--glow-rgb': glowRgb }">
    <view class="cover" :style="{ background: coverBg }">
      <view class="brand">M<text class="em">Card</text></view>
    </view>

    <view class="body">
      <!-- 身份卡：对齐 H5 CardSheet——✎ 编辑（仅本人）+ 小二维码入口右上角（点击弹层放大）+ 英文名/公司独立行 + 未开通角标 -->
      <view class="card profile">
        <button v-if="isSelf" class="inline-edit" @tap="$emit('edit')">✎</button>
        <view class="avatar" :class="{ 'is-logo': !!card.logo }">
          <image v-if="card.logo || card.avatar" :src="card.logo || card.avatar" :mode="card.logo ? 'aspectFit' : 'aspectFill'" />
          <text v-else>{{ (card.name || '名').slice(0, 1) }}</text>
        </view>
        <view class="ident">
          <view class="name-row">
            <view class="name">{{ card.name || card.name_en || '未填写姓名' }}<text v-if="card.name && card.name_en" class="en">{{ card.name_en }}</text></view>
          </view>
          <view class="title">{{ titleText || '点击「编辑名片」完善你的职业信息' }}</view>
          <view v-if="card.company" class="org">{{ card.company }}</view>
        </view>
        <button class="qr-entry" @tap="qrOpen = true"><image :src="scanQrUrl(card.slug, 'qr.png', 200)" mode="aspectFit" /></button>
        <view v-if="!card.active" class="status-badge">未开通 / 已到期</view>
        <view v-if="card.tags && card.tags.length" class="tags">
          <text v-for="tag in card.tags" :key="tag">{{ tag }}</text>
        </view>
      </view>

      <!-- 未开通提示 + 持有者「立即开通」：与 H5 after-profile 同口径 -->
      <view v-if="!card.active" class="card block notice">
        <view class="notice-b">这张名片尚未开通或已到期</view>
        <view class="muted small">联系持有者开通后，二维码仍会指向这里，无需更换。</view>
        <button v-if="isSelf" class="btn primary block" style="margin-top:16rpx" @tap="$emit('activate')">立即开通</button>
      </view>

      <!-- 联系方式：一行一字段，点行即复制（与 H5 同构）；拨号/导航收进行内小按钮；地址并入本块（2026-11-26 用户定） -->
      <view v-if="contactRows.length || fullAddress" class="card block">
        <view class="section">联系方式 <text class="muted small">· 点一行即复制该字段</text></view>
        <view v-for="f in contactRows" :key="f.key" class="crow" @tap="copyText(f.value, f.label + '已复制')">
          <text class="crow-label">{{ f.label }}：</text>
          <text class="crow-value">{{ f.value }}</text>
          <text v-if="f.tel" class="crow-act" @tap.stop="callPhone(f.value)">拨打</text>
        </view>
        <view v-if="fullAddress" class="crow" @tap="copyText(fullAddress, '地址已复制，可粘贴到地图')">
          <text class="crow-label">地址：</text>
          <text class="crow-value"><text v-if="regionLine">{{ regionLine }} </text>{{ detailAddress }}</text>
          <text v-if="canNavigate" class="crow-act" @tap.stop="openNavigation()">导航</text>
        </view>
      </view>

      <!-- 简介只保留一个区块：字段 bio，存量 company_intro 兜底 -->
      <view v-if="introText" class="card block">
        <view class="section">简介</view>
        <view class="content">{{ introText }}</view>
      </view>

      <view v-if="card.links && card.links.length" class="card block">
        <view class="section">更多链接</view>
        <view v-for="(l, i) in card.links" :key="i" class="link" @tap="copyText(l.url, '链接已复制')">
          <text class="b">{{ l.label || '链接' }}</text>
          <text class="muted small">{{ l.url }}</text>
        </view>
      </view>

      <view v-if="siteLinks.length" class="card block">
        <view class="section">主页与店铺</view>
        <view v-for="l in siteLinks" :key="l.key" class="link" @tap="copyText(l.url, l.label + '已复制')">
          <text class="b">{{ l.label }}</text>
          <text class="muted small">{{ l.url }}</text>
          <text class="small" style="color:#a62b2b">点击复制 ↗</text>
        </view>
      </view>

      <view v-if="materials.length" class="card block">
        <view class="section">相册 · {{ materials.length }} 项 <text class="muted small">（点开直接看）</text></view>
        <view class="gal">
          <block v-for="m in materials" :key="m.id">
            <image v-if="isImageMaterial(m)" class="gal-img" :src="materialUrl(m)" mode="aspectFill" @tap="openPhoto(m)" />
            <view v-else class="gal-file" @tap="openMaterial(m)">
              <text class="gal-ico">{{ m.type === 'file' ? '📄' : '🔗' }}</text>
              <text class="gal-title">{{ m.title }}</text>
            </view>
          </block>
        </view>
      </view>

      <!-- 名片二维码双码弹层（2026-11-26 用户定稿：两个都要）：联系人码=vCard 瘦身版（只放主流字段，
           扫一扫直接弹「添加到通讯录」）；名片链接码=地址短链（扫了打开名片页）。默认联系人码，
           正文不摆大块二维码卡（对齐 H5 约定①）；一律 PNG（微信长按识别不认 SVG） -->
      <view v-if="qrOpen" class="mask" @tap="qrOpen = false">
        <view class="qr-modal" @tap.stop>
          <view class="qr-modal-title">我的名片</view>
          <view class="qr-tabs">
            <button :class="['qr-tab', { on: qrMode === 'vcard' }]" @tap="qrMode = 'vcard'">联系人码</button>
            <button :class="['qr-tab', { on: qrMode === 'link' }]" @tap="qrMode = 'link'">名片链接码</button>
          </view>
          <image class="qr-big" :src="scanQrUrl(card.slug, qrMode === 'vcard' ? 'vcard.png' : 'qr.png', 640)" mode="aspectFit" />
          <view class="qr-url" @tap="copyText(linkUrl, '名片链接已复制')">{{ linkUrl }}</view>
          <view class="muted small" style="text-align:center">{{ qrMode === 'vcard' ? '手机相机/微信扫一扫，直接把名片存入通讯录（已瘦身只含主流字段，保证可扫）' : '扫一扫打开名片页，名片里的资料随时更新、链接永久不变' }}</view>
          <view class="btn-row qr-modal-btns">
            <button class="btn primary" @tap="copyText(linkUrl, '名片链接已复制')">复制名片链接</button>
            <button class="btn" @tap="saveQrImage(card.slug, qrMode === 'vcard' ? 'vcard.png' : 'qr.png')">保存二维码</button>
            <button class="btn" @tap="qrOpen = false">关闭</button>
          </view>
        </view>
      </view>

      <!-- 自己看自己名片时不显示「交换名片」（与 H5 owner 隐藏悬浮菜单同口径） -->
      <view v-if="!isSelf" class="card block">
        <view class="section">交换名片</view>
        <input v-model.trim="mySlug" class="input" placeholder="你的名片短码" />
        <button class="btn primary block" style="margin-top:16rpx" :disabled="exchanging" @tap="exchange">
          {{ exchanging ? '提交中…' : '确认交换' }}
        </button>
      </view>

      <!-- 访客打开分享的名片：先看到名片本身，「我也要创建」只作为下方次要入口（对所有非持有者显示），
           绝不反过来一进来就拦去创建页——那会完全忽视「先看名片」的场景需要。 -->
      <view v-if="selfCheckDone && !isSelf" class="card block create-own">
        <view class="create-own-copy">
          <text class="b">也想拥有这样一张名片？</text>
          <text class="muted small">二维码终身不变、资料随时改，免费创建</text>
        </view>
        <button class="btn primary block" @tap="goCreate">免费创建我的名片 →</button>
      </view>

      <view class="foot">由 <text class="foot-b">{{ siteName }}</text> 提供技术支持</view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { api, baseUrl, toast, copyText, callPhone, saveQrImage, parseSlug, scanQrUrl } from '../../utils/request'

const props = defineProps({
  card: { type: Object, required: true },
  materials: { type: Array, default: () => [] },
  isSelf: { type: Boolean, default: false },
  selfCheckDone: { type: Boolean, default: true },
  siteName: { type: String, default: '唐笺' }
})
// edit：身份卡 ✎（仅本人显示，页面接去编辑页）；activate：未开通时「立即开通」（页面接去套餐页）
const emit = defineEmits(['edit', 'activate'])

const card = computed(() => props.card || {})
const materials = computed(() => props.materials || [])
const isSelf = computed(() => !!props.isSelf)
const selfCheckDone = computed(() => !!props.selfCheckDone)

const mySlug = ref('')
const exchanging = ref(false)
const qrOpen = ref(false)
const qrMode = ref('vcard')
const linkUrl = computed(() => card.value.url || (baseUrl + '/c/' + card.value.slug))

// 联系方式行（与 H5 CardSheet contactFields 同构）：手机/座机可拨打，其余点行复制
const contactRows = computed(() => {
  const c = card.value
  const rows = []
  if (c.mobile) rows.push({ key: 'mobile', label: '手机', value: c.mobile, tel: true })
  if (c.phone) rows.push({ key: 'phone', label: '座机', value: c.phone, tel: true })
  if (c.email) rows.push({ key: 'email', label: '邮箱', value: c.email })
  if (c.wechat) rows.push({ key: 'wechat', label: '微信', value: c.wechat })
  if (c.alipay) rows.push({ key: 'alipay', label: '支付宝', value: c.alipay })
  if (c.whatsapp) rows.push({ key: 'whatsapp', label: 'WhatsApp', value: c.whatsapp })
  return rows
})

const tpl = computed(() => card.value.template || 'classic')
const accent = computed(() => card.value.accent || '#a62b2b')
// 动态光效用主题强调色，#rrggbb → rgb 分量
const glowRgb = computed(() => {
  const h = /^#?([0-9a-f]{6})$/i.exec(String(card.value.accent || ''))
  if (!h) return '37,99,235'
  const n = parseInt(h[1], 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
})
const coverBg = computed(() => {
  const c = accent.value
  if (tpl.value === 'minimal') return '#ffffff'
  if (tpl.value === 'elite') return 'linear-gradient(135deg,#18181b 0%,#27272a 55%,#0c0c0f 100%)'
  if (tpl.value === 'vivid') return `linear-gradient(135deg, ${c}, #db2777 60%, #f59e0b)`
  if (tpl.value === 'seal') return '#111827'
  if (tpl.value === 'tang') return 'linear-gradient(135deg,#7a1e15 0%,#a62b2b 55%,#c9a227 100%)'
  if (tpl.value === 'vanna') return 'linear-gradient(135deg,#0c2a4d 0%,#155a96 55%,#2a8fd4 100%)'
  if (tpl.value === 'phantom') return 'linear-gradient(135deg,#052e1c 0%,#0f6b3f 55%,#22c97a 100%)'
  if (tpl.value === 'lava') return 'linear-gradient(135deg,#1a1a1e 0%,#3a3a42 55%,#c2410c 100%)'
  if (tpl.value === 'star') return 'linear-gradient(135deg,#08080c 0%,#1a1a24 55%,#4a4a5e 100%)'
  if (tpl.value === 'alas') return 'linear-gradient(135deg,#4a0d14 0%,#a01722 55%,#e0323c 100%)'
  if (tpl.value === 'contact') return `linear-gradient(135deg, #2b2118 0%, ${c} 100%)`
  if (tpl.value === 'navygold') return 'linear-gradient(135deg,#1d3a55 0%,#2f5a7d 40%,#d8bb85 78%,#b99355 100%)'
  return `linear-gradient(135deg, ${c}, #2b2118)`
})
// 职位行 = 职位 · 部门（与 H5 displayTitle 同口径）；公司独立一行（.org），不再拼进职位
const titleText = computed(() => {
  const c = card.value
  return [c.title, c.department].filter(Boolean).join(' · ')
})
const regionLine = computed(() => {
  const c = card.value
  return [c.province, c.city, c.district, c.street].filter(Boolean).join(' · ')
})
const detailAddress = computed(() => {
  const c = card.value
  return [c.address, c.address_detail].filter(Boolean).join(' ')
})
const fullAddress = computed(() => [regionLine.value.replace(/ · /g, ''), detailAddress.value].filter(Boolean).join(' '))
// 拨号/复制号码统一口径：手机优先、座机兜底（与 H5 contactPhone 一致）
const contactPhone = computed(() => card.value.mobile || card.value.phone || '')
// 有坐标才能唤起原生地图；无坐标时地址点击仍复制
const canNavigate = computed(() => {
  const c = card.value
  return Number.isFinite(Number(c.latitude)) && Number.isFinite(Number(c.longitude))
    && String(c.latitude) !== '' && String(c.longitude) !== ''
})
// 简介唯一真相源：bio，存量 company_intro 回落（与 H5 CardView 同口径）
const introText = computed(() => card.value.bio || card.value.company_intro || '')
const siteLinks = computed(() => {
  const c = card.value
  const arr = []
  if (c.website) arr.push({ key: 'website', label: '公司主页', url: c.website })
  if (c.shop_url) arr.push({ key: 'shop', label: '店铺主页', url: c.shop_url })
  return arr
})

// 访客「我也要创建」：未登录先去登录（带回跳），已登录直达建卡页
function goCreate() {
  if (!uni.getStorageSync('mcard_token')) {
    uni.setStorageSync('mcard_login_redirect', '/pages/me/me')
    return uni.navigateTo({ url: '/pages/login/login' })
  }
  uni.reLaunch({ url: '/pages/me/me' })
}

// 相册直看：图片用系统预览（可放大保存），网页/文档复制链接去浏览器，不跳中间页
function isImageMaterial(m) {
  return !!(m && m.type === 'file' && m.url && /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(m.url))
}
function materialUrl(m) {
  const u = m.url || ''
  return u.startsWith('/') ? baseUrl + u : u
}
function openPhoto(m) {
  const urls = materials.value.filter(isImageMaterial).map(materialUrl)
  const current = materialUrl(m)
  uni.previewImage({ current, urls })
  countView(m)
}
function openMaterial(m) {
  copyText(materialUrl(m), '链接已复制，请粘贴到浏览器打开')
  countView(m)
}
function countView(m) {
  api.post(`/api/cards/public/materials/${m.id}/view`).catch(() => {})
}

// 导航到此处：用名片坐标唤起系统地图（微信内置地图），无坐标时地址点击仍复制。
function openNavigation() {
  const c = card.value
  if (!c || !canNavigate.value) return toast('该名片未设置坐标，请复制地址到地图导航')
  uni.openLocation({
    latitude: Number(c.latitude),
    longitude: Number(c.longitude),
    name: c.name || c.company || '名片地址',
    address: fullAddress.value || c.city || '',
    scale: 18,
    fail: () => copyText(fullAddress.value, '无法唤起地图，地址已复制，可粘贴到地图')
  })
}

async function exchange() {
  const mine = parseSlug(mySlug.value)
  if (!mine) return toast('请填写你的名片短码')
  exchanging.value = true
  try {
    await api.post(`/api/cards/public/${card.value.slug}/exchange`, { slug: mine }, false)
    toast('交换成功', 'success')
  } catch (e) { toast(e.message) } finally { exchanging.value = false }
}
</script>

<style scoped>
.cover { height: 240rpx; border-radius: 0 0 40rpx 40rpx; padding: 30rpx; color: #fff; position: relative; overflow: hidden; }
/* 封面动态光晕：主题色柔光呼吸，只动 opacity 不动位移（避免被感知为遮罩在动） */
.cover::before { content: ''; position: absolute; top: -30%; right: -30%; bottom: -30%; left: -30%; pointer-events: none; z-index: 0; background: radial-gradient(70% 90% at 22% 10%, rgba(var(--glow-rgb, 37,99,235), .22), transparent 62%); animation: cvGlow 30s ease-in-out infinite alternate; }
/* WXSS 不支持 * 通配选择器（编译报 error at token '*'），显式列出 cover 的两个子元素 */
.cover .brand, .cover .inactive { position: relative; z-index: 1; }
@keyframes cvGlow { 0% { opacity: .4; } 100% { opacity: 1; } }
.brand { font-size: 36rpx; font-weight: 800; }
.em { opacity: .8; }
.inactive { position: absolute; right: 30rpx; top: 34rpx; font-size: 22rpx; background: rgba(255,255,255,.22); padding: 6rpx 16rpx; border-radius: 999rpx; }
.body { padding: 22rpx; margin-top: -56rpx; }
.card { background: #fff; border-radius: 24rpx; padding: 26rpx; margin-bottom: 18rpx; box-shadow: 0 8rpx 28rpx rgba(15,23,42,.05); }
.profile { display: flex; flex-wrap: wrap; align-items: center; gap: 20rpx; position: relative; overflow: hidden; }
/* 主卡静态质感：顶缘高光 + 极淡主题色拉丝（不动画，稳重不花哨） */
.tpl-contact .profile, .tpl-navygold .profile, .tpl-classic .profile {
  background-image: linear-gradient(180deg, rgba(255,255,255,.55), transparent 30%), repeating-linear-gradient(112deg, rgba(var(--glow-rgb, 37,99,235),.018) 0 1rpx, transparent 1rpx 6rpx);
}
.avatar { width: 120rpx; height: 120rpx; border-radius: 24rpx; background: #a62b2b; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 52rpx; font-weight: 800; overflow: hidden; flex-shrink: 0; }
.avatar image { width: 100%; height: 100%; }
/* LOGO 优先时白底完整展示；头像仍铺满 */
.avatar.is-logo { background: #fff; padding: 10rpx; box-sizing: border-box; }
.ident { flex: 1; min-width: 0; padding-right: 104rpx; }
.name-row { display: flex; align-items: center; gap: 14rpx; }
.name { font-size: 38rpx; font-weight: 800; }
.title { font-size: 24rpx; color: #8a7355; margin-top: 6rpx; }
.tags { width: 100%; display: flex; gap: 10rpx; flex-wrap: wrap; }
.tags text { font-size: 20rpx; color: #a62b2b; background: #f7ecd9; padding: 4rpx 14rpx; border-radius: 999rpx; }
/* 身份卡新增元素：✎ 编辑（本人）、小二维码入口、未开通角标、英文名、公司独立行 */
.inline-edit { position: absolute; left: 20rpx; top: 20rpx; width: 52rpx; height: 52rpx; border-radius: 50%; font-size: 26rpx; line-height: 1; color: var(--t-accent, #a62b2b); background: rgba(var(--glow-rgb, 37,99,235), .1); border: 2rpx solid rgba(var(--glow-rgb, 37,99,235), .22); padding: 0; display: flex; align-items: center; justify-content: center; }
.inline-edit::after { border: 0; }
.qr-entry { position: absolute; right: 20rpx; top: 20rpx; width: 96rpx; height: 96rpx; padding: 8rpx; box-sizing: border-box; background: #fff; border: 2rpx solid #e8dcc2; border-radius: 12rpx; }
.qr-entry::after { border: 0; }
.qr-entry image { width: 100%; height: 100%; }
.status-badge { position: absolute; right: 20rpx; bottom: 16rpx; font-size: 20rpx; color: #92400e; background: #fef3c7; padding: 6rpx 16rpx; border-radius: 999rpx; }
.en { font-size: 22rpx; font-weight: 400; color: #8a7355; margin-left: 10rpx; }
.org { font-size: 24rpx; color: #5c4a35; margin-top: 4rpx; }
/* 联系方式块：一行一字段点行复制（与 H5 同构），行内小按钮=拨打/导航 */
.crow { display: flex; align-items: center; gap: 12rpx; padding: 16rpx 0; border-bottom: 2rpx solid #f1f5f9; }
.crow:last-child { border-bottom: 0; }
.crow-label { font-size: 24rpx; color: #8a7355; flex-shrink: 0; }
.crow-value { flex: 1; min-width: 0; font-size: 26rpx; color: #2b2118; word-break: break-all; }
.crow-act { flex-shrink: 0; font-size: 22rpx; color: #a62b2b; background: #f7ecd9; padding: 8rpx 20rpx; border-radius: 999rpx; }
.notice { border-left: 8rpx solid #f59e0b; }
.notice-b { font-size: 28rpx; font-weight: 700; margin-bottom: 8rpx; }
.section { font-size: 30rpx; font-weight: 700; margin-bottom: 12rpx; }
/* 相册：图片点开用系统预览，链接/文档直接复制，不跳中间页 */
.gal { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14rpx; }
.gal-img { width: 100%; aspect-ratio: 1; border-radius: 12rpx; background: #f0e7d2; }
.gal-file { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8rpx; aspect-ratio: 1; border-radius: 12rpx; background: #f7ecd9; padding: 10rpx; box-sizing: border-box; }
.content { font-size: 26rpx; color: #5c4a35; line-height: 1.7; }
.gal-ico { font-size: 40rpx; }
.gal-title { font-size: 22rpx; color: #334155; text-align: center; line-height: 1.3; max-height: 58rpx; overflow: hidden; }
.link { display: flex; flex-direction: column; padding: 14rpx 0; border-bottom: 2rpx solid #f1f5f9; }
.link .b { font-size: 26rpx; font-weight: 600; }
.hint { font-size: 22rpx; color: #b09a72; margin-top: 14rpx; line-height: 1.6; }
/* 二维码大图弹层（点击身份卡右上小码打开） */
.mask { position: fixed; left: 0; right: 0; top: 0; bottom: 0; background: rgba(15,23,42,.55); z-index: 120; display: flex; align-items: center; justify-content: center; padding: 40rpx; }
.qr-modal { width: 100%; max-width: 560rpx; background: #fff; border-radius: 24rpx; padding: 36rpx 30rpx; }
.qr-modal-title { font-size: 32rpx; font-weight: 800; text-align: center; margin-bottom: 20rpx; }
/* 双码切换（联系人码/名片链接码）：胶囊分段控件，button 重置 */
.qr-tabs { display: flex; justify-content: center; gap: 12rpx; margin-bottom: 20rpx; }
.qr-tab { font-size: 24rpx; font-weight: 600; padding: 12rpx 30rpx; border-radius: 999rpx; line-height: 1.2; border: 2rpx solid #e8dcc2; background: #f7f1e3; color: #8a7355; }
.qr-tab::after { border: 0; }
.qr-tab.on { background: #a62b2b; border-color: #a62b2b; color: #fff; }
.qr-big { width: 400rpx; height: 400rpx; margin: 0 auto 16rpx; display: block; background: #fff; }
.qr-url { font-size: 22rpx; color: #8a7355; text-align: center; word-break: break-all; margin-bottom: 8rpx; }
.qr-modal-btns { justify-content: center; flex-wrap: wrap; }
.btn-row { display: flex; gap: 12rpx; margin-top: 16rpx; }
.btn { font-size: 24rpx; padding: 16rpx 0; border-radius: 12rpx; background: #f0e7d2; color: #2b2118; }
.btn::after { border: 0; }
.btn.primary { background: #a62b2b; color: #fff; }
.btn.tiny { padding: 8rpx 18rpx; font-size: 22rpx; flex-shrink: 0; }
.btn.block { width: 100%; }
.input { width: 100%; height: 84rpx; line-height: 84rpx; box-sizing: border-box; border: 2rpx solid #e8dcc2; border-radius: 12rpx; padding: 0 20rpx; font-size: 26rpx; }
.create-own { text-align: center; }
.create-own-copy { display: flex; flex-direction: column; gap: 8rpx; margin-bottom: 20rpx; }
.create-own-copy .b { font-size: 30rpx; font-weight: 700; }
.foot { text-align: center; font-size: 22rpx; color: #b09a72; padding: 30rpx 0 40rpx; }
.foot-b { font-weight: 700; }
.muted { color: #8a7355; }
.small { font-size: 22rpx; }

/* ============ 布局模板：template × theme 正交，模板只改布局/形状，颜色走 --t-accent ============ */
/* 经典 classic：默认样式即经典 */
.tpl-classic .avatar { border-radius: 24rpx; }

/* ① 极简白 minimal：无封面大留白 + 超大姓名 + 细线分割 */
.tpl-minimal .cover { height: 100rpx; border-radius: 0; border-bottom: 2rpx solid #e5e7eb; }
.tpl-minimal .brand { color: #111827; }
.tpl-minimal .body { margin-top: 0; }
.tpl-minimal .card { box-shadow: none; border-radius: 0; background: transparent; border-bottom: 2rpx solid #eef0f3; padding: 28rpx 8rpx; }
.tpl-minimal .avatar { border-radius: 50%; width: 104rpx; height: 104rpx; }
.tpl-minimal .name { font-size: 48rpx; font-weight: 800; letter-spacing: -2rpx; color: #111827; }
.tpl-minimal .tags text { border-radius: 0; background: transparent; border-bottom: 2rpx solid var(--t-accent); color: var(--t-accent); padding: 2rpx 0; }
.tpl-minimal .section { font-size: 22rpx; color: #9ca3af; letter-spacing: 3rpx; }
.tpl-minimal .ico { border-radius: 50%; border: 2rpx solid #e5e7eb; background: transparent; }

/* ② 尊享黑金 elite：深色沉浸 + 居中金环头像 + 衬线署名（固定深底，强调色跟主题） */
.tpl-elite { background: #0b0d12; min-height: 100vh; }
.tpl-elite .cover { height: 300rpx; border-radius: 0 0 48rpx 48rpx; }
.tpl-elite .body { margin-top: -80rpx; }
.tpl-elite .card { background: #15171c; border: 2rpx solid rgba(255,255,255,.09); box-shadow: none; }
.tpl-elite .profile { flex-direction: column; align-items: center; text-align: center; gap: 12rpx; }
.tpl-elite .avatar { width: 140rpx; height: 140rpx; border-radius: 50%; border: 4rpx solid var(--t-accent); box-shadow: 0 0 0 8rpx #15171c, 0 12rpx 30rpx rgba(0,0,0,.4); }
.tpl-elite .name-row { justify-content: center; }
.tpl-elite .name { font-size: 42rpx; letter-spacing: 6rpx; color: #f5f5f4; }
.tpl-elite .title, .tpl-elite .content { color: #a1a1aa; }
.tpl-elite .tags { justify-content: center; }
.tpl-elite .tags text { border-radius: 0; border-bottom: 2rpx solid var(--t-accent); background: transparent; color: var(--t-accent); }
.tpl-elite .inactive { position: static; margin-left: 20rpx; }
.tpl-elite .section { text-align: center; color: var(--t-accent); letter-spacing: 6rpx; }
.tpl-elite .qr-card { flex-direction: column; text-align: center; }

/* ③ 活力渐变 vivid：大圆角封面 + 悬浮大头像 + 胶囊标签 */
.tpl-vivid .cover { height: 260rpx; border-radius: 0 0 56rpx 56rpx; }
.tpl-vivid .body { margin-top: -66rpx; }
.tpl-vivid .card { border-radius: 28rpx; box-shadow: 0 12rpx 34rpx rgba(15,23,42,.1); }
.tpl-vivid .avatar { width: 130rpx; height: 130rpx; border-radius: 34rpx; box-shadow: 0 8rpx 24rpx var(--t-accent); }
.tpl-vivid .name { font-size: 40rpx; }
.tpl-vivid .tags text { border-radius: 999rpx; padding: 6rpx 18rpx; }
.tpl-vivid .ico { border-radius: 18rpx; }

/* ④ 杂志方格 seal：黑白高对比 + 直角细框 + 大字号（设计媒体风） */
.tpl-seal { background: #fafafa; }
.tpl-seal .cover { height: 120rpx; border-radius: 0; border-bottom: 8rpx solid #111827; }
.tpl-seal .brand { color: #fff; letter-spacing: 4rpx; }
.tpl-seal .body { margin-top: -20rpx; }
.tpl-seal .card { border-radius: 0; border: 4rpx solid #111827; box-shadow: 8rpx 8rpx 0 rgba(17,24,39,.12); background: #fff; }
.tpl-seal .profile { border-top: 10rpx solid #111827; padding: 24rpx 20rpx; }
.tpl-seal .avatar { border-radius: 0; width: 120rpx; height: 120rpx; border: 4rpx solid #111827; box-shadow: none; }
.tpl-seal .name { color: #111827; font-size: 52rpx; font-weight: 900; letter-spacing: -2rpx; }
.tpl-seal .title { color: var(--t-accent); font-weight: 700; }
.tpl-seal .tags text { border-radius: 0; border: 4rpx solid #111827; background: #fff; color: #111827; }
.tpl-seal .ico { border-radius: 0; border: 4rpx solid #111827; background: #fff; color: #111827; }
.tpl-seal .section { color: #111827; letter-spacing: 2rpx; border-left: 12rpx solid #111827; padding-left: 14rpx; }
.tpl-seal .qr { border-radius: 0; border: 4rpx solid #111827; }
.tpl-seal .foot { color: #8a7355; letter-spacing: 2rpx; }

/* ⓪ 唐红鎏金 tang（默认）：唐红渐变底 + 烫金边象牙白卡 + 鎏金点缀，古美融入现代商务 */
.tpl-tang { background: radial-gradient(1200rpx 520rpx at 50% -12%, #7a1e15 0%, #a62b2b 42%, #8c2318 74%, #5f160f 100%); min-height: 100vh; }
.tpl-tang .cover { height: 210rpx; border-radius: 0 0 40rpx 40rpx; position: relative; }
.tpl-tang .cover::after { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 8rpx; background: linear-gradient(90deg, #7a1e15, #a62b2b 38%, #c9a227 78%, #d4af37); }
.tpl-tang .brand { color: #f3e2b3; letter-spacing: 4rpx; }
.tpl-tang .body { margin-top: -44rpx; }
.tpl-tang .card { border-radius: 22rpx; border: 2rpx solid rgba(201,162,39,.55); box-shadow: 0 26rpx 60rpx -22rpx rgba(60,10,6,.6); background: #fffdf8; }
.tpl-tang .profile { position: relative; overflow: hidden; padding: 34rpx 26rpx 24rpx; border-radius: 18rpx; }
.tpl-tang .profile::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 10rpx; background: linear-gradient(90deg, #7a1e15, #a62b2b 38%, #c9a227 78%, #d4af37); }
.tpl-tang .avatar { width: 116rpx; height: 116rpx; border-radius: 16rpx; background: linear-gradient(145deg, #a62b2b, #7a1e15); box-shadow: inset 0 0 0 4rpx rgba(212,175,55,.6), 0 8rpx 18rpx -8rpx rgba(92,22,15,.6); }
.tpl-tang .name { color: #7a1e15; font-size: 48rpx; font-weight: 900; letter-spacing: 2rpx; }
.tpl-tang .title { color: #8a7355; font-size: 24rpx; letter-spacing: 1rpx; }
.tpl-tang .tags text { border-radius: 999rpx; background: #f7ecd9; color: #8a5a1e; box-shadow: inset 0 0 0 2rpx rgba(201,162,39,.35); }
.tpl-tang .actions { border-radius: 18rpx; border: 2rpx solid rgba(201,162,39,.35); }
.tpl-tang .act:first-child { background: linear-gradient(135deg, #a62b2b, #7a1e15); }
.tpl-tang .ico { border-radius: 14rpx; }
.tpl-tang .section { color: #8c2318; border-left: 6rpx solid #c9a227; }
.tpl-tang .btn.primary { background: linear-gradient(135deg, #d4af37, #c9a227); color: #fff; }
.tpl-tang .qr { border: 4rpx solid rgba(201,162,39,.5); }

/* ① 瓦纳蓝 vanna：深邃海蓝渐变底 + 冷白卡 + 湖蓝描边 */
.tpl-vanna { background: radial-gradient(1200rpx 520rpx at 50% -12%, #0c2a4d 0%, #155a96 45%, #0e3a63 78%, #08203a 100%); min-height: 100vh; }
.tpl-vanna .cover { height: 210rpx; border-radius: 0 0 40rpx 40rpx; position: relative; }
.tpl-vanna .cover::after { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 8rpx; background: linear-gradient(90deg, #0c2a4d, #155a96 40%, #2a8fd4 80%, #5bb6e8); }
.tpl-vanna .brand { color: #cfe8f6; letter-spacing: 4rpx; }
.tpl-vanna .body { margin-top: -44rpx; }
.tpl-vanna .card { border-radius: 22rpx; border: 2rpx solid rgba(42,143,212,.5); box-shadow: 0 26rpx 60rpx -22rpx rgba(8,32,58,.6); background: #fff; }
.tpl-vanna .profile { position: relative; overflow: hidden; padding: 34rpx 26rpx 24rpx; border-radius: 18rpx; }
.tpl-vanna .profile::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 10rpx; background: linear-gradient(90deg, #0c2a4d, #155a96 40%, #2a8fd4 80%, #5bb6e8); }
.tpl-vanna .avatar { width: 116rpx; height: 116rpx; border-radius: 16rpx; background: linear-gradient(145deg, #2a8fd4, #0c2a4d); box-shadow: inset 0 0 0 4rpx rgba(91,182,232,.55), 0 8rpx 18rpx -8rpx rgba(8,32,58,.6); }
.tpl-vanna .name { color: #0c2a4d; font-size: 48rpx; font-weight: 900; letter-spacing: 2rpx; }
.tpl-vanna .title { color: #5b7c99; font-size: 24rpx; letter-spacing: 1rpx; }
.tpl-vanna .tags text { border-radius: 999rpx; background: #eaf2f9; color: #1b5c8f; box-shadow: inset 0 0 0 2rpx rgba(42,143,212,.32); }
.tpl-vanna .actions { border-radius: 18rpx; border: 2rpx solid rgba(42,143,212,.32); }
.tpl-vanna .act:first-child { background: linear-gradient(135deg, #2a8fd4, #155a96); }
.tpl-vanna .ico { border-radius: 14rpx; }
.tpl-vanna .section { color: #155a96; border-left: 6rpx solid #2a8fd4; }
.tpl-vanna .btn.primary { background: linear-gradient(135deg, #5bb6e8, #2a8fd4); color: #fff; }
.tpl-vanna .qr { border: 4rpx solid rgba(42,143,212,.5); }

/* ② 幻影绿 phantom：翡翠墨绿渐变底 + 象牙白卡 + 翠绿描边 */
.tpl-phantom { background: radial-gradient(1200rpx 520rpx at 50% -12%, #052e1c 0%, #0f6b3f 45%, #0a4d2c 78%, #032013 100%); min-height: 100vh; }
.tpl-phantom .cover { height: 210rpx; border-radius: 0 0 40rpx 40rpx; position: relative; }
.tpl-phantom .cover::after { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 8rpx; background: linear-gradient(90deg, #052e1c, #0f6b3f 40%, #22c97a 80%, #5be8a0); }
.tpl-phantom .brand { color: #c8f0da; letter-spacing: 4rpx; }
.tpl-phantom .body { margin-top: -44rpx; }
.tpl-phantom .card { border-radius: 22rpx; border: 2rpx solid rgba(34,201,122,.5); box-shadow: 0 26rpx 60rpx -22rpx rgba(3,32,19,.6); background: #fff; }
.tpl-phantom .profile { position: relative; overflow: hidden; padding: 34rpx 26rpx 24rpx; border-radius: 18rpx; }
.tpl-phantom .profile::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 10rpx; background: linear-gradient(90deg, #052e1c, #0f6b3f 40%, #22c97a 80%, #5be8a0); }
.tpl-phantom .avatar { width: 116rpx; height: 116rpx; border-radius: 16rpx; background: linear-gradient(145deg, #22c97a, #052e1c); box-shadow: inset 0 0 0 4rpx rgba(91,232,160,.55), 0 8rpx 18rpx -8rpx rgba(3,32,19,.6); }
.tpl-phantom .name { color: #052e1c; font-size: 48rpx; font-weight: 900; letter-spacing: 2rpx; }
.tpl-phantom .title { color: #4e7a64; font-size: 24rpx; letter-spacing: 1rpx; }
.tpl-phantom .tags text { border-radius: 999rpx; background: #e8f5ee; color: #17704a; box-shadow: inset 0 0 0 2rpx rgba(34,201,122,.32); }
.tpl-phantom .actions { border-radius: 18rpx; border: 2rpx solid rgba(34,201,122,.32); }
.tpl-phantom .act:first-child { background: linear-gradient(135deg, #22c97a, #0f6b3f); }
.tpl-phantom .ico { border-radius: 14rpx; }
.tpl-phantom .section { color: #0f6b3f; border-left: 6rpx solid #22c97a; }
.tpl-phantom .btn.primary { background: linear-gradient(135deg, #5be8a0, #22c97a); color: #fff; }
.tpl-phantom .qr { border: 4rpx solid rgba(34,201,122,.5); }

/* ③ 熔岩灰 lava：火山岩灰渐变底 + 暖白卡 + 熔岩橙描边 */
.tpl-lava { background: radial-gradient(1200rpx 520rpx at 50% -12%, #1a1a1e 0%, #2c2c33 45%, #3a3a42 78%, #15151a 100%); min-height: 100vh; }
.tpl-lava .cover { height: 210rpx; border-radius: 0 0 40rpx 40rpx; position: relative; }
.tpl-lava .cover::after { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 8rpx; background: linear-gradient(90deg, #1a1a1e, #3a3a42 40%, #c2410c 80%, #ea6a2c); }
.tpl-lava .brand { color: #f5c8a8; letter-spacing: 4rpx; }
.tpl-lava .body { margin-top: -44rpx; }
.tpl-lava .card { border-radius: 22rpx; border: 2rpx solid rgba(194,65,12,.5); box-shadow: 0 26rpx 60rpx -22rpx rgba(10,10,14,.6); background: #fff; }
.tpl-lava .profile { position: relative; overflow: hidden; padding: 34rpx 26rpx 24rpx; border-radius: 18rpx; }
.tpl-lava .profile::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 10rpx; background: linear-gradient(90deg, #1a1a1e, #3a3a42 40%, #c2410c 80%, #ea6a2c); }
.tpl-lava .avatar { width: 116rpx; height: 116rpx; border-radius: 16rpx; background: linear-gradient(145deg, #c2410c, #1a1a1e); box-shadow: inset 0 0 0 4rpx rgba(234,106,44,.5), 0 8rpx 18rpx -8rpx rgba(10,10,14,.6); }
.tpl-lava .name { color: #1a1a1e; font-size: 48rpx; font-weight: 900; letter-spacing: 2rpx; }
.tpl-lava .title { color: #6b6b76; font-size: 24rpx; letter-spacing: 1rpx; }
.tpl-lava .tags text { border-radius: 999rpx; background: #f1f1f2; color: #b3481a; box-shadow: inset 0 0 0 2rpx rgba(194,65,12,.32); }
.tpl-lava .actions { border-radius: 18rpx; border: 2rpx solid rgba(194,65,12,.32); }
.tpl-lava .act:first-child { background: linear-gradient(135deg, #ea6a2c, #c2410c); }
.tpl-lava .ico { border-radius: 14rpx; }
.tpl-lava .section { color: #c2410c; border-left: 6rpx solid #ea6a2c; }
.tpl-lava .btn.primary { background: linear-gradient(135deg, #f59264, #ea6a2c); color: #fff; }
.tpl-lava .qr { border: 4rpx solid rgba(194,65,12,.5); }

/* ④ 星钻黑 star：曜石黑渐变底 + 深空卡 + 碎钻银描边 */
.tpl-star { background: radial-gradient(1200rpx 520rpx at 50% -12%, #08080c 0%, #1a1a24 45%, #2a2a38 78%, #06060a 100%); min-height: 100vh; }
.tpl-star .cover { height: 210rpx; border-radius: 0 0 40rpx 40rpx; position: relative; }
.tpl-star .cover::after { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 8rpx; background: linear-gradient(90deg, #08080c, #2a2a38 40%, #8a8aa0 80%, #c8c8dc); }
.tpl-star .brand { color: #e0e0f0; letter-spacing: 4rpx; }
.tpl-star .body { margin-top: -44rpx; }
.tpl-star .card { border-radius: 22rpx; border: 2rpx solid rgba(200,200,220,.28); box-shadow: 0 30rpx 70rpx -30rpx #000; background: #12121a; }
.tpl-star .profile { position: relative; overflow: hidden; padding: 34rpx 26rpx 24rpx; border-radius: 18rpx; background: linear-gradient(160deg, rgba(255,255,255,.08), rgba(255,255,255,.02)); }
.tpl-star .profile::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 10rpx; background: linear-gradient(90deg, #08080c, #2a2a38 40%, #8a8aa0 80%, #c8c8dc); }
.tpl-star .avatar { width: 116rpx; height: 116rpx; border-radius: 16rpx; background: linear-gradient(145deg, #4a4a5e, #1a1a24); box-shadow: inset 0 0 0 4rpx rgba(200,200,220,.4), 0 8rpx 18rpx -8rpx rgba(0,0,0,.6); }
.tpl-star .name { color: #f2f0f8; font-size: 48rpx; font-weight: 900; letter-spacing: 2rpx; }
.tpl-star .title { color: #8a8aa0; font-size: 24rpx; letter-spacing: 1rpx; }
.tpl-star .tags text { border-radius: 999rpx; background: rgba(255,255,255,.07); color: #a8a8c0; box-shadow: inset 0 0 0 2rpx rgba(255,255,255,.1); }
.tpl-star .actions { border-radius: 18rpx; border: 2rpx solid rgba(255,255,255,.12); }
.tpl-star .act { background: rgba(255,255,255,.08); color: #dcdce8; }
.tpl-star .act:first-child { background: linear-gradient(135deg, #4a4a5e, #2a2a38); color: #fff; }
.tpl-star .ico { border-radius: 14rpx; }
.tpl-star .section { color: #c8c8dc; border-left: 6rpx solid #8a8aa0; }
.tpl-star .btn.primary { background: linear-gradient(135deg, #4a4a5e, #2a2a38); color: #fff; }
.tpl-star .qr { border: 4rpx solid rgba(200,200,220,.35); }

/* ⑤ 阿拉斯红 alas：深绯红渐变底 + 象牙白卡 + 亮红描边 */
.tpl-alas { background: radial-gradient(1200rpx 520rpx at 50% -12%, #4a0d14 0%, #a01722 45%, #7a1220 78%, #30080e 100%); min-height: 100vh; }
.tpl-alas .cover { height: 210rpx; border-radius: 0 0 40rpx 40rpx; position: relative; }
.tpl-alas .cover::after { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 8rpx; background: linear-gradient(90deg, #4a0d14, #a01722 40%, #e0323c 80%, #f06068); }
.tpl-alas .brand { color: #f5c8cc; letter-spacing: 4rpx; }
.tpl-alas .body { margin-top: -44rpx; }
.tpl-alas .card { border-radius: 22rpx; border: 2rpx solid rgba(224,50,60,.5); box-shadow: 0 26rpx 60rpx -22rpx rgba(48,8,14,.6); background: #fff; }
.tpl-alas .profile { position: relative; overflow: hidden; padding: 34rpx 26rpx 24rpx; border-radius: 18rpx; }
.tpl-alas .profile::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 10rpx; background: linear-gradient(90deg, #4a0d14, #a01722 40%, #e0323c 80%, #f06068); }
.tpl-alas .avatar { width: 116rpx; height: 116rpx; border-radius: 16rpx; background: linear-gradient(145deg, #e0323c, #4a0d14); box-shadow: inset 0 0 0 4rpx rgba(240,96,104,.55), 0 8rpx 18rpx -8rpx rgba(48,8,14,.6); }
.tpl-alas .name { color: #4a0d14; font-size: 48rpx; font-weight: 900; letter-spacing: 2rpx; }
.tpl-alas .title { color: #96616a; font-size: 24rpx; letter-spacing: 1rpx; }
.tpl-alas .tags text { border-radius: 999rpx; background: #f9eaea; color: #a02530; box-shadow: inset 0 0 0 2rpx rgba(224,50,60,.32); }
.tpl-alas .actions { border-radius: 18rpx; border: 2rpx solid rgba(224,50,60,.32); }
.tpl-alas .act:first-child { background: linear-gradient(135deg, #e0323c, #a01722); }
.tpl-alas .ico { border-radius: 14rpx; }
.tpl-alas .section { color: #a01722; border-left: 6rpx solid #e0323c; }
.tpl-alas .btn.primary { background: linear-gradient(135deg, #f06068, #e0323c); color: #fff; }
.tpl-alas .qr { border: 4rpx solid rgba(224,50,60,.5); }

/* ⑤ 联络卡 contact：深蓝封面 + 居中身份 + 业务标签 */
.tpl-contact .cover { height: 200rpx; border-radius: 0 0 28rpx 28rpx; }
.tpl-contact .body { margin-top: -40rpx; }
.tpl-contact .profile { border-radius: 18rpx; border: 2rpx solid #e8dcc2; padding: 28rpx 20rpx; }
.tpl-contact .avatar { border-radius: 14rpx; width: 124rpx; height: 124rpx; border: 4rpx solid #fff; }
.tpl-contact .name { font-size: 40rpx; letter-spacing: 1rpx; }
.tpl-contact .tags text { border-radius: 6rpx; border: 2rpx solid var(--t-accent); background: transparent; color: var(--t-accent); padding: 6rpx 16rpx; }
.tpl-contact .actions { border-radius: 18rpx; border: 2rpx solid #e8dcc2; }
.tpl-contact .ico { border-radius: 14rpx; }
.tpl-contact .card { border-radius: 18rpx; }
.tpl-contact .section { border-left: 6rpx solid var(--t-accent); }

/* 深蓝鎏金 navygold：深蓝放射底 + 白卡金线 + 沙金标签 + 表格化署名（与 Web 端同口径） */
.tpl-navygold { background: radial-gradient(1200rpx 500rpx at 50% -10%, #1d3a55 0%, #132a3d 45%, #0c1a26 100%); min-height: 100vh; }
.tpl-navygold .cover { height: 220rpx; border-radius: 0 0 44rpx 44rpx; position: relative; }
.tpl-navygold .cover::after { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 8rpx; background: linear-gradient(90deg, #1d3a55, #2f5a7d 40%, #d8bb85 78%, #b99355); }
.tpl-navygold .brand { color: #d8bb85; }
.tpl-navygold .body { margin-top: -48rpx; }
.tpl-navygold .card { border-radius: 22rpx; border: 2rpx solid rgba(185,147,85,.28); box-shadow: 0 26rpx 60rpx -22rpx rgba(0,0,0,.65); }
.tpl-navygold .profile { position: relative; overflow: hidden; padding: 36rpx 28rpx 24rpx; }
.tpl-navygold .profile::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 12rpx; background: linear-gradient(90deg, #1d3a55, #2f5a7d 40%, #d8bb85 78%, #b99355); }
.tpl-navygold .avatar { width: 110rpx; height: 110rpx; border-radius: 22rpx; background: linear-gradient(145deg, #1d3a55, #0e2233); box-shadow: inset 0 0 0 4rpx rgba(216,187,133,.5), 0 8rpx 18rpx -8rpx rgba(18,32,46,.6); }
.tpl-navygold .name { color: #12202e; font-size: 50rpx; font-weight: 900; letter-spacing: 2rpx; }
.tpl-navygold .title { color: #4a5b6e; font-size: 24rpx; letter-spacing: 1rpx; }
.tpl-navygold .ng-org { color: #1d3a55; font-size: 26rpx; font-weight: 700; border-top: 2rpx dashed #e2ddd2; padding-top: 18rpx; margin-top: 18rpx; }
.tpl-navygold .tags text { border-radius: 999rpx; background: #f4f1ea; color: #6b5a3c; box-shadow: inset 0 0 0 2rpx rgba(185,147,85,.28); }
.tpl-navygold .actions { grid-template-columns: repeat(2, 1fr); gap: 16rpx; }
.tpl-navygold .act { height: 88rpx; border-radius: 22rpx; background: #f7f5f0; color: #1d3a55; flex-direction: row; gap: 10rpx; font-size: 26rpx; font-weight: 700; box-shadow: inset 0 0 0 2rpx #e6e0d4; }
.tpl-navygold .act:first-child { background: linear-gradient(135deg, #1d3a55, #0f2739); color: #fff; box-shadow: 0 10rpx 22rpx -12rpx rgba(18,32,46,.85); }
.tpl-navygold .act:last-child:nth-child(odd) { grid-column: 1 / -1; }
.tpl-navygold .ico { width: auto; height: auto; border-radius: 0; background: transparent; color: inherit; font-size: 30rpx; }
.tpl-navygold .section { color: #1d3a55; border-left: 6rpx solid #b99355; padding-left: 14rpx; }
.tpl-navygold .content { color: #4a5b6e; }
.tpl-navygold .link { border-bottom: 2rpx solid #efece5; }
.tpl-navygold .link .b { color: #1d3a55; }
.tpl-navygold .btn.primary { background: linear-gradient(135deg, #c9a163, #a8834a); }
.tpl-navygold .qr { border: 4rpx solid rgba(185,147,85,.45); }
.tpl-navygold .foot { color: #a9b1ba; }
</style>
