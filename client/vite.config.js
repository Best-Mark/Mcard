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
    rollupOptions: { output: { manualChunks: { vue: ['vue', 'vue-router', 'axios'] } } }
  },
  resolve: { alias: { '@': path.resolve(process.cwd(), 'src') } }
})
