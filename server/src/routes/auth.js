const express = require('express')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const db = require('../db')
const config = require('../config')
const settings = require('../utils/settings')
const { requestUrl } = require('../utils/origin')
const { ok, fail, wrap } = require('../utils/response')
const { sign, signBind, verifyBind, signShareTicket, verifyShareTicket, cleanShareTickets, authRequired } = require('../utils/auth')

const router = express.Router()
cleanShareTickets() // 自愈：清理过期残留的一次性登录凭证

// ---------- 微信网页授权（公众号 H5 快捷登录）----------
const STATE_TTL = 5 * 60 * 1000
const API = 'https://api.weixin.qq.com'
// 授权页用官方标准域名 open.weixin.qq.com（手机微信只对该域名渲染授权页；api 域名用于服务端接口）
const OAUTH_PAGE = 'https://open.weixin.qq.com'

function wxa() { return settings.wechatOauthConfig() }
function enabled() { return settings.wechatLoginEnabled() }

// 时序铁律：state 必须跨进程重启存活。后台自动更新 process.exit(0) 重启时，
// 用户在微信授权流程中拿到的 state 若只存内存会丢失，回调误判 err=state。
// 用 site_config 持久化（带 createdAt）；消费走「删除时确认命中」保证一次性防重放。
const STATE_PREFIX = 'wx_oauth_state_'
function saveState(state) {
  db.prepare("INSERT INTO site_config (key, value, updated_at) VALUES (?,?,datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')")
    .run(STATE_PREFIX + state, JSON.stringify({ createdAt: Date.now() }))
}
function consumeState(state) {
  if (!state) return false
  const key = STATE_PREFIX + state
  const row = db.prepare('SELECT value FROM site_config WHERE key = ?').get(key)
  if (!row) return false
  db.prepare('DELETE FROM site_config WHERE key = ?').run(key) // 先删 = 原子消费，防重放
  try {
    const v = JSON.parse(row.value)
    return !!v && Date.now() - v.createdAt <= STATE_TTL
  } catch { return false }
}
function cleanStates() {
  const cutoff = Date.now() - STATE_TTL
  const rows = db.prepare('SELECT key, value FROM site_config WHERE key LIKE ?').all(STATE_PREFIX + '%')
  const del = db.prepare('DELETE FROM site_config WHERE key = ?')
  for (const r of rows) {
    try { if (JSON.parse(r.value).createdAt < cutoff) del.run(r.key) } catch { del.run(r.key) }
  }
}
async function wxFetch(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) })
  return res.json()
}

// ---------- 微信 JS-SDK 分享签名（公开接口：公开名片页未登录也要显示分享卡片）----------
// 复用公众号网页授权配置（同一主体 appid），AppSecret 全程留在服务端。
// token/ticket 缓存 7000s（官方 7200s，留 200s 余量），失败不缓存、下次自动重试。
let jsTicketCache = { token: '', tokenAt: 0, ticket: '', ticketAt: 0 }
async function wxAccessToken(appId, secret) {
  if (jsTicketCache.token && Date.now() - jsTicketCache.tokenAt < 7000000) return jsTicketCache.token
  const r = await wxFetch(`${API}/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(secret)}`)
  if (!r.access_token) throw new Error(r.errmsg || '获取 access_token 失败')
  jsTicketCache.token = r.access_token; jsTicketCache.tokenAt = Date.now()
  return r.access_token
}
async function wxJsTicket(appId, secret) {
  if (jsTicketCache.ticket && Date.now() - jsTicketCache.ticketAt < 7000000) return jsTicketCache.ticket
  const token = await wxAccessToken(appId, secret)
  const r = await wxFetch(`${API}/cgi-bin/ticket/getticket?access_token=${encodeURIComponent(token)}&type=jsapi`)
  if (r.errcode) throw new Error(r.errmsg || '获取 jsapi_ticket 失败')
  jsTicketCache.ticket = r.ticket; jsTicketCache.ticketAt = Date.now()
  return r.ticket
}
// 签名 URL 必须与当前页面地址逐字一致（含 query、不含 hash），否则微信报 invalid signature。
router.get('/wechat/jssdk-sign', wrap(async (req, res) => {
  const c = wxa()
  if (!c.appId || !c.secret) return fail(res, 400, '公众号未配置，无法设置微信分享卡片')
  let u
  try { u = new URL(String(req.query.url || '')) } catch { return fail(res, 400, '分享地址无效') }
  const host = String(req.headers.host || '')
  if (u.host && host && u.host !== host) return fail(res, 400, '分享地址与当前站点不一致')
  const signUrl = `${u.origin}${u.pathname}${u.search}`
  try {
    const ticket = await wxJsTicket(c.appId, c.secret)
    const noncestr = crypto.randomBytes(8).toString('hex')
    const timestamp = Math.floor(Date.now() / 1000)
    const str = `jsapi_ticket=${ticket}&noncestr=${noncestr}&timestamp=${timestamp}&url=${signUrl}`
    const signature = crypto.createHash('sha1').update(str, 'utf8').digest('hex')
    ok(res, { appId: c.appId, timestamp, nonceStr: noncestr, signature })
  } catch (e) { fail(res, 500, e.message || '微信分享签名失败') }
}))

