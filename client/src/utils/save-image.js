export const isWeChat = () => /MicroMessenger/i.test(navigator.userAgent || '')

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
