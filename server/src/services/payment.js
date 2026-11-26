// 支付服务内核（唯一真相源 = utils/settings.js 的支付分组 + utils/origin.js 的动态域名）
// 参照 MShop 支付链路对齐，MCard 场景无退款：只做收款、回调、查单、补单。
// 安全铁律（对齐 MShop）：
//   1. 微信/支付宝回调一律强制验签，缺平台证书/公钥直接判失败，绝不静默放行；
//   2. 金额强校验在回调与查单两处都做，避免「付少开通多」；
//   3. 支付单号与订单号分离：重付用 `${order_no}_X${尾缀}` 新号，规避微信 V3 关单后同号永久作废；
//   4. 所有对外 HTTP 调用有超时 + try/catch，错误文案可读，绝不静默吞错。
const https = require('https')
const crypto = require('crypto')
const settings = require('../utils/settings')
const { requestUrl } = require('../utils/origin')
const db = require('../db')
const { randomHex } = require('../utils/id')

const MCH_HOST = 'api.mch.weixin.qq.com'
const HTTP_TIMEOUT = 15000
const OUT_TRADE_SEP = '_X'

// ---------------- 通用 HTTP ----------------
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
      res.on('error', e => reject(e))
      res.on('aborted', () => reject(new Error('支付网关响应中断')))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        let data = null
        try { data = text ? JSON.parse(text) : null } catch { /* 保留原文用于报错 */ }
        resolve({ status: res.statusCode, data, text })
      })
    })
    req.setTimeout(HTTP_TIMEOUT, () => req.destroy(new Error('支付网关请求超时')))
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

// 支付宝网关走 form POST（与微信 JSON V3 不同）
function formRequest(url, form) {
  return new Promise((resolve, reject) => {
    let u
    try { u = new URL(url) } catch { return reject(new Error('支付宝网关地址不合法')) }
    if (u.protocol !== 'https:') return reject(new Error('支付宝网关必须使用 HTTPS'))
    const payload = Buffer.from(form, 'utf8')
    const req = https.request({
      host: u.hostname, port: u.port || 443, path: `${u.pathname}${u.search}`, method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8', 'Content-Length': payload.length }
    }, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('error', reject)
      res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }))
    })
    req.setTimeout(HTTP_TIMEOUT, () => req.destroy(new Error('支付宝网关请求超时')))
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

// ---------------- 单号（支付单号与订单号分离）----------------
// 微信 V3 关单后商户订单号永久作废，同号重下必报 201「商户订单号重复」（MShop 实锤）。
// 因此重付一律换新单号，旧预支付单 2h 自动失效，不主动关单。
function getOutTradeNo(order) {
  const payNo = String(order?.pay_no || '')
  return payNo.includes(OUT_TRADE_SEP) ? payNo : String(order?.order_no || '')
}
function makeNewOutTradeNo(order) {
  const no = `${order.order_no}${OUT_TRADE_SEP}${Date.now().toString().slice(-6)}${randomHex(2).toUpperCase()}`
  db.prepare('UPDATE orders SET pay_no = ? WHERE id = ?').run(no, order.id)
  return no
}
function baseOrderNo(outTradeNo) {
  return String(outTradeNo || '').split(OUT_TRADE_SEP)[0]
}

// ---------------- 微信支付 V3 ----------------
function wechatAuthorization(method, requestPath, body = '', p = settings.payConfig()) {
  if (!p.WECHAT_PRIVATE_KEY || !p.WECHAT_MCH_ID || !p.WECHAT_CERT_SERIAL_NO) {
    throw new Error('微信支付签名配置缺失：请检查商户号、证书序列号与商户私钥')
  }
  const nonce = randomHex(16)
  const timestamp = Math.floor(Date.now() / 1000)
  const message = `${method}\n${requestPath}\n${timestamp}\n${nonce}\n${body}\n`
  const signature = crypto.createSign('RSA-SHA256').update(message, 'utf8').sign(p.WECHAT_PRIVATE_KEY, 'base64')
  return `WECHATPAY2-SHA256-RSA2048 mchid="${p.WECHAT_MCH_ID}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${p.WECHAT_CERT_SERIAL_NO}"`
}