// ---------- 浏览器扫码登录：二维码会话（与微信内 OAuth 共用同一 openid 账号体系）----------
// 浏览器（非微信）拿 sid → 展示二维码 → 手机微信扫码打开落地页 → 落地页走公众号 OAuth →
// 回调把 token/user 写回 sid → 浏览器轮询 status 一次性兑换。全程不暴露 AppSecret。
const QR_SESSION_PREFIX = 'wx_qr_login_'
const QR_SESSION_TTL = 5 * 60 * 1000
function saveQrSession(sid, data) {
  db.prepare("INSERT INTO site_config (key,value,updated_at) VALUES (?,?,datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')")
    .run(QR_SESSION_PREFIX + sid, JSON.stringify(data))
}
function loadQrSession(sid) {
  if (!/^[a-f0-9]{32}$/.test(String(sid || ''))) return null
  const row = db.prepare('SELECT value, updated_at FROM site_config WHERE key = ?').get(QR_SESSION_PREFIX + sid)
  if (!row) return null
  const t = row.updated_at ? new Date(String(row.updated_at).replace(' ', 'T') + 'Z').getTime() : 0
  if (!t || Date.now() - t > QR_SESSION_TTL) { db.prepare('DELETE FROM site_config WHERE key = ?').run(QR_SESSION_PREFIX + sid); return null }
  try { return JSON.parse(row.value) } catch { return null }
}
// 扫码登录失败回写：手机端取消/授权失败时让电脑端立刻拿到明确失败，而不是空等 5 分钟
function failQrSession(sid, reason) {
  const s = loadQrSession(sid)
  if (s) saveQrSession(sid, { ...s, status: 'failed', reason: reason || 'cancelled' })
}
function cleanQrSessions() {
  try {
    const rows = db.prepare('SELECT key, updated_at FROM site_config WHERE key LIKE ?').all(QR_SESSION_PREFIX + '%')
    const del = db.prepare('DELETE FROM site_config WHERE key = ?')
    for (const r of rows) {
      const t = r.updated_at ? new Date(String(r.updated_at).replace(' ', 'T') + 'Z').getTime() : 0
      if (!t || Date.now() - t > QR_SESSION_TTL) del.run(r.key)
    }
  } catch { /* 自愈失败不影响主流程 */ }
}

// 浏览器点「微信扫码登录」：生成一次性会话 sid（二维码内容由前端拼落地页 URL）
router.post('/wechat/qr-session', wrap((req, res) => {
  if (!enabled()) return fail(res, 400, '微信快捷登录未配置或数据源不全')
  cleanQrSessions()
  const sid = crypto.randomBytes(16).toString('hex')
  saveQrSession(sid, { status: 'pending' })
  ok(res, { sid, ttl: QR_SESSION_TTL / 1000 })
}))

// 扫码二维码 SVG：内容是手机微信要打开的落地页（复用名片二维码生成器）
router.get('/wechat/qr-image', wrap((req, res) => {
  const sid = String(req.query.sid || '')
  if (!/^[a-f0-9]{32}$/.test(sid)) return fail(res, 400, '会话无效')
  const url = `${requestUrl(req, '/wechat/qr-login')}?sid=${encodeURIComponent(sid)}`
  res.set('Content-Type', 'image/svg+xml; charset=utf-8').set('Cache-Control', 'no-store')
  res.send(require('../services/qrcode').svg(url, { size: 260, logo: false }))
}))

// 手机微信扫码落地页上报「已扫描」，让电脑端从「等待扫码」切到「请在手机确认」
router.post('/wechat/qr-scanned', wrap((req, res) => {
  const sid = String(req.body?.sid || '')
  const s = loadQrSession(sid)
  if (s && s.status === 'pending') saveQrSession(sid, { ...s, status: 'scanned' })
  ok(res, { ok: true })
}))

