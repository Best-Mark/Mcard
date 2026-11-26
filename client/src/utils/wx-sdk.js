// 微信 JS-SDK 统一加载与签名配置（唯一真相源）
// 铁律：wx.config 的 jsApiList 是「覆盖式」不是累加；整页只 config 一次，一次给齐所有接口。
// 铁律：wx.ready 只代表 SDK ready，不等于本次 config 的权限已就绪（getLocation/分享都需容错重试）。
import { isWeChat } from './save-image'

// 统一接口清单：分享 + 定位 + 扫码，一次配齐，避免分享/定位/扫码互相冲掉权限。
// 铁律：wx.config 的 jsApiList 是覆盖式，任何页面都只用这一份，绝不各写一份。
const UNIFIED_API_LIST = [
  'getLocation', 'scanQRCode',
  'updateAppMessageShareData', 'updateTimelineShareData',
  'onMenuShareAppMessage', 'onMenuShareTimeline'
]
const SDK_SRC = 'https://res.wx.qq.com/open/js/jweixin-1.6.0.js'
let sdkPromise = null
let configPromise = null
let configuredUrl = ''

function loadSdk() {
  if (window.wx?.config) return Promise.resolve(window.wx)
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SDK_SRC
    s.onload = () => window.wx ? resolve(window.wx) : reject(new Error('微信 SDK 加载失败'))
    s.onerror = () => { sdkPromise = null; reject(new Error('微信 SDK 加载失败')) }
    document.head.appendChild(s)
  })
  return sdkPromise
}

// 统一 config：同 URL 只配一次，返回 { wx, ok }。
// ok=true 仅表示 wx.ready 触发；调用具体 API 仍需按接口做 fail 容错（见 geo.js 的 getLocation 重试）。
export function configWx(api, force = false) {
  const url = window.location.href.split('#')[0]
  if (!force && window.wx?.config && configPromise && configuredUrl === url) return configPromise
  configPromise = (async () => {
    const wx = await loadSdk()
    const { data } = await api.get('/api/auth/wechat/jssdk-sign', { params: { url } })
    if (data?.code !== 0 || !data?.data?.signature) return { wx, ok: false }
    const s = data.data
    return await new Promise(resolve => {
      let settled = false
      const finish = ok => { if (!settled) { settled = true; configuredUrl = ok ? url : ''; resolve({ wx, ok }) } }
      try {
        wx.config({ appId: s.appId, timestamp: s.timestamp, nonceStr: s.nonceStr, signature: s.signature, jsApiList: UNIFIED_API_LIST, debug: false })
        wx.ready(() => finish(true))
        wx.error(() => finish(false))
        setTimeout(() => finish(false), 4000)
      } catch { finish(false) }
    })
  })().catch(() => ({ wx: window.wx, ok: false }))
  return configPromise
}

// 微信内 JSAPI 支付：调起收银台。与 wx.config 的分享/扫码权限无关，只依赖 SDK 已加载。
// 参数来自后端 JSAPI 下单二次签名（appId/timeStamp/nonceStr/package/signType/paySign），前端不参与签名。
export function wxPay(params) {
  return new Promise((resolve, reject) => {
    loadSdk().then(wx => {
      if (!wx?.chooseWXPay) return reject(new Error('当前环境不支持微信支付，请在微信内打开'))
      try {
        wx.chooseWXPay({
          appId: params.appId,
          timestamp: params.timeStamp,
          nonceStr: params.nonceStr,
          package: params.package,
          signType: params.signType || 'RSA',
          paySign: params.paySign,
          success: () => resolve({ ok: true }),
          fail: err => reject(new Error(err?.errMsg || '微信支付未完成')),
          cancel: () => reject(new Error('已取消支付'))
        })
      } catch (e) { reject(new Error(e.message || '拉起微信支付失败')) }
    }).catch(reject)
  })
}

export { loadSdk, UNIFIED_API_LIST, isWeChat }
