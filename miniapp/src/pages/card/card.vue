<template>
  <view class="page" :class="'tpl-' + tpl" :style="{ '--t-accent': card?.accent || '#2563eb', '--glow-rgb': glowRgb }">
    <view v-if="loading" class="state">名片加载中…</view>
    <view v-else-if="error" class="state">
      <view class="big">!</view>
      <view>名片加载失败</view>
      <view class="muted small">{{ error }}</view>
      <button class="btn primary" style="margin-top:24rpx" @tap="load">重新加载</button>
    </view>

    <block v-else-if="card">
      <view class="cover" :style="{ background: coverBg }">
        <view class="brand">M<text class="em">Card</text></view>
        <view v-if="!card.active" class="inactive">未开通 / 已到期</view>
      </view>

      <view class="body">
        <view class="card profile">
          <view class="avatar" :class="{ 'is-logo': !!card.logo }">
            <image v-if="card.logo || card.avatar" :src="card.logo || card.avatar" :mode="card.logo ? 'aspectFit' : 'aspectFill'" />
            <text v-else>{{ (card.name || '名').slice(0, 1) }}</text>
          </view>
          <view class="ident">
            <view class="name-row">
              <view class="name">{{ card.name || card.name_en || '未填写姓名' }}</view>
            </view>
            <view class="title">{{ titleText }}</view>
            <view v-if="tpl === 'navygold' && card.company" class="ng-org">{{ card.company }}</view>
          </view>
          <view v-if="card.tags && card.tags.length" class="tags">
            <text v-for="tag in card.tags" :key="tag">{{ tag }}</text>
          </view>
        </view>

        <view class="card actions">
          <button class="act" @tap="callPhone(card.mobile || card.phone)"><text class="ico">✆</text><text>打电话</text></button>
          <button class="act" @tap="copyText(card.mobile || card.phone, '手机号已复制')"><text class="ico">✎</text><text>存号码</text></button>
          <button class="act" @tap="copyText(card.email, '邮箱已复制')"><text class="ico">✉</text><text>存邮箱</text></button>
          <button class="act" @tap="copyText(card.wechat || card.whatsapp, '微信号已复制')"><text class="ico">微</text><text>存微信</text></button>
          <button class="act" @tap="copyText(card.alipay, '支付宝账号已复制')"><text class="ico">支</text><text>存支付宝</text></button>
        </view>

        <!-- 简介只保留一个区块：字段 bio，标题统一叫「简介」；存量 company_intro 兜底 -->
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
            <text class="small" style="color:#2563eb">点击复制 ↗</text>
          </view>
        </view>

        <view v-if="fullAddress" class="card block">
          <view class="section">地址</view>
          <view v-if="regionLine" class="region-line">{{ regionLine }}</view>
          <view class="addr" @tap="canNavigate ? openNavigation() : copyText(fullAddress, '地址已复制，可粘贴到地图')">
            <text class="content">地址：{{ detailAddress }}</text>
            <text class="nav-mini" v-if="canNavigate">导航 ›</text>
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

        <view class="card qr-card">
          <image class="qr" :src="scanQrUrl(card.slug, 'qr.png', 440)" mode="aspectFit" />
          <view class="qr-info">
            <view class="section">扫一扫，存进通讯录</view>
            <view class="muted small">二维码永久固定，资料更新也不失效</view>
            <view class="btn-row">
              <button class="btn primary" @tap="saveQrImage(card.slug)">保存二维码</button>
              <button class="btn" @tap="copyText(withInvite(card.url || (baseUrl + '/c/' + card.slug)), '名片链接已复制')">复制链接</button>
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

        <view class="foot">由 MCard 提供技术支持</view>
      </view>

      <!-- 底部操作 dock：owner 对齐 H5（编辑/配色/集市/分享/管理），访客是联系操作（打电话/复制/存通讯录/导航/收藏/分享）。
           selfCheckDone 前不渲染，避免本人打开自己名片时先闪一下「收藏自己/打电话给自己」的访客 dock。 -->
      <view class="dock" v-if="selfCheckDone">
        <template v-if="isSelf">
          <button class="dock-btn" @tap="go('/pages/edit/edit')"><text class="dico">✎</text><text>编辑名片</text></button>
          <button class="dock-btn" @tap="go('/pages/edit/edit?focus=theme')"><text class="dico">◐</text><text>配色风格</text></button>
          <button class="dock-btn" @tap="go('/pages/market/market')"><text class="dico">⌕</text><text>名片集市</text></button>
          <button class="dock-btn" @tap="go('/pages/me/me')"><text class="dico">▤</text><text>管理</text></button>
          <button class="dock-btn primary" open-type="share"><text class="dico">↗</text><text>分享</text></button>
        </template>
        <template v-else>
          <button class="dock-btn" :disabled="!contactPhone" @tap="callPhone(contactPhone)"><text class="dico">✆</text><text>打电话</text></button>
          <button class="dock-btn" :disabled="!contactPhone" @tap="copyText(contactPhone, '号码已复制')"><text class="dico">⧉</text><text>复制号码</text></button>
          <button class="dock-btn" @tap="savePhoneContact"><text class="dico">▣</text><text>存通讯录</text></button>
          <button v-if="canNavigate" class="dock-btn" @tap="openNavigation"><text class="dico">⌖</text><text>导航</text></button>
          <button class="dock-btn" @tap="toggleFavorite"><text class="dico">{{ favorited ? '★' : '☆' }}</text><text>{{ favorited ? '已收藏' : '收藏' }}</text></button>
          <button class="dock-btn primary" open-type="share"><text class="dico">↗</text><text>分享</text></button>
        </template>
      </view>
    </block>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import { api, baseUrl, toast, copyText, callPhone, saveQrImage, parseSlug, getPublicMaterials, traceVisit, getShareCardImage, scanQrUrl, withInvite } from '../../utils/request'

