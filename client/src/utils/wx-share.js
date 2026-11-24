import { isWeChat, configWx } from './wx-sdk'

// 微信 JS-SDK 分享卡片：让转发到微信好友/朋友圈显示成一张名片（标题+描述+头像缩略图）。
// 签名与 config 统一走 wx-sdk.js（一次 config 配齐分享+定位接口，避免 jsApiList 互相覆盖）。
// 返回 true=已按名片内容配置好分享卡片；false=非微信或配置失败（调用方降级为复制链接）。
let configuredKey = ''

export function absoluteMediaUrl(p) {
  if (!p) return ''
  if (/^https?:\/\//i.test(p)) return p
  if (p.startsWith('/')) return `${window.location.origin}${p}`
  return ''
}

// opts: { title, desc, link, imgUrl }
export async function setupWechatShare(api, opts) {
  if (!isWeChat() || !opts?.link) return false
  const key = `${opts.link}|${opts.title || ''}`
  if (configuredKey === key && window.wx?.config) return true
  try {
    const { wx, ok } = await configWx(api)
    if (!ok || !wx?.config) return false
    // wx.ready 已由 configWx 等待；这里直接配置分享数据，并做一次短容错重试（权限异步校验窗口）
    const base = {
      title: opts.title || '电子名片',
      desc: opts.desc || '扫一扫，存入通讯录',
      link: opts.link,
      imgUrl: opts.imgUrl || ''
    }
    let applied = false
    const apply = () => {
      if (applied) return
      applied = true
      wx.updateAppMessageShareData?.({ ...base, success: () => { applied = true } })
      wx.updateTimelineShareData?.({ title: base.title, link: base.link, imgUrl: base.imgUrl })
      wx.onMenuShareAppMessage?.({ ...base })
      wx.onMenuShareTimeline?.({ title: base.title, link: base.link, imgUrl: base.imgUrl })
      configuredKey = key
    }
    apply()
    // 容错：若首次落在微信权限离线校验窗口，300ms 后重试一次（configWx 已配好，重试只重设分享数据）
    setTimeout(apply, 300)
    return true
  } catch { return false }
}
