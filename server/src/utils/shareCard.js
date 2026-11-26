// 名片分享缩略图（服务端生成，无需登录）：按 slug 合成一张 600×600 的 PNG（头像/姓名/职位/公司/标签 + 小二维码）。
// 用途：微信转发名片页时，访客未登录、前端无法上传图片，og:image / JS-SDK imgUrl 都能直接用这个公开 URL。
// 这是「公司LOGO→用户头像→项目LOGO」都不可用时的最终兜底，彻底消灭空图（用户定稿认可的名片页样式）。
// 实现：SVG 字符串 → sharp 光栅化，头像/二维码内联 dataURL（不引用任何外部资源，规避 X5/微信 canvas 污染）。
const sharp = require('sharp')
const qr = require('../services/qrcode')
const { inlineImage } = require('./inlineImage')

const S = 600
const esc = s => String(s ?? '').replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c])
function clip(s, max) {
  const str = String(s || '')
  let w = 0, out = ''
  for (const ch of str) {
    w += /[\x00-\xff]/.test(ch) ? 0.55 : 1
    if (w > max) break
    out += ch
  }
  return out === str ? str : out + '…'
}

// 缓存：内容由 slug + 名片字段决定，字段不变复用上次 PNG（上限+TTL 双保护，避免内存膨胀）。
const MAX_CACHE = 200
const TTL_MS = 10 * 60 * 1000
const cache = new Map()
function cached(key, fn) {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.t < TTL_MS) return hit.v
  const v = fn()
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value)
  cache.set(key, { t: Date.now(), v })
  return v
}

function markup(card, avatarData, qrData, accent) {
  const name = clip(card.name || card.name_en || '名片', 10)
  const titleLine = clip([card.title, card.company, card.department].filter(Boolean).join(' · ') || '电子名片', 18)
  let tags = []
  try { tags = Array.isArray(card.tags) ? card.tags : JSON.parse(card.tags || '[]') } catch { tags = [] }
  tags = (Array.isArray(tags) ? tags : []).slice(0, 3).map(String)

  const avatarR = 62
  const avatarSvg = avatarData
    ? `<image href="${avatarData}" x="${S / 2 - avatarR}" y="118" width="${avatarR * 2}" height="${avatarR * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#avClip)"/>`
    : `<circle cx="${S / 2}" cy="${118 + avatarR}" r="${avatarR}" fill="${accent}" opacity=".14"/>`
      + `<text x="${S / 2}" y="${118 + avatarR + 22}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="72" font-weight="700" fill="${accent}">${esc(name.slice(0, 1))}</text>`

  const tagW = 92, tagGap = 10
  const tagsTotal = tags.length * tagW + Math.max(0, tags.length - 1) * tagGap
  let tagX = (S - tagsTotal) / 2
  const tagsSvg = tags.map(tag => {
    const x = tagX; tagX += tagW + tagGap
    return `<rect x="${x}" y="400" width="${tagW}" height="32" rx="16" fill="${accent}" fill-opacity=".12"/>`
      + `<text x="${x + tagW / 2}" y="421" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="15" fill="${accent}">${esc(clip(tag, 6))}</text>`
  }).join('')

  const qrSize = 84, qx = S / 2 - qrSize / 2, qy = 480
  const qrSvg = qrData
    ? `<image href="${qrData}" x="${qx}" y="${qy}" width="${qrSize}" height="${qrSize}"/>`
    : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" role="img">
<defs>
  <clipPath id="avClip"><circle cx="${S / 2}" cy="${118 + avatarR}" r="${avatarR}"/></clipPath>
  <linearGradient id="topG" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${accent}" stop-opacity=".16"/>
    <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
  </linearGradient>
</defs>
<rect width="${S}" height="${S}" fill="#ffffff"/>
<rect width="${S}" height="260" fill="url(#topG)"/>
<circle cx="${S / 2}" cy="${118 + avatarR}" r="${avatarR + 5}" fill="#ffffff" stroke="${accent}" stroke-width="2"/>
${avatarSvg}
<text x="${S / 2}" y="286" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="40" font-weight="700" fill="#0f172a">${esc(name)}</text>
<text x="${S / 2}" y="330" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="19" fill="#64748b">${esc(titleLine)}</text>
<rect x="${S / 2 - 40}" y="356" width="80" height="3" rx="1.5" fill="${accent}" opacity=".7"/>
${tagsSvg}
${qrSvg}
<text x="${S / 2}" y="584" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="14" fill="#64748b">扫码查看 · 保存名片</text>
</svg>`
}

// 生成 PNG Buffer。headUrl = 名片公开页完整 URL（二维码内容）。失败抛错由路由兜底。
async function buildSharePng(card, headUrl) {
  const accent = /^#[0-9a-fA-F]{6}$/.test(String(card.accent || '')) ? card.accent : '#2563eb'
  const key = `share|${card.slug}|${card.name}|${card.title}|${card.company}|${card.department}|${card.avatar}|${card.logo}|${card.accent}|${card.tags}|${headUrl}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.t < TTL_MS && hit.png) return hit.png

  // 头像优先、LOGO 兜底，内联成 dataURL（webp 也能被 sharp 渲染）；二维码用装饰码 SVG 内联。
  let avatarData = ''
  for (const u of [card.avatar, card.logo]) {
    if (!u) continue
    try { avatarData = await inlineImage(u, { allowAny: true }); if (avatarData) break } catch { /* 下一个 */ }
  }
  let qrData = ''
  try {
    const qrSvg = qr.svg(headUrl, { size: 168, fg: '#0f172a', bg: '#ffffff', logo: false, brand: 'M', style: qr.SCAN_STYLE })
    qrData = `data:image/svg+xml;base64,${Buffer.from(qrSvg).toString('base64')}`
  } catch { /* 无二维码也保留名片信息 */ }

  const svg = markup(card, avatarData, qrData, accent)
  const png = await sharp(Buffer.from(svg), { density: 220 }).resize(S, S).png().toBuffer()
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value)
  cache.set(key, { t: Date.now(), png })
  return png
}

module.exports = { buildSharePng }
