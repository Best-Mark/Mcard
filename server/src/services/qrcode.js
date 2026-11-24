const QRCode = require('qrcode')
const sharp = require('sharp')

// 二维码生成缓存：内容是「内容 + 样式 + 颜色 + logo + size」决定的纯函数，重复请求无需重算。
// 实测：SVG ~1ms，PNG ~56ms；缓存后重复请求近 0ms。上限 + TTL 双保护。
const MAX_CACHE = 300
const TTL_MS = 30 * 60 * 1000
const cache = new Map()
function cached(key, produce) {
  const hit = cache.get(key)
  const now = Date.now()
  if (hit && now - hit.t < TTL_MS) return hit.v
  const v = produce()
  cache.set(key, { t: now, v })
  if (cache.size > MAX_CACHE) { const oldest = cache.keys().next().value; cache.delete(oldest) }
  return v
}
function clearCache() { cache.clear() }

function escapeXml(s) {
  return String(s || '').replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c])
}

// 草料式样式默认值：dot 码点 / eye 码眼 / gradTo 渐变终点 / logoShape Logo 底板 / bgImage 背景图
const DEFAULT_STYLE = { dot: 'square', eye: 'square', gradTo: '', logoShape: 'rounded', bgImage: '' }
function normalizeStyle(s) {
  const o = s && typeof s === 'object' ? s : {}
  const inSet = (v, set, d) => set.includes(v) ? v : d
  return {
    dot: inSet(o.dot, ['square', 'dots', 'rounded'], DEFAULT_STYLE.dot),
    eye: inSet(o.eye, ['square', 'rounded', 'circle'], DEFAULT_STYLE.eye),
    gradTo: /^#[0-9a-fA-F]{6}$/.test(o.gradTo || '') ? o.gradTo : '',
    logoShape: inSet(o.logoShape, ['rounded', 'circle', 'none'], DEFAULT_STYLE.logoShape),
    bgImage: typeof o.bgImage === 'string' && /^(data:image\/|\/uploads\/|https?:\/\/)/.test(o.bgImage) ? o.bgImage.slice(0, 200000) : ''
  }
}

function modulesOf(text, errorCorrectionLevel) {
  const qr = QRCode.create(text, { errorCorrectionLevel })
  return { bits: qr.modules, n: qr.modules.size }
}

// 三个定位角（含 1 格分隔带）：finder 8×8 区域
function inFinder(x, y, n) {
  return (x < 8 && y < 8) || (x >= n - 8 && y < 8) || (x < 8 && y >= n - 8)
}

// 画一个 finder：ox,oy 为 7×7 区域左上角（模块坐标）
function finderMarkup(ox, oy, eye, fill) {
  if (eye === 'circle') {
    return `<circle cx="${ox + 3.5}" cy="${oy + 3.5}" r="3.4" fill="none" stroke="${fill}" stroke-width="1"/>
<circle cx="${ox + 3.5}" cy="${oy + 3.5}" r="1.6" fill="${fill}"/>`
  }
  const rx = eye === 'rounded' ? 2 : 0
  return `<rect x="${ox}" y="${oy}" width="7" height="7" rx="${rx}" fill="none" stroke="${fill}" stroke-width="1"/>
<rect x="${ox + 2}" y="${oy + 2}" width="3" height="3" rx="${eye === 'rounded' ? 1 : 0}" fill="${fill}"/>`
}

// 核心：按样式渲染 data 区码点（跳过 finder 区域，finder 单独画）
function dataPath(bits, n, dot) {
  if (dot === 'square') {
    const d = []
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (inFinder(x, y, n)) continue
      if (bits.get(x, y)) d.push(`M${x},${y}h1v1h-1z`)
    }
    return `<path d="${d.join('')}"/>`
  }
  const shapes = []
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (inFinder(x, y, n)) continue
    if (!bits.get(x, y)) continue
    if (dot === 'dots') shapes.push(`<circle cx="${x + 0.5}" cy="${y + 0.5}" r="0.47"/>`)
    else shapes.push(`<rect x="${x + 0.04}" y="${y + 0.04}" width="0.92" height="0.92" rx="0.3"/>`)
  }
  return shapes.join('')
}