function wechatReady(p = settings.payConfig()) {
  const missing = ['WECHAT_MCH_ID', 'WECHAT_APP_ID', 'WECHAT_API_V3_KEY', 'WECHAT_CERT_SERIAL_NO', 'WECHAT_PRIVATE_KEY']
    .filter(k => !p[k])
  if (missing.length) throw new Error(`微信支付配置缺失：${missing.join(', ')}`)
  return p
}

async function wxPost(pathname, body, p = settings.payConfig()) {
  wechatReady(p)
  const str = JSON.stringify(body)
  const res = await httpRequest('POST', pathname, str, { Authorization: wechatAuthorization('POST', pathname, str, p) })
  if (res.status !== 200) throw new Error(`微信下单失败（${res.status}）：${res.data?.message || res.text || '未知错误'}`)
  return res.data || {}
}

async function wechatNativePay(order, pkg, ctx = {}) {
  const p = wechatReady()
  const outTradeNo = ctx.outTradeNo || getOutTradeNo(order)
  const body = {
    appid: p.WECHAT_APP_ID, mchid: p.WECHAT_MCH_ID,
    description: `MCard-${pkg.name}`.slice(0, 127),
    out_trade_no: outTradeNo,
    notify_url: ctx.notifyUrl || p.WECHAT_NOTIFY_URL || requestUrl(ctx.req, `/api/pay/notify/wechat`),
    amount: { total: order.amount_cents, currency: 'CNY' }
  }
  const data = await wxPost('/v3/pay/transactions/native', body, p)
  if (!data.code_url) throw new Error(`微信下单失败：未返回二维码（${data.message || '未知原因'}）`)
  return { mode: 'wechat', payType: 'wechat_native', payText: data.code_url, codeUrl: data.code_url, outTradeNo }
}

// JSAPI：公众号 / 小程序共用下单接口，调起参数二次签名的 appid 必须与下单一致
async function wechatJsapiPay(order, pkg, ctx = {}) {
  const p = wechatReady()
  const appid = ctx.appid || p.WECHAT_APP_ID
  const openid = String(ctx.openid || '').slice(0, 128)
  if (!openid) throw new Error('微信 JSAPI 支付缺少 openid，请先在微信内完成授权')
  const outTradeNo = ctx.outTradeNo || getOutTradeNo(order)
  const body = {
    appid, mchid: p.WECHAT_MCH_ID,
    description: `MCard-${pkg.name}`.slice(0, 127),
    out_trade_no: outTradeNo,
    notify_url: ctx.notifyUrl || p.WECHAT_NOTIFY_URL || requestUrl(ctx.req, `/api/pay/notify/wechat`),
    amount: { total: order.amount_cents, currency: 'CNY' },
    payer: { openid }
  }
  const data = await wxPost('/v3/pay/transactions/jsapi', body, p)
  if (!data.prepay_id) throw new Error(`微信下单失败：未返回 prepay_id（${data.message || '未知原因'}）`)
  const timeStamp = Math.floor(Date.now() / 1000).toString()
  const nonceStr = randomHex(16)
  const packageStr = `prepay_id=${data.prepay_id}`
  const signStr = `${appid}\n${timeStamp}\n${nonceStr}\n${packageStr}\n`
  const paySign = crypto.createSign('RSA-SHA256').update(signStr, 'utf8').sign(p.WECHAT_PRIVATE_KEY, 'base64')
  return {
    mode: 'wechat', payType: ctx.payType || 'wechat_jsapi', payText: '', outTradeNo,
    payParams: { appId: appid, timeStamp, nonceStr, package: packageStr, signType: 'RSA', paySign }
  }
}

