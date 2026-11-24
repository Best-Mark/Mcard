// 所有公共方法集中在此文件：小程序新增纯 require js 文件在部分开发者工具热重载时会白屏
// 强制约束：域名不写死。小程序没有"当前请求上下文"，只能在构建期注入 VITE_API_BASE。
//   开发：默认 http://localhost:3000
//   发布：构建前设置 VITE_API_BASE=https://你的域名（与微信后台 request 合法域名一致，必须 HTTPS）
const API_BASE = String(import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? 'http://localhost:3000' : '')).replace(/\/$/, '')

export const baseUrl = API_BASE

export function toast(title, icon = 'none') {
  uni.showToast({ title, icon, duration: 2200 })
}

export function request(url, { method = 'GET', data = {}, auth = false, admin = false } = {}) {
  return new Promise((resolve, reject) => {
    if (!API_BASE) return reject(new Error('API 域名未配置：构建前请设置 VITE_API_BASE'))
    const token = uni.getStorageSync(admin ? 'mcard_admin_token' : 'mcard_token')
    uni.request({
      url: API_BASE + url,
      method,
      data,
      header: {
        'content-type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      success: res => {
        const d = res.data
        if (res.statusCode >= 200 && res.statusCode < 300 && d && d.code === 0) return resolve(d.data)
        reject(new Error(d?.msg || `请求失败（${res.statusCode}）`))
      },
      fail: err => reject(new Error(err.errMsg || '网络异常'))
    })
  })
}

export const api = {
  get: (url, auth = false) => request(url, { auth }),
  post: (url, data = {}, auth = true) => request(url, { method: 'POST', data, auth }),
  put: (url, data = {}, auth = true) => request(url, { method: 'PUT', data, auth })
}

export function setAuth(token, user) {
  uni.setStorageSync('mcard_token', token || '')
  uni.setStorageSync('mcard_user', user || null)
}
export function logout() {
  uni.removeStorageSync('mcard_token')
  uni.removeStorageSync('mcard_user')
}
export function isLogged() {
  return !!uni.getStorageSync('mcard_token')
}
export function goLogin() {
  uni.navigateTo({ url: '/pages/login/login' })
}

export function parseSlug(text) {
  const s = String(text || '').trim()
  const inUrl = s.match(/\/c\/([a-z0-9-]{3,32})/i)
  if (inUrl) return inUrl[1]
  return /^[a-z0-9-]{3,32}$/i.test(s) ? s.toLowerCase() : ''
}

export function copyText(text, tip = '已复制') {
  if (!text) return toast('内容为空')
  uni.setClipboardData({ data: String(text), success: () => toast(tip, 'success') })
}

export function callPhone(phone) {
  if (!phone) return toast('尚未填写电话')
  uni.makePhoneCall({ phoneNumber: String(phone) })
}

function saveImage(path) {
  uni.saveImageToPhotosAlbum({
    filePath: path,
    success: () => toast('已保存到相册', 'success'),
    fail: err => {
      // #ifdef MP-WEIXIN
      if (/auth|scope|deny/i.test(err.errMsg || '')) {
        uni.authorize({
          scope: 'scope.writePhotosAlbum',
          success: () => saveImage(path),
          fail: () => uni.showModal({
            title: '需要相册权限',
            content: '请在小程序设置中允许「保存到相册」',
            success: r => { if (r.confirm) uni.openSetting() }
          })
        })
        return
      }
      // #endif
      toast('保存失败，请长按二维码图片保存')
    }
  })
}

export function saveTempImage(path) {
  saveImage(path)
}

export function saveImageByUrl(url) {
  uni.downloadFile({
    url,
    success: res => { if (res.statusCode === 200) saveImage(res.tempFilePath); else toast('图片下载失败') },
    fail: () => toast('网络异常')
  })
}

