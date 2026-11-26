// C 端推广中心：仅推广员可访问。普通用户拿到 403，前端据此不展示任何入口。
const express = require('express')
const db = require('../db')
const settings = require('../utils/settings')
const { ok, fail, wrap } = require('../utils/response')
const { authRequired } = require('../utils/auth')
const promo = require('../services/promo')

const router = express.Router()

function requirePromoter(req, res, next) {
  const u = db.prepare('SELECT is_promoter FROM users WHERE id = ?').get(req.user.id)
  if (!u?.is_promoter) return fail(res, 403, '仅推广员可使用推广中心')
  next()
}

// 收款账户（参考 MShop 口径）：一个用户可同时绑定微信/支付宝/银行卡，各自一份。
// 唯一真相源 = users.withdraw_accounts（JSON）；微信只用服务端授权拿到的 openid，前端传值一律忽略。
const ACCOUNT_TYPES = { wechat: '微信', alipay: '支付宝', bank: '银行卡' }
function readAccounts(userId) {
  const user = db.prepare('SELECT withdraw_accounts, nickname, wx_openid FROM users WHERE id = ?').get(userId)
  let obj = {}
  try { obj = JSON.parse(user?.withdraw_accounts || '{}') || {} } catch { obj = {} }
  if (typeof obj !== 'object' || Array.isArray(obj)) obj = {}
  return { user, obj }
}
function saveAccounts(userId, obj) {
  db.prepare('UPDATE users SET withdraw_accounts = ? WHERE id = ?').run(JSON.stringify(obj || {}), userId)
}
function maskAccount(v) {
  const s = String(v || '')
  return s.length <= 6 ? s : `${s.slice(0, 3)}****${s.slice(-4)}`
}
function accountView(userId) {
  const { user, obj } = readAccounts(userId)
  const accounts = Object.keys(ACCOUNT_TYPES).map(k => {
    const a = obj[k] || {}
    const bound = !!(a.openid || a.account)
    return {
      type: k, label: ACCOUNT_TYPES[k], bound, default: obj.defaultType === k,
      account: bound ? maskAccount(k === 'wechat' ? a.openid : a.account) : '',
      name: String(a.name || ''), wxReady: !!user?.wx_openid
    }
  })
  return { accounts, defaultType: obj.defaultType || '' }
}

// 当前登录用户的邀请码（全面邀请的唯一真相源）：只有推广员才有码，非推广员返回空。
// 分享工具据此给每个分享出口自动拼 ?invite=；用独立轻量接口，避免 /auth/me 形状变动影响既有缓存。
router.get('/my-code', authRequired, wrap((req, res) => {
  const u = db.prepare('SELECT is_promoter, invite_code FROM users WHERE id = ?').get(req.user.id)
  ok(res, { inviteCode: u?.is_promoter ? (u.invite_code || '') : '' })
}))

// 登录后的邀请归因兜底绑定：前端所有登录方式统一在拿到 token 后调一次。
// 只认「注册 24h 内 + 尚未有上级 + 新邀请码有效」的账号，防老用户挂靠刷注册奖。
// 幂等：已有上级直接跳过；注册奖励靠 DB 唯一索引一人一次。
router.post('/bind-invite', authRequired, wrap((req, res) => {
  const invite = String(req.body?.invite || '').trim()
  if (!invite) return ok(res, { bound: false })
  const me = db.prepare('SELECT invited_by, created_at FROM users WHERE id = ?').get(req.user.id)
  if (!me || me.invited_by) return ok(res, { bound: false })
  const created = new Date(String(me.created_at).replace(' ', 'T') + 'Z').getTime()
  if (Number.isFinite(created) && Date.now() - created > 24 * 3600 * 1000) return ok(res, { bound: false })
  const b = promo.bindInvite(req.user.id, invite)
  if (b.invited) promo.grantRegisterReward(b.promoterId, req.user.id)
  ok(res, { bound: !!b.invited })
}))

