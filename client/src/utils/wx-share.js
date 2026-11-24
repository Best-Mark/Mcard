import { isWeChat } from './save-image'

// 微信 JS-SDK 分享卡片：让转发到微信好友/朋友圈显示成一张名片（标题+描述+头像缩略图），
// 而不是裸链接。需要公众号配置 JS 接口安全域名（card.microeco.net）。
// 签名只走后端（AppSecret 不下发）；整页只 config 一次，jsApiList 一次给齐避免互相覆盖。
const JS_API_LIST = ['updateAppMessageShareData', 'updateTimelineShareData', 'onMenuShareAppMessage', 'onMenuShareTimeline']
const SDK_SRC = 'https://res.wx.qq.com/open/js/jweixin-1.6.0.js'
let sdkPromise = null
let configuredKey = ''

function loadSdk() {
  if (window.wx?.config) return Promise.resolve(window.wx)
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SDK_SRC
    s.onload = () => window.wx ? resolve(window.wx) : reject(new Error('微信 SDK 加载失败'))
    s.onerror = () => reject(new Error('微信 SDK 加载失败'))
    document.head.appendChild(s)
  })
  return sdkPromise
}

// 微信分享缩略图必须是可访问的绝对地址；card 里存的是 /uploads/xxx 相对路径
export function absoluteMediaUrl(p) {
  if (!p) return ''
  if (/^https?:\/\//i.test(p)) return p
  if (p.startsWith('/')) return `${window.location.origin}${p}`
  return ''
}

// opts: { title, desc, link, imgUrl }
// 返回 true=已按名片内容配置好微信分享卡片；false=非微信或配置失败（调用方降级为复制链接）
export async function setupWechatShare(api, opts) {
  if (!isWeChat() || !opts?.link) return false
  const key = `${opts.link}|${opts.title || ''}`
  if (configuredKey === key && window.wx?.config) return true
  try {
    const wx = await loadSdk()
    const signUrl = window.location.href.split('#')[0]
    const { data } = await api.get('/api/auth/wechat/jssdk-sign', { params: { url: signUrl } })
    if (data?.code !== 0 || !data?.data?.signature) return false
    const s = data.data
    return await new Promise(resolve => {
      let done = false
      const finish = ok => { if (!done) { done = true; resolve(ok) } }
      wx.config({
        appId: s.appId, timestamp: s.timestamp, nonceStr: s.nonceStr, signature: s.signature,
        jsApiList: JS_API_LIST, debug: false
      })
      wx.ready(() => {
        const base = {
          title: opts.title || '电子名片',
          desc: opts.desc || '扫一扫，存入通讯录',
          link: opts.link,
          imgUrl: opts.imgUrl || ''
        }
        wx.updateAppMessageShareData?.({ ...base, success: () => finish(true) })
        wx.updateTimelineShareData?.({ title: base.title, link: base.link, imgUrl: base.imgUrl })
        wx.onMenuShareAppMessage?.({ ...base })
        wx.onMenuShareTimeline?.({ title: base.title, link: base.link, imgUrl: base.imgUrl })
        configuredKey = key
        finish(true)
      })
      wx.error(() => finish(false))
      setTimeout(() => finish(false), 3000)
    })
  } catch { return false }
}