export function currentPlatform() {
  // #ifdef MP-WEIXIN
  return 'wechat'
  // #endif
  // #ifdef MP-ALIPAY
  return 'alipay'
  // #endif
  // #ifdef MP-TOUTIAO
  return 'toutiao'
  // #endif
  return 'other'
}

export function saveQrImage(slug) {
  const url = `${API_BASE}/api/cards/public/${slug}/qr.png?size=720`
  uni.downloadFile({
    url,
    success: res => {
      if (res.statusCode === 200) saveImage(res.tempFilePath)
      else toast('二维码下载失败')
    },
    fail: () => toast('网络异常，请稍后再试')
  })
}

export function saveQrByText(text) {
  const url = `${API_BASE}/api/cards/public/qr.png?text=${encodeURIComponent(text)}&size=720`
  uni.downloadFile({
    url,
    success: res => { if (res.statusCode === 200) saveImage(res.tempFilePath); else toast('二维码下载失败') },
    fail: () => toast('网络异常')
  })
}

export function uploadImage(filePath) {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync('mcard_token')
    uni.uploadFile({
      url: `${API_BASE}/api/upload`,
      filePath,
      name: 'file',
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: res => {
        try {
          const d = JSON.parse(res.data)
          if (d.code === 0) return resolve(d.data.url)
          reject(new Error(d.msg || '上传失败'))
        } catch { reject(new Error('上传返回格式异常')) }
      },
      fail: err => reject(new Error(err.errMsg || '上传失败'))
    })
  })
}

export function uploadLogo(filePath, mode = 'auto', tolerance = 32) {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync('mcard_token')
    uni.uploadFile({
      url: `${API_BASE}/api/upload/logo`,
      filePath,
      name: 'file',
      formData: { mode, tolerance: String(tolerance) },
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: res => {
        try {
          const d = JSON.parse(res.data)
          if (d.code === 0) return resolve(d.data)
          reject(new Error(d.msg || 'LOGO 处理失败'))
        } catch { reject(new Error('LOGO 处理返回格式异常')) }
      },
      fail: err => reject(new Error(err.errMsg || '上传失败'))
    })
  })
}

export function processLogo(sourceUrl, mode = 'auto', tolerance = 32) {
  return api.post('/api/upload/logo/process', { sourceUrl, mode, tolerance })
}

export function shareCardPath(slug) {
  return `/pages/card/card?slug=${slug}`
}

// 统一定位入口：微信/支付宝/抖音(api.getLocation) 差异封装，失败走 reject
export function getLocation() {
  return new Promise((resolve, reject) => {
    // #ifdef MP-WEIXIN || MP-ALIPAY || MP-TOUTIAO
    uni.getLocation({
      type: 'gcj02',
      success: res => resolve({ lat: res.latitude, lng: res.longitude, source: 'gps' }),
      fail: err => reject(err)
    })
    // #endif
    // #ifndef MP-WEIXIN || MP-ALIPAY || MP-TOUTIAO
    reject(new Error('当前平台不支持定位'))
    // #endif
  })
}

// 四级降级定位（对齐 Web 端 geo.js）：原生 getLocation → 后端 IP 定位 → 城市中心兜底。
// 永不 reject（除非网络与定位都异常），返回 { lat, lng, city, source, quality }。
const MP_CITY_CENTERS = {
  '北京': { lat: 39.9042, lng: 116.4074 }, '上海': { lat: 31.2304, lng: 121.4737 },
  '广州': { lat: 23.1291, lng: 113.2644 }, '深圳': { lat: 22.5431, lng: 114.0579 },
  '杭州': { lat: 30.2741, lng: 120.1551 }, '成都': { lat: 30.5728, lng: 104.0668 },
  '重庆': { lat: 29.5630, lng: 106.5516 }, '武汉': { lat: 30.5928, lng: 114.3055 },
  '西安': { lat: 34.3416, lng: 108.9398 }, '南京': { lat: 32.0603, lng: 118.7969 }
}
const validCoord = (a, b) => {
  const x = Number(a), y = Number(b)
  return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x) <= 90 && Math.abs(y) <= 180 &&
    !(Math.abs(x) < 0.0001 && Math.abs(y) < 0.0001)
}

