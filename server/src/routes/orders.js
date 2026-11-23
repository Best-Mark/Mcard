const express = require('express')
const db = require('../db')
const settings = require('../utils/settings')
const { ok, fail, wrap } = require('../utils/response')
const { authRequired, adminRequired } = require('../utils/auth')
const { orderNo } = require('../utils/id')
const payment = require('../services/payment')
const { activateOrder } = require('../services/orders')

const router = express.Router()

const view = r => ({
  id: r.id, orderNo: r.order_no, amountCents: r.amount_cents, status: r.status,
  paymentMethod: r.payment_method, payNo: r.pay_no, paidAt: r.paid_at, createdAt: r.created_at,
  packageName: r.package_name, durationDays: r.duration_days, slug: r.slug
})

const select = `SELECT o.*, p.name AS package_name, p.duration_days, c.slug
  FROM orders o JOIN packages p ON p.id = o.package_id
  LEFT JOIN cards c ON c.id = o.card_id`

router.post('/', authRequired, wrap(async (req, res) => {
  const pkg = db.prepare('SELECT * FROM packages WHERE id = ? AND enabled = 1').get(req.body?.package_id)
  if (!pkg) return fail(res, 400, '套餐不存在或已下架')
  const card = db.prepare('SELECT id FROM cards WHERE user_id = ?').get(req.user.id)
  const result = db.prepare(`INSERT INTO orders (order_no, user_id, card_id, package_id, amount_cents, payment_method)
    VALUES (?,?,?,?,?,?)`).run(orderNo(), req.user.id, card?.id || null, pkg.id, pkg.price_cents,
    settings.payConfig().PAY_MODE === 'wechat' ? 'wechat' : 'mock')
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid)
  try {
    const pay = await payment.createPayment(order, pkg)
    ok(res, { order: view({ ...order, package_name: pkg.name, duration_days: pkg.duration_days, slug: card?.slug }), pay })
  } catch (e) {
    db.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?").run(order.id)
    fail(res, 500, e.message || '发起支付失败')
  }
}))

router.get('/mine', authRequired, wrap((req, res) => {
  const rows = db.prepare(`${select} WHERE o.user_id = ? ORDER BY o.id DESC LIMIT 100`).all(req.user.id)
  ok(res, rows.map(view))
}))

router.get('/:id', authRequired, wrap((req, res) => {
  const row = db.prepare(`${select} WHERE o.id = ? AND o.user_id = ?`).get(req.params.id, req.user.id)
  if (!row) return fail(res, 404, '订单不存在')
  ok(res, view(row))
}))

// 模拟支付：仅 PAY_MODE=mock 可用，方便本地/演示跑通开通与续期
router.post('/:id/mock-pay', authRequired, wrap((req, res) => {
  if (settings.payConfig().PAY_MODE === 'wechat') return fail(res, 403, '正式支付模式不可模拟')
  const row = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id)
  if (!row) return fail(res, 404, '订单不存在')
  if (row.status === 'paid') return ok(res, { alreadyPaid: true })
  const r = activateOrder(row.id, 'MOCK')
  ok(res, r)
}))

// 微信支付未收到回调时的兜底查单
router.post('/:id/refresh', authRequired, wrap(async (req, res) => {
  const row = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id)
  if (!row) return fail(res, 404, '订单不存在')
  if (row.status === 'paid') return ok(res, { paid: true })
  if (settings.payConfig().PAY_MODE !== 'wechat') return fail(res, 400, '当前为模拟支付模式')
  let remote
  try {
    remote = await payment.queryWechatOrder(row.order_no)
  } catch (e) {
    // 健壮：查询失败不能当成「未支付」返回，否则用户看到假状态且以为真没付
    return fail(res, 502, `支付结果查询失败，请稍后重试：${e.message}`)
  }
  if (!remote) return fail(res, 502, '暂时无法确认支付结果，请稍后重试')
  const paid = remote.trade_state === 'SUCCESS' && remote.amount?.total === row.amount_cents
  ok(res, { paid, result: paid ? activateOrder(row.id, remote.transaction_id) : null })
}))

// 后台手动确认（线下收款/异常补单）
router.post('/:id/mark-paid', adminRequired, wrap((req, res) => {
  ok(res, activateOrder(req.params.id, 'MANUAL'))
}))

module.exports = router
