const db = require('../db')
const { makeSlug } = require('../utils/slug')
const promo = require('./promo')
const payment = require('./payment')
const plan = require('./plan')

const toSqlTime = d => new Date(d).toISOString().slice(0, 19).replace('T', ' ')

// 支付成功统一收敛（对齐 MShop 的 handlePaySuccess）：回调/查单/补单/模拟支付全部走这里。
// 铁律：① 金额强校验（分），不符绝不置 paid；② 幂等（已 paid 直接返回）；③ 单号带 _X 时还原订单号。
function handlePaySuccess(outTradeNo, transactionId = '', paidCents = null, method = '') {
  const orderNo = payment.baseOrderNo(outTradeNo)
  const order = db.prepare('SELECT * FROM orders WHERE order_no = ?').get(orderNo)
  if (!order) return { ok: false, reason: '订单不存在' }
  if (order.status === 'paid') return { ok: true, alreadyPaid: true, order }
  if (order.status === 'cancelled') return { ok: false, reason: '订单已取消' }
  if (paidCents !== null && paidCents !== undefined) {
    const paid = Math.round(Number(paidCents))
    if (!Number.isFinite(paid) || paid !== order.amount_cents) return { ok: false, reason: '支付金额与订单不符' }
  }
  if (method && order.payment_method && String(order.payment_method) !== String(method)) {
    return { ok: false, reason: '支付方式与订单不符' }
  }
  const result = activateOrder(order.id, String(transactionId || outTradeNo))
  return { ok: result.changed || result.reason === '订单已开通', ...result }
}

function activateOrder(orderId, payNo = '') {
  const tx = db.transaction(() => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId)
    if (!order) return { changed: false, reason: '订单不存在' }
    if (order.status === 'paid') return { changed: false, reason: '订单已开通', order }
    const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(order.package_id)
    if (!pkg) return { changed: false, reason: '套餐不存在' }

    db.prepare("UPDATE orders SET status = 'paid', pay_no = ?, paid_at = datetime('now') WHERE id = ?").run(payNo, order.id)

    // 分销佣金（两档，同事务发放，失败已被 promo 内部捕获，绝不影响名片开通主流程）：
    // ① 首单奖：被邀请人首次开通套餐，按订单金额 × 首单奖比例给邀请人，一生一次（uniq_promo_first_order 幂等）；
    // ② 每单返佣：每笔订单按订单金额 × 返佣比例给邀请人，可叠加（uniq_promo_order 幂等）。
    // 均受后台 promo_enabled 开关控制；无上级 / 自买 / 非推广员上线一律不发。
    promo.grantFirstOrderReward(order)
    promo.grantOrderCommission(order)

    let card = db.prepare('SELECT * FROM cards WHERE user_id = ?').get(order.user_id)
    if (!card) {
      // 名片姓名留空由用户填，不再拿 users.nickname 当默认值
      // （2026-11-25 强制约定：账户层 users 与名片层 cards 字段互不混用）
      const slug = makeSlug()
      db.prepare('INSERT INTO cards (user_id, slug, name, status) VALUES (?,?,?,?)')
        .run(order.user_id, slug, '', 'draft')
      card = db.prepare('SELECT * FROM cards WHERE user_id = ?').get(order.user_id)
    }
    // 兑现攒下的赠送时长（注册试用/邀请返时长在没建卡时先记账）：先兑现再叠加购买时长。
    // 兑现后必须重读 card，否则下面拿旧 expires_at 计算会把赠送时长覆盖丢。
    plan.consumeCredit(order.user_id)
    card = db.prepare('SELECT * FROM cards WHERE user_id = ?').get(order.user_id)
    // 终身套餐：duration_days = 0 → expires_at = NULL（永不过期）
    // 关键防降级：已是终身（expires_at 为 NULL 且 active）的用户再买有限套餐，必须保持终身，不能把 NULL 覆盖成有限到期日
    const lifetime = Number(pkg.duration_days) === 0
    const alreadyLifetime = !card.expires_at && card.status === 'active'
    if (lifetime || alreadyLifetime) {
      db.prepare("UPDATE cards SET status = 'active', expires_at = NULL, updated_at = datetime('now') WHERE id = ?").run(card.id)
      const fresh = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id)
      return { changed: true, order: fresh, cardId: card.id, expiresAt: null, lifetime: true }
    }

    // 续期从「当前到期时间」和「现在」中取较晚者叠加，避免重复购买吃亏
    const now = new Date()
    const current = card.expires_at ? new Date(String(card.expires_at).replace(' ', 'T') + 'Z') : now
    const base = current > now ? current : now
    const expires = new Date(base.getTime() + Number(pkg.duration_days) * 86400000)
    db.prepare("UPDATE cards SET status = 'active', expires_at = ?, updated_at = datetime('now') WHERE id = ?")
      .run(toSqlTime(expires), card.id)

    const fresh = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id)
    return { changed: true, order: fresh, cardId: card.id, expiresAt: toSqlTime(expires), lifetime: false }
  })
  return tx()
}

module.exports = { activateOrder, handlePaySuccess }
