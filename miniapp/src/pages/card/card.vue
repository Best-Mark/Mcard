<template>
  <view class="page" :class="'tpl-' + tpl" :style="{ '--t-accent': card?.accent || '#2563eb' }">
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
          <view class="avatar">
            <image v-if="card.avatar" :src="card.avatar" mode="aspectFill" />
            <text v-else>{{ (card.name || '名').slice(0, 1) }}</text>
          </view>
          <view class="ident">
            <view class="name-row">
              <image v-if="card.logo" class="logo" :src="card.logo" mode="aspectFit" />
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

        <view v-if="card.bio" class="card block">
          <view class="section">关于我</view>
          <view class="content">{{ card.bio }}</view>
        </view>

        <view v-if="card.company_intro" class="card block">
          <view class="section">公司简介<text v-if="card.company" class="muted small"> · {{ card.company }}</text></view>
          <view class="content">{{ card.company_intro }}</view>
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

        <view v-if="contactQrs.length" class="card block">
          <view class="section">加好友 / 收付款</view>
          <view v-for="q in contactQrs" :key="q.key" class="qr-tile">
            <image :src="baseUrl + q.url" mode="aspectFit" @tap="previewQr(q)" />
            <view class="qr-meta">
              <text class="b">{{ q.label }}</text>
              <text class="muted small">{{ qrHint(q.platform) }}</text>
              <view class="btn-row">
                <button v-if="q.account" class="btn tiny" @tap="copyText(q.account, q.accountLabel + '已复制')">复制账号</button>
                <button class="btn tiny" @tap="saveQrTile(q)">保存二维码</button>
              </view>
            </view>
          </view>
          <view class="muted small" style="margin-top:12rpx">付款前请核对收款方与金额；二维码由名片主人自行上传。</view>
        </view>

        <view v-if="fullAddress" class="card block">
          <view class="section">地址</view>
          <view v-if="regionLine" class="region-line">{{ regionLine }}</view>
          <view class="addr" @tap="copyText(fullAddress, '地址已复制，可粘贴到地图')">
            <text class="content">地址：{{ fullAddress }}</text>
          </view>
          <view class="hint">小程序内无法直接唤起所有地图，地址复制后打开高德/百度/Apple 地图粘贴即可导航。</view>
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
          <image class="qr" :src="baseUrl + '/api/cards/public/' + card.slug + '/qr.png?size=440'" mode="aspectFit" />
          <view class="qr-info">
            <view class="section">扫一扫，存进通讯录</view>
            <view class="muted small">二维码永久固定，资料更新也不失效</view>
            <view class="btn-row">
              <button class="btn primary" @tap="saveQrImage(card.slug)">保存二维码</button>
              <button class="btn" @tap="copyText(card.url || (baseUrl + '/c/' + card.slug), '名片链接已复制')">复制链接</button>
            </view>
          </view>
        </view>

        <view class="card block">
          <view class="section">交换名片</view>
          <input v-model.trim="mySlug" class="input" placeholder="你的名片短码" />
          <button class="btn primary block" style="margin-top:16rpx" :disabled="exchanging" @tap="exchange">
            {{ exchanging ? '提交中…' : '确认交换' }}
          </button>
        </view>

        <view class="foot">由 MCard 提供技术支持 · 资料可改 · 二维码不变</view>
      </view>

      <view v-if="qrPreview" class="modal-mask" @tap="qrPreview = ''">
        <view class="modal" @tap.stop>
          <view class="section">{{ qrPreview.label }}</view>
          <image :src="baseUrl + qrPreview.url" mode="aspectFit" class="modal-qr" />
          <view class="muted small">{{ qrHint(qrPreview.platform) }}</view>
          <view class="btn-row">
            <button class="btn primary" @tap="saveQrTile(qrPreview)">保存到相册</button>
            <button class="btn" @tap="qrPreview = ''">关闭</button>
          </view>
        </view>
      </view>

      <view class="dock">
        <button class="btn primary" open-type="share">分享名片</button>
        <button class="btn" @tap="copyContact">复制名片信息</button>
      </view>
    </block>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import { api, baseUrl, toast, copyText, callPhone, saveQrImage, saveImageByUrl, currentPlatform, parseSlug, getPublicMaterials, traceVisit } from '../../utils/request'

const slug = ref('')
const card = ref(null)
const loading = ref(true)
const error = ref('')
const mySlug = ref('')
const exchanging = ref(false)
const qrPreview = ref('')
const tpl = ref('classic')
const materials = ref([])

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
const fullAddress = computed(() => {
  const c = card.value || {}
  const region = [c.province, c.city, c.district, c.street].filter(Boolean).join('')
  return [region, c.address, c.address_detail].filter(Boolean).join(' ')
})
const contactQrs = computed(() => {
  const c = card.value || {}
  return [
    { key: 'wechat_qr', url: c.wechat_qr, label: '微信 · 加好友', platform: 'wechat', account: c.wechat, accountLabel: '微信号' },
    { key: 'alipay_qr', url: c.alipay_qr, label: '支付宝 · 加好友', platform: 'alipay', account: c.alipay, accountLabel: '支付宝账号' },
    { key: 'wechat_pay_qr', url: c.wechat_pay_qr, label: '微信 · 收款码', platform: 'wechat', account: '', accountLabel: '' },
    { key: 'alipay_pay_qr', url: c.alipay_pay_qr, label: '支付宝 · 收款码', platform: 'alipay', account: '', accountLabel: '' }
  ].filter(q => q.url)
})
const siteLinks = computed(() => {
  const c = card.value || {}
  const arr = []
  if (c.website) arr.push({ key: 'website', label: '公司主页', url: c.website })
  if (c.shop_url) arr.push({ key: 'shop', label: '店铺主页', url: c.shop_url })
  return arr
})

