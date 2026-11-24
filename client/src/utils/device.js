// 设备形态判断：PC 桌面 vs H5 移动。
// 铁律：以 H5 移动端自适应为基础，PC 是「条件挂载的桌面壳 + 宽屏多栏覆盖样式」，
// 不走独立入口/独立产物，也不改小程序（uni-app 原生工程与 client 完全分离）。
// 判断用 matchMedia(宽度 + 精确指针) 而非纯 UA：兼容平板、窗口缩放、横竖屏切换，响应式实时跟随。
import { ref } from 'vue'

const DESKTOP_QUERY = '(min-width: 1024px) and (pointer: fine)'
const mq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(DESKTOP_QUERY) : null
export const isPC = ref(!!(mq?.matches))

if (mq) {
  const onChange = e => { isPC.value = e.matches }
  if (mq.addEventListener) mq.addEventListener('change', onChange)
  else if (mq.addListener) mq.addListener(onChange) // 老 WebView 兜底
}

// 供需要在非浏览器环境判断的场景（SSR/测试），返回当前快照
export function currentIsPC() { return isPC.value }
