const express = require('express')
const bcrypt = require('bcryptjs')
const db = require('../db')
const { ok, fail, wrap } = require('../utils/response')
const { sign, adminRequired, superRequired } = require('../utils/auth')
const updater = require('../services/updater')
const settings = require('../utils/settings')
const sms = require('../services/sms')
const oss = require('../services/oss')

const router = express.Router()
const parseJson = (v, f) => { try { return JSON.parse(v) ?? f } catch { return f } }

router.post('/login', wrap((req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(String(req.body?.phone || '').trim())
  if (!user || !bcrypt.compareSync(String(req.body?.password || ''), user.password_hash)) return fail(res, 400, '账号或密码不正确')
  if (!['admin', 'super_admin'].includes(user.role)) return fail(res, 403, '该账号无后台权限')
  if (user.status !== 'active') return fail(res, 403, '账号已停用')
  ok(res, { token: sign(user), user: { id: user.id, phone: user.phone, nickname: user.nickname, role: user.role } })
}))

router.get('/overview', adminRequired, wrap((_req, res) => {
  const count = (sql, ...args) => db.prepare(sql).get(...args).n
  const revenue = db.prepare("SELECT COALESCE(SUM(amount_cents),0) AS n FROM orders WHERE status = 'paid'").get().n
  const recentOrders = db.prepare(`SELECT o.id, o.order_no, o.amount_cents, o.status, o.created_at, p.name AS package_name, u.phone
    FROM orders o JOIN packages p ON p.id = o.package_id JOIN users u ON u.id = o.user_id
    ORDER BY o.id DESC LIMIT 6`).all()
  const recentCards = db.prepare(`SELECT c.id, c.slug, c.name, c.company, c.status, c.views, u.phone, c.created_at
    FROM cards c JOIN users u ON u.id = c.user_id ORDER BY c.id DESC LIMIT 6`).all()
  const todayViews = count("SELECT COUNT(*) AS n FROM card_views WHERE date(created_at) = date('now')")
  const trend = db.prepare("SELECT date(created_at) AS day, COUNT(*) AS n FROM card_views GROUP BY day ORDER BY day DESC LIMIT 14").all()
  ok(res, {
    users: count('SELECT COUNT(*) AS n FROM users WHERE role = ?', 'user'),
    cards: count('SELECT COUNT(*) AS n FROM cards'),
    activeCards: count("SELECT COUNT(*) AS n FROM cards WHERE status = 'active'"),
    paidOrders: count("SELECT COUNT(*) AS n FROM orders WHERE status = 'paid'"),
    revenueCents: revenue, todayViews,
    recentOrders, recentCards, trend
  })
}))

// ---------- 时段套餐 ----------
router.get('/packages', adminRequired, wrap((_req, res) => {
  const rows = db.prepare('SELECT * FROM packages ORDER BY sort ASC, id ASC').all()
  ok(res, rows.map(r => ({ ...r, features: parseJson(r.features, []) })))
}))

router.post('/packages', adminRequired, wrap((req, res) => {
  const { name, description = '', price_cents, duration_days, features = [], sort = 0, enabled = 1 } = req.body || {}
  // duration_days = 0 表示终身套餐
  if (!name || !(Number(price_cents) >= 0) || !(Number(duration_days) >= 0)) return fail(res, 400, '请填写套餐名称、价格与有效天数（0 表示终身）')
  const r = db.prepare('INSERT INTO packages (name, description, price_cents, duration_days, features, sort, enabled) VALUES (?,?,?,?,?,?,?)')
    .run(String(name).slice(0, 60), String(description).slice(0, 200), Math.round(Number(price_cents)), Math.round(Number(duration_days)),
      JSON.stringify(Array.isArray(features) ? features.slice(0, 12) : []), Number(sort) || 0, enabled ? 1 : 0)
  ok(res, { id: Number(r.lastInsertRowid) })
}))

