// 地理位置服务 —— 后端代理（唯一真相源）
// 职责：① IP 定位（高德优先，免费 API 竞速兜底）② 逆地理编码 ③ 正向地理编码（地址→坐标）
// 高德 Key 服务端直读 settings，绝不下发前端；所有外部请求带超时 + try/catch（自愈约定）。
const settings = require('../utils/settings')
const { CITIES } = require('../utils/market')
const { wgs84ToGcj02, gcj02ToWgs84 } = require('../utils/geoCoord')

// 带超时的 JSON GET（兼容 Node 18，手写 AbortController 不依赖 AbortSignal.timeout）
async function httpGetJson(url, timeout = 4000, headers = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'MCard-Geo/1.0', ...headers }
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

function validCoords(lat, lng) {
  const a = Number(lat), b = Number(lng)
  return Number.isFinite(a) && Number.isFinite(b) &&
    Math.abs(a) <= 90 && Math.abs(b) <= 180 &&
    !(Math.abs(a) < 0.0001 && Math.abs(b) < 0.0001)
}

const stripSuffix = s => String(s || '').replace(/[市省区]$/, '')

// 城市名 → 内置中心坐标（取首个匹配，兜底用）
function cityCoord(name) {
  const clean = stripSuffix(name)
  if (!clean) return null
  return CITIES.find(c => c.name === clean || c.name.includes(clean) || clean.includes(c.name)) || null
}

function centerFromRectangle(rectangle) {
  try {
    const rect = String(rectangle || '').split(';')
    if (rect.length !== 2) return null
    const [lbLng, lbLat] = rect[0].split(',').map(Number)
    const [rtLng, rtLat] = rect[1].split(',').map(Number)
    if (![lbLng, lbLat, rtLng, rtLat].every(Number.isFinite)) return null
    return { lat: (lbLat + rtLat) / 2, lng: (lbLng + rtLng) / 2 }
  } catch { return null }
}

function clientIp(req) {
  const xff = String(req.headers['x-forwarded-for'] || '')
  if (xff) return xff.split(',')[0].trim()
  return String(req.headers['x-real-ip'] || req.ip || '').replace(/^::ffff:/, '') || ''
}

// 多个任务竞速：谁先返回有效结果用谁，全部失败/无效才 resolve(null)
function firstValid(tasks) {
  return new Promise(resolve => {
    if (!tasks.length) return resolve(null)
    let settled = false
    let pending = tasks.length
    for (const task of tasks) {
      Promise.resolve().then(task).then(v => {
        if (!settled && v) { settled = true; resolve(v) }
      }).catch(() => {}).finally(() => {
        if (--pending === 0 && !settled) { settled = true; resolve(null) }
      })
    }
  })
}

// 高德 IP 定位：稳定、国内准；返回 city/province/坐标
async function amapIpLocate(ip) {
  const key = settings.mapConfig().amapKey
  if (!key) return null
  try {
    const d = await httpGetJson(`https://restapi.amap.com/v3/ip?key=${encodeURIComponent(key)}&ip=${encodeURIComponent(ip)}`, 4000)
    if (d.status !== '1') return null
    const province = String(d.province || '')
    const city = stripSuffix(d.city || '')
    let coords = centerFromRectangle(d.rectangle)
    if (!coords) coords = cityCoord(city || province)
    return {
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      city: city || stripSuffix(province),
      province: stripSuffix(province),
      source: 'ip'
    }
  } catch { return null }
}

