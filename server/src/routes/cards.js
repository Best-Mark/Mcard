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
const vcard = require('../services/vcard')
const { CARD_TEMPLATES, isTemplate } = require('../utils/cardTemplates')
const { INDUSTRIES, CITIES, isIndustry, normalizeIndustry, distanceKm } = require('../utils/market')

const router = express.Router()

function cardLogo(row, asDataUrl = false) {
  if (!row?.logo || !/^\/uploads\/[A-Za-z0-9_.-]+$/.test(row.logo)) return ''
  const file = path.join(config.UPLOAD_DIR, path.basename(row.logo))
  if (!fs.existsSync(file)) return ''
  return asDataUrl ? `data:image/png;base64,${fs.readFileSync(file).toString('base64')}` : file
}

const EDITABLE = ['name', 'name_en', 'title', 'company', 'company_intro', 'department', 'phone', 'mobile', 'email',
  'wechat', 'alipay', 'whatsapp', 'wechat_qr', 'alipay_qr', 'wechat_pay_qr', 'alipay_pay_qr',
  'address', 'address_detail', 'website', 'shop_url', 'avatar', 'cover', 'logo', 'bio',
  'tags', 'links', 'template', 'industry', 'city', 'latitude', 'longitude', 'market_opt_in',
  'theme', 'accent', 'qr_fg', 'qr_bg', 'qr_logo']

const parseJson = (v, fallback) => { try { const x = JSON.parse(v); return x ?? fallback } catch { return fallback } }
const isColor = v => /^#[0-9a-fA-F]{6}$/.test(String(v || ''))

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
    website: row.website, shop_url: row.shop_url,
    avatar: row.avatar, cover: row.cover, logo: row.logo, bio: row.bio,
    tags: parseJson(row.tags, []), links: parseJson(row.links, []),
    template: isTemplate(row.template) ? row.template : 'classic',
    industry: normalizeIndustry(row.industry), city: row.city || '',
    latitude: row.latitude ?? null, longitude: row.longitude ?? null, market_opt_in: !!row.market_opt_in,
    theme: row.theme, accent: row.accent, qr_fg: row.qr_fg, qr_bg: row.qr_bg, qr_logo: !!row.qr_logo,
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
    city: row.city || '', distanceKm: distance,
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

// 名片集市元数据（行业清单 + 内置城市坐标）——固定路径，必须在 /public/:slug 之前
router.get('/public/market/meta', wrap((req, res) => {
  res.set('Cache-Control', 'public, max-age=3600')
  ok(res, { industries: INDUSTRIES, cities: CITIES })
}))

// 名片集市：按距离发现附近、行业对口、关键词命中的上架名片
// 只返回 market_opt_in=1 且 active 且未过期的名片；隐私字段一律不返回
router.get('/public/market', wrap((req, res) => {
  const industry = String(req.query.industry || '').slice(0, 40)
  const q = String(req.query.q || '').trim().slice(0, 60)
  const city = String(req.query.city || '').trim().slice(0, 30)
  const limit = Math.min(60, Math.max(1, Number(req.query.limit) || 30))

  // 定位原点：优先精确经纬度，否则用城市名匹配内置坐标
  let originLat = null, originLng = null
  const la = Number(req.query.lat), ln = Number(req.query.lng)
  if (Number.isFinite(la) && Number.isFinite(ln) && Math.abs(la) <= 90 && Math.abs(ln) <= 180) {
    originLat = la; originLng = ln
  } else if (city) {
    const hit = CITIES.find(c => c.name === city || c.name.includes(city) || city.includes(c.name))
    if (hit) { originLat = hit.lat; originLng = hit.lng }
  }

  let rows = db.prepare("SELECT * FROM cards WHERE market_opt_in = 1 AND status = 'active'").all()
  const now = new Date()
  rows = rows.filter(r => !r.expires_at || new Date(String(r.expires_at).replace(' ', 'T') + 'Z') >= now)
  if (industry && isIndustry(industry)) rows = rows.filter(r => normalizeIndustry(r.industry) === industry)
  if (city) rows = rows.filter(r => (r.city || '').includes(city))
  if (q) {
    const needle = q.toLowerCase()
    rows = rows.filter(r => [r.name, r.name_en, r.title, r.company, r.bio, r.city, r.tags, r.industry]
      .join(' ').toLowerCase().includes(needle))
  }
  const origin = originOf(req)
  const list = rows.map(r => marketView(r, originLat, originLng, origin))
  // 排序：有原点时距离近优先（无坐标的排末尾），再按浏览量；无原点时纯按浏览量
  list.sort((a, b) => {
    if (originLat != null) {
      if (a.distanceKm == null && b.distanceKm != null) return 1
      if (a.distanceKm != null && b.distanceKm == null) return -1
      if (a.distanceKm != b.distanceKm) return a.distanceKm - b.distanceKm
    }
    return b.views - a.views
  })
  ok(res, { list: list.slice(0, limit), total: list.length, origin: originLat != null ? { lat: originLat, lng: originLng } : null })
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
    db.prepare('INSERT INTO card_views (card_id, ip, ua, referer) VALUES (?,?,?,?)')
      .run(row.id, req.ip || '', String(req.headers['user-agent'] || '').slice(0, 300), String(req.headers.referer || '').slice(0, 500))
    db.prepare('UPDATE cards SET views = views + 1 WHERE id = ?').run(row.id)
    row.views += 1
  }
  ok(res, publicView(row, originOf(req)))
}))

