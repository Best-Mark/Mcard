const QRCode = require('qrcode')
const sharp = require('sharp')

function qrPath(text, errorCorrectionLevel = 'H') {
  const qr = QRCode.create(text, { errorCorrectionLevel })
  const n = qr.modules.size
  const d = []
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) if (qr.modules.get(x, y)) d.push(`M${x},${y}h1v1h-1z`)
  }
  return { d: d.join(''), n }
}

function svg(text, { size = 360, fg = '#0f172a', bg = '#ffffff', margin = 2, logo = true, brand = 'M', logoImage = '' } = {}) {
  const { d, n } = qrPath(text, logo ? 'H' : 'M')
  const total = n + margin * 2
  const logoSize = total * 0.17
  const p = (total - logoSize) / 2
  let logoMarkup = ''
  if (logo) {
    logoMarkup = logoImage
      ? `<image href="${logoImage}" x="${p}" y="${p}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/>`
      : `<rect x="${p}" y="${p}" width="${logoSize}" height="${logoSize}" rx="${logoSize * 0.22}" fill="#ffffff"/>
  <text x="${total / 2}" y="${total / 2}" text-anchor="middle" dominant-baseline="central"
        font-family="Arial,Helvetica,sans-serif" font-size="${logoSize * 0.5}" font-weight="700" fill="${fg}">${escapeXml(brand)}</text>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img" aria-label="名片二维码">
<rect width="${total}" height="${total}" fill="${bg}"/>
<g transform="translate(${margin},${margin})" fill="${fg}"><path d="${d}"/></g>${logoMarkup}
</svg>`
}

async function png(text, { size = 720, fg = '#0f172a', bg = '#ffffff', logoImage = '' } = {}) {
  const base = await QRCode.toBuffer(text, {
    type: 'png',
    width: size,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: { dark: fg, light: bg }
  })
  if (!logoImage) return base

  // 中心 LOGO 不超过整体 18%，H 级纠错可安全覆盖
  const plateSize = Math.round(size * 0.18)
  const inner = Math.round(plateSize * 0.86)
  const logoBuf = await sharp(logoImage, { density: 300 })
    .resize({ width: inner, height: inner, fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  const plate = await sharp({
    create: { width: plateSize, height: plateSize, channels: 4, background: '#ffffff' }
  }).composite([{ input: logoBuf, gravity: 'centre' }]).png().toBuffer()
  return sharp(base).composite([{
    input: plate,
    left: Math.round((size - plateSize) / 2),
    top: Math.round((size - plateSize) / 2)
  }]).png().toBuffer()
}

function escapeXml(s) {
  return String(s).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c])
}

// 供「实体名片版式」内联绘制用：返回相对坐标的模块列表
function modules(text) {
  const { d, n } = qrPath(text, 'H')
  return { d, n }
}

module.exports = { svg, png, modules, escapeXml }
