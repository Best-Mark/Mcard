const express = require('express')
const db = require('../db')
const { originOf, requestUrl } = require('../utils/origin')
const { ok, fail, wrap } = require('../utils/response')
const { authRequired, parseToken } = require('../utils/auth')
const { makeSlug, normalizeSlug } = require('../utils/slug')
const qr = require('../services/qrcode')
const { inspectPayQr, readPayQr, safePayLink } = require('../services/payQr')
const { normalizeStyle } = qr
const vcard = require('../services/vcard')
const { CARD_TEMPLATES, isTemplate, DEFAULT_TEMPLATE } = require('../utils/cardTemplates')
const { INDUSTRIES, CITIES, HOT_CITIES, cityCoords, isIndustry, normalizeIndustry, distanceKm } = require('../utils/market')
const { MATERIAL_TYPES, VISIT_SOURCES, isMaterialType, isVisitSource, CARD_WATCH_FIELDS, NOTIFY_TYPES } = require('../utils/constants')
const { DOT_STYLES, EYE_STYLES, QR_PRESETS, QR_COLORS } = require('../utils/qrStyles')
const { tokenize: tokenizeQuery, score: relevanceScore } = require('../utils/search')
const settings = require('../utils/settings')
const notify = require('../services/notify')

const router = express.Router()

// 二维码中心图三级回落（唯一真相源）：名片 LOGO(cards.logo) > 名片头像(cards.avatar) > 默认 brand 文字。
// ⚠️ SVG 以 <img> 加载时浏览器禁止引用任何外部资源，必须内联成 dataURL；复用 utils/inlineImage 的
// 超时/类型/大小/缓存逻辑（与打印、分享缩略图同一份真相源）。内部调用允许存量外链头像（仍拒绝内网/本机）。
const { inlineImage } = require('../utils/inlineImage')

// 名片头像 avatar 归名片层（cards 表），与账户头像 users.avatar 独立；编辑页在这里维护。
const EDITABLE = ['name', 'name_en', 'title', 'company', 'company_intro', 'department', 'avatar', 'phone', 'mobile', 'email',
  'wechat', 'alipay', 'whatsapp', 'wechat_qr', 'alipay_qr', 'wechat_pay_qr', 'alipay_pay_qr',
  'address', 'address_detail', 'province', 'city', 'district', 'street',
  'website', 'shop_url', 'cover', 'logo', 'bio',
  'tags', 'links', 'template', 'industry', 'latitude', 'longitude', 'market_opt_in',
  'theme', 'accent', 'qr_fg', 'qr_bg', 'qr_logo', 'qr_style']

const parseJson = (v, fallback) => { try { const x = JSON.parse(v); return x ?? fallback } catch { return fallback } }
const isColor = v => /^#[0-9a-fA-F]{6}$/.test(String(v || ''))

// 套餐是否有效：与 publicView 的 active 同口径（status='active' 且 expires_at 为空或未过期）。
// 唯一真相源：套餐只作为两个功能的硬闸门——配色方案、上架集市；其它能力不受限。
function cardPlanActive(row) {
  if (!row || row.status !== 'active') return false
  if (!row.expires_at) return true
  return new Date(String(row.expires_at).replace(' ', 'T') + 'Z') >= new Date()
}
// 需要有效套餐才能修改的字段：配色方案 + 上架集市。
const PLAN_GATED_FIELDS = ['template', 'theme', 'accent', 'qr_fg', 'qr_bg', 'qr_logo', 'qr_style', 'market_opt_in']
const PLAN_GATE_MSG = '配色方案与上架集市需要开通套餐，请先开通或续期'

// 访客来源：优先显式 query.src（分享/集市链接携带，不改二维码本身），再按 referer 兜底推断。
// 二维码内容恒为 /c/{slug}（微信可扫），扫码进入的 src 由前端在 hash/首次跳转时补，兜底记 direct。
function detectSource(req) {
  const explicit = String(req.query.src || '').toLowerCase()
  if (isVisitSource(explicit)) return explicit
  const ref = String(req.headers.referer || '')
  if (/market|集市/i.test(ref)) return 'market'
  if (/share|forward/i.test(ref)) return 'share'
  if (/baidu|google|bing|sogou|so\.com|360/i.test(ref)) return 'search'
  return 'direct'
}
// 城市兜底：card_views.city 目前由前端上报（见 POST /public/:slug/trace），这里仅预留空值。

function materialView(r) {
  return {
    id: r.id, type: isMaterialType(r.type) ? r.type : 'link',
    title: r.title || '', url: r.url || '', sort: r.sort || 0,
    views: r.views || 0, createdAt: r.created_at
  }
}

function publicView(row, origin) {
  return {
    slug: row.slug,
    url: `${origin}/c/${row.slug}`,
    name: row.name, name_en: row.name_en, title: row.title, company: row.company,
    company_intro: row.company_intro || '',
    department: row.department, phone: row.phone, mobile: row.mobile, email: row.email,
    wechat: row.wechat, alipay: row.alipay, whatsapp: row.whatsapp,
    wechat_qr: row.wechat_qr, alipay_qr: row.alipay_qr,
    wechat_pay_qr: row.wechat_pay_qr, alipay_pay_qr: row.alipay_pay_qr,
    // 收款码图内解码出的付款链接（派生列）：与收款码图同级公开（本就是付款入口），
    // 扫合一码落地页按支付环境拿它直接调起支付
    wechat_pay_link: row.wechat_pay_link || '', alipay_pay_link: row.alipay_pay_link || '',
    address: row.address, address_detail: row.address_detail,
    province: row.province || '', city: row.city || '', district: row.district || '', street: row.street || '',
    website: row.website, shop_url: row.shop_url,
    avatar: row.avatar, cover: row.cover, logo: row.logo, bio: row.bio,
    tags: parseJson(row.tags, []), links: parseJson(row.links, []),
    template: isTemplate(row.template) ? row.template : DEFAULT_TEMPLATE,
    industry: normalizeIndustry(row.industry),
    industryLabel: INDUSTRIES.find(i => i.key === row.industry)?.label || '',
    latitude: row.latitude ?? null, longitude: row.longitude ?? null, market_opt_in: !!row.market_opt_in,
    theme: row.theme, accent: row.accent, qr_fg: row.qr_fg, qr_bg: row.qr_bg, qr_logo: !!row.qr_logo,
    qr_style: normalizeStyle(parseJson(row.qr_style, {})),
    active: cardPlanActive(row),
    expiresAt: row.expires_at, views: row.views
  }
}

function ownerView(row, origin) {
  return { ...publicView(row, origin), id: row.id, status: row.status, createdAt: row.created_at }
}

// 距离兜底：坐标与地址文本城市明显不符时（历史 bug：编辑页改了省市但坐标没随存，
// 仍是旧的错误坐标，导致「两个都写郑州、距离却差 600km」），退回用城市中心算距离。
// 只在「声明了城市 + 城市有中心坐标 + 名片坐标离该中心 > 150km」时触发，避免误伤郊区/相邻市选点。
const MAX_CITY_COORD_GAP_KM = 150
function effectiveCardCoord(row) {
  if (row.latitude == null || row.longitude == null) return null
  const city = String(row.city || '').trim()
  if (!city) return { lat: row.latitude, lng: row.longitude }
  const center = cityCoords(city)
  if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return { lat: row.latitude, lng: row.longitude }
  const gap = distanceKm(center.lat, center.lng, row.latitude, row.longitude)
  if (gap > MAX_CITY_COORD_GAP_KM) return { lat: center.lat, lng: center.lng } // 错配坐标 → 用城市中心兜底
  return { lat: row.latitude, lng: row.longitude }
}

// 集市卡片视图：只暴露发现业务对口所需的最小信息，绝不外泄电话/邮箱/微信/收款码等私密字段
function marketView(row, originLat, originLng, origin) {
  let distance = null
  const coord = effectiveCardCoord(row)
  if (originLat != null && originLng != null && coord) {
    distance = Math.round(distanceKm(originLat, originLng, coord.lat, coord.lng) * 10) / 10
  }
  const industry = INDUSTRIES.find(i => i.key === row.industry)
  return {
    slug: row.slug,
    url: `${origin}/c/${row.slug}`,
    name: row.name, name_en: row.name_en, title: row.title, company: row.company,
    industry: normalizeIndustry(row.industry), industryLabel: industry?.label || '',
    province: row.province || '', city: row.city || '', district: row.district || '', distanceKm: distance,
    avatar: row.avatar, logo: row.logo, cover: row.cover,
    // 简介统一字段名 bio：存量只填过 company_intro 的老名片回落到 bio，前端只认一个字段。
    tags: parseJson(row.tags, []), bio: row.bio || row.company_intro || '', views: row.views || 0,
    template: isTemplate(row.template) ? row.template : DEFAULT_TEMPLATE, theme: row.theme, accent: row.accent
  }
}