// SVG 渲染（草料式美化）。logoImage 为 dataURL 或 /uploads/ 路径；brand 为无 LOGO 图时的文字。
function svg(text, opts = {}) {
  const {
    size = 360, fg = '#0f172a', bg = '#ffffff', margin = 2, logo = true,
    brand = 'M', logoImage = '', style: rawStyle
  } = opts
  const st = normalizeStyle(rawStyle)
  const key = `svg2|${text}|${size}|${fg}|${bg}|${margin}|${logo}|${brand}|${logoImage}|${JSON.stringify(st)}`
  return cached(key, () => {
    const { bits, n } = modulesOf(text, logo ? 'H' : 'M')
    const total = n + margin * 2
    const fid = 'qg' + Math.abs(hashCode(key)).toString(36)
    const paint = st.gradTo ? `url(#${fid})` : fg
    const defs = st.gradTo
      ? `<defs><linearGradient id="${fid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${fg}"/><stop offset="1" stop-color="${st.gradTo}"/></linearGradient></defs>`
      : ''
    const bgMarkup = st.bgImage
      ? `<image href="${escapeXml(st.bgImage)}" x="0" y="0" width="${total}" height="${total}" preserveAspectRatio="xMidYMid slice"/><rect width="${total}" height="${total}" fill="${bg}" fill-opacity="0.86"/>`
      : `<rect width="${total}" height="${total}" fill="${bg}"/>`
    let logoMarkup = ''
    if (logo) {
      const ls = total * 0.17
      const p = (total - ls) / 2
      if (st.logoShape === 'none') {
        logoMarkup = logoImage
          ? `<image href="${logoImage}" x="${p}" y="${p}" width="${ls}" height="${ls}" preserveAspectRatio="xMidYMid meet"/>`
          : `<text x="${total / 2}" y="${total / 2}" text-anchor="middle" dominant-baseline="central" font-family="Arial,Helvetica,sans-serif" font-size="${ls * 0.5}" font-weight="700" fill="${paint}">${escapeXml(brand)}</text>`
      } else {
        const rx = st.logoShape === 'circle' ? ls / 2 : ls * 0.22
        logoMarkup = `<rect x="${p}" y="${p}" width="${ls}" height="${ls}" rx="${rx}" fill="#ffffff"/>`
        logoMarkup += logoImage
          ? `<image href="${logoImage}" x="${p + ls * 0.06}" y="${p + ls * 0.06}" width="${ls * 0.88}" height="${ls * 0.88}" preserveAspectRatio="xMidYMid meet" clip-path="inset(0 round ${rx}px)"/>`
          : `<text x="${total / 2}" y="${total / 2}" text-anchor="middle" dominant-baseline="central" font-family="Arial,Helvetica,sans-serif" font-size="${ls * 0.5}" font-weight="700" fill="${fg}">${escapeXml(brand)}</text>`
      }
    }
    const finder = finderMarkup(margin, margin, st.eye, paint) + '\n'
      + finderMarkup(n - 7 + margin, margin, st.eye, paint) + '\n'
      + finderMarkup(margin, n - 7 + margin, st.eye, paint)
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${size}" height="${size}" role="img" aria-label="名片二维码">
${defs}${bgMarkup}
<g transform="translate(${margin},${margin})" fill="${paint}">${dataPath(bits, n, st.dot)}</g>
<g fill="${paint}">${finder}</g>${logoMarkup}
</svg>`
  })
}

// PNG：统一走 SVG → sharp 光栅化，保证 SVG/PNG 样式完全一致（码点/码眼/渐变/背景都生效）
async function png(text, opts = {}) {
  const size = opts.size || 720
  const st = normalizeStyle(opts.style)
  const key = `png2|${text}|${size}|${opts.fg}|${opts.bg}|${opts.logo}|${opts.brand}|${opts.logoImage}|${JSON.stringify(st)}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.t < TTL_MS && hit.png) return hit.png
  const markup = svg(text, { ...opts, size: Math.max(size, 720) })
  const buf = await sharp(Buffer.from(markup), { density: 300 }).resize(size, size).png().toBuffer()
  const prev = cache.get(key)
  cache.set(key, { t: Date.now(), v: prev?.v, png: buf })
  if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value)
  return buf
}

function hashCode(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0 }
  return h
}

// 供「实体名片版式」内联绘制用：返回相对坐标的模块列表
function modules(text) {
  const { bits, n } = modulesOf(text, 'H')
  const d = []
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (bits.get(x, y)) d.push(`M${x},${y}h1v1h-1z`)
  return { d, n }
}

module.exports = { svg, png, modules, escapeXml, clearCache, normalizeStyle, DEFAULT_STYLE }
