const CACHE = 'mcard-v1'
const SHELL = ['/', '/manifest.webmanifest', '/icon.svg']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/')) return
  // 页面导航走网络优先，避免部署后旧 index.html 引用已删除的 hash 资源
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then(res => {
      const copy = res.clone()
      caches.open(CACHE).then(c => c.put('/', copy)).catch(() => {})
      return res
    }).catch(() => caches.match('/')))
    return
  }
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
    const copy = res.clone()
    caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {})
    return res
  }).catch(() => caches.match('/icon.svg'))))
})