// 布局模板清单（编辑器从此处拉取，避免各端硬编码 key）——必须放在 /public/:slug 之前
// 清单虽为静态数据，但会随发版变化；缓存过长会导致上线后仍读到旧清单，故 60 秒 + must-revalidate
router.get('/public/templates', wrap((req, res) => {
  res.set('Cache-Control', 'public, max-age=60, must-revalidate')
  ok(res, { templates: CARD_TEMPLATES })
}))

// 图片内联（打印名片/分享缩略图用）：服务端拉取 OSS 图片转 dataURL，绕开浏览器 CORS。
// 匿名可用（公开名片页也要生成分享图），但只允许本站 uploads 与已配置 OSS 域名，杜绝 SSRF。
router.get('/public/inline-image', wrap(async (req, res) => {
  const url = String(req.query.url || '').trim().slice(0, 2000)
  const data = await inlineImage(url)
  res.set('Cache-Control', data ? 'private, max-age=300' : 'no-store')
  ok(res, { data })
}))

// 资料夹类型 + 访客来源 + 二维码样式清单（前端编辑器/统计页/两端二维码选项唯一真相源，不各自硬编码）
router.get('/public/meta', wrap((req, res) => {
  res.set('Cache-Control', 'public, max-age=3600')
  ok(res, { materialTypes: MATERIAL_TYPES, sources: VISIT_SOURCES, qrDotStyles: DOT_STYLES, qrEyeStyles: EYE_STYLES, qrPresets: QR_PRESETS, qrColors: QR_COLORS })
}))

// 名片集市元数据（行业清单 + 内置城市坐标）——固定路径，必须在 /public/:slug 之前
router.get('/public/market/meta', wrap((req, res) => {
  res.set('Cache-Control', 'public, max-age=3600')
  ok(res, { industries: INDUSTRIES, cities: CITIES, hotCities: HOT_CITIES })
}))

// 名片集市：按距离发现附近、行业对口、关键词命中的上架名片
// 只返回 market_opt_in=1 且 active 且未过期的名片；隐私字段一律不返回
router.get('/public/market', wrap((req, res) => {
  const industry = String(req.query.industry || '').slice(0, 40)
  const q = String(req.query.q || '').trim().slice(0, 60)
  const city = String(req.query.city || '').trim().slice(0, 30)
  const province = String(req.query.province || '').trim().slice(0, 30)
  const district = String(req.query.district || '').trim().slice(0, 30)
  const limit = Math.min(60, Math.max(1, Number(req.query.limit) || 30))
  // 距离范围（公里）：0/空=不限；上限 2000km（全国）
  const radiusRaw = Number(req.query.radiusKm)
  const radiusKm = Number.isFinite(radiusRaw) && radiusRaw > 0 ? Math.min(2000, radiusRaw) : 0
  // 排序：distance=距离近优先（默认，有原点时）；views=浏览量优先
  const sort = String(req.query.sort || '') === 'views' ? 'views' : 'distance'

  // 定位原点：优先精确经纬度（地图拖拽选点），否则用城市名匹配内置坐标
  let originLat = null, originLng = null
  const la = Number(req.query.lat), ln = Number(req.query.lng)
  if (Number.isFinite(la) && Number.isFinite(ln) && Math.abs(la) <= 90 && Math.abs(ln) <= 180) {
    originLat = la; originLng = ln
  } else if (city) {
    const hit = cityCoords(city)
    if (hit) { originLat = hit.lat; originLng = hit.lng }
  }

  let rows = db.prepare("SELECT * FROM cards WHERE market_opt_in = 1 AND status = 'active'").all()
  const now = new Date()
  rows = rows.filter(r => !r.expires_at || new Date(String(r.expires_at).replace(' ', 'T') + 'Z') >= now)
  if (industry && isIndustry(industry)) rows = rows.filter(r => normalizeIndustry(r.industry) === industry)
  if (province) rows = rows.filter(r => (r.province || '').includes(province))
  if (city) rows = rows.filter(r => (r.city || '').includes(city))
  if (district) rows = rows.filter(r => (r.district || '').includes(district))
  // 智能分词：整句命中权重最高，拆词命中任一即入选，命中越多越靠前（不再要求整句连续出现）
  const tokens = q ? tokenizeQuery(q) : []
  const relevance = new Map()
  if (tokens.length) {
    rows = rows.filter(r => {
      const hay = [r.name, r.name_en, r.title, r.company, r.bio, r.company_intro, r.city, r.tags, r.industry]
        .filter(Boolean).join(' ')
      const s = relevanceScore(q, tokens, hay)
      if (s > 0) { relevance.set(r.id, s); return true }
      return false
    })
  }
  const origin = originOf(req)
  let list = rows.map(r => ({ ...marketView(r, originLat, originLng, origin), _rel: relevance.get(r.id) || 0 }))
  // 距离范围内筛选：只在设了原点且 radiusKm>0 时生效；无坐标的名片不在范围内
  if (radiusKm > 0 && originLat != null) {
    list = list.filter(x => x.distanceKm != null && x.distanceKm <= radiusKm)
  }
  // 排序：有搜索词时先按相关度（多词命中/整句命中靠前），同分再按用户选的距离/热度
  list.sort((a, b) => {
    if (tokens.length && a._rel !== b._rel) return b._rel - a._rel
    if (sort === 'distance' && originLat != null) {
      if (a.distanceKm == null && b.distanceKm != null) return 1
      if (a.distanceKm != null && b.distanceKm == null) return -1
      if (a.distanceKm != b.distanceKm) return a.distanceKm - b.distanceKm
    }
    return b.views - a.views
  })
  const page = list.slice(0, limit).map(({ _rel, ...item }) => item)
  ok(res, { list: page, total: list.length, origin: originLat != null ? { lat: originLat, lng: originLng } : null, radiusKm, sort, q, tokens })
}))

// 任意文本转二维码（小程序支付码等场景使用）——必须放在 /public/:slug 之前
router.get('/public/qr.png', wrap(async (req, res) => {
  const text = String(req.query.text || '').slice(0, 500)
  if (!text) return fail(res, 400, '缺少二维码内容')
  const size = Math.min(1200, Math.max(128, Number(req.query.size) || 440))
  const buf = await qr.png(text, { size })
  res.type('png').set('Cache-Control', 'public, max-age=300').send(buf)
}))

// ---------- 公开读取（二维码永远指向这里，资料可改而链接不变） ----------
router.get('/public/:slug', wrap((req, res) => {
  const row = db.prepare('SELECT * FROM cards WHERE slug = ?').get(req.params.slug)
  if (!row) return fail(res, 404, '名片不存在')
  const payload = parseToken(req)
  const isOwner = payload && payload.id === row.user_id
  if (!isOwner) {
    const source = detectSource(req)
    db.prepare('INSERT INTO card_views (card_id, ip, ua, referer, source) VALUES (?,?,?,?,?)')
      .run(row.id, req.ip || '', String(req.headers['user-agent'] || '').slice(0, 300), String(req.headers.referer || '').slice(0, 500), source)
    db.prepare('UPDATE cards SET views = views + 1 WHERE id = ?').run(row.id)
    row.views += 1
    // 「XXX查看了我的名片」：仅登录访客可识别身份，匿名浏览不打扰；notify 内部做 24h 去重
    if (payload?.id) {
      const viewer = db.prepare('SELECT id, nickname, phone FROM users WHERE id = ?').get(payload.id)
      try { notify.notifyViewed(row, viewer) } catch { /* 通知失败不影响名片读取 */ }
    }
  }
  // 宣传页挂钩（2026-11-27 一对多定稿）：关联状态在宣传页侧显式开关（card_linked，防名片侧指定变乱），
  // 已发布且已关联的宣传页全部随名片下发（按更新时间排列，上限 6），名片公开页列出多条入口；
  // 取消关联/下架/删除入口自动消失。反向已有：宣传页尾页名片卡带二维码跳回名片——双向转化。
  const promos = db.prepare("SELECT slug, title FROM h5_pages WHERE user_id = ? AND status = 'published' AND card_linked = 1 ORDER BY updated_at DESC LIMIT 6").all(row.user_id)
  ok(res, { ...publicView(row, originOf(req)), promos })
}))

// 码渲染统一参数。
// 【2026-11-27 用户定稿（推翻 11-26「视觉与设置一致」终稿）：识别率第一】
// 二维码以标准识别码为基底再做美化，凡影响微信本地检测的一律去掉：
// 码点/码眼白名单收敛到标准方点（qrStyles.js）、中心 LOGO 渲染整体移除、渐变/背景图已下线；
// 保留的美化 = 码色（深码浅底成对）。弹层大码/保存一律 plain=1 纯标准码。
// 只保留静音区 4（QR 规范要求，苹果相机/微信扫一扫对静音区不足敏感，不影响观感）。
function scanOptions({ fg, bg, style }) {
  return {
    fg: fg || '#0f172a',
    bg: bg || '#ffffff',
    margin: 4,
    style: normalizeStyle(style)
  }
}

