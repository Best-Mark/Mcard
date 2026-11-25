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

router.get('/withdrawals', authRequired, requirePromoter, wrap((req, res) => {
  const rows = db.prepare(`SELECT id, amount_cents, status, channel, account, remark, admin_note, created_at, handled_at
    FROM withdrawals WHERE user_id = ? ORDER BY id DESC LIMIT 100`).all(req.user.id)
  ok(res, rows.map(r => ({
    id: r.id, amountCents: r.amount_cents, status: r.status, channel: r.channel,
    account: r.account, remark: r.remark, adminNote: r.admin_note,
    createdAt: r.created_at, handledAt: r.handled_at
  })))
}))

// 申请提现：转出可提现余额，事务内扣余额 + 建提现单。同一笔余额不能重复提。
router.post('/withdraw', authRequired, requirePromoter, wrap((req, res) => {
  const cfg = settings.promoConfig()
  const amount = Math.round(Number(req.body?.amount_cents))
  const channel = String(req.body?.channel || '').slice(0, 20)
  const account = String(req.body?.account || '').slice(0, 100)
  const remark = String(req.body?.remark || '').slice(0, 200)
  if (!Number.isFinite(amount) || amount < cfg.withdrawMinCents) return fail(res, 400, `最低提现 ${(cfg.withdrawMinCents / 100).toFixed(2)} 元`)
  if (!channel || !account) return fail(res, 400, '请填写收款方式与账号')
  const tx = db.transaction(() => {
    const u = db.prepare('SELECT balance_cents FROM users WHERE id = ?').get(req.user.id)
    if (!u || u.balance_cents < amount) return { ok: false }
    db.prepare('UPDATE users SET balance_cents = balance_cents - ? WHERE id = ?').run(amount, req.user.id)
    db.prepare("INSERT INTO withdrawals (user_id, amount_cents, channel, account, remark) VALUES (?,?,?,?,?)")
      .run(req.user.id, amount, channel, account, remark)
    return { ok: true }
  })
  const r = tx()
  if (!r.ok) return fail(res, 400, '可提现余额不足')
  ok(res, { applied: true })
}))

module.exports = router
