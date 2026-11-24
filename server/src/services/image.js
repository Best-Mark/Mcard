// 图片上传归一化压缩：sharp 统一缩边 + 转主流格式 WebP，防止原图过大。
// 设计：
// - 栅格图（png/jpg/jpeg/webp/bmp/avif）→ 等比缩到 maxEdge（只缩不放）→ WebP(quality) → 落盘
// - GIF（可能动画）/ SVG（矢量、脚本风险）→ 不栅格化，原样保留
// - 压缩失败降级原图返回，绝不让上传失败（健壮性）
// - 返回供 upload 路由追加到响应：url 文件名由调用方生成，本服务只产出本地文件与元信息
const sharp = require('sharp')
const path = require('path')
const fs = require('fs')
const { randomHex } = require('../utils/id')
const config = require('../config')

const DEFAULT_MAX_EDGE = 1600
const DEFAULT_QUALITY = 82
const MAX_EDGE_LIMIT = 3000

function clampInt(v, fallback, min, max) {
  const n = Number(v)
  return Number.isFinite(n) && n >= min ? Math.min(max, Math.floor(n)) : fallback
}

// 判断是否需要栅格压缩：动画 GIF 与 SVG 原样保留
function needsRaster(ext) {
  const e = String(ext || '').toLowerCase()
  return ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.avif', '.tiff'].includes(e)
}

// 压缩本地文件，产出新路径。返回 { file, filename, width, height, format, size, originalSize, converted }
// file 为最终落盘的绝对路径；调用方负责上传入库/OSS 与响应 URL。
async function normalizeImage(inputPath, originalName, opts = {}) {
  const originalSize = fs.existsSync(inputPath) ? fs.statSync(inputPath).size : 0
  const ext = path.extname(originalName || inputPath).toLowerCase()
  if (!needsRaster(ext)) {
    return { file: inputPath, filename: path.basename(inputPath), width: 0, height: 0, format: ext.replace('.', ''), size: originalSize, originalSize, converted: false }
  }
  const maxEdge = clampInt(opts.maxEdge, DEFAULT_MAX_EDGE, 64, MAX_EDGE_LIMIT)
  const quality = clampInt(opts.quality, DEFAULT_QUALITY, 30, 95)
  const filename = `${Date.now()}-${randomHex(8)}.webp`
  const outFile = path.join(config.UPLOAD_DIR, filename)
  try {
    const meta = await sharp(inputPath, { failOn: 'error', limitInputPixels: 80e6 }).metadata()
    const pipeline = sharp(inputPath)
      .rotate() // 兼容手机 EXIF 方向
      .resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true })
      .webp({ quality, effort: 4 })
    const info = await pipeline.toFile(outFile)
    // 与原文件不同（多数情况）才删原图；极端同名不做删除
    if (outFile !== inputPath && fs.existsSync(inputPath)) { try { fs.unlinkSync(inputPath) } catch {} }
    return {
      file: outFile, filename,
      width: info.width || meta.width || 0, height: info.height || meta.height || 0,
      format: 'webp', size: info.size, originalSize, converted: true
    }
  } catch (e) {
    // 自愈降级：压缩失败仍用原图，不让用户上传失败
    return { file: inputPath, filename: path.basename(inputPath), width: 0, height: 0, format: ext.replace('.', ''), size: originalSize, originalSize, converted: false, error: e.message }
  }
}

module.exports = { normalizeImage, needsRaster }