// 二维码中心品牌字（唯一真相源 = settings.qr_brand，后台「二维码水印」）：query 可覆盖（编辑页预览）。
// 【2026-11-26 修复】该设置此前只存不下发、从未被渲染读取（死配置），现接入全部二维码渲染端点。
// 中心 LOGO 位已整体移除（2026-11-27 识别率第一定稿）；qr_brand 后台设置保留但不参与码渲染。
router.get('/public/:slug/qr.svg', wrap(async (req, res) => {
  const row = db.prepare('SELECT slug, qr_fg, qr_bg, qr_logo, qr_style, logo, avatar FROM cards WHERE slug = ?').get(req.params.slug)
  if (!row) return fail(res, 404, '名片不存在')
  const size = Math.min(2000, Math.max(64, Number(req.query.size) || 360))
  // query 覆盖 DB：编辑页保存前实时预览用；公开访问不带 query 则用 DB 值
  const fg = /^#[0-9a-fA-F]{6}$/.test(req.query.fg || '') ? req.query.fg : row.qr_fg
  const bg = /^#[0-9a-fA-F]{6}$/.test(req.query.bg || '') ? req.query.bg : row.qr_bg
  let style = normalizeStyle(parseJson(row.qr_style, {}))
  if (req.query.style) { try { style = normalizeStyle(JSON.parse(String(req.query.style).slice(0, 4000))) } catch {} }
  let opts = { size, fg, bg, style }
  const isScan = String(req.query.scan || '') === '1'
  if (isScan) opts = { ...opts, ...scanOptions({ fg, bg, style }) }
  // 扫码主场景只缓存 60s：渲染逻辑升级后最多 1 分钟即可全网生效，
  // 不再像以前 max-age=3600 卡一小时旧码。装饰码仍在编辑预览里高频改色，走长缓存无意义但也无害。
  res.type('image/svg+xml').set('Cache-Control', isScan ? 'public, max-age=60' : 'public, max-age=3600')
    .send(qr.svg(requestUrl(req, `/c/${row.slug}`), opts))
}))

router.get('/public/:slug/qr.png', wrap(async (req, res) => {
  const row = db.prepare('SELECT slug, qr_fg, qr_bg, qr_logo, qr_style, logo, avatar FROM cards WHERE slug = ?').get(req.params.slug)
  if (!row) return fail(res, 404, '名片不存在')
  const size = Math.min(2000, Math.max(128, Number(req.query.size) || 720))
  // plain=1：纯黑白标准识别码（弹层大码/保存一律用它，保证微信长按识别）
  if (String(req.query.plain || '') === '1') {
    const buf = await qr.plainPng(requestUrl(req, `/c/${row.slug}`), { size })
    return res.type('png').set('Cache-Control', 'public, max-age=60').send(buf)
  }
  const style = normalizeStyle(parseJson(row.qr_style, {}))
  let opts = { size, fg: row.qr_fg, bg: row.qr_bg, style }
  const isScan = String(req.query.scan || '') === '1'
  if (isScan) opts = { ...opts, ...scanOptions({ fg: row.qr_fg, bg: row.qr_bg, style }) }
  const buf = await qr.png(requestUrl(req, `/c/${row.slug}`), opts)
  res.type('png').set('Cache-Control', isScan ? 'public, max-age=60' : 'public, max-age=3600').send(buf)
}))

// 名片分享缩略图（公开、无需登录）：按名片页顶部「身份卡区域」重绘的 600×600 PNG
// （头像在左 + 姓名/职位/公司/标签 + 右上角本人美化码）。微信转发/og:image 直接用这个公开 URL。
// 配色 query（bg/fg/mu/ac）由前端 themeOf 下发（唯一真相源），服务端只做 hex 白名单校验；
// 非法/缺省静默回落深色主题，绝不让坏参数拖垮分享图。缓存按配色分键，换肤后自动出新图。
router.get('/public/:slug/share.png', wrap(async (req, res) => {
  const row = db.prepare('SELECT * FROM cards WHERE slug = ?').get(req.params.slug)
  if (!row) return fail(res, 404, '名片不存在')
  const origin = originOf(req)
  const palette = { bg: req.query.bg, fg: req.query.fg, mu: req.query.mu, ac: req.query.ac }
  const buf = await require('../utils/shareCard').buildSharePng(publicView(row, origin), `${origin}/c/${row.slug}`, palette)
  res.type('png').set('Cache-Control', 'public, max-age=600').send(buf)
}))

// vCard 文本（唯一真相源仍是 services/vcard.build；2026-11-27 起二维码不再用 vCard 文本，
// 微信扫一扫不解析。此端点保留给第三方工具/系统相机本地生成 vCard 码、以及存量调用兼容）
router.get('/public/:slug/vcard.txt', wrap((req, res) => {
  const row = db.prepare('SELECT * FROM cards WHERE slug = ?').get(req.params.slug)
  if (!row) return fail(res, 404, '名片不存在')
  const origin = originOf(req)
  res.type('text/plain; charset=utf-8').send(vcard.build(publicView(row, origin), origin))
}))

// 联系人码（2026-11-27 微信真机实测定稿，推翻 11-26「vCard 文本码」口径）：
// 微信扫一扫**不解析 vCard**，扫 BEGIN:VCARD 纯文本只显示「微信暂不支持展示二维码中的文本内容」
// 黑屏（只有 iOS/系统相机能弹「添加到通讯录」）。因此联系人码改为「名片页 URL + contact=1」——
// 微信扫一扫 100% 打开 H5 名片页，页面自动弹「存入通讯录」入口（微信内引导去浏览器，与 dock 同口径）。
// 端点名 vcard.svg/png 保留：存量 H5/小程序弹层与保存码无需改 URL 即自动受益；
// 完整 vCard 仍由 card.vcf 下载 / vcard.txt 文本提供（不走二维码）。
// 码点/码眼/配色沿用 scanOptions（标准方点 + 深码浅底），plain=1 为纯黑白标准码。
// 缓存只给 60s（渲染逻辑升级可快速全网生效），前端另带 qv 击穿缓存。
const contactQrText = req => requestUrl(req, `/c/${req.params.slug}?contact=1`)

router.get('/public/:slug/vcard.svg', wrap(async (req, res) => {
  const row = db.prepare('SELECT slug, qr_fg, qr_bg, qr_style FROM cards WHERE slug = ?').get(req.params.slug)
  if (!row) return fail(res, 404, '名片不存在')
  const size = Math.min(2000, Math.max(256, Number(req.query.size) || 520))
  const style = normalizeStyle(parseJson(row.qr_style, {}))
  res.type('image/svg+xml').set('Cache-Control', 'public, max-age=60')
    .send(qr.svg(contactQrText(req), { size, ...scanOptions({ fg: row.qr_fg, bg: row.qr_bg, style }) }))
}))

// 联系人码高清 PNG（保存用）：与 vcard.svg 同内容；前端长按/保存一律用 PNG（微信不认 SVG）
router.get('/public/:slug/vcard.png', wrap(async (req, res) => {
  const row = db.prepare('SELECT slug, qr_fg, qr_bg, qr_style FROM cards WHERE slug = ?').get(req.params.slug)
  if (!row) return fail(res, 404, '名片不存在')
  const size = Math.min(1600, Math.max(256, Number(req.query.size) || 720))
  const text = contactQrText(req)
  // plain=1：纯黑白标准码（弹层两个 tab 都用它，保证长按识别）
  if (String(req.query.plain || '') === '1') {
    const buf = await qr.plainPng(text, { size })
    return res.type('png').set('Cache-Control', 'public, max-age=60').send(buf)
  }
  const style = normalizeStyle(parseJson(row.qr_style, {}))
  const buf = await qr.png(text, { size, ...scanOptions({ fg: row.qr_fg, bg: row.qr_bg, style }) })
  res.type('png').set('Cache-Control', 'public, max-age=60').send(buf)
}))

// 合一收款码（2026-11-28 聚合支付网关定稿「二码合一」）：一张码 = 本网关 URL。
// 付款方用微信 / 支付宝 / 相机扫这张码都落到同一个地址，服务端按扫码 App 的 UA 分流
// （业界合并收款码标准做法 = 一张 URL 码 + 落地分流，见 /public/:slug/pay 网关端点）。
// 识别率第一：恒 plain 纯黑白标准码，不做美化。
const payQrText = req => requestUrl(req, `/api/cards/public/${req.params.slug}/pay`)

