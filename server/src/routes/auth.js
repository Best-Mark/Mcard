const express = require('express')
const bcrypt = require('bcryptjs')
const db = require('../db')
const { ok, fail, wrap } = require('../utils/response')
const { sign, authRequired } = require('../utils/auth')

const router = express.Router()

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
  if (!user || !bcrypt.compareSync(String(password || ''), user.password_hash)) return fail(res, 400, '手机号或密码不正确')
  if (user.status !== 'active') return fail(res, 403, '账号已被停用')
  ok(res, { token: sign(user), user: { id: user.id, phone: user.phone, nickname: user.nickname, role: user.role } })
}))

router.get('/me', authRequired, (req, res) => ok(res, req.user))

module.exports = router
