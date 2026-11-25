import QRCode from 'qrcode'

// 90×54mm 成品 + 每边 3mm 出血 = 96×60mm；安全线 4.5mm。
// 版式（printTemplate）与主题配色（theme）正交：版式决定骨架，主题只提供 --t-* 等价色值。
const W = 96, H = 60, BLEED = 3, SAFE = 4.5
const esc = s => String(s ?? '').replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c])
// 深底版式的固定墨色/纸色（不随浅色主题漂走，保证印刷对比度）
const INK = { dark: '#111827', dark2: '#1f2937', paper: '#f8fafc', gold: '#c9a163', gold2: '#e3c893', line: 'rgba(255,255,255,.28)' }

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

// 二维码统一白底方块，保证任何深色版式都能扫。
// 边界钳制：白底（含 pad）必须完整落在安全区内，否则裁切后会缺角导致扫不出。
// x/y 是二维码本体左上角，白底从 x-pad 到 x+size+pad。
function qrBlock(qrText, x, y, size, fg = '#0f172a', pad = 1.5) {
  const lo = SAFE + pad, hiX = W - SAFE - size - pad, hiY = H - SAFE - size - pad
  const qx = Math.min(Math.max(x, lo), hiX)
  const qy = Math.min(Math.max(y, lo), hiY)
  return `<rect x="${qx - pad}" y="${qy - pad}" width="${size + pad * 2}" height="${size + pad * 2}" rx="1.2" fill="#fff"/>${qrPath(qrText, qx, qy, size, fg)}`
}

// 头像：方形/圆形可选，clipPath id 随位置生成避免多头像冲突
function avatarMarkup(card, x, y, r, t, shape = 'circle', id = 'av') {
  const clip = shape === 'rect'
    ? `<clipPath id="${id}"><rect x="${x - r}" y="${y - r}" width="${r * 2}" height="${r * 2}" rx="1.6"/></clipPath>`
    : `<clipPath id="${id}"><circle cx="${x}" cy="${y}" r="${r}"/></clipPath>`
  const bg = shape === 'rect'
    ? `<rect x="${x - r}" y="${y - r}" width="${r * 2}" height="${r * 2}" rx="1.6" fill="${t.accent}" opacity=".14"/>`
    : `<circle cx="${x}" cy="${y}" r="${r}" fill="${t.accent}" opacity=".14"/>`
  const initial = esc((card.name || card.name_en || 'M').slice(0, 1))
  const body = card.avatarData
    ? `<image href="${card.avatarData}" x="${x - r}" y="${y - r}" width="${r * 2}" height="${r * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>`
    : `${bg}<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="${r * 0.9}" font-weight="700" fill="${t.accent}">${initial}</text>`
  return `<defs>${clip}</defs>${body}`
}

function logoMarkup(card, x, y, size, onDark = false) {
  if (!card.logoData) return ''
  return `<image href="${card.logoData}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet"${onDark ? ' opacity=".95"' : ''}/>`
}

function contactLines(card, x, y, step, t, max = 4, color) {
  const rows = [
    card.mobile || card.phone,
    card.email,
    card.wechat ? `微信 ${card.wechat}` : '',
    card.address
  ].filter(Boolean)
  const c = color || t.muted
  return rows.slice(0, max).map((v, i) =>
    `<text x="${x}" y="${y + i * step}" font-size="2.5" fill="${c}">${esc(String(v).slice(0, 40))}</text>`).join('')
}

function nameTitle(card, x, y, titleY, t, opts = {}) {
  const name = esc(card.name || card.name_en || '你的姓名')
  const title = esc([card.title, card.company].filter(Boolean).join(' · ').slice(0, 34))
  return `<text x="${x}" y="${y}" font-size="${opts.nameSize || 5.2}" font-weight="700" fill="${opts.nameColor || t.text}">${name}</text>
    <text x="${x}" y="${titleY}" font-size="2.7" fill="${opts.titleColor || t.accent}">${title}</text>`
}

