const express = require('express')
const crypto = require('crypto')
const settings = require('../utils/settings')
const db = require('../db')
const payment = require('../services/payment')
const { activateOrder } = require('../services/orders')

const router = express.Router()

function verifyNotifySignature(req, raw) {
  // 配置了微信平台证书才校验签名；未配置时依赖 AES-GCM 解密 + 金额校验 + 订单号校验
  const platformCert = settings.payConfig().WECHAT_PLATFORM_CERT
  if (!platformCert) return true
  const ts = req.headers['wechatpay-timestamp']
  const nonce = req.headers['wechatpay-nonce']
  const signature = req.headers['wechatpay-signature']
  const serial = req.headers['wechatpay-serial']
  if (!ts || !nonce || !signature || !serial) return false
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false
  const message = `${ts}\n${nonce}\n${raw.toString('utf8')}\n`
  return crypto.createVerify('RSA-SHA256').update(message).verify(platformCert, signature, 'base64')
}

router.post('/notify/wechat', (req, res) => {
  try {
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}))
    const payload = JSON.parse(raw.toString('utf8'))
    if (!verifyNotifySignature(req, raw)) return res.status(401).json({ code: 'FAIL', message: '签名校验失败' })

    const detail = payment.decryptResource(payload.resource)
    if (!detail || detail.trade_state !== 'SUCCESS') return res.json({ code: 'SUCCESS', message: '成功' })

    const order = db.prepare('SELECT * FROM orders WHERE order_no = ?').get(detail.out_trade_no)
    if (!order) return res.status(404).json({ code: 'FAIL', message: '订单不存在' })
    if (order.amount_cents !== detail.amount?.total) return res.status(400).json({ code: 'FAIL', message: '金额不符' })
    if (order.status === 'paid') return res.json({ code: 'SUCCESS', message: '成功' })

    activateOrder(order.id, detail.transaction_id || '')
    res.json({ code: 'SUCCESS', message: '成功' })
  } catch (e) {
    console.error('[PayNotify]', e)
    res.status(500).json({ code: 'FAIL', message: e.message || '回调处理失败' })
  }
})

module.exports = router
