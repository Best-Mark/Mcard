// 微信 JS-SDK 统一加载与签名配置（唯一真相源）
// 铁律：wx.config 的 jsApiList 是「覆盖式」不是累加；整页只 config 一次，一次给齐所有接口。
// 铁律：wx.ready 只代表 SDK ready，不等于本次 config 的权限已就绪（getLocation/分享都需容错重试）。
import { isWeChat } from './save-image'

// 统一接口清单：分享 + 定位，一次配齐，避免分享与定位互相冲掉权限
const UNIFIED_API_LIST = [
  'getLocation',
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

export { loadSdk, UNIFIED_API_LIST, isWeChat }
