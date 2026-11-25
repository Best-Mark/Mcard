const jwt = require('jsonwebtoken')
const config = require('../config')
const db = require('../db')

const sign = user => jwt.sign({ id: user.id, role: user.role, phone: user.phone }, config.JWT_SECRET, { expiresIn: '30d' })

const parseToken = req => {
  const h = req.headers.authorization || ''
  if (!h.startsWith('Bearer ')) return null
  try { return jwt.verify(h.slice(7), config.JWT_SECRET) } catch { return null }
}

const authRequired = (req, res, next) => {
  const payload = parseToken(req)
  if (!payload) return res.status(401).json({ code: 401, msg: '请先登录' })
  const user = db.prepare('SELECT id, phone, nickname, role, status, avatar, auth_source, wx_openid, is_promoter FROM users WHERE id = ?').get(payload.id)
  if (!user || user.status !== 'active') return res.status(401).json({ code: 401, msg: '账号不可用' })
  req.user = user
  next()
}

const adminRequired = (req, res, next) => authRequired(req, res, () => {
  if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ code: 403, msg: '需要管理权限' })
  next()
})

const superRequired = (req, res, next) => authRequired(req, res, () => {
  if (req.user.role !== 'super_admin') return res.status(403).json({ code: 403, msg: '需要超级管理员权限' })
  next()
})

// 微信首次授权绑定手机号的一次性凭证（10 分钟有效，签 openid 等，防伪造）
const signBind = payload => jwt.sign(payload, config.JWT_SECRET, { expiresIn: '10m' })
const verifyBind = ticket => {
  try { return jwt.verify(String(ticket || ''), config.JWT_SECRET) } catch { return null }
}

// 微信内 → 外部浏览器「免二次登录」凭证：短 TTL（10 分钟）、一次性消费（DB 记录已用）。
// 微信 WebView 与外部浏览器 localStorage 不共享，靠 URL 带 ticket 在外部浏览器恢复登录态。
const SHARE_TICKET_PREFIX = 'wx_share_ticket_'
function signShareTicket(userId) {
  const jti = require('crypto').randomBytes(12).toString('hex')
  const ticket = jwt.sign({ uid: userId, jti }, config.JWT_SECRET, { expiresIn: '10m' })
  db.prepare("INSERT INTO site_config (key, value, updated_at) VALUES (?,?,datetime('now'))").run(SHARE_TICKET_PREFIX + jti, '1')
  return ticket
}
function verifyShareTicket(ticket) {
  try {
    const p = jwt.verify(String(ticket || ''), config.JWT_SECRET)
    if (!p?.uid || !p?.jti) return null
    const key = SHARE_TICKET_PREFIX + p.jti
    const row = db.prepare('SELECT 1 FROM site_config WHERE key = ?').get(key)
    if (!row) return null            // 不存在 = 已消费或伪造
    db.prepare('DELETE FROM site_config WHERE key = ?').run(key) // 先删 = 原子消费
    return p.uid
  } catch { return null }
}
// 自愈：清理超过 1 天的残留 ticket（JWT 已过期但 DB 记录可能还在）
function cleanShareTickets() {
  try {
    const rows = db.prepare("SELECT key, updated_at FROM site_config WHERE key LIKE ?").all(SHARE_TICKET_PREFIX + '%')
    const del = db.prepare('DELETE FROM site_config WHERE key = ?')
    const cutoff = Date.now() - 24 * 3600 * 1000
    for (const r of rows) {
      const t = r.updated_at ? new Date(String(r.updated_at).replace(' ', 'T') + 'Z').getTime() : 0
      if (!t || t < cutoff) del.run(r.key)
    }
  } catch { /* 自愈失败不影响主流程 */ }
}

module.exports = { sign, signBind, verifyBind, signShareTicket, verifyShareTicket, cleanShareTickets, parseToken, authRequired, adminRequired, superRequired }
