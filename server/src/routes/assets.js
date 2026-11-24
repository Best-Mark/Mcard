// 用户图片素材库：上传过的图片统一入库，编辑名片时可随时挑选替换。
// 素材是用户级（user_id），不绑定单张卡，便于头像/LOGO/二维码图/封面跨字段复用。
const express = require('express')
const db = require('../db')
const { ok, fail, wrap } = require('../utils/response')
const { authRequired } = require('../utils/auth')
const uploadRoute = require('./upload')
const imageService = require('../services/image')

const router = express.Router()
router.use(authRequired)

const MAX_ASSETS = 200 // 单用户素材上限，防滥用

function listOf(userId) {
  return db.prepare('SELECT id, url, name, type, size, width, height, created_at FROM user_assets WHERE user_id = ? ORDER BY id DESC LIMIT ?').all(userId, MAX_ASSETS)
}

router.get('/', wrap((req, res) => {
  ok(res, { list: listOf(req.user.id), max: MAX_ASSETS })
}))

// 从已上传的图片 URL 入库（前端先 /api/upload 再调本接口）；校验 URL 必须是本站 /uploads/
router.post('/', wrap((req, res) => {
  const url = String(req.body?.url || '').trim()
  if (!/^\/uploads\/[A-Za-z0-9_.-]+$/.test(url)) return fail(res, 400, '图片地址不合法')
  const count = db.prepare('SELECT COUNT(*) n FROM user_assets WHERE user_id = ?').get(req.user.id).n
  if (count >= MAX_ASSETS) return fail(res, 400, `素材库最多 ${MAX_ASSETS} 张，请先删除不用的`)
  const dup = db.prepare('SELECT id FROM user_assets WHERE user_id = ? AND url = ?').get(req.user.id, url)
  if (dup) return ok(res, { id: dup.id, duplicate: true })
  const r = db.prepare('INSERT INTO user_assets (user_id, url, name, type, size, width, height) VALUES (?,?,?,?,?,?,?)')
    .run(req.user.id, url, String(req.body?.name || '').slice(0, 80), 'image',
      Math.max(0, Number(req.body?.size) || 0), Math.max(0, Number(req.body?.width) || 0), Math.max(0, Number(req.body?.height) || 0))
  ok(res, { id: Number(r.lastInsertRowid) })
}))

// 一步到位：上传图片 → 压缩 → 入库（前端素材库面板里直接选图用）
router.post('/upload', uploadRoute.upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return fail(res, 400, '请选择图片')
  const count = db.prepare('SELECT COUNT(*) n FROM user_assets WHERE user_id = ?').get(req.user.id).n
  if (count >= MAX_ASSETS) return fail(res, 400, `素材库最多 ${MAX_ASSETS} 张，请先删除不用的`)
  const n = await imageService.normalizeImage(req.file.path, req.file.originalname, {})
  const out = await uploadRoute.publicUrlOf({ path: n.file, filename: n.filename, size: n.size, originalname: req.file.originalname })
  const r = db.prepare('INSERT INTO user_assets (user_id, url, name, type, size, width, height) VALUES (?,?,?,?,?,?,?)')
    .run(req.user.id, out.url, String(req.file.originalname).slice(0, 80), 'image', n.size, n.width, n.height)
  ok(res, { id: Number(r.lastInsertRowid), ...out, width: n.width, height: n.height, converted: n.converted })
}))

router.put('/:id', wrap((req, res) => {
  const id = Number(req.params.id)
  const row = db.prepare('SELECT id FROM user_assets WHERE id = ? AND user_id = ?').get(id, req.user.id)
  if (!row) return fail(res, 404, '素材不存在')
  db.prepare('UPDATE user_assets SET name = ? WHERE id = ?').run(String(req.body?.name || '').slice(0, 80), id)
  ok(res, { ok: true })
}))

// 删除：只删自己的素材记录（磁盘/OSS 文件不物理删，避免其它引用或 OSS 不一致；素材上限由记录数控制）
router.delete('/:id', wrap((req, res) => {
  const id = Number(req.params.id)
  const r = db.prepare('DELETE FROM user_assets WHERE id = ? AND user_id = ?').run(id, req.user.id)
  if (!r.changes) return fail(res, 404, '素材不存在')
  ok(res, { ok: true })
}))

module.exports = router
