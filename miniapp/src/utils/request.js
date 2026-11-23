// 所有公共方法集中在此文件：小程序新增纯 require js 文件在部分开发者工具热重载时会白屏
const API_BASE = 'http://localhost:3000'

export const baseUrl = API_BASE

export function toast(title, icon = 'none') {
  uni.showToast({ title, icon, duration: 2200 })
}

export function request(url, { method = 'GET', data = {}, auth = false, admin = false } = {}) {
  return new Promise((resolve, reject) => {
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