router.get('/summary', authRequired, requirePromoter, wrap((req, res) => {
  const s = promo.promoterSummary(req.user.id)
  const cfg = settings.promoConfig()
  ok(res, {
    ...s,
    inviteUrl: promo.inviteUrl(s.inviteCode, req),
    rules: {
      registerRewardCents: cfg.registerRewardCents,
      orderRate: cfg.orderRate,
      withdrawMinCents: cfg.withdrawMinCents
    }
  })
}))

router.get('/commissions', authRequired, requirePromoter, wrap((req, res) => {
  const rows = db.prepare(`SELECT c.id, c.type, c.amount_cents, c.created_at,
      u.nickname AS invitee_nickname, u.phone AS invitee_phone
    FROM commissions c LEFT JOIN users u ON u.id = c.invitee_id
    WHERE c.promoter_id = ? ORDER BY c.id DESC LIMIT 200`).all(req.user.id)
  ok(res, rows.map(r => ({
    id: r.id, type: r.type, amountCents: r.amount_cents, createdAt: r.created_at,
    invitee: r.invitee_nickname || (r.invitee_phone ? String(r.invitee_phone).replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2') : '用户')
  })))
}))

router.get('/invitees', authRequired, requirePromoter, wrap((req, res) => {
  const rows = db.prepare(`SELECT u.id, u.nickname, u.phone, u.created_at,
      (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id AND o.status = 'paid') AS paid_orders
    FROM users u WHERE u.invited_by = ? ORDER BY u.id DESC LIMIT 200`).all(req.user.id)
  ok(res, rows.map(r => ({
    id: r.id, nickname: r.nickname || '用户',
    phone: String(r.phone || '').replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2'),
    createdAt: r.created_at, paidOrders: r.paid_orders
  })))
}))

// 余额流水：佣金收入/提现支出/驳回返还逐笔可查（唯一真相源 balance_logs）
router.get('/balance-logs', authRequired, requirePromoter, wrap((req, res) => {
  const rows = db.prepare(`SELECT id, type, amount_cents, ref_type, after_cents, note, created_at
    FROM balance_logs WHERE user_id = ? ORDER BY id DESC LIMIT 200`).all(req.user.id)
  ok(res, rows.map(r => ({
    id: r.id, type: r.type, amountCents: r.amount_cents, refType: r.ref_type,
    afterCents: r.after_cents, note: r.note, createdAt: r.created_at
  })))
}))

router.get('/withdrawals', authRequired, requirePromoter, wrap((req, res) => {
  const rows = db.prepare(`SELECT id, amount_cents, status, channel, account, remark, admin_note, created_at, handled_at
    FROM withdrawals WHERE user_id = ? ORDER BY id DESC LIMIT 100`).all(req.user.id)
  ok(res, rows.map(r => ({
    id: r.id, amountCents: r.amount_cents, status: r.status, channel: r.channel,
    account: maskAccount(r.account), remark: r.remark, adminNote: r.admin_note,
    createdAt: r.created_at, handledAt: r.handled_at
  })))
}))

// 收款账户列表：只回脱敏值，前端不接触完整 openid/账号
router.get('/withdraw-accounts', authRequired, requirePromoter, wrap((req, res) => ok(res, accountView(req.user.id))))

// 保存收款账户：微信只认服务端 openid；支付宝/银行卡必须填账号与姓名
router.put('/withdraw-account', authRequired, requirePromoter, wrap((req, res) => {
  const type = String(req.body?.type || '')
  if (!ACCOUNT_TYPES[type]) return fail(res, 400, '收款方式不合法')
  const { user, obj } = readAccounts(req.user.id)
  const now = new Date().toISOString()
  if (type === 'wechat') {
    const openid = String(user?.wx_openid || '').trim().slice(0, 128)
    if (!openid) return fail(res, 400, '请先完成微信授权，再绑定微信收款')
    obj.wechat = { openid, name: String(user?.nickname || '微信用户').slice(0, 40), boundAt: now }
  } else {
    const account = String(req.body?.account || '').trim().slice(0, 100)
    const name = String(req.body?.name || '').trim().slice(0, 40)
    if (!account) return fail(res, 400, '请填写收款账号')
    if (!name) return fail(res, 400, '请填写收款人姓名')
    obj[type] = { account, name, bank: type === 'bank' ? String(req.body?.bank || '').trim().slice(0, 60) : '', boundAt: now }
  }
  if (!obj.defaultType || req.body?.setDefault === true) obj.defaultType = type
  saveAccounts(req.user.id, obj)
  ok(res, accountView(req.user.id))
}))

// 解绑：默认账户被解绑时自动改指向其它已绑账户
router.delete('/withdraw-account/:type', authRequired, requirePromoter, wrap((req, res) => {
  const type = String(req.params.type || '')
  if (!ACCOUNT_TYPES[type]) return fail(res, 400, '收款方式不合法')
  const { obj } = readAccounts(req.user.id)
  delete obj[type]
  if (obj.defaultType === type) obj.defaultType = Object.keys(ACCOUNT_TYPES).find(k => obj[k]?.openid || obj[k]?.account) || ''
  saveAccounts(req.user.id, obj)
  ok(res, accountView(req.user.id))
}))

// 申请提现：转出可提现余额，事务内扣余额 + 建提现单。同一笔余额不能重复提。
// 收款账户只从服务端已绑定账户取，绝不信任前端传入的账号（参考 MShop）。
router.post('/withdraw', authRequired, requirePromoter, wrap((req, res) => {
  const cfg = settings.promoConfig()
  const amount = Math.round(Number(req.body?.amount_cents))
  const remark = String(req.body?.remark || '').slice(0, 200)
  if (!Number.isFinite(amount) || amount < cfg.withdrawMinCents) return fail(res, 400, `最低提现 ${(cfg.withdrawMinCents / 100).toFixed(2)} 元`)
  const { obj } = readAccounts(req.user.id)
  const type = String(req.body?.type || obj.defaultType || '')
  const a = obj[type]
  if (!ACCOUNT_TYPES[type] || !a || !(a.openid || a.account)) return fail(res, 400, '请先绑定收款账户')
  const snapshot = type === 'wechat' ? `微信openid:${a.openid}` : `${a.name || ''} ${a.bank ? a.bank + ' ' : ''}${a.account}`.trim().slice(0, 200)
  // 幂等键：同一用户同一金额同一收款账户短时间内重复提交只生成一张单（防连点/重放重复提现）
  const idem = `${req.user.id}:${amount}:${type}:${Math.floor(Date.now() / 5000)}`
  if (db.prepare('SELECT 1 FROM withdrawals WHERE idempotency_key = ?').get(idem)) {
    return ok(res, { applied: true, duplicate: true })
  }
  const tx = db.transaction(() => {
    const u = db.prepare('SELECT balance_cents FROM users WHERE id = ?').get(req.user.id)
    if (!u || u.balance_cents < amount) return { ok: false }
    db.prepare('UPDATE users SET balance_cents = balance_cents - ? WHERE id = ?').run(amount, req.user.id)
    const ins = db.prepare("INSERT INTO withdrawals (user_id, amount_cents, channel, account, remark, idempotency_key) VALUES (?,?,?,?,?,?)")
      .run(req.user.id, amount, type, snapshot, remark, idem)
    const after = db.prepare('SELECT balance_cents FROM users WHERE id = ?').get(req.user.id).balance_cents
    db.prepare("INSERT INTO balance_logs (user_id, type, amount_cents, ref_type, ref_id, after_cents, note) VALUES (?, 'withdraw', ?, 'withdraw', ?, ?, ?)")
      .run(req.user.id, amount, ins.lastInsertRowid, after, `提现申请 ${type}`)
    return { ok: true }
  })
  try {
    const r = tx()
    if (!r.ok) return fail(res, 400, '可提现余额不足')
    ok(res, { applied: true })
  } catch (e) {
    if (String(e.message || '').includes('UNIQUE')) return ok(res, { applied: true, duplicate: true })
    throw e
  }
}))

module.exports = router
