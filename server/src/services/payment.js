const https = require('https')
const crypto = require('crypto')
const settings = require('../utils/settings')
const { randomHex } = require('../utils/id')

const MCH_HOST = 'api.mch.weixin.qq.com'

function httpRequest(method, requestPath, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? Buffer.from(body, 'utf8') : null
    const req = https.request({
      host: MCH_HOST,
      path: requestPath,
      method,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'MCard/1.0',
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': payload.length } : {}),
        ...headers
      }
    }, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('error', e => reject(e)) // 兼容：响应流异常时 Promise 不悬挂
      res.on('aborted', () => reject(new Error('微信支付响应中断')))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        let data = null
        try { data = text ? JSON.parse(text) : null } catch { /* 保留原文用于报错 */ }
        resolve({ status: res.statusCode, data, text })
      })
    })
    req.setTimeout(15000, () => req.destroy(new Error('微信支付请求超时')))
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

function wechatAuthorization(method, requestPath, body = '') {
  const p = settings.payConfig()
  if (!p.WECHAT_PRIVATE_KEY || !p.WECHAT_MCH_ID || !p.WECHAT_CERT_SERIAL_NO) {
    throw new Error('微信支付签名配置缺失：请检查商户号、证书序列号与商户私钥')
  }
  const nonce = randomHex(16)
  const timestamp = Math.floor(Date.now() / 1000)
  const message = `${method}\n${requestPath}\n${timestamp}\n${nonce}\n${body}\n`
  const signature = crypto.createSign('RSA-SHA256').update(message, 'utf8').sign(p.WECHAT_PRIVATE_KEY, 'base64')
  return `WECHATPAY2-SHA256-RSA2048 mchid="${p.WECHAT_MCH_ID}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${p.WECHAT_CERT_SERIAL_NO}"`
}

async function createPayment(order, pkg) {
  const p = settings.payConfig()
  if (p.PAY_MODE !== 'wechat') {
    return { mode: 'mock', payText: `/mock/${order.order_no}`, message: '模拟支付模式' }
  }
  const missing = ['WECHAT_MCH_ID', 'WECHAT_APP_ID', 'WECHAT_API_V3_KEY', 'WECHAT_CERT_SERIAL_NO', 'WECHAT_PRIVATE_KEY', 'WECHAT_NOTIFY_URL']
    .filter(k => !p[k])
  if (missing.length) throw new Error(`微信支付配置缺失：${missing.join(', ')}`)

  const requestPath = '/v3/pay/transactions/native'
  const body = JSON.stringify({
    appid: p.WECHAT_APP_ID,
    mchid: p.WECHAT_MCH_ID,
    description: `MCard-${pkg.name}`.slice(0, 127),
    out_trade_no: order.order_no,
    notify_url: p.WECHAT_NOTIFY_URL,
    amount: { total: order.amount_cents, currency: 'CNY' }
  })
  const res = await httpRequest('POST', requestPath, body, { Authorization: wechatAuthorization('POST', requestPath, body) })
  if (res.status !== 200 || !res.data?.code_url) {
    throw new Error(`微信下单失败（${res.status}）：${res.data?.message || res.text}`)
  }
  return { mode: 'wechat', payText: res.data.code_url, codeUrl: res.data.code_url }
}

function decryptResource(resource) {
  if (!resource?.ciphertext) return null
  const apiV3Key = settings.payConfig().WECHAT_API_V3_KEY
  if (!apiV3Key || apiV3Key.length !== 32) throw new Error('微信支付解密失败：API v3 密钥未配置或长度不为 32 位')
  if (!resource.nonce) throw new Error('微信支付解密失败：回调报文缺少 nonce')
  try {
    const key = Buffer.from(apiV3Key, 'utf8')
    const nonce = Buffer.from(resource.nonce, 'utf8')
    const aad = Buffer.from(resource.associated_data || '', 'utf8')
    const raw = Buffer.from(resource.ciphertext, 'base64')
    if (raw.length < 17) throw new Error('密文长度不合法')
    const tag = raw.subarray(raw.length - 16)
    const data = raw.subarray(0, raw.length - 16)
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce)
    decipher.setAuthTag(tag)
    decipher.setAAD(aad)
    const out = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
    return JSON.parse(out)
  } catch (e) {
    throw new Error(`微信支付回调解密失败：${e.message}（请核对 API v3 密钥是否正确）`)
  }
}

async function queryWechatOrder(orderNo) {
  const p = settings.payConfig()
  const requestPath = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(orderNo)}?mchid=${encodeURIComponent(p.WECHAT_MCH_ID)}`
  const res = await httpRequest('GET', requestPath, null, { Authorization: wechatAuthorization('GET', requestPath) })
  if (res.status === 404) return null // 明确查无此单 = 未支付
  if (res.status !== 200) throw new Error(`微信查单失败（${res.status}）：${res.data?.message || res.text || '未知错误'}`)
  return res.data
}

module.exports = { createPayment, decryptResource, queryWechatOrder, httpRequest, wechatAuthorization, payConfig: settings.payConfig }
