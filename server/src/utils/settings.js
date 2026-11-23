// 配置中心：所有「运行时可改」参数的定义与唯一真相源。
// 存储于 site_config（DB），.env 仅首次启动种子，不再作为运行时来源。
// 敏感字段只写不读：GET 回掩码 + SHA256 指纹；PUT 收到空/掩码时沿用库中旧值。
const crypto = require('crypto')
const config = require('../config')

// 公开键：匿名接口 /api/public/config 仅下发这些
const PUBLIC_KEYS = ['site_name', 'site_desc', 'contact', 'notice', 'qr_brand']
// 公开派生键：由后端算好后下发，前端据此决定是否显示微信快捷登录入口（不下发任何 key/secret）
const PUBLIC_DERIVED_KEYS = ['wechat_login_enabled']

// 分组定义：前端按此渲染表单（label/type/敏感标记），键名即 site_config 的 key
const GROUPS = {
  site: {
    label: '站点基础',
    fields: [
      { key: 'site_name', label: '站点名称', type: 'text' },
      { key: 'site_desc', label: '站点简介', type: 'text' },
      { key: 'contact', label: '联系方式', type: 'text' },
      { key: 'notice', label: '公告', type: 'textarea' },
      { key: 'qr_brand', label: '二维码水印', type: 'text' }
    ]
  },
  payment: {
    label: '支付参数',
    fields: [
      { key: 'pay_mode', label: '支付模式（mock / wechat）', type: 'text' },
      { key: 'wechat_mch_id', label: '微信商户号 MCH ID', type: 'text' },
      { key: 'wechat_app_id', label: '微信 AppID', type: 'text' },
      { key: 'wechat_api_v3_key', label: 'API v3 密钥', type: 'secret' },
      { key: 'wechat_cert_serial_no', label: '商户证书序列号', type: 'text' },
      { key: 'wechat_private_key', label: '商户私钥 PEM', type: 'secret', large: true },
      { key: 'wechat_notify_url', label: '支付回调 URL', type: 'text' },
      { key: 'wechat_platform_cert', label: '微信平台证书 PEM（可选，用于回调验签）', type: 'secret', large: true }
    ]
  },
  sms: {
    label: '短信平台',
    fields: [
      { key: 'sms_enabled', label: '启用短信（true / false）', type: 'text' },
      { key: 'sms_provider', label: '服务商（aliyun）', type: 'text' },
      { key: 'sms_access_key_id', label: 'AccessKey ID', type: 'text' },
      { key: 'sms_access_key_secret', label: 'AccessKey Secret', type: 'secret' },
      { key: 'sms_sign_name', label: '短信签名', type: 'text' },
      { key: 'sms_template_code', label: '验证码模板 Code', type: 'text' }
    ]
  },
  miniapp: {
    label: '小程序参数',
    fields: [
      { key: 'miniapp_wx_appid', label: '微信小程序 AppID', type: 'text' },
      { key: 'miniapp_wx_secret', label: '微信小程序 AppSecret', type: 'secret' },
      { key: 'miniapp_ali_appid', label: '支付宝小程序 AppID', type: 'text' },
      { key: 'miniapp_tt_appid', label: '抖音小程序 AppID', type: 'text' }
    ]
  },
  wechat_oauth: {
    label: '微信网页授权',
    fields: [
      { key: 'wechat_oauth_enabled', label: '启用微信快捷登录（true / false）', type: 'text' },
      { key: 'wechat_oauth_appid', label: '公众号 AppID（网页授权用，非小程序）', type: 'text' },
      { key: 'wechat_oauth_secret', label: '公众号 AppSecret', type: 'secret' },
      { key: 'wechat_oauth_scope', label: '授权范围（固定 snsapi_userinfo 以取昵称头像）', type: 'text' },
      { key: 'wechat_oauth_bind_phone', label: '新用户授权后必须绑定手机号（true / false）', type: 'text' },
      { key: 'wechat_oauth_verify_name', label: '域名校验文件名（MP_verify_xxx.txt）', type: 'text' },
      { key: 'wechat_oauth_verify_content', label: '域名校验文件内容（微信给的一串字符）', type: 'textarea' }
    ]
  }
}

const SENSITIVE_KEYS = Object.values(GROUPS).flatMap(g => g.fields).filter(f => f.type === 'secret').map(f => f.key)
const ALL_KEYS = Object.values(GROUPS).flatMap(g => g.fields).map(f => f.key)
const MASK = '••••••••••••'
const fingerprint = v => { try { return crypto.createHash('sha256').update(String(v || '')).digest('hex').slice(0, 12) } catch { return '' } }

// 运行时读取单个配置（DB 优先，缺省回落 config.env 的种子值）
function get(key, fallback = '') {
  const row = require('../db').prepare('SELECT value FROM site_config WHERE key = ?').get(key)
  if (row) { try { return JSON.parse(row.value) ?? fallback } catch { return fallback } }
  return fallback
}

