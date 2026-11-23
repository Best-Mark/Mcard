const db = require('../db')
const { makeSlug } = require('../utils/slug')

const toSqlTime = d => new Date(d).toISOString().slice(0, 19).replace('T', ' ')

function activateOrder(orderId, payNo = '') {
  const tx = db.transaction(() => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId)
    if (!order) return { changed: false, reason: '订单不存在' }
    if (order.status === 'paid') return { changed: false, reason: '订单已开通', order }
    const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(order.package_id)
    if (!pkg) return { changed: false, reason: '套餐不存在' }

    db.prepare("UPDATE orders SET status = 'paid', pay_no = ?, paid_at = datetime('now') WHERE id = ?").run(payNo, order.id)

    let card = db.prepare('SELECT * FROM cards WHERE user_id = ?').get(order.user_id)
    if (!card) {
      const user = db.prepare('SELECT nickname, phone FROM users WHERE id = ?').get(order.user_id)
      const slug = makeSlug()
      db.prepare('INSERT INTO cards (user_id, slug, name, status) VALUES (?,?,?,?)')
        .run(order.user_id, slug, user?.nickname || '我的名片', 'draft')
      card = db.prepare('SELECT * FROM cards WHERE user_id = ?').get(order.user_id)
    }
    // 续期从「当前到期时间」和「现在」中取较晚者叠加，避免重复购买吃亏
    const now = new Date()
    const current = card.expires_at ? new Date(String(card.expires_at).replace(' ', 'T') + 'Z') : now
    const base = current > now ? current : now
    const expires = new Date(base.getTime() + pkg.duration_days * 86400000)
    db.prepare("UPDATE cards SET status = 'active', expires_at = ?, updated_at = datetime('now') WHERE id = ?")
      .run(toSqlTime(expires), card.id)

    const fresh = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id)
    return { changed: true, order: fresh, cardId: card.id, expiresAt: toSqlTime(expires) }
  })
  return tx()
}

module.exports = { activateOrder }
