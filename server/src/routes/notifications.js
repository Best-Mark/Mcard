const express = require('express')
const db = require('../db')
const { ok, fail, wrap } = require('../utils/response')
const { authRequired } = require('../utils/auth')

const router = express.Router()

const view = r => ({
  id: r.id, type: r.type, cardId: r.card_id, title: r.title, body: r.body,
  link: r.link, isRead: !!r.is_read, createdAt: r.created_at
})

// 我的通知列表（分页 + 未读数）
router.get('/', authRequired, wrap((req, res) => {
  const size = Math.min(50, Math.max(1, Number(req.query.size) || 20))
  const before = Number(req.query.before) || 0
  const rows = before
    ? db.prepare('SELECT * FROM notifications WHERE user_id = ? AND id < ? ORDER BY id DESC LIMIT ?').all(req.user.id, before, size)
    : db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT ?').all(req.user.id, size)
  const unread = db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user.id).n
  ok(res, { list: rows.map(view), unread, hasMore: rows.length === size })
}))

// 未读数（轻量轮询/角标）
router.get('/unread', authRequired, wrap((req, res) => {
  const unread = db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user.id).n
  ok(res, { unread })
}))

// 标记已读：单条 / 全部（body.all 或 id）
router.post('/read', authRequired, wrap((req, res) => {
  if (req.body?.all) {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id)
    return ok(res, { read: 'all' })
  }
  const id = Number(req.body?.id)
  if (!id) return fail(res, 400, '缺少通知 id')
  const r = db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(id, req.user.id)
  if (!r.changes) return fail(res, 404, '通知不存在')
  ok(res, { read: id })
}))

// 删除单条
router.delete('/:id', authRequired, wrap((req, res) => {
  const r = db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id)
  if (!r.changes) return fail(res, 404, '通知不存在')
  ok(res, { deleted: true })
}))

module.exports = router
