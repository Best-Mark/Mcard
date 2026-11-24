// 通知统一出口：所有站内通知都从这里写，避免各处散落 INSERT。
const db = require('../db')
const { NOTIFY_TYPES } = require('../utils/constants')

// 单条写入。link 为前端路由（如 /c/slug、/me/contacts），前端点击可跳转。
function push(userId, type, title, body, link = '', cardId = null) {
  if (!userId) return null
  const r = db.prepare(`INSERT INTO notifications (user_id, type, card_id, title, body, link)
    VALUES (?,?,?,?,?,?)`).run(userId, type, cardId, String(title || '').slice(0, 80),
    String(body || '').slice(0, 200), String(link || '').slice(0, 200))
  return Number(r.lastInsertRowid)
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
  const body = `你关注的名片「${card.name || '未命名'}」更新了：${summary}`
  let sent = 0
  for (const w of watchers) {
    if (w.user_id === card.user_id) continue
    push(w.user_id, NOTIFY_TYPES.CARD_UPDATE, '名片有更新', body, `/c/${card.slug}`, card.id)
    sent++
  }
  return sent
}

// 名片被收藏 / 被交换时提醒名片主人（节流由调用方负责，如 Exchange 本身有 UNIQUE 约束）
function notifyOwner(card, type, actorName) {
  const body = type === NOTIFY_TYPES.NEW_FAVORITE
    ? `${actorName || '有人'} 收藏了你的名片`
    : `${actorName || '有人'} 与你交换了名片`
  return push(card.user_id, type, '名片动态', body, '/me/contacts', card.id)
}

module.exports = { push, notifyCardUpdated, notifyOwner }
