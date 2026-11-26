// 推广分销服务：邀请码、归因绑定、首单奖、消费返佣的唯一实现。
// 铁律：① 邀请码是全站唯一短码（users.invite_code 唯一索引兜底）；
// ② 归因 invited_by 注册后一次性绑定、永不更改（邀请归因零丢失）；
// ③ 每笔佣金在事务内发放，靠 DB 唯一索引（uniq_promo_order / uniq_promo_first_order）幂等；
// ④ 给推广员本人、自邀请、非推广员的码一律不发佣金（防自刷）。
// ⑤ 两档佣金都是「订单金额 × 百分比」：首单奖（被邀请人首次开通套餐，一生一次）+ 每单返佣（每笔都算，可叠加）。
//    旧的固定金额注册奖励已废弃（register 类型仅作历史记录展示，不再新发）。
const db = require('../db')
const settings = require('../utils/settings')
const { slugId } = require('../utils/id')
const crypto = require('crypto')
const { originOf } = require('../utils/origin')

// 余额流水：每笔佣金/提现/驳回返还都留痕（唯一真相源 balance_logs）。
// ref_type+ref_id 唯一索引保证同一业务事件只记一次（发放重入不会重复流水）。
function logBalance(userId, type, amountCents, refType, refId, note = '') {
  const after = db.prepare('SELECT balance_cents FROM users WHERE id = ?').get(userId)?.balance_cents ?? 0
  db.prepare("INSERT OR IGNORE INTO balance_logs (user_id, type, amount_cents, ref_type, ref_id, after_cents, note) VALUES (?,?,?,?,?,?,?)")
    .run(userId, type, amountCents, refType, refId ?? null, after, note.slice(0, 120))
}

// 生成不重复的推广邀请码（8 位易读短码，撞码自动重试）
function ensureInviteCode(userId) {
  const row = db.prepare('SELECT invite_code FROM users WHERE id = ?').get(userId)
  if (!row) return ''
  if (row.invite_code) return row.invite_code
  for (let i = 0; i < 8; i++) {
    const code = slugId()
    const hit = db.prepare('SELECT id FROM users WHERE invite_code = ?').get(code)
    if (hit) continue
    db.prepare('UPDATE users SET invite_code = ? WHERE id = ? AND invite_code = \'\'').run(code, userId)
    const fresh = db.prepare('SELECT invite_code FROM users WHERE id = ?').get(userId)
    if (fresh?.invite_code) return fresh.invite_code
  }
  // 兜底：极短概率的连续撞码，用随机 hex 再加一轮（长度仍受控）
  const code = crypto.randomBytes(5).toString('hex').slice(0, 8)
  db.prepare('UPDATE users SET invite_code = ? WHERE id = ? AND invite_code = \'\'').run(code, userId)
  return db.prepare('SELECT invite_code FROM users WHERE id = ?').get(userId)?.invite_code || ''
}

// 邀请链接：后台配置了前缀就用配置（唯一真相源），否则按当前请求 origin 推导（域名不写死）
function inviteUrl(inviteCode, req) {
  if (!inviteCode) return ''
  const configured = settings.promoConfig().inviteBaseUrl.replace(/\/$/, '')
  const base = configured || originOf(req)
  return `${base}/?invite=${encodeURIComponent(inviteCode)}`
}

// 把邀请码归因绑定到新用户（注册成功后调用一次）。幂等：已有上级则原样返回，绝不覆盖。
// 返回 { promoterId, invited } —— invited=true 表示这次确实建立了归因（可据此发注册奖励）。
function bindInvite(userId, rawCode) {
  const code = String(rawCode || '').trim().toLowerCase()
  if (!code) return { promoterId: null, invited: false }
  const me = db.prepare('SELECT id, invited_by, is_promoter FROM users WHERE id = ?').get(userId)
  if (!me || me.invited_by || me.is_promoter) return { promoterId: null, invited: false }
  const promoter = db.prepare("SELECT id FROM users WHERE invite_code = ? AND is_promoter = 1 AND status = 'active'").get(code)
  if (!promoter || promoter.id === userId) return { promoterId: null, invited: false }
  try {
    const r = db.prepare('UPDATE users SET invited_by = ? WHERE id = ? AND invited_by IS NULL').run(promoter.id, userId)
    return { promoterId: r.changes ? promoter.id : null, invited: !!r.changes }
  } catch { return { promoterId: null, invited: false } }
}

