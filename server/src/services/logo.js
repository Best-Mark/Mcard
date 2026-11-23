const sharp = require('sharp')
const fs = require('fs')
const path = require('path')
const config = require('../config')
const { randomHex } = require('../utils/id')

const MAX_SIDE = 800
const FEATHER = 26

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const distance = (r, g, b, bg) => Math.sqrt((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2)

function localPath(url) {
  if (typeof url !== 'string' || !/^\/uploads\/[A-Za-z0-9_.-]{4,120}$/.test(url)) return null
  const file = path.join(config.UPLOAD_DIR, path.basename(url))
  return fs.existsSync(file) ? file : null
}

async function cornerBackground(data, w, h, channels) {
  const samples = []
  const size = Math.min(8, w, h)
  for (const [ox, oy] of [[0, 0], [w - size, 0], [0, h - size], [w - size, h - size]]) {
    let r = 0, g = 0, b = 0, n = 0
    for (let y = oy; y < oy + size; y++) {
      for (let x = ox; x < ox + size; x++) {
        const p = (y * w + x) * channels
        if (data[p + 3] < 128) continue
        r += data[p]; g += data[p + 1]; b += data[p + 2]; n++
      }
    }
    if (n) samples.push([r / n, g / n, b / n])
  }
  if (!samples.length) return [255, 255, 255]
  return [0, 1, 2].map(i => samples.reduce((s, c) => s + c[i], 0) / samples.length)
}

async function processLogo(inputPath, { mode = 'auto', tolerance = 32 } = {}) {
  const meta = await sharp(inputPath, { density: 300 }).metadata()
  const raw = await sharp(inputPath, { density: 300 })
    .rotate()
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { data, info } = raw
  const w = info.width, h = info.height, ch = info.channels
  const tol = clamp(Number(tolerance) || 32, 0, 90)
  const normalizedMode = ['auto', 'white', 'none'].includes(mode) ? mode : 'auto'
  let hadAlpha = !!meta.hasAlpha
  let removed = 0

  if (normalizedMode !== 'none') {
    const bg = normalizedMode === 'white' ? [255, 255, 255] : await cornerBackground(data, w, h, ch)
    const visited = new Uint8Array(w * h)
    const queue = new Int32Array(w * h)
    let head = 0, tail = 0
    const push = idx => { if (!visited[idx]) { visited[idx] = 1; queue[tail++] = idx } }

    for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x) }
    for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1) }

    while (head < tail) {
      const idx = queue[head++]
      const x = idx % w
      const y = (idx / w) | 0
      const p = idx * ch
      const d = distance(data[p], data[p + 1], data[p + 2], bg)
      let factor = 0
      if (d <= tol) factor = 0
      else if (d <= tol + FEATHER) factor = (d - tol) / FEATHER
      else continue

      const alpha = Math.min(data[p + 3], Math.round(factor * 255))
      if (alpha < data[p + 3]) { data[p + 3] = alpha; removed++ }
      if (x > 0) push(idx - 1)
      if (x < w - 1) push(idx + 1)
      if (y > 0) push(idx - w)
      if (y < h - 1) push(idx + w)
    }
  }

  const name = `logo-${Date.now()}-${randomHex(8)}.png`
  const output = path.join(config.UPLOAD_DIR, name)
  let pipe = sharp(data, { raw: { width: w, height: h, channels: ch } })
  if (normalizedMode !== 'none') {
    pipe = pipe.trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 4 })
  }
  await pipe.png({ compressionLevel: 9 }).toFile(output)
  const outMeta = await sharp(output).metadata()
  let transparentPixels = 0
  for (let p = 3; p < data.length; p += ch) if (data[p] < 250) transparentPixels++

  return {
    url: `/uploads/${name}`,
    width: outMeta.width,
    height: outMeta.height,
    mode: normalizedMode,
    tolerance: tol,
    hadAlpha,
    removedPixels: removed,
    transparent: transparentPixels > 0
  }
}

module.exports = { processLogo, localPath }
