// 四级渐进定位单例（Web 端）——移植自 smart-bnb 的四层降级链，适配 MCard：
//   Layer 0  微信 JS-SDK getLocation（微信内，~10m）；非微信环境跳过
//   Layer 1  浏览器 Geolocation（GPS/WiFi/基站，~10-100m）
//   Layer 2  IP 定位（后端代理 /api/geo/ip-locate，城市级，无需授权）
//   Layer 3  城市中心坐标兜底（永不为空）
// 设计：单例共享 + 即时缓存 + 渐进升级 + 精度分级 + 防重入 + 全链路超时兜底。
// 铁律：页面禁止直接调 navigator.geolocation / IP 接口，统一走本模块。
// ⚠️ 坐标系铁律：对外统一输出 GCJ-02（与名片存库坐标、小程序、高德一致）。
//    微信 type=wgs84 与浏览器 Geolocation 是 WGS84 → set() 统一转换；
//    IP 定位走后端（高德 GCJ-02 优先），免费 API 的 WGS84 由后端转换（services/geo.js）。
import api from '../api'
import { isWeChat, configWx } from './wx-sdk'
import { CITIES } from './city-data'
import { wgs84ToGcj02 } from './geo-coord'

export const QUALITY = Object.freeze({ PRECISE: 'precise', APPROXIMATE: 'approximate', COARSE: 'coarse' })
const SOURCE_QUALITY = { wechat: QUALITY.PRECISE, gps: QUALITY.PRECISE, ip: QUALITY.APPROXIMATE, default: QUALITY.COARSE, manual: QUALITY.PRECISE }

let current = null            // 当前最优位置（缓存）
let inflight = null           // 防重入：进行中的定位 Promise
const listeners = new Set()
const REFRESH_MS = 60 * 1000

function notify() { for (const fn of listeners) { try { fn(current) } catch {} } }
export function onPositionChange(fn) { listeners.add(fn); return () => listeners.delete(fn) }

function valid(lat, lng) {
  const a = Number(lat), b = Number(lng)
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180 &&
    !(Math.abs(a) < 0.0001 && Math.abs(b) < 0.0001)
}

function set(pos) {
  pos._ts = Date.now()
  if (!pos.quality) pos.quality = SOURCE_QUALITY[pos.source] || QUALITY.COARSE
  // 统一坐标系：wgs84 来源（微信 JS-SDK type=wgs84、浏览器 Geolocation）转 GCJ-02；
  // ip/default 已是 GCJ-02（后端高德 / 内置城市中心点），manual 由调用方保证 GCJ-02。
  if (pos.coordSys === 'wgs84' && valid(pos.lat, pos.lng)) {
    const g = wgs84ToGcj02(pos.lat, pos.lng)
    pos.lat = g.lat; pos.lng = g.lng
  }
  pos.coordSys = 'gcj02'
  current = pos
  notify()
  return pos
}

// 同步取缓存（无缓存返回城市中心，永不为空、零网络）
export function getCachedPosition(defaultCity = '上海') {
  if (current) return current
  const c = cityCenter(defaultCity)
  return { lat: c.lat, lng: c.lng, city: defaultCity, source: 'default', quality: QUALITY.COARSE, _ts: 0 }
}

export function getPositionQualityLabel() {
  const q = current?.quality || QUALITY.COARSE
  return {
    [QUALITY.PRECISE]: { label: '精确定位', level: 'high' },
    [QUALITY.APPROXIMATE]: { label: '大致位置', level: 'medium' },
    [QUALITY.COARSE]: { label: '默认位置', level: 'low' }
  }[q] || { label: '默认位置', level: 'low' }
}

export function cityCenter(name) {
  const clean = String(name || '').replace(/[市省区]$/, '')
  const c = CITIES.find(c => c.name === clean || c.name.includes(clean) || clean.includes(c.name)) || CITIES.find(c => c.name === '上海')
  // 前端城市镜像是 WGS84 原始值；对外统一 GCJ-02（与服务端 meta 下发的一致）
  return Number.isFinite(c.lat) && Number.isFinite(c.lng) ? { ...c, ...wgs84ToGcj02(c.lat, c.lng) } : c
}

// ---- Layer 0: 微信 JS-SDK getLocation（带离线校验窗口重试）----
async function getByWechat(timeout = 8000) {
  if (!isWeChat()) return null
  try {
    const { wx, ok } = await configWx(api)
    if (!ok || !wx?.getLocation) return null
    for (let attempt = 0; attempt < 2; attempt++) {
      const pos = await new Promise(resolve => {
        let done = false
        const finish = v => { if (!done) { done = true; resolve(v) } }
        const timer = setTimeout(() => finish(null), timeout)
        try {
          wx.getLocation({
            type: 'wgs84',
            success: r => { clearTimeout(timer); finish(r?.latitude && r?.longitude ? { lat: r.latitude, lng: r.longitude, accuracy: r.accuracy || null, source: 'wechat', coordSys: 'wgs84' } : null) },
            fail: () => { clearTimeout(timer); finish(null) },
            cancel: () => { clearTimeout(timer); finish(null) }
          })
        } catch { clearTimeout(timer); finish(null) }
      })
      if (pos && valid(pos.lat, pos.lng)) return pos
      // offline verifying：等权限异步校验后重试一次
      if (attempt === 0) await new Promise(r => setTimeout(r, 400))
    }
  } catch {}
  return null
}

