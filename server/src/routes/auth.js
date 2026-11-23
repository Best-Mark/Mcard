const express = require('express')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const db = require('../db')
const config = require('../config')
const settings = require('../utils/settings')
const { requestUrl } = require('../utils/origin')
const { ok, fail, wrap } = require('../utils/response')
const { sign, signBind, verifyBind, authRequired } = require('../utils/auth')

const router = express.Router()

// ---------- 微信网页授权（公众号 H5 快捷登录）----------
const WECHAT_STATE_COOKIE = 'mcard_wx_state'
const stateStore = new Map() // state -> { createdAt }，短 TTL 防重放
const API = 'https://api.weixin.qq.com'
// 授权页用官方标准域名 open.weixin.qq.com（手机微信只对该域名渲染授权页；api 域名用于服务端接口）
const OAUTH_PAGE = 'https://open.weixin.qq.com'

function wxa() { return settings.wechatOauthConfig() }
function enabled() { return settings.wechatLoginEnabled() }
function cleanStates() {
  const now = Date.now()
  for (const [k, v] of stateStore) if (now - v > 5 * 60 * 1000) stateStore.delete(k)
}
function setStateCookie(res, state) {
  res.cookie(WECHAT_STATE_COOKIE, state, { httpOnly: true, sameSite: 'lax', maxAge: 5 * 60 * 1000, path: '/' })
}
function readStateCookie(req) {
  const raw = req.headers.cookie || ''
  for (const part of raw.split(';')) {
    const [k, v] = part.trim().split('=')
    if (k === WECHAT_STATE_COOKIE) return decodeURIComponent(v || '')
  }
  return ''
}
async function wxFetch(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) })
  return res.json()
}

// 前端点「微信快捷登录」：拿到授权跳转地址（AppSecret 全程留在服务端）
router.get('/wechat/url', wrap((req, res) => {
  if (!enabled()) return fail(res, 400, '微信快捷登录未配置或数据源不全')
  cleanStates()
  const c = wxa()
  const state = crypto.randomBytes(16).toString('hex')
  stateStore.set(state, Date.now())
  setStateCookie(res, state)
  const redirectUri = requestUrl(req, '/api/auth/wechat/callback')
  const url = `${OAUTH_PAGE}/connect/oauth2/authorize?appid=${encodeURIComponent(c.appId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=snsapi_userinfo&state=${state}#wechat_redirect`
  ok(res, { url })
}))

// 微信回调：校验 state → code 换 openid + 昵称头像 → 建号/登录 → 302 回前端（token 走 hash）
router.get('/wechat/callback', wrap(async (req, res) => {
  cleanStates()
  const state = String(req.query.state || '')
  const cached = stateStore.get(state)
  const cookieState = readStateCookie(req)
  stateStore.delete(state) // 一次性，防重放
  if (!state || !cached || !cookieState || cookieState !== state) return res.redirect(`${requestUrl(req, '/login')}?err=state`)
  const code = String(req.query.code || '')
  if (!code) return res.redirect(`${requestUrl(req, '/login')}?err=denied`)

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
    if (user) {
      if (user.status !== 'active') return res.redirect(`${requestUrl(req, '/login')}?err=disabled`)
      db.prepare("UPDATE users SET avatar=?, auth_source='wechat', updated_at=datetime('now') WHERE id=?").run(avatar, user.id)
      user = db.prepare('SELECT id, phone, nickname, role, status, avatar FROM users WHERE id = ?').get(user.id)
      return res.redirect(`${requestUrl(req, '/wechat/callback')}#token=${encodeURIComponent(sign(user))}&user=${encodeURIComponent(JSON.stringify(user))}`)
    }

    // 新用户：按配置决定是否必须先绑定手机号（绑定凭据短 TTL 签名，防伪造 openid）
    if (c.bindPhone) {
      const ticket = signBind({ openid, unionid, nickname, avatar })
      return res.redirect(`${requestUrl(req, '/login')}#bind=${encodeURIComponent(ticket)}&nickname=${encodeURIComponent(nickname)}&avatar=${encodeURIComponent(avatar)}`)
    }
    const r = db.prepare("INSERT INTO users (phone, password_hash, nickname, avatar, wx_openid, wx_unionid, auth_source) VALUES (?,?,?,?,?,?, 'wechat')")
      .run(null, bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 10), nickname || '微信用户', avatar, openid, unionid)
    user = db.prepare('SELECT id, phone, nickname, role, status, avatar FROM users WHERE id = ?').get(r.lastInsertRowid)
    return res.redirect(`${requestUrl(req, '/wechat/callback')}#token=${encodeURIComponent(sign(user))}&user=${encodeURIComponent(JSON.stringify(user))}`)
  } catch (e) {
    console.error('[WechatOAuth]', e.message)
    return res.redirect(`${requestUrl(req, '/login')}?err=oauth`)
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
  ok(res, { token: sign(user), user: publicUser(user) })
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

module.exports = router
