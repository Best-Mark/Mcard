// H5 宣传页（2026-11-27 新模块）：名片附属营销页，JSON schema 驱动，公开访问 /h5/:slug。
// 商业口径（用户定稿）：套餐权益分层——免费 1 个/≤3 页/尾页水印；付费 10 个/≤12 页/可去水印。
// 自由画布（2026-11-27 用户定稿上 MAKA 同款）：页内元素 els 绝对定位自由拖动/缩放/旋转，
// 老 blocks 流式路径原样兼容（存量页公开渲染零破坏）；渲染器唯一真相源在前端 H5Render.vue。
const express = require('express')
const db = require('../db')
const { ok, fail } = require('../utils/response')
const { authRequired, parseToken } = require('../utils/auth')
const { makeSlug } = require('../utils/slug')
const { TEMPLATES, getTemplate } = require('../utils/h5Templates')

const router = express.Router()

// 套餐权益分层（唯一真相源）：与 cardPlanActive 同口径（cards.status=active 且未过期或终身）
const FREE_MAX_PAGES = 3, PAID_MAX_PAGES = 12
const FREE_MAX_H5 = 1, PAID_MAX_H5 = 10
const BLOCK_TYPES = ['cover', 'text', 'hero', 'gallery', 'contact', 'map', 'buttons', 'video', 'music', 'form', 'endcard']
// 块入场动效白名单（2026-11-27 编辑体验一流化）：'' = 未设置（渲染层按块类型智能默认），'none' = 显式关闭
const BLOCK_ANIMS = ['none', 'up', 'fade', 'zoom', 'left', 'right']
// 页面切换过渡（2026-11-28 用户定稿「每页全屏 + 翻页动效」）：slide=滑动推入（默认）/ fade=淡入淡出 / flip=3D 翻页；
// 旧 scroll（原生滚动）不再单独支持，清洗时并入默认 slide（渲染层对 scroll 值也按 slide 兜底）
const TRANSITIONS = ['slide', 'fade', 'flip']
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

// schema 校验与瘦身：类型白名单、字符串截断、数量上限——脏数据在门口拦住，渲染层永远拿到干净结构。
// 2026-11-27 自由画布（用户定稿推翻「不做自由画布」）：页内元素 els = 类型字段 + 几何 g{x,y,w,h,rot,opacity,z}，
// 画布设计宽 750（渲染等比缩放）；text/image/shape/button 为自由元素，gallery/form/… 为组件元素（字段同块）。
// 老 blocks 路径原样保留（存量页公开渲染零破坏），同页 els 优先。
const EL_TYPES = ['text', 'image', 'shape', 'button', 'gallery', 'contact', 'map', 'buttons', 'video', 'form', 'music', 'endcard']
const EL_FONTS = ['', 'serif', 'kaiti'] // 黑体默认 / 衬线宋 / 楷体（全平台安全字体族）
const EL_SHAPES = ['rect', 'round', 'circle', 'line']
const hex = v => (/^#[0-9a-fA-F]{6}$/.test(String(v || '')) ? String(v) : '')
const num = (v, min, max, dft) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dft }

