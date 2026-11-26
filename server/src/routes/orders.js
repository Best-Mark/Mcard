const express = require('express')
const db = require('../db')
const settings = require('../utils/settings')
const { ok, fail, wrap } = require('../utils/response')
const { authRequired, adminRequired } = require('../utils/auth')
const { orderNo } = require('../utils/id')
const payment = require('../services/payment')
const { activateOrder, handlePaySuccess } = require('../services/orders')

const router = express.Router()

const view = r => ({
  id: r.id, orderNo: r.order_no, amountCents: r.amount_cents, status: r.status,
  paymentMethod: r.payment_method, payNo: r.pay_no, paidAt: r.paid_at, createdAt: r.created_at,
  packageName: r.package_name, durationDays: r.duration_days, slug: r.slug
})

const select = `SELECT o.*, p.name AS package_name, p.duration_days, c.slug
  FROM orders o JOIN packages p ON p.id = o.package_id
  LEFT JOIN cards c ON c.id = o.card_id`

// 支付方式/场景白名单（唯一真相源）：method=wechat|alipay|mock，scene=pc|h5|wechat|miniapp|alipay-mini
const METHODS = ['wechat', 'alipay', 'mock']
const SCENES = ['pc', 'h5', 'wechat', 'miniapp', 'alipay-mini']
function normalizePay(reqBody) {
  return {
    method: String(reqBody?.method || '').trim().toLowerCase(),
    scene: String(reqBody?.scene || '').trim().toLowerCase(),
    // 前端传的 openid 一律忽略：JSAPI openid 必须由服务端按 code 换取或从登录用户读取
    code: String(reqBody?.code || '').trim().slice(0, 128),
    buyerId: String(reqBody?.buyer_id || reqBody?.buyerId || '').trim().slice(0, 64)
  }
}

// JSAPI openid 服务端获取：小程序走 code 换取；公众号走登录用户的 wx_openid。绝不信任前端传值。
async function resolveOpenid(pref, req) {
  if (pref.scene === 'miniapp' && pref.code) return payment.miniOpenidByCode(pref.code)
  if (pref.scene === 'wechat' || pref.scene === 'miniapp') {
    const row = db.prepare('SELECT wx_openid FROM users WHERE id = ?').get(req.user?.id)
    if (row?.wx_openid) return row.wx_openid
    if (pref.scene === 'miniapp') throw new Error('小程序支付需要微信登录 code，请重试')
    throw new Error('公众号内支付需要微信授权，请先在微信中完成登录')
  }
  return ''
}

// 公开：当前启用的支付通道（前端据此渲染支付方式，不下发任何密钥）
router.get('/pay-methods', wrap((_req, res) => {
  const channels = settings.payChannels()
  ok(res, { channels, mock: channels.includes('mock') })
}))

router.post('/', authRequired, wrap(async (req, res) => {
  const pkg = db.prepare('SELECT * FROM packages WHERE id = ? AND enabled = 1').get(req.body?.package_id)
  if (!pkg) return fail(res, 400, '套餐不存在或已下架')
  const pref = normalizePay(req.body)
  if (pref.method && !METHODS.includes(pref.method)) return fail(res, 400, '支付方式不合法')
  if (pref.scene && !SCENES.includes(pref.scene)) return fail(res, 400, '支付场景不合法')

  const channels = settings.payChannels()
  // 0 元套餐与支付通道配置无关：不校验 method、payment_method 标为 free。
  // 必须早于通道校验，否则 mock 模式/未启用 wechat 时免费体验卡会被「该支付方式未启用」误拦。
  const free = Number(pkg.price_cents) <= 0
  const method = free ? 'free' : (pref.method || channels[0])
  if (!free && !channels.includes(method)) return fail(res, 400, '该支付方式未启用')

  const card = db.prepare('SELECT id, slug, status, expires_at FROM cards WHERE user_id = ?').get(req.user.id)
  // 体验卡限领：订单创建前先判——被拒不留垃圾 pending 订单
  if (free) {
    const planStillActive = card && card.status === 'active' &&
      (!card.expires_at || new Date(String(card.expires_at).replace(' ', 'T') + 'Z') > new Date())
    if (planStillActive) return fail(res, 400, '当前套餐仍有效，体验卡需到期后才能重新领取')
  }
  const result = db.prepare(`INSERT INTO orders (order_no, user_id, card_id, package_id, amount_cents, payment_method)
    VALUES (?,?,?,?,?,?)`).run(orderNo(), req.user.id, card?.id || null, pkg.id, pkg.price_cents, method)
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid)
  try {
    // 0 元套餐（免费体验卡）：微信/支付宝均要求金额 ≥ 1 分，直接免费开通，绝不发支付网关。
    // 走同一个 activateOrder：时长叠加、终身防降级、分销佣金口径与付费订单完全一致。
    // 限领规则（2026-11-27 用户定稿）：当前有有效套餐（active 未过期或终身）不可领取，
    // 到期后才可重领——既挡「未到期反复叠加 7 天」，也挡付费/终身会员白嫖体验卡。
    if (free) {
      const planStillActive = card && card.status === 'active' &&
        (!card.expires_at || new Date(String(card.expires_at).replace(' ', 'T') + 'Z') > new Date())
      if (planStillActive) return fail(res, 400, '当前套餐仍有效，体验卡需到期后才能重新领取')
      const r = activateOrder(order.id, 'FREE')
      return ok(res, {
        order: view({ ...(r.order || order), status: 'paid', package_name: pkg.name, duration_days: pkg.duration_days, slug: card?.slug }),
        pay: { mode: 'free', payType: 'free', payText: '' },
        free: true
      })
    }
    const openid = await resolveOpenid(pref, req)
    const pay = await payment.createPayment(order, pkg, {
      ...pref, req, openid,
      // 首次下单直接复用订单号；重走 /:id/pay 才换 _X 新号，避免无谓产生新单号
      reuseOutTradeNo: true
    })
    ok(res, { order: view({ ...order, package_name: pkg.name, duration_days: pkg.duration_days, slug: card?.slug }), pay })
  } catch (e) {
    db.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?").run(order.id)
    fail(res, 500, e.message || '发起支付失败')
  }
}))

