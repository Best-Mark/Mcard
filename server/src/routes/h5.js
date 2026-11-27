// H5 宣传页（2026-11-27 新模块）：名片附属营销页，JSON schema 驱动，公开访问 /h5/:slug。
// 商业口径（用户定稿）：套餐权益分层——免费 1 个/≤3 页/尾页水印；付费 10 个/≤12 页/可去水印。
// 块编辑而非自由画布：小白 5 分钟出片；渲染器唯一真相源在前端 H5Render.vue（H5 公开页/编辑预览共用）。
const express = require('express')
const db = require('../db')
const { ok, fail } = require('../utils/response')
const { authRequired } = require('../utils/auth')
const { makeSlug } = require('../utils/slug')
const { TEMPLATES, getTemplate } = require('../utils/h5Templates')

const router = express.Router()

// 套餐权益分层（唯一真相源）：与 cardPlanActive 同口径（cards.status=active 且未过期或终身）
const FREE_MAX_PAGES = 3, PAID_MAX_PAGES = 12
const FREE_MAX_H5 = 1, PAID_MAX_H5 = 10
const BLOCK_TYPES = ['cover', 'text', 'hero', 'gallery', 'contact', 'map', 'buttons', 'video', 'endcard']
// 块入场动效白名单（2026-11-27 编辑体验一流化）：'' = 未设置（渲染层按块类型智能默认），'none' = 显式关闭
const BLOCK_ANIMS = ['none', 'up', 'fade', 'zoom', 'left', 'right']
const str = (v, max) => String(v ?? '').slice(0, max)

function planActiveOf(userId) {
  const card = db.prepare("SELECT status, expires_at FROM cards WHERE user_id = ? ORDER BY id DESC LIMIT 1").get(userId)
  if (!card || card.status !== 'active') return false
  if (!card.expires_at) return true
  return new Date(String(card.expires_at).replace(' ', 'T') + 'Z') >= new Date()
}
function limitsOf(userId) {
  const paid = planActiveOf(userId)
  return { paid, maxH5: paid ? PAID_MAX_H5 : FREE_MAX_H5, maxPages: paid ? PAID_MAX_PAGES : FREE_MAX_PAGES }
}

// schema 校验与瘦身：块类型白名单、字符串截断、数量上限——脏数据在门口拦住，渲染层永远拿到干净结构
function sanitizeSchema(raw, maxPages) {
  const accent = /^#[0-9a-fA-F]{6}$/.test(String(raw?.accent || '')) ? String(raw.accent) : ''
  const pagesIn = Array.isArray(raw?.pages) ? raw.pages.slice(0, maxPages) : []
  if (!pagesIn.length) return { pages: [{ blocks: [{ type: 'cover', title: '', subtitle: '', cover: '' }] }] }
  const pages = pagesIn.map(p => {
    const blocks = (Array.isArray(p?.blocks) ? p.blocks : []).slice(0, 8).map(b => {
      const type = BLOCK_TYPES.includes(b?.type) ? b.type : 'text'
      const out = { type, anim: BLOCK_ANIMS.includes(b?.anim) ? b.anim : '' }
      if (type === 'cover') Object.assign(out, { title: str(b.title, 40), subtitle: str(b.subtitle, 60), cover: str(b.cover, 500) })
      if (type === 'text') Object.assign(out, { heading: str(b.heading, 40), body: str(b.body, 1200) })
      if (type === 'hero') Object.assign(out, { image: str(b.image, 500), title: str(b.title, 40), desc: str(b.desc, 300) })
      if (type === 'gallery') Object.assign(out, { images: (Array.isArray(b.images) ? b.images : []).slice(0, 9).map(u => str(u, 500)), layout: b.layout === 'swipe' ? 'swipe' : 'grid' })
      if (type === 'contact') Object.assign(out, { showMobile: b.showMobile !== false, showWechat: b.showWechat !== false, showAddress: b.showAddress !== false })
      if (type === 'map') Object.assign(out, { lat: Number.isFinite(+b.lat) ? +b.lat : null, lng: Number.isFinite(+b.lng) ? +b.lng : null, label: str(b.label, 80) })
      // 按钮 action 白名单 2026-11-27 加 copy（复制任意文本）
      if (type === 'buttons') Object.assign(out, { items: (Array.isArray(b.items) ? b.items : []).slice(0, 3).map(i => ({ label: str(i?.label, 12), action: ['tel', 'wechat', 'link', 'copy'].includes(i?.action) ? i.action : 'tel', value: str(i?.value, 200) })) })
      if (type === 'video') Object.assign(out, { url: str(b.url, 500), poster: str(b.poster, 500) })
      if (type === 'endcard') Object.assign(out, {})
      return out
    })
    return { blocks: blocks.length ? blocks : [{ type: 'text', heading: '', body: '' }] }
  })
  return { accent, pages }
}
const pageCount = s => Array.isArray(s?.pages) ? s.pages.length : 0

const listView = r => ({ id: r.id, title: r.title, slug: r.slug, status: r.status, view_count: r.view_count, pages: pageCount(JSON.parse(r.schema || '{}')), updated_at: r.updated_at })

function uniqueSlug() {
  for (let i = 0; i < 10; i++) {
    const s = 'h' + makeSlug()
    if (!db.prepare('SELECT 1 FROM h5_pages WHERE slug = ?').get(s)) return s
  }
  return 'h' + Date.now().toString(36)
}

