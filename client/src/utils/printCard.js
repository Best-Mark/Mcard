import QRCode from 'qrcode'

const W = 96, H = 60, BLEED = 3, SAFE = 4.5
const esc = s => String(s ?? '').replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c])

async function inlineImage(url) {
  if (!url) return ''
  if (url.startsWith('data:')) return url
  try {
    const res = await fetch(url)
    if (!res.ok) return ''
    const blob = await res.blob()
    return await new Promise(resolve => {
      const fr = new FileReader()
      fr.onload = () => resolve(fr.result)
      fr.onerror = () => resolve('')
      fr.readAsDataURL(blob)
    })
  } catch { return '' }
}

function qrPath(text, x, y, size, fg) {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'H' })
  const n = qr.modules.size
  const cell = size / n
  const parts = []
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (!qr.modules.get(col, row)) continue
      const px = (x + col * cell).toFixed(3)
      const py = (y + row * cell).toFixed(3)
      parts.push(`M${px},${py}h${cell.toFixed(3)}v${cell.toFixed(3)}h${(-cell).toFixed(3)}z`)
    }
  }
  return `<path d="${parts.join('')}" fill="${fg}"/>`
}

function avatarMarkup(card, x, y, r, t) {
  if (card.avatarData) {
    return `<image href="${card.avatarData}" x="${x - r}" y="${y - r}" width="${r * 2}" height="${r * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip)"/>`
  }
  const initial = esc((card.name || card.name_en || 'M').slice(0, 1))
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${t.accent}" opacity=".14"/><text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="${r}" font-weight="700" fill="${t.accent}">${initial}</text>`
}

function logoMarkup(card, x, y, size) {
  return card.logoData
    ? `<image href="${card.logoData}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet"/>`
    : ''
}

function contactLines(card, x, y, step, t, compact = false) {
  const rows = [
    card.mobile || card.phone,
    card.email,
    card.wechat ? `微信 ${card.wechat}` : '',
    card.address
  ].filter(Boolean)
  return rows.slice(0, compact ? 2 : 4).map((v, i) =>
    `<text x="${x}" y="${y + i * step}" font-size="2.5" fill="${t.muted}">${esc(v.slice(0, 46))}</text>`).join('')
}

function front(card, t, qrText) {
  const qr = qrPath(qrText, 73, 17, 20, t.text)
  const commonDefs = `<defs><clipPath id="avatarClip"><circle cx="14" cy="17" r="6.5"/></clipPath></defs>`
  const name = esc(card.name || card.name_en || '你的姓名')
  const title = esc([card.title, card.company].filter(Boolean).join(' · ').slice(0, 34))

  if ((card.printTemplate || 'classic') === 'modern') {
    return `${commonDefs}
      <rect width="${W}" height="${H}" fill="${t.accent}"/>
      <rect x="${BLEED}" y="${BLEED}" width="${W - BLEED * 2}" height="${H - BLEED * 2}" fill="${t.surface}"/>
      <path d="M${BLEED},${BLEED} H57 V25 H${BLEED} Z" fill="${t.accent}"/>
      ${logoMarkup(card, 81, 6, 9)}
      <text x="10" y="14" font-size="5.4" font-weight="700" fill="#fff">${name}</text>
      <text x="10" y="20" font-size="2.7" fill="#fff" opacity=".9">${title}</text>
      ${avatarMarkup(card, 49, 34, 6, t)}
      <text x="10" y="36" font-size="2.6" fill="${t.text}">${esc(card.company || '')}</text>
      ${contactLines(card, 10, 42, 4, t, true)}
      <rect x="71" y="15" width="24" height="24" rx="2" fill="#fff"/>
      ${qr}`
  }

  if ((card.printTemplate || 'classic') === 'minimal') {
    return `${commonDefs}
      <rect width="${W}" height="${H}" fill="${t.surface}"/>
      <rect x="${BLEED}" y="${BLEED}" width="${W - BLEED * 2}" height="${H - BLEED * 2}" fill="none" stroke="${t.accent}" stroke-width=".35"/>
      ${logoMarkup(card, 81, 6, 9)}
      <text x="10" y="17" font-size="5.2" font-weight="700" fill="${t.text}">${name}</text>
      <text x="10" y="23" font-size="2.7" fill="${t.accent}">${title}</text>
      <line x1="10" y1="27" x2="63" y2="27" stroke="${t.line || '#cbd5e1'}" stroke-width=".3"/>
      ${contactLines(card, 10, 34, 5, t)}
      <rect x="71" y="17" width="24" height="24" fill="#fff"/>
      ${qr}`
  }

  return `${commonDefs}
    <rect width="${W}" height="${H}" fill="${t.accent}"/>
    <rect x="${BLEED}" y="${BLEED}" width="${W - BLEED * 2}" height="${H - BLEED * 2}" fill="${t.surface}"/>
    <rect x="${BLEED}" y="${BLEED}" width="2.1" height="${H - BLEED * 2}" fill="${t.accent}"/>
    ${logoMarkup(card, 81, 6, 9)}
    ${avatarMarkup(card, 14, 17, 6.5, t)}
    <text x="24" y="16" font-size="5.2" font-weight="700" fill="${t.text}">${name}</text>
    <text x="24" y="21.5" font-size="2.7" fill="${t.accent}">${title}</text>
    ${contactLines(card, 10, 35, 5.2, t)}
    <rect x="71" y="17" width="24" height="24" fill="#fff"/>
    ${qr}`
}

