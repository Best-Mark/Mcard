const express = require('express')
const db = require('../db')
const { ok, fail, wrap } = require('../utils/response')
const { authRequired } = require('../utils/auth')

const router = express.Router()

// 素材库（2026-11-28 用户拍板恢复并要求自定义分组）：
// 复用历史 user_assets 表（url/name/type/size/width/height），新增 asset_groups 自定义分组。
// 只做「库记录」管理：删素材只删记录不动文件（上传文件仍由 /api/upload 统一管理）。
// 素材 URL 允许本站 /uploads|/media 与 http(s) 外链，与名片图片字段同口径（javascript:/data: 一律拒）。
const URL_RE = /^(\/(uploads|media)\/[A-Za-z0-9_.-]{4,200}|https?:\/\/\S{4,500})$/i
const MAX_GROUPS = 30
const MAX_ITEMS = 500
const cleanName = s => String(s || '').trim().slice(0, 12)

// 分组带素材计数（含未分组虚拟项由前端拼装），列表/弹层一次请求全带回
function groupsOf(userId) {
  return db.prepare(`
    SELECT g.id, g.name, COUNT(a.id) AS count
    FROM asset_groups g
    LEFT JOIN user_assets a ON a.group_id = g.id
    WHERE g.user_id = ?
    GROUP BY g.id
    ORDER BY g.id DESC
  `).all(userId)
}

router.get('/', authRequired, wrap(async (req, res) => {
  const userId = req.user.id
  const g = req.query.group || 'all' // all | none | <groupId>
  let items
  if (g === 'all') {
    items = db.prepare('SELECT id, url, name, width, height, group_id FROM user_assets WHERE user_id = ? ORDER BY id DESC LIMIT ?').all(userId, MAX_ITEMS)
  } else if (g === 'none') {
    items = db.prepare('SELECT id, url, name, width, height, group_id FROM user_assets WHERE user_id = ? AND group_id IS NULL ORDER BY id DESC LIMIT ?').all(userId, MAX_ITEMS)
  } else {
    const gid = Number(g)
    const own = db.prepare('SELECT id FROM asset_groups WHERE id = ? AND user_id = ?').get(gid, userId)
    if (!own) items = []
    else items = db.prepare('SELECT id, url, name, width, height, group_id FROM user_assets WHERE user_id = ? AND group_id = ? ORDER BY id DESC LIMIT ?').all(userId, gid, MAX_ITEMS)
  }
  ok(res, { groups: groupsOf(userId), items })
}))

// 入库：同用户同 URL 去重（重复上传同名文件地址不同会各占一条；外链同地址只留一条）
router.post('/', authRequired, wrap(async (req, res) => {
  const userId = req.user.id
  const url = String(req.body?.url || '').trim()
  if (!URL_RE.test(url)) return fail(res, 400, '图片地址不合法')
  const name = String(req.body?.name || '').trim().slice(0, 50)
  let groupId = null
  if (req.body?.group_id != null && req.body.group_id !== '') {
    const gid = Number(req.body.group_id)
    if (!db.prepare('SELECT id FROM asset_groups WHERE id = ? AND user_id = ?').get(gid, userId)) return fail(res, 400, '分组不存在')
    groupId = gid
  }
  const dup = db.prepare('SELECT id, url, name, width, height, group_id FROM user_assets WHERE user_id = ? AND url = ?').get(userId, url)
  if (dup) return ok(res, dup)
  const width = Number(req.body?.width) || 0
  const height = Number(req.body?.height) || 0
  const size = Number(req.body?.size) || 0
  const info = db.prepare('INSERT INTO user_assets (user_id, url, name, type, size, width, height, group_id) VALUES (?,?,?,?,?,?,?,?)')
    .run(userId, url, name, 'image', size, width, height, groupId)
  ok(res, { id: info.lastInsertRowid, url, name, width, height, group_id: groupId })
}))

// 新建分组（名字去重：同名直接返回已有组，前端体验为「选中该组」）
router.post('/groups', authRequired, wrap(async (req, res) => {
  const userId = req.user.id
  const name = cleanName(req.body?.name)
  if (!name) return fail(res, 400, '请填写分组名')
  const exist = db.prepare('SELECT id, name FROM asset_groups WHERE user_id = ? AND name = ?').get(userId, name)
  if (exist) return ok(res, exist)
  if (groupsOf(userId).length >= MAX_GROUPS) return fail(res, 400, `分组最多 ${MAX_GROUPS} 个`)
  const info = db.prepare('INSERT INTO asset_groups (user_id, name) VALUES (?,?)').run(userId, name)
  ok(res, { id: info.lastInsertRowid, name })
}))

router.put('/groups/:id', authRequired, wrap(async (req, res) => {
  const userId = req.user.id
  const row = db.prepare('SELECT id FROM asset_groups WHERE id = ? AND user_id = ?').get(Number(req.params.id), userId)
  if (!row) return fail(res, 404, '分组不存在')
  const name = cleanName(req.body?.name)
  if (!name) return fail(res, 400, '请填写分组名')
  const clash = db.prepare('SELECT id FROM asset_groups WHERE user_id = ? AND name = ? AND id <> ?').get(userId, name, row.id)
  if (clash) return fail(res, 400, '已有同名分组')
  db.prepare('UPDATE asset_groups SET name = ? WHERE id = ?').run(name, row.id)
  ok(res, { id: row.id, name })
}))

// 删分组：组内素材回落「未分组」（group_id = NULL），记录不丢
router.delete('/groups/:id', authRequired, wrap(async (req, res) => {
  const userId = req.user.id
  const row = db.prepare('SELECT id FROM asset_groups WHERE id = ? AND user_id = ?').get(Number(req.params.id), userId)
  if (!row) return fail(res, 404, '分组不存在')
  const tx = db.transaction(() => {
    db.prepare('UPDATE user_assets SET group_id = NULL WHERE group_id = ? AND user_id = ?').run(row.id, userId)
    db.prepare('DELETE FROM asset_groups WHERE id = ?').run(row.id)
  })
  tx()
  ok(res, { removed: row.id })
}))

// 移动素材到分组（group_id 空 = 移回未分组）
router.put('/:id', authRequired, wrap(async (req, res) => {
  const userId = req.user.id
  const row = db.prepare('SELECT id FROM user_assets WHERE id = ? AND user_id = ?').get(Number(req.params.id), userId)
  if (!row) return fail(res, 404, '素材不存在')
  let groupId = null
  if (req.body?.group_id != null && req.body.group_id !== '') {
    const gid = Number(req.body.group_id)
    if (!db.prepare('SELECT id FROM asset_groups WHERE id = ? AND user_id = ?').get(gid, userId)) return fail(res, 400, '分组不存在')
    groupId = gid
  }
  db.prepare('UPDATE user_assets SET group_id = ? WHERE id = ?').run(groupId, row.id)
  ok(res, { id: row.id, group_id: groupId })
}))

// 删除素材：只删库记录，不动已上传文件（页面里引用中的图不受影响）
router.delete('/:id', authRequired, wrap(async (req, res) => {
  const userId = req.user.id
  const row = db.prepare('SELECT id FROM user_assets WHERE id = ? AND user_id = ?').get(Number(req.params.id), userId)
  if (!row) return fail(res, 404, '素材不存在')
  db.prepare('DELETE FROM user_assets WHERE id = ?').run(row.id)
  ok(res, { removed: row.id })
}))

module.exports = router
