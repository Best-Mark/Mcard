const esc = s => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')

function splitName(name) {
  const n = String(name || '').trim()
  if (!n) return ['', '']
  if (n.includes(' ')) {
    const i = n.lastIndexOf(' ')
    return [n.slice(0, i), n.slice(i + 1)]
  }
  return [n, '']
}

function build(card, baseUrl) {
  const [family, given] = splitName(card.name || card.name_en)
  const url = `${baseUrl}/c/${card.slug}`
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${esc(family)};${esc(given)};;;`,
    `FN:${esc(card.name || card.name_en || '名片')}`,
    card.company || card.department ? `ORG:${esc(card.company)};${esc(card.department)}` : '',
    card.title ? `TITLE:${esc(card.title)}` : '',
    card.mobile ? `TEL;TYPE=CELL,VOICE:${esc(card.mobile)}` : '',
    card.phone ? `TEL;TYPE=WORK,VOICE:${esc(card.phone)}` : '',
    card.email ? `EMAIL;TYPE=INTERNET,WORK:${esc(card.email)}` : '',
    card.address || card.address_detail ? `ADR;TYPE=WORK:;;${esc(card.address_detail)};${esc(card.address)};;;` : '',
    card.website ? `URL:${esc(card.website)}` : '',
    card.wechat ? `X-WECHAT:${esc(card.wechat)}` : '',
    `URL;TYPE=HOME:${esc(url)}`,
    card.bio || card.company_intro
      ? `NOTE:${esc([card.bio, card.company_intro ? `公司简介：${card.company_intro}` : ''].filter(Boolean).join('\\n'))}`
      : '',
    card.tags && card.tags.length ? `CATEGORIES:${card.tags.map(esc).join(',')}` : '',
    'END:VCARD'
  ].filter(Boolean)
  // 兼容旧版手机：CRLF + UTF-8 BOM
  return '\uFEFF' + lines.join('\r\n') + '\r\n'
}

module.exports = { build }
