const express = require('express')
const fs = require('fs')
const path = require('path')
const db = require('../db')
const config = require('../config')
const { ok, fail, wrap } = require('../utils/response')
const { authRequired, parseToken } = require('../utils/auth')
const { makeSlug, normalizeSlug } = require('../utils/slug')
const qr = require('../services/qrcode')
const vcard = require('../services/vcard')

const router = express.Router()

function cardLogo(row, asDataUrl = false) {
  if (!row?.logo || !/^\/uploads\/[A-Za-z0-9_.-]+$/.test(row.logo)) return ''
  const file = path.join(config.UPLOAD_DIR, path.basename(row.logo))
  if (!fs.existsSync(file)) return ''
  return asDataUrl ? `data:image/png;base64,${fs.readFileSync(file).toString('base64')}` : file
}

const EDITABLE = ['name', 'name_en', 'title', 'company', 'company_intro', 'department', 'phone', 'mobile', 'email',
  'wechat', 'whatsapp', 'address', 'address_detail', 'website', 'avatar', 'cover', 'logo', 'bio',
  'tags', 'links', 'theme', 'accent', 'qr_fg', 'qr_bg', 'qr_logo']

const parseJson = (v, fallback) => { try { const x = JSON.parse(v); return x ?? fallback } catch { return fallback } }
const isColor = v => /^#[0-9a-fA-F]{6}$/.test(String(v || ''))

function publicView(row) {
  const now = new Date()
  const expired = row.expires_at && new Date(String(row.expires_at).replace(' ', 'T') + 'Z') < now
  return {
    slug: row.slug,
    url: `${config.BASE_URL}/c/${row.slug}`,
    name: row.name, name_en: row.name_en, title: row.title, company: row.company,
    company_intro: row.company_intro || '',
    department: row.department, phone: row.phone, mobile: row.mobile, email: row.email,
    wechat: row.wechat, whatsapp: row.whatsapp, address: row.address, address_detail: row.address_detail,
    website: row.website, avatar: row.avatar, cover: row.cover, logo: row.logo, bio: row.bio,
    tags: parseJson(row.tags, []), links: parseJson(row.links, []),
    theme: row.theme, accent: row.accent, qr_fg: row.qr_fg, qr_bg: row.qr_bg, qr_logo: !!row.qr_logo,
    active: row.status === 'active' && !expired,
    expiresAt: row.expires_at, views: row.views
  }
}

function ownerView(row) {
  return { ...publicView(row), id: row.id, status: row.status, createdAt: row.created_at }
}

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
  ok(res, publicView(row))
}))

router.get('/public/:slug/qr.svg', wrap((req, res) => {
  const row = db.prepare('SELECT slug, qr_fg, qr_bg, qr_logo, logo FROM cards WHERE slug = ?').get(req.params.slug)
  if (!row) return fail(res, 404, '名片不存在')
  const size = Math.min(2000, Math.max(64, Number(req.query.size) || 360))
  const brand = String(req.query.brand || 'M').slice(0, 2)
  const logoImage = row.qr_logo ? cardLogo(row, true) : ''
  res.type('image/svg+xml').set('Cache-Control', 'public, max-age=3600')
    .send(qr.svg(`${config.BASE_URL}/c/${row.slug}`, { size, fg: row.qr_fg, bg: row.qr_bg, logo: !!row.qr_logo, brand, logoImage }))
}))

router.get('/public/:slug/qr.png', wrap(async (req, res) => {
  const row = db.prepare('SELECT slug, qr_fg, qr_bg, qr_logo, logo FROM cards WHERE slug = ?').get(req.params.slug)
  if (!row) return fail(res, 404, '名片不存在')
  const size = Math.min(2000, Math.max(128, Number(req.query.size) || 720))
  const logoImage = row.qr_logo ? cardLogo(row) : ''
  const buf = await qr.png(`${config.BASE_URL}/c/${row.slug}`, { size, fg: row.qr_fg, bg: row.qr_bg, logoImage })
  res.type('png').set('Cache-Control', 'public, max-age=3600').send(buf)
}))

router.get('/public/:slug/card.vcf', wrap((req, res) => {
  const row = db.prepare('SELECT * FROM cards WHERE slug = ?').get(req.params.slug)
  if (!row) return fail(res, 404, '名片不存在')
  const text = vcard.build(publicView(row), config.BASE_URL)
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
  ok(res, row ? ownerView(row) : null)
}))

router.post('/mine', authRequired, wrap((req, res) => {
  const exists = db.prepare('SELECT id FROM cards WHERE user_id = ?').get(req.user.id)
  if (exists) return fail(res, 400, '每个账号仅可开通一张名片')
  const preferred = normalizeSlug(req.body?.slug)
  const slug = makeSlug(preferred || req.user.phone?.slice(-8))
  db.prepare('INSERT INTO cards (user_id, slug, name) VALUES (?,?,?)')
    .run(req.user.id, slug, req.user.nickname || '')
  const row = db.prepare('SELECT * FROM cards WHERE user_id = ?').get(req.user.id)
  ok(res, ownerView(row))
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
  ok(res, ownerView(db.prepare('SELECT * FROM cards WHERE id = ?').get(row.id)))
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
