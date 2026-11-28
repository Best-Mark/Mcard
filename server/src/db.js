const Database = require('better-sqlite3')
const bcrypt = require('bcryptjs')
const fs = require('fs')
const path = require('path')
const config = require('./config')

fs.mkdirSync(config.DATA_DIR, { recursive: true })
fs.mkdirSync(config.UPLOAD_DIR, { recursive: true })

const db = new Database(config.DB_FILE)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  nickname TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  name_en TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  company_intro TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  mobile TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  wechat TEXT NOT NULL DEFAULT '',
  alipay TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL DEFAULT '',
  wechat_qr TEXT NOT NULL DEFAULT '',
  alipay_qr TEXT NOT NULL DEFAULT '',
  wechat_pay_qr TEXT NOT NULL DEFAULT '',
  alipay_pay_qr TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  address_detail TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  shop_url TEXT NOT NULL DEFAULT '',
  avatar TEXT NOT NULL DEFAULT '',
  cover TEXT NOT NULL DEFAULT '',
  logo TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  links TEXT NOT NULL DEFAULT '[]',
  template TEXT NOT NULL DEFAULT 'contact',
  industry TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  latitude REAL,
  longitude REAL,
  market_opt_in INTEGER NOT NULL DEFAULT 0,
  theme TEXT NOT NULL DEFAULT 'ocean',
  accent TEXT NOT NULL DEFAULT '#2563eb',
  qr_fg TEXT NOT NULL DEFAULT '#0f172a',
  qr_bg TEXT NOT NULL DEFAULT '#ffffff',
  qr_logo INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  expires_at TEXT,
  views INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_cards_status ON cards(status);
`)

// 存量库补列（CREATE TABLE IF NOT EXISTS 不会修改已有表结构）
function addColumnIfMissing(table, column, definition) {
  const exists = db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === column)
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
}
// 推广/分销：账户层字段（与后台 role 彻底独立，推广员是 C 端用户身份，不授予任何后台权限）
// is_promoter 仅由后台「用户管理」开关；invited_by 注册时一次性绑定不可更改（邀请归因零丢失）；
// invite_code 是推广员的专属短码；balance_cents 是可提现佣金余额（分）。
for (const [col, def] of [
  ['is_promoter', 'INTEGER NOT NULL DEFAULT 0'],
  ['invited_by', 'INTEGER'],
  ['invite_code', "TEXT NOT NULL DEFAULT ''"],
  ['balance_cents', 'INTEGER NOT NULL DEFAULT 0'],
  // 赠送套餐时长待兑现天数（注册即送 PRO / 邀请返时长，未建卡先记账，建卡时由 services/plan.js consumeCredit 兑现）
  ['plan_credit_days', 'INTEGER NOT NULL DEFAULT 0']
]) addColumnIfMissing('users', col, def)
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_invite_code ON users(invite_code) WHERE invite_code <> '';`)
db.exec(`CREATE INDEX IF NOT EXISTS idx_users_invited_by ON users(invited_by);`)
addColumnIfMissing('cards', 'company_intro', "TEXT NOT NULL DEFAULT ''")
for (const col of ['alipay', 'wechat_qr', 'alipay_qr', 'wechat_pay_qr', 'alipay_pay_qr', 'shop_url']) {
  addColumnIfMissing('cards', col, "TEXT NOT NULL DEFAULT ''")
}
// 收款码图内解码出的原始付款链接（派生列）：只由保存收款码时与启动自愈回填写入，接口不接受用户直写；
// 扫合一码落地页按支付环境拿它直接调起支付（wxp://、qr.alipay.com 等），跳不起来回落收款码图「保存 → 扫一扫」。
for (const col of ['wechat_pay_link', 'alipay_pay_link']) {
  addColumnIfMissing('cards', col, "TEXT NOT NULL DEFAULT ''")
}
// 布局模板（与配色 theme 分离）：存量库补列默认简洁联络卡 contact
addColumnIfMissing('cards', 'template', "TEXT NOT NULL DEFAULT 'contact'")
// 名片集市：存量名片默认不上架、无坐标（保护隐私，需用户主动 opt-in）
for (const [col, def] of [
  ['industry', "TEXT NOT NULL DEFAULT ''"],
  ['city', "TEXT NOT NULL DEFAULT ''"],
  ['latitude', 'REAL'],
  ['longitude', 'REAL'],
  ['market_opt_in', 'INTEGER NOT NULL DEFAULT 0']
]) addColumnIfMissing('cards', col, def)
// 四级行政区划地址（省/市/区/街道）：city 仍保留作兼容短名，新增结构化字段
for (const [col, def] of [
  ['province', "TEXT NOT NULL DEFAULT ''"],
  ['district', "TEXT NOT NULL DEFAULT ''"],
  ['street', "TEXT NOT NULL DEFAULT ''"]
]) addColumnIfMissing('cards', col, def)
db.exec('CREATE INDEX IF NOT EXISTS idx_cards_market ON cards(market_opt_in, status, industry);')
db.exec('CREATE INDEX IF NOT EXISTS idx_cards_region ON cards(province, city, district);')
// 自愈：存量名片若已主动上架（market_opt_in=1）却仍是 draft，集市 SQL 永远查不到。
// 启动时一次性激活这些名片，确保「显示已上架 = 集市可见」。
db.prepare("UPDATE cards SET status = 'active', updated_at = datetime('now') WHERE market_opt_in = 1 AND status = 'draft'").run()

