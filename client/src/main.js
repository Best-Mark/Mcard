import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import api from './api'
import { ensureSiteConfig, setAuth, auth, bindPendingInvite, markAuthReady } from './store'
import './styles/global.css'
import './styles/desktop.css'
// 模板缩略图配色唯一真相源：CardEdit / CardStyle 共用；全局引入保证配色风格页打开就有色块
import './styles/template-thumbs.css'
// 名片 18 套模板配色唯一真相源：真实页/编辑预览/配色预览/集市预览共用 --cv-*
// 必须在 global.css 之后加载（navygold 的 --cv-page-bg 依赖 global.css 的 --ng-*）
import './styles/card-template-palettes.css'
// 名片卡本体样式唯一真相源（18 套模板规则）：CardView 与 CardSheet 共用，全局以便命中子组件 DOM
import './styles/card-sheet.css'

createApp(App).use(router).mount('#app')
ensureSiteConfig(api)

// 自愈：已登录用户刷新后静默拉取权威用户态，同步推广员等后台可变的身份标记。
// 失败保留 localStorage 旧值，不影响主流程。
if (auth.token) {
  api.get('/api/auth/me').then(async ({ data }) => {
    if (data?.data?.id) setAuth(auth.token, data.data)
    await bindPendingInvite(api)
  }).catch(() => {}).finally(() => markAuthReady())
} else {
  markAuthReady()
}

// 健壮：图片加载失败统一兜底（捕获阶段可拦住 Vue 模板里所有 <img>，无需逐处加 @error）
// 自愈：先重试一次（清缓存重取），仍失败才换占位，避免偶发网络抖动留下破图
const IMG_PLACEHOLDER = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#eef2f7"/><text x="60" y="68" text-anchor="middle" font-size="40" fill="#94a3b8">▤</text></svg>'
)
window.addEventListener('error', e => {
  const el = e.target
  if (!el || el.tagName !== 'IMG' || el.dataset.imgFallback) return
  const src = el.getAttribute('src') || ''
  if (!src || src.startsWith('data:')) return
  if (!el.dataset.imgRetry) {
    el.dataset.imgRetry = '1'
    el.dataset.imgOriginal = src
    el.src = ''
    setTimeout(() => { if (el.isConnected) el.src = src }, 300)
    return
  }
  el.dataset.imgFallback = '1'
  el.src = IMG_PLACEHOLDER
}, true)

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}
