const express = require('express')
const settings = require('../utils/settings')
const payment = require('../services/payment')
const { handlePaySuccess } = require('../services/orders')

const router = express.Router()

// 微信回调：先验签（缺平台证书一律拒），再 AES-GCM 解密，再金额强校验 + 幂等收敛。
// 金额不符不回 SUCCESS —— 让微信持续重试，绝不把问题静默吞掉。
router.post('/notify/wechat', (req, res) => {
  try {
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}))
    const payload = JSON.parse(raw.toString('utf8'))
    if (!payment.verifyWechatNotify(req.headers, raw)) {
      return res.status(401).json({ code: 'FAIL', message: '签名校验失败' })
    }
    const detail = payment.decryptResource(payload.resource)
    if (!detail || detail.trade_state !== 'SUCCESS') return res.json({ code: 'SUCCESS', message: '成功' })

    const result = handlePaySuccess(detail.out_trade_no, detail.transaction_id || '', detail.amount?.total, 'wechat')
    if (!result.ok) {
      console.warn('[PayNotify:wechat] 未开通：', JSON.stringify(result))
      return res.status(400).json({ code: 'FAIL', message: result.reason || '回调校验失败' })
    }
    res.json({ code: 'SUCCESS', message: '成功' })
  } catch (e) {
    console.error('[PayNotify:wechat]', e)
    res.status(500).json({ code: 'FAIL', message: e.message || '回调处理失败' })
  }
})

// 支付宝回调：out_trade_no 是明文，但依然强制验签（缺公钥一律拒），金额元转分后强校验。
// 成功回 success，失败回 fail —— 与支付宝协议一致。
router.post('/notify/alipay', (req, res) => {
  try {
    const params = { ...(req.body || {}) }
    if (!payment.verifyAliNotify(params)) {
      return res.status(401).type('text/plain').send('fail')
    }
    const tradeStatus = String(params.trade_status || '')
    if (!['TRADE_SUCCESS', 'TRADE_FINISHED'].includes(tradeStatus)) {
      return res.type('text/plain').send('success')
    }
    const paidCents = params.total_amount ? Math.round(Number(params.total_amount) * 100) : null
    const result = handlePaySuccess(params.out_trade_no, params.trade_no || '', paidCents, 'alipay')
    if (!result.ok) {
      console.warn('[PayNotify:alipay] 未开通：', JSON.stringify(result))
      return res.status(400).type('text/plain').send('fail')
    }
    res.type('text/plain').send('success')
  } catch (e) {
    console.error('[PayNotify:alipay]', e)
    res.status(500).type('text/plain').send('fail')
  }
})

module.exports = router
