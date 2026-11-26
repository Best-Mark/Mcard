<template>
  <!-- 名片详情页/分享页：加载/错误由本页处理，名片正文交给共享组件 CardBody（与「名片」tab 同一套渲染、同 24 套模板样式）。
       owner 与公开名片页唯一差异是 dock 首按钮「编辑名片」vs「打电话」。 -->
  <view class="page" :class="'tpl-' + tpl" :style="{ '--t-accent': card?.accent || '#a62b2b', '--glow-rgb': glowRgb }">
    <view v-if="loading" class="state">名片加载中…</view>
    <view v-else-if="error" class="state">
      <view class="big">!</view>
      <view>名片加载失败</view>
      <view class="muted small">{{ error }}</view>
      <button class="btn primary" style="margin-top:24rpx" @tap="load">重新加载</button>
    </view>

    <block v-else-if="card">
      <CardBody :card="card" :materials="materials" :is-self="isSelf" :self-check-done="selfCheckDone"
        @edit="go('/pages/edit/edit')" @activate="go('/pages/plans/plans')" />

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
import { api, baseUrl, toast, copyText, callPhone, parseSlug, getPublicMaterials, traceVisit, getShareCardImage, withInvite } from '../../utils/request'
import CardBody from '../../components/CardBody/CardBody.vue'

const slug = ref('')
const card = ref(null)
const loading = ref(true)
const error = ref('')
const materials = ref([])
const isSelf = ref(false)
const selfCheckDone = ref(false)
const favorited = ref(false)

const tpl = computed(() => card.value?.template || 'classic')
// 动态光效用主题强调色，#rrggbb → rgb 分量（dock 的 tpl 覆写也要用）
const glowRgb = computed(() => {
  const h = /^#?([0-9a-f]{6})$/i.exec(String(card.value?.accent || ''))
  if (!h) return '37,99,235'
  const n = parseInt(h[1], 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
})
// 拨号/复制号码统一口径：手机优先、座机兜底（dock 用）
const contactPhone = computed(() => card.value?.mobile || card.value?.phone || '')
const canNavigate = computed(() => {
  const c = card.value || {}
  return Number.isFinite(Number(c.latitude)) && Number.isFinite(Number(c.longitude))
    && String(c.latitude) !== '' && String(c.longitude) !== ''
})
const fullAddress = computed(() => {
  const c = card.value || {}
  const region = [c.province, c.city, c.district, c.street].filter(Boolean).join('')
  const detail = [c.address, c.address_detail].filter(Boolean).join(' ')
  return [region, detail].filter(Boolean).join(' ')
})

async function load() {
  loading.value = true; error.value = ''
  try {
    card.value = await api.get(`/api/cards/public/${slug.value}`, false)
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

// 导航到此处：用名片坐标唤起系统地图（微信内置地图），无坐标时 dock 不显示导航按钮。
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

// 分享口径：标题「XXX的名片」；描述首选简介；
// 缩略图 公司LOGO → 用户头像 → 项目LOGO → 站点LOGO → 分享池（getShareCardImage 内）；不用纯二维码缩略图，
// 滤掉 svg/webp（微信解析不出会变灰块）。webp 头像自动落到下一候选，不会出错。
onShareAppMessage(() => {
  const c = card.value
  const absolute = u => (!u ? '' : /^https?:\/\//i.test(u) ? u : u.startsWith('/') ? baseUrl + u : '')
  const intro = c?.bio || c?.company_intro || ''
  const imageUrl = [c?.logo, c?.avatar].map(absolute).find(u => /\.(jpe?g|png|gif)(\?|$)/i.test(u)) || getShareCardImage()
  return {
    title: c ? `${c.name}的名片` : '唐笺 电子名片',
    desc: intro,
    path: withInvite(`/pages/card/card?slug=${slug.value}`),
    imageUrl
  }
})
</script>

<style scoped>
.page { min-height: 100vh; }
.state { padding: 120rpx 40rpx; text-align: center; color: #8a7355; }
.state .big { font-size: 80rpx; color: #d8c9a8; }
.state .muted { margin-top: 10rpx; }
.btn { font-size: 24rpx; padding: 16rpx 0; border-radius: 12rpx; background: #f0e7d2; color: #2b2118; }
.btn::after { border: 0; }
.btn.primary { background: #a62b2b; color: #fff; }

/* 底部操作 dock（页面级，非名片正文；tpl-X 覆写跟模板走） */
.dock { position: fixed; left: 0; right: 0; bottom: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12rpx 16rpx; padding: 16rpx 24rpx 16rpx; padding-bottom: calc(16rpx + env(safe-area-inset-bottom, 0px)); background: rgba(255,255,255,.96); box-shadow: 0 -4rpx 20rpx rgba(15,23,42,.06); z-index: 50; }
.dock-btn { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4rpx; min-height: 96rpx; padding: 8rpx 0; border-radius: 14rpx; background: #f0e7d2; color: #2b2118; font-size: 22rpx; line-height: 1.2; }
.dock-btn::after { border: 0; }
.dock-btn.primary { background: #a62b2b; color: #fff; }
.dock-btn[disabled] { opacity: .45; }
.dico { font-size: 34rpx; line-height: 1.1; }
.muted { color: #8a7355; }
.small { font-size: 22rpx; }

/* dock 的模板覆写：跟名片模板走，与正文观感统一 */
.tpl-minimal .dock { background: #fff; }
.tpl-minimal .dock .btn { background: #f3f4f6; color: #374151; }
.tpl-elite .dock { background: #0b0d12; box-shadow: none; border-top: 4rpx solid var(--t-accent); }
.tpl-elite .dock .btn { background: rgba(255,255,255,.1); color: #f5f5f4; }
.tpl-seal .dock { background: #111827; box-shadow: none; }
.tpl-seal .dock .btn { background: #fff; color: #111827; }
.tpl-contact .dock { background: #2b2118; box-shadow: none; }
.tpl-contact .dock .btn { background: rgba(255,255,255,.14); color: #fff; }
</style>