router.put('/packages/:id', adminRequired, wrap((req, res) => {
  const row = db.prepare('SELECT * FROM packages WHERE id = ?').get(req.params.id)
  if (!row) return fail(res, 404, '套餐不存在')
  const b = req.body || {}
  const v = {
    name: b.name ?? row.name,
    description: b.description ?? row.description,
    price_cents: b.price_cents !== undefined ? Math.round(Number(b.price_cents)) : row.price_cents,
    duration_days: b.duration_days !== undefined ? Math.round(Number(b.duration_days)) : row.duration_days,
    features: JSON.stringify(Array.isArray(b.features) ? b.features.slice(0, 12) : parseJson(row.features, [])),
    sort: b.sort !== undefined ? Number(b.sort) || 0 : row.sort,
    enabled: b.enabled !== undefined ? (b.enabled ? 1 : 0) : row.enabled
  }
  if (!v.name || v.price_cents < 0 || v.duration_days < 0) return fail(res, 400, '套餐参数不合法（有效天数 0 表示终身）')
  db.prepare('UPDATE packages SET name=@name, description=@description, price_cents=@price_cents, duration_days=@duration_days, features=@features, sort=@sort, enabled=@enabled, updated_at=datetime(\'now\') WHERE id=@id')
    .run({ ...v, id: row.id })
  ok(res, { updated: true })
}))

router.delete('/packages/:id', adminRequired, wrap((req, res) => {
  const used = db.prepare('SELECT COUNT(*) AS n FROM orders WHERE package_id = ?').get(req.params.id).n
  if (used) {
    db.prepare('UPDATE packages SET enabled = 0 WHERE id = ?').run(req.params.id)
    return ok(res, { disabled: true, message: '已有订单关联，已下架而非删除' })
  }
  db.prepare('DELETE FROM packages WHERE id = ?').run(req.params.id)
  ok(res, { deleted: true })
}))

// ---------- 名片 ----------
router.get('/cards', adminRequired, wrap((req, res) => {
  const q = `%${String(req.query.q || '').slice(0, 50)}%`
  const status = String(req.query.status || '')
  const rows = db.prepare(`SELECT c.*, u.phone AS user_phone FROM cards c JOIN users u ON u.id = c.user_id
    WHERE (@q = '%' OR c.name LIKE @q OR c.company LIKE @q OR c.slug LIKE @q OR u.phone LIKE @q)
      AND (@status = '' OR c.status = @status)
    ORDER BY c.id DESC LIMIT 200`).all({ q, status })
  ok(res, rows.map(r => ({ ...r, tags: parseJson(r.tags, []), links: parseJson(r.links, []) })))
}))

router.put('/cards/:id/status', adminRequired, wrap((req, res) => {
  const s = String(req.body?.status || '')
  if (!['draft', 'active', 'expired', 'disabled'].includes(s)) return fail(res, 400, '状态不合法')
  const r = db.prepare("UPDATE cards SET status = ?, updated_at = datetime('now') WHERE id = ?").run(s, req.params.id)
  if (!r.changes) return fail(res, 404, '名片不存在')
  ok(res, { updated: true })
}))

// ---------- 订单 ----------
router.get('/orders', adminRequired, wrap((req, res) => {
  const status = String(req.query.status || '')
  const rows = db.prepare(`SELECT o.*, p.name AS package_name, u.phone AS user_phone, c.slug
    FROM orders o JOIN packages p ON p.id = o.package_id JOIN users u ON u.id = o.user_id
    LEFT JOIN cards c ON c.id = o.card_id
    WHERE (@status = '' OR o.status = @status) ORDER BY o.id DESC LIMIT 200`).all({ status })
  ok(res, rows)
}))

