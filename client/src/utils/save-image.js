export const isWeChat = () => /MicroMessenger/i.test(navigator.userAgent || '')

// 微信内 → 外部浏览器免二次登录：把一次性凭证写入当前 URL。
// 用户点右上角「在浏览器中打开」时，微信会把当前 URL（含 ticket）带到外部浏览器，
// 外部浏览器的路由守卫用 ticket 自动恢复登录态。需在显示「去浏览器打开」引导前调用。
let preparing = null
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
      return true
    } catch { return false } finally { preparing = null }
  })()
  return preparing
}

export function saveBlob(blob, filename) {
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
