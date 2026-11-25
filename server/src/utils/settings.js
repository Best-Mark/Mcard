// 配置中心：所有「运行时可改」参数的定义与唯一真相源。
// 存储于 site_config（DB），.env 仅首次启动种子，不再作为运行时来源。
// 敏感字段只写不读：GET 回掩码 + SHA256 指纹；PUT 收到空/掩码时沿用库中旧值。
const crypto = require('crypto')
const config = require('../config')

// 公开键：匿名接口 /api/public/config 仅下发这些
// share_* 是分享素材池（标题/描述/图片，每行一条），匿名可读——对齐 MShop 的 share_config 白名单口径
const SHARE_KEYS = ['share_title', 'share_desc', 'share_image']
const PUBLIC_KEYS = ['site_name', 'site_logo', 'site_desc', 'contact', 'notice', 'qr_brand', ...SHARE_KEYS]
// 公开派生键：由后端算好后下发，前端据此决定是否显示微信快捷登录入口（不下发任何 key/secret）
const PUBLIC_DERIVED_KEYS = ['wechat_login_enabled']

// 分组定义：前端按此渲染表单（label/type/敏感标记），键名即 site_config 的 key
const GROUPS = {
  site: {
    label: '站点基础',
    fields: [
      { key: 'site_name', label: '站点名称', type: 'text' },
      { key: 'site_logo', label: '站点 LOGO 图片地址（绝对 URL 或 /uploads/ 路径，留空显示默认 M）', type: 'text' },
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
      // 密钥类改用本地文件选择：前端 FileReader 读原文填进配置，随分组 PUT，不产生公开上传地址。
      // accept/maxBytes 是前后端共用的唯一真相源；type 仍是 secret，掩码+指纹机制完全不变。
      { key: 'wechat_api_v3_key', label: 'API v3 密钥', type: 'secret', upload: true, accept: '.txt', fileHint: '选择从微信商户平台下载的 API v3 密钥文本文件', maxBytes: 1000 },
      { key: 'wechat_cert_serial_no', label: '商户证书序列号', type: 'text' },
      { key: 'wechat_private_key', label: '商户私钥 PEM', type: 'secret', large: true, upload: true, accept: '.pem,.key,.txt', fileHint: '选择商户 API 私钥文件 apiclient_key.pem', maxBytes: 20000 },
      { key: 'wechat_notify_url', label: '支付回调 URL', type: 'text' },
      { key: 'wechat_platform_cert', label: '微信平台证书 PEM（可选，用于回调验签）', type: 'secret', large: true, upload: true, accept: '.pem,.crt,.cer,.txt', fileHint: '选择微信支付平台证书文件', maxBytes: 20000 }
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
      { key: 'wechat_oauth_verify_name', label: '域名校验文件名（上传后自动填入）', type: 'hidden' },
      { key: 'wechat_oauth_verify_content', label: '域名校验文件（上传 MP_verify_xxx.txt）', type: 'file' }
    ]
  },
  map: {
    label: '定位与地图',
    fields: [
      { key: 'amap_key', label: '高德地图 Web 服务 Key（IP 定位/逆地理/地理编码）', type: 'secret' },
      { key: 'map_provider', label: '地图服务商（amap / osm）', type: 'text' },
      { key: 'map_default_city', label: '定位兜底城市（如 上海）', type: 'text' }
    ]
  },
  oss: {
    label: '对象存储 OSS',
    fields: [
      { key: 'oss_provider', label: '存储方式（local / aliyun / tencent）', type: 'text' },
      { key: 'oss_path_prefix', label: '项目路径前缀（多项目共用 Bucket 隔离，如 mcard → 全部落在 mcard/uploads/ 下）', type: 'text' },
      { key: 'oss_region', label: '地域（阿里云 oss-cn-* / 腾讯云 ap-*）', type: 'text' },
      { key: 'oss_bucket', label: 'Bucket 名称', type: 'text' },
      { key: 'oss_access_key', label: 'AccessKey ID（阿里云）/ SecretId（腾讯云）', type: 'secret' },
      { key: 'oss_secret_key', label: 'AccessKey Secret（阿里云）/ SecretKey（腾讯云）', type: 'secret' },
      { key: 'oss_custom_domain', label: '自定义域名（可选，不含协议头与结尾斜杠）', type: 'text' }
    ]
  },
  share: {
    label: '分享素材池',
    fields: [
      { key: 'share_title', label: '分享标题池（每行一条，随机取用）', type: 'textarea', large: true },
      { key: 'share_desc', label: '分享描述池（每行一条，随机取用）', type: 'textarea', large: true },
      { key: 'share_image', label: '分享图片池（每行一个绝对 URL，仅 jpg/png/gif 生效）', type: 'textarea', large: true }
    ]
  },
  promo: {
    label: '推广分销',
    fields: [
      { key: 'promo_enabled', label: '启用推广分销（true / false）', type: 'text' },
      { key: 'promo_register_reward_cents', label: '注册奖励（分，被邀请人注册成功给推广员）', type: 'text' },
      { key: 'promo_order_rate', label: '消费返佣比例（%，如 10 表示订单金额的 10%）', type: 'text' },
      { key: 'promo_withdraw_min_cents', label: '最低提现额（分）', type: 'text' },
      { key: 'promo_invite_base_url', label: '邀请链接前缀（留空=自动用当前站点域名，如 https://card.example.com）', type: 'text' }
    ]
  },
  notify: {
    label: '消息通知',
    fields: [
      { key: 'notify_favorite_title', label: '被收藏 · 标题', type: 'text' },
      { key: 'notify_favorite_body', label: '被收藏 · 正文（变量 {actorName}）', type: 'text' },
      { key: 'notify_exchange_title', label: '被交换 · 标题', type: 'text' },
      { key: 'notify_exchange_body', label: '被交换 · 正文（变量 {actorName}）', type: 'text' },
      { key: 'notify_view_title', label: '被查看 · 标题', type: 'text' },
      { key: 'notify_view_body', label: '被查看 · 正文（变量 {actorName}、{cardName}）', type: 'text' },
      { key: 'notify_update_title', label: '关注名片更新 · 标题', type: 'text' },
      { key: 'notify_update_body', label: '关注名片更新 · 正文（变量 {cardName}、{summary}）', type: 'text' },
      { key: 'notify_view_enabled', label: '启用「有人查看了我的名片」通知（true / false）', type: 'text' }
    ]
  }
}