// ---------- 用户 ----------
router.get('/users', adminRequired, wrap((_req, res) => {
  const rows = db.prepare(`SELECT u.id, u.phone, u.nickname, u.role, u.status, u.created_at,
    (SELECT COUNT(*) FROM cards c WHERE c.user_id = u.id) AS card_count,
    (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id AND o.status = 'paid') AS paid_orders
    FROM users u ORDER BY u.id DESC LIMIT 300`).all()
  ok(res, rows)
}))

router.put('/users/:id/status', superRequired, wrap((req, res) => {
  const s = req.body?.status ? 'active' : 'disabled'
  const r = db.prepare("UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?").run(s, req.params.id)
  if (!r.changes) return fail(res, 404, '用户不存在')
  ok(res, { updated: true })
}))

// ---------- 配置中心（站点/支付/短信/小程序） ----------
router.get('/config', adminRequired, wrap((_req, res) => {
  // 分组定义随配置一起下发，前端据此类渲染表单，不各自硬编码键名
  ok(res, { values: settings.adminView(), groups: settings.GROUPS })
}))

// ---------- 短信测试 ----------
router.post('/sms/test', adminRequired, wrap(async (req, res) => {
  const phone = String(req.body?.phone || '').trim()
  const code = String(Math.floor(100000 + Math.random() * 900000))
  const r = await sms.sendCode(phone, code)
  ok(res, { sent: true, bizId: r.bizId })
}))

// ---------- 版本检查与更新 ----------
router.get('/update/status', adminRequired, wrap((_req, res) => {
  ok(res, {
    current: updater.currentVersion(), commit: updater.currentCommit(),
    runningCommit: updater.runningCommit(), needsRestart: updater.needsRestart(),
    config: updater.getConfig(), busy: updater.isBusy(), progress: updater.getProgress()
  })
}))

// 异步启动，立即返回；前端轮询 /update/status 拿进度，不再受 axios 20s 超时限制
router.post('/update/check', adminRequired, wrap((_req, res) => {
  ok(res, updater.startCheck())
}))

router.post('/update/apply', superRequired, wrap((_req, res) => {
  ok(res, updater.startApply())
}))

router.post('/update/restart', superRequired, wrap((_req, res) => {
  ok(res, { scheduled: true, message: '服务将在 1 秒后重启，页面会短暂断连后自动恢复' })
  updater.scheduleRestart()
}))

router.put('/update/config', superRequired, wrap((req, res) => {
  ok(res, updater.updateConfig(req.body || {}))
}))

router.put('/config', superRequired, wrap((req, res) => {
  // 第一遍：收集 + 校验（必须在事务外完成，否则事务内 return fail 不会真正返回响应）
  const entries = []
  for (const k of settings.ALL_KEYS) {
    if (!(k in (req.body || {}))) continue
    const v = req.body[k]
    // 敏感字段：空值或掩码视为「未修改」，沿用库中旧值（只写不读）
    if (settings.SENSITIVE_KEYS.includes(k)) {
      const s = String(v ?? '')
      if (!s || s === settings.MASK) continue
    }
    // 健壮：枚举类配置只接受合法值，避免写入 "0"/"yes" 被判真导致功能意外开启
    if (k === 'pay_mode' && !['mock', 'wechat'].includes(String(v))) return fail(res, 400, '支付模式只能是 mock 或 wechat')
    if (k === 'map_provider' && !['amap', 'osm'].includes(String(v))) return fail(res, 400, '地图服务商只能是 amap 或 osm')
    if (k === 'oss_provider' && !['local', 'aliyun', 'tencent'].includes(String(v))) return fail(res, 400, '存储方式只能是 local / aliyun / tencent')
    if (['sms_enabled', 'wechat_oauth_enabled', 'wechat_oauth_bind_phone'].includes(k) && !['true', 'false'].includes(String(v))) {
      return fail(res, 400, `${k} 只能是 true 或 false`)
    }
    if (k === 'wechat_oauth_scope' && String(v) !== 'snsapi_userinfo') return fail(res, 400, '授权范围固定为 snsapi_userinfo')
    if (k === 'wechat_oauth_verify_name' && String(v) && !/^MP_verify_[A-Za-z0-9_-]{1,64}\.txt$/.test(String(v))) {
      return fail(res, 400, '校验文件名格式应为 MP_verify_xxx.txt')
    }
    const max = k === 'wechat_private_key' || k === 'wechat_platform_cert' ? 20000 : 1000
    entries.push([k, JSON.stringify(String(v ?? '').slice(0, max))])
  }
  const stmt = db.prepare("INSERT INTO site_config (key, value, updated_at) VALUES (?,?,datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')")
  db.transaction(() => { for (const [k, v] of entries) stmt.run(k, v) })()
  // OSS 配置变更后立即失效客户端缓存，避免改了配置仍用旧密钥/旧路径
  const ossChanged = entries.some(([k]) => k.startsWith('oss_'))
  if (ossChanged) oss.clearCache()
  ok(res, settings.adminView())
  // 保存 OSS 配置后自动触发存量同步（延迟 2s 等客户端缓存重建，与 MShop 同口径）。
  // 失败/停止都不影响配置保存本身，前端通过进度接口展示状态。
  if (ossChanged && settings.ossConfig().provider !== 'local') {
    setTimeout(() => { try { oss.startMigrate() } catch (e) { console.warn('[OSS] 自动同步启动失败：', e.message) } }, 2000)
  }
}))

