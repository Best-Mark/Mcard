const QRCode = require('qrcode')
const sharp = require('sharp')
// 码点/码眼清单唯一真相源（含全部取值与中文标签），经 /public/meta 下发两端。
const { DOT_VALUES, EYE_VALUES } = require('../utils/qrStyles')

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
// 易扫模式（scan=1）：客户扫码主场景专用。圆点/圆角定位角/渐变/背景图都会显著降低微信「扫一扫」识别率，
// 这里统一收敛成标准方点+方定位角+纯色，牺牲装饰性换「一次扫开」。卡片上的美化小码不受影响。
const SCAN_STYLE = { dot: 'square', eye: 'square', gradTo: '', logoShape: 'rounded', bgImage: '' }
function normalizeStyle(s) {
  const o = s && typeof s === 'object' ? s : {}
  const inSet = (v, set, d) => set.includes(v) ? v : d
  return {
    dot: inSet(o.dot, DOT_VALUES, DEFAULT_STYLE.dot),
    eye: inSet(o.eye, EYE_VALUES, DEFAULT_STYLE.eye),
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

// 画一个 finder（码眼）：ox,oy 为 7×7 区域左上角（模块坐标）。
// ⚠️ 所有形状都保持「外框 + 中心实心」两级结构，这是扫码器识别 finder 的关键，
// 只换外框圆角/线宽/几何形状，不改位置与尺寸（含 1 格分隔带）。
function finderMarkup(ox, oy, eye, fill) {
  const cx = ox + 3.5, cy = oy + 3.5
  const frame = (rx, sw) => `<rect x="${ox}" y="${oy}" width="7" height="7" rx="${rx}" fill="none" stroke="${fill}" stroke-width="${sw}"/>`
  const dot = (r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`
  const innerRect = (rx) => `<rect x="${ox + 2}" y="${oy + 2}" width="3" height="3" rx="${rx}" fill="${fill}"/>`
  switch (eye) {
    case 'circle': return frame(0, 1) + dot(1.6)
    case 'rounded': return frame(2, 1) + innerRect(1)
    case 'thickRounded': return frame(2, 2.2) + innerRect(1)
    case 'mediumRounded': return frame(2, 1.5) + innerRect(1)
    case 'thinRounded': return frame(2, 0.7) + innerRect(0.8)
    case 'thickCircle': return `<circle cx="${cx}" cy="${cy}" r="3.1" fill="none" stroke="${fill}" stroke-width="2.2"/>` + dot(1.7)
    case 'thinCircle': return `<circle cx="${cx}" cy="${cy}" r="3.4" fill="none" stroke="${fill}" stroke-width="0.7"/>` + dot(1.5)
    case 'diamond': return `<path d="M${cx},${oy}h3.5v3.5h-3.5z" transform="rotate(45 ${cx} ${cy})" fill="none" stroke="${fill}" stroke-width="1"/>`
      + `<path d="M${cx},${cy - 1.6}l1.6,1.6l-1.6,1.6l-1.6,-1.6z" fill="${fill}"/>`
    case 'star': {
      const star = (outer, inner) => {
        const pts = []
        for (let i = 0; i < 8; i++) {
          const a = -Math.PI / 2 + i * Math.PI / 4
          const r = i % 2 === 0 ? outer : inner
          pts.push(`${(cx + Math.cos(a) * r).toFixed(2)},${(cy + Math.sin(a) * r).toFixed(2)}`)
        }
        return pts.join(' ')
      }
      return `<polygon points="${star(3.4, 2.1)}" fill="none" stroke="${fill}" stroke-width="1"/>`
        + `<polygon points="${star(1.7, 1)}" fill="${fill}"/>`
    }
    case 'bubble': return `<path d="M${ox + 1},${oy}h5a1,1 0 0 1 1,1v4a1,1 0 0 1 -1,1h-3l-1.5,1.4v-1.4h-0.5a1,1 0 0 1 -1,-1v-4a1,1 0 0 1 1,-1z" fill="none" stroke="${fill}" stroke-width="1"/>`
      + dot(1.6)
    case 'eye': return `<ellipse cx="${cx}" cy="${cy}" rx="3.5" ry="2.6" fill="none" stroke="${fill}" stroke-width="1"/>` + dot(1.5)
    case 'singleRound': return `<path d="M${ox},${oy + 2}a2,2 0 0 1 2,-2h5v7h-7z" fill="none" stroke="${fill}" stroke-width="1"/>` + dot(1.6)
    case 'fourRound': return `<rect x="${ox}" y="${oy}" width="7" height="7" rx="1.6" fill="none" stroke="${fill}" stroke-width="1"/>`
      + `<circle cx="${ox + 1.6}" cy="${oy + 1.6}" r="0.8" fill="${fill}"/><circle cx="${ox + 5.4}" cy="${oy + 1.6}" r="0.8" fill="${fill}"/>`
      + `<circle cx="${ox + 1.6}" cy="${oy + 5.4}" r="0.8" fill="${fill}"/><circle cx="${ox + 5.4}" cy="${oy + 5.4}" r="0.8" fill="${fill}"/>`
      + dot(1.2)
    default: return frame(0, 1) + innerRect(0)
  }
}

// 单个码点形状：以 (x,y) 模块左上角为原点，绘制在 1×1 方格内。
function dotShape(x, y, dot) {
  const cx = x + 0.5, cy = y + 0.5
  switch (dot) {
    case 'dots': return `<circle cx="${cx}" cy="${cy}" r="0.47"/>`
    case 'smallDots': return `<circle cx="${cx}" cy="${cy}" r="0.3"/>`
    case 'smallSquare': return `<rect x="${x + 0.2}" y="${y + 0.2}" width="0.6" height="0.6"/>`
    case 'diamond': return `<path d="M${cx},${y}l0.5,0.5l-0.5,0.5l-0.5,-0.5z"/>`
    case 'hStripe': return `<rect x="${x}" y="${y + 0.3}" width="1" height="0.4"/>`
    case 'vStripe': return `<rect x="${x + 0.3}" y="${y}" width="0.4" height="1"/>`
    case 'stripe': return `<rect x="${x}" y="${y + 0.18}" width="1" height="0.22"/><rect x="${x}" y="${y + 0.6}" width="1" height="0.22"/>`
    case 'tile': return `<rect x="${x}" y="${y}" width="0.45" height="0.45"/><rect x="${x + 0.55}" y="${y + 0.55}" width="0.45" height="0.45"/>`
    case 'grid': return `<rect x="${x + 0.05}" y="${y + 0.05}" width="0.4" height="0.4"/><rect x="${x + 0.55}" y="${y + 0.05}" width="0.4" height="0.4"/><rect x="${x + 0.05}" y="${y + 0.55}" width="0.4" height="0.4"/><rect x="${x + 0.55}" y="${y + 0.55}" width="0.4" height="0.4"/>`
    case 'liquid': return `<rect x="${x - 0.03}" y="${y - 0.03}" width="1.06" height="1.06" rx="0.38"/>`
    case 'roundLiquid': return `<circle cx="${cx}" cy="${cy}" r="0.6"/>`
    case 'hex': {
      const pts = []
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 3
        pts.push(`${(cx + Math.cos(a) * 0.5).toFixed(2)},${(cy + Math.sin(a) * 0.5).toFixed(2)}`)
      }
      return `<polygon points="${pts.join(' ')}"/>`
    }
    case 'thickStar':
    case 'thinStar': {
      const outer = dot === 'thickStar' ? 0.5 : 0.5
      const inner = dot === 'thickStar' ? 0.22 : 0.11
      const pts = []
      for (let i = 0; i < 8; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 4
        const r = i % 2 === 0 ? outer : inner
        pts.push(`${(cx + Math.cos(a) * r).toFixed(2)},${(cy + Math.sin(a) * r).toFixed(2)}`)
      }
      return `<polygon points="${pts.join(' ')}"/>`
    }
    default: return `<rect x="${x + 0.04}" y="${y + 0.04}" width="0.92" height="0.92" rx="0.3"/>`
  }
}

// 核心：按样式渲染 data 区码点（跳过 finder 区域，finder 单独画）。
// 非方点用 1×1 的 <defs><path> 模板 + <use transform> 复用，避免每模块重复输出完整几何（体积可降一个量级）。
function dataPath(bits, n, dot) {
  if (dot === 'square') {
    const d = []
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (inFinder(x, y, n)) continue
      if (bits.get(x, y)) d.push(`M${x},${y}h1v1h-1z`)
    }
    return `<path d="${d.join('')}"/>`
  }
  const shape = dotShape(0, 0, dot)
  const uses = []
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (inFinder(x, y, n)) continue
    if (bits.get(x, y)) uses.push(`<use href="#qds" x="${x}" y="${y}"/>`)
  }
  return `<defs><g id="qds">${shape}</g></defs>` + uses.join('')
}

// SVG 渲染（草料式美化）。logoImage 为 dataURL 或 /uploads/ 路径；brand 为无 LOGO 图时的文字。
function svg(text, opts = {}) {
  const {
    size = 360, fg = '#0f172a', bg = '#ffffff', margin = 2, logo = true,
    brand = 'M', logoImage = '', logoScale = 0.17, style: rawStyle
  } = opts
  const st = normalizeStyle(rawStyle)
  const key = `svg2|${text}|${size}|${fg}|${bg}|${margin}|${logo}|${brand}|${logoImage}|${logoScale}|${JSON.stringify(st)}`
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
      const ls = total * logoScale
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
  const key = `png2|${text}|${size}|${opts.fg}|${opts.bg}|${opts.logo}|${opts.brand}|${opts.logoImage}|${opts.logoScale || 0.17}|${JSON.stringify(st)}`
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

module.exports = { svg, png, modules, escapeXml, clearCache, normalizeStyle, DEFAULT_STYLE, SCAN_STYLE }