const slug = ref('')
const card = ref(null)
const loading = ref(true)
const error = ref('')
const mySlug = ref('')
const exchanging = ref(false)
const tpl = ref('classic')
const materials = ref([])
const isSelf = ref(false)
const selfCheckDone = ref(false)
const favorited = ref(false)

// 动态光效用主题强调色，#rrggbb → rgb 分量
const glowRgb = computed(() => {
  const h = /^#?([0-9a-f]{6})$/i.exec(String(card.value?.accent || ''))
  if (!h) return '37,99,235'
  const n = parseInt(h[1], 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
})
const coverBg = computed(() => {
  const c = card.value?.accent || '#2563eb'
  if (tpl.value === 'minimal') return '#ffffff'
  if (tpl.value === 'elite') return 'linear-gradient(135deg,#18181b 0%,#27272a 55%,#0c0c0f 100%)'
  if (tpl.value === 'vivid') return `linear-gradient(135deg, ${c}, #db2777 60%, #f59e0b)`
  if (tpl.value === 'seal') return '#111827'
  if (tpl.value === 'contact') return `linear-gradient(135deg, #0b1a3a 0%, ${c} 100%)`
  if (tpl.value === 'navygold') return 'linear-gradient(135deg,#1d3a55 0%,#2f5a7d 40%,#d8bb85 78%,#b99355 100%)'
  return `linear-gradient(135deg, ${c}, #0f172a)`
})
// 深蓝鎏金把公司从职位行拆成独立署名行，其余模板保持原拼接口径
const titleText = computed(() => {
  const c = card.value || {}
  const parts = tpl.value === 'navygold' ? [c.title, c.department] : [c.title, c.company, c.department]
  return parts.filter(Boolean).join(' · ')
})
const regionLine = computed(() => {
  const c = card.value || {}
  return [c.province, c.city, c.district, c.street].filter(Boolean).join(' · ')
})
const detailAddress = computed(() => {
  const c = card.value || {}
  return [c.address, c.address_detail].filter(Boolean).join(' ')
})
const fullAddress = computed(() => [regionLine.value.replace(/ · /g, ''), detailAddress.value].filter(Boolean).join(' '))
// 拨号/复制号码统一口径：手机优先、座机兜底（与 H5 contactPhone 一致）
const contactPhone = computed(() => card.value?.mobile || card.value?.phone || '')
// 有坐标才能唤起原生地图；无坐标时 dock 不显示导航，地址点击仍复制
const canNavigate = computed(() => {
  const c = card.value || {}
  return Number.isFinite(Number(c.latitude)) && Number.isFinite(Number(c.longitude))
    && String(c.latitude) !== '' && String(c.longitude) !== ''
})
// 简介唯一真相源：bio，存量 company_intro 回落（与 H5 CardView 同口径）
const introText = computed(() => card.value?.bio || card.value?.company_intro || '')
const siteLinks = computed(() => {
  const c = card.value || {}
  const arr = []
  if (c.website) arr.push({ key: 'website', label: '公司主页', url: c.website })
  if (c.shop_url) arr.push({ key: 'shop', label: '店铺主页', url: c.shop_url })
  return arr
})

async function load() {
  loading.value = true; error.value = ''
  try {
    card.value = await api.get(`/api/cards/public/${slug.value}`, false)
    tpl.value = card.value?.template || 'classic'
  }
  catch (e) { error.value = e.message } finally { loading.value = false }
  // 本人视角判定（与 H5 owner 同口径）：自己看自己名片时隐藏「交换名片/存入通讯录」，
  // 否则就是自己跟自己交换、把自己存通讯录。未登录/失败一律当访客，不影响公开浏览。
  isSelf.value = false
  selfCheckDone.value = false
  favorited.value = false
  if (uni.getStorageSync('mcard_token')) {
    // 本人身份必须等判定完成再渲染 dock，否则访客操作会闪现一下
    api.get('/api/cards/mine', true)
      .then(mine => { isSelf.value = !!mine && mine.slug === slug.value })
      .catch(() => {})
      .finally(() => { selfCheckDone.value = true })
    // 收藏态：未登录当未收藏（按钮仍显示，点了提示登录），失败静默不误标
    api.get(`/api/cards/public/${slug.value}/favorite`, true)
      .then(d => { favorited.value = !!d?.favorite }).catch(() => {})
  } else {
    selfCheckDone.value = true
  }
  // 资料夹 + 来源上报（扫码进入 scene 记为 qr），失败静默
  getPublicMaterials(slug.value).then(d => { materials.value = d.list || [] }).catch(() => {})
  const src = String(entrySrc.value || '')
  if (src) traceVisit(slug.value, src)
}
const go = url => uni.navigateTo({ url })
const entrySrc = ref('')
onLoad(options => {
  slug.value = parseSlug(options.slug || options.scene || '') || 'zhangsan'
  if (options.scene || options.src) entrySrc.value = options.src || 'qr'
  load()
})
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

function copyContact() {
  if (!card.value) return
  const c = card.value
  const text = [
    `${c.name} ${c.title || ''}`.trim(),
    c.company ? `公司：${c.company}` : '',
    c.mobile ? `手机：${c.mobile}` : '',
    c.email ? `邮箱：${c.email}` : '',
    c.wechat ? `微信：${c.wechat}` : '',
    c.alipay ? `支付宝：${c.alipay}` : '',
    c.website ? `公司主页：${c.website}` : '',
    c.shop_url ? `店铺：${c.shop_url}` : '',
    (c.address || c.address_detail || c.province) ? `地址：${fullAddress.value}` : '',
    introText.value ? `简介：${introText.value}` : '',
    `电子名片：${c.url || baseUrl + '/c/' + c.slug}`
  ].filter(Boolean).join('\n')
  copyText(text, '名片信息已复制')
}

// 导航到此处：用名片坐标唤起系统地图（微信内置地图），无坐标时 dock 不显示该按钮。
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

// 收藏/取消收藏：需登录；未登录引导去登录，成功后回来 onShow 不会重跑（这是 onLoad 页），就地更新按钮态。
async function toggleFavorite() {
  if (!uni.getStorageSync('mcard_token')) {
    toast('请先登录再收藏名片')
    setTimeout(() => uni.navigateTo({ url: '/pages/login/login' }), 500)
    return
  }
  try {
    const d = await api.post(`/api/cards/public/${slug.value}/favorite`, {}, true)
    favorited.value = !!d?.favorite
    toast(favorited.value ? '已收藏' : '已取消收藏', 'success')
  } catch (e) { toast(e?.message || '操作失败') }
}

// 存入系统通讯录：拉起微信原生添加联系人界面，预填当前名片资料。
// 注意：这是系统通讯录写入，与「交换名片/名片夹」无关；无法静默保存，用户须在界面里确认。
function savePhoneContact() {
  const c = card.value
  if (!c) return
  const mobile = c.mobile || c.phone || ''
  if (!mobile) return toast('该名片未填写手机号，无法存入通讯录')
  const payload = {
    firstName: c.name || c.name_en || '未填写姓名',
    mobilePhoneNumber: mobile,
    organization: c.company || '',
    title: [c.title, c.department].filter(Boolean).join(' · '),
    email: c.email || '',
    addressState: c.province || '',
    addressCity: c.city || '',
    addressStreet: [c.district, c.street, c.address, c.address_detail].filter(Boolean).join(' '),
    weChatNumber: c.wechat || c.whatsapp || '',
    url: c.website || c.shop_url || '',
    success: () => toast('已打开添加联系人，请确认保存', 'success'),
    fail: err => {
      if (/cancel/i.test(String((err && err.errMsg) || ''))) return
      toast('无法调起通讯录，请检查小程序权限后重试')
    }
  }
  try {
    uni.addPhoneContact(payload)
  } catch (e) {
    toast('当前环境不支持存入通讯录')
  }
}

async function exchange() {
  const mine = parseSlug(mySlug.value)
  if (!mine) return toast('请填写你的名片短码')
  exchanging.value = true
  try {
    await api.post(`/api/cards/public/${slug.value}/exchange`, { slug: mine }, false)
    toast('交换成功', 'success')
  } catch (e) { toast(e.message) } finally { exchanging.value = false }
}

// 分享口径：标题「XXX的名片」；描述首选简介；
// 缩略图 公司LOGO → 用户头像 → 项目LOGO → 站点LOGO → 分享池（getShareCardImage 内）；不用纯二维码缩略图，
// 滤掉 svg/webp（微信解析不出会变灰块）。webp 头像自动落到下一候选，不会出错。
onShareAppMessage(() => {
  const c = card.value
  const absolute = u => (!u ? '' : /^https?:\/\//i.test(u) ? u : u.startsWith('/') ? baseUrl + u : '')
  const imageUrl = [c?.logo, c?.avatar].map(absolute).find(u => /\.(jpe?g|png|gif)(\?|$)/i.test(u)) || getShareCardImage()
  return {
    title: c ? `${c.name}的名片` : 'MCard 电子名片',
    desc: introText.value,
    path: withInvite(`/pages/card/card?slug=${slug.value}`),
    imageUrl
  }
})
</script>

<style scoped>
.state { padding: 120rpx 40rpx; text-align: center; color: #6b7688; }
.state .big { font-size: 80rpx; color: #cbd5e1; }
.state .muted { margin-top: 10rpx; }
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
.avatar { width: 120rpx; height: 120rpx; border-radius: 24rpx; background: #2563eb; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 52rpx; font-weight: 800; overflow: hidden; flex-shrink: 0; }
.avatar image { width: 100%; height: 100%; }
/* LOGO 优先时白底完整展示；头像仍铺满 */
.avatar.is-logo { background: #fff; padding: 10rpx; box-sizing: border-box; }
.ident { flex: 1; min-width: 0; }
.name-row { display: flex; align-items: center; gap: 14rpx; }
.name { font-size: 38rpx; font-weight: 800; }
.title { font-size: 24rpx; color: #6b7688; margin-top: 6rpx; }
.tags { width: 100%; display: flex; gap: 10rpx; flex-wrap: wrap; }
.tags text { font-size: 20rpx; color: #2563eb; background: #eff6ff; padding: 4rpx 14rpx; border-radius: 999rpx; }
.actions { display: grid; grid-template-columns: repeat(5, 1fr); padding: 16rpx 0; }
.act { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8rpx; font-size: 22rpx; color: #6b7688; background: transparent; padding: 0; line-height: 1.3; }
.act::after { border: 0; }
.ico { width: 68rpx; height: 68rpx; border-radius: 50%; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; font-size: 30rpx; font-weight: 700; }
.section { font-size: 30rpx; font-weight: 700; margin-bottom: 12rpx; }
/* 相册：图片点开用系统预览，链接/文档直接复制，不跳中间页 */
.gal { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14rpx; }
.gal-img { width: 100%; aspect-ratio: 1; border-radius: 12rpx; background: #eef2f7; }
.gal-file { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8rpx; aspect-ratio: 1; border-radius: 12rpx; background: #eff6ff; padding: 10rpx; box-sizing: border-box; }
.gal-ico { font-size: 40rpx; }
.gal-title { font-size: 22rpx; color: #334155; text-align: center; line-height: 1.3; max-height: 58rpx; overflow: hidden; }
.content { font-size: 26rpx; color: #475569; line-height: 1.7; }
.link { display: flex; flex-direction: column; padding: 14rpx 0; border-bottom: 2rpx solid #f1f5f9; }
.link .b { font-size: 26rpx; font-weight: 600; }
.region-line { font-size: 26rpx; font-weight: 700; color: #2563eb; margin-bottom: 10rpx; }
.addr { display: flex; align-items: flex-start; justify-content: space-between; gap: 16rpx; }
.hint { font-size: 22rpx; color: #94a3b8; margin-top: 14rpx; line-height: 1.6; }
.qr-card { display: flex; gap: 20rpx; align-items: center; }
.qr { width: 200rpx; height: 200rpx; background: #fff; border: 2rpx solid #e8edf4; border-radius: 16rpx; flex-shrink: 0; }
.qr-info { flex: 1; min-width: 0; }
.btn-row { display: flex; gap: 12rpx; margin-top: 16rpx; }
.btn { font-size: 24rpx; padding: 16rpx 0; border-radius: 12rpx; background: #eef2f7; color: #162033; }
.btn::after { border: 0; }
.btn.primary { background: #2563eb; color: #fff; }
.btn.tiny { padding: 8rpx 18rpx; font-size: 22rpx; flex-shrink: 0; }
.btn.block { width: 100%; }
.input { width: 100%; height: 84rpx; line-height: 84rpx; box-sizing: border-box; border: 2rpx solid #e8edf4; border-radius: 12rpx; padding: 0 20rpx; font-size: 26rpx; }
.foot { text-align: center; font-size: 22rpx; color: #94a3b8; padding: 30rpx 0 280rpx; }
.dock { position: fixed; left: 0; right: 0; bottom: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12rpx 16rpx; padding: 16rpx 24rpx 16rpx; padding-bottom: calc(16rpx + env(safe-area-inset-bottom, 0px)); background: rgba(255,255,255,.96); box-shadow: 0 -4rpx 20rpx rgba(15,23,42,.06); z-index: 50; }
.dock-btn { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4rpx; min-height: 96rpx; padding: 8rpx 0; border-radius: 14rpx; background: #eef2f7; color: #162033; font-size: 22rpx; line-height: 1.2; }
.dock-btn::after { border: 0; }
.dock-btn.primary { background: #2563eb; color: #fff; }
.dock-btn[disabled] { opacity: .45; }
.dico { font-size: 34rpx; line-height: 1.1; }
.nav-mini { color: #2563eb; font-size: 22rpx; flex-shrink: 0; }
.muted { color: #6b7688; }
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
.tpl-minimal .dock { background: #fff; }
.tpl-minimal .dock .btn { background: #f3f4f6; color: #374151; }
.tpl-minimal .dock .btn.primary { background: var(--t-accent); color: #fff; }

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
.tpl-elite .dock { background: #0b0d12; box-shadow: none; border-top: 4rpx solid var(--t-accent); }
.tpl-elite .dock .btn { background: rgba(255,255,255,.1); color: #f5f5f4; }
.tpl-elite .dock .btn.primary { background: var(--t-accent); }

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
.tpl-seal .dock { background: #111827; box-shadow: none; }
.tpl-seal .dock .btn { background: #fff; color: #111827; }
.tpl-seal .dock .btn.primary { background: var(--t-accent); color: #fff; }
.tpl-seal .foot { color: #64748b; letter-spacing: 2rpx; }

/* ⑤ 联络卡 contact：深蓝封面 + 居中身份 + 业务标签 */
.tpl-contact .cover { height: 200rpx; border-radius: 0 0 28rpx 28rpx; }
.tpl-contact .body { margin-top: -40rpx; }
.tpl-contact .profile { border-radius: 18rpx; border: 2rpx solid #e8edf4; padding: 28rpx 20rpx; }
.tpl-contact .avatar { border-radius: 14rpx; width: 124rpx; height: 124rpx; border: 4rpx solid #fff; }
.tpl-contact .name { font-size: 40rpx; letter-spacing: 1rpx; }
.tpl-contact .tags text { border-radius: 6rpx; border: 2rpx solid var(--t-accent); background: transparent; color: var(--t-accent); padding: 6rpx 16rpx; }
.tpl-contact .actions { border-radius: 18rpx; border: 2rpx solid #e8edf4; }
.tpl-contact .ico { border-radius: 14rpx; }
.tpl-contact .card { border-radius: 18rpx; }
.tpl-contact .section { border-left: 6rpx solid var(--t-accent); }
.tpl-contact .dock { background: #0b1a3a; box-shadow: none; }
.tpl-contact .dock .btn { background: rgba(255,255,255,.14); color: #fff; }

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