// H5（MWEB）：手机系统浏览器拉起微信 App。scene_info 的 h5_info 在 v3 只认 type/app_name/app_url，
// 绝不传 v2 的 wap_url/wap_name（会被判「未在API文档中定义的参数」直接拒单）。
async function wechatH5Pay(order, pkg, ctx = {}) {
  const p = wechatReady()
  const outTradeNo = ctx.outTradeNo || getOutTradeNo(order)
  const ip = String(ctx.clientIp || '127.0.0.1').replace(/^::ffff:/, '')
  const clientIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) ? ip : '127.0.0.1'
  const body = {
    appid: p.WECHAT_APP_ID, mchid: p.WECHAT_MCH_ID,
    description: `MCard-${pkg.name}`.slice(0, 127),
    out_trade_no: outTradeNo,
    notify_url: ctx.notifyUrl || p.WECHAT_NOTIFY_URL || requestUrl(ctx.req, `/api/pay/notify/wechat`),
    amount: { total: order.amount_cents, currency: 'CNY' },
    scene_info: { payer_client_ip: clientIp, h5_info: { type: 'Wap' } }
  }
  const data = await wxPost('/v3/pay/transactions/h5', body, p)
  if (!data.h5_url) throw new Error(`微信 H5 下单失败：未返回 h5_url（${data.message || '未知原因'}）`)
  const returnUrl = ctx.returnUrl || p.WECHAT_H5_RETURN_URL || requestUrl(ctx.req, `/me/pay/${order.id}`)
  return { mode: 'wechat', payType: 'wechat_h5', payText: data.h5_url, payUrl: `${data.h5_url}&redirect_url=${encodeURIComponent(returnUrl)}`, outTradeNo }
}

