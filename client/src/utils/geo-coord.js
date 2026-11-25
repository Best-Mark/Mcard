// WGS84 → GCJ-02（火星坐标）——与 server/src/utils/geoCoord.js 保持同一份算法。
// 浏览器 Geolocation / OpenStreetMap 瓦片 / Nominatim 都是 WGS84；
// 高德、微信 JS-SDK（gcj02）、小程序 uni.getLocation 都是 GCJ-02。
// 国内两者相差 300~700 米，混用会让集市「离我最近」的距离明显不准。
// ⚠️ 三端镜像：server/src/utils/geoCoord.js、miniapp/src/utils/request.js；改一处必须同步。

const PI = Math.PI
const A = 6378245.0
const EE = 0.00669342162296594323

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
export function wgs84ToGcj02(lat, lng) {
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
