// 套餐到期统一处理（2026-11-27）：此前到期只靠查询惰性隐藏（集市过滤 + cardPlanActive 实时算），
// 名片 status 一直挂着 'active'，用户没有任何「到期/被下架」的感知。
// 每小时任务把刚过期的名片真实重置：
//   status: active → expired（与后台手动状态口径一致），market_opt_in → 0（集市真实下架），
// 并发站内通知（type=plan_expired）告知到期、下架与恢复方式。
// 幂等：置过 expired 的行不再命中扫描，无需通知去重键；各查询处的惰性过滤保留作为宕机兜底。
const db = require('../db')
const notify = require('./notify')
const { NOTIFY_TYPES } = require('../utils/constants')

let timer = null
let running = false

function resetExpiredCards() {
  if (running) return 0
  running = true
  try {
    const now = Date.now()
    const rows = db.prepare("SELECT id, user_id, expires_at FROM cards WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at <> ''").all()
      .filter(r => {
        const t = new Date(String(r.expires_at).replace(' ', 'T') + 'Z').getTime()
        return Number.isFinite(t) && t <= now
      })
    for (const r of rows) {
      try {
        // 带状态条件重置：与后台手动操作并发时绝不错杀刚续费的名片
        const changed = db.prepare("UPDATE cards SET status = 'expired', market_opt_in = 0, updated_at = datetime('now') WHERE id = ? AND status = 'active'").run(r.id)
        if (!changed.changes) continue
        // 套餐名取该用户最近一笔已支付订单，让通知能说清是哪个套餐
        const pkg = db.prepare(`SELECT p.name FROM orders o JOIN packages p ON p.id = o.package_id
          WHERE o.user_id = ? AND o.status = 'paid' ORDER BY o.id DESC LIMIT 1`).get(r.user_id)
        notify.push(r.user_id, NOTIFY_TYPES.PLAN_EXPIRED, '套餐已到期',
          `您的${pkg?.name ? `「${pkg.name}」` : ''}套餐已到期：名片高级功能已停用，集市已下架。续费后立即恢复，集市需重新上架。`,
          '/me/plans', r.id)
        console.log(`[PlanExpiry] 已重置过期名片 #${r.id}（user ${r.user_id}）`)
      } catch (e) {
        // 单张失败不阻断整轮，下一小时再来
        console.warn(`[PlanExpiry] 名片 #${r.id} 重置失败：${e.message}`)
      }
    }
    return rows.length
  } finally {
    running = false
  }
}

function startPlanExpiryLoop() {
  if (timer) return
  const run = () => { try { resetExpiredCards() } catch (e) { console.error('[PlanExpiry]', e.message) } }
  timer = setInterval(run, 60 * 60 * 1000)
  timer.unref()
  setTimeout(run, 30 * 1000).unref() // 启动 30 秒后先跑一轮，兜住停机期间过期的名片
}

module.exports = { resetExpiredCards, startPlanExpiryLoop }