function qrHint(platform) {
  const env = currentPlatform()
  if (env === platform) return '当前环境可长按识别二维码'
  if (env === 'toutiao' || env === 'other') return '保存到相册后用对应 App 扫一扫'
  return `保存图片后用${platform === 'wechat' ? '微信' : '支付宝'}扫一扫`
}
function previewQr(q) { qrPreview.value = q }
function saveQrTile(q) { saveImageByUrl(baseUrl + q.url) }

async function load() {
  loading.value = true; error.value = ''
  try {
    card.value = await api.get(`/api/cards/public/${slug.value}`, false)
    tpl.value = card.value?.template || 'classic'
  }
  catch (e) { error.value = e.message } finally { loading.value = false }
  // 资料夹 + 来源上报（扫码进入 scene 记为 qr），失败静默
  getPublicMaterials(slug.value).then(d => { materials.value = d.list || [] }).catch(() => {})
  const src = String(entrySrc.value || '')
  if (src) traceVisit(slug.value, src)
}
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
    c.company_intro ? `公司简介：${c.company_intro}` : '',
    `电子名片：${c.url || baseUrl + '/c/' + c.slug}`
  ].filter(Boolean).join('\n')
  copyText(text, '名片信息已复制')
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

onShareAppMessage(() => ({
  title: card.value ? `${card.value.name} 的电子名片` : 'MCard 电子名片',
  path: `/pages/card/card?slug=${slug.value}`
}))
</script>

<style scoped>
.state { padding: 120rpx 40rpx; text-align: center; color: #6b7688; }
.state .big { font-size: 80rpx; color: #cbd5e1; }
.state .muted { margin-top: 10rpx; }
.cover { height: 240rpx; border-radius: 0 0 40rpx 40rpx; padding: 30rpx; color: #fff; position: relative; }
.brand { font-size: 36rpx; font-weight: 800; }
.em { opacity: .8; }
.inactive { position: absolute; right: 30rpx; top: 34rpx; font-size: 22rpx; background: rgba(255,255,255,.22); padding: 6rpx 16rpx; border-radius: 999rpx; }
.body { padding: 22rpx; margin-top: -56rpx; }
.card { background: #fff; border-radius: 24rpx; padding: 26rpx; margin-bottom: 18rpx; box-shadow: 0 8rpx 28rpx rgba(15,23,42,.05); }
.profile { display: flex; flex-wrap: wrap; align-items: center; gap: 20rpx; }
.avatar { width: 120rpx; height: 120rpx; border-radius: 24rpx; background: #2563eb; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 52rpx; font-weight: 800; overflow: hidden; flex-shrink: 0; }
.avatar image { width: 100%; height: 100%; }
.ident { flex: 1; min-width: 0; }
.name-row { display: flex; align-items: center; gap: 14rpx; }
.logo { width: 64rpx; height: 64rpx; border-radius: 12rpx; background: rgba(0,0,0,.04); flex-shrink: 0; }
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
.qr-tile { display: flex; gap: 18rpx; align-items: center; padding: 16rpx 0; border-bottom: 2rpx solid #f1f5f9; }
.qr-tile:last-of-type { border-bottom: 0; }
.qr-tile image { width: 150rpx; height: 150rpx; background: #fff; border: 2rpx solid #e8edf4; border-radius: 12rpx; flex-shrink: 0; }
.qr-meta { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6rpx; }
.modal-mask { position: fixed; inset: 0; background: rgba(15,23,42,.55); z-index: 900; display: flex; align-items: center; justify-content: center; padding: 30rpx; }
.modal { background: #fff; border-radius: 24rpx; padding: 28rpx; width: 100%; }
.modal-qr { width: 460rpx; height: 460rpx; display: block; margin: 20rpx auto; background: #fff; border: 2rpx solid #e8edf4; border-radius: 16rpx; }
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
.input { width: 100%; box-sizing: border-box; border: 2rpx solid #e8edf4; border-radius: 12rpx; padding: 16rpx; font-size: 26rpx; }
.foot { text-align: center; font-size: 22rpx; color: #94a3b8; padding: 30rpx 0 180rpx; }
.dock { position: fixed; left: 0; right: 0; bottom: 0; display: flex; gap: 16rpx; padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom)); background: rgba(255,255,255,.96); box-shadow: 0 -4rpx 20rpx rgba(15,23,42,.06); }
.dock .btn { flex: 1; padding: 20rpx 0; font-size: 28rpx; }
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
.tpl-seal .qr, .tpl-seal .modal-qr { border-radius: 0; border: 4rpx solid #111827; }
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
.tpl-navygold .qr, .tpl-navygold .modal-qr { border: 4rpx solid rgba(185,147,85,.45); }
.tpl-navygold .foot { color: #a9b1ba; }
</style>
