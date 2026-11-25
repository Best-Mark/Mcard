// 分享素材池：标题 / 描述 / 图片三个池，缺哪样随机补哪样（对齐 MShop 的分享池兜底逻辑）。
// 唯一真相源 = server/src/utils/settings.js 的 SHARE_POOL_DEFAULTS + 后台「配置中心 → 分享素材池」，
// 前端只消费 /api/public/config 下发的 share_title / share_desc / share_image，不再硬编码文案。
// siteConfig 由 main.js 启动时 loadSiteConfig() 拉取；分享兜底在路由后 900ms 触发，届时通常已就绪。
import { siteConfig } from '../store'

const POOL_MAX = 10
const toPool = v => (Array.isArray(v) ? v : v ? [v] : [])
  .map(s => String(s || '').trim()).filter(Boolean).slice(0, POOL_MAX)

// 读取素材池：后台有值用后台的，空值回落内置默认（服务端 publicView 已保证下发默认池）。
// 这里再兜一层空数组，避免接口尚未回来时 scheduleDefaultShare 拿到 undefined。
export function sharePools() {
  return {
    titles: toPool(siteConfig.share_title),
    descs: toPool(siteConfig.share_desc),
    images: toPool(siteConfig.share_image)
  }
}

// 池空返回空串，调用方据此决定是否跳过该字段（如图片不传则微信自己取页面首图）。
export function pick(pool) {
  const arr = Array.isArray(pool) ? pool : []
  return arr.length ? arr[Math.floor(Math.random() * arr.length)] : ''
}

export function pickSharePiece(kind) {
  const key = { title: 'titles', desc: 'descs', image: 'images' }[kind]
  return key ? pick(sharePools()[key]) : ''
}