// 通知模板默认值（唯一真相源）：留空即回落这批。变量占位符由 notify.js 统一渲染。
const NOTIFY_TEMPLATE_DEFAULTS = {
  notify_favorite_title: '名片动态',
  notify_favorite_body: '{actorName} 收藏了你的名片',
  notify_exchange_title: '名片动态',
  notify_exchange_body: '{actorName} 与你交换了名片',
  notify_view_title: '名片动态',
  notify_view_body: '{actorName} 查看了你的名片',
  notify_update_title: '名片有更新',
  notify_update_body: '你关注的名片「{cardName}」更新了：{summary}',
  notify_view_enabled: 'true'
}
const NOTIFY_KEYS = Object.keys(NOTIFY_TEMPLATE_DEFAULTS)

// 分享素材池默认值（唯一真相源）：后台留空即回落这批，前端与小程序不再各自硬编码文案。
// MCard 场景是电子名片，文案围绕「存通讯录 / 二维码不变」，与 MShop 的「好物」口径区分。
const SHARE_POOL_DEFAULTS = {
  share_title: [
    '一张名片，扫码存进通讯录',
    '资料随时改，二维码终身不变',
    '认识一下，这是我的电子名片',
    '存下联系方式，随时都能找到我',
    '换手机也不怕，名片二维码不变'
  ],
  share_desc: [
    '电话、微信、地址一目了然，扫码即可存入通讯录。',
    '资料随时更新，二维码长期有效，不用换码。',
    '电子名片：一扫即存，再也不会弄丢联系方式。',
    '点开看看，扫一扫就能把我存进手机。',
    '名片信息都在这里，长按或扫码即可保存。'
  ],
  share_image: []
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

// 读取定位与地图配置（高德 Key 服务端使用，不下发前端）
function mapConfig() {
  const fromDb = k => String(get(k, ''))
  return {
    amapKey: fromDb('amap_key'),
    provider: fromDb('map_provider') || 'amap',
    defaultCity: fromDb('map_default_city') || '上海'
  }
}

// 推广分销规则（唯一真相源）：奖励金额/返佣比例/提现门槛后台可改，服务端结算时直读。
// rate 限制 0~100，金额为非负整数分；脏值一律回落默认，绝不因配置异常给负数或超高返佣。
function promoConfig() {
  // 空值（未种子/后台清空）一律回落默认，不能让 Number('')=0 变成「0 分奖励、0% 返佣」。
  const num = (k, def) => {
    const raw = get(k, null)
    if (raw === null || raw === '' || raw === undefined) return def
    const n = Math.round(Number(raw))
    return Number.isFinite(n) && n >= 0 ? n : def
  }
  const rateRaw = get('promo_order_rate', null)
  const rate = rateRaw === null || rateRaw === '' ? 10 : (Number.isFinite(Number(rateRaw)) && Number(rateRaw) >= 0 && Number(rateRaw) <= 100 ? Number(rateRaw) : 10)
  return {
    enabled: String(get('promo_enabled', '')) === 'true',
    registerRewardCents: num('promo_register_reward_cents', 100),
    orderRate: rate,
    withdrawMinCents: num('promo_withdraw_min_cents', 1000),
    inviteBaseUrl: String(get('promo_invite_base_url', '') || '').trim()
  }
}

// 读取 OSS 配置（服务端直读原始密钥，不走 adminView 掩码；pathPrefix 做容错清洗）
// 多项目共用一个 Bucket 时，pathPrefix 是唯一隔离维度，所有对象 key = `${prefix}/uploads/<file>`
function ossConfig() {
  const fromDb = k => String(get(k, ''))
  const cleanDomain = s => String(s || '').trim().replace(/^https?:\/\//i, '').replace(/^\/+|\/+$/g, '')
  const cleanPrefix = s => String(s || '').trim()
    .replace(/^https?:\/\/[^/]+\/?/i, '')
    .replace(/^(uploads\/)+/i, '')
    .replace(/\/?uploads\/?$/i, '')
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^A-Za-z0-9_./-]/g, '') // 防路径穿越：只留安全字符
  return {
    provider: (fromDb('oss_provider') || 'local').toLowerCase(),
    pathPrefix: cleanPrefix(fromDb('oss_path_prefix') || 'mcard') || 'mcard',
    region: fromDb('oss_region'),
    bucket: fromDb('oss_bucket'),
    accessKey: fromDb('oss_access_key'),
    secretKey: fromDb('oss_secret_key'),
    customDomain: cleanDomain(fromDb('oss_custom_domain'))
  }
}