router.get('/public/:slug/qr.svg', wrap((req, res) => {
  const row = db.prepare('SELECT slug, qr_fg, qr_bg, qr_logo, logo FROM cards WHERE slug = ?').get(req.params.slug)
  if (!row) return fail(res, 404, '名片不存在')
  const size = Math.min(2000, Math.max(64, Number(req.query.size) || 360))
  const brand = String(req.query.brand || 'M').slice(0, 2)
  const logoImage = row.qr_logo ? cardLogo(row, true) : ''
  res.type('image/svg+xml').set('Cache-Control', 'public, max-age=3600')
    .send(qr.svg(requestUrl(req, `/c/${row.slug}`), { size, fg: row.qr_fg, bg: row.qr_bg, logo: !!row.qr_logo, brand, logoImage }))
}))

router.get('/public/:slug/qr.png', wrap(async (req, res) => {
  const row = db.prepare('SELECT slug, qr_fg, qr_bg, qr_logo, logo FROM cards WHERE slug = ?').get(req.params.slug)
  if (!row) return fail(res, 404, '名片不存在')
  const size = Math.min(2000, Math.max(128, Number(req.query.size) || 720))
  const logoImage = row.qr_logo ? cardLogo(row) : ''
  const buf = await qr.png(requestUrl(req, `/c/${row.slug}`), { size, fg: row.qr_fg, bg: row.qr_bg, logoImage })
  res.type('png').set('Cache-Control', 'public, max-age=3600').send(buf)
}))

router.get('/public/:slug/card.vcf', wrap((req, res) => {
  const row = db.prepare('SELECT * FROM cards WHERE slug = ?').get(req.params.slug)
  if (!row) return fail(res, 404, '名片不存在')
  const origin = originOf(req)
  const text = vcard.build(publicView(row, origin), origin)
  res.type('text/vcard; charset=utf-8')
    .set('Content-Disposition', `attachment; filename="${encodeURIComponent(row.name || row.slug)}.vcf"`)
    .send(text)
}))

router.post('/public/:slug/exchange', wrap((req, res) => {
  const from = db.prepare('SELECT id FROM cards WHERE slug = ?').get(req.params.slug)
  const to = db.prepare('SELECT id FROM cards WHERE slug = ?').get(String(req.body?.slug || '').toLowerCase())
  if (!from || !to || from.id === to.id) return fail(res, 400, '交换失败：请确认对方名片链接')
  db.prepare('INSERT OR IGNORE INTO card_exchanges (from_card_id, to_card_id) VALUES (?,?)').run(from.id, to.id)
  ok(res, { exchanged: true, with: req.body.slug })
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

router.put('/mine', authRequired, wrap((req, res) => {
  const row = db.prepare('SELECT * FROM cards WHERE user_id = ?').get(req.user.id)
  if (!row) return fail(res, 404, '请先创建名片')
  const sets = []
  const values = []
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
    } else {
      v = String(v ?? '').slice(0, 2000)
    }
    sets.push(`${key} = ?`)
    values.push(v)
  }
  if (!sets.length) return fail(res, 400, '没有需要更新的字段')
  // 铁律：slug / status / expires_at / views 绝不在更新白名单内 —— 改资料不动二维码
  sets.push("updated_at = datetime('now')")
  db.prepare(`UPDATE cards SET ${sets.join(', ')} WHERE id = ?`).run(...values, row.id)
  ok(res, ownerView(db.prepare('SELECT * FROM cards WHERE id = ?').get(row.id), originOf(req)))
}))

router.get('/mine/stats', authRequired, wrap((req, res) => {
  const card = db.prepare('SELECT id, views FROM cards WHERE user_id = ?').get(req.user.id)
  if (!card) return ok(res, { views: 0, exchanges: 0, daily: [] })
  const exchanges = db.prepare('SELECT COUNT(*) AS n FROM card_exchanges WHERE from_card_id = ? OR to_card_id = ?').get(card.id, card.id).n
  const daily = db.prepare(`SELECT date(created_at) AS day, COUNT(*) AS n FROM card_views
    WHERE card_id = ? GROUP BY date(created_at) ORDER BY day DESC LIMIT 14`).all(card.id)
  ok(res, { views: card.views || 0, exchanges, daily })
}))

module.exports = router
module.exports.publicView = publicView
