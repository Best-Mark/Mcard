const express = require('express')
const fs = require('fs')
const path = require('path')
const db = require('../db')
const config = require('../config')
const { originOf, requestUrl } = require('../utils/origin')
const { ok, fail, wrap } = require('../utils/response')
const { authRequired, parseToken } = require('../utils/auth')
const { makeSlug, normalizeSlug } = require('../utils/slug')
const qr = require('../services/qrcode')
const { normalizeStyle } = qr
const vcard = require('../services/vcard')
const { CARD_TEMPLATES, isTemplate } = require('../utils/cardTemplates')
const { INDUSTRIES, CITIES, HOT_CITIES, cityCoords, isIndustry, normalizeIndustry, distanceKm } = require('../utils/market')
const { MATERIAL_TYPES, VISIT_SOURCES, isMaterialType, isVisitSource, CARD_WATCH_FIELDS, NOTIFY_TYPES } = require('../utils/constants')
const { tokenize: tokenizeQuery, score: relevanceScore } = require('../utils/search')
const notify = require('../services/notify')

const router = express.Router()

function cardLogo(row, asDataUrl = false) {
  if (!row?.logo || !/^\/uploads\/[A-Za-z0-9_.-]+$/.test(row.logo)) return ''
  const file = path.join(config.UPLOAD_DIR, path.basename(row.logo))
  if (!fs.existsSync(file)) return ''
  return asDataUrl ? `data:image/png;base64,${fs.readFileSync(file).toString('base64')}` : file
}

const EDITABLE = ['name', 'name_en', 'title', 'company', 'company_intro', 'department', 'phone', 'mobile', 'email',
  'wechat', 'alipay', 'whatsapp', 'wechat_qr', 'alipay_qr', 'wechat_pay_qr', 'alipay_pay_qr',
  'address', 'address_detail', 'province', 'city', 'district', 'street',
  'website', 'shop_url', 'cover', 'logo', 'bio',
  'tags', 'links', 'template', 'industry', 'latitude', 'longitude', 'market_opt_in',
  'theme', 'accent', 'qr_fg', 'qr_bg', 'qr_logo', 'qr_style']

const parseJson = (v, fallback) => { try { const x = JSON.parse(v); return x ?? fallback } catch { return fallback } }
const isColor = v => /^#[0-9a-fA-F]{6}$/.test(String(v || ''))

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
  const now = new Date()
  const expired = row.expires_at && new Date(String(row.expires_at).replace(' ', 'T') + 'Z') < now
  return {
    slug: row.slug,
    url: `${origin}/c/${row.slug}`,
    name: row.name, name_en: row.name_en, title: row.title, company: row.company,
    company_intro: row.company_intro || '',
    department: row.department, phone: row.phone, mobile: row.mobile, email: row.email,
    wechat: row.wechat, alipay: row.alipay, whatsapp: row.whatsapp,
    wechat_qr: row.wechat_qr, alipay_qr: row.alipay_qr,
    wechat_pay_qr: row.wechat_pay_qr, alipay_pay_qr: row.alipay_pay_qr,
    address: row.address, address_detail: row.address_detail,
    province: row.province || '', city: row.city || '', district: row.district || '', street: row.street || '',
    website: row.website, shop_url: row.shop_url,
    avatar: row.avatar, cover: row.cover, logo: row.logo, bio: row.bio,
    tags: parseJson(row.tags, []), links: parseJson(row.links, []),
    template: isTemplate(row.template) ? row.template : 'classic',
    industry: normalizeIndustry(row.industry),
    latitude: row.latitude ?? null, longitude: row.longitude ?? null, market_opt_in: !!row.market_opt_in,
    theme: row.theme, accent: row.accent, qr_fg: row.qr_fg, qr_bg: row.qr_bg, qr_logo: !!row.qr_logo,
    qr_style: normalizeStyle(parseJson(row.qr_style, {})),
    active: row.status === 'active' && !expired,
    expiresAt: row.expires_at, views: row.views
  }
}