// 重新拉起支付（含改支付方式/换端）：重付一律换 _X 新单号，规避微信关单后同号作废
router.post('/:id/pay', authRequired, wrap(async (req, res) => {
  const row = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id)
  if (!row) return fail(res, 404, '订单不存在')
  if (row.status === 'paid') return ok(res, { alreadyPaid: true, order: view(row) })
  if (row.status === 'cancelled') return fail(res, 400, '订单已取消，请重新下单')
  const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(row.package_id)
  if (!pkg) return fail(res, 404, '套餐不存在')
  // 0 元订单（含升级前遗留的 pending 免费体验卡）：直接开通，不校验支付通道、不发网关。
  // 必须放在支付方式/场景校验之前——mock 模式下 channels 不含 wechat，免费订单不该被拦。
  if (Number(row.amount_cents) <= 0) {
    const slug = db.prepare('SELECT slug FROM cards WHERE user_id = ?').get(req.user.id)?.slug
    const r = activateOrder(row.id, 'FREE')
    return ok(res, {
      order: view({ ...(r.order || row), status: 'paid', package_name: pkg.name, duration_days: pkg.duration_days, slug }),
      pay: { mode: 'free', payType: 'free', payText: '' },
      free: true
    })
  }

  const pref = normalizePay(req.body)
  if (pref.method && !METHODS.includes(pref.method)) return fail(res, 400, '支付方式不合法')
  if (pref.scene && !SCENES.includes(pref.scene)) return fail(res, 400, '支付场景不合法')
  const method = pref.method || row.payment_method
  const channels = settings.payChannels()
  if (!channels.includes(method)) return fail(res, 400, '该支付方式未启用')

  db.prepare('UPDATE orders SET payment_method = ? WHERE id = ?').run(method, row.id)
  const fresh = db.prepare('SELECT * FROM orders WHERE id = ?').get(row.id)
  try {
    const openid = await resolveOpenid(pref, req)
    // 不传 reuseOutTradeNo → createPayment 内部 makeNewOutTradeNo 换 _X 新号
    const pay = await payment.createPayment(fresh, pkg, { ...pref, req, method, openid })
    ok(res, { order: view(fresh), pay })
  } catch (e) {
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

// 模拟支付：仅 mock 模式可用，方便本地/演示跑通开通与续期
router.post('/:id/mock-pay', authRequired, wrap((req, res) => {
  if (settings.payModeOf() !== 'mock') return fail(res, 403, '正式支付模式不可模拟')
  const row = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id)
  if (!row) return fail(res, 404, '订单不存在')
  if (row.status === 'paid') return ok(res, { alreadyPaid: true })
  const r = activateOrder(row.id, 'MOCK')
  ok(res, r)
}))

// 未收到回调时的兜底查单：微信/支付宝都走统一 queryPayment + handlePaySuccess
router.post('/:id/refresh', authRequired, wrap(async (req, res) => {
  const row = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id)
  if (!row) return fail(res, 404, '订单不存在')
  if (row.status === 'paid') return ok(res, { paid: true })
  if (settings.payModeOf() === 'mock') return fail(res, 400, '当前为模拟支付模式')
  let remote
  try {
    remote = await payment.queryPayment(row, row.payment_method)
  } catch (e) {
    // 健壮：查询失败不能当成「未支付」返回，否则用户看到假状态且以为真没付
    return fail(res, 502, `支付结果查询失败，请稍后重试：${e.message}`)
  }
  if (!remote.paid) return ok(res, { paid: false })
  const result = handlePaySuccess(payment.getOutTradeNo(row), remote.transactionId, remote.total, row.payment_method)
  if (!result.ok) return fail(res, 400, result.reason || '支付结果校验失败')
  ok(res, { paid: true, result })
}))

// 后台手动确认（线下收款/异常补单）
router.post('/:id/mark-paid', adminRequired, wrap((req, res) => {
  ok(res, activateOrder(req.params.id, 'MANUAL'))
}))

module.exports = router
