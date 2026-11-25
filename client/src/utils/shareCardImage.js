import { qrPath, inlineImage } from './printCard'
import { themeOf } from './themes'

// 名片分享缩略图：生成一张「名片卡片样式」的 PNG（头像/姓名/职位/公司/标签 + 小二维码），
// 替代过去难看的纯二维码缩略图。走 SVG→canvas→Blob→/api/upload，拿公网 URL 给微信 JS-SDK。
// 设计要点：
// - 正方形 600×600：微信转发缩略图会裁成正方形，核心信息（头像+姓名）放中间安全带。
// - 配色用 themeOf（项目唯一真相源），主题一致；头像走 inlineImage 内联，规避 X5 跨域 canvas 污染。
// - 生成失败静默回落到二维码兜底（见 wx-share.setCardShare），绝不拖垮分享。

const S = 600
const esc = s => String(s ?? '').replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c])
// 按字符数粗略截断，中文按 1、英文按 0.55 估算宽度
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

function svgMarkup(view, t, avatarData, qrDataUrl) {
  const name = clip(view.name || view.name_en || '名片', 10)
  const titleLine = clip([view.title, view.company, view.department].filter(Boolean).join(' · ') || '电子名片', 18)
  const tags = Array.isArray(view.tags) ? view.tags.slice(0, 3).map(x => String(x)) : []
  const accent = t.accent
  const surface = t.surface || '#ffffff'
  const text = t.text || '#0f172a'
  const muted = t.muted || '#64748b'
  const isDark = /^#(0|1|2)\d{5}$/i.test(String(surface).slice(0, 7))

  // 头像：圆形，居中偏上
  const avatarR = 62
  const avatarSvg = avatarData
    ? `<image href="${avatarData}" x="${S / 2 - avatarR}" y="118" width="${avatarR * 2}" height="${avatarR * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#avClip)"/>`
    : `<circle cx="${S / 2}" cy="${118 + avatarR}" r="${avatarR}" fill="${accent}" opacity=".14"/>`
      + `<text x="${S / 2}" y="${118 + avatarR + 22}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="72" font-weight="700" fill="${accent}">${esc(name.slice(0, 1))}</text>`
  // 标签胶囊
  const tagW = 92, tagGap = 10
  const tagsTotal = tags.length * tagW + Math.max(0, tags.length - 1) * tagGap
  let tagX = (S - tagsTotal) / 2
  const tagsSvg = tags.map(tag => {
    const x = tagX; tagX += tagW + tagGap
    return `<rect x="${x}" y="400" width="${tagW}" height="32" rx="16" fill="${accent}" fill-opacity=".12"/>`
      + `<text x="${x + tagW / 2}" y="421" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="15" fill="${accent}">${esc(clip(tag, 6))}</text>`
  }).join('')

  // 底部二维码：白底方卡（深码浅底保证可扫）
  const qrSize = 84, qrPad = 8
  const qx = S / 2 - qrSize / 2, qy = 480
  const qrSvg = qrDataUrl
    ? `<image href="${qrDataUrl}" x="${qx}" y="${qy}" width="${qrSize}" height="${qrSize}"/>`
    : `<rect x="${qx - qrPad}" y="${qy - qrPad}" width="${qrSize + qrPad * 2}" height="${qrSize + qrPad * 2}" rx="8" fill="#fff"/>`
      + qrPath(view.url || '', qx, qy, qrSize, '#0f172a')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" role="img" aria-label="${esc(name)}的名片">
<defs>
  <clipPath id="avClip"><circle cx="${S / 2}" cy="${118 + avatarR}" r="${avatarR}"/></clipPath>
  <linearGradient id="topG" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${accent}" stop-opacity="${isDark ? '.5' : '.16'}"/>
    <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
  </linearGradient>
</defs>
<rect width="${S}" height="${S}" fill="${surface}"/>
<rect width="${S}" height="260" fill="url(#topG)"/>
<circle cx="${S / 2}" cy="${118 + avatarR}" r="${avatarR + 5}" fill="${surface}" stroke="${accent}" stroke-width="2"/>
${avatarSvg}
<text x="${S / 2}" y="286" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="40" font-weight="700" fill="${text}">${esc(name)}</text>
<text x="${S / 2}" y="330" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="19" fill="${muted}">${esc(titleLine)}</text>
<rect x="${S / 2 - 40}" y="356" width="80" height="3" rx="1.5" fill="${accent}" opacity=".7"/>
${tagsSvg}
${qrSvg}
<text x="${S / 2}" y="584" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="14" fill="${muted}">扫码查看 · 保存名片</text>
</svg>`
}

function svgToPngBuffer(svg) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = S; canvas.height = S
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, S, S)
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0, S, S)
      URL.revokeObjectURL(url)
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('canvas 生成失败')), 'image/png')
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片渲染失败')) }
    img.src = url
  })
}

// 上传结果缓存：同一张名片资料未变时复用上次 URL，避免每次打开页面都上传一张图堆积垃圾文件。
// localStorage 与模块级 Map 双缓存；资料指纹变化（改名/换头像/换主题）则重新生成。
const CACHE_PREFIX = 'mcard_share_img_'
function fingerprint(view) {
  const parts = [view.slug, view.name, view.title, view.company, view.avatar, view.logo, view.theme, view.accent, (view.tags || []).join(',')]
  let h = 0
  for (const ch of parts.join('|')) h = ((h << 5) - h + ch.charCodeAt(0)) | 0
  return Math.abs(h).toString(36)
}

/**
 * 生成并上传名片分享缩略图，返回公网 URL；失败返回空串（调用方回落到二维码）。
 * @param {object} api axios 实例（带登录态）
 * @param {object} view publicView 名片数据
 */
export async function buildAndUploadShareImage(api, view) {
  try {
    const fp = fingerprint(view)
    const cacheKey = CACHE_PREFIX + (view.slug || 'card')
    let hit = null
    try { hit = JSON.parse(localStorage.getItem(cacheKey) || 'null') } catch { /* 忽略损坏缓存 */ }
    if (hit && hit.fp === fp && hit.url) return hit.url
    const t = themeOf(view)
    const [avatar, qr] = await Promise.all([
      inlineImage(view.avatar || view.logo || ''),
      (async () => {
        try {
          const res = await fetch(`${window.location.origin}/api/cards/public/${view.slug}/qr.png?size=200&scan=1`)
          if (!res.ok) return ''
          const blob = await res.blob()
          if (!blob.size) return ''
          return await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.onerror = () => r(''); fr.readAsDataURL(blob) })
        } catch { /* 回落本地 qrPath */ }
        return ''
      })()
    ])
    const svg = svgMarkup(view, t, avatar, qr)
    const png = await svgToPngBuffer(svg)
    const fd = new FormData()
    fd.append('file', png, `share-${view.slug || 'card'}.png`)
    const { data } = await api.post('/api/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    const url = data?.data?.url || ''
    if (url) {
      try { localStorage.setItem(cacheKey, JSON.stringify({ fp, url })) } catch { /* 隐私模式不缓存，不影响本次 */ }
    }
    return url
  } catch { return '' }
}