// ============ 正面 8 套版式 ============
function front(card, t, qrText) {
  const tpl = card.printTemplate || 'classic'
  const qr = (x, y, s, fg) => qrBlock(qrText, x, y, s, fg)
  const page = (fill) => `<rect width="${W}" height="${H}" fill="${fill}"/>`

  // ① 经典商务：细色条 + 头像 + 右二维码（最通用）
  if (tpl === 'classic') {
    return `${page(t.accent)}<rect x="${BLEED}" y="${BLEED}" width="${W - BLEED * 2}" height="${H - BLEED * 2}" fill="${t.surface}"/>
      <rect x="${BLEED}" y="${BLEED}" width="2.1" height="${H - BLEED * 2}" fill="${t.accent}"/>
      ${logoMarkup(card, 80, 6, 9)}
      ${avatarMarkup(card, 14, 17, 6.5, t, 'rect', 'av-classic')}
      ${nameTitle(card, 24, 16, 21.5, t)}
      ${contactLines(card, 10, 35, 5.2, t)}
      ${qr(72, 17, 20)}`
  }

  // ② 现代色块：上半主色块 + 悬浮头像 + 下方信息
  if (tpl === 'modern') {
    return `${page(t.accent)}<rect x="${BLEED}" y="${BLEED}" width="${W - BLEED * 2}" height="${H - BLEED * 2}" fill="${t.surface}"/>
      <path d="M${BLEED},${BLEED} H57 V26 H${BLEED} Z" fill="${t.accent}"/>
      ${logoMarkup(card, 79, 6, 9, true)}
      <text x="10" y="14" font-size="5.4" font-weight="700" fill="#fff">${esc(card.name || card.name_en || '你的姓名')}</text>
      <text x="10" y="20" font-size="2.7" fill="#fff" opacity=".92">${esc([card.title, card.company].filter(Boolean).join(' · ').slice(0, 34))}</text>
      ${avatarMarkup(card, 47, 33, 6.5, t, 'circle', 'av-modern')}
      <text x="10" y="36" font-size="2.6" fill="${t.text}">${esc(card.company || '')}</text>
      ${contactLines(card, 10, 42, 4, t, 2)}
      ${qr(72, 16, 21)}`
  }

  // ③ 极简线条：细边框 + 大留白 + 细分割线
  if (tpl === 'minimal') {
    return `${page(t.surface)}<rect x="${BLEED}" y="${BLEED}" width="${W - BLEED * 2}" height="${H - BLEED * 2}" fill="none" stroke="${t.accent}" stroke-width=".35"/>
      ${logoMarkup(card, 80, 6, 9)}
      <text x="10" y="18" font-size="5.8" font-weight="700" fill="${t.text}">${esc(card.name || card.name_en || '你的姓名')}</text>
      <text x="10" y="24" font-size="2.8" fill="${t.accent}">${esc([card.title, card.company].filter(Boolean).join(' · ').slice(0, 34))}</text>
      <line x1="10" y1="28" x2="62" y2="28" stroke="${t.accent}" stroke-width=".3" opacity=".5"/>
      ${contactLines(card, 10, 35, 5, t)}
      ${qr(72, 18, 20)}`
  }

  // ④ 深蓝鎏金：深底 + 金线 + 居中署名（固定深底，对比度稳）
  if (tpl === 'elite') {
    return `${page(INK.dark)}<rect x="${BLEED}" y="${BLEED}" width="${W - BLEED * 2}" height="${H - BLEED * 2}" fill="none" stroke="${INK.gold}" stroke-width=".4" opacity=".8"/>
      <rect x="${BLEED}" y="${BLEED}" width="${W - BLEED * 2}" height="1.1" fill="${INK.gold}"/>
      ${logoMarkup(card, 11, 9, 9, true)}
      ${avatarMarkup(card, 18, 28, 7, { ...t, accent: INK.gold }, 'circle', 'av-elite')}
      <text x="29" y="24" font-size="5.4" font-weight="700" fill="${INK.paper}">${esc(card.name || card.name_en || '你的姓名')}</text>
      <text x="29" y="30" font-size="2.7" fill="${INK.gold2}">${esc([card.title, card.company].filter(Boolean).join(' · ').slice(0, 34))}</text>
      <line x1="29" y1="33" x2="63" y2="33" stroke="${INK.gold}" stroke-width=".3" opacity=".6"/>
      ${contactLines(card, 29, 39, 4.5, t, 3, INK.paper)}
      ${qr(72, 16, 20)}`
  }

  // ⑤ 杂志排版：黑白高对比 + 大首字 + 直角细线
  if (tpl === 'editorial') {
    const name = esc(card.name || card.name_en || '你的姓名')
    const initial = esc((card.name || 'M').slice(0, 1))
    const rest = esc(String(card.name || card.name_en || '').slice(1))
    return `${page('#ffffff')}
      <rect x="${BLEED}" y="${BLEED}" width="2.4" height="${H - BLEED * 2}" fill="#111827"/>
      <text x="11" y="21" font-size="12" font-weight="900" fill="#111827" opacity=".12">${initial}</text>
      <text x="11" y="21" font-size="5.6" font-weight="900" fill="#111827">${initial}<tspan font-size="4.6">${rest}</tspan></text>
      <text x="11" y="27" font-size="2.7" fill="${t.accent}" font-weight="700">${esc([card.title, card.company].filter(Boolean).join(' · ').slice(0, 34))}</text>
      <line x1="11" y1="31" x2="63" y2="31" stroke="#111827" stroke-width=".6"/>
      ${contactLines(card, 11, 38, 5, t, 4, '#334155')}
      ${qr(72, 17, 20, '#111827')}`
  }

  // ⑥ 左右分栏：左侧主色竖栏放大名 + 右侧白底信息
  if (tpl === 'split') {
    return `${page(t.accent)}<rect x="${BLEED}" y="${BLEED}" width="34" height="${H - BLEED * 2}" fill="${t.accent}"/>
      <rect x="${BLEED + 34}" y="${BLEED}" width="${W - BLEED * 2 - 34}" height="${H - BLEED * 2}" fill="${t.surface}"/>
      ${avatarMarkup(card, 20, 16, 7, { ...t, accent: '#ffffff' }, 'circle', 'av-split')}
      <text x="20" y="30" font-size="5" font-weight="700" fill="#fff" text-anchor="middle">${esc(card.name || card.name_en || '你的姓名')}</text>
      <text x="20" y="36" font-size="2.5" fill="#fff" opacity=".9" text-anchor="middle">${esc(String(card.title || '').slice(0, 16))}</text>
      ${logoMarkup(card, 43, 8, 9)}
      <text x="43" y="24" font-size="2.9" fill="${t.text}" font-weight="700">${esc(card.company || '')}</text>
      ${contactLines(card, 43, 31, 5, t, 4)}
      ${qr(71, 18, 19)}`
  }

  // ⑦ 圆章徽记：圆形头像居中 + 双侧细线 + 底部信息带
  if (tpl === 'badge') {
    return `${page(t.surface)}
      <circle cx="${W / 2}" cy="23" r="15" fill="none" stroke="${t.accent}" stroke-width=".35" opacity=".55"/>
      <circle cx="${W / 2}" cy="23" r="11.5" fill="none" stroke="${t.accent}" stroke-width=".25" opacity=".4"/>
      ${avatarMarkup(card, W / 2, 23, 8.5, t, 'circle', 'av-badge')}
      ${logoMarkup(card, 8, 7, 9)}
      <text x="${W / 2}" y="43" font-size="5" font-weight="700" fill="${t.text}" text-anchor="middle">${esc(card.name || card.name_en || '你的姓名')}</text>
      <text x="${W / 2}" y="48" font-size="2.6" fill="${t.accent}" text-anchor="middle">${esc([card.title, card.company].filter(Boolean).join(' · ').slice(0, 34))}</text>
      <line x1="${BLEED}" y1="51.5" x2="${W - BLEED}" y2="51.5" stroke="${t.accent}" stroke-width=".3" opacity=".5"/>
      <text x="8" y="56" font-size="2.2" fill="${t.muted}">${esc(String(card.mobile || card.email || '').slice(0, 28))}</text>
      ${qr(74, 8, 14)}`
  }

  // ⑧ 斜切现代：斜切主色块 + 底部信息带 + 右上二维码
  if (tpl === 'corner') {
    return `${page(t.surface)}
      <path d="M${BLEED},${BLEED} H93 V30 L${BLEED},44 Z" fill="${t.accent}"/>
      ${logoMarkup(card, 80, 6, 9, true)}
      ${avatarMarkup(card, 15, 20, 6, { ...t, accent: '#ffffff' }, 'circle', 'av-corner')}
      <text x="25" y="18" font-size="5.2" font-weight="700" fill="#fff">${esc(card.name || card.name_en || '你的姓名')}</text>
      <text x="25" y="24" font-size="2.7" fill="#fff" opacity=".9">${esc([card.title, card.company].filter(Boolean).join(' · ').slice(0, 34))}</text>
      <text x="${BLEED + 1}" y="50" font-size="2.9" fill="${t.text}" font-weight="700">${esc(card.company || '')}</text>
      ${contactLines(card, BLEED + 1, 54.5, 2.6, t, 2)}
      ${qr(73, 18, 18)}`
  }

  return `${page(t.accent)}<rect x="${BLEED}" y="${BLEED}" width="${W - BLEED * 2}" height="${H - BLEED * 2}" fill="${t.surface}"/>${nameTitle(card, 10, 20, 26, t)}${qr(72, 17, 20)}`
}

