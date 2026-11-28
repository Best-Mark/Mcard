// 套餐时长发放（唯一真相源）：注册即送 PRO、邀请返时长都走这里，绝不各写一套。
// 「PRO」= cards.status='active' 且未过期（与 routes/cards.js cardPlanActive 同口径），
// 时长统一累加在 cards.expires_at 上，与购买套餐同一套叠加语义（从较晚者起算，不会浪费）。
// 机制：用户已有名片 → 直接在当前到期时间上叠加（终身卡不动）；还没名片 → 先记 users.plan_credit_days，
// 建卡时（POST /mine / activateOrder 建卡分支）由 consumeCredit 兑现，赠送绝不因「注册时还没建卡」丢失。
const db = require('../db')

const REGISTER_TRIAL_DAYS = 7 // 注册即送 PRO：7 天
const MAX_GRANT_DAYS = 3650 // 单次发放上限 10 年，脏值/配置异常不放大

const toSqlTime = d => new Date(d).toISOString().slice(0, 19).replace('T', ' ')

// 给用户发 N 天套餐时长。返回 { granted, mode, expiresAt? }，mode = credit|extend|lifetime。
function grantDays(userId, days) {
  const n = Math.floor(Number(days))
  if (!Number.isFinite(n) || n <= 0) return { granted: 0, mode: 'none' }
  const capped = Math.min(n, MAX_GRANT_DAYS)
  const card = db.prepare('SELECT * FROM cards WHERE user_id = ?').get(userId)
  if (!card) {
    // 还没建卡：记账待兑现（consumeCredit 在建卡时消费，幂等）
    db.prepare('UPDATE users SET plan_credit_days = plan_credit_days + ? WHERE id = ?').run(capped, userId)
    return { granted: capped, mode: 'credit' }
  }
  // 终身卡（active 且无到期）时长无限，赠送对其无意义，绝不写 expires_at（防终身降级）
  if (card.status === 'active' && !card.expires_at) return { granted: 0, mode: 'lifetime' }
  const now = new Date()
  const current = card.expires_at ? new Date(String(card.expires_at).replace(' ', 'T') + 'Z') : now
  const base = current > now ? current : now
  const expires = new Date(base.getTime() + capped * 86400000)
  db.prepare("UPDATE cards SET status = 'active', expires_at = ?, updated_at = datetime('now') WHERE id = ?")
    .run(toSqlTime(expires), card.id)
  return { granted: capped, mode: 'extend', expiresAt: toSqlTime(expires) }
}

// 建卡/开通时兑现攒下的赠送时长：先清零再发放（幂等，重入不重复兑现）。
// 只在卡片已存在时调用；若发放失败（理论不可达）credit 已清零不回滚——SQLite 单连接无并发窗口。
function consumeCredit(userId) {
  const u = db.prepare('SELECT plan_credit_days FROM users WHERE id = ?').get(userId)
  const days = Math.floor(Number(u?.plan_credit_days || 0))
  if (days <= 0) return 0
  db.prepare('UPDATE users SET plan_credit_days = 0 WHERE id = ?').run(userId)
  return grantDays(userId, days).granted
}

// 注册即送 PRO（所有注册渠道统一入口：手机注册/微信建号/微信绑卡建号/小程序建号）
function grantRegisterTrial(userId) {
  return grantDays(userId, REGISTER_TRIAL_DAYS)
}

module.exports = { REGISTER_TRIAL_DAYS, grantDays, consumeCredit, grantRegisterTrial }
