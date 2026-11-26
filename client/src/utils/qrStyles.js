// 二维码样式选项：服务端 /api/cards/public/meta 下发为唯一真相源，本模块只做拉取+缓存+兜底，
// 不再在组件里硬编码 dot/eye 取值（避免两端各自维护一份、与服务端白名单漂移）。
import api from '../api'

// 兜底只在服务端不可用时用一次（与 CardEdit 的 materialTypes 同口径），真实清单以服务端为准。
const FALLBACK_DOTS = [
  { value: 'square', label: '普通' }, { value: 'dots', label: '大圆点' },
  { value: 'rounded', label: '圆角' }, { value: 'diamond', label: '菱形' }
]
const FALLBACK_EYES = [
  { value: 'square', label: '方正' }, { value: 'rounded', label: '圆角' },
  { value: 'circle', label: '圆形' }, { value: 'star', label: '星形' }
]
const FALLBACK_PRESETS = [
  { key: 'classic', label: '经典', swatch: '#0f172a', dot: 'square', eye: 'square', gradTo: '' },
  { key: 'dots', label: '圆点', swatch: '#2563eb', dot: 'dots', eye: 'rounded', gradTo: '' },
  { key: 'tech', label: '科技渐变', swatch: 'linear-gradient(135deg,#2563eb,#06b6d4)', dot: 'rounded', eye: 'rounded', gradTo: '#06b6d4' }
]
const FALLBACK_COLORS = [
  { key: 'ink', label: '墨黑', fg: '#0f172a', bg: '#ffffff' },
  { key: 'navy', label: '藏青', fg: '#12306b', bg: '#f2f7ff' },
  { key: 'ocean', label: '经典蓝', fg: '#1e3a8a', bg: '#eff6ff' },
  { key: 'tang', label: '唐红', fg: '#7a1e15', bg: '#fdf5f5' }
]

let cache = null
let pending = null

export async function loadQrStyles() {
  if (cache) return cache
  if (pending) return pending
  pending = (async () => {
    try {
      const { data } = await api.get('/api/cards/public/meta?t=' + Date.now())
      const m = data?.data || {}
      cache = {
        dots: Array.isArray(m.qrDotStyles) && m.qrDotStyles.length ? m.qrDotStyles : FALLBACK_DOTS,
        eyes: Array.isArray(m.qrEyeStyles) && m.qrEyeStyles.length ? m.qrEyeStyles : FALLBACK_EYES,
        presets: Array.isArray(m.qrPresets) && m.qrPresets.length ? m.qrPresets : FALLBACK_PRESETS,
        colors: Array.isArray(m.qrColors) && m.qrColors.length ? m.qrColors : FALLBACK_COLORS
      }
    } catch {
      cache = { dots: FALLBACK_DOTS, eyes: FALLBACK_EYES, presets: FALLBACK_PRESETS, colors: FALLBACK_COLORS }
    } finally { pending = null }
    return cache
  })()
  return pending
}

export function qrStylesSync() { return cache }
