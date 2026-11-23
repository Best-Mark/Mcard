import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import api from './api'
import { loadSiteConfig } from './store'
import './styles/global.css'

createApp(App).use(router).mount('#app')
loadSiteConfig(api)

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}
