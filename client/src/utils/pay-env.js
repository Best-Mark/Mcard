// 支付场景判定唯一真相源：H5/PC 浏览器按 UA 与视口决定 method/scene，绝不在各页面各写一套。
// 与后端 routes/orders.js 的 METHODS/SCENES 白名单严格对应。
function ua() {
  return typeof navigator === 'undefined' ? '' : String(navigator.userAgent || '')
}
function isWechat() {
  return /MicroMessenger/i.test(ua())
}
function isAlipay() {
  return /AlipayClient/i.test(ua())
}
function isMiniApp() {
  return /miniProgram/i.test(ua())
}
// PC 判定与 device.js 同口径（min-width 1024 + fine pointer）
function isDesktop() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(min-width: 1024px) and (pointer: fine)').matches
}

// 返回下单偏好：{ method, scene }。用户可在支付页切换方式重拉起支付。
function payPreference() {
  if (isAlipay()) return { method: 'alipay', scene: 'alipay-mini' }
  if (isWechat()) return { method: 'wechat', scene: 'wechat' }
  return { method: 'wechat', scene: isDesktop() ? 'pc' : 'h5' }
}

// 可用支付方式列表（供支付页切换；后端 pay-methods 是权威，这里只排展示顺序）
function payMethodOptions(channels = ['wechat']) {
  const list = []
  if (channels.includes('wechat')) list.push({ method: 'wechat', label: '微信支付' })
  if (channels.includes('alipay')) list.push({ method: 'alipay', label: '支付宝' })
  if (channels.includes('mock')) list.push({ method: 'mock', label: '模拟支付' })
  return list
}

export { ua, isWechat, isAlipay, isMiniApp, isDesktop, payPreference, payMethodOptions }