// 各类型字段清洗（blocks 与 els 共用）：free=true 走自由元素字段，false 走老块字段
function sanitizeFields(type, b, free) {
  const out = { type, anim: BLOCK_ANIMS.includes(b?.anim) ? b.anim : '' }
  if (type === 'text' && free) Object.assign(out, {
    text: str(b.text, 300), size: Math.round(num(b.size, 12, 200, 32)),
    color: hex(b.color) || '#ffffff', align: ['left', 'center', 'right'].includes(b.align) ? b.align : 'left',
    bold: !!b.bold, font: EL_FONTS.includes(b.font) ? b.font : '', lh: num(b.lh, 1, 3, 1.5)
  })
  if (type === 'text' && !free) Object.assign(out, {
    heading: str(b.heading, 40), body: str(b.body, 1200),
    // 文字基础样式（2026-11-27 路线④）：对齐 + 字号，脏值收敛默认
    align: ['left', 'center', 'right'].includes(b.align) ? b.align : 'left',
    size: ['sm', 'md', 'lg'].includes(b.size) ? b.size : 'md'
  })
  if (type === 'cover') Object.assign(out, { title: str(b.title, 40), subtitle: str(b.subtitle, 60), cover: str(b.cover, 500) })
  if (type === 'hero') Object.assign(out, { image: str(b.image, 500), title: str(b.title, 40), desc: str(b.desc, 300) })
  if (type === 'image' && free) Object.assign(out, { url: str(b.url, 500), radius: Math.round(num(b.radius, 0, 200, 0)), fit: ['cover', 'contain'].includes(b.fit) ? b.fit : 'cover' })
  if (type === 'shape' && free) Object.assign(out, { shape: EL_SHAPES.includes(b.shape) ? b.shape : 'rect', color: hex(b.color) || '#ffffff', radius: Math.round(num(b.radius, 0, 400, 0)) })
  if (type === 'button' && free) Object.assign(out, {
    label: str(b.label, 12), action: ['tel', 'wechat', 'link', 'copy'].includes(b.action) ? b.action : 'tel', value: str(b.value, 200),
    color: hex(b.color) || '#ffffff', bg: hex(b.bg) || '#a62b2b', radius: Math.round(num(b.radius, 0, 400, 22))
  })
  if (type === 'gallery') Object.assign(out, {
    images: (Array.isArray(b.images) ? b.images : []).slice(0, 9).map(u => str(u, 500)),
    // layout: showcase=动效展播（自动轮播，2026-11-27）/ swipe / grid / stagger=错落双列（2026-11-27 路线④）；source: 'card'=图片自动取自公司相册
    layout: ['showcase', 'swipe', 'grid', 'stagger'].includes(b.layout) ? b.layout : 'grid',
    source: b.source === 'card' ? 'card' : 'upload'
  })
  if (type === 'contact') Object.assign(out, { showMobile: b.showMobile !== false, showWechat: b.showWechat !== false, showAddress: b.showAddress !== false })
  if (type === 'map') Object.assign(out, { lat: Number.isFinite(+b.lat) ? +b.lat : null, lng: Number.isFinite(+b.lng) ? +b.lng : null, label: str(b.label, 80) })
  // 按钮 action 白名单 2026-11-27 加 copy（复制任意文本）
  if (type === 'buttons') Object.assign(out, { items: (Array.isArray(b.items) ? b.items : []).slice(0, 3).map(i => ({ label: str(i?.label, 12), action: ['tel', 'wechat', 'link', 'copy'].includes(i?.action) ? i.action : 'tel', value: str(i?.value, 200) })) })
  if (type === 'video') Object.assign(out, { url: str(b.url, 500), poster: str(b.poster, 500) })
  // 表单留资块（2026-11-27）：字段开关+按钮/成功文案；提交内容落 h5_leads，schema 只存展示配置
  if (type === 'form') Object.assign(out, {
    heading: str(b.heading, 40),
    desc: str(b.desc, 120),
    showName: b.showName !== false,
    showPhone: b.showPhone !== false,
    showMessage: b.showMessage !== false,
    buttonText: str(b.buttonText, 12) || '提交',
    successText: str(b.successText, 60) || '已收到，我们会尽快联系你'
  })
  // 背景音乐块（2026-11-27 路线③）：仅存音频地址与自动播放意愿，公开页浮动 ♪ 开关承载播放控制
  if (type === 'music') Object.assign(out, { url: str(b.url, 500), autoplay: b.autoplay !== false })
  return out
}

// 几何清洗（自由画布）：设计单位（画布宽 750、页高锁死 1334 = 9:16 一屏），数值限幅防脏数据撑爆布局
function sanitizeG(g) {
  return {
    x: num(g?.x, -750, 2250, 0), y: num(g?.y, -400, 1500, 0),
    w: num(g?.w, 16, 750, 320), h: num(g?.h, 16, 1500, 120),
    rot: num(g?.rot, -180, 180, 0), opacity: num(g?.opacity, 0, 1, 1),
    z: Math.round(num(g?.z, 0, 999, 0))
  }
}

function sanitizeSchema(raw, maxPages) {
  const accent = hex(raw?.accent)
  // 页面切换过渡动效（2026-11-28 用户定稿）：slide（默认）/ fade / flip
  const transition = TRANSITIONS.includes(raw?.transition) ? raw.transition : 'slide'
  const pagesIn = Array.isArray(raw?.pages) ? raw.pages.slice(0, maxPages) : []
  if (!pagesIn.length) return { transition: 'slide', pages: [{ blocks: [{ type: 'cover', title: '', subtitle: '', cover: '' }] }] }
  const pages = pagesIn.map(p => {
    const bg = { color: hex(p?.bg?.color), image: str(p?.bg?.image, 500) } // 页面背景（自由画布）
    const els = (Array.isArray(p?.els) ? p.els : []).slice(0, 40).map(e => {
      const type = EL_TYPES.includes(e?.type) ? e.type : 'text'
      return { ...sanitizeFields(type, e, true), g: sanitizeG(e?.g) }
    })
    if (els.length) return { bg, els }
    const blocks = (Array.isArray(p?.blocks) ? p.blocks : []).slice(0, 8).map(b => sanitizeFields(BLOCK_TYPES.includes(b?.type) ? b.type : 'text', b, false))
    return { bg, blocks: blocks.length ? blocks : [{ type: 'text', heading: '', body: '' }] }
  })
  return { accent, transition, pages }
}
const pageCount = s => Array.isArray(s?.pages) ? s.pages.length : 0

