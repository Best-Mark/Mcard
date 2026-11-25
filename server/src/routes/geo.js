// 地理位置路由：公开定位代理 + 行政区划查询 + 后台区域管理
const express = require('express')
const db = require('../db')
const geo = require('../services/geo')
const { ok, fail, wrap } = require('../utils/response')
const { adminRequired } = require('../utils/auth')

const router = express.Router()

// 客户端 IP 定位（微信 WebView/浏览器通用，服务端代理隐藏 API 细节）
router.get('/ip-locate', wrap(async (req, res) => {
  try {
    const pos = await geo.ipLocate(req)
    if (!pos) return fail(res, 503, 'IP 定位暂不可用，请稍后重试或使用城市选择')
    ok(res, pos)
  } catch (e) {
    fail(res, 503, e.message || 'IP 定位失败')
  }
}))

// 逆地理编码：坐标 → 省/市/区/街道
router.get('/reverse-geocode', wrap(async (req, res) => {
  const lat = Number(req.query.lat), lng = Number(req.query.lng)
  if (!geo.validCoords(lat, lng)) return fail(res, 400, '坐标参数无效')
  try {
    const addr = await geo.reverseGeocode(lat, lng)
    if (!addr) return fail(res, 503, '逆地理编码暂不可用')
    ok(res, addr)
  } catch (e) {
    fail(res, 503, e.message || '逆地理编码失败')
  }
}))

// 正向地理编码：地址文本 → 坐标
router.get('/geocode', wrap(async (req, res) => {
  const address = String(req.query.address || '').trim().slice(0, 120)
  if (!address) return fail(res, 400, '缺少地址参数')
  try {
    const result = await geo.geocode(address, req.query.city)
    if (!result) return fail(res, 503, '地理编码暂不可用')
    ok(res, result)
  } catch (e) {
    fail(res, 503, e.message || '地理编码失败')
  }
}))

// POI 关键词搜索（地图选点联想）：公开，key 仅在服务端使用
router.get('/poi/search', wrap(async (req, res) => {
  const keyword = String(req.query.keyword || '').trim()
  if (!keyword) return ok(res, { list: [] })
  try {
    const list = await geo.searchPoi(keyword, req.query.city)
    ok(res, { list })
  } catch (e) {
    fail(res, 503, e.message || 'POI 搜索失败')
  }
}))

// 行政区划全量树（公开，供省市区级联选择器；数据量小，1 小时缓存）
router.get('/regions', wrap((_req, res) => {
  res.set('Cache-Control', 'public, max-age=3600')
  const rows = db.prepare('SELECT code, parent_code, name, level, sort FROM regions WHERE enabled = 1 ORDER BY level ASC, sort ASC').all()
  ok(res, { regions: rows })
}))

// ---------- 后台区域管理 ----------
router.get('/admin/regions', adminRequired, wrap((req, res) => {
  const level = Number(req.query.level) || 0
  const parent = String(req.query.parent || '')
  let rows
  if (parent) rows = db.prepare('SELECT * FROM regions WHERE parent_code = ? ORDER BY sort, name').all(parent)
  else if (level) rows = db.prepare('SELECT * FROM regions WHERE level = ? ORDER BY sort, name').all(level)
  else rows = db.prepare('SELECT * FROM regions ORDER BY level, sort, name').all()
  ok(res, { regions: rows })
}))

function normalizeRegionBody(body) {
  return {
    code: String(body?.code || '').trim().slice(0, 80),
    parent_code: String(body?.parent_code || '').trim().slice(0, 80),
    name: String(body?.name || '').trim().slice(0, 40),
    level: Math.min(4, Math.max(1, Number(body?.level) || 1)),
    sort: Math.min(99999, Math.max(0, Number(body?.sort) || 0)),
    enabled: body?.enabled === false ? 0 : 1
  }
}

router.post('/admin/regions', adminRequired, wrap((req, res) => {
  const r = normalizeRegionBody(req.body)
  if (!r.code || !r.name) return fail(res, 400, '编码与名称必填')
  try {
    db.prepare('INSERT INTO regions (code, parent_code, name, level, sort, enabled) VALUES (?,?,?,?,?,?)')
      .run(r.code, r.parent_code, r.name, r.level, r.sort, r.enabled)
  } catch (e) {
    if (/UNIQUE/.test(e.message)) return fail(res, 400, '区域编码已存在')
    throw e
  }
  ok(res, { created: true, code: r.code })
}))

router.put('/admin/regions/:code', adminRequired, wrap((req, res) => {
  const code = String(req.params.code || '')
  const exists = db.prepare('SELECT 1 FROM regions WHERE code = ?').get(code)
  if (!exists) return fail(res, 404, '区域不存在')
  const r = normalizeRegionBody(req.body)
  if (!r.name) return fail(res, 400, '名称必填')
  db.prepare('UPDATE regions SET parent_code=?, name=?, level=?, sort=?, enabled=? WHERE code=?')
    .run(r.parent_code, r.name, r.level, r.sort, r.enabled, code)
  ok(res, { updated: true })
}))

router.delete('/admin/regions/:code', adminRequired, wrap((req, res) => {
  const code = String(req.params.code || '')
  // 级联删除子级（按编码前缀），避免留下孤儿节点
  const r = db.prepare('DELETE FROM regions WHERE code = ? OR code LIKE ?').run(code, code + '|%')
  if (!r.changes) return fail(res, 404, '区域不存在')
  ok(res, { deleted: r.changes })
}))

module.exports = router
