<template>
  <view class="page">
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
            <view class="title">{{ [card.title, card.company, card.department].filter(Boolean).join(' · ') }}</view>
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

        <view v-if="card.address" class="card block">
          <view class="section">地址</view>
          <view class="addr">
            <text class="content">{{ card.address }} {{ card.address_detail }}</text>
            <button class="btn tiny" @tap="copyText(card.address + (card.address_detail || ''), '地址已复制，可粘贴到地图')">复制</button>
          </view>
          <view class="hint">小程序内无法直接唤起所有地图，地址复制后打开高德/百度/Apple 地图粘贴即可导航。</view>
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
import { api, baseUrl, toast, copyText, callPhone, saveQrImage, saveImageByUrl, currentPlatform, parseSlug } from '../../utils/request'

const slug = ref('')
const card = ref(null)
const loading = ref(true)
const error = ref('')
const mySlug = ref('')
const exchanging = ref(false)
const qrPreview = ref('')

const coverBg = computed(() => {
  const c = card.value?.accent || '#2563eb'
  return `linear-gradient(135deg, ${c}, #0f172a)`
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
  try { card.value = await api.get(`/api/cards/public/${slug.value}`, false) }
  catch (e) { error.value = e.message } finally { loading.value = false }
}
onLoad(options => {
  slug.value = parseSlug(options.slug || options.scene || '') || 'zhangsan'
  load()
})

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
    c.address ? `地址：${c.address} ${c.address_detail || ''}` : '',
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
</style>