// 免费 IP API 竞速兜底（无需 Key）
function freeIpLocate(ip) {
  const tasks = [
    async () => {
      const d = await httpGetJson(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, 4000)
      if (!d.latitude || !d.longitude) return null
      return { lat: Number(d.latitude), lng: Number(d.longitude), city: stripSuffix(d.city), province: stripSuffix(d.region), source: 'ip', coordSys: 'wgs84' }
    },
    async () => {
      const d = await httpGetJson(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,lat,lon,city,regionName`, 4000)
      if (d.status !== 'success' || !d.lat || !d.lon) return null
      return { lat: Number(d.lat), lng: Number(d.lng), city: stripSuffix(d.city), province: stripSuffix(d.regionName), source: 'ip', coordSys: 'wgs84' }
    },
    async () => {
      const d = await httpGetJson(`https://api.ip.sb/geoip/${encodeURIComponent(ip)}`, 4000)
      if (!d.latitude || !d.longitude) return null
      return { lat: Number(d.latitude), lng: Number(d.longitude), city: stripSuffix(d.city), province: stripSuffix(d.region), source: 'ip', coordSys: 'wgs84' }
    }
  ]
  return firstValid(tasks)
}

// IP 定位总入口
async function ipLocate(req) {
  const ip = clientIp(req)
  // 高德优先（若配置了 Key），免费 API 竞速兜底；两者并发竞速取最快有效结果
  const tasks = []
  if (settings.mapConfig().amapKey) tasks.push(() => amapIpLocate(ip))
  tasks.push(() => freeIpLocate(ip))
  const result = await firstValid(tasks)
  if (!result) return null
  // 坐标无效时用城市中心补齐，保证前端总能拿到可用坐标
  if (!validCoords(result.lat, result.lng)) {
    const c = cityCoord(result.city) || cityCoord(result.province)
    result.lat = c?.lat ?? null
    result.lng = c?.lng ?? null
  }
  if (!validCoords(result.lat, result.lng)) return null
  // 坐标系归一：高德返回 GCJ-02（coordSys 缺省即 gcj02）；免费 IP API 返回 WGS84。
  // 只转 WGS84 来源，避免把高德的 GCJ-02 二次转换（会再偏几百米）。
  if (result.coordSys === 'wgs84') {
    const g = wgs84ToGcj02(result.lat, result.lng)
    result.lat = g.lat; result.lng = g.lng
  }
  delete result.coordSys
  return result
}

// 逆地理编码：坐标 → 省/市/区/街道；高德优先，OSM Nominatim 兜底
async function reverseGeocode(lat, lng) {
  if (!validCoords(lat, lng)) return null
  const key = settings.mapConfig().amapKey
  if (key) {
    try {
      const d = await httpGetJson(`https://restapi.amap.com/v3/geocode/regeo?key=${encodeURIComponent(key)}&location=${Number(lng)},${Number(lat)}&extensions=base`, 4000)
      if (d.status === '1' && d.regeocode) {
        const a = d.regeocode.addressComponent || {}
        const city = stripSuffix(a.city || a.province)
        return {
          city: city || '未知',
          province: stripSuffix(a.province),
          district: stripSuffix(a.district),
          street: stripSuffix(a.township),
          address: d.regeocode.formatted_address || ''
        }
      }
    } catch { /* 高德失败走 OSM 兜底 */ }
  }
  // OSM Nominatim 兜底（无需 Key，国内较慢但可用；带明确 UA）
  // 入口坐标统一是 GCJ-02，而 Nominatim 认 WGS84，先反向转换，否则城市/街道会偏几百米
  try {
    const w = gcj02ToWgs84(lat, lng)
    const d = await httpGetJson(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${Number(w.lat)}&lon=${Number(w.lng)}&accept-language=zh-CN&zoom=16`, 5000, { 'User-Agent': 'MCard-Geo/1.0 (contact: site owner)' })
    const a = d.address || {}
    const city = stripSuffix(a.city || a.town || a.county || a.state)
    if (city) {
      return {
        city,
        province: stripSuffix(a.state || a.province),
        district: stripSuffix(a.suburb || a.city_district || a.county),
        street: stripSuffix(a.road || a.neighbourhood),
        address: d.display_name || ''
      }
    }
  } catch { /* 全失败返回 null，前端用城市兜底 */ }
  return null
}

// 正向地理编码：地址文本 → 坐标（地图选点/地址补全用）
async function geocode(address, hintCity) {
  const text = String(address || '').trim().slice(0, 120)
  if (!text) return null
  const key = settings.mapConfig().amapKey
  if (key) {
    try {
      const city = hintCity ? `&city=${encodeURIComponent(stripSuffix(hintCity))}` : ''
      const d = await httpGetJson(`https://restapi.amap.com/v3/geocode/geo?key=${encodeURIComponent(key)}&address=${encodeURIComponent(text)}${city}`, 4000)
      if (d.status === '1' && d.geocodes?.length) {
        const [lng, lat] = String(d.geocodes[0].location || '').split(',').map(Number)
        if (validCoords(lat, lng)) return { lat, lng, formatted: d.geocodes[0].formatted_address || text }
      }
    } catch { /* 走 OSM 兜底 */ }
  }
  try {
    const d = await httpGetJson(`https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(text)}&accept-language=zh-CN&limit=1`, 5000, { 'User-Agent': 'MCard-Geo/1.0 (contact: site owner)' })
    if (d?.length) {
      const lat = Number(d[0].lat), lng = Number(d[0].lon)
      if (validCoords(lat, lng)) {
        const p = wgs84ToGcj02(lat, lng) // Nominatim=WGS84，高德=GCJ-02，出口统一
        return { lat: p.lat, lng: p.lng, formatted: d[0].display_name || text }
      }
    }
  } catch { /* 全失败返回 null */ }
  return null
}

module.exports = { ipLocate, reverseGeocode, geocode, validCoords, stripSuffix, cityCoord }