function ownerView(row, origin) {
  return { ...publicView(row, origin), id: row.id, status: row.status, createdAt: row.created_at }
}

// 集市卡片视图：只暴露发现业务对口所需的最小信息，绝不外泄电话/邮箱/微信/收款码等私密字段
function marketView(row, originLat, originLng, origin) {
  let distance = null
  if (originLat != null && originLng != null && row.latitude != null && row.longitude != null) {
    distance = Math.round(distanceKm(originLat, originLng, row.latitude, row.longitude) * 10) / 10
  }
  const industry = INDUSTRIES.find(i => i.key === row.industry)
  return {
    slug: row.slug,
    url: `${origin}/c/${row.slug}`,
    name: row.name, name_en: row.name_en, title: row.title, company: row.company,
    industry: normalizeIndustry(row.industry), industryLabel: industry?.label || '',
    province: row.province || '', city: row.city || '', district: row.district || '', distanceKm: distance,
    avatar: row.avatar, logo: row.logo, cover: row.cover,
    tags: parseJson(row.tags, []), bio: row.bio, views: row.views || 0,
    template: isTemplate(row.template) ? row.template : 'classic', theme: row.theme, accent: row.accent
  }
}

// 布局模板清单（编辑器从此处拉取，避免各端硬编码 key）——必须放在 /public/:slug 之前
// 清单为静态数据，长缓存头减少重复请求
router.get('/public/templates', wrap((req, res) => {
  res.set('Cache-Control', 'public, max-age=3600')
  ok(res, { templates: CARD_TEMPLATES })
}))

// 资料夹类型 + 访客来源清单（前端编辑器/统计页唯一真相源，不各自硬编码）
router.get('/public/meta', wrap((req, res) => {
  res.set('Cache-Control', 'public, max-age=3600')
  ok(res, { materialTypes: MATERIAL_TYPES, sources: VISIT_SOURCES })
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
      const hay = [r.name, r.name_en, r.title, r.company, r.bio, r.city, r.tags, r.industry]
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
  }
  ok(res, publicView(row, originOf(req)))
}))

router.get('/public/:slug/qr.svg', wrap((req, res) => {
  const row = db.prepare('SELECT slug, qr_fg, qr_bg, qr_logo, qr_style, logo FROM cards WHERE slug = ?').get(req.params.slug)
  if (!row) return fail(res, 404, '名片不存在')
  const size = Math.min(2000, Math.max(64, Number(req.query.size) || 360))
  const brand = String(req.query.brand || 'M').slice(0, 2)
  // query 覆盖 DB：编辑页保存前实时预览用；公开访问不带 query 则用 DB 值
  const fg = /^#[0-9a-fA-F]{6}$/.test(req.query.fg || '') ? req.query.fg : row.qr_fg
  const bg = /^#[0-9a-fA-F]{6}$/.test(req.query.bg || '') ? req.query.bg : row.qr_bg
  const logoOn = 'logo' in req.query ? req.query.logo !== '0' : !!row.qr_logo
  const logoImage = logoOn ? cardLogo(row, true) : ''
  let style = normalizeStyle(parseJson(row.qr_style, {}))
  if (req.query.style) { try { style = normalizeStyle(JSON.parse(String(req.query.style).slice(0, 4000))) } catch {} }
  res.type('image/svg+xml').set('Cache-Control', 'public, max-age=3600')
    .send(qr.svg(requestUrl(req, `/c/${row.slug}`), { size, fg, bg, logo: logoOn, brand, logoImage, style }))
}))

