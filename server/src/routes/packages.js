const express = require('express')
const db = require('../db')
const { ok, fail, wrap } = require('../utils/response')

const router = express.Router()
const parse = r => ({ ...r, features: (() => { try { return JSON.parse(r.features) } catch { return [] } })() })

router.get('/', wrap((req, res) => {
  const rows = db.prepare('SELECT id, name, description, price_cents, duration_days, features, sort FROM packages WHERE enabled = 1 ORDER BY sort ASC, id ASC').all()
  ok(res, rows.map(parse))
}))

router.get('/:id', wrap((req, res) => {
  const row = db.prepare('SELECT * FROM packages WHERE id = ? AND enabled = 1').get(req.params.id)
  if (!row) return fail(res, 404, '套餐不存在')
  ok(res, parse(row))
}))

module.exports = router
