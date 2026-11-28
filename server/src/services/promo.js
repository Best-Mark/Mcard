// 推广分销服务：邀请码、归因绑定、首单奖、消费返佣（多级）的唯一实现。
// 铁律：① 邀请码是全站唯一短码（users.invite_code 唯一索引兜底）；
// ② 归因 invited_by 注册后一次性绑定、永不更改（邀请归因零丢失）；
// ③ 每笔佣金在事务内发放，靠 DB 唯一索引（uniq_promo_order / uniq_promo_first_order）幂等；
// ④ 给推广员本人、自邀请、非推广员的码一律不发佣金（防自刷）；多级链上任何一级不合格即断链。
// ⑤ 佣金都是「订单金额 × 百分比」：首单奖（被邀请人首次开通套餐，一生一次，只给直接推广员）
//    + 每单返佣（每笔都算，沿邀请链向上发 1~3 级，层级与各级比例后台可配，可叠加）。
//    旧的固定金额注册奖励已废弃（register 类型仅作历史记录展示，不再新发）。
// ⑥ 邀请返时长（2026-11-28）与现金佣金并行、口径不同：时长面向全平台用户（任意 active 用户的
//    邀请码归因成功即给邀请人延长套餐，天数 promo_invite_days 后台可配）；现金仍只给推广员的付费订单。
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
// 归因资格（2026-11-28 起全平台）：邀请人是任意 active 用户即可（不再限推广员），因为邀请奖励
// 对全平台用户都发「套餐时长」；现金佣金（首单奖/每单返佣）仍只认推广员，见 orderPromoterId/orderPromoterChain。
// 返回 { promoterId, invited } —— invited=true 表示这次确实建立了归因（据此给邀请人返时长）。
function bindInvite(userId, rawCode) {
  const code = String(rawCode || '').trim().toLowerCase()
  if (!code) return { promoterId: null, invited: false }
  const me = db.prepare('SELECT id, invited_by, is_promoter FROM users WHERE id = ?').get(userId)
  if (!me || me.invited_by || me.is_promoter) return { promoterId: null, invited: false }
  const inviter = db.prepare("SELECT id FROM users WHERE invite_code = ? AND status = 'active'").get(code)
  if (!inviter || inviter.id === userId) return { promoterId: null, invited: false }
  try {
    const r = db.prepare('UPDATE users SET invited_by = ? WHERE id = ? AND invited_by IS NULL').run(inviter.id, userId)
    if (!r.changes) return { promoterId: null, invited: false }
    // 邀请返时长（全平台）：归因成功给邀请人延长套餐（天数后台可配，0=不发）。
    // 单发天然由 invited_by 一次性绑定保证（上面 UPDATE 只在未归因时生效），无需额外幂等键。
    // 发放失败只记日志，绝不影响归因/注册主流程（时长是锦上添花，归因是零丢失铁律）。
    try {
      const days = settings.promoConfig().inviteDays
      if (days > 0) require('./plan').grantDays(inviter.id, days)
    } catch (e) { console.error('[Promo] 邀请返时长发放失败', e.message) }
    return { promoterId: inviter.id, invited: true }
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

// 多级分销（2026-11-27）：沿邀请链（invited_by）向上追溯，返回拿每单返佣的推广员链
// （[一级=直接推广员, 二级=一级的上级, 三级=二级的上级]，最长 maxLevels 层）。
// 资格规则与单级口径完全一致：链上每一级都必须「推广员身份 + 启用状态」，任何一级不满足即断链，
// 该级及更上层全不发（防自刷/防躺赚）。自邀归因在 bindInvite 已挡，这里再兜底防环（同一人绝不拿两级）。
function orderPromoterChain(order, maxLevels = 1) {
  const chain = []
  if (!order || !order.user_id || maxLevels <= 0) return chain
  const seen = new Set([order.user_id])
  let cur = order.user_id
  for (let i = 0; i < maxLevels; i++) {
    const up = db.prepare('SELECT invited_by FROM users WHERE id = ?').get(cur)?.invited_by
    if (!up || seen.has(up)) break // 无上级 / 成环兜底
    const p = db.prepare('SELECT id, is_promoter, status FROM users WHERE id = ?').get(up)
    if (!p || !p.is_promoter || p.status !== 'active') break // 断链：该级不合格，后面全不发
    chain.push(p.id)
    seen.add(p.id)
    cur = p.id
  }
  return chain
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

// 消费返佣（多级）：订单支付成功（activateOrder 事务内）调用。沿邀请链向上发 1~3 级，
// 一级=promo_order_rate、二级=promo_rate_lv2、三级=promo_rate_lv3，比例 0 的层级跳过不发。
// 幂等：uniq_promo_order(order_id, promoter_id)——同一订单同一推广员只发一笔，重入安全；
// 比例为 0 的层级不落库（同订单链上只发非零层级）。无上级 / 自买 / 断链一律不返。
function grantOrderCommission(order, enabledOverride) {
  const cfg = settings.promoConfig()
  const enabled = typeof enabledOverride === 'boolean' ? enabledOverride : cfg.enabled
  if (!enabled) return 0
  const chain = orderPromoterChain(order, cfg.levels)
  if (!chain.length) return 0
  const rates = [cfg.orderRate, cfg.rateLv2, cfg.rateLv3]
  const levelName = ['一级', '二级', '三级']
  let total = 0
  try {
    const tx = db.transaction(() => {
      chain.forEach((promoterId, idx) => {
        const amount = Math.floor(Number(order.amount_cents) * (rates[idx] || 0) / 100)
        if (amount <= 0) return
        const ins = db.prepare("INSERT INTO commissions (promoter_id, invitee_id, type, order_id, amount_cents) VALUES (?,?, 'order', ?, ?)")
          .run(promoterId, order.user_id, order.id, amount)
        db.prepare('UPDATE users SET balance_cents = balance_cents + ? WHERE id = ?').run(amount, promoterId)
        logBalance(promoterId, 'commission', amount, 'commission_order', ins.lastInsertRowid, `订单 ${order.order_no} ${levelName[idx]}返佣`)
        total += amount
      })
    })
    tx()
    return total
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
