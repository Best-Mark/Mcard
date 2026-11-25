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

// 单用户素材上限（唯一真相源，前端从 GET /api/assets 的 max 读取展示）。
// 50 张足够个人名片场景；满了必须先删旧图再传，避免素材库无限膨胀。
const MAX_ASSETS = 50

// 删除前检查素材是否仍被名片/账号引用。素材 url 可能是 /uploads/x 或 OSS 绝对地址，
// 与 DB_IMAGE_FIELDS（oss.js）口径一致：cards 的头像/封面/LOGO/四个二维码图、users.avatar、card_materials.url。
function usageOf(userId, url) {
  if (!url) return ''
  const checks = [
    ['名片头像/封面/LOGO/二维码图', 'SELECT 1 FROM cards WHERE user_id = ? AND (avatar=? OR cover=? OR logo=? OR wechat_qr=? OR alipay_qr=? OR wechat_pay_qr=? OR alipay_pay_qr=?) LIMIT 1',
      [userId, url, url, url, url, url, url, url]],
    ['账号头像', 'SELECT 1 FROM users WHERE id = ? AND avatar = ? LIMIT 1', [userId, url]],
    ['公司相册', 'SELECT 1 FROM card_materials m JOIN cards c ON c.id=m.card_id WHERE c.user_id=? AND m.url=? LIMIT 1', [userId, url]]
  ]
  for (const [label, sql, args] of checks) if (db.prepare(sql).get(...args)) return label
  return ''
}

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

// 删除：只删自己的素材记录（磁盘/OSS 文件不物理删）。
// 被名片/账号/相册引用时拒绝删除——否则删除记录后线上展示仍指向旧 url，用户以为「删了还在用」。
router.delete('/:id', wrap((req, res) => {
  const id = Number(req.params.id)
  const row = db.prepare('SELECT url FROM user_assets WHERE id = ? AND user_id = ?').get(id, req.user.id)
  if (!row) return fail(res, 404, '素材不存在')
  const usedBy = usageOf(req.user.id, row.url)
  if (usedBy) return fail(res, 400, `该素材正在「${usedBy}」中使用，请先替换后再删除`)
  const r = db.prepare('DELETE FROM user_assets WHERE id = ? AND user_id = ?').run(id, req.user.id)
  if (!r.changes) return fail(res, 404, '素材不存在')
  ok(res, { ok: true })
}))

module.exports = router