// —— 聚合支付网关（GET /public/:slug/pay，2026-11-28 二码合一）——
// 一张收款码通吃微信 / 支付宝：付款方用什么 App 扫，服务端按 UA 分流到最短付款路径，复杂度全在服务端：
//   支付宝(AlipayClient) → 302 直跳解码出的支付宝付款链接（qr.alipay.com / alipays://），直接唤起收银台，
//     零中间页零感知（scheme 链接部分容器不认 302 Location 的非 http 跳转，改走极简跳转页 + 兜底按钮）；
//   微信(MicroMessenger) → 微信内置浏览器拦 wxp:// 等 scheme 跳转（真机实锤「点了也没唤起」），
//     落地即出干净微信收款码（pay-link.png 重渲染纯黑白码，1:1 像素渲染下长按必出「识别图中二维码」）长按直付——
//     微信内个人收款最短路径；
//   其他（相机 / QQ / 浏览器）→ 轻量选择页：打开支付宝按钮 + 微信码长按。
// 付款链接来自上传收款码图内解码（safePayLink 白名单过滤），用户不填任何商户号。
// ⚠️ 分流结果随 UA 变化，响应恒 Cache-Control: no-store——CDN / 浏览器绝不能按 URL 缓存本页，
// 否则支付宝可能收到微信版页面（串页）。
const escHtml = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
// 注入 <script> 的字符串：除 JSON 转义外必须再把 < 转 \u003c，防链接里藏 </script> 破壳
const jsStr = s => JSON.stringify(String(s || '')).replace(/</g, '\\u003c')
// 注入「双引号 HTML 属性」里的 JS 字符串：必须用单引号串——JSON.stringify 的双引号会把
// onerror="..." 属性提前截断（2026-11-28 线上实锤：回落代码整段失效）
const jsAttr = s => `'${String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/</g, '\\u003c').replace(/\r?\n/g, '\\n')}'`
// v= 内容指纹击穿缓存：换码后不留旧码（与 CardView 弹层 linkBust 同口径）
const bust = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) }
// 码图卡：白底圆角只做外层装饰，绝不裁剪码图本身（圆角会啃静音区/定位角，本地 QR 检测直接废）。
// 码图固定 264px 整数 CSS 宽：264×DPR 在常见 DPR（2/2.25/2.625/3/3.5）恒为整数物理像素，
// 配合 PAY_HIDPI 取 1:1 源图 → 浏览器零重采样、码点细缝不糊——微信长按「识别图中二维码」的生命线
// （2026-11-28 真机实锤：72vw 分数像素 + 固定 720 源图被重采样糊掉后，长按菜单只剩转发/收藏/保存）。
const codeImg = (src, alt, fb) => `<div class="code"><img class="code-img" src="${escHtml(src)}" alt="${escHtml(alt)}"${fb || ''}></div>`
// 按设备 DPR 请求 1:1 尺寸码图（CardView 弹层大码 264px×528/792 同款解法，真机长按识别 100%）
const PAY_HIDPI = `<script>(function(){var d=Math.min(1600,Math.max(256,Math.round(264*(window.devicePixelRatio||2))));var a=document.querySelectorAll('img.code-img');for(var i=0;i<a.length;i++){if(!/[?&]size=\\d+/.test(a[i].src))continue;a[i].src=a[i].src.replace(/([?&]size=)\\d+/,'$1'+d);}})();</script>`
// 微信内成熟付款路径（2026-11-28 真机定稿）：网页 img 长按的「识别图中二维码」在微信 webview 里
// 检测极不稳定——1:1 像素渲染后真机依旧不出识别菜单（实锤网页层长按识别不可依赖）。
// wx.previewImage 打开的是微信原生图片查看器：与聊天图片同一个识别检测器，长按必出
// 「识别图中二维码」，识别 wxp:// 直达微信支付收银台（微信内个人付款最短路径）。
// 落地自动放大一次（扫码即见大码），点码图可再次放大；config 失败静默降级，页面提示仍兜底扫一扫。
const PAY_PREVIEW = `<script src="https://res.wx.qq.com/open/js/jweixin-1.6.0.js"></script>
<script>(function(){
var img=document.querySelector('img.code-img');if(!img)return;
function abs(){var s=img.getAttribute('src')||'';return s.charAt(0)==='/'?location.origin+s:s;}
var busy=false,wxok=false,auto=false;
function open(){if(busy||!window.wx||!wx.previewImage||!wxok)return;busy=true;
try{var u=abs();wx.previewImage({current:u,urls:[u],fail:function(){}});}catch(e){}
setTimeout(function(){busy=false;},400);}
img.parentNode.addEventListener('click',open);
var xhr=new XMLHttpRequest();
xhr.open('GET','/api/auth/wechat/jssdk-sign?url='+encodeURIComponent(location.href.split('#')[0]),true);
xhr.onreadystatechange=function(){
if(xhr.readyState!==4)return;
var d=null;try{d=JSON.parse(xhr.responseText);}catch(e){}
if(!d||d.code!==0||!d.data||!d.data.signature)return;
try{
wx.config({appId:d.data.appId,timestamp:d.data.timestamp,nonceStr:d.data.nonceStr,signature:d.data.signature,jsApiList:['previewImage'],debug:false});
wx.ready(function(){wxok=true;if(!auto){auto=true;setTimeout(open,300);}});
wx.error(function(){});
}catch(e){}};
xhr.send();
})();</script>`

const payGateShell = ({ title, body }) => `<!doctype html>
<html lang="zh-CN"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #f5f3f0; color: #26221c; font: 15px/1.6 -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; }
  .wrap { max-width: 420px; margin: 0 auto; text-align: center; padding: 28px 20px 40px; padding: calc(28px + env(safe-area-inset-top)) 20px calc(40px + env(safe-area-inset-bottom)); }
  h1 { font-size: 18px; font-weight: 600; letter-spacing: 2px; }
  .sub { margin: 8px 0 20px; color: #8a8378; font-size: 13px; letter-spacing: 1px; }
  .code { display: inline-block; width: 292px; max-width: 100%; padding: 14px; background: #ffffff; border-radius: 16px; box-shadow: 0 10px 30px rgba(31, 27, 22, .08); cursor: pointer; }
  .code-img { display: block; width: 100%; height: auto; image-rendering: -webkit-optimize-contrast; image-rendering: pixelated; }
  .tip { margin: 16px 0 0; color: #6b6459; font-size: 14px; letter-spacing: 1px; }
  .tip-sub { margin: 6px 0 0; color: #a09a90; font-size: 12px; letter-spacing: 1px; }
  .btn { display: inline-block; margin: 8px 0 4px; padding: 13px 44px; border-radius: 999px; background: #26221c; color: #ffffff; text-decoration: none; font-size: 15px; letter-spacing: 2px; }
  .back { display: inline-block; margin-top: 26px; color: #8a8378; font-size: 13px; letter-spacing: 1px; text-decoration: none; }
  .topbar { text-align: left; margin: 0 0 18px; }
  .back-top { display: inline-flex; align-items: center; gap: 5px; padding: 9px 16px 9px 12px; border-radius: 999px; background: #ffffff; box-shadow: 0 6px 18px rgba(31, 27, 22, .06); color: #6b6459; font-size: 13px; letter-spacing: 1px; text-decoration: none; }
  .back-top svg { display: block; }
</style></head><body><div class="wrap">${body}</div>${PAY_HIDPI}</body></html>`

