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
  const user = db.prepare('SELECT id, phone, nickname, role, status FROM users WHERE id = ?').get(payload.id)
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

module.exports = { sign, parseToken, authRequired, adminRequired, superRequired }
