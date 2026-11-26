// 支付补单（对齐 MShop）：定时扫近 24h 仍 pending 的真实支付订单，主动向微信/支付宝查单，
// 已支付但回调丢失的订单自动补开通。失败只记日志，绝不误判「未支付」或重复发佣。
// 自愈：回调到达/重试/补单/用户手动刷新全部收敛到同一个 handlePaySuccess（幂等 + 金额强校验）。
const db = require('../db')
const settings = require('../utils/settings')
const payment = require('./payment')
const { handlePaySuccess } = require('./orders')

let running = false
let timer = null

async function reconcile() {
  if (running) return
  if (settings.payModeOf() === 'mock') return
  running = true
  try {
    const rows = db.prepare(`SELECT * FROM orders WHERE status = 'pending'
      AND payment_method IN ('wechat','alipay')
      AND created_at >= datetime('now', '-1 day') ORDER BY id LIMIT 50`).all()
    for (const order of rows) {
      try {
        const remote = await payment.queryPayment(order, order.payment_method)
        if (!remote.paid) continue
        const result = handlePaySuccess(payment.getOutTradeNo(order), remote.transactionId, remote.total, order.payment_method)
        if (result.ok) console.log(`[PayReconcile] 补单成功：${order.order_no}`)
        else console.warn(`[PayReconcile] 补单未通过：${order.order_no} ${result.reason || ''}`)
      } catch (e) {
        // 单笔失败不阻断整轮，下一轮再来（外部网关抖动不能拖垮补单循环）
        console.warn(`[PayReconcile] 查单失败：${order.order_no} ${e.message}`)
      }
    }
  } finally {
    running = false
  }
}

function startPayReconcileLoop() {
  if (timer) return
  const run = () => { reconcile().catch(e => console.error('[PayReconcile]', e.message)) }
  timer = setInterval(run, 5 * 60 * 1000)
  timer.unref()
  setTimeout(run, 60 * 1000).unref() // 启动 1 分钟后先跑一轮，尽快补上回调丢失的单
}

module.exports = { reconcile, startPayReconcileLoop }
