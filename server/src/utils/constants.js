// 资料夹类型、访客来源、通知类型的唯一真相源。
// 前端通过 GET /api/cards/public/meta 拉取 materialTypes / sources，不各自硬编码 key。

// 名片资料夹条目类型：link=网页链接，file=文件/图片资料
const MATERIAL_TYPES = [
  { key: 'link', label: '网页链接', hint: '产品页 / 作品集 / 公众号文章' },
  { key: 'file', label: '文件资料', hint: '产品手册 / 报价单 / 图片' }
]
const MATERIAL_TYPE_KEYS = MATERIAL_TYPES.map(t => t.key)
const isMaterialType = v => MATERIAL_TYPE_KEYS.includes(String(v || ''))

// 访客来源渠道：写入 card_views.source。二维码本身内容恒为 /c/{slug}（微信可扫），
// 来源靠 query.src（分享/集市链接额外带，不改二维码）+ referer 兜底推断。
const VISIT_SOURCES = [
  { key: 'qr', label: '扫码进入' },
  { key: 'market', label: '名片集市' },
  { key: 'share', label: '好友分享' },
  { key: 'search', label: '搜索引擎' },
  { key: 'direct', label: '直接访问' }
]
const VISIT_SOURCE_KEYS = VISIT_SOURCES.map(s => s.key)
const isVisitSource = v => VISIT_SOURCE_KEYS.includes(String(v || ''))

// 通知类型
const NOTIFY_TYPES = {
  CARD_UPDATE: 'card_update',     // 关注的名片资料有更新
  NEW_FAVORITE: 'new_favorite',   // 我的名片被收藏
  NEW_EXCHANGE: 'new_exchange',   // 我的名片被交换
  NEW_VIEW: 'new_view',           // 我的名片被浏览（可按 later 节流，默认不写以免打扰）
  PLAN_EXPIRED: 'plan_expired'    // 套餐到期：名片重置（停用高级功能、集市下架），planExpiry 任务发出
}
const NOTIFY_TYPE_KEYS = Object.values(NOTIFY_TYPES)

// 触发「名片更新提醒」的关键字段：这些字段变更才通知关注者，纯配色/二维码样式变更不打扰
const CARD_WATCH_FIELDS = [
  'name', 'name_en', 'title', 'company', 'company_intro', 'department',
  'mobile', 'phone', 'email', 'wechat', 'whatsapp',
  'address', 'address_detail', 'province', 'city', 'district', 'street',
  'website', 'shop_url', 'bio', 'industry'
]

module.exports = {
  MATERIAL_TYPES, MATERIAL_TYPE_KEYS, isMaterialType,
  VISIT_SOURCES, VISIT_SOURCE_KEYS, isVisitSource,
  NOTIFY_TYPES, NOTIFY_TYPE_KEYS, CARD_WATCH_FIELDS
}
