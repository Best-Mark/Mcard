export async function shareOrCopy({ title, text, url }) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url })
      return 'shared'
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled'
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    return 'copied'
  } catch {
    const el = document.createElement('textarea')
    el.value = url
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    el.remove()
    return ok ? 'copied' : 'failed'
  }
}

export const mapLinks = address => {
  const q = encodeURIComponent(address)
  const cn = encodeURIComponent(address)
  return [
    { key: 'amap', label: '高德', href: `https://uri.amap.com/search?keyword=${cn}&city=全国&src=mcard&callnative=1` },
    { key: 'baidu', label: '百度', href: `https://api.map.baidu.com/marker?location=0,0&title=${cn}&content=${cn}&output=html&src=mcard` },
    { key: 'qq', label: '腾讯', href: `https://apis.map.qq.com/uri/v1/search?keyword=${cn}&region=中国` },
    { key: 'apple', label: 'Apple', href: `https://maps.apple.com/?q=${q}` },
    { key: 'google', label: 'Google', href: `https://www.google.com/maps/search/?api=1&query=${q}` }
  ]
}
