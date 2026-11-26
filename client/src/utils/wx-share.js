import { isWeChat, configWx } from './wx-sdk'
import { sharePools, pick } from '../config/shareConfig'
import { siteConfig } from '../store'
import { loadMyInviteCode, withInvite } from './invite'

// 微信 JS-SDK 分享卡片：让转发到微信好友/朋友圈显示成一张像样的卡片（标题+描述+缩略图）。
// 签名与 config 统一走 wx-sdk.js（一次 config 配齐分享+定位+扫码接口，避免 jsApiList 互相覆盖）。
// 对齐 MShop 的分享池兜底：调用方缺哪样就从对应素材池随机补哪样；路由层再挂一层全局默认分享，
// 避免未接入分享的页面转发出去是裸链接（标题是网址、封面空白）。
// ⚠️ MCard 特有约束：分享链接必须干净（不带 wx_ticket / save 等内部参数），
//    且 /me 系列是登录后的工作台——别人打开会被守卫踢去登录页，一律换成公开集市地址。
export function absoluteMediaUrl(p) {
  if (!p) return ''
  if (/^https?:\/\//i.test(p)) return p
  if (p.startsWith('/')) return `${window.location.origin}${p}`
  return ''
}

// 把分享链接洗成「别人能直接打开」的公开地址：
// 1) 去掉 wx_ticket（一次性登录凭证，随转发泄露会让对方登录成分享者）、save/wxdebug/src 等内部参数；
// 2) /me* 工作台与根路径落到公开集市，避免访客被路由守卫重定向去登录。
export function cleanShareLink(raw) {
  const fallback = `${window.location.origin}/market`
  try {
    const u = new URL(raw || window.location.href, window.location.origin)
    for (const k of ['wx_ticket', 'save', 'wxdebug', 'src']) u.searchParams.delete(k)
    if (/^\/me(\/|$)/.test(u.pathname) || u.pathname === '/') u.pathname = '/market'
    u.hash = ''
    return u.toString()
  } catch { return fallback }
}

// 缩略图只认 JPG / PNG / GIF：微信解析不出 svg / webp 的缩略图，硬传会变成灰块甚至整卡退化成网址。
// 上传链路把头像等栅格图转 webp，会被这里过滤掉并自动落到下一候选，不会报错。
// 公司 LOGO 走 /upload/logo 产出的是 PNG，可被识别；share_image 池也是 PNG/JPG。
// ⚠️ 用户口径：分享缩略图绝不用纯二维码——优先级 公司LOGO → 用户头像 → 服务端名片图 → 项目LOGO → 分享池。
//    服务端名片图必须排在项目LOGO之前：头像/LOGO 若是 webp 被滤掉后，旧顺序会让项目LOGO抢先命中，
//    用户明明有头像却转发成项目LOGO（2026-11-26 实锤）；名片图内含本人头像，是正确兜底。
function cardImage(u) {
  const abs = absoluteMediaUrl(u)
  return /\.(jpe?g|png|gif)(\?|$)/i.test(abs) ? abs : ''
}

function setMeta(attr, key, val) {
  if (!val) return
  let el = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', val)
}

// og / itemprop meta 与 wx 无关，任何环境都同步：微信不认 JS-SDK 或未签名成功时按 DOM 抓取兜底。
export function setShareMeta({ title, desc, img } = {}) {
  if (typeof document === 'undefined') return
  const image = cardImage(img)
  setMeta('property', 'og:title', title || '')
  setMeta('itemprop', 'name', title || '')
  setMeta('property', 'og:description', desc || '')
  setMeta('itemprop', 'description', desc || '')
  setMeta('name', 'description', desc || '')
  if (image) {
    setMeta('property', 'og:image', image)
    setMeta('itemprop', 'image', image)
  }
}

let configuredKey = ''
// 已 config 成功的 wx 实例：缓存只用来跳过重复签名请求，不用来跳过「重设分享数据」。
let configuredWx = null
// 本路由内是否已由页面显式配置过卡片：全局兜底看到标记就跳过，避免覆盖名片页刚设好的卡片。
let customShareSet = false

/** 标记本路由已有自定义分享卡片（页面自行配置并调用 setWechatShare 时自动置位） */
export function markShareSet() { customShareSet = true }

/**
 * 设置当前页面转发卡片。opts: { title, desc, link, imgUrl, imgCandidates }
 * 缺任一项（含空串）就从素材池随机补；link 统一洗成干净公开地址。
 * imgCandidates = 有序候选图（如名片 LOGO→头像），逐个取第一个微信可解析的；
 *   全都不合格才落到分享池。cardImage 会滤掉 svg/webp，避免转发卡变灰块。
 * @returns {Promise<boolean>} 是否配置成功（非微信或签名失败返回 false，但 meta 已同步）
 */
export async function setupWechatShare(api, opts = {}, { fromDefault = false } = {}) {
  if (!fromDefault) customShareSet = true
  // 全面邀请：先拿当前用户邀请码（推广员才有），再算最终分享链接；首次调用也能带码。
  // 失败/非推广员返回空码，分享照常进行。
  let inviteCode = ''
  try { inviteCode = await loadMyInviteCode() } catch { inviteCode = '' }
  const pools = sharePools()
  const title = opts.title || pick(pools.titles)
  const desc = opts.desc || pick(pools.descs)
  const candidates = Array.isArray(opts.imgCandidates) ? opts.imgCandidates : [opts.imgUrl]
  const imgUrl = candidates.map(cardImage).find(Boolean) || pick(pools.images)
  const link = cleanShareLink(withInvite(opts.link, inviteCode))
  setShareMeta({ title, desc, img: imgUrl })
  if (!isWeChat()) return false
  const key = `${window.location.href.split('#')[0]}|${link}|${title || ''}|${imgUrl}`
  const card = {
    title: title || document.title || 'MCard 电子名片',
    desc: desc || '',
    link,
    imgUrl: cardImage(imgUrl) || ''
  }
  const apply = wx => {
    if (!wx?.config) return
    wx.updateAppMessageShareData?.(card)
    wx.updateTimelineShareData?.({ title: card.title, link: card.link, imgUrl: card.imgUrl })
    // 老接口也设一遍：新接口在部分机型「回调 ok、转发出去仍是网址」，老接口反而生效
    wx.onMenuShareAppMessage?.(card)
    wx.onMenuShareTimeline?.({ title: card.title, link: card.link, imgUrl: card.imgUrl })
  }
  try {
    // 缓存命中：签名已完成，不再重复请求，但仍要重设一次分享数据
    if (configuredKey === key && configuredWx?.config) {
      apply(configuredWx)
      setTimeout(() => apply(configuredWx), 300)
      return true
    }
    const { wx, ok } = await configWx(api)
    if (!ok || !wx?.config) return false
    apply(wx)
    // 容错：微信权限离线校验窗口，分档重设直到生效
    setTimeout(() => apply(wx), 300)
    setTimeout(() => apply(wx), 900)
    setTimeout(() => apply(wx), 1800)
    configuredKey = key
    configuredWx = wx
    return true
  } catch { return false }
}

// 兼容旧调用名（部分页面仍直接 import setWechatShare）
export const setWechatShare = setupWechatShare

/**
 * 名片分享卡片唯一真相源：/c/:slug 公开页与 /me 工作台共用同一口径。
 * 标题「XXX的名片」；描述首选简介（存量 company_intro 回落，空则落分享池）；
 * 缩略图口径（用户定稿 2026-11-26 修正）：公司 LOGO → 用户头像 → 服务端名片卡片图 → 项目 LOGO → 分享池。
 * 绝不用「纯二维码」当缩略图；但名片卡片图（头像+姓名+公司，含作为名片一部分的小二维码）是用户认可的兜底。
 * ⚠️ 服务端名片卡片图必须排在项目 LOGO 之前：头像/LOGO 常为 webp 会被 cardImage 过滤，
 *    旧顺序会让项目 LOGO 抢先命中，用户明明上传了头像却转发成项目 LOGO。
 * 服务端 share.png 是公开接口（无需登录、webp 头像也能内联渲染），任何调用点都能传，
 * 不传则由本函数按 card.slug 兜底推导，避免工作台/侧栏分享漏传时退到项目 LOGO。
 * 工作台必须自己配置，不能只靠异步嵌入的 CardView——否则加载慢时转发走全局兜底。
 */
export function setCardShare(api, card, link, shareImage) {
  const target = link || card?.url || ''
  const title = `${card?.name || card?.name_en || '名片'}的名片`
  // 微信转发面板顶部显示的是 document.title，必须与分享卡片标题一致为「某某的名片」，
  // 否则即使 JS-SDK 标题配对了，面板顶部仍是站点默认标题「MCard 电子名片」。
  if (typeof document !== 'undefined' && document.title !== title) document.title = title
  // 服务端名片图兜底：调用方未显式传时按 slug 推导公开地址（动态域名，不写死）。
  const cardShot = shareImage || (card?.slug ? `/api/cards/public/${encodeURIComponent(card.slug)}/share.png` : '')
  return setupWechatShare(api, {
    title,
    desc: String(card?.bio || card?.company_intro || '').slice(0, 120),
    link: target,
    // 公司 LOGO → 名片头像 → 服务端名片图（含本人头像）→ 项目 LOGO → 分享池。
    // 前几档若是 webp 会被 cardImage 过滤并自动落到下一档；全都不合格才由 setupWechatShare 落 share_image。
    imgCandidates: [
      absoluteMediaUrl(card?.logo),
      absoluteMediaUrl(card?.avatar),
      absoluteMediaUrl(cardShot),
      absoluteMediaUrl(siteConfig.site_logo)
    ]
  })
}

// ── 全局默认分享兜底 ──────────────────────────────────────────────
// 页面未显式配置卡片时，路由切换 900ms 后用素材池随机配一张默认卡片：
// link 走 cleanShareLink（干净 + /me 落公开集市），保证任何页面转发出去都能被访客直接打开。
let defaultShareTimer = null
export function scheduleDefaultShare(api) {
  customShareSet = false
  if (defaultShareTimer) clearTimeout(defaultShareTimer)
  defaultShareTimer = setTimeout(() => {
    defaultShareTimer = null
    if (customShareSet) return
    setupWechatShare(api, {}, { fromDefault: true }).catch(() => { /* 兜底失败保持微信默认行为 */ })
  }, 900)
}
