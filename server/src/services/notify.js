// 通知统一出口：所有站内通知都从这里写，避免各处散落 INSERT。
// 文案模板在后台「配置中心 → 消息通知」维护（唯一真相源 settings.js NOTIFY_TEMPLATE_DEFAULTS），
// 本文件只负责渲染 {actorName}/{cardName}/{summary} 占位符并写库。
const db = require('../db')
const settings = require('../utils/settings')
const { NOTIFY_TYPES } = require('../utils/constants')

// 单条写入。link 为前端路由（如 /c/slug、/me/contacts），前端点击可跳转。
function push(userId, type, title, body, link = '', cardId = null) {
  if (!userId) return null
  const r = db.prepare(`INSERT INTO notifications (user_id, type, card_id, title, body, link)
    VALUES (?,?,?,?,?,?)`).run(userId, type, cardId, String(title || '').slice(0, 80),
    String(body || '').slice(0, 200), String(link || '').slice(0, 200))
  return Number(r.lastInsertRowid)
}

// 占位符渲染：{actorName} 操作者、{cardName} 名片名、{summary} 变更摘要。
// 未提供的变量留空，避免 undefined 漏进用户可见文案。
function render(tpl, vars = {}) {
  return String(tpl || '').replace(/\{(actorName|cardName|summary)\}/g, (_, k) => String(vars[k] ?? ''))
}

// 名片资料变更后，通知所有关注者：收藏过我名片的人 + 与我交换过名片的人（对端卡片的持有者）。
// 去重：同一 user 只通知一次；不通知自己；名额封顶防止异常数据刷屏。
const WATCHERS_SQL = `
  SELECT DISTINCT u.id AS user_id, u.nickname FROM users u WHERE u.id IN (
    SELECT f.user_id FROM card_favorites f WHERE f.card_id = ?
    UNION
    SELECT c2.user_id FROM card_exchanges e
      JOIN cards c1 ON c1.id = e.from_card_id
      JOIN cards c2 ON c2.id = e.to_card_id
      WHERE e.from_card_id = ?
    UNION
    SELECT c1.user_id FROM card_exchanges e
      JOIN cards c1 ON c1.id = e.from_card_id
      JOIN cards c2 ON c2.id = e.to_card_id
      WHERE e.to_card_id = ?
  ) LIMIT 200`

function notifyCardUpdated(card, changedLabels) {
  const watchers = db.prepare(WATCHERS_SQL).all(card.id, card.id, card.id)
  const summary = changedLabels.slice(0, 3).join('、') + (changedLabels.length > 3 ? ' 等' : '')
  const t = settings.notifyView()
  const title = render(t.notify_update_title, { cardName: card.name })
  const body = render(t.notify_update_body, { cardName: card.name || '未命名', summary })
  let sent = 0
  for (const w of watchers) {
    if (w.user_id === card.user_id) continue
    push(w.user_id, NOTIFY_TYPES.CARD_UPDATE, title, body, `/c/${card.slug}`, card.id)
    sent++
  }
  return sent
}

// 名片被收藏 / 被交换时提醒名片主人（节流由调用方负责，如 Exchange 本身有 UNIQUE 约束）
function notifyOwner(card, type, actorName) {
  const t = settings.notifyView()
  const isFav = type === NOTIFY_TYPES.NEW_FAVORITE
  const title = render(isFav ? t.notify_favorite_title : t.notify_exchange_title, { actorName })
  const body = render(isFav ? t.notify_favorite_body : t.notify_exchange_body, { actorName: actorName || '有人' })
  return push(card.user_id, type, title, body, '/me/contacts', card.id)
}

// 有人查看了我的名片：仅登录访客访问他人名片时触发（匿名浏览无法识别身份）；
// 同一访客同一名片 24 小时内只提醒一次，避免刷新/重复打开刷屏。可在后台关闭。
const VIEW_DEDUP_HOURS = 24
function notifyViewed(card, viewer) {
  if (!card || !viewer || viewer.id === card.user_id) return null
  const t = settings.notifyView()
  if (t.notify_view_enabled === 'false') return null
  const since = new Date(Date.now() - VIEW_DEDUP_HOURS * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19)
  const dup = db.prepare(`SELECT 1 FROM notifications WHERE user_id=? AND type=? AND card_id=? AND created_at>=? LIMIT 1`)
    .get(card.user_id, NOTIFY_TYPES.NEW_VIEW, card.id, since)
  if (dup) return null
  const actorName = viewer.nickname || viewer.phone || '有人'
  const title = render(t.notify_view_title, { actorName, cardName: card.name })
  const body = render(t.notify_view_body, { actorName, cardName: card.name || '你的名片' })
  return push(card.user_id, NOTIFY_TYPES.NEW_VIEW, title, body, '/me/notifications', card.id)
}

module.exports = { push, notifyCardUpdated, notifyOwner, notifyViewed }