// ---- Layer 1: 浏览器 Geolocation（先快速后高精度）----
function getByBrowser(timeout, highAccuracy) {
  return new Promise(resolve => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null)
    let done = false
    const finish = v => { if (!done) { done = true; resolve(v) } }
    const timer = setTimeout(() => finish(null), timeout)
    try {
      navigator.geolocation.getCurrentPosition(
        p => {
          clearTimeout(timer)
          const lat = p?.coords?.latitude, lng = p?.coords?.longitude
          finish(valid(lat, lng) ? { lat, lng, accuracy: p.coords.accuracy || null, source: 'gps', coordSys: 'wgs84' } : null)
        },
        () => { clearTimeout(timer); finish(null) },
        { enableHighAccuracy: !!highAccuracy, timeout: timeout - 200, maximumAge: highAccuracy ? 0 : 30000 }
      )
    } catch { clearTimeout(timer); finish(null) }
  })
}

// ---- Layer 2: IP 定位（后端代理）----
async function getByIp(timeout = 6000) {
  try {
    const { data } = await api.get('/api/geo/ip-locate', { timeout })
    const p = data?.data
    if (p && valid(p.lat, p.lng)) return { lat: p.lat, lng: p.lng, city: p.city || '', province: p.province || '', source: 'ip' }
  } catch {}
  return null
}

// 逆地理编码（供地图选点后回填省市区街道）
export async function reverseGeocode(lat, lng) {
  try {
    const { data } = await api.get('/api/geo/reverse-geocode', { params: { lat, lng } })
    return data?.data || null
  } catch { return null }
}

// 正向地理编码（地址 → 坐标）
export async function geocode(address, city) {
  try {
    const { data } = await api.get('/api/geo/geocode', { params: { address, city } })
    return data?.data || null
  } catch { return null }
}

// 主入口：四级降级。返回 Promise<pos>，pos 永不为空。
export function getCurrentPosition(options = {}) {
  if (current && !options.forceRefresh) return Promise.resolve(current)
  if (inflight) return inflight
  inflight = (async () => {
    const city = options.city || '上海'
    const timeout = options.timeout || 8000
    const defaultCity = cityCenter(city)
    let pos = null

    // L0 微信（仅微信环境）
    if (isWeChat()) pos = await getByWechat(timeout)
    // L1 浏览器 GPS：先快速（WiFi/基站），失败再高精度
    if (!pos) pos = await getByBrowser(timeout, false)
    if (!pos) pos = await getByBrowser(timeout, true)
    // L2 IP 定位
    if (!pos) pos = await getByIp()
    // L3 城市中心兜底
    if (!pos) pos = { lat: defaultCity.lat, lng: defaultCity.lng, city, source: 'default' }

    // 逆地理编码校正城市/区县（IP/GPS 结果无 city 时）
    if (pos.source !== 'default' && !pos.city) {
      try {
        const addr = await reverseGeocode(pos.lat, pos.lng)
        if (addr?.city) { pos.city = addr.city; pos.province = addr.province; pos.district = addr.district; pos.street = addr.street }
      } catch {}
    }
    if (!pos.city) pos.city = city
    pos.quality = SOURCE_QUALITY[pos.source] || QUALITY.COARSE
    return set(pos)
  })().finally(() => { inflight = null })
  return inflight
}

// 渐进升级：先出缓存，再后台刷新更精确的位置（不阻塞 UI）
export function ensurePosition(defaultCity = '上海') {
  const c = getCachedPosition(defaultCity)
  if (c.source === 'default' || !c._ts || Date.now() - c._ts > REFRESH_MS) {
    getCurrentPosition({ city: defaultCity }).catch(() => {})
  }
  return c
}

// 手动刷新（用户点「重新定位」）：强制走全链
export function refreshPosition(defaultCity = '上海') {
  return getCurrentPosition({ forceRefresh: true, city: defaultCity, timeout: 10000 })
}

// 手动设为某坐标（地图选点后）
export function setManualPosition(lat, lng, city = '') {
  if (!valid(lat, lng)) return null
  return set({ lat, lng, city, source: 'manual', quality: QUALITY.PRECISE })
}

export function resetPosition() { current = null }