// ============ 背面 4 套版式 ============
function back(card, t, qrText, brand, printBack) {
  const name = esc(card.name || card.name_en || '你的姓名')
  const phone = esc(card.mobile || card.phone || '')
  const tagline = esc(brand || 'MCard')
  const page = (fill) => `<rect width="${W}" height="${H}" fill="${fill}"/>`

  // ① 纯色经典：满版主色 + 居中署名 + 左下二维码
  if (printBack === 'solid') {
    return `${page(t.accent)}<rect x="${SAFE}" y="${SAFE}" width="${W - SAFE * 2}" height="${H - SAFE * 2}" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width=".3"/>
      ${logoMarkup(card, 44, 7, 12, true)}
      <text x="${W / 2}" y="24" text-anchor="middle" font-size="6.5" font-weight="700" fill="#fff">${name}</text>
      <text x="${W / 2}" y="31" text-anchor="middle" font-size="2.8" fill="#fff" opacity=".88">${esc(card.title || '')}</text>
      ${card.company_intro ? `<text x="${W / 2}" y="35" text-anchor="middle" font-size="2.1" fill="#fff" opacity=".72">${esc(String(card.company_intro).slice(0, 38))}</text>` : ''}
      <line x1="38" y1="37" x2="58" y2="37" stroke="#fff" stroke-opacity=".6" stroke-width=".3"/>
      <text x="${W / 2}" y="43" text-anchor="middle" font-size="2.7" fill="#fff" opacity=".9">${phone}</text>
      <text x="${W / 2}" y="54" text-anchor="middle" font-size="2.2" fill="#fff" opacity=".7">${tagline} · 扫一扫，存进通讯录</text>
      ${qrBlock(qrText, 8, 43, 11, '#0f172a')}`
  }

  // ② 素白信息：白底 + 左二维码 + 右信息栏（适合黑白/彩色打印都清晰）
  if (printBack === 'white') {
    return `${page('#ffffff')}<rect x="${BLEED}" y="${BLEED}" width="${W - BLEED * 2}" height="${H - BLEED * 2}" fill="none" stroke="${t.accent}" stroke-width=".4"/>
      ${qrBlock(qrText, 9, 12, 26, '#0f172a')}
      <text x="41" y="18" font-size="5" font-weight="700" fill="${t.text}">${name}</text>
      <text x="41" y="24" font-size="2.7" fill="${t.accent}">${esc(card.title || '')}</text>
      <line x1="41" y1="28" x2="88" y2="28" stroke="${t.accent}" stroke-width=".3" opacity=".5"/>
      ${contactLines(card, 41, 35, 5, t, 4)}
      <text x="41" y="55" font-size="2.2" fill="${t.muted}">${tagline} · 扫一扫，存进通讯录</text>`
  }

  // ③ 左右分栏：左主色署名 + 右白底二维码
  if (printBack === 'split') {
    return `${page(t.surface)}<rect x="${BLEED}" y="${BLEED}" width="42" height="${H - BLEED * 2}" fill="${t.accent}"/>
      ${logoMarkup(card, 10, 9, 11, true)}
      <text x="10" y="34" font-size="5.4" font-weight="700" fill="#fff">${name}</text>
      <text x="10" y="41" font-size="2.7" fill="#fff" opacity=".9">${esc(card.title || '')}</text>
      <text x="10" y="50" font-size="2.4" fill="#fff" opacity=".75">${esc(String(card.company || '').slice(0, 20))}</text>
      ${qrBlock(qrText, 56, 16, 24, '#0f172a')}
      <text x="56" y="52" font-size="2.3" fill="${t.muted}">${tagline}</text>`
  }

  // ④ 细框留白：居中细线框 + 右上角二维码
  if (printBack === 'frame') {
    return `${page('#ffffff')}<rect x="${SAFE}" y="${SAFE}" width="${W - SAFE * 2}" height="${H - SAFE * 2}" fill="none" stroke="${t.accent}" stroke-width=".5"/>
      <rect x="${SAFE + 1.2}" y="${SAFE + 1.2}" width="${W - (SAFE + 1.2) * 2}" height="${H - (SAFE + 1.2) * 2}" fill="none" stroke="${t.accent}" stroke-width=".2" opacity=".5"/>
      ${logoMarkup(card, 45, 9, 10)}
      <text x="${W / 2}" y="29" text-anchor="middle" font-size="5.6" font-weight="700" fill="${t.text}">${name}</text>
      <text x="${W / 2}" y="35" text-anchor="middle" font-size="2.7" fill="${t.accent}">${esc(card.title || '')}</text>
      <text x="${W / 2}" y="42" text-anchor="middle" font-size="2.4" fill="${t.muted}">${phone}</text>
      <text x="${W / 2}" y="52" text-anchor="middle" font-size="2.2" fill="${t.muted}">${tagline} · 扫一扫，存进通讯录</text>
      ${qrBlock(qrText, 7, 7, 13, '#0f172a')}`
  }

  return `${page(t.accent)}<rect x="${SAFE}" y="${SAFE}" width="${W - SAFE * 2}" height="${H - SAFE * 2}" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width=".3"/>
    ${logoMarkup(card, 44, 7, 12, true)}
    <text x="${W / 2}" y="23" text-anchor="middle" font-size="6.5" font-weight="700" fill="#fff">${name}</text>
    <text x="${W / 2}" y="30" text-anchor="middle" font-size="2.8" fill="#fff" opacity=".88">${esc(card.title || '')}</text>
    <text x="${W / 2}" y="42" text-anchor="middle" font-size="2.7" fill="#fff" opacity=".9">${phone}</text>
    <text x="${W / 2}" y="52" text-anchor="middle" font-size="2.2" fill="#fff" opacity=".7">${tagline} · 扫一扫，存进通讯录</text>
    ${qrBlock(qrText, 8, 43, 11, '#0f172a')}`
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
  const { side = 'front', guides = false, brand = 'MCard', baseUrl = '', printBack = 'solid' } = opts
  const enriched = { ...card, avatarData: await inlineImage(card.avatar), logoData: await inlineImage(card.logo) }
  const qrText = `${baseUrl}/c/${card.slug}`
  const body = side === 'back' ? back(enriched, theme, qrText, brand, printBack) : front(enriched, theme, qrText)
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