async function queryWechatOrder(outTradeNo, p = settings.payConfig()) {
  const pathname = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}?mchid=${encodeURIComponent(p.WECHAT_MCH_ID)}`
  const res = await httpRequest('GET', pathname, null, { Authorization: wechatAuthorization('GET', pathname, '', p) })
  if (res.status === 404) return null // 明确查无此单 = 未支付
  if (res.status !== 200) throw new Error(`微信查单失败（${res.status}）：${res.data?.message || res.text || '未知错误'}`)
  return res.data
}

// 微信回调验签：强制要求平台证书/公钥，缺配置直接 false（绝不用商户私钥回退）
function verifyWechatNotify(headers, raw, p = settings.payConfig()) {
  const ts = headers['wechatpay-timestamp']
  const nonce = headers['wechatpay-nonce']
  const signature = headers['wechatpay-signature']
  if (!ts || !nonce || !signature) return false
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false
  if (!p.WECHAT_PLATFORM_CERT) {
    console.error('[wechat] 未配置平台证书/公钥，回调验签无法进行（已拒绝放行）')
    return false
  }
  try {
    const message = `${ts}\n${nonce}\n${raw.toString('utf8')}\n`
    return crypto.createVerify('RSA-SHA256').update(message).verify(p.WECHAT_PLATFORM_CERT, signature, 'base64')
  } catch (e) {
    console.error('[wechat] 回调验签异常：', e.message)
    return false
  }
}

function decryptResource(resource, apiV3Key = settings.payConfig().WECHAT_API_V3_KEY) {
  if (!resource?.ciphertext) return null
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
    return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8'))
  } catch (e) {
    throw new Error(`微信支付回调解密失败：${e.message}（请核对 API v3 密钥是否正确）`)
  }
}

// ---------------- 支付宝 ----------------
function nowCST() {
  const d = new Date(Date.now() + 8 * 3600 * 1000) // 支付宝要求北京时间
  return d.toISOString().slice(0, 19).replace('T', ' ')
}
function toPemKey(raw, kind = 'private') {
  const s = String(raw || '').trim().replace(/\\n/g, '\n')
  if (!s) return ''
  if (s.includes('BEGIN')) return s
  const label = kind === 'public' ? 'PUBLIC KEY' : 'PRIVATE KEY'
  return `-----BEGIN ${label}-----\n${s.replace(/(.{64})/g, '$1\n')}\n-----END ${label}-----`
}
function buildQuery(params) {
  return Object.keys(params)
    .filter(k => params[k] !== null && params[k] !== undefined && params[k] !== '')
    .sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&')
}
function aliConfig(p = settings.payConfig()) {
  return {
    appId: p.ALI_APP_ID,
    privateKey: toPemKey(p.ALI_PRIVATE_KEY),
    pubKey: toPemKey(p.ALI_PUB_KEY, 'public'),
    gateway: 'https://openapi.alipay.com/gateway.do'
  }
}
function aliReady(cfg) {
  if (!cfg.appId || !cfg.privateKey || !cfg.pubKey) {
    throw new Error('支付宝支付配置缺失：请检查 AppID、应用私钥与支付宝公钥')
  }
  return cfg
}
function aliSign(params, cfg) {
  const str = Object.keys(params).filter(k => params[k] !== null && params[k] !== undefined && params[k] !== '')
    .sort().map(k => `${k}=${params[k]}`).join('&')
  return crypto.createSign('RSA-SHA256').update(str, 'utf8').sign(cfg.privateKey, 'base64')
}
function aliBaseParams(method, bizContent, cfg, ctx = {}) {
  const params = {
    app_id: cfg.appId, method, charset: 'utf-8', sign_type: 'RSA2',
    timestamp: nowCST(), version: '1.0', biz_content: JSON.stringify(bizContent)
  }
  if (ctx.notifyUrl) params.notify_url = ctx.notifyUrl
  if (ctx.returnUrl) params.return_url = ctx.returnUrl
  params.sign = aliSign(params, cfg)
  return params
}
async function aliPagePay(order, pkg, ctx = {}) {
  const cfg = aliReady(aliConfig())
  const outTradeNo = ctx.outTradeNo || getOutTradeNo(order)
  const bizContent = {
    out_trade_no: outTradeNo, product_code: 'FAST_INSTANT_TRADE_PAY',
    total_amount: (order.amount_cents / 100).toFixed(2), subject: `MCard-${pkg.name}`.slice(0, 256)
  }
  const params = aliBaseParams('alipay.trade.page.pay', bizContent, cfg, {
    notifyUrl: ctx.notifyUrl || settings.payConfig().ALI_NOTIFY_URL || requestUrl(ctx.req, '/api/pay/notify/alipay'),
    returnUrl: ctx.returnUrl || settings.payConfig().ALI_RETURN_URL || requestUrl(ctx.req, `/me/pay/${order.id}`)
  })
  const payUrl = `${cfg.gateway}?${buildQuery(params)}`
  return { mode: 'alipay', payType: 'alipay_page', payText: payUrl, payUrl, outTradeNo }
}
async function aliWapPay(order, pkg, ctx = {}) {
  const cfg = aliReady(aliConfig())
  const outTradeNo = ctx.outTradeNo || getOutTradeNo(order)
  const returnUrl = ctx.returnUrl || settings.payConfig().ALI_RETURN_URL || requestUrl(ctx.req, `/me/pay/${order.id}`)
  const bizContent = {
    out_trade_no: outTradeNo, product_code: 'QUICK_WAP_WAY',
    total_amount: (order.amount_cents / 100).toFixed(2), subject: `MCard-${pkg.name}`.slice(0, 256),
    quit_url: returnUrl
  }
  const params = aliBaseParams('alipay.trade.wap.pay', bizContent, cfg, {
    notifyUrl: ctx.notifyUrl || settings.payConfig().ALI_NOTIFY_URL || requestUrl(ctx.req, '/api/pay/notify/alipay'),
    returnUrl
  })
  const payUrl = `${cfg.gateway}?${buildQuery(params)}`
  return { mode: 'alipay', payType: 'alipay_wap', payText: payUrl, payUrl, outTradeNo }
}
// 支付宝小程序：trade.create 同步返回 trade_no，前端 my.tradePay({ tradeNO })
async function aliMiniPay(order, pkg, ctx = {}) {
  const cfg = aliReady(aliConfig())
  const outTradeNo = ctx.outTradeNo || getOutTradeNo(order)
  const bizContent = {
    out_trade_no: outTradeNo,
    total_amount: (order.amount_cents / 100).toFixed(2), subject: `MCard-${pkg.name}`.slice(0, 256)
  }
  if (ctx.buyerId) bizContent.buyer_id = String(ctx.buyerId).slice(0, 64)
  const params = aliBaseParams('alipay.trade.create', bizContent, cfg, {
    notifyUrl: ctx.notifyUrl || settings.payConfig().ALI_NOTIFY_URL || requestUrl(ctx.req, '/api/pay/notify/alipay')
  })
  const res = await formRequest(cfg.gateway, buildQuery(params))
  let data = null
  try { data = JSON.parse(res.text) } catch { throw new Error(`支付宝下单返回解析失败：${res.text.slice(0, 200)}`) }
  const resp = data?.alipay_trade_create_response
  if (!resp || (resp.code && resp.code !== '10000')) {
    throw new Error(`支付宝下单失败：${resp?.sub_msg || resp?.msg || res.text.slice(0, 200)}`)
  }
  if (!resp.trade_no) throw new Error('支付宝下单失败：未返回 trade_no')
  return { mode: 'alipay', payType: 'alipay_miniapp', payText: resp.trade_no, tradeNo: resp.trade_no, outTradeNo }
}
async function queryAliOrder(outTradeNo, p = settings.payConfig()) {
  const cfg = aliReady(aliConfig(p))
  const params = aliBaseParams('alipay.trade.query', { out_trade_no: outTradeNo }, cfg)
  const res = await formRequest(cfg.gateway, buildQuery(params))
  let data = null
  try { data = JSON.parse(res.text) } catch { throw new Error(`支付宝查单返回解析失败：${res.text.slice(0, 200)}`) }
  const resp = data?.alipay_trade_query_response || data
  if (resp?.code && resp.code !== '10000') throw new Error(`支付宝查单失败：${resp.sub_msg || resp.msg}`)
  return resp
}
// 支付宝回调验签：强制要求支付宝公钥，缺配置直接 false
function verifyAliNotify(params) {
  const cfg = aliConfig()
  if (!cfg.pubKey) {
    console.error('[alipay] 未配置支付宝公钥，回调验签无法进行（已拒绝放行）')
    return false
  }
  const receivedSign = params.sign
  if (!receivedSign) return false
  const copy = { ...params }
  delete copy.sign
  delete copy.sign_type
  const signContent = Object.keys(copy).sort().filter(k => copy[k]).map(k => `${k}=${copy[k]}`).join('&')
  try {
    const pubKey = crypto.createPublicKey(cfg.pubKey).export({ type: 'spki', format: 'pem' })
    return crypto.createVerify('RSA-SHA256').update(signContent).verify(pubKey, receivedSign, 'base64')
  } catch (e) {
    console.error('[alipay] 回调验签异常：', e.message)
    return false
  }
}

// 小程序 code 换 openid：只在服务端用 AppID+Secret 换取，绝不让前端传 openid（防伪造身份付款）
function miniOpenidByCode(code, p = settings.payConfig()) {
  const c = String(code || '').trim()
  if (!c) throw new Error('缺少小程序登录 code')
  const appid = p.WECHAT_MINI_APP_ID
  const secret = settings.get('miniapp_wx_secret', '')
  if (!appid || !secret) throw new Error('小程序支付配置缺失：请检查小程序 AppID 与 AppSecret')
  const pathname = `/sns/jscode2session?appid=${encodeURIComponent(appid)}&secret=${encodeURIComponent(secret)}&js_code=${encodeURIComponent(c)}&grant_type=authorization_code`
  return new Promise((resolve, reject) => {
    const req = https.request({ host: 'api.weixin.qq.com', path: pathname, method: 'GET', headers: { Accept: 'application/json' } }, res => {
      const chunks = []
      res.on('data', x => chunks.push(x))
      res.on('error', reject)
      res.on('end', () => {
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString('utf8'))
          if (data.errcode) return reject(new Error(`微信登录凭证无效：${data.errmsg || data.errcode}`))
          if (!data.openid) return reject(new Error('微信登录未返回 openid'))
          resolve(String(data.openid).slice(0, 128))
        } catch (e) { reject(new Error(`小程序登录响应解析失败：${e.message}`)) }
      })
    })
    req.setTimeout(HTTP_TIMEOUT, () => req.destroy(new Error('小程序登录校验超时')))
    req.on('error', reject)
    req.end()
  })
}

// ---------------- 统一出口 ----------------
// method: wechat | alipay（mock 由上层判定）；scene: pc | h5 | wechat | miniapp | alipay-mini
async function createPayment(order, pkg, opts = {}) {
  // 防御：三方支付要求金额 ≥ 1 分；0 元订单必须由 orders.js 走免费开通，任何漏网调用都不发到网关
  if (!(Number(order?.amount_cents) > 0)) throw new Error('0 元订单无需支付，请走免费开通')
  const p = settings.payConfig()
  const channels = settings.payChannels(p)
  const method = opts.method || (channels.includes('wechat') ? 'wechat' : channels.includes('alipay') ? 'alipay' : 'mock')
  if (method === 'mock' || !channels.includes(method)) {
    return { mode: 'mock', payType: 'mock', payText: `/mock/${order.order_no}`, message: '模拟支付模式' }
  }
  const ctx = { ...opts, req: opts.req }
  // 首次下单（reuseOutTradeNo=true）复用订单号；重走 /:id/pay 才 makeNewOutTradeNo 换 _X 新号，
  // 规避微信 v3 关单后同号重下报 201「商户订单号重复」。
  // ⚠️ reuseOutTradeNo 是布尔开关，绝不能当订单号用：此前 `opts.reuseOutTradeNo || makeNewOutTradeNo(order)`
  // 会把 true 塞进 out_trade_no，微信报 400「商户订单号必填性规则校验失败」（2026-11-27 实锤故障）。
  const outTradeNo = opts.reuseOutTradeNo ? getOutTradeNo(order) : makeNewOutTradeNo(order)
  if (!outTradeNo) throw new Error('订单号为空，无法发起支付')
  ctx.outTradeNo = outTradeNo
  if (method === 'wechat') {
    const scene = String(opts.scene || 'pc').toLowerCase()
    if (scene === 'miniapp') return wechatJsapiPay(order, pkg, { ...ctx, appid: p.WECHAT_MINI_APP_ID || p.WECHAT_APP_ID, payType: 'wechat_miniapp' })
    if (scene === 'wechat') return wechatJsapiPay(order, pkg, { ...ctx, appid: p.WECHAT_OA_APP_ID || p.WECHAT_APP_ID, openid: ctx.openid, payType: 'wechat_jsapi' })
    if (scene === 'h5') return wechatH5Pay(order, pkg, ctx)
    return wechatNativePay(order, pkg, ctx) // PC 扫码 + 默认兜底
  }
  if (method === 'alipay') {
    const scene = String(opts.scene || 'pc').toLowerCase()
    if (scene === 'alipay-mini' || scene === 'miniapp') return aliMiniPay(order, pkg, ctx)
    if (scene === 'h5' || scene === 'wechat') return aliWapPay(order, pkg, ctx) // 微信内由 alipay-link 桥接，这里按手机网站兜底
    return aliPagePay(order, pkg, ctx)
  }
  throw new Error(`不支持的支付方式：${method}`)
}

async function queryPayment(order, method = order?.payment_method) {
  const outTradeNo = getOutTradeNo(order)
  if (method === 'alipay') {
    const r = await queryAliOrder(outTradeNo)
    return {
      paid: ['TRADE_SUCCESS', 'TRADE_FINISHED'].includes(r.trade_status),
      total: r.total_amount ? Math.round(Number(r.total_amount) * 100) : null,
      transactionId: r.trade_no || '', raw: r
    }
  }
  const r = await queryWechatOrder(outTradeNo)
  if (!r) return { paid: false, total: null, transactionId: '', raw: null }
  return {
    paid: r.trade_state === 'SUCCESS',
    total: r.amount?.total ?? null,
    transactionId: r.transaction_id || '', raw: r
  }
}

module.exports = {
  createPayment, queryPayment,
  createPaymentLegacy: createPayment,
  wechatAuthorization, decryptResource, queryWechatOrder, verifyWechatNotify,
  aliSign, verifyAliNotify, toPemKey,
  getOutTradeNo, makeNewOutTradeNo, baseOrderNo, OUT_TRADE_SEP,
  httpRequest, formRequest, miniOpenidByCode, payConfig: settings.payConfig
}
