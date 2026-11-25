// 导航唯一真相源：H5 底部 tab / 抽屉 与 PC 侧栏共用同一份菜单定义。
// 两端只负责「怎么跳转」，菜单项本身（文案/图标/分组/目标）在此一处定义。
// kind: route=站内跳转；public=打开自己公开名片（query 可为 ?save=1 = 弹名片二维码大图）；share=分享名片；logout=退出登录。
// path 可带 ?focus=xxx，由 CardEdit.vue 的 applyFocus 响应（模板与配色等子页）。

export const BOTTOM_TABS = [
  { path: '/me', label: '名片', ico: '▤', exact: true },
  { path: '/me/stats', label: '统计', ico: '📊', exact: false },
  { path: '/market', label: '集市', ico: '⌕', exact: true, feature: true },
  { path: '/me/contacts', label: '名片夹', ico: '▤', exact: false },
  { path: '/me/profile', label: '我的', ico: '◉', exact: false }
]

export const DRAWER_GROUPS = [
  {
    title: '名片',
    items: [
      { label: '我的名片', ico: '▤', kind: 'route', path: '/me' },
      { label: '公开名片页', ico: '↗', kind: 'public', query: '' },
      { label: '我的名片二维码', ico: '▦', kind: 'public', query: '?save=1' },
      { label: '名片集市', ico: '⌕', kind: 'route', path: '/market' },
      { label: '分享名片', ico: '↗', kind: 'share' }
    ]
  },
  {
    title: '资料',
    items: [
      { label: '编辑资料', ico: '✎', kind: 'route', path: '/me/card' },
      { label: '配色风格', ico: '🎨', kind: 'route', path: '/me/card/style' },
      { label: '完善资料', ico: '📝', kind: 'route', path: '/me/card?focus=bio' },
      { label: '相册（图片/作品）', ico: '📚', kind: 'route', path: '/me/card?focus=materials' },
      { label: '实体名片版式', ico: '🖨', kind: 'route', path: '/me/print' }
    ]
  },
  {
    title: '我的',
    items: [
      { label: '消息通知', ico: '🔔', kind: 'route', path: '/me/notifications', badge: 'unread' },
      { label: '账户信息', ico: '◉', kind: 'route', path: '/me/profile' },
      { label: '我的名片夹', ico: '▤', kind: 'route', path: '/me/contacts' },
      { label: '展会连扫收名片', ico: '📷', kind: 'route', path: '/me/batch-scan' },
      { label: '浏览统计 / 订单', ico: '📊', kind: 'route', path: '/me/stats' },
      { label: '套餐 / 续期', ico: '💎', kind: 'route', path: '/me/plans' },
      { label: '退出登录', ico: '⏻', kind: 'logout', danger: true }
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
