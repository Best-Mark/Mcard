export const isWeChat = () => /MicroMessenger/i.test(navigator.userAgent || '')
export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

// iOS Safari 访问「以 .vcf 结尾 + 服务端无 attachment 头」的直链才会弹系统添加联系人。
// 绝不能带 ?query（Safari 会当普通下载），服务端已按 UA 自动去掉 attachment。
// 微信内 WKWebView 拦不了通讯录，需先跳外部浏览器。
// 必须用绝对地址：iOS Safari 对相对路径的 .vcf 跳转会当页面内导航，不弹通讯录。
export function openVcfInline(url) {
  const abs = /^https?:\/\//i.test(url) ? url : new URL(url, window.location.origin).href
  window.location.href = abs
}

// 微信内 → 外部浏览器免二次登录：把一次性凭证写入当前 URL。
// 用户点右上角「在浏览器中打开」时，微信会把当前 URL（含 ticket）带到外部浏览器，
// 外部浏览器的路由守卫用 ticket 自动恢复登录态。需在显示「去浏览器打开」引导前调用。
let preparing = null
let ticketCleanTimer = null
export async function prepareExternalOpen(api) {
  if (!isWeChat()) return false
  if (preparing) return preparing
  preparing = (async () => {
    try {
      const { data } = await api.post('/api/auth/share-ticket')
      const ticket = data?.data?.ticket
      if (!ticket) return false
      const u = new URL(window.location.href)
      u.searchParams.set('wx_ticket', ticket)
      window.history.replaceState(null, '', u.toString())
      // 关键：ticket 绝不能长期挂在 URL 上——用户用微信原生「···」转发时会把整条 URL（含凭证）
      // 发出去。给 60 秒窗口供「在浏览器中打开」带出登录态，之后自动从地址栏抹掉。
      // ticket 本身一次性+10 分钟有效，清 URL 不影响已带出的浏览器兑换。
      clearTimeout(ticketCleanTimer)
      ticketCleanTimer = setTimeout(() => {
        const cur = new URL(window.location.href)
        if (cur.searchParams.get('wx_ticket') === ticket) {
          cur.searchParams.delete('wx_ticket')
          window.history.replaceState(null, '', cur.toString())
        }
      }, 60000)
      return true
    } catch { return false } finally { preparing = null }
  })()
  return preparing
}

export function saveBlob(blob, filename) {
  // iOS Safari 对 a[download] 的 blob/dataURL 下载支持不稳定：常见「Safari浏览器无法下载此文件」
  // 却没有任何回调可捕获。不能无条件返回 downloaded 造成假成功——交给调用方引导长按图片。
  // （她在微信 WKWebView 里更是完全空操作，上面 saveImageUrl 已提前返回 longpress。）
  if (isIOS()) return { kind: 'longpress', filename }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || 'mcard.png'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return { kind: 'downloaded' }
}

export function saveText(text, filename, mime = 'text/plain;charset=utf-8') {
  return saveBlob(new Blob([text], { type: mime }), filename)
}

export async function saveImageUrl(url, filename) {
  if (isWeChat()) return { kind: 'longpress', url }
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) throw new Error('fetch failed')
    return saveBlob(await res.blob(), filename)
  } catch {
    window.open(url, '_blank', 'noopener')
    return { kind: 'opened', url }
  }
}

export async function saveSvgText(svg, filename) {
  if (isWeChat()) return saveText(svg, filename, 'image/svg+xml;charset=utf-8')
  return saveText(svg, filename, 'image/svg+xml;charset=utf-8')
}