// 手机端点「确认登录」后才推进到 confirmed 并发起 OAuth；未确认的二维码不会自动登录
router.post('/wechat/qr-confirm', wrap((req, res) => {
  const sid = String(req.body?.sid || '')
  const s = loadQrSession(sid)
  // 允许 pending：手机扫码上报若延迟/失败，确认动作仍能把会话推进到 confirmed
  if (!s || !['pending', 'scanned', 'confirmed'].includes(s.status)) return fail(res, 400, '二维码已过期，请在电脑端重新扫码')
  saveQrSession(sid, { ...s, status: 'confirmed' }) // 重复点确认幂等，凭证仍是一次性的 OAuth state
  ok(res, { ok: true })
}))

// 手机端点「取消」：显式回写失败，电脑端立即提示并允许刷新，不再空等到超时
router.post('/wechat/qr-cancel', wrap((req, res) => {
  const sid = String(req.body?.sid || '')
  failQrSession(sid, 'cancelled')
  ok(res, { ok: true })
}))

// 浏览器轮询：pending / scanned / confirmed / done（done 原子消费，凭证只能兑换一次）/ failed / expired
router.get('/wechat/qr-status', wrap((req, res) => {
  const sid = String(req.query.sid || '')
  const s = loadQrSession(sid)
  if (!s) return ok(res, { status: 'expired' })
  if (s.status === 'done' && s.token) {
    db.prepare('DELETE FROM site_config WHERE key = ?').run(QR_SESSION_PREFIX + sid) // 先删 = 原子消费
    return ok(res, { status: 'done', token: s.token, user: s.user })
  }
  if (s.status === 'failed' || s.status === 'cancelled') return ok(res, { status: 'failed', reason: s.reason || 'cancelled' })
  // scanned 与 confirmed 都属于「已扫待授权」，电脑端必须继续轮询，直到 done / failed / expired
  ok(res, { status: ['scanned', 'confirmed'].includes(s.status) ? 'scanned' : 'pending' })
}))

// 前端点「微信快捷登录」：拿到授权跳转地址（AppSecret 全程留在服务端）
router.get('/wechat/url', wrap((req, res) => {
  if (!enabled()) return fail(res, 400, '微信快捷登录未配置或数据源不全')
  cleanStates()
  const c = wxa()
  let state = crypto.randomBytes(16).toString('hex')
  // 扫码登录：把 sid 编进 state（32hex sid + 分隔符 + 随机态），回调时识别并写回会话
  const sid = String(req.query.sid || '')
  if (/^[a-f0-9]{32}$/.test(sid)) state = `qr_${sid}_${crypto.randomBytes(8).toString('hex')}`
  saveState(state)
  const redirectUri = requestUrl(req, '/api/auth/wechat/callback')
  const url = `${OAUTH_PAGE}/connect/oauth2/authorize?appid=${encodeURIComponent(c.appId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=snsapi_userinfo&state=${encodeURIComponent(state)}#wechat_redirect`
  ok(res, { url })
}))

