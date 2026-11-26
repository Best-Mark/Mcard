// 导航唯一真相源：H5 底部 tab / 抽屉 与 PC 侧栏共用同一份菜单定义。
// 两端只负责「怎么跳转」，菜单项本身（文案/图标/分组/目标）在此一处定义。
// kind: route=站内跳转；public=打开自己公开名片（query 可为 ?save=1 = 弹名片二维码大图）；share=分享名片；logout=退出登录。
// path 可带 ?focus=xxx，由 CardEdit.vue 的 applyFocus 响应（模板与配色等子页）。
// icon 一律填 client/src/utils/icons.js 的 FUNC_ICONS 名称：整套 Lucide 描边风格，
// 禁止在这里写 emoji 或特殊字符（彩色 emoji 会破坏导航统一观感，且不同系统渲染不一致）。

export const BOTTOM_TABS = [
  { path: '/me', label: '名片', icon: 'card', exact: true },
  { path: '/me/contacts', label: '名片夹', icon: 'contacts', exact: false },
  { path: '/market', label: '集市', icon: 'compass', exact: true, feature: true },
  { path: '/me/notifications', label: '消息', icon: 'bell', exact: false },
  { path: '/me/profile', label: '我的', icon: 'user', exact: false }
]
// 统计从底部移除，仍保留在抽屉「我的」组（入口不丢）；集市保持正中凸起位。

// 抽屉只放「底部 tab / 当前页 / 我的页」都够不着、或需要跨页快速可达的入口。
// 2026-11-25 用户定稿：原 17 项太长且大量重复（我的名片/集市/消息/名片夹/账户信息在底部 tab；
// 分享/二维码在工作台顶部；公开页/编辑/配色/连扫/统计/套餐/实体版式在「我的」页），全部从抽屉移除。
// 页面入口不变，只是抽屉收敛——PC 侧栏另有自己的固定导航，不依赖本分组。
export const DRAWER_GROUPS = [
  {
    title: '快捷',
    items: [
      { label: '分享名片', icon: 'share', kind: 'share' },
      { label: '浏览统计 / 订单', icon: 'chart', kind: 'route', path: '/me/stats' },
      { label: '我的套餐', icon: 'gem', kind: 'route', path: '/me/plans' },
      { label: '收款账户', icon: 'wallet', kind: 'route', path: '/me/withdraw-account', promoter: true }
    ]
  },
  {
    title: '账户',
    items: [
      { label: '退出登录', icon: 'logout', kind: 'logout', danger: true }
    ]
  }
]

// 动作映射：把 nav 项交给调用方统一处理，两端逻辑一致（都在各自组件实现 go/goPublic/doShare/logoutNow）
export function runNavItem(item, handlers) {
  if (!item) return
  if (item.kind === 'route') return handlers.go(item.path)
  if (item.kind === 'public') return handlers.goPublic(item.query || '')
  if (item.kind === 'share') return handlers.doShare()
  if (item.kind === 'logout') return handlers.logoutNow()
}
