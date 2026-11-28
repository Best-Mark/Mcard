// 收款码图片核验（唯一真相源，PUT /api/cards/mine 保存时调用，三端共用）。
// 用户上传的收款码图片要做三重判断：
//   ① 读得到：本地 /uploads/（含 OSS 上传后留下的本地副本）直接读盘，外链 http(s) 带超时拉取；
//   ② 有码：sharp 解出像素 → jsQR 解码，图里没有二维码直接拒；
//   ③ 是收款码且放对了平台：微信收款码内容为 wxp:// 等微信支付协议，支付宝为 qr.alipay.com 等——
//      放错平台给「这张是 xx 的码」类指引，别的二维码（名片码/网址码）按「不是收款码」拒绝。
// 校验通过后，图内解码出的原始付款链接（safePayLink 白名单过滤）落到 cards.*_pay_link 派生列，
// 扫合一码落地页按支付环境拿它 location.href 直接调起支付（跳不起来回落收款码图「保存 → 扫一扫」）。
// 备注：若日后遇到合法但未覆盖的商家码形态，在 MARKERS 补一种即可（单点维护）。
const sharp = require('sharp')
const jsQR = require('jsqr')
const fs = require('fs')
const path = require('path')
const config = require('../config')

const MAX_BYTES = 5 * 1024 * 1024
const FETCH_TIMEOUT_MS = 6000
const DECODE_EDGE = 1200

// 平台归属特征（收款码内容）。协议段锚定字符串开头（防「javascript:…wxp:」这类伪装文本骗过子串匹配），
// https 码按域名特征认。微信：个人收款码 wxp://、商户码走微信支付域名/协议；支付宝：二维码域名/跳转协议。
const MARKERS = {
  wechat: /^(wxp:|weixin:\/\/)/i,
  wechatUrl: /^https?:\/\/[^\s]*(tenpay\.com|payapp\.weixin|pay\.weixin\.qq\.com)/i,
  alipay: /^alipays?:\/\//i,
  alipayUrl: /^https?:\/\/[^\s]*([a-z0-9-]+\.)*alipay\.com/i
}
// 可跳转付款链接的协议白名单：只放行 wxp/weixin/alipays/http(s)，javascript: 等一律不进 location.href
const LINK_SCHEME_RE = /^(wxp:|weixin:\/\/|alipays:|https?:)/i

const MSG = {
  unread: '收款码图片读取失败，请重新上传',
  noQr: '图片里没有识别到二维码，请上传收款码图片',
  notPay: '未识别为收款码。微信收款码在「微信 → 收付款 → 收款 → 保存收款码」获取，支付宝在「支付宝 → 收付款 → 收款」获取',
  wechatSlot: '这张是支付宝的收款码，请放到「支付宝收款码」',
  alipaySlot: '这张是微信的收款码，请放到「微信收款码」'
}

// /uploads/xxx（本地盘直读，含 OSS 双写时留下的本地副本）；其余 http(s) 带超时拉取。
function localUploadPath(url) {
  const m = /^\/(?:uploads|media)\/([A-Za-z0-9_.-]{4,120})$/.exec(String(url || ''))
  if (!m) return null
  const file = path.join(config.UPLOAD_DIR, path.basename(m[1]))
  return fs.existsSync(file) ? file : null
}

async function fetchImage(url) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    const r = await fetch(url, { signal: ctrl.signal, redirect: 'follow' })
    if (!r.ok) return null
    const len = Number(r.headers.get('content-length') || 0)
    if (len > MAX_BYTES) return null
    const buf = Buffer.from(await r.arrayBuffer())
    return buf.length <= MAX_BYTES ? buf : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// 解码图内二维码内容；读不到图返回 null，图里没码返回 ''。
async function decodeQr(input) {
  const { data, info } = await sharp(input, { failOn: 'none' })
    .resize({ width: DECODE_EDGE, height: DECODE_EDGE, fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const found = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), info.width, info.height)
  return found?.data ? String(found.data) : ''
}

function classify(text) {
  const w = MARKERS.wechat.test(text) || MARKERS.wechatUrl.test(text)
  const a = MARKERS.alipay.test(text) || MARKERS.alipayUrl.test(text)
  if (w && !a) return 'wechat'
  if (a && !w) return 'alipay'
  return 'other'
}

// 识别一张图的收款码归属（不落库）：返回 { platform, text, msg }。
// platform ∈ 'wechat' | 'alipay' | ''（空=不通过，msg 为理由）。保存/上传归位都走这里（唯一真相源）。
async function inspectPayQr(url) {
  try {
    let text
    const local = localUploadPath(url)
    if (local) {
      text = await decodeQr(local)
    } else {
      const buf = await fetchImage(url)
      if (!buf) return { platform: '', text: '', msg: MSG.unread }
      text = await decodeQr(buf)
    }
    if (text === null) return { platform: '', text: '', msg: MSG.unread }
    if (!text) return { platform: '', text: '', msg: MSG.noQr }
    const platform = classify(text)
    if (platform === 'wechat' || platform === 'alipay') return { platform, text, msg: '' }
    return { platform: '', text: '', msg: MSG.notPay }
  } catch {
    // 图损坏/解码异常都按「读不了」处理，绝不静默放行
    return { platform: '', text: '', msg: MSG.unread }
  }
}

// kind: 'wechat' | 'alipay'。返回 { ok, text, msg }：ok 时 text 为图内解码内容，msg 恒空；
// 不通过时 msg 为给用户看的拒绝理由（放错平台给「这张是 xx 的码」指引）。
async function readPayQr(kind, url) {
  const r = await inspectPayQr(url)
  if (r.platform === kind) return { ok: true, text: r.text, msg: '' }
  if (r.platform === 'wechat') return { ok: false, text: '', msg: MSG.alipaySlot }
  if (r.platform === 'alipay') return { ok: false, text: '', msg: MSG.wechatSlot }
  return { ok: false, text: '', msg: r.msg }
}

// 可跳转的付款链接：协议白名单 + 平台归属一致才返回，否则 ''（只回落收款码图「保存 → 扫一扫」，绝不把可疑文本塞进 location）
function safePayLink(kind, text) {
  const s = String(text || '').trim()
  if (!LINK_SCHEME_RE.test(s)) return ''
  return classify(s) === kind ? s : ''
}

module.exports = { inspectPayQr, readPayQr, safePayLink }