// 微信回调：校验 state → code 换 openid + 昵称头像 → 建号/登录 → 302 回前端（token 走 hash）
// 扫码登录（state 带 qr_<sid>_）：不把 token 塞进微信内 URL，而是写回 sid 会话，
// 手机端只显示「扫码成功，回电脑完成登录」，凭证由电脑端轮询一次性兑换。
router.get('/wechat/callback', wrap(async (req, res) => {
  cleanStates()
  const state = String(req.query.state || '')
  const m = state.match(/^qr_([a-f0-9]{32})_/)
  const qrSid = m ? m[1] : ''
  // 原子消费 DB 中的 state（一次性防重放）。state 随机且 DB 命中即证明本服务发起，
  // 不依赖 cookie —— 手机微信回调不保证带回 cookie，也不该被并发登录覆盖的 cookie 误伤。
  const valid = consumeState(state)
  const qrFail = msg => {
    if (qrSid) failQrSession(qrSid, msg) // 授权失败也要让电脑端停止等待
    return res.redirect(`${requestUrl(req, '/wechat/qr-result')}?err=${encodeURIComponent(msg)}`)
  }
  if (!valid) return qrSid ? qrFail('state') : res.redirect(`${requestUrl(req, '/login')}?err=state`)
  const code = String(req.query.code || '')
  if (!code) return qrSid ? qrFail('denied') : res.redirect(`${requestUrl(req, '/login')}?err=denied`)
  // 会话在授权途中过期：不能再跳「扫码成功」骗手机端，电脑端也会读到 expired
  if (qrSid && !loadQrSession(qrSid)) return qrFail('expired')

  const c = wxa()
  try {
    const token = await wxFetch(`${API}/sns/oauth2/access_token?appid=${encodeURIComponent(c.appId)}&secret=${encodeURIComponent(c.secret)}&code=${encodeURIComponent(code)}&grant_type=authorization_code`)
    if (!token.openid) throw new Error(token.errmsg || '换取 openid 失败')
    const info = await wxFetch(`${API}/sns/userinfo?access_token=${encodeURIComponent(token.access_token)}&openid=${encodeURIComponent(token.openid)}&lang=zh_CN`)

    const openid = String(token.openid).slice(0, 128)
    const unionid = String(token.unionid || info.unionid || '').slice(0, 128)
    const nickname = String(info.nickname || '').slice(0, 30)
    const avatar = String(info.headimgurl || '').slice(0, 500)

    let user = db.prepare('SELECT * FROM users WHERE wx_openid = ?').get(openid)
    if (!user && unionid) user = db.prepare('SELECT * FROM users WHERE wx_unionid = ? AND wx_unionid IS NOT NULL').get(unionid) // unionid 兜底：同开放平台下换公众号仍认同一人
    if (user) {
      if (user.status !== 'active') return qrSid ? qrFail('disabled') : res.redirect(`${requestUrl(req, '/login')}?err=disabled`)
      db.prepare("UPDATE users SET avatar=?, auth_source='wechat', wx_openid=COALESCE(wx_openid,?), updated_at=datetime('now') WHERE id=?").run(avatar, openid, user.id)
      user = db.prepare('SELECT id, phone, nickname, role, status, avatar FROM users WHERE id = ?').get(user.id)
      const jwt = sign(user)
      const pub = publicUser(user)
      if (qrSid) {
        if (!loadQrSession(qrSid)) return qrFail('expired')
        saveQrSession(qrSid, { status: 'done', token: jwt, user: pub })
        return res.redirect(`${requestUrl(req, '/wechat/qr-result')}?ok=1`)
      }
      return res.redirect(`${requestUrl(req, '/wechat/callback')}#token=${encodeURIComponent(jwt)}&user=${encodeURIComponent(JSON.stringify(pub))}`)
    }

    // 新用户：按配置决定是否必须先绑定手机号（绑定凭据短 TTL 签名，防伪造 openid）
    if (c.bindPhone) {
      const ticket = signBind({ openid, unionid, nickname, avatar, qrSid })
      return qrSid
        ? res.redirect(`${requestUrl(req, '/wechat/qr-result')}?bind=${encodeURIComponent(ticket)}&sid=${encodeURIComponent(qrSid)}&nickname=${encodeURIComponent(nickname)}&avatar=${encodeURIComponent(avatar)}`)
        : res.redirect(`${requestUrl(req, '/login')}#bind=${encodeURIComponent(ticket)}&nickname=${encodeURIComponent(nickname)}&avatar=${encodeURIComponent(avatar)}`)
    }
    const r = db.prepare("INSERT INTO users (phone, password_hash, nickname, avatar, wx_openid, wx_unionid, auth_source) VALUES (?,?,?,?,?,?, 'wechat')")
      .run(null, bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 10), nickname || '微信用户', avatar, openid, unionid)
    user = db.prepare('SELECT id, phone, nickname, role, status, avatar FROM users WHERE id = ?').get(r.lastInsertRowid)
    const jwt = sign(user)
    const pub = publicUser(user)
    if (qrSid) {
      if (!loadQrSession(qrSid)) return qrFail('expired')
      saveQrSession(qrSid, { status: 'done', token: jwt, user: pub })
      return res.redirect(`${requestUrl(req, '/wechat/qr-result')}?ok=1`)
    }
    return res.redirect(`${requestUrl(req, '/wechat/callback')}#token=${encodeURIComponent(jwt)}&user=${encodeURIComponent(JSON.stringify(pub))}`)
  } catch (e) {
    console.error('[WechatOAuth]', e.message)
    return qrSid ? qrFail('oauth') : res.redirect(`${requestUrl(req, '/login')}?err=oauth`)
  }
}))

