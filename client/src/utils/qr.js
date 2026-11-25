// 扫码主场景二维码 URL 唯一真相源：纠错等级/静音区/去 LOGO 等渲染逻辑升级时，
// 必须同步升级 SCAN_V（client 端一处 + miniapp/src/utils/request.js 一处，两端约定同号），
// 用新 query 击穿 CDN/浏览器对旧 code 图案的缓存。
// 历史坑：2026-11-25 服务端已把 scan 改成无 LOGO+M 纠错，但固定 URL 被 CDN 缓存 max-age=3600，
// 用户一小时内仍扫到带 LOGO 的旧码，误以为「改了没用」。
export const SCAN_V = 2

export function scanQrUrl(slug, ext, size) {
  return `/api/cards/public/${slug}/${ext}?size=${size}&scan=1&qv=${SCAN_V}`
}