export function geoLocate(defaultCity = '上海') {
  return new Promise(async resolve => {
    const fallback = () => {
      const c = MP_CITY_CENTERS[defaultCity] || MP_CITY_CENTERS['上海']
      resolve({ lat: c.lat, lng: c.lng, city: defaultCity, source: 'default', quality: 'coarse' })
    }
    // L0/L1: 原生定位
    try {
      const p = await getLocation()
      if (validCoord(p.lat, p.lng)) return resolve({ ...p, quality: 'precise' })
    } catch {}
    // L2: 后端 IP 定位
    try {
      const data = await request('/api/geo/ip-locate')
      if (validCoord(data?.lat, data?.lng)) {
        return resolve({ lat: data.lat, lng: data.lng, city: data.city || defaultCity, province: data.province || '', source: 'ip', quality: 'approximate' })
      }
    } catch {}
    // L3: 城市兜底
    fallback()
  })
}

// 逆地理编码（坐标 → 省市区街道）
export function reverseGeocode(lat, lng) {
  return request('/api/geo/reverse-geocode', { data: { lat, lng } }).catch(() => null)
}

// 正向地理编码（地址 → 坐标）
export function geocodeAddress(address, city) {
  return request('/api/geo/geocode', { data: { address, city } }).catch(() => null)
}

// 行政区划树
export function getRegions() {
  return request('/api/geo/regions').then(d => d?.regions || []).catch(() => [])
}

// ---------- 借鉴同类亮点：通知 / 资料夹 / 展会连扫 / 来源追踪 ----------
export function getNotifications(before = 0) {
  return request('/api/notifications', { auth: true, data: before ? { before } : {} }).catch(() => ({ list: [], unread: 0, hasMore: false }))
}
export function getUnreadCount() {
  return request('/api/notifications/unread', { auth: true }).then(d => d?.unread || 0).catch(() => 0)
}
export function markNotificationRead(id) {
  return request('/api/notifications/read', { method: 'POST', auth: true, data: id ? { id } : { all: true } })
}
export function getMyMaterials() {
  return request('/api/cards/mine/materials', { auth: true }).then(d => d?.list || []).catch(() => [])
}
export function saveMyMaterials(items) {
  return request('/api/cards/mine/materials', { method: 'PUT', auth: true, data: { items } })
}
export function getPublicMaterials(slug) {
  return request(`/api/cards/public/${slug}/materials`).catch(() => ({ list: [], owner: null }))
}
export function batchSaveContacts(slugs, tags = [], note = '') {
  return request('/api/cards/mine/contacts/batch', { method: 'POST', auth: true, data: { slugs, tags, note } })
}
export function traceVisit(slug, source = '', city = '') {
  return request(`/api/cards/public/${slug}/trace`, { method: 'POST', data: { source, city } }).catch(() => null)
}

// ---------- 图片素材库 ----------
export function getAssets() {
  return request('/api/assets', { auth: true }).then(d => d?.list || []).catch(() => [])
}
export function uploadAsset(filePath) {
  return new Promise((resolve, reject) => {
    if (!API_BASE) return reject(new Error('API 域名未配置'))
    const token = uni.getStorageSync('mcard_token')
    uni.uploadFile({
      url: API_BASE + '/api/assets/upload',
      filePath,
      name: 'file',
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: res => {
        let d = {}
        try { d = JSON.parse(res.data) } catch {}
        if (res.statusCode >= 200 && res.statusCode < 300 && d.code === 0) return resolve(d.data)
        reject(new Error(d.msg || '上传失败'))
      },
      fail: err => reject(new Error(err.errMsg || '网络异常'))
    })
  })
}
export function deleteAsset(id) {
  return request('/api/assets/' + id, { method: 'DELETE', auth: true })
}