router.get('/public/:slug/pay', wrap((req, res) => {
  const row = db.prepare('SELECT slug, name, wechat_pay_qr, alipay_pay_qr, wechat_pay_link, alipay_pay_link FROM cards WHERE slug = ?').get(req.params.slug)
  res.set('Cache-Control', 'no-store')
  if (!row) return res.status(404).type('html').send(payGateShell({ title: '名片不存在', body: '<h1>名片不存在</h1><p class="sub">链接可能已失效</p>' }))
  const name = escHtml(row.name || '对方')
  const cardUrl = `/c/${encodeURIComponent(row.slug)}`
  // 返回入口双层：顶部胶囊为首屏常驻入口（长按动作面板/首屏外的底部链接都遮不住它），底部链接接住滚动后返回
  const backTop = `<div class="topbar"><a class="back-top" href="${cardUrl}"><svg width="7" height="12" viewBox="0 0 7 12" fill="none" aria-hidden="true"><path d="M6 1 1 6l5 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>返回名片</a></div>`
  const back = `<a class="back" href="${cardUrl}">返回名片</a>`
  // 干净码（图内付款链接重渲染纯黑白）优先；无链接的存量异形码回落上传原图。
  // 长按识别的前提是 1:1 像素渲染（见 codeImg/PAY_HIDPI 注释），URL 带 size= 供按 DPR 改写、v= 换码击穿缓存
  const wxImg = row.wechat_pay_link ? `/api/cards/public/${row.slug}/pay-link.png?platform=wechat&size=720&v=${bust(row.wechat_pay_link)}` : (row.wechat_pay_qr || '')
  const aliImg = row.alipay_pay_link ? `/api/cards/public/${row.slug}/pay-link.png?platform=alipay&size=720&v=${bust(row.alipay_pay_link)}` : (row.alipay_pay_qr || '')
  const aliLink = safePayLink('alipay', row.alipay_pay_link)
  const wxFallback = row.wechat_pay_qr && row.wechat_pay_link ? ` onerror="this.onerror=null;this.src=${jsAttr(row.wechat_pay_qr)}"` : ''
  const aliFallback = row.alipay_pay_qr && row.alipay_pay_link ? ` onerror="this.onerror=null;this.src=${jsAttr(row.alipay_pay_qr)}"` : ''
  const ua = String(req.headers['user-agent'] || '')

  // 支付宝：直唤收银台。https 付款链接 302 零中间页；scheme 链接走极简跳转页（部分容器不认非 http 的 Location）
  if (/AlipayClient/i.test(ua)) {
    if (aliLink && /^https?:/i.test(aliLink)) return res.redirect(302, aliLink)
    if (aliLink) {
      return res.type('html').send(payGateShell({
        title: `向 ${name} 付款`,
        body: `${backTop}<h1>向 ${name} 付款</h1><p class="sub">正在打开支付宝…</p><a class="btn" href="${escHtml(aliLink)}">打开支付宝付款</a><script>location.replace(${jsStr(aliLink)})</script>${back}`
      }))
    }
    if (aliImg) {
      return res.type('html').send(payGateShell({
        title: `向 ${name} 付款`,
        body: `${backTop}<h1>向 ${name} 付款</h1><p class="sub">支付宝</p>${codeImg(aliImg, '支付宝收款码', aliFallback)}<p class="tip">长按识别二维码，立即支付</p>${back}`
      }))
    }
    if (wxImg) {
      // 只有微信码的名片：支付宝内打不开微信码，给对称兜底（同微信分支「对方暂未开通微信收款」口径）
      return res.type('html').send(payGateShell({
        title: `向 ${name} 付款`,
        body: `${backTop}<h1>向 ${name} 付款</h1><p class="sub">对方暂未开通支付宝收款</p>${codeImg(wxImg, '微信收款码', wxFallback)}<p class="tip">保存图片后用微信扫一扫</p>${back}`
      }))
    }
    return res.type('html').send(payGateShell({ title: `向 ${name} 付款`, body: `${backTop}<h1>向 ${name} 付款</h1><p class="sub">对方还没上传收款码</p>${back}` }))
  }

  // 微信：scheme 跳转被微信内置浏览器拦截。成熟付款路径 = 落地自动弹原生图片查看器
  // （PAY_PREVIEW，长按识别 wxp:// 直达收银台）；网页层长按识别不可依赖（真机实锤），只作兜底
  if (/MicroMessenger/i.test(ua)) {
    if (wxImg) {
      return res.type('html').send(payGateShell({
        title: `向 ${name} 付款`,
        body: `${backTop}<h1>向 ${name} 付款</h1><p class="sub">微信支付</p>${codeImg(wxImg, '微信收款码', wxFallback)}<p class="tip">点图片放大，长按识别二维码，直达微信支付</p><p class="tip-sub">也可保存图片后用微信扫一扫</p>${back}${PAY_PREVIEW}`
      }))
    }
    if (aliImg) {
      return res.type('html').send(payGateShell({
        title: `向 ${name} 付款`,
        body: `${backTop}<h1>向 ${name} 付款</h1><p class="sub">对方暂未开通微信收款</p>${codeImg(aliImg, '支付宝收款码', aliFallback)}<p class="tip">保存图片后用支付宝扫一扫</p>${back}`
      }))
    }
    return res.type('html').send(payGateShell({ title: `向 ${name} 付款`, body: `${backTop}<h1>向 ${name} 付款</h1><p class="sub">对方还没上传收款码</p>${back}` }))
  }

  // 其他扫码器 / 浏览器：选择页——支付宝走链接直唤，微信给码长按
  const blocks = []
  if (aliLink) blocks.push(`<a class="btn" href="${escHtml(aliLink)}">打开支付宝付款</a>`)
  else if (aliImg) blocks.push(`<p class="sub">支付宝</p>${codeImg(aliImg, '支付宝收款码', aliFallback)}<p class="tip">支付宝 · 长按识别二维码付款</p>`)
  if (wxImg) blocks.push(`<p class="sub">微信</p>${codeImg(wxImg, '微信收款码', wxFallback)}<p class="tip">微信 · 长按识别二维码付款</p>`)
  if (!blocks.length) blocks.push('<p class="sub">对方还没上传收款码</p>')
  res.type('html').send(payGateShell({ title: `向 ${name} 付款`, body: `${backTop}<h1>向 ${name} 付款</h1>${blocks.join('')}${back}` }))
}))

router.get('/public/:slug/pay.png', wrap(async (req, res) => {
  const row = db.prepare('SELECT slug FROM cards WHERE slug = ?').get(req.params.slug)
  if (!row) return fail(res, 404, '名片不存在')
  const size = Math.min(1600, Math.max(256, Number(req.query.size) || 720))
  const buf = await qr.plainPng(payQrText(req), { size })
  res.type('png').set('Cache-Control', 'public, max-age=60').send(buf)
}))

// 干净付款码（2026-11-28 真机修正）：把上传收款码图内解码出的原始付款链接（wxp://、qr.alipay.com 等）
// 重新渲染成纯黑白标准码。用户上传的收款码截图常带装饰边框/文字，微信长按识别不出码（真机实锤：
// 长按菜单里根本没有「识别图中二维码」）；重渲染的干净码在 1:1 像素渲染下长按必出识别菜单，识别 wxp:// 微信直达付款
// 页——微信内置浏览器拦 wxp:// 跳转，长按识别是个人收款在微信内最顺的路径。无链接（存量未回填/
// 异形码）回 404，前端回落用户上传的原图。
router.get('/public/:slug/pay-link.png', wrap(async (req, res) => {
  const row = db.prepare('SELECT slug, wechat_pay_link, alipay_pay_link FROM cards WHERE slug = ?').get(req.params.slug)
  if (!row) return fail(res, 404, '名片不存在')
  const platform = String(req.query.platform || '')
  const text = platform === 'wechat' ? row.wechat_pay_link : platform === 'alipay' ? row.alipay_pay_link : ''
  if (!text) return fail(res, 404, '暂无付款链接')
  const size = Math.min(1600, Math.max(256, Number(req.query.size) || 720))
  const buf = await qr.plainPng(text, { size })
  res.type('png').set('Cache-Control', 'public, max-age=60').send(buf)
}))

router.get('/public/:slug/card.vcf', wrap((req, res) => {
  const row = db.prepare('SELECT * FROM cards WHERE slug = ?').get(req.params.slug)
  if (!row) return fail(res, 404, '名片不存在')
  const origin = originOf(req)
  const text = vcard.build(publicView(row, origin), origin)
  res.set('Content-Type', 'text/vcard; charset=utf-8')
  // 手机浏览器收到「text/vcard + URL 以 .vcf 结尾 + 无 Content-Disposition: attachment」时，
  // iOS Safari 弹系统添加联系人，安卓 Chrome 用系统通讯录应用打开——都能直接拉起通讯录，不必下载文件。
  // 带 attachment 会强制下载到「文件」，所以要按 UA 对手机浏览器自动去掉。
  // 微信内 WebView 拦通讯录，仍返回 attachment（引导去外部浏览器）。
  const ua = String(req.headers['user-agent'] || '')
  const isIOS = /iPad|iPhone|iPod/.test(ua)
  const isAndroid = /Android/i.test(ua)
  const isWeChat = /MicroMessenger/i.test(ua)
  // download=1：强制下载（安卓 intent 拉起通讯录失败时的 fallback 链接走这里，必须带 attachment 才是下载文件）
  const forceDownload = String(req.query.download || '') === '1'
  const inline = !forceDownload && (String(req.query.inline) === '1' || ((isIOS || isAndroid) && !isWeChat))
  if (inline) {
    // 不设 Content-Disposition：iOS Safari 按 MIME(text/vcard)+.vcf 后缀识别为联系人卡片，
    // 带 filename 的 inline 头会被 Safari 当下载请求 → 弹「无法下载此文件」。
  } else {
    res.set('Content-Disposition', `attachment; filename="${encodeURIComponent(row.name || row.slug)}.vcf"`)
  }
  res.send(text)
}))

// 交换名片：「我的名片」以登录身份为准（2026-11-28 去掉手填短码，登录即身份）；
// body.slug 仅作旧小程序客户端（手填短码）的兼容回落，H5 传 {} 即可。
router.post('/public/:slug/exchange', wrap((req, res) => {
  const from = db.prepare('SELECT * FROM cards WHERE slug = ?').get(req.params.slug)
  if (!from) return fail(res, 404, '名片不存在')
  const payload = parseToken(req)
  let to = payload ? db.prepare('SELECT * FROM cards WHERE user_id = ?').get(payload.id) : null
  if (!to) to = db.prepare('SELECT * FROM cards WHERE slug = ?').get(String(req.body?.slug || '').toLowerCase())
  if (!to) return fail(res, 400, '还没有自己的名片，创建后才能交换')
  if (from.id === to.id) return fail(res, 400, '不能和自己交换名片')
  const r = db.prepare('INSERT OR IGNORE INTO card_exchanges (from_card_id, to_card_id) VALUES (?,?)').run(from.id, to.id)
  // 仅首次建立互换时提醒对方名片主人（UNIQUE 去重），失败不影响主流程
  if (r.changes) {
    try { notify.notifyOwner(to, NOTIFY_TYPES.NEW_EXCHANGE, from.name || '一位名片用户') } catch (e) { console.error('[Notify] 交换提醒失败', e.message) }
  }
  ok(res, { exchanged: true, with: to.slug })
}))