// 解析订单买家对应的有效推广人：无上级 / 自买 / 非推广员 / 已停用一律不发（防自刷，两档佣金共用）。
function orderPromoterId(order) {
  if (!order || !order.user_id) return null
  const buyer = db.prepare('SELECT invited_by FROM users WHERE id = ?').get(order.user_id)
  const promoterId = buyer?.invited_by
  if (!promoterId || promoterId === order.user_id) return null
  const promoter = db.prepare('SELECT id, is_promoter, status FROM users WHERE id = ?').get(promoterId)
  return promoter && promoter.is_promoter && promoter.status === 'active' ? promoterId : null
}

// 发放首单奖：被邀请人「首次开通套餐」（第一笔支付成功的订单）时按订单金额百分比额外给推广员。
// 与每单消费返佣叠加、各记一笔；一生一次靠 DB 唯一索引 uniq_promo_first_order(invitee_id) 幂等，
// 支付回调/查单/补单重入都只发一次。注册时不再发任何固定金额奖励。
function grantFirstOrderReward(order, enabledOverride) {
  const promoterId = orderPromoterId(order)
  if (!promoterId) return 0
  const cfg = settings.promoConfig()
  const enabled = typeof enabledOverride === 'boolean' ? enabledOverride : cfg.enabled
  if (!enabled || cfg.firstOrderRate <= 0) return 0
  const amount = Math.floor(Number(order.amount_cents) * cfg.firstOrderRate / 100)
  if (amount <= 0) return 0
  try {
    const tx = db.transaction(() => {
      // order_id 留 NULL：同一订单的每单返佣已占 uniq_promo_order，首单奖靠 uniq_promo_first_order 幂等；
      // 触发订单号写进流水 note 可追溯。
      const ins = db.prepare("INSERT INTO commissions (promoter_id, invitee_id, type, amount_cents) VALUES (?,?, 'first_order', ?)")
        .run(promoterId, order.user_id, amount)
      if (!ins.changes) return 0
      db.prepare('UPDATE users SET balance_cents = balance_cents + ? WHERE id = ?').run(amount, promoterId)
      logBalance(promoterId, 'commission', amount, 'commission_first_order', ins.lastInsertRowid, `订单 ${order.order_no} 首单奖`)
      return amount
    })
    return tx()
  } catch (e) {
    // 唯一索引冲突 = 该被邀请人已发过首单奖（并发/重入），静默跳过；其余异常也不能影响开通主流程
    if (String(e.message || '').includes('UNIQUE')) return 0
    console.error('[Promo] 首单奖发放失败', e.message)
    return 0
  }
}

// 消费返佣：订单支付成功（activateOrder 事务内）调用。同一订单只返一次（uniq_promo_order）。
// 受 promo_enabled 与 orderRate 控制；无上级 / 自买 / 非推广员上线一律不返。
function grantOrderCommission(order, enabledOverride) {
  const promoterId = orderPromoterId(order)
  if (!promoterId) return 0
  const cfg = settings.promoConfig()
  const enabled = typeof enabledOverride === 'boolean' ? enabledOverride : cfg.enabled
  if (!enabled || cfg.orderRate <= 0) return 0
  const amount = Math.floor(Number(order.amount_cents) * cfg.orderRate / 100)
  if (amount <= 0) return 0
  try {
    const tx = db.transaction(() => {
      const ins = db.prepare("INSERT INTO commissions (promoter_id, invitee_id, type, order_id, amount_cents) VALUES (?,?, 'order', ?, ?)")
        .run(promoterId, order.user_id, order.id, amount)
      db.prepare('UPDATE users SET balance_cents = balance_cents + ? WHERE id = ?').run(amount, promoterId)
      logBalance(promoterId, 'commission', amount, 'commission_order', ins.lastInsertRowid, `订单 ${order.order_no} 返佣`)
    })
    tx()
    return amount
  } catch (e) {
    if (String(e.message || '').includes('UNIQUE')) return 0
    console.error('[Promo] 消费返佣发放失败', e.message)
    return 0
  }
}

// 推广员概览数据
function promoterSummary(userId) {
  const u = db.prepare('SELECT id, is_promoter, invite_code, balance_cents FROM users WHERE id = ?').get(userId)
  if (!u || !u.is_promoter) return null
  const code = ensureInviteCode(userId)
  const invitees = db.prepare('SELECT COUNT(*) AS n FROM users WHERE invited_by = ?').get(userId).n
  const total = db.prepare('SELECT COALESCE(SUM(amount_cents),0) AS n FROM commissions WHERE promoter_id = ?').get(userId).n
  return {
    isPromoter: true,
    inviteCode: code,
    invitees,
    totalEarnedCents: total,
    balanceCents: db.prepare('SELECT balance_cents FROM users WHERE id = ?').get(userId).balance_cents
  }
}

module.exports = { ensureInviteCode, inviteUrl, bindInvite, grantFirstOrderReward, grantOrderCommission, promoterSummary }
