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

// opts.slim = true：瘦身版——只保留主流联系人字段（姓名/公司/部门/职位/手机/座机/邮箱），
// 砍掉简介/地址/微信支付宝/标签/URL/NOTE 等拉长内容。
// 【2026-11-27】vCard 文本码已下线（微信扫一扫不解析 BEGIN:VCARD，只显示「暂不支持展示文本内容」黑屏），
// 本分支保留供第三方工具/系统相机本地生成 vCard 码使用；二维码端点一律改用名片页 URL。
// 完整版仍用于 card.vcf 下载与 vcard.txt（信息越全越好）。
function build(card, baseUrl, opts = {}) {
  const [family, given, formatted] = splitName(card.name || card.name_en)
  const url = `${baseUrl}/c/${card.slug}`
  const notes = []
  // 简介统一为一段：bio 优先，存量 company_intro 回落，不再分「个人/公司」两条。
  const intro = card.bio || card.company_intro || ''
  if (intro) notes.push(intro)
  // 跨系统兜底：微信/支付宝/座机/网址写进 NOTE，X-* 被忽略的系统仍可见
  const extra = []
  if (card.wechat) extra.push(`微信：${card.wechat}`)
  if (card.alipay) extra.push(`支付宝：${card.alipay}`)
  if (card.whatsapp) extra.push(`WhatsApp：${card.whatsapp}`)
  // 网址只放名片地址：通讯录「主页」点进去必须回到名片（名片里有相册），
  // 公司主页/店铺移到备注保留信息，避免多 URL 让主网址变成公司站而断开通路
  if (card.website) extra.push(`主页：${card.website}`)
  if (card.shop_url) extra.push(`店铺：${card.shop_url}`)
  if (extra.length) notes.push(extra.join('\n'))
  // 不再把名片网址塞进 NOTE：上方已有标准 URL: 字段，重复内容会拉长二维码、降低扫码成功率，
  // 且 iOS Safari 对 NOTE 里的长 URL 文本解析更脆弱。通讯录「主页」始终取 URL: 字段。
  // 下面 join 用真实换行符，esc 会统一转成 vCard 的 \n 转义，避免出现双反斜杠

  if (opts.slim) {
    // 瘦身版：仅主流联系人字段。手机/座机同时有才两行；邮箱只写合法值（同下方校验）。
    const lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `N:${esc(family)};${esc(given)};;;`,
      `FN:${esc(formatted || '名片')}`,
      card.company || card.department ? `ORG:${esc(card.company)};${esc(card.department)}` : '',
      card.title ? `TITLE:${esc(card.title)}` : '',
      card.mobile ? `TEL;TYPE=CELL,VOICE:${esc(card.mobile)}` : '',
      card.phone ? `TEL;TYPE=WORK,VOICE:${esc(card.phone)}` : '',
      card.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(card.email).trim()) ? `EMAIL;TYPE=INTERNET,WORK:${esc(card.email)}` : '',
      'END:VCARD'
    ].filter(Boolean)
    return lines.join('\r\n') + '\r\n'
  }

  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${esc(family)};${esc(given)};;;`,
    `FN:${esc(formatted || '名片')}`,
    card.company || card.department ? `ORG:${esc(card.company)};${esc(card.department)}` : '',
    card.title ? `TITLE:${esc(card.title)}` : '',
    card.mobile ? `TEL;TYPE=CELL,VOICE:${esc(card.mobile)}` : '',
    card.phone ? `TEL;TYPE=WORK,VOICE:${esc(card.phone)}` : '',
    // 非法邮箱（如用户误填的 QQ 号）会让 iOS 通讯录解析失败→「无法下载此文件」，只写合法值
    card.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(card.email).trim()) ? `EMAIL;TYPE=INTERNET,WORK:${esc(card.email)}` : '',
    card.address || card.address_detail
      ? `ADR;TYPE=WORK:;;${esc(card.address_detail)};${esc(card.address)};;;`
      : '',
    card.wechat ? `X-WECHAT:${esc(card.wechat)}` : '',
    card.alipay ? `X-ALIPAY:${esc(card.alipay)}` : '',
    `URL:${esc(url)}`,
    `NOTE:${esc(notes.filter(Boolean).join('\n'))}`,
    card.tags && card.tags.length ? `CATEGORIES:${card.tags.map(esc).join(',')}` : '',
    'END:VCARD'
  ].filter(Boolean)

  // CRLF 换行（vCard 3.0 标准）。不加 UTF-8 BOM：iOS Safari 会把 BOM 当非法字节，
  // 导致 inline 打开 .vcf 时报「Safari浏览器无法下载此文件」；去掉后各系统通讯录均正常识别。
  return lines.join('\r\n') + '\r\n'
}

module.exports = { build }
