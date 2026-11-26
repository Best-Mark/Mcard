// 扫码主场景二维码 URL 唯一真相源：纠错等级/静音区/去 LOGO 等渲染逻辑升级时，
// 必须同步升级 SCAN_V（client 端一处 + miniapp/src/utils/request.js 一处，两端约定同号），
// 用新 query 击穿 CDN/浏览器对旧 code 图案的缓存。
// 历史坑：2026-11-25 服务端已把 scan 改成无 LOGO+M 纠错，但固定 URL 被 CDN 缓存 max-age=3600，
// 用户一小时内仍扫到带 LOGO 的旧码，误以为「改了没用」。
// 【铁律 2026-11-26】给用户长按识别/保存的二维码一律用 png，禁止用 svg：
// 微信「识别图中二维码」只识别 PNG/JPG 位图，SVG 在长按菜单里根本不出现该选项（截图实锤），
// 这正是用户觉得「微信不容易扫」的观感来源。编辑预览的小装饰码（改色即时生效）才允许 SVG。
export const SCAN_V = 4

export function scanQrUrl(slug, ext, size) {
  return `/api/cards/public/${slug}/${ext}?size=${size}&scan=1&qv=${SCAN_V}`
}