// 收藏 / 取消收藏（需登录）；返回当前收藏状态，前端据此切按钮
router.post('/public/:slug/favorite', authRequired, wrap((req, res) => {
  const target = db.prepare('SELECT id, user_id FROM cards WHERE slug = ?').get(req.params.slug)
  if (!target) return fail(res, 404, '名片不存在')
  if (target.user_id === req.user.id) return fail(res, 400, '不能收藏自己的名片')
  const exists = db.prepare('SELECT id FROM card_favorites WHERE user_id = ? AND card_id = ?').get(req.user.id, target.id)
  if (exists) {
    db.prepare('DELETE FROM card_favorites WHERE id = ?').run(exists.id)
    return ok(res, { favorite: false })
  }
  const note = String(req.body?.note || '').trim().slice(0, 200)
  const tags = Array.isArray(req.body?.tags) ? JSON.stringify(req.body.tags.slice(0, 8).map(x => String(x).slice(0, 20))) : '[]'
  db.prepare('INSERT INTO card_favorites (user_id, card_id, note, tags) VALUES (?,?,?,?)').run(req.user.id, target.id, note, tags)
  try {
    const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(target.id)
    const me = db.prepare('SELECT nickname FROM users WHERE id = ?').get(req.user.id)
    notify.notifyOwner(card, NOTIFY_TYPES.NEW_FAVORITE, me?.nickname || '有人')
  } catch (e) { console.error('[Notify] 收藏提醒失败', e.message) }
  ok(res, { favorite: true })
}))

// 展会连扫：批量收藏多张名片 + 统一打标/备注（一次参会扫一批，事后好找）。
// 遇到已收藏的只补标不重复插；跳过自己、不存在的短码。
router.post('/mine/contacts/batch', authRequired, wrap((req, res) => {
  const slugs = Array.isArray(req.body?.slugs) ? req.body.slugs.slice(0, 50) : []
  const tags = Array.isArray(req.body?.tags) ? JSON.stringify(req.body.tags.slice(0, 8).map(x => String(x).slice(0, 20))) : '[]'
  const note = String(req.body?.note || '').trim().slice(0, 200)
  if (!slugs.length) return fail(res, 400, '没有可保存的名片')
  const mine = db.prepare('SELECT * FROM cards WHERE user_id = ?').get(req.user.id)
  // 套餐闸门：展会连扫（批量收名片）需有效套餐；单张收藏/交换属基本功能不卡。
  if (!cardPlanActive(mine)) return fail(res, 403, '展会连扫需要开通套餐，请先开通或续期')
  const myId = mine?.id || -1
  let added = 0, updated = 0, skipped = 0
  db.transaction(() => {
    for (const raw of slugs) {
      const slug = String(raw || '').toLowerCase().trim()
      const card = db.prepare('SELECT id FROM cards WHERE slug = ?').get(slug)
      if (!card || card.id === myId) { skipped++; continue }
      const exists = db.prepare('SELECT id FROM card_favorites WHERE user_id = ? AND card_id = ?').get(req.user.id, card.id)
      if (exists) {
        db.prepare('UPDATE card_favorites SET note = CASE WHEN ? <> \'\' THEN ? ELSE note END, tags = ? WHERE id = ?')
          .run(note, note, tags === '[]' ? db.prepare('SELECT tags FROM card_favorites WHERE id = ?').get(exists.id).tags : tags, exists.id)
        updated++
      } else {
        db.prepare('INSERT INTO card_favorites (user_id, card_id, note, tags) VALUES (?,?,?,?)').run(req.user.id, card.id, note, tags)
        added++
      }
    }
  })()
  ok(res, { added, updated, skipped })
}))

// 更新收藏的备注/标签（名片夹里编辑）
router.put('/mine/contacts/:slug', authRequired, wrap((req, res) => {
  const card = db.prepare('SELECT id FROM cards WHERE slug = ?').get(req.params.slug)
  if (!card) return fail(res, 404, '名片不存在')
  const fav = db.prepare('SELECT id FROM card_favorites WHERE user_id = ? AND card_id = ?').get(req.user.id, card.id)
  if (!fav) return fail(res, 404, '尚未收藏该名片')
  const note = String(req.body?.note ?? '').trim().slice(0, 200)
  const tags = Array.isArray(req.body?.tags) ? JSON.stringify(req.body.tags.slice(0, 8).map(x => String(x).slice(0, 20))) : '[]'
  db.prepare('UPDATE card_favorites SET note = ?, tags = ? WHERE id = ?').run(note, tags, fav.id)
  ok(res, { updated: true })
}))

// 查询当前用户是否已收藏某名片（公开页加载时判定按钮态）
router.get('/public/:slug/favorite', authRequired, wrap((req, res) => {
  const target = db.prepare('SELECT id FROM cards WHERE slug = ?').get(req.params.slug)
  const favorite = target ? !!db.prepare('SELECT 1 FROM card_favorites WHERE user_id = ? AND card_id = ?').get(req.user.id, target.id) : false
  ok(res, { favorite })
}))

// ---------- 我的名片 ----------
router.get('/mine', authRequired, wrap((req, res) => {
  const row = db.prepare('SELECT * FROM cards WHERE user_id = ?').get(req.user.id)
  ok(res, row ? ownerView(row, originOf(req)) : null)
}))

