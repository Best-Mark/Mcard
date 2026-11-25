<template>
  <view class="page">
    <view class="hint">小程序内可保存「二维码海报」到相册；需要 90×54mm 印刷 SVG / 300dpi PNG 时，复制地址到浏览器打开完整版式页。</view>
    <view class="body">
      <view v-if="!card" class="card center">请先创建名片</view>
      <block v-else>
        <view class="card">
          <view class="section">海报预览</view>
          <view class="poster-preview" :style="{ background: card.accent || '#2563eb' }">
            <view class="pp-head">
              <image v-if="card.logo" class="pp-logo" :src="card.logo" mode="aspectFit" />
              <view class="pp-name">{{ card.name }}</view>
              <view class="pp-title">{{ card.title }} {{ card.company ? '· ' + card.company : '' }}</view>
            </view>
            <view class="pp-body">
              <image class="pp-qr" :src="baseUrl + '/api/cards/public/' + card.slug + '/qr.png?size=440'" mode="aspectFit" />
              <view class="pp-intro">{{ card.bio || card.company_intro || '扫一扫，保存我的电子名片' }}</view>
              <view class="pp-contact">{{ card.mobile || '' }} {{ card.email ? ' · ' + card.email : '' }}</view>
              <view class="pp-tip">扫码存入通讯录 · 资料可改二维码不变</view>
            </view>
          </view>
        </view>

        <view class="card">
          <view class="section">保存到相册</view>
          <button class="btn primary block" :disabled="busy" @tap="savePoster">{{ busy ? '生成中…' : '保存二维码海报' }}</button>
          <button class="btn ghost block" style="margin-top:16rpx" @tap="copyH5">复制印刷版式地址</button>
          <view class="muted small" style="margin-top:16rpx;line-height:1.6">
            印刷文件包含 3mm 出血与 4.5mm 安全线，可直接在浏览器下载 SVG 矢量稿或 300dpi PNG。二维码纠错等级 H，印刷后仍可扫码。
          </view>
        </view>
      </block>
    </view>

    <canvas canvas-id="poster" id="poster" class="hidden-canvas"></canvas>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { api, baseUrl, toast, copyText, saveTempImage } from '../../utils/request'

const card = ref(null); const busy = ref(false)

onLoad(async () => {
  try { card.value = await api.get('/api/cards/mine') } catch (e) { toast(e.message) }
})

function copyH5() { copyText(`${baseUrl}/me/print`, '地址已复制，用浏览器打开可下载印刷稿') }

function wrapText(ctx, text, maxWidth, maxLines = 3) {
  const chars = String(text || '').split('')
  const lines = []
  let line = ''
  for (const ch of chars) {
    if (ctx.measureText(line + ch).width > maxWidth && line) { lines.push(line); line = ch }
    else line += ch
    if (lines.length >= maxLines) break
  }
  if (line && lines.length < maxLines) lines.push(line)
  return lines
}

function downloadTemp(url) {
  return new Promise(resolve => {
    uni.downloadFile({
      url,
      success: res => resolve(res.statusCode === 200 ? res.tempFilePath : ''),
      fail: () => resolve('')
    })
  })
}

async function savePoster() {
  if (!card.value) return
  busy.value = true
  const c = card.value
  const qrPath = await downloadTemp(`${baseUrl}/api/cards/public/${c.slug}/qr.png?size=440`)
  if (!qrPath) { busy.value = false; return toast('二维码下载失败') }
  const logoPath = c.logo ? await downloadTemp(baseUrl + c.logo) : ''
  const ctx = uni.createCanvasContext('poster')
  const W = 375, H = 560
  ctx.setFillStyle('#ffffff')
  ctx.fillRect(0, 0, W, H)
  ctx.setFillStyle(c.accent || '#2563eb')
  ctx.fillRect(0, 0, W, 150)
  if (logoPath) ctx.drawImage(logoPath, 295, 22, 56, 56)
  ctx.setFillStyle('#ffffff')
  ctx.setFontSize(26)
  ctx.fillText(c.name || '我的名片', 24, 70)
  ctx.setFontSize(13)
  ctx.fillText([c.title, c.company].filter(Boolean).join(' · ').slice(0, 22), 24, 105)
  ctx.drawImage(qrPath, 24, 175, 175, 175)
  ctx.setFillStyle('#162033')
  ctx.setFontSize(15)
  wrapText(ctx, c.bio || c.company_intro || '', 320, 4).forEach((line, i) => ctx.fillText(line, 24, 390 + i * 22))
  ctx.setFillStyle('#64748b')
  ctx.setFontSize(12)
  ctx.fillText(String(c.mobile || '').slice(0, 34), 24, 495)
  ctx.fillText('扫码存入通讯录 · 二维码永久不变', 24, 525)
  ctx.draw(false, () => {
    uni.canvasToTempFilePath({
      canvasId: 'poster',
      width: W,
      height: H,
      success: r => { saveTempImage(r.tempFilePath); busy.value = false },
      fail: () => { busy.value = false; toast('海报生成失败，请截图保存') }
    })
  })
}
</script>

<style scoped>
.hint { background: #eff6ff; color: #1e40af; font-size: 22rpx; padding: 20rpx 24rpx; line-height: 1.6; }
.body { padding: 24rpx; }
.card { background: #fff; border-radius: 24rpx; padding: 26rpx; margin-bottom: 18rpx; box-shadow: 0 8rpx 28rpx rgba(15,23,42,.05); }
.section { font-size: 30rpx; font-weight: 700; margin-bottom: 16rpx; }
.poster-preview { border-radius: 20rpx; overflow: hidden; color: #fff; }
.pp-head { padding: 28rpx; }
.pp-logo { width: 80rpx; height: 80rpx; background: rgba(255,255,255,.9); border-radius: 14rpx; padding: 6rpx; box-sizing: border-box; margin-bottom: 14rpx; }
.pp-name { font-size: 38rpx; font-weight: 800; }
.pp-title { font-size: 22rpx; opacity: .85; margin-top: 6rpx; }
.pp-body { background: #fff; color: #162033; padding: 24rpx; }
.pp-qr { width: 220rpx; height: 220rpx; display: block; margin: 0 auto; }
.pp-intro { font-size: 24rpx; color: #475569; line-height: 1.6; margin-top: 18rpx; }
.pp-contact { font-size: 22rpx; color: #64748b; margin-top: 10rpx; }
.pp-tip { font-size: 20rpx; color: #94a3b8; margin-top: 18rpx; text-align: center; }
.btn { font-size: 28rpx; padding: 20rpx 0; border-radius: 14rpx; background: #eef2f7; }
.btn::after { border: 0; }
.btn.primary { background: #2563eb; color: #fff; }
.btn.ghost { background: #fff; color: #475569; border: 2rpx solid #e8edf4; }
.btn.block { width: 100%; }
.center { text-align: center; padding: 40rpx; }
.hidden-canvas { position: fixed; left: -9999px; top: -9999px; width: 375px; height: 560px; }
.muted { color: #6b7688; }
.small { font-size: 22rpx; }
</style>
