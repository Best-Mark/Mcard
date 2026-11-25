// 坐标系统一工具 —— 名片集市距离计算的唯一真相源。
// 背景：Web 浏览器 Geolocation / OpenStreetMap / Nominatim 返回 WGS84，
// 微信 JS-SDK、uni.getLocation、高德地图接口返回 GCJ-02（火星坐标）。
// 中国大陆两者相差 300~700 米，直接用两套坐标算 Haversine 会「差很多」。
// 约定：进入距离计算前，原点一律归一到 GCJ-02；名片坐标存库时已统一 GCJ-02。
// ⚠️ 本文件中的转换算法需在 client/src/utils/geo-coord.js 与 miniapp/src/utils/request.js 同步镜像
//    （三端构建独立，无法共享模块；改一处必须三处同步）。

const PI = Math.PI
const A = 6378245.0                  // 克拉索夫斯基椭球长半轴（GCJ-02 基准）
const EE = 0.00669342162296594323   // 第一偏心率平方

function outOfChina(lat, lng) {
  return !(lng > 73.66 && lng < 135.05 && lat > 3.86 && lat < 53.55)
}

function transformLat(x, y) {
  let ret = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  ret += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3
  ret += (20 * Math.sin(y * PI) + 40 * Math.sin(y / 3 * PI)) * 2 / 3
  ret += (160 * Math.sin(y / 12 * PI) + 320 * Math.sin(y * PI / 30)) * 2 / 3
  return ret
}

function transformLng(x, y) {
  let ret = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  ret += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3
  ret += (20 * Math.sin(x * PI) + 40 * Math.sin(x / 3 * PI)) * 2 / 3
  ret += (150 * Math.sin(x / 12 * PI) + 300 * Math.sin(x / 30 * PI)) * 2 / 3
  return ret
}

function wgs84ToGcj02(lat, lng) {
  const la = Number(lat), ln = Number(lng)
  if (!Number.isFinite(la) || !Number.isFinite(ln) || outOfChina(la, ln)) return { lat: la, lng: ln }
  let dLat = transformLat(ln - 105.0, la - 35.0)
  let dLng = transformLng(ln - 105.0, la - 35.0)
  const radLat = la / 180.0 * PI
  let magic = Math.sin(radLat)
  magic = 1 - EE * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI)
  dLng = (dLng * 180.0) / (A / sqrtMagic * Math.cos(radLat) * PI)
  return { lat: la + dLat, lng: ln + dLng }
}

function gcj02ToWgs84(lat, lng) {
  const la = Number(lat), ln = Number(lng)
  if (!Number.isFinite(la) || !Number.isFinite(ln) || outOfChina(la, ln)) return { lat: la, lng: ln }
  let wLat = la, wLng = ln
  for (let i = 0; i < 5; i++) {
    const g = wgs84ToGcj02(wLat, wLng)
    wLat -= g.lat - la
    wLng -= g.lng - ln
  }
  return { lat: wLat, lng: wLng }
}

// 把任意来源坐标归一到 GCJ-02；未知/已 GCJ-02 原样返回
function toGcj02(lat, lng, coordSys) {
  return String(coordSys || 'gcj02') === 'wgs84' ? wgs84ToGcj02(lat, lng) : { lat: Number(lat), lng: Number(lng) }
}

// WGS84 椭球 Vincenty 逆解距离（公里）——比球面 Haversine 更准（中短距离误差 < 0.1%）。
// GCJ-02 坐标是同一量级的平面加密，用 WGS84 椭球求两点距离偏差可忽略。
function distanceKm(lat1, lng1, lat2, lng2) {
  const la1 = Number(lat1), lo1 = Number(lng1), la2 = Number(lat2), lo2 = Number(lng2)
  if (![la1, lo1, la2, lo2].every(Number.isFinite)) return NaN
  if (la1 === la2 && lo1 === lo2) return 0
  const a = 6378137.0
  const f = 1 / 298.257223563
  const b = (1 - f) * a
  const rad = d => d * PI / 180
  const L = rad(lo2 - lo1)
  const U1 = Math.atan((1 - f) * Math.tan(rad(la1)))
  const U2 = Math.atan((1 - f) * Math.tan(rad(la2)))
  const sU1 = Math.sin(U1), cU1 = Math.cos(U1), sU2 = Math.sin(U2), cU2 = Math.cos(U2)
  let lambda = L, sinSigma = 0, cosSigma = 0, sigma = 0, cosSqAlpha = 0, cos2Alpha = 0, C = 0, sinAlpha = 0
  for (let i = 0; i < 20; i++) {
    const sinLambda = Math.sin(lambda), cosLambda = Math.cos(lambda)
    sinSigma = Math.sqrt((cU2 * sinLambda) ** 2 + (cU1 * sU2 - sU1 * cU2 * cosLambda) ** 2)
    if (sinSigma === 0) return 0
    cosSigma = sU1 * sU2 + cU1 * cU2 * cosLambda
    sigma = Math.atan2(sinSigma, cosSigma)
    sinAlpha = cU1 * cU2 * sinLambda / sinSigma
    cosSqAlpha = 1 - sinAlpha * sinAlpha
    cos2Alpha = cosSqAlpha > 0 ? cosSigma - 2 * sU1 * sU2 / cosSqAlpha : 0
    C = f / 16 * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha))
    const prev = lambda
    lambda = L + (1 - C) * f * sinAlpha * (sigma + C * sinSigma * (cos2Alpha + C * cosSigma * (-1 + 2 * cos2Alpha * cos2Alpha)))
    if (Math.abs(lambda - prev) < 1e-12) break
  }
  const uSq = cosSqAlpha * (a * a - b * b) / (b * b)
  const AA = 1 + uSq / 16384 * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)))
  const BB = uSq / 1024 * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)))
  const deltaSigma = BB * sinSigma * (cos2Alpha + BB / 4 * (
    cosSigma * (-1 + 2 * cos2Alpha * cos2Alpha) -
    BB / 6 * cos2Alpha * (-3 + 4 * sinSigma * sinSigma) * (-3 + 4 * cos2Alpha * cos2Alpha)
  ))
  return b * AA * (sigma - deltaSigma) / 1000
}

module.exports = { wgs84ToGcj02, gcj02ToWgs84, toGcj02, distanceKm, outOfChina }