// 微信网页授权登录：openid/unionid 用于免密识别，头像来自微信，auth_source 记录账号来源
for (const [col, def] of [
  ['wx_openid', "TEXT NOT NULL DEFAULT ''"],
  ['wx_unionid', "TEXT NOT NULL DEFAULT ''"],
  ['avatar', "TEXT NOT NULL DEFAULT ''"],
  ['auth_source', "TEXT NOT NULL DEFAULT 'password'"],
  // 微信头像原值留存：作「是否仍是默认」判定基准（avatar 仍等于 wx_avatar 即未自定义，登录时刷新默认头像）
  ['wx_avatar', "TEXT NOT NULL DEFAULT ''"],
  // 微信昵称原值留存：同作默认判定（nickname 等于 wx_nickname 或「微信用户」占位即未自定义）；
  // NULL = 已自定义（PUT /profile 保存后置 NULL）或历史未知，登录不再跟随微信昵称。
  ['wx_nickname', 'TEXT'],
  // 收款账户（JSON，唯一真相源）：wechat/alipay/bank 各自一份，defaultType 记默认账户。
  // 微信账户只存服务端授权拿到的 openid，绝不信任前端传值。
  ['withdraw_accounts', "TEXT NOT NULL DEFAULT ''"]
]) addColumnIfMissing('users', col, def)
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_wx_openid ON users(wx_openid) WHERE wx_openid <> '';`)
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_wx_unionid ON users(wx_unionid) WHERE wx_unionid <> '';`)

