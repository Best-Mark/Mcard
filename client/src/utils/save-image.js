const UA = () => navigator.userAgent || ''
export const isWeChat = () => /MicroMessenger/i.test(UA())
export const isIOS = () => /iPad|iPhone|iPod/.test(UA()) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
// 环境判定的唯一真相源：微信优先（它是一层壳，底层系统已被限制），再分 iOS/Android/鸿蒙/其它。
// 所有「长按/扫码/去浏览器」类提示必须按这里的结果出文案，禁止在 Android 上写 iPhone 提示（反之亦然）。
export function deviceEnv() {
  if (isWeChat()) return 'wechat'
  if (isIOS()) return 'ios'
  if (/HarmonyOS|ArkWeb|HuaweiBrowser/i.test(UA())) return 'harmony'
  if (/Android|Adr/i.test(UA())) return 'android'
  return 'other'
}
// 各环境保存图片/二维码的操作指引（系统相关文案集中在此，UI 只取用）
export const SAVE_IMAGE_TIPS = {
  ios: 'iOS 不允许网页直接下载图片。长按下方图片 → 存储到照片 即可保存。',
  android: '长按下方图片 → 保存到相册 即可保存；若长按无菜单，点「保存二维码图片」由浏览器下载。',
  harmony: '长按下方图片 → 保存到相册 即可保存；若长按无菜单，点「保存二维码图片」由浏览器下载。',
  other: '长按下方图片保存到本地；或点「保存二维码图片」由浏览器下载。'
}

// iOS Safari 访问「以 .vcf 结尾 + 服务端无 attachment 头」的直链才会弹系统添加联系人。
// 绝不能带 ?query（Safari 会当普通下载），服务端已按 UA 自动去掉 attachment。
// 微信内 WKWebView 拦不了通讯录，需先跳外部浏览器。
// 必须用绝对地址：iOS Safari 对相对路径的 .vcf 跳转会当页面内导航，不弹通讯录。
export function openVcfInline(url) {
  const abs = /^https?:\/\//i.test(url) ? url : new URL(url, window.location.origin).href
  window.location.href = abs
}

// 安卓：用 Chrome intent:// 直接拉起系统「添加联系人」界面并预填资料，彻底摆脱「下载 vcf 再导入」。
// 安卓浏览器收到 text/vcard 只会下载（不像 iOS Safari 会弹添加联系人），唯一可靠的直拉方式是 Android intent。
// 格式依据 Chrome 官方文档：intent:#Intent;action=...;type=...;S.xxx=...;S.browser_fallback_url=...;end
// - S.browser_fallback_url：intent 无法解析/无通讯录应用时自动跳这个 URL（指向强制下载的 VCF）。
// - 字段值用 encodeURIComponent，避免中文/分隔符（; =）破坏 intent 语法。
// - 微信 X5 不支持 intent://，所以仅安卓外部浏览器用；微信内走「去浏览器打开」引导。
export function androidContactIntent(card, fallbackUrl) {
  const enc = v => encodeURIComponent(String(v || '').slice(0, 120))
  const parts = [
    'intent:#Intent',
    'action=android.intent.action.INSERT',
    'type=vnd.android.cursor.dir/person',
    'package=com.android.contacts'
  ]
  const name = card?.name || card?.name_en || ''
  const phone = String(card?.mobile || card?.phone || '').trim()
  if (name) parts.push(`S.name=${enc(name)}`)
  if (phone) parts.push(`S.phone=${enc(phone)}`)
  const company = String(card?.company || '').trim()
  if (company) parts.push(`S.company=${enc(company)}`)
  const title = [card?.title, card?.department].filter(Boolean).join(' · ')
  if (title) parts.push(`S.title=${enc(title)}`)
  const email = String(card?.email || '').trim()
  if (email) parts.push(`S.email=${enc(email)}`)
  const abs = /^https?:\/\//i.test(fallbackUrl || '') ? fallbackUrl : new URL(fallbackUrl || '/', window.location.origin).href
  parts.push(`S.browser_fallback_url=${encodeURIComponent(abs)}`)
  parts.push('end')
  return parts.join(';')
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