// 前端配置是否显示微信快捷登录：开关开启 + AppID/Secret 齐全（AppSecret 从库直读，不下发）
function wechatLoginEnabled() {
  const c = wechatOauthConfig()
  return c.enabled && !!c.appId && !!c.secret
}

// 分享素材池：任意值（JSON 数组字符串 / 换行文本 / 旧单值）→ 清洗后的数组（最多 10 条）。
// 只收字符串条目，避免脏值被 String() 强转成 "[object Object]" 当素材发出去。
function normalizePool(v, fallback = []) {
  let arr = []
  if (Array.isArray(v)) arr = v
  else if (typeof v === 'string' && v.trim()) {
    const s = v.trim()
    if (s.startsWith('[')) { try { const p = JSON.parse(s); if (Array.isArray(p)) arr = p } catch { /* 非 JSON 按换行处理 */ } }
    if (!arr.length) arr = s.split(/[\r\n]+/)
  }
  const clean = arr.map(x => String(x ?? '').trim()).filter(Boolean).slice(0, 10)
  return clean.length ? clean : fallback
}

// 分享素材池视图：空值一律回落内置默认池，保证任何页面都有素材可抽
function shareView() {
  const out = {}
  for (const k of SHARE_KEYS) out[k] = normalizePool(get(k, ''), SHARE_POOL_DEFAULTS[k])
  return out
}

// 通知模板视图：空值回落内置默认，notify.js 渲染时统一走这里（唯一真相源）
function notifyView() {
  const out = {}
  for (const k of NOTIFY_KEYS) out[k] = String(get(k, '') || '').trim() || NOTIFY_TEMPLATE_DEFAULTS[k]
  return out
}

// 公开配置：白名单键 + 派生开关（绝不外泄任何 key/secret）
function publicView() {
  const out = {}
  for (const k of PUBLIC_KEYS) out[k] = get(k, '')
  for (const k of PUBLIC_DERIVED_KEYS) {
    if (k === 'wechat_login_enabled') out[k] = wechatLoginEnabled()
  }
  // 分享素材池下发数组；后台未配置时用内置默认池（前端/小程序不再各自硬编码）
  Object.assign(out, shareView())
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
  // 分享池配置中心所见即所得：空池展示内置默认文案（C 端实际分享出去的就是这批）
  for (const k of SHARE_KEYS) out[k] = normalizePool(map[k], SHARE_POOL_DEFAULTS[k]).join('\n')
  return out
}

// 首次启动种子：仅写入 DB 中不存在的键（敏感键也只种一次，之后以 DB 为准）
function seedDefaults() {
  const db = require('../db')
  const stmt = db.prepare('INSERT OR IGNORE INTO site_config (key, value, updated_at) VALUES (?,?,datetime(\'now\'))')
  const seeds = {
    site_logo: '',
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
    wechat_oauth_verify_content: '',
    amap_key: '',
    map_provider: 'amap',
    map_default_city: '上海',
    oss_provider: 'local',
    oss_path_prefix: 'mcard',
    oss_region: '',
    oss_bucket: '',
    oss_access_key: '',
    oss_secret_key: '',
    oss_custom_domain: '',
    share_title: SHARE_POOL_DEFAULTS.share_title.join('\n'),
    share_desc: SHARE_POOL_DEFAULTS.share_desc.join('\n'),
    share_image: '',
    promo_enabled: 'false',
    promo_register_reward_cents: '100',
    promo_order_rate: '10',
    promo_withdraw_min_cents: '1000',
    promo_invite_base_url: '',
    ...NOTIFY_TEMPLATE_DEFAULTS
  }
  const tx = db.transaction(() => {
    for (const [k, v] of Object.entries(seeds)) stmt.run(k, JSON.stringify(String(v || '')))
  })
  tx()
}

module.exports = { PUBLIC_KEYS, PUBLIC_DERIVED_KEYS, SHARE_KEYS, SHARE_POOL_DEFAULTS, NOTIFY_KEYS, NOTIFY_TEMPLATE_DEFAULTS, GROUPS, SENSITIVE_KEYS, ALL_KEYS, MASK, fingerprint, get, normalizePool, shareView, notifyView, payConfig, smsConfig, wechatOauthConfig, wechatLoginEnabled, mapConfig, promoConfig, ossConfig, publicView, adminView, seedDefaults }