// 读取支付配置对象：DB 优先，DB 无值时用 .env 种子
function payConfig() {
  const fromDb = k => String(get(k, ''))
  return {
    PAY_MODE: fromDb('pay_mode') || config.PAY_MODE || 'mock',
    WECHAT_MCH_ID: fromDb('wechat_mch_id') || config.WECHAT_MCH_ID || '',
    WECHAT_APP_ID: fromDb('wechat_app_id') || config.WECHAT_APP_ID || '',
    WECHAT_API_V3_KEY: fromDb('wechat_api_v3_key') || config.WECHAT_API_V3_KEY || '',
    WECHAT_CERT_SERIAL_NO: fromDb('wechat_cert_serial_no') || config.WECHAT_CERT_SERIAL_NO || '',
    WECHAT_PRIVATE_KEY: fromDb('wechat_private_key') || config.WECHAT_PRIVATE_KEY || '',
    WECHAT_NOTIFY_URL: fromDb('wechat_notify_url') || config.WECHAT_NOTIFY_URL || '',
    WECHAT_PLATFORM_CERT: fromDb('wechat_platform_cert') || config.WECHAT_PLATFORM_CERT || ''
  }
}

// 读取短信配置对象
function smsConfig() {
  const fromDb = k => String(get(k, ''))
  return {
    enabled: fromDb('sms_enabled') === 'true',
    provider: fromDb('sms_provider') || 'aliyun',
    accessKeyId: fromDb('sms_access_key_id') || '',
    accessKeySecret: fromDb('sms_access_key_secret') || '',
    signName: fromDb('sms_sign_name') || '',
    templateCode: fromDb('sms_template_code') || ''
  }
}

// 读取微信网页授权配置（公众号 OAuth，非小程序）
function wechatOauthConfig() {
  const fromDb = k => String(get(k, ''))
  return {
    enabled: fromDb('wechat_oauth_enabled') === 'true',
    appId: fromDb('wechat_oauth_appid'),
    secret: fromDb('wechat_oauth_secret'),
    scope: 'snsapi_userinfo', // 需求：取昵称头像，固定 userinfo（不接受公开改 scope）
    bindPhone: fromDb('wechat_oauth_bind_phone') !== 'false',
    verifyName: fromDb('wechat_oauth_verify_name'),
    verifyContent: fromDb('wechat_oauth_verify_content')
  }
}

// 前端配置是否显示微信快捷登录：开关开启 + AppID/Secret 齐全（AppSecret 从库直读，不下发）
function wechatLoginEnabled() {
  const c = wechatOauthConfig()
  return c.enabled && !!c.appId && !!c.secret
}

// 公开配置：白名单键 + 派生开关（绝不外泄任何 key/secret）
function publicView() {
  const out = {}
  for (const k of PUBLIC_KEYS) out[k] = get(k, '')
  for (const k of PUBLIC_DERIVED_KEYS) {
    if (k === 'wechat_login_enabled') out[k] = wechatLoginEnabled()
  }
  return out
}

// 管理端读取：敏感字段回掩码+指纹，其余回明文
function adminView() {
  const db = require('../db')
  const rows = db.prepare('SELECT key, value FROM site_config').all()
  const map = Object.fromEntries(rows.map(r => {
    try { return [r.key, JSON.parse(r.value)] } catch { return [r.key, ''] }
  }))
  const out = {}
  for (const k of ALL_KEYS) out[k] = map[k] ?? ''
  for (const k of SENSITIVE_KEYS) {
    const val = String(map[k] || '')
    out[k] = val ? MASK : ''
    out[`${k}_fp`] = val ? fingerprint(val) : ''
  }
  return out
}

// 首次启动种子：仅写入 DB 中不存在的键（敏感键也只种一次，之后以 DB 为准）
function seedDefaults() {
  const db = require('../db')
  const stmt = db.prepare('INSERT OR IGNORE INTO site_config (key, value, updated_at) VALUES (?,?,datetime(\'now\'))')
  const seeds = {
    pay_mode: config.PAY_MODE || 'mock',
    wechat_mch_id: config.WECHAT_MCH_ID || '',
    wechat_app_id: config.WECHAT_APP_ID || '',
    wechat_api_v3_key: config.WECHAT_API_V3_KEY || '',
    wechat_cert_serial_no: config.WECHAT_CERT_SERIAL_NO || '',
    wechat_private_key: config.WECHAT_PRIVATE_KEY || '',
    wechat_notify_url: config.WECHAT_NOTIFY_URL || '',
    wechat_platform_cert: config.WECHAT_PLATFORM_CERT || '',
    sms_enabled: 'false',
    sms_provider: 'aliyun',
    sms_access_key_id: '',
    sms_access_key_secret: '',
    sms_sign_name: '',
    sms_template_code: '',
    miniapp_wx_appid: '',
    miniapp_wx_secret: '',
    miniapp_ali_appid: '',
    miniapp_tt_appid: '',
    wechat_oauth_enabled: 'false',
    wechat_oauth_appid: '',
    wechat_oauth_secret: '',
    wechat_oauth_scope: 'snsapi_userinfo',
    wechat_oauth_bind_phone: 'true',
    wechat_oauth_verify_name: '',
    wechat_oauth_verify_content: ''
  }
  const tx = db.transaction(() => {
    for (const [k, v] of Object.entries(seeds)) stmt.run(k, JSON.stringify(String(v || '')))
  })
  tx()
}

module.exports = { PUBLIC_KEYS, PUBLIC_DERIVED_KEYS, GROUPS, SENSITIVE_KEYS, ALL_KEYS, MASK, fingerprint, get, payConfig, smsConfig, wechatOauthConfig, wechatLoginEnabled, publicView, adminView, seedDefaults }
