import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import api from './api'
import { ensureSiteConfig } from './store'
import './styles/global.css'
import './styles/desktop.css'
// 模板缩略图配色唯一真相源：CardEdit / CardStyle 共用；全局引入保证配色风格页打开就有色块
import './styles/template-thumbs.css'

createApp(App).use(router).mount('#app')
ensureSiteConfig(api)

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
