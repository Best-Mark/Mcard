import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'

export default defineConfig({
  plugins: [vue()],
  base: '/',
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // 兼容：微信内置浏览器（老 X5/WebView）不支持过新语法，显式降 target 让 Vite 转译可选链/空值合并等
    target: 'es2018',
    cssTarget: 'chrome61',
    rollupOptions: { output: { manualChunks: { vue: ['vue', 'vue-router', 'axios'] } } }
  },
  resolve: { alias: { '@': path.resolve(process.cwd(), 'src') } }
})