db.exec(`
CREATE TABLE IF NOT EXISTS packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL,
  duration_days INTEGER NOT NULL,
  features TEXT NOT NULL DEFAULT '[]',
  sort INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL,
  card_id INTEGER,
  package_id INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT NOT NULL DEFAULT 'wechat',
  pay_no TEXT NOT NULL DEFAULT '',
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

CREATE TABLE IF NOT EXISTS card_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL,
  ip TEXT NOT NULL DEFAULT '',
  ua TEXT NOT NULL DEFAULT '',
  referer TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_views_card ON card_views(card_id);

CREATE TABLE IF NOT EXISTS card_exchanges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_card_id INTEGER NOT NULL,
  to_card_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(from_card_id, to_card_id)
);

CREATE TABLE IF NOT EXISTS card_favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  card_id INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, card_id)
);

-- 名片资料夹：产品册/作品/链接，分享时每份都带名片落款二维码（内容仍是 /c/{slug} URL，微信可扫）
CREATE TABLE IF NOT EXISTS card_materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'link',
  title TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_materials_card ON card_materials(card_id, sort);

-- 通知：名片资料变更提醒、系统消息（唯一真相源，前端只读展示）
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT '',
  card_id INTEGER,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '',
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read, id);

-- 名片资料快照：仅保存用于「变更提醒」比对的字段，避免全量存库
CREATE TABLE IF NOT EXISTS card_snapshots (
  card_id INTEGER PRIMARY KEY,
  fields TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- H5 宣传页（2026-11-27 新模块）：JSON schema 驱动（pages→blocks），名片附属营销页，
-- 公开访问 /h5/:slug；套餐权益分层：免费 1 个/≤3 页带尾页水印，付费 10 个/≤12 页可去水印。
CREATE TABLE IF NOT EXISTS h5_pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  card_id INTEGER,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  schema TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_h5_user ON h5_pages(user_id, id);

-- H5 表单留资（2026-11-27 表单留资块）：宣传页访客提交的线索（姓名/电话/留言），
-- 归属 h5_pages，页主在宣传页管理里查看；匿名提交、软鉴权读取。
CREATE TABLE IF NOT EXISTS h5_leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_h5_leads_page ON h5_leads(page_id, id);

CREATE TABLE IF NOT EXISTS site_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 四级行政区划：level 1=省 2=市 3=区/县 4=街道/乡镇；code 为路径编码便于级联
CREATE TABLE IF NOT EXISTS regions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  parent_code TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  level INTEGER NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_regions_parent ON regions(parent_code, level);

-- 历史遗留的图片素材库表：2026-11-26 起所有图片入口改为独立上传，素材库功能已下线。
-- 表保留仅为存量库兼容（不删数据、不重建），新代码不得再读写它。
CREATE TABLE IF NOT EXISTS user_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'image',
  size INTEGER NOT NULL DEFAULT 0,
  width INTEGER NOT NULL DEFAULT 0,
  height INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_user_assets_user ON user_assets(user_id, created_at);

-- 推广佣金流水：首单奖 + 被邀请人每笔消费的返佣，逐笔留痕（唯一真相源）。
-- promoter_id=拿佣金的人；invitee_id=带来收益的下线用户；order_id=对应订单。
-- type: first_order=首次开通套餐的百分比奖（一生一次）；order=每单返佣（可叠加）；register=旧固定注册奖（仅历史展示，不再新发）。
-- 幂等键 uniq_promo_order 保证同一订单的每单返佣只发一次（支付回调/补单/查单重入都安全）。
CREATE TABLE IF NOT EXISTS commissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  promoter_id INTEGER NOT NULL,
  invitee_id INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'order',
  order_id INTEGER,
  amount_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_comm_promoter ON commissions(promoter_id, id);
-- 【2026-11-27 多级分销迁移】唯一键从 (order_id) 放宽为 (order_id, promoter_id)：
-- 多级分销下同一订单要给邀请链上 2~3 个不同上级各记一笔（每级一行），同订单同推广员仍只允许一笔，
-- 重入（支付回调/补单/查单）幂等性不变。旧索引必须显式 DROP 再重建，IF NOT EXISTS 不会改已有索引结构。
DROP INDEX IF EXISTS uniq_promo_order;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_promo_order ON commissions(order_id, promoter_id) WHERE order_id IS NOT NULL;
-- 首单奖幂等：每个被邀请人一生只发一次首单奖（重复支付/回调重入不会重复发）。
-- 首单奖 order_id 为 NULL（与旧注册奖同构），避免与同一订单的每单返佣共撞 uniq_promo_order；
-- 触发订单号记在 balance_logs.note，可追溯。金额按首笔成功订单金额 × 首单奖比例结算。
CREATE UNIQUE INDEX IF NOT EXISTS uniq_promo_first_order ON commissions(invitee_id) WHERE type = 'first_order';
-- 旧注册奖唯一索引保留：存量 register 记录仍受约束、可展示；新逻辑不再写入该 type。
CREATE UNIQUE INDEX IF NOT EXISTS uniq_promo_register ON commissions(invitee_id) WHERE type = 'register';
CREATE INDEX IF NOT EXISTS idx_comm_invitee ON commissions(invitee_id, type);

-- 提现单：推广员把佣金余额提现，状态 pending/paid/rejected，后台审核。
CREATE TABLE IF NOT EXISTS withdrawals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  channel TEXT NOT NULL DEFAULT '',
  account TEXT NOT NULL DEFAULT '',
  remark TEXT NOT NULL DEFAULT '',
  admin_note TEXT NOT NULL DEFAULT '',
  handled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_withdraw_user ON withdrawals(user_id, id);
CREATE INDEX IF NOT EXISTS idx_withdraw_status ON withdrawals(status, id);

-- 佣金余额流水：唯一真相源。佣金发放/提现扣减/驳回返还逐笔留痕，可对账可追溯。
CREATE TABLE IF NOT EXISTS balance_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  ref_type TEXT NOT NULL DEFAULT '',
  ref_id INTEGER,
  after_cents INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_balance_user ON balance_logs(user_id, id);
`)