const listView = r => ({
  id: r.id, title: r.title, slug: r.slug, status: r.status, view_count: r.view_count,
  card_linked: !!r.card_linked,
  // pending = 已上架但草稿与线上版本不一致（有改动待同步）：编辑只写草稿，公开页仍走 live_schema
  pending: r.status === 'published' && !!(r.live_schema && r.live_schema !== r.schema),
  pages: pageCount(JSON.parse(r.schema || '{}')), updated_at: r.updated_at,
  leads: db.prepare('SELECT COUNT(*) n FROM h5_leads WHERE page_id = ?').get(r.id).n
})

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

// 宣传页统计聚合（2026-11-28 用户定稿：统计与线索收进个人中心「浏览统计」页，列表行不再承载）
// 一次带回：各宣传页浏览/线索概览 + 线索明细（近 100 条，最新在前）；线索删除复用单页端点 /:id/leads/:leadId
router.get('/mine/stats', authRequired, (req, res) => {
  const pages = db.prepare('SELECT id, title, status, view_count FROM h5_pages WHERE user_id = ? ORDER BY id DESC').all(req.user.id)
  const ids = pages.map(p => p.id)
  const leadCount = db.prepare('SELECT COUNT(*) n FROM h5_leads WHERE page_id = ?')
  const promos = pages.map(p => ({ id: p.id, title: p.title, status: p.status, views: p.view_count || 0, leads: leadCount.get(p.id).n }))
  const leads = ids.length
    ? db.prepare(`SELECT l.id, l.page_id, l.name, l.phone, l.message, l.created_at, p.title AS page_title
                  FROM h5_leads l JOIN h5_pages p ON p.id = l.page_id
                  WHERE l.page_id IN (${ids.map(() => '?').join(',')}) ORDER BY l.id DESC LIMIT 100`).all(...ids)
    : []
  ok(res, { promos, views: promos.reduce((s, p) => s + p.views, 0), leads_total: leads.length, leads })
})

// 新建：template_key 套官方模板 / schema 自带；闸门（数量）在创建前判
router.post('/', authRequired, (req, res) => {
  const lim = limitsOf(req.user.id)
  const count = db.prepare('SELECT COUNT(*) n FROM h5_pages WHERE user_id = ?').get(req.user.id).n
  if (count >= lim.maxH5) return fail(res, 400, lim.paid ? `最多创建 ${lim.maxH5} 个宣传页` : '免费版最多创建 1 个宣传页，开通套餐解锁更多')
  const tpl = req.body?.template_key ? getTemplate(req.body.template_key) : null
  // 模板的 accent/transition 要随 pages 一起进清洗（原先只传 pages，模板主色/切换动效建完即丢）
  const schema = sanitizeSchema(tpl ? { accent: tpl.accent, transition: tpl.transition, pages: tpl.pages } : req.body?.schema, lim.maxPages)
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
  // 回带 pending：前端保存后即时刷新「有改动待同步」徽标（草稿文本与线上文本比，同口径同清洗→字符串可比）
  ok(res, { pending: row.status === 'published' && !!(row.live_schema && row.live_schema !== JSON.stringify(schema)) })
})

router.post('/:id/publish', authRequired, (req, res) => {
  const row = owned(req, res); if (!row) return
  // 上架 = 草稿发布到线上双版本（2026-11-28 用户定稿）：live_schema ← 当前草稿，公开页从此读线上版；
  // 编辑只落草稿不自动同步，再次「更新上架」才把改动推到线上。首次上架自动关联名片，
  // 再次更新不覆盖用户在宣传页侧做的取消关联。
  db.prepare("UPDATE h5_pages SET status = 'published', live_schema = schema, card_linked = CASE WHEN status = 'draft' THEN 1 ELSE card_linked END, updated_at = datetime('now') WHERE id = ?").run(row.id)
  const after = db.prepare('SELECT card_linked FROM h5_pages WHERE id = ?').get(row.id)
  ok(res, { card_linked: !!after?.card_linked })
})