// ---------- 管理端（登录） ----------
router.get('/templates', authRequired, (_req, res) => {
  ok(res, { list: TEMPLATES })
})

router.get('/mine', authRequired, (req, res) => {
  ok(res, {
    list: db.prepare('SELECT * FROM h5_pages WHERE user_id = ? ORDER BY id DESC').all(req.user.id).map(listView),
    // 闸门口径随列表下发：前端展示/引导与服务端强制同源，不各自猜
    limits: { ...limitsOf(req.user.id), watermark: !planActiveOf(req.user.id) }
  })
})

// 新建：template_key 套官方模板 / schema 自带；闸门（数量）在创建前判
router.post('/', authRequired, (req, res) => {
  const lim = limitsOf(req.user.id)
  const count = db.prepare('SELECT COUNT(*) n FROM h5_pages WHERE user_id = ?').get(req.user.id).n
  if (count >= lim.maxH5) return fail(res, 400, lim.paid ? `最多创建 ${lim.maxH5} 个宣传页` : '免费版最多创建 1 个宣传页，开通套餐解锁更多')
  const tpl = req.body?.template_key ? getTemplate(req.body.template_key) : null
  const schema = sanitizeSchema(tpl ? { pages: tpl.pages } : req.body?.schema, lim.maxPages)
  const title = str(req.body?.title || tpl?.name || '我的宣传页', 40)
  const card = db.prepare('SELECT id FROM cards WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(req.user.id)
  const r = db.prepare("INSERT INTO h5_pages (user_id, card_id, slug, title, schema, status) VALUES (?,?,?,?,?,'draft')")
    .run(req.user.id, card?.id || null, uniqueSlug(), title, JSON.stringify(schema))
  ok(res, { page: { ...listView(db.prepare('SELECT * FROM h5_pages WHERE id = ?').get(r.lastInsertRowid)) } })
})

function owned(req, res) {
  const row = db.prepare('SELECT * FROM h5_pages WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id)
  if (!row) { fail(res, 404, '宣传页不存在'); return null }
  return row
}

router.get('/:id', authRequired, (req, res) => {
  const row = owned(req, res); if (!row) return
  ok(res, { page: { ...listView(row), schema: JSON.parse(row.schema || '{}') } })
})

router.put('/:id', authRequired, (req, res) => {
  const row = owned(req, res); if (!row) return
  const lim = limitsOf(req.user.id)
  const title = str(req.body?.title || row.title, 40)
  // 页数闸门在清洗前判：清洗会静默截断，直接放行会让付费墙失效
  const rawPages = Array.isArray(req.body?.schema?.pages) ? req.body.schema.pages.length : 0
  if (rawPages > lim.maxPages) {
    return fail(res, 400, lim.paid ? `最多 ${lim.maxPages} 页` : `免费版最多 ${lim.maxPages} 页，开通套餐解锁`)
  }
  const schema = req.body?.schema ? sanitizeSchema(req.body.schema, lim.maxPages) : JSON.parse(row.schema || '{}')
  db.prepare("UPDATE h5_pages SET title = ?, schema = ?, updated_at = datetime('now') WHERE id = ?").run(title, JSON.stringify(schema), row.id)
  ok(res, {})
})

router.post('/:id/publish', authRequired, (req, res) => {
  const row = owned(req, res); if (!row) return
  db.prepare("UPDATE h5_pages SET status = 'published', updated_at = datetime('now') WHERE id = ?").run(row.id)
  ok(res, {})
})

router.post('/:id/unpublish', authRequired, (req, res) => {
  const row = owned(req, res); if (!row) return
  db.prepare("UPDATE h5_pages SET status = 'draft', updated_at = datetime('now') WHERE id = ?").run(row.id)
  ok(res, {})
})

router.delete('/:id', authRequired, (req, res) => {
  const row = owned(req, res); if (!row) return
  db.prepare('DELETE FROM h5_pages WHERE id = ?').run(row.id)
  ok(res, {})
})

// ---------- 公开端（免登录） ----------
// 公开渲染数据：published 才可访问；watermark 按创建者当前套餐实时算（过期自动带水印，续费即消失）
router.get('/public/:slug', (req, res) => {
  const row = db.prepare("SELECT * FROM h5_pages WHERE slug = ? AND status = 'published'").get(req.params.slug)
  if (!row) return fail(res, 404, '宣传页不存在或未发布')
  const card = db.prepare('SELECT id, user_id, slug, name, title, company, avatar, logo, mobile, phone, wechat, address FROM cards WHERE id = ?').get(row.card_id)
  ok(res, {
    page: {
      title: row.title, schema: JSON.parse(row.schema || '{}'), slug: row.slug, view_count: row.view_count,
      updated_at: row.updated_at,
      watermark: !planActiveOf(row.user_id)
    },
    card: card ? {
      slug: card.slug, name: card.name, title: card.title, company: card.company,
      avatar: card.avatar, logo: card.logo, mobile: card.mobile, phone: card.phone, wechat: card.wechat, address: card.address
    } : null
  })
  db.prepare('UPDATE h5_pages SET view_count = view_count + 1 WHERE id = ?').run(row.id)
})

module.exports = router