router.get('/public/:slug/qr.png', wrap(async (req, res) => {
  const row = db.prepare('SELECT slug, qr_fg, qr_bg, qr_logo, qr_style, logo FROM cards WHERE slug = ?').get(req.params.slug)
  if (!row) return fail(res, 404, '名片不存在')
  const size = Math.min(2000, Math.max(128, Number(req.query.size) || 720))
  const logoImage = row.qr_logo ? cardLogo(row) : ''
  const style = normalizeStyle(parseJson(row.qr_style, {}))
  const buf = await qr.png(requestUrl(req, `/c/${row.slug}`), { size, fg: row.qr_fg, bg: row.qr_bg, logoImage, logo: !!row.qr_logo, brand: 'M', style })
  res.type('png').set('Cache-Control', 'public, max-age=3600').send(buf)
}))

// vCard 文本（唯一真相源仍是 services/vcard.build，前端拿它本地生成二维码，避免依赖图片接口）
router.get('/public/:slug/vcard.txt', wrap((req, res) => {
  const row = db.prepare('SELECT * FROM cards WHERE slug = ?').get(req.params.slug)
  if (!row) return fail(res, 404, '名片不存在')
  const origin = originOf(req)
  res.type('text/plain; charset=utf-8').send(vcard.build(publicView(row, origin), origin))
}))

// vCard 内容二维码：扫码得到的是完整联系人数据（BEGIN:VCARD...），
// iOS/Android 相机扫一扫会直接弹出「添加到通讯录」——这才是「扫一扫存入通讯录」的正确实现。
// 不加 logo（H 纠错留足识别余量），内容较长时自动选合适版本。
router.get('/public/:slug/vcard.svg', wrap((req, res) => {
  const row = db.prepare('SELECT * FROM cards WHERE slug = ?').get(req.params.slug)
  if (!row) return fail(res, 404, '名片不存在')
  const origin = originOf(req)
  const text = vcard.build(publicView(row, origin), origin)
  const size = Math.min(2000, Math.max(256, Number(req.query.size) || 520))
  const style = normalizeStyle(parseJson(row.qr_style, {}))
  res.type('image/svg+xml').set('Cache-Control', 'public, max-age=3600')
    .send(qr.svg(text, { size, fg: row.qr_fg || '#0f172a', bg: row.qr_bg || '#ffffff', logo: false, style }))
}))

// vCard 高清 PNG（保存用）：与 vcard.svg 同款样式，服务端 qr.png 统一渲染
router.get('/public/:slug/vcard.png', wrap(async (req, res) => {
  const row = db.prepare('SELECT * FROM cards WHERE slug = ?').get(req.params.slug)
  if (!row) return fail(res, 404, '名片不存在')
  const origin = originOf(req)
  const text = vcard.build(publicView(row, origin), origin)
  const size = Math.min(1600, Math.max(256, Number(req.query.size) || 720))
  const style = normalizeStyle(parseJson(row.qr_style, {}))
  const buf = await qr.png(text, { size, fg: row.qr_fg || '#0f172a', bg: row.qr_bg || '#ffffff', logo: false, style })
  res.type('png').set('Cache-Control', 'public, max-age=3600').send(buf)
}))

router.get('/public/:slug/card.vcf', wrap((req, res) => {
  const row = db.prepare('SELECT * FROM cards WHERE slug = ?').get(req.params.slug)
  if (!row) return fail(res, 404, '名片不存在')
  const origin = originOf(req)
  const text = vcard.build(publicView(row, origin), origin)
  res.set('Content-Type', 'text/vcard; charset=utf-8')
  // iOS Safari 只有「URL 以 .vcf 结尾 + 无 Content-Disposition: attachment」时才弹系统添加联系人；
  // 带 attachment 或带 ?query 都会退化成下载到「文件」。按 UA 自动识别，前端用纯 .vcf 直链即可。
  // 微信内 WKWebView 无法弹通讯录，仍返回 attachment（引导去外部浏览器）。
  const ua = String(req.headers['user-agent'] || '')
  const isIOS = /iPad|iPhone|iPod/.test(ua)
  const isWeChat = /MicroMessenger/i.test(ua)
  const inline = String(req.query.inline) === '1' || (isIOS && !isWeChat)
  if (!inline) {
    res.set('Content-Disposition', `attachment; filename="${encodeURIComponent(row.name || row.slug)}.vcf"`)
  }
  res.send(text)
}))