// 关联名片开关（2026-11-27 一对多定稿）：操作收在宣传页侧（不在名片侧指定，防乱），
// 开=已发布时名片公开页出现本页入口；名片可同时挂多条（按更新时间排列，上限 6）。
router.post('/:id/card-link', authRequired, (req, res) => {
  const row = owned(req, res); if (!row) return
  const linked = req.body?.linked === true || req.body?.linked === 1 || req.body?.linked === '1'
  db.prepare('UPDATE h5_pages SET card_linked = ? WHERE id = ?').run(linked ? 1 : 0, row.id)
  ok(res, { card_linked: linked })
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
  // 2026-11-28 用户定稿：未上架/已下架的宣传页本人也能打开看——软鉴权 parseToken 判属主，
  // 非属主仍 404（访客零感知）；属主浏览草稿不计入浏览量、不带分享卡
  const row = db.prepare('SELECT * FROM h5_pages WHERE slug = ?').get(req.params.slug)
  const owner = parseToken(req)
  const isOwner = !!(owner && row && row.user_id === owner.id)
  if (!row || (row.status !== 'published' && !isOwner)) return fail(res, 404, '宣传页不存在或未发布')
  const card = db.prepare('SELECT id, user_id, slug, name, title, company, avatar, logo, mobile, phone, wechat, address FROM cards WHERE id = ?').get(row.card_id)
  // 公司相册图（2026-11-27）：图集块 source='card' 的图片源——与名片页同一份 card_materials，
  // 图片 URL 列表挂到 card.gallery，前端 H5Render galImgs 消费；无相册时为 []，块渲染占位。
  let gallery = []
  if (card) {
    try {
      gallery = db.prepare("SELECT url FROM card_materials WHERE card_id = ? AND type = 'file' ORDER BY sort ASC, id ASC").all(card.id)
        .map(r => String(r.url || ''))
        .filter(u => /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(u))
    } catch { gallery = [] }
  }
  ok(res, {
    page: {
      title: row.title,
      // 线上双版本（2026-11-28）：已上架读 live_schema（编辑草稿不外泄，点上架才同步）；
      // live_schema 为空的存量行回落 schema 兼容。未上架（属主预览）仍读草稿。
      schema: JSON.parse(row.status === 'published' ? (row.live_schema || row.schema) : row.schema || '{}'),
      slug: row.slug, view_count: row.view_count,
      updated_at: row.updated_at,
      draft: row.status !== 'published',
      watermark: !planActiveOf(row.user_id)
    },
    card: card ? {
      slug: card.slug, name: card.name, title: card.title, company: card.company,
      avatar: card.avatar, logo: card.logo, mobile: card.mobile, phone: card.phone, wechat: card.wechat, address: card.address,
      gallery
    } : null
  })
  if (row.status === 'published') db.prepare('UPDATE h5_pages SET view_count = view_count + 1 WHERE id = ?').run(row.id)
})

// ---------- 表单留资（2026-11-27）：访客匿名提交 → h5_leads；页主查看/删除 ----------
// 公开提交：published 页才收；姓名/电话至少一项、留言可选，字段截断防脏数据；无鉴权（访客不登录）。
router.post('/public/:slug/leads', (req, res) => {
  const row = db.prepare("SELECT id FROM h5_pages WHERE slug = ? AND status = 'published'").get(req.params.slug)
  if (!row) return fail(res, 404, '宣传页不存在或未发布')
  const name = str(req.body?.name, 30)
  const phone = str(req.body?.phone, 30)
  const message = str(req.body?.message, 300)
  if (!name && !phone) return fail(res, 400, '请至少填写姓名或电话')
  db.prepare('INSERT INTO h5_leads (page_id, name, phone, message) VALUES (?,?,?,?)').run(row.id, name, phone, message)
  ok(res, {})
})

// 页主查看线索（分页，最新在前）
router.get('/:id/leads', authRequired, (req, res) => {
  const row = owned(req, res); if (!row) return
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50))
  const offset = Math.max(0, Number(req.query.offset) || 0)
  const total = db.prepare('SELECT COUNT(*) n FROM h5_leads WHERE page_id = ?').get(row.id).n
  const list = db.prepare('SELECT id, name, phone, message, created_at FROM h5_leads WHERE page_id = ? ORDER BY id DESC LIMIT ? OFFSET ?')
    .all(row.id, limit, offset)
  ok(res, { list, total })
})

// 删除单条线索（误提交/骚扰信息可清）
router.delete('/:id/leads/:leadId', authRequired, (req, res) => {
  const row = owned(req, res); if (!row) return
  db.prepare('DELETE FROM h5_leads WHERE id = ? AND page_id = ?').run(req.params.leadId, row.id)
  ok(res, {})
})

module.exports = router
