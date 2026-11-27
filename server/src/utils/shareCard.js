// 名片分享缩略图（服务端生成，无需登录）：按 slug 合成一张 600×600 的 PNG，
// 构图 = 名片页顶部「身份卡区域」的等比例重绘（头像在左、姓名/职位/公司/标签在右、二维码贴右上角）。
// 用户口径（2026-11-26）：分享图就该是「分享者这一块区域」——一眼认出是谁的名片，
// 而不是旧的「居中头像+底部二维码」通用卡；webp 头像也能内联渲染。
// 用途：微信转发 og:image / JS-SDK imgUrl 都能直接用这个公开 URL，访客未登录也能看到本人卡片。
// 配色：§ 参数唯一真相源 = 前端 themes.js（themeOf），由 share.png 的 bg/fg/mu/ac query 传入；
//       服务端只做 hex 白名单校验，缺省时回落深色（ink/contact 观感），绝不另建一份主题表。
// 实现：SVG 字符串 → sharp 光栅化，头像/二维码内联 dataURL（不引用外部资源，规避 X5/微信 canvas 污染）。
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
const hex = v => /^#[0-9a-fA-F]{6}$/.test(String(v || '')) ? String(v) : ''

// 配色唯一真相源在前端；这里只校验 query，非法值静默回落（健壮：坏参数不拖垮分享图）。
function paletteOf(card, q = {}) {
  return {
    bg: hex(q.bg) || '#15171c',
    fg: hex(q.fg) || '#f5f5f4',
    mu: hex(q.mu) || '#a1a1aa',
    ac: hex(q.ac) || hex(card.accent) || '#b99355'
  }
}

// 缓存：内容由 slug + 名片字段 + 配色 + 二维码决定，字段不变复用上次 PNG（上限+TTL 双保护）。
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

// 身份卡区域等比重绘：头像(左) + 姓名/职位/公司/标签(右) + 右上角二维码，背景用名片主题色。
function markup(card, avatarData, qrData, p) {
  const name = clip(card.name || card.name_en || '名片', 6)
  const titleLine = clip(card.title || '', 12)
  const org = clip(card.company || card.department || '', 13)
  let tags = []
  try { tags = Array.isArray(card.tags) ? card.tags : JSON.parse(card.tags || '[]') } catch { tags = [] }
  tags = (Array.isArray(tags) ? tags : []).slice(0, 3).map(String)

  // 头像位：公司 LOGO 优先（与 CardSheet 的 logo || avatar 同口径），无图时用姓名首字圆角色块
  const avatarSvg = avatarData
    ? `<image href="${avatarData}" x="44" y="150" width="168" height="168" preserveAspectRatio="xMidYMid slice" clip-path="url(#avClip)"/>`
    : `<text x="128" y="250" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="100" font-weight="700" fill="${p.ac}">${esc(name.slice(0, 1))}</text>`

  // 标签胶囊：浅色描边底 + 主题强调色文字，深/浅主题都有对比（不用整卡 opacity 减淡）
  const tagW = 138, tagGap = 14
  let tagX = 44
  const tagsSvg = tags.map(tag => {
    const x = tagX; tagX += tagW + tagGap
    return `<rect x="${x}" y="386" width="${tagW}" height="44" rx="22" fill="${p.ac}" fill-opacity=".16" stroke="${p.ac}" stroke-opacity=".45"/>`
      + `<text x="${x + tagW / 2}" y="415" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="20" font-weight="600" fill="${p.ac}">${esc(clip(tag, 6))}</text>`
  }).join('')

  // 右上角二维码：白底圆角小卡 + 用户自己的美化码（qr_fg/qr_bg/qr_style），与名片页小码一致
  const qrSvg = qrData
    ? `<rect x="444" y="72" width="116" height="116" rx="20" fill="#ffffff"/>`
      + `<image href="${qrData}" x="451" y="79" width="102" height="102"/>`
    : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" role="img" aria-label="${esc(name)}的名片">
<defs>
  <clipPath id="avClip"><rect x="44" y="150" width="168" height="168" rx="40"/></clipPath>
  <linearGradient id="topG" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${p.ac}" stop-opacity=".22"/>
    <stop offset="1" stop-color="${p.ac}" stop-opacity="0"/>
  </linearGradient>
</defs>
<rect width="${S}" height="${S}" fill="${p.bg}"/>
<rect width="${S}" height="470" fill="url(#topG)"/>
${qrSvg}
<rect x="44" y="150" width="168" height="168" rx="40" fill="${p.ac}" fill-opacity=".18"/>
${avatarSvg}
<text x="236" y="222" font-family="Arial,Helvetica,sans-serif" font-size="64" font-weight="700" fill="${p.fg}">${esc(name)}</text>
<text x="236" y="278" font-family="Arial,Helvetica,sans-serif" font-size="30" fill="${p.mu}">${esc(titleLine)}</text>
<text x="236" y="330" font-family="Arial,Helvetica,sans-serif" font-size="30" font-weight="600" fill="${p.ac}">${esc(org)}</text>
<line x1="44" y1="360" x2="556" y2="360" stroke="${p.mu}" stroke-opacity=".28"/>
${tagsSvg}
<text x="300" y="560" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="18" fill="${p.mu}">扫码查看 · 保存名片</text>
</svg>`
}

// 生成 PNG Buffer。headUrl = 名片公开页完整 URL（二维码内容）；palette = 前端下发的主题色。
async function buildSharePng(card, headUrl, palette = {}) {
  const p = paletteOf(card, palette)
  const key = `share2|${card.slug}|${card.name}|${card.title}|${card.company}|${card.department}|${card.avatar}|${card.logo}|${card.tags}|${headUrl}|${p.bg}|${p.fg}|${p.mu}|${p.ac}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.t < TTL_MS && hit.png) return hit.png

  // 头像优先公司 LOGO（与 CardSheet 同口径），webp 也能被 sharp 渲染；内联失败留首字占位。
  let avatarData = ''
  for (const u of [card.logo, card.avatar]) {
    if (!u) continue
    try { avatarData = await inlineImage(u, { allowAny: true }); if (avatarData) break } catch { /* 下一个 */ }
  }
  // 二维码用用户自己的美化样式/配色（与名片右上角小码一致），不是易扫方码——分享图不要求扫，重在辨识度。
  let qrData = ''
  try {
    const style = card.qr_style && typeof card.qr_style === 'object' ? card.qr_style : {}
    const qrSvg = qr.svg(headUrl, {
      size: 184, fg: card.qr_fg || '#0f172a', bg: card.qr_bg || '#ffffff',
      logo: false, brand: 'M', style: qr.normalizeStyle(style)
    })
    qrData = `data:image/svg+xml;base64,${Buffer.from(qrSvg).toString('base64')}`
  } catch { /* 无二维码也保留名片信息 */ }

  const svg = markup(card, avatarData, qrData, p)
  // flatten 去 alpha：分享卡保存后长按识别内嵌二维码同样受透明通道影响（2026-11-27）
  const png = await sharp(Buffer.from(svg), { density: 220 }).resize(S, S).flatten({ background: '#ffffff' }).png().toBuffer()
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value)
  cache.set(key, { t: Date.now(), png })
  return png
}

module.exports = { buildSharePng }