function back(card, t, qrText, brand) {
  const name = esc(card.name || card.name_en || '你的姓名')
  const phone = esc(card.mobile || card.phone || '')
  return `
    <rect width="${W}" height="${H}" fill="${t.accent}"/>
    <rect x="${SAFE}" y="${SAFE}" width="${W - SAFE * 2}" height="${H - SAFE * 2}" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width=".3"/>
    ${logoMarkup(card, 44, 7, 12)}
    <text x="${W / 2}" y="23" text-anchor="middle" font-size="6.5" font-weight="700" fill="#fff">${name}</text>
    <text x="${W / 2}" y="30" text-anchor="middle" font-size="2.8" fill="#fff" opacity=".88">${esc(card.title || '')}</text>
    ${card.company_intro ? `<text x="${W / 2}" y="33.6" text-anchor="middle" font-size="2.1" fill="#fff" opacity=".72">${esc(String(card.company_intro).slice(0, 38))}</text>` : ''}
    <line x1="38" y1="35" x2="58" y2="35" stroke="#fff" stroke-opacity=".6" stroke-width=".3"/>
    <text x="${W / 2}" y="41" text-anchor="middle" font-size="2.7" fill="#fff" opacity=".9">${phone}</text>
    <text x="${W / 2}" y="47" text-anchor="middle" font-size="2.2" fill="#fff" opacity=".7">${esc(brand || 'MCard')} · 扫一扫，存进通讯录</text>
    <rect x="7" y="44" width="12" height="12" fill="#fff"/>
    ${qrPath(qrText, 7.6, 44.6, 10.8, '#0f172a')}`
}

function guidesMarkup() {
  return `
    <g fill="none" stroke="#ef4444" stroke-width=".25" stroke-dasharray="1 .8" opacity=".8">
      <rect x="${BLEED}" y="${BLEED}" width="${W - BLEED * 2}" height="${H - BLEED * 2}"/>
      <rect x="${SAFE}" y="${SAFE}" width="${W - SAFE * 2}" height="${H - SAFE * 2}" stroke="#3b82f6"/>
    </g>
    <text x="${BLEED + .6}" y="${BLEED + 2.2}" font-size="1.6" fill="#ef4444">出血 3mm</text>
    <text x="${SAFE + .6}" y="${SAFE + 2.2}" font-size="1.6" fill="#3b82f6">安全区</text>`
}

export async function buildPrintSvg(card, theme, opts = {}) {
  const { side = 'front', guides = false, brand = 'MCard', baseUrl = '' } = opts
  const enriched = { ...card, avatarData: await inlineImage(card.avatar), logoData: await inlineImage(card.logo) }
  const qrText = `${baseUrl}/c/${card.slug}`
  const body = side === 'back' ? back(enriched, theme, qrText, brand) : front(enriched, theme, qrText)
  const sizeAttr = opts.raster
    ? `width="${Math.round(W * (opts.dpi || 300) / 25.4)}" height="${Math.round(H * (opts.dpi || 300) / 25.4)}"`
    : `width="${W}mm" height="${H}mm"`
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" ${sizeAttr}>
${body}${guides ? guidesMarkup() : ''}
</svg>`
}

export async function svgToPngBlob(svg, dpi = 300) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(W * dpi / 25.4)
  canvas.height = Math.round(H * dpi / 25.4)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = url })
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  } finally { URL.revokeObjectURL(url) }
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
}
