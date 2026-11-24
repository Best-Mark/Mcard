const CACHE = 'mcard-v2'

self.addEventListener('install', e => {
  self.skipWaiting()
})
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/')) return
  // 导航/HTML 一律纯网络：绝不缓存 index.html 壳，避免部署后旧壳引用已删除的 hash chunk 白屏。
  if (e.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/') {
    e.respondWith(fetch(e.request))
    return
  }
  // 静态资源（文件名带 hash）：网络优先，拿到就更新缓存；离线时用缓存兜底。
  e.respondWith(fetch(e.request).then(res => {
    const copy = res.clone()
    caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {})
    return res
  }).catch(() => caches.match(e.request)))
})