// ---------- 对象存储 OSS 管理 ----------
router.get('/oss/status', adminRequired, wrap((_req, res) => {
  const cfg = settings.ossConfig()
  ok(res, {
    enabled: oss.configured(),
    provider: oss.currentProvider(),
    pathPrefix: oss.currentPrefix(),
    bucket: cfg.bucket,
    region: cfg.region,
    customDomain: cfg.customDomain
  })
}))

// 文件列表（仅当前项目路径，防越权看别的项目）
router.get('/oss/files', adminRequired, wrap(async (_req, res) => {
  ok(res, { files: await oss.listFiles(), pathPrefix: oss.currentPrefix(), enabled: oss.configured() })
}))

// 删除文件（仅当前项目路径）
router.delete('/oss/files', adminRequired, wrap(async (req, res) => {
  const key = String(req.body?.key || '')
  if (!key) return fail(res, 400, '缺少文件 key')
  const removed = await oss.remove(key)
  if (!removed) return fail(res, 400, '删除失败：文件不存在或不属于当前项目路径')
  ok(res, { removed: true })
}))

// 连通性自检：尝试列举一次，明确返回能否访问
router.post('/oss/test', adminRequired, wrap(async (_req, res) => {
  if (!oss.configured()) return fail(res, 400, 'OSS 未启用或配置不完整，请先在配置中心填写并保存')
  const files = await oss.listFiles()
  ok(res, { ok: true, count: files.length, pathPrefix: oss.currentPrefix(), message: '连接成功，可访问项目路径下的对象' })
}))

// 地域列表（唯一真相源在 services/oss.js，前端下拉从此拉取）
router.get('/oss/regions', adminRequired, wrap((_req, res) => {
  ok(res, { regions: oss.OSS_REGIONS, provider: settings.ossConfig().provider })
}))

// 存量同步：进度 / 启动 / 停止（服务端单例，刷新页面不丢）
router.get('/oss/migrate/progress', adminRequired, wrap((_req, res) => {
  ok(res, oss.migrateProgress())
}))
router.post('/oss/migrate/start', adminRequired, wrap((_req, res) => {
  if (!oss.configured()) return fail(res, 400, '请先保存并启用 OSS 配置（当前为本地存储）')
  const r = oss.startMigrate()
  if (r.skipped === 'oss-disabled') return fail(res, 400, 'OSS 未启用')
  ok(res, r)
}))
router.post('/oss/migrate/stop', adminRequired, wrap((_req, res) => {
  ok(res, oss.stopMigrate())
}))

module.exports = router