// 提现幂等键：存量库补列（必须在建表 exec 之后），随后建唯一索引
addColumnIfMissing('withdrawals', 'idempotency_key', "TEXT NOT NULL DEFAULT ''")
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_withdraw_idem ON withdrawals(idempotency_key) WHERE idempotency_key <> '';`)
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_balance_ref ON balance_logs(ref_type, ref_id) WHERE ref_type IN ('commission_order','commission_register','withdraw_reject');`)
// 首单奖流水：存量 uniq_balance_ref 定义不含该 ref_type 且 IF NOT EXISTS 不会重建，单列一条保证同一 commission 只记一次流水
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_balance_first_order ON balance_logs(ref_id) WHERE ref_type = 'commission_first_order';`)

// 访客画像/来源分析 + 名片夹打标：存量库补列（自愈，CREATE TABLE IF NOT EXISTS 不改老表）
// 必须放在上面的建表 exec 之后——card_views/card_favorites 表此时才存在
addColumnIfMissing('card_views', 'source', "TEXT NOT NULL DEFAULT ''")
addColumnIfMissing('card_views', 'city', "TEXT NOT NULL DEFAULT ''")
addColumnIfMissing('card_favorites', 'note', "TEXT NOT NULL DEFAULT ''")
addColumnIfMissing('card_favorites', 'tags', "TEXT NOT NULL DEFAULT '[]'")
// 草料式二维码美化样式（JSON：dot/eye/gradTo/logoShape/bgImage），空串=经典样式
addColumnIfMissing('cards', 'qr_style', "TEXT NOT NULL DEFAULT ''")
// 宣传页关联名片开关（2026-11-27 一对多定稿）：card_linked=1 且已发布的宣传页在名片公开页出入口
addColumnIfMissing('h5_pages', 'card_linked', 'INTEGER NOT NULL DEFAULT 0')
// 草稿/线上双版本（2026-11-28 用户定稿「编辑不自动上架，点上架才上架」）：编辑只写 schema（草稿），
// 点上架才把草稿复制进 live_schema；公开页已发布态读 live_schema（NULL 时回落 schema 兼容存量行）。
addColumnIfMissing('h5_pages', 'live_schema', 'TEXT')
// 索引依赖补列后的字段，必须放在 addColumnIfMissing 之后（存量库 source 列此时才存在）
db.exec('CREATE INDEX IF NOT EXISTS idx_views_source ON card_views(card_id, source);')

// ---------------- 种子数据 ----------------
const seedPackages = [
  { name: '体验卡', description: '7 天试用，完整功能', price_cents: 100, duration_days: 7, features: JSON.stringify(['全部模板', '永久二维码', '一键存通讯录', '实体名片版式下载']), sort: 1 },
  { name: '月度会员', description: '30 天，持续展示', price_cents: 1900, duration_days: 30, features: JSON.stringify(['全部模板', '永久二维码', '一键存通讯录', '实体名片版式下载', '访问数据统计']), sort: 2 },
  { name: '季度会员', description: '90 天，推荐之选', price_cents: 4900, duration_days: 90, features: JSON.stringify(['全部模板', '永久二维码', '一键存通讯录', '实体名片版式下载', '访问数据统计', '交换名片']), sort: 3 },
  { name: '年度会员', description: '365 天，长期商务首选', price_cents: 9900, duration_days: 365, features: JSON.stringify(['全部模板', '永久二维码', '一键存通讯录', '实体名片版式下载', '访问数据统计', '交换名片', '自定义主题']), sort: 4 }
  // 终身套餐已下架（2026-11-28 用户定稿「终身不合现金流，砍掉不再使用」）：种子不再收录；
  // 存量 duration_days=0 行由下方自愈置 enabled=0 停售，已购终身用户由 activateOrder 防降级分支护住不受影响。
]
// 自愈但幂等：用标记键做种子，避免运营删光套餐/降级管理员后下次启动被「复活」
const insertSeedFlag = db.prepare("INSERT OR IGNORE INTO site_config (key, value) VALUES (?, ?)")
const seeded = key => !!db.prepare('SELECT 1 FROM site_config WHERE key = ?').get(key)

// 一次性迁移（2026-11-26）：中心 LOGO 由「固定常显」改为「默认关、可选开」。
// 旧版 qr_logo 从不允许用户关（卡片设置页强制开），存量全是 1；真机实测中心 LOGO 强制 H 纠错+
// 遮挡数据区是识别率头号杀手。用标记键只跑一次，把存量统一关掉；此后用户主动开不会再被重置。
if (!seeded('qr_logo_default_off_v1')) {
  db.transaction(() => {
    db.prepare('UPDATE cards SET qr_logo = 0').run()
    insertSeedFlag.run('qr_logo_default_off_v1', '1')
  })()
}

// 一次性迁移（2026-11-27）：宣传页↔名片关联从「自动挂最新一条已发布」改为显式开关 card_linked（一对多）。
// 存量已发布的宣传页回填 card_linked=1，保持既有入口不消失；此后关联/取消都在宣传页侧操作，不再被重置。
if (!seeded('h5_card_linked_backfill_v1')) {
  db.transaction(() => {
    db.prepare("UPDATE h5_pages SET card_linked = 1 WHERE status = 'published'").run()
    insertSeedFlag.run('h5_card_linked_backfill_v1', '1')
  })()
}

// 一次性自愈（2026-11-28）：收款码付款链接派生列回填。该列上线前已传码的存量图在链空，
// 启动后异步解码补齐（不阻塞启动）。逐行幂等：已回填的行自动跳过；任一行失败就不打标记，
// 下次启动重试，最坏情况留空也只是回落收款码原图「保存 → 扫一扫」手动付款，不影响主流程。
if (!seeded('pay_link_backfill_v1')) {
  ;(async () => {
    try {
      const { readPayQr, safePayLink } = require('./services/payQr')
      const rows = db.prepare(`SELECT id, wechat_pay_qr, alipay_pay_qr, wechat_pay_link, alipay_pay_link FROM cards
        WHERE (wechat_pay_qr <> '' AND wechat_pay_link = '') OR (alipay_pay_qr <> '' AND alipay_pay_link = '')`).all()
      const upd = db.prepare('UPDATE cards SET wechat_pay_link = ?, alipay_pay_link = ? WHERE id = ?')
      let failed = 0
      for (const r of rows) {
        let wl = r.wechat_pay_link || ''
        let al = r.alipay_pay_link || ''
        try {
          if (r.wechat_pay_qr && !wl) {
            const x = await readPayQr('wechat', r.wechat_pay_qr)
            wl = x.ok ? safePayLink('wechat', x.text) : ''
          }
          if (r.alipay_pay_qr && !al) {
            const x = await readPayQr('alipay', r.alipay_pay_qr)
            al = x.ok ? safePayLink('alipay', x.text) : ''
          }
          upd.run(wl, al, r.id)
        } catch (e) { failed++; console.error('[DB] 收款码付款链接回填单行失败', r.id, e.message) }
      }
      if (!failed) insertSeedFlag.run('pay_link_backfill_v1', '1')
    } catch (e) { console.error('[DB] 收款码付款链接回填失败（下次启动重试）', e.message) }
  })()
}

// 一次性迁移（2026-11-26）：模板推荐码色易扫修正的存量自愈。
// star/elite 模板旧推荐是「浅码深底」反色（相机/微信扫码引擎对深码浅底有强偏好，反色极难识别），
// 已应用过这两套配色的卡片库里存的还是反色组合。按模板翻转到新的安全配色，其余反色卡兜底到黑码白底。
// 只跑一次：此后用户在码色预设里选的都是深码浅底，不会再产生反色。
if (!seeded('qr_color_light_on_dark_v1')) {
  const lum = hex => {
    const n = parseInt(String(hex || '').replace('#', ''), 16)
    if (Number.isNaN(n)) return 0
    return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)
  }
  const SAFE = { star: ['#12121a', '#ececf2'], elite: ['#2b2417', '#f2ead9'], fallback: ['#0f172a', '#ffffff'] }
  const fix = db.prepare('UPDATE cards SET qr_fg = ?, qr_bg = ? WHERE id = ?')
  db.transaction(() => {
    for (const c of db.prepare("SELECT id, template, qr_fg, qr_bg FROM cards WHERE qr_bg <> '' AND qr_fg <> ''").all()) {
      if (lum(c.qr_bg) < lum(c.qr_fg)) { // 底比码深 = 反色，翻转
        const [fg, bg] = SAFE[c.template] || SAFE.fallback
        fix.run(fg, bg, c.id)
      }
    }
    insertSeedFlag.run('qr_color_light_on_dark_v1', '1')
  })()
}

if (!seeded('seed_packages_v1')) {
  const insert = db.prepare('INSERT INTO packages (name, description, price_cents, duration_days, features, sort) VALUES (@name,@description,@price_cents,@duration_days,@features,@sort)')
  db.transaction(rows => { rows.forEach(r => insert.run(r)); insertSeedFlag.run('seed_packages_v1', '1') })(seedPackages)
}

// 自愈补丁（2026-11-28 终身下架）：存量库里的终身套餐（duration_days=0）一律停售，每次启动幂等收敛。
// 已购终身用户不受影响（orders 记录还在，activateOrder 防降级分支护住其 active 无到期状态）。
db.prepare('UPDATE packages SET enabled = 0 WHERE duration_days = 0').run()
// 自愈去重：历史遗留的种子重复（同名+同价+同时长的套餐出现多份），每次启动幂等收敛。
// 保留每组 id 最小的一条；orders.package_id 指向被删 id 的先改指保留 id（无外键约束，安全），再删重复行。
try {
  const dupGroups = db.prepare(`SELECT name, price_cents, duration_days, MIN(id) AS keep_id, COUNT(*) AS n
    FROM packages GROUP BY name, price_cents, duration_days HAVING n > 1`).all()
  for (const g of dupGroups) {
    db.transaction(() => {
      db.prepare(`UPDATE orders SET package_id = ? WHERE package_id IN (
        SELECT id FROM packages WHERE name = ? AND price_cents = ? AND duration_days = ? AND id <> ?)`)
        .run(g.keep_id, g.name, g.price_cents, g.duration_days, g.keep_id)
      db.prepare(`DELETE FROM packages WHERE name = ? AND price_cents = ? AND duration_days = ? AND id <> ?`)
        .run(g.name, g.price_cents, g.duration_days, g.keep_id)
    })()
  }
} catch (e) { console.error('[DB] 套餐去重失败（不影响启动）', e.message) }

// 自愈：历史存量里误填的非法邮箱（如 QQ 号 100088）会让 vCard 被 iOS 通讯录判为损坏文件、
// Safari 弹「无法下载此文件」。清空非法值（正规邮箱才写进 vCard），用户可在编辑页重新填写。
try {
  db.exec(`UPDATE cards SET email = '' WHERE email <> '' AND email NOT LIKE '%@%.%'`)
} catch (e) { console.error('[DB] 非法邮箱清理失败（不影响启动）', e.message) }

if (!seeded('seed_admin_v1')) {
  db.transaction(() => {
    // 存量库若已有管理员，只打标记不重建，避免弱口令回灌
    const exists = db.prepare("SELECT 1 FROM users WHERE role IN ('admin','super_admin') LIMIT 1").get()
    if (!exists) {
      db.prepare('INSERT INTO users (phone, password_hash, nickname, role) VALUES (?,?,?,?)')
        .run(config.ADMIN_INIT_USERNAME, bcrypt.hashSync(config.ADMIN_INIT_PASSWORD, 10), '超级管理员', 'super_admin')
    }
    insertSeedFlag.run('seed_admin_v1', '1')
  })()
}

const defaults = {
  site_name: 'MCard 电子名片',
  site_desc: '一扫即存，永久有效的数字名片',
  contact: '',
  notice: '',
  qr_brand: 'MCard',
  update_auto_check: true,
  update_auto_apply: false,
  update_interval_hours: 6,
  update_repo: 'Best-Mark/Mcard',
  update_branch: 'main',
  update_last_check: '',
  update_last_result: ''
}
const insertCfg = db.prepare('INSERT OR IGNORE INTO site_config (key, value) VALUES (?,?)')
Object.entries(defaults).forEach(([k, v]) => insertCfg.run(k, JSON.stringify(v)))

// ---------------- 四级行政区划种子（幂等，版本升级即补齐） ----------------
// 自愈约定：标记键存在即跳过；后台 CRUD 后即使清空也不会被「复活」。
// ⚠️ 每次扩充 region-data.js 的城市覆盖，必须提升标记版本号（v1→v2→v3…）：
// 存量库已有旧标记会跳过种子，导致新城市永远补不进来；INSERT OR IGNORE 保证不覆盖后台改名/排序。
const { REGIONS, STREET_EXAMPLES } = require('./utils/region-data')
if (!seeded('seed_regions_v2')) {
  const insertRegion = db.prepare('INSERT OR IGNORE INTO regions (code, parent_code, name, level, sort) VALUES (?,?,?,?,?)')
  db.transaction(() => {
    let sort = 0
    for (const [province, cities] of Object.entries(REGIONS)) {
      const pCode = `P${encodeURIComponent(province)}`
      insertRegion.run(pCode, '', province, 1, sort++)
      for (const [city, districts] of Object.entries(cities)) {
        const cCode = `${pCode}|${encodeURIComponent(city)}`
        insertRegion.run(cCode, pCode, city, 2, sort++)
        for (const district of districts) {
          const dCode = `${cCode}|${encodeURIComponent(district)}`
          insertRegion.run(dCode, cCode, district, 3, sort++)
          // 街道级：仅对内置示例命中时补几条，其余交由逆地理编码/后台补充
          for (const [dKey, streets] of Object.entries(STREET_EXAMPLES)) {
            if (district === dKey || district.startsWith(dKey)) {
              streets.forEach((s, i) => insertRegion.run(`${dCode}|${encodeURIComponent(s)}`, dCode, s, 4, i))
            }
          }
        }
      }
    }
    insertSeedFlag.run('seed_regions_v2', '1')
  })()
}

module.exports = db