// 名片展示头像（唯一真相源 = cards.avatar，与账户头像 users.avatar 完全独立）
// 2026-11-25 强制约定：账户层(users) 与名片层(cards) 不得混写。
function normalizeCardAvatar(v) {
  const s = String(v || '').trim()
  if (!s) return ''
  if (!/^\/(uploads|media)\//.test(s) && !/^https?:\/\//.test(s)) return null
  return s.slice(0, 500)
}
router.get('/avatar', authRequired, wrap((req, res) => {
  const row = db.prepare('SELECT avatar FROM cards WHERE user_id = ?').get(req.user.id)
  ok(res, { avatar: row?.avatar || '' })
}))
router.put('/avatar', authRequired, wrap((req, res) => {
  const avatar = normalizeCardAvatar(req.body?.avatar)
  if (avatar === null) return fail(res, 400, '头像地址不合法')
  const row = db.prepare('SELECT id FROM cards WHERE user_id = ?').get(req.user.id)
  if (!row) return fail(res, 404, '请先创建名片')
  db.prepare('UPDATE cards SET avatar = ? WHERE user_id = ?').run(avatar, req.user.id)
  ok(res, { avatar })
}))

router.post('/mine', authRequired, wrap((req, res) => {
  const exists = db.prepare('SELECT id FROM cards WHERE user_id = ?').get(req.user.id)
  if (exists) return fail(res, 400, '每个账号仅可开通一张名片')
  const preferred = normalizeSlug(req.body?.slug)
  const slug = makeSlug(preferred || req.user.phone?.slice(-8))
  // 名片姓名留空由用户填；不再拿账户昵称当默认值（2026-11-25 强制约定：users 与 cards 字段互不混用）
  db.prepare('INSERT INTO cards (user_id, slug, name) VALUES (?,?,?)')
    .run(req.user.id, slug, '')
  // 兑现攒下的赠送时长（注册试用/邀请返时长在没建卡时先记账，这里兑现成 PRO 到期时间）
  try { require('../services/plan').consumeCredit(req.user.id) } catch (e) { console.error('[Plan] 赠送时长兑现失败', e.message) }
  const row = db.prepare('SELECT * FROM cards WHERE user_id = ?').get(req.user.id)
  ok(res, ownerView(row, originOf(req)))
}))

const FIELD_LABELS = {
  name: '姓名', name_en: '英文名', title: '职位', company: '公司', company_intro: '公司简介', department: '部门', avatar: '名片头像',
  mobile: '手机', phone: '座机', email: '邮箱', wechat: '微信', alipay: '支付宝', whatsapp: 'WhatsApp',
  wechat_qr: '微信二维码', alipay_qr: '支付宝二维码', wechat_pay_qr: '微信收款码', alipay_pay_qr: '支付宝收款码',
  cover: '封面图', logo: '公司 LOGO', tags: '标签', links: '更多链接',
  address: '地址', address_detail: '门牌', province: '省', city: '城市', district: '区', street: '街道',
  website: '主页', shop_url: '店铺', bio: '简介', industry: '行业'
}

// 保存前的格式校验（唯一真相源在服务端，三端共用）：空值放过，只允许合法格式落库。
// 手机号兼容国际区号 + 分隔符；座机兼容区号/分机；邮箱常规校验；网址必须 http(s)。
// 网址统一规则：协议 + 主机名带点 + 可选路径（「https://notaurl」这类补协议的残缺网址不放行）
const URL_RE = /^https?:\/\/[^/\s]+(\.[^/\s]+)+(\/[^\s]*)?$/i
const FORMAT_RULES = {
  mobile: {
    re: /^\+?[\d][\d\s-]{5,19}$/,
    hint: '手机号格式不正确（支持国际区号，可含空格或横线）'
  },
  phone: {
    re: /^\+?[\d][\d\s-]{5,19}$/,
    hint: '座机格式不正确（可含区号、横线或分机号）'
  },
  whatsapp: {
    re: /^\+?[\d][\d\s-]{5,19}$/,
    hint: 'WhatsApp 需填电话号码（支持国际区号）'
  },
  email: {
    re: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    hint: '邮箱格式不正确'
  },
  website: {
    re: URL_RE,
    hint: '公司主页需填完整的 http(s) 网址'
  },
  shop_url: {
    re: URL_RE,
    hint: '店铺网址需填完整的 http(s) 网址'
  },
  wechat: {
    re: /^[a-zA-Z0-9][a-zA-Z0-9._-]{3,37}$/,
    hint: '微信号格式不正确（可含字母、数字、下划线、减号，不含空格）'
  },
  alipay: {
    re: /^(1\d{10}|[^\s@]+@[^\s@]+\.[^\s@]+)$/,
    hint: '支付宝账号请填手机号或邮箱'
  }
}
// 图片类字段（头像/封面/LOGO/收款码图）：空值合法；非空必须是上传后得到的图片地址
// （/uploads/、/media/ 本地路径或 http(s) 外链），与 normalizeCardAvatar 同口径，javascript:/data: 一律拒。
const IMAGE_URL_RE = /^(\/(uploads|media)\/[^\s]+|https?:\/\/[^\s]+)$/
for (const k of ['avatar', 'cover', 'logo', 'wechat_qr', 'alipay_qr', 'wechat_pay_qr', 'alipay_pay_qr']) {
  FORMAT_RULES[k] = { re: IMAGE_URL_RE, hint: '图片地址不合法，请重新上传图片' }
}
// 文本长度上限（与前端表单 maxlength 同口径）；未列出的字段仍按通用 2000 截断
const TEXT_CAPS = {
  name: 30, name_en: 40, title: 60, company: 60, department: 40,
  bio: 1000, company_intro: 1000, address: 200, address_detail: 100,
  province: 40, city: 40, district: 40, street: 80, wechat: 40, alipay: 64,
  avatar: 500, cover: 500, logo: 500, wechat_qr: 500, alipay_qr: 500, wechat_pay_qr: 500, alipay_pay_qr: 500
}
// 网址归一化：用户习惯填「Card.microdot.net」这类无协议网址，与展示层 CardView.safeUrl 同口径
// 自动补 https:// 再校验。唯一真相源放在服务端，H5/小程序/后台提交都能受益；
// 否则无协议 URL 被 400 拒绝，而前端静默吞错、照样跳回名片，用户看到的就是「改了不更新」。
function normalizeFieldValue(key, value) {
  const s = String(value ?? '').trim()
  if ((key === 'website' || key === 'shop_url') && s && !/^https?:\/\//i.test(s)) return `https://${s}`
  return s
}

// 校验输入：空值合法（ wiping 字段）；非空按规则校验。返回错误提示或空串。
function validateFieldFormat(key, value) {
  const rule = FORMAT_RULES[key]
  if (!rule) return ''
  const s = String(value ?? '').trim()
  if (!s) return ''
  return rule.re.test(s) ? '' : rule.hint
}

router.put('/mine', authRequired, wrap(async (req, res) => {
  const row = db.prepare('SELECT * FROM cards WHERE user_id = ?').get(req.user.id)
  if (!row) return fail(res, 404, '请先创建名片')
  const sets = []
  const values = []
  const changedLabels = []
  for (const key of EDITABLE) {
    if (!(key in (req.body || {}))) continue
    let v = req.body[key]
    if (key === 'tags') {
      const arr = typeof v === 'string' ? parseJson(v, []) : v
      if (!Array.isArray(arr)) return fail(res, 400, '标签格式不正确')
      // 标签：去空、单个 ≤30 字、最多 8 个（与前端「最多 8 个」同口径）
      v = JSON.stringify(arr.map(x => String(x ?? '').trim().slice(0, 30)).filter(Boolean).slice(0, 8))
    } else if (key === 'links') {
      const arr = typeof v === 'string' ? parseJson(v, []) : v
      if (!Array.isArray(arr)) return fail(res, 400, '更多链接格式不正确')
      const links = []
      for (const x of arr.slice(0, 20)) {
        if (typeof x === 'string') { const s = x.slice(0, 30); if (s) links.push(s); continue }
        const label = String(x?.label ?? '').trim().slice(0, 40)
        let url = String(x?.url ?? '').trim()
        if (!label && !url) continue // 空行不落库（与前端过滤同口径）
        if (url && !/^https?:\/\//i.test(url)) url = `https://${url}` // 与 website 同口径自动补协议
        if (url && !URL_RE.test(url)) return fail(res, 400, '更多链接的网址需填完整的 http(s) 网址')
        links.push({ label, url })
      }
      v = JSON.stringify(links)
    } else if (['accent', 'qr_fg', 'qr_bg'].includes(key)) {
      if (!isColor(v)) return fail(res, 400, `${key} 必须是 #RRGGBB 颜色`)
    } else if (key === 'template') {
      if (!isTemplate(v)) return fail(res, 400, '无效的展示模板')
      v = String(v)
    } else if (key === 'industry') {
      if (v && !isIndustry(v)) return fail(res, 400, '无效的行业类目')
      v = normalizeIndustry(v)
    } else if (key === 'latitude' || key === 'longitude') {
      if (v === '' || v === null || v === undefined) v = null
      else {
        const num = Number(v)
        const range = key === 'latitude' ? 90 : 180
        if (!Number.isFinite(num) || Math.abs(num) > range) return fail(res, 400, `${key} 坐标超出有效范围`)
        v = num
      }
    } else if (key === 'market_opt_in') {
      v = v ? 1 : 0
    } else if (key === 'qr_logo') {
      v = v ? 1 : 0
    } else if (key === 'qr_style') {
      const obj = typeof v === 'string' ? parseJson(v, {}) : v
      v = JSON.stringify(normalizeStyle(obj))
    } else {
      v = String(v ?? '').slice(0, TEXT_CAPS[key] || 2000)
    }
    // 网址补协议在格式校验之前（否则无协议 URL 直接 400）
    if (key === 'website' || key === 'shop_url') v = normalizeFieldValue(key, v)
    // 格式提示都是自带字段名的完整句子，直接作为错误文案（此前再拼 FIELD_LABELS 会出现「邮箱邮箱格式不正确」）
    const formatError = validateFieldFormat(key, v)
    if (formatError) return fail(res, 400, formatError)
    const valueChanged = String(row[key] ?? '') !== String(v ?? '')
    // 收款码图内容核验：解码有成本，只在值真正变化时做（旧值不重复解码、不拖累常规保存）。
    // 判断「图里有没有二维码、是不是收款码、放没放对平台」，理由见 services/payQr.js；
    // 校验通过后把图内原始付款链接（safePayLink 白名单过滤）落到派生列，供扫码落地自动调起支付。
    if (valueChanged && (key === 'wechat_pay_qr' || key === 'alipay_pay_qr')) {
      const kind = key === 'wechat_pay_qr' ? 'wechat' : 'alipay'
      const linkCol = kind === 'wechat' ? 'wechat_pay_link' : 'alipay_pay_link'
      if (!v) {
        sets.push(`${linkCol} = ?`); values.push('')
      } else {
        const r = await readPayQr(kind, v)
        if (!r.ok) return fail(res, 400, r.msg)
        sets.push(`${linkCol} = ?`)
        values.push(safePayLink(kind, r.text))
      }
    }
    // 套餐闸门：配色方案 + 上架集市需要套餐有效。传同值（编辑页保存全表单带原值）不拦。
    // 上架 market_opt_in 只在「开启」时拦，关闭（下架）永远放行——过期用户应能主动下架。
    // 配色字段在值真正变化时拦，避免未开通用户正常改资料被误伤。
    const planGateHit = PLAN_GATED_FIELDS.includes(key) && valueChanged && !cardPlanActive(row)
      && !(key === 'market_opt_in' && !v)
    if (planGateHit) return fail(res, 403, PLAN_GATE_MSG)
    if (CARD_WATCH_FIELDS.includes(key) && valueChanged) {
      changedLabels.push(FIELD_LABELS[key] || key)
    }
    sets.push(`${key} = ?`)
    values.push(v)
  }
  // 注：曾有一段「开启上架时把 draft 自愈为 active」的逻辑，已移除——
  // 那等于免费用户零付费绕过套餐闸门自我激活。是否开通只由订单激活链路写 status/expires_at。
  if (!sets.length) return fail(res, 400, '没有需要更新的字段')
  // 铁律：slug / expires_at / views 绝不在更新白名单内 —— 改资料不动二维码
  sets.push("updated_at = datetime('now')")
  db.prepare(`UPDATE cards SET ${sets.join(', ')} WHERE id = ?`).run(...values, row.id)
  const updated = db.prepare('SELECT * FROM cards WHERE id = ?').get(row.id)
  // 资料变更提醒：通知所有收藏/交换过这张名片的人（失败不影响主流程）
  if (changedLabels.length) {
    try { notify.notifyCardUpdated(updated, changedLabels) } catch (e) { console.error('[Notify] 变更提醒失败', e.message) }
  }
  ok(res, ownerView(updated, originOf(req)))
}))

// 收款码识别归位（2026-11-28 用户定稿「上传不分先后」）：快捷编辑上传后前端只送图来问归属，
// 这里只识别不落库——是微信/支付宝收款码回 platform 由前端自动归位到对应字段（跨格归位、同格即更换），
// 识别不出/不是收款码给理由由前端拦截、让用户重新上传。完整编辑表单（CardEdit）仍走 PUT /mine 严格分格拦截，
// 两处共用 services/payQr.js 唯一真相源，绝不各写一套识别。
router.post('/mine/pay-qr/inspect', authRequired, wrap(async (req, res) => {
  const url = String(req.body?.url || '').trim()
  if (!IMAGE_URL_RE.test(url)) return fail(res, 400, '图片地址不合法，请重新上传图片')
  const r = await inspectPayQr(url)
  if (!r.platform) return fail(res, 400, r.msg)
  ok(res, { platform: r.platform })
}))

router.get('/mine/stats', authRequired, wrap((req, res) => {
  const card = db.prepare('SELECT id, views FROM cards WHERE user_id = ?').get(req.user.id)
  if (!card) return ok(res, { views: 0, exchanges: 0, daily: [], sources: [], cities: [], hourly: [] })
  const exchanges = db.prepare('SELECT COUNT(*) AS n FROM card_exchanges WHERE from_card_id = ? OR to_card_id = ?').get(card.id, card.id).n
  const daily = db.prepare(`SELECT date(created_at) AS day, COUNT(*) AS n FROM card_views
    WHERE card_id = ? GROUP BY date(created_at) ORDER BY day DESC LIMIT 14`).all(card.id)
  // 访客画像：来源渠道 / 城市分布 / 时段热力（近 30 天）
  const since = new Date(Date.now() - 30 * 86400000).toISOString().replace('T', ' ').slice(0, 19)
  const sources = db.prepare(`SELECT CASE WHEN source = '' THEN 'direct' ELSE source END AS key, COUNT(*) AS n
    FROM card_views WHERE card_id = ? AND created_at >= ? GROUP BY key ORDER BY n DESC`).all(card.id, since)
  const cities = db.prepare(`SELECT city AS key, COUNT(*) AS n FROM card_views
    WHERE card_id = ? AND created_at >= ? AND city <> '' GROUP BY city ORDER BY n DESC LIMIT 8`).all(card.id, since)
  const hourly = db.prepare(`SELECT CAST(strftime('%H', created_at) AS INTEGER) AS hour, COUNT(*) AS n
    FROM card_views WHERE card_id = ? AND created_at >= ? GROUP BY hour ORDER BY hour`).all(card.id, since)
  ok(res, { views: card.views || 0, exchanges, daily, sources, cities, hourly })
}))

// 访客城市上报：前端精确/兜底定位成功后轻量上报，与浏览记录按最近一条同城匹配（避免每条浏览都带定位）
router.post('/public/:slug/trace', wrap((req, res) => {
  const row = db.prepare('SELECT id FROM cards WHERE slug = ?').get(req.params.slug)
  if (!row) return fail(res, 404, '名片不存在')
  const city = String(req.body?.city || '').trim().slice(0, 30)
  const source = String(req.body?.source || '').trim().toLowerCase()
  if (!city && !isVisitSource(source)) return ok(res, { traced: false })
  // 更新该名片最近一条浏览记录的 city/source（仅当仍为空，避免覆盖更早的准确值）
  db.prepare(`UPDATE card_views SET
      city = CASE WHEN city = '' AND ? <> '' THEN ? ELSE city END,
      source = CASE WHEN (source = '' OR source = 'direct') AND ? <> '' THEN ? ELSE source END
    WHERE id = (SELECT MAX(id) FROM card_views WHERE card_id = ?)`)
    .run(city, city, source, source, row.id)
  ok(res, { traced: true })
}))

// ---------- 名片资料夹（产品册/作品/链接，分享时带名片落款二维码） ----------
// 公开读：访客打开某张名片的资料夹（只收录 active 名片）
router.get('/public/:slug/materials', wrap((req, res) => {
  const card = db.prepare('SELECT id, slug, name, status, expires_at, theme, accent, qr_fg, qr_bg, qr_logo, logo FROM cards WHERE slug = ?').get(req.params.slug)
  if (!card) return fail(res, 404, '名片不存在')
  const rows = db.prepare('SELECT * FROM card_materials WHERE card_id = ? ORDER BY sort ASC, id ASC').all(card.id)
  const origin = originOf(req)
  ok(res, {
    list: rows.map(materialView),
    owner: {
      name: card.name, slug: card.slug, url: `${origin}/c/${card.slug}`,
      qr: `${origin}/api/cards/public/${card.slug}/qr.svg?size=360`,
      theme: card.theme, accent: card.accent
    }
  })
}))

// 我的资料夹列表
router.get('/mine/materials', authRequired, wrap((req, res) => {
  const card = db.prepare('SELECT id FROM cards WHERE user_id = ?').get(req.user.id)
  if (!card) return ok(res, { list: [] })
  const rows = db.prepare('SELECT * FROM card_materials WHERE card_id = ? ORDER BY sort ASC, id ASC').all(card.id)
  ok(res, { list: rows.map(materialView) })
}))

// 批量保存资料夹（整份替换，前端一次提交数组；幂等，先删后插在同事务内）
router.put('/mine/materials', authRequired, wrap((req, res) => {
  const card = db.prepare('SELECT id FROM cards WHERE user_id = ?').get(req.user.id)
  if (!card) return fail(res, 404, '请先创建名片')
  const items = req.body?.items
  if (!Array.isArray(items)) return fail(res, 400, '资料列表格式不正确')
  const clean = items.slice(0, 20).map((it, i) => {
    const type = isMaterialType(it.type) ? it.type : 'link'
    let url = String(it.url || '').trim().slice(0, 1000)
    // link 仅允许 http(s)；file 允许站内 /uploads 或 http(s) 外链
    if (type === 'link' && url && !/^https?:\/\//i.test(url)) url = ''
    if (type === 'file' && url && !/^https?:\/\//i.test(url) && !/^\/uploads\/[A-Za-z0-9_.-]+$/.test(url)) url = ''
    return {
      type, url,
      title: String(it.title || '').trim().slice(0, 60) || (type === 'link' ? '网页链接' : '文件资料'),
      sort: Number.isFinite(Number(it.sort)) ? Number(it.sort) : i
    }
  }).filter(it => it.url)
  db.transaction(() => {
    db.prepare('DELETE FROM card_materials WHERE card_id = ?').run(card.id)
    const ins = db.prepare('INSERT INTO card_materials (card_id, type, title, url, sort) VALUES (?,?,?,?,?)')
    for (const it of clean) ins.run(card.id, it.type, it.title, it.url, it.sort)
  })()
  const rows = db.prepare('SELECT * FROM card_materials WHERE card_id = ? ORDER BY sort ASC, id ASC').all(card.id)
  ok(res, { list: rows.map(materialView) })
}))

// 资料点击/打开计数（公开，轻量，失败不影响浏览）
router.post('/public/materials/:id/view', wrap((req, res) => {
  db.prepare('UPDATE card_materials SET views = views + 1 WHERE id = ?').run(req.params.id)
  ok(res, { ok: true })
}))

// 我的收藏夹：我收藏的名片 + 与我交换过的名片（合并去重，标注来源）
router.get('/mine/contacts', authRequired, wrap((req, res) => {
  const mine = db.prepare('SELECT id FROM cards WHERE user_id = ?').get(req.user.id)
  const myId = mine?.id || -1
  const origin = originOf(req)
  const favs = db.prepare(`SELECT c.*, f.created_at AS rel_at FROM card_favorites f
    JOIN cards c ON c.id = f.card_id WHERE f.user_id = ? ORDER BY f.created_at DESC`).all(req.user.id)
  const ex = db.prepare(`SELECT c.*, e.created_at AS rel_at FROM card_exchanges e
    JOIN cards c ON c.id = (
      CASE WHEN e.from_card_id = ? THEN e.to_card_id ELSE e.from_card_id END
    ) WHERE e.from_card_id = ? OR e.to_card_id = ? ORDER BY e.created_at DESC`).all(myId, myId, myId)
  const map = new Map()
  for (const r of favs) map.set(r.id, { ...publicView(r, origin), source: 'favorite', relAt: r.rel_at, note: r.note || '', tags: parseJson(r.tags, []) })
  for (const r of ex) if (!map.has(r.id)) map.set(r.id, { ...publicView(r, origin), source: 'exchange', relAt: r.rel_at, note: '', tags: [] })
  ok(res, { contacts: [...map.values()] })
}))

module.exports = router
module.exports.publicView = publicView
