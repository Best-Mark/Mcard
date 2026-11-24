// vCard 3.0 生成：面向 iOS / Android / 鸿蒙 / 其它系统的通讯录兼容。
// 关键点：
//  - 3.0 是各系统通用基线（4.0 在旧安卓/鸿蒙支持不完整）
//  - UTF-8 BOM + CRLF，兼容旧手机
//  - 中英文姓名拆分：中文无空格时把整名放 given、family 留空，FN 为准，避免 iOS/鸿蒙显示错位
//  - TEL 显式 TYPE=CELL / WORK，否则安卓可能把手机号当普通电话
//  - 微信/支付宝等自定义字段既写 X-* 也写进 NOTE，安卓/鸿蒙忽略 X-* 时仍能在备注里看到
const esc = s => String(s || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')

function splitName(name) {
  const n = String(name || '').trim()
  if (!n) return ['', '', n]
  // 西文名：按最后一个空格拆姓/名
  if (/^[\x00-\x7F]+$/.test(n) && n.includes(' ')) {
    const i = n.lastIndexOf(' ')
    return [n.slice(0, i), n.slice(i + 1), n]
  }
  // 中文/无空格：整名作为 given，family 留空，FN 保留原样（各系统以 FN 显示为准）
  return ['', n, n]
}

function build(card, baseUrl) {
  const [family, given, formatted] = splitName(card.name || card.name_en)
  const url = `${baseUrl}/c/${card.slug}`
  const notes = []
  if (card.bio) notes.push(card.bio)
  if (card.company_intro) notes.push(`公司简介：${card.company_intro}`)
  // 跨系统兜底：微信/支付宝/座机/网址写进 NOTE，X-* 被忽略的系统仍可见
  const extra = []
  if (card.wechat) extra.push(`微信：${card.wechat}`)
  if (card.alipay) extra.push(`支付宝：${card.alipay}`)
  if (card.whatsapp) extra.push(`WhatsApp：${card.whatsapp}`)
  if (card.shop_url) extra.push(`店铺：${card.shop_url}`)
  if (extra.length) notes.push(extra.join('\n'))
  notes.push(`电子名片：${url}`)
  // 下面 join 用真实换行符，esc 会统一转成 vCard 的 \n 转义，避免出现双反斜杠

  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${esc(family)};${esc(given)};;;`,
    `FN:${esc(formatted || '名片')}`,
    card.company || card.department ? `ORG:${esc(card.company)};${esc(card.department)}` : '',
    card.title ? `TITLE:${esc(card.title)}` : '',
    card.mobile ? `TEL;TYPE=CELL,VOICE:${esc(card.mobile)}` : '',
    card.phone ? `TEL;TYPE=WORK,VOICE:${esc(card.phone)}` : '',
    card.email ? `EMAIL;TYPE=INTERNET,WORK:${esc(card.email)}` : '',
    card.address || card.address_detail
      ? `ADR;TYPE=WORK:;;${esc(card.address_detail)};${esc(card.address)};;;`
      : '',
    card.website ? `URL;TYPE=WORK:${esc(card.website)}` : '',
    card.wechat ? `X-WECHAT:${esc(card.wechat)}` : '',
    card.alipay ? `X-ALIPAY:${esc(card.alipay)}` : '',
    `URL:${esc(url)}`,
    `NOTE:${esc(notes.filter(Boolean).join('\n'))}`,
    card.tags && card.tags.length ? `CATEGORIES:${card.tags.map(esc).join(',')}` : '',
    'END:VCARD'
  ].filter(Boolean)

  // 兼容旧版手机：CRLF + UTF-8 BOM
  return '\uFEFF' + lines.join('\r\n') + '\r\n'
}

module.exports = { build }
