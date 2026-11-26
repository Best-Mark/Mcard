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
  put: (url, data = {}, auth = true) => request(url, { method: 'PUT', data, auth }),
  delete: (url, auth = true) => request(url, { method: 'DELETE', auth })
}

export function setAuth(token, user) {
  uni.setStorageSync('mcard_token', token || '')
  uni.setStorageSync('mcard_user', user || null)
  clearMyInvite() // 账号切换后邀请码可能变化，下次分享重新拉取
  loadMyInvite().catch(() => {}) // 登录完成即预热，分享回调同步取缓存即可带码
}
export function logout() {
  uni.removeStorageSync('mcard_token')
  uni.removeStorageSync('mcard_user')
  clearMyInvite()
}
export function isLogged() {
  return !!uni.getStorageSync('mcard_token')
}
// 推广员身份：账户层 users.is_promoter，登录后随 user 对象落 mcard_user（与后台 role 无关）
export function isPromoterUser() {
  const u = uni.getStorageSync('mcard_user')
  return !!(u && u.is_promoter)
}
// 邀请码落地：任何入口（分享链接 query / 扫码 scene）都可调用，登录后统一回传绑定。
export function saveInvite(code) {
  const c = String(code || '').trim().slice(0, 20)
  if (c) uni.setStorageSync('mcard_invite', c)
}
// 登录成功后的邀请归因兜底绑定（失败不阻断登录，保留待下次重试）
export async function bindPendingInvite() {
  const invite = uni.getStorageSync('mcard_invite') || ''
  if (!invite || !isLogged()) return
  try {
    await request('/api/promo/bind-invite', { method: 'POST', data: { invite } })
    uni.removeStorageSync('mcard_invite')
  } catch { /* 忽略 */ }
}
// 全面邀请唯一真相源（小程序）：分享出口统一用 withInvite() 拼当前推广员邀请码。
// 与 H5 同口径：/api/promo/my-code 对非推广员返回空；已带码不覆盖；取码失败静默降级。
const INVITE_STORAGE_KEY = 'mcard_my_invite'
let inviteFetching = null
export function clearMyInvite() { uni.removeStorageSync(INVITE_STORAGE_KEY) }
export async function loadMyInvite() {
  if (!isLogged()) { uni.removeStorageSync(INVITE_STORAGE_KEY); return '' }
  const cached = uni.getStorageSync(INVITE_STORAGE_KEY)
  if (cached || cached === '') return String(cached)
  if (inviteFetching) return inviteFetching
  inviteFetching = (async () => {
    let code = ''
    try { code = String((await request('/api/promo/my-code'))?.inviteCode || '') } catch { code = '' }
    uni.setStorageSync(INVITE_STORAGE_KEY, code) // 空串也存：非推广员明确无码，避免每次分享都请求
    inviteFetching = null
    return code
  })()
  return inviteFetching
}
// 同步拼码（分享回调是同步的）：读本地缓存，未预热时返回原链，预热后自动生效
export function withInvite(path, code = null) {
  const s = String(path || '')
  const c = code === null ? String(uni.getStorageSync(INVITE_STORAGE_KEY) || '') : code
  if (!c || !s) return s
  if (/[?&]invite=/.test(s)) return s // 已带码不覆盖（含上游转发透传）
  return `${s}${s.includes('?') ? '&' : '?'}invite=${encodeURIComponent(c)}`
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

// 扫码主场景 URL 版本：与 client/src/utils/qr.js 的 SCAN_V 约定同号。
// 渲染逻辑（纠错/静音区/去 LOGO）升级时两端一起 +1，用新 query 击穿 CDN 旧图案缓存。
const SCAN_V = 2
export function scanQrUrl(slug, ext, size) {
  return `${API_BASE}/api/cards/public/${slug}/${ext}?size=${size}&scan=1&qv=${SCAN_V}`
}

export function saveQrImage(slug) {
  const url = scanQrUrl(slug, 'qr.png', 720)
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
// 内置城市中心是公开 WGS84 值，需转 GCJ-02 才能与名片库坐标（高德/微信选点）一致；
// 集市距离偏差 300~700m 的主因之一就是两套坐标系混用。
// ⚠️ 算法镜像：server/src/utils/geoCoord.js、client/src/utils/geo-coord.js，改一处要三处同步。
const GCJ_PI = Math.PI, GCJ_A = 6378245.0, GCJ_EE = 0.00669342162296594323
function gcjTransformLat(x, y) {
  let r = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  r += (20 * Math.sin(6 * x * GCJ_PI) + 20 * Math.sin(2 * x * GCJ_PI)) * 2 / 3
  r += (20 * Math.sin(y * GCJ_PI) + 40 * Math.sin(y / 3 * GCJ_PI)) * 2 / 3
  r += (160 * Math.sin(y / 12 * GCJ_PI) + 320 * Math.sin(y * GCJ_PI / 30)) * 2 / 3
  return r
}
function gcjTransformLng(x, y) {
  let r = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  r += (20 * Math.sin(6 * x * GCJ_PI) + 20 * Math.sin(2 * x * GCJ_PI)) * 2 / 3
  r += (20 * Math.sin(x * GCJ_PI) + 40 * Math.sin(x / 3 * GCJ_PI)) * 2 / 3
  r += (150 * Math.sin(x / 12 * GCJ_PI) + 300 * Math.sin(x / 30 * GCJ_PI)) * 2 / 3
  return r
}
function wgs84ToGcj02(lat, lng) {
  const la = Number(lat), ln = Number(lng)
  if (!(ln > 73.66 && ln < 135.05 && la > 3.86 && la < 53.55)) return { lat: la, lng: ln }
  let dLat = gcjTransformLat(ln - 105, la - 35), dLng = gcjTransformLng(ln - 105, la - 35)
  const rad = la / 180 * GCJ_PI
  let magic = Math.sin(rad); magic = 1 - GCJ_EE * magic * magic
  const sq = Math.sqrt(magic)
  dLat = (dLat * 180) / ((GCJ_A * (1 - GCJ_EE)) / (magic * sq) * GCJ_PI)
  dLng = (dLng * 180) / (GCJ_A / sq * Math.cos(rad) * GCJ_PI)
  return { lat: la + dLat, lng: ln + dLng }
}
const MP_CITY_CENTERS = {
  '北京': { lat: 39.9042, lng: 116.4074 }, '上海': { lat: 31.2304, lng: 121.4737 },
  '广州': { lat: 23.1291, lng: 113.2644 }, '深圳': { lat: 22.5431, lng: 114.0579 },
  '杭州': { lat: 30.2741, lng: 120.1551 }, '成都': { lat: 30.5728, lng: 104.0668 },
  '重庆': { lat: 29.5630, lng: 106.5516 }, '武汉': { lat: 30.5928, lng: 114.3055 },
  '西安': { lat: 34.3416, lng: 108.9398 }, '南京': { lat: 32.0603, lng: 118.7969 }
}
for (const c of Object.values(MP_CITY_CENTERS)) {
  const g = wgs84ToGcj02(c.lat, c.lng)
  c.lat = g.lat; c.lng = g.lng
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
      resolve({ lat: c.lat, lng: c.lng, city: defaultCity, source: 'default', quality: 'coarse', coordSys: 'gcj02' })
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

// ---------- 分享素材池（对齐 MShop 的分享池兜底，唯一真相源在服务端 settings.js）----------
// ⚠️ 小程序新增纯 require js 文件在部分开发者工具热重载时会白屏，故池逻辑并入本既有文件，不新建模块。
// 池内容来自匿名接口 /api/public/config 下发的 share_title / share_desc / share_image；
// 缺省时回落内置文案，保证任何页面转发出去都有像样的标题/缩略图，不是裸链接。
const SHARE_TITLE_FALLBACK = ['一张名片，扫码存进通讯录', '资料随时改，二维码终身不变', '认识一下，这是我的电子名片']
const sharePool = { titles: [], descs: [], images: [] }
const warmedImages = new Map()
let sharePoolLoading = null

const poolOf = v => (Array.isArray(v) ? v : v ? [v] : []).map(s => String(s || '').trim()).filter(Boolean).slice(0, 10)
const pickOne = arr => (arr.length ? arr[Math.floor(Math.random() * arr.length)] : '')

/** 拉取分享素材池（onLaunch 预取，失败静默用内置兜底；并发只发一次） */
export function prefetchShareCard() {
  if (sharePoolLoading) return sharePoolLoading
  sharePoolLoading = request('/api/public/config').then(d => {
    sharePool.titles = poolOf(d?.share_title)
    sharePool.descs = poolOf(d?.share_desc)
    sharePool.images = poolOf(d?.share_image).map(toShareImageUrl)
    warmShareImages()
  }).catch(() => {}).finally(() => { sharePoolLoading = null })
  return sharePoolLoading
}

function toShareImageUrl(u) {
  const s = String(u || '')
  if (/^https?:\/\//i.test(s)) return s
  return s.startsWith('/') ? API_BASE + s : ''
}

/** 预热图片池前 5 张到本地临时路径，避免微信分享面板首次打开时缩略图转圈（失败静默） */
function warmShareImages() {
  for (const url of sharePool.images.slice(0, 5)) {
    if (warmedImages.has(url)) continue
    uni.downloadFile({
      url,
      success: res => { if (res.statusCode === 200) warmedImages.set(url, res.tempFilePath) },
      fail: () => {}
    })
  }
}

/** 分享标题：优先预热池随机，池空回落内置文案 */
export function getShareCardTitle() {
  return pickOne(sharePool.titles) || pickOne(SHARE_TITLE_FALLBACK)
}

/** 分享缩略图：优先已预热的本地路径（秒出），否则用池里的网络图 */
export function getShareCardImage() {
  const url = pickOne(sharePool.images)
  return url ? (warmedImages.get(url) || url) : ''
}