router.post('/public/:slug/exchange', wrap((req, res) => {
  const from = db.prepare('SELECT * FROM cards WHERE slug = ?').get(req.params.slug)
  const to = db.prepare('SELECT * FROM cards WHERE slug = ?').get(String(req.body?.slug || '').toLowerCase())
  if (!from || !to || from.id === to.id) return fail(res, 400, '交换失败：请确认对方名片链接')
  const r = db.prepare('INSERT OR IGNORE INTO card_exchanges (from_card_id, to_card_id) VALUES (?,?)').run(from.id, to.id)
  // 仅首次建立互换时提醒对方名片主人（UNIQUE 去重），失败不影响主流程
  if (r.changes) {
    try { notify.notifyOwner(to, NOTIFY_TYPES.NEW_EXCHANGE, from.name || '一位名片用户') } catch (e) { console.error('[Notify] 交换提醒失败', e.message) }
  }
  ok(res, { exchanged: true, with: req.body.slug })
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
  const mine = db.prepare('SELECT id FROM cards WHERE user_id = ?').get(req.user.id)
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

router.post('/mine', authRequired, wrap((req, res) => {
  const exists = db.prepare('SELECT id FROM cards WHERE user_id = ?').get(req.user.id)
  if (exists) return fail(res, 400, '每个账号仅可开通一张名片')
  const preferred = normalizeSlug(req.body?.slug)
  const slug = makeSlug(preferred || req.user.phone?.slice(-8))
  db.prepare('INSERT INTO cards (user_id, slug, name) VALUES (?,?,?)')
    .run(req.user.id, slug, req.user.nickname || '')
  const row = db.prepare('SELECT * FROM cards WHERE user_id = ?').get(req.user.id)
  ok(res, ownerView(row, originOf(req)))
}))

const FIELD_LABELS = {
  name: '姓名', name_en: '英文名', title: '职位', company: '公司', company_intro: '公司简介', department: '部门',
  mobile: '手机', phone: '座机', email: '邮箱', wechat: '微信', whatsapp: 'WhatsApp',
  address: '地址', address_detail: '门牌', province: '省', city: '城市', district: '区', street: '街道',
  website: '主页', shop_url: '店铺', bio: '简介', industry: '行业'
}

router.put('/mine', authRequired, wrap((req, res) => {
  const row = db.prepare('SELECT * FROM cards WHERE user_id = ?').get(req.user.id)
  if (!row) return fail(res, 404, '请先创建名片')
  const sets = []
  const values = []
  const changedLabels = []
  for (const key of EDITABLE) {
    if (!(key in (req.body || {}))) continue
    let v = req.body[key]
    if (['tags', 'links'].includes(key)) {
      const arr = typeof v === 'string' ? parseJson(v, []) : v
      if (!Array.isArray(arr)) return fail(res, 400, `${key} 格式不正确`)
      v = JSON.stringify(arr.slice(0, 20).map(x => typeof x === 'string' ? x.slice(0, 30) : x))
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
      v = String(v ?? '').slice(0, 2000)
    }
    if (CARD_WATCH_FIELDS.includes(key) && String(row[key] ?? '') !== String(v ?? '')) {
      changedLabels.push(FIELD_LABELS[key] || key)
    }
    sets.push(`${key} = ?`)
    values.push(v)
  }
  // 自愈：主动开启集市上架时，若名片仍停留在 draft，同步激活为 active。
  // 否则前端显示「已上架」但集市 SQL（status='active'）永远查不到，用户困惑。
  // 注意：仅限 draft→active，绝不动其它 status（如 expired/pending），也不改二维码。
  let activateOnMarket = false
  if (req.body && 'market_opt_in' in req.body && Number(req.body.market_opt_in) && row.status === 'draft') {
    sets.push("status = 'active'")
    activateOnMarket = true
  }
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