// 微信授权后新用户绑定手机号（凭据 10 分钟有效，一次性使用）
router.post('/wechat/bind', wrap((req, res) => {
  const { phone, password, ticket } = req.body || {}
  if (!/^1\d{10}$/.test(String(phone || ''))) return fail(res, 400, '请输入 11 位手机号')
  if (String(password || '').length < 6) return fail(res, 400, '密码至少 6 位')
  const payload = verifyBind(ticket)
  if (!payload?.openid) return fail(res, 400, '绑定凭证无效或已过期，请重新授权')
  const openid = String(payload.openid).slice(0, 128)
  const unionid = String(payload.unionid || '').slice(0, 128)
  const avatar = String(payload.avatar || '').slice(0, 500)
  const bound = db.prepare('SELECT id FROM users WHERE wx_openid = ?').get(openid)
  if (bound) return fail(res, 400, '该微信已绑定账号，请直接登录')

  let user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone)
  if (user) {
    // 老账号：密码校验通过则把微信身份绑上去（用密码证明是本人）
    if (!bcrypt.compareSync(String(password), user.password_hash)) return fail(res, 400, '手机号或密码不正确')
    if (user.status !== 'active') return fail(res, 403, '账号已被停用')
    db.prepare("UPDATE users SET wx_openid=?, wx_unionid=?, avatar=?, auth_source='wechat', updated_at=datetime('now') WHERE id=?")
      .run(openid, unionid, avatar || user.avatar, user.id)
  } else {
    const r = db.prepare("INSERT INTO users (phone, password_hash, nickname, avatar, wx_openid, wx_unionid, auth_source) VALUES (?,?,?,?,?,?, 'wechat')")
      .run(phone, bcrypt.hashSync(String(password), 10), String(payload.nickname || '微信用户').slice(0, 30) || '微信用户', avatar, openid, unionid)
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid)
  }
  const jwt = sign(user)
  const pub = publicUser(user)
  // 扫码登录的新用户绑定成功后：会话必须仍在，才写回凭证让电脑端登录
  const qrSid = /^[a-f0-9]{32}$/.test(String(payload.qrSid || '')) ? payload.qrSid : ''
  if (qrSid) {
    if (!loadQrSession(qrSid)) return fail(res, 400, '登录会话已过期，请在电脑端重新扫码')
    saveQrSession(qrSid, { status: 'done', token: jwt, user: pub })
  }
  ok(res, { token: jwt, user: pub })
}))

router.post('/register', wrap((req, res) => {
  const { phone, password, nickname } = req.body || {}
  if (!/^1\d{10}$/.test(phone || '')) return fail(res, 400, '请输入 11 位手机号')
  if (!password || String(password).length < 6) return fail(res, 400, '密码至少 6 位')
  if (db.prepare('SELECT id FROM users WHERE phone = ?').get(phone)) return fail(res, 400, '该手机号已注册')
  const result = db.prepare('INSERT INTO users (phone, password_hash, nickname) VALUES (?,?,?)')
    .run(phone, bcrypt.hashSync(String(password), 10), String(nickname || '').slice(0, 30))
  const user = db.prepare('SELECT id, phone, nickname, role, status FROM users WHERE id = ?').get(result.lastInsertRowid)
  ok(res, { token: sign(user), user })
}))

router.post('/login', wrap((req, res) => {
  const { phone, password } = req.body || {}
  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(String(phone || '').trim())
  if (!user || !user.phone || !bcrypt.compareSync(String(password || ''), user.password_hash)) return fail(res, 400, '手机号或密码不正确')
  if (user.status !== 'active') return fail(res, 403, '账号已被停用')
  ok(res, { token: sign(user), user: publicUser(user) })
}))

function publicUser(u) {
  return { id: u.id, phone: u.phone, nickname: u.nickname, role: u.role, status: u.status, avatar: u.avatar || '', auth_source: u.auth_source || 'password' }
}

router.get('/me', authRequired, (req, res) => ok(res, req.user))

// 微信内已登录 → 生成一次性凭证，前端把它拼到当前 URL，引导「在浏览器中打开」后免二次登录
router.post('/share-ticket', authRequired, wrap((req, res) => {
  ok(res, { ticket: signShareTicket(req.user.id) })
}))

// 外部浏览器用 ticket 换登录态（ticket 一次性消费，10 分钟有效）
router.post('/share-ticket/exchange', wrap((req, res) => {
  const uid = verifyShareTicket(req.body?.ticket)
  if (!uid) return fail(res, 400, '登录凭证无效或已过期，请重新登录')
  const user = db.prepare('SELECT id, phone, nickname, role, status, avatar FROM users WHERE id = ?').get(uid)
  if (!user || user.status !== 'active') return fail(res, 400, '账号不可用')
  ok(res, { token: sign(user), user })
}))

module.exports = router
