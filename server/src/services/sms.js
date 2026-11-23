// 短信服务：阿里云短信 V2（Dysmsapi），纯 Node 实现无第三方 SDK 依赖。
// 参数来自配置中心 settings.smsConfig()，后台改完即时生效。
// 签名注意：Timestamp 用 new Date().toISOString() 去掉毫秒，末尾保留且仅保留一个 Z。
const https = require('https')
const crypto = require('crypto')
const settings = require('../utils/settings')

const ENDPOINT = { host: 'dysmsapi.aliyuncs.com', path: '/' }

function percentEncode(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
}

function buildSignature(params, accessKeySecret) {
  const sorted = Object.keys(params).sort().map(k => `${percentEncode(k)}=${percentEncode(params[k])}`).join('&')
  const stringToSign = 'GET&%2F&' + percentEncode(sorted)
  return crypto.createHmac('sha256', accessKeySecret + '&').update(stringToSign, 'utf8').digest('base64')
}

function request(params, accessKeyId, accessKeySecret) {
  const base = {
    Format: 'JSON',
    Version: '2017-05-25',
    AccessKeyId: accessKeyId,
    SignatureMethod: 'HMAC-SHA256',
    SignatureVersion: '1.0',
    Timestamp: new Date().toISOString().replace(/\.\d{3}/, ''),
    SignatureNonce: crypto.randomBytes(16).toString('hex'),
    RegionId: 'cn-hangzhou'
  }
  const all = { ...base, ...params }
  all.Signature = buildSignature(all, accessKeySecret)
  const query = Object.keys(all).sort().map(k => `${percentEncode(k)}=${percentEncode(all[k])}`).join('&')
  return new Promise((resolve, reject) => {
    const req = https.get({ ...ENDPOINT, path: `/?${query}` }, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        let data = null; try { data = JSON.parse(text) } catch { /* 保留原文 */ }
        resolve(data || { Code: 'ParseError', Message: text.slice(0, 200) })
      })
    })
    req.setTimeout(12000, () => req.destroy(new Error('短信请求超时')))
    req.on('error', reject)
  })
}

// 发送验证码短信。phoneCodes: JSON 字符串模板参数，如 {"code":"123456"}
async function sendCode(phone, code) {
  const cfg = settings.smsConfig()
  if (!cfg.enabled) throw new Error('短信平台未启用')
  if (!cfg.accessKeyId || !cfg.accessKeySecret || !cfg.signName || !cfg.templateCode) {
    throw new Error('短信平台配置不完整：请填写 AccessKey、签名与模板 Code')
  }
  if (!/^1\d{10}$/.test(String(phone || ''))) throw new Error('手机号格式不正确')
  const result = await request({
    Action: 'SendSms',
    PhoneNumbers: phone,
    SignName: cfg.signName,
    TemplateCode: cfg.templateCode,
    TemplateParam: JSON.stringify({ code: String(code) })
  }, cfg.accessKeyId, cfg.accessKeySecret)
  if (result.Code !== 'OK') throw new Error(`短信发送失败：${result.Code} ${result.Message || ''}`)
  return { ok: true, bizId: result.BizId || '' }
}

module.exports = { sendCode, request, buildSignature }
