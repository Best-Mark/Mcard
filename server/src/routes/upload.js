const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const config = require('../config')
const { ok, fail, wrap } = require('../utils/response')
const { authRequired } = require('../utils/auth')
const { randomHex } = require('../utils/id')
const logoService = require('../services/logo')
const oss = require('../services/oss')

const ALLOW = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'])
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `${Date.now()}-${randomHex(8)}${ALLOW.has(ext) ? ext : '.png'}`)
  }
})
const upload = multer({
  storage,
  limits: { fileSize: config.MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (!ALLOW.has(ext)) return cb(new Error('仅支持 png/jpg/jpeg/webp/gif/svg 图片'))
    cb(null, true)
  }
})

const router = express.Router()

// 本地落盘后尝试双写 OSS：成功返回云 URL，失败降级本地 URL（不拖垮上传）
async function publicUrlOf(file) {
  const local = `/uploads/${file.filename}`
  const cloud = await oss.putLocalFile(file.path, `uploads/${file.filename}`)
  return { url: cloud || local, name: file.originalname, size: file.size, storage: cloud ? 'oss' : 'local' }
}

router.post('/', authRequired, upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return fail(res, 400, '请选择文件')
  ok(res, await publicUrlOf(req.file))
}))

// LOGO 上传：自动去底并输出透明 PNG，原图保留供再次调参
router.post('/logo', authRequired, upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return fail(res, 400, '请选择 LOGO 文件')
  try {
    const result = await logoService.processLogo(req.file.path, {
      mode: req.body.mode || 'auto',
      tolerance: req.body.tolerance
    })
    const ext = path.extname(req.file.filename).toLowerCase()
    const originalUrl = ext === '.svg' ? result.url : `/uploads/${req.file.filename}`
    // SVG 原稿不对外提供，避免脚本风险
    if (ext === '.svg') fs.unlinkSync(req.file.path)
    ok(res, { originalUrl, name: req.file.originalname, size: req.file.size, ...result })
  } catch (e) {
    fail(res, 400, `LOGO 处理失败：${e.message || '图片无法识别'}`)
  }
}))

// 基于已上传原图重新处理，不需要重新选择文件
router.post('/logo/process', authRequired, wrap(async (req, res) => {
  const source = logoService.localPath(req.body?.sourceUrl)
  if (!source) return fail(res, 400, '原图不存在或地址不合法')
  try {
    const result = await logoService.processLogo(source, { mode: req.body.mode, tolerance: req.body.tolerance })
    ok(res, result)
  } catch (e) {
    fail(res, 400, `LOGO 处理失败：${e.message || '图片无法识别'}`)
  }
}))

// 上传错误统一 JSON 返回，避免 multer 默认 HTML 错误页
router.use((err, _req, res, _next) => res.status(400).json({ code: 400, msg: err.message || '上传失败' }))

module.exports = router
