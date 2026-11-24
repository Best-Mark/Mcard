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
  template TEXT NOT NULL DEFAULT 'classic',
  industry TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  latitude REAL,
  longitude REAL,
  market_opt_in INTEGER NOT NULL DEFAULT 0,
  theme TEXT NOT NULL DEFAULT 'ocean',
  accent TEXT NOT NULL DEFAULT '#2563eb',
  qr_fg TEXT NOT NULL DEFAULT '#0f172a',
  qr_bg TEXT NOT NULL DEFAULT '#ffffff',
  qr_logo INTEGER NOT NULL DEFAULT 1,
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
addColumnIfMissing('cards', 'company_intro', "TEXT NOT NULL DEFAULT ''")
for (const col of ['alipay', 'wechat_qr', 'alipay_qr', 'wechat_pay_qr', 'alipay_pay_qr', 'shop_url']) {
  addColumnIfMissing('cards', col, "TEXT NOT NULL DEFAULT ''")
}
// 布局模板（与配色 theme 分离）：存量名片回落 classic
addColumnIfMissing('cards', 'template', "TEXT NOT NULL DEFAULT 'classic'")
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

// 微信网页授权登录：openid/unionid 用于免密识别，头像来自微信，auth_source 记录账号来源
for (const [col, def] of [
  ['wx_openid', "TEXT NOT NULL DEFAULT ''"],
  ['wx_unionid', "TEXT NOT NULL DEFAULT ''"],
  ['avatar', "TEXT NOT NULL DEFAULT ''"],
  ['auth_source', "TEXT NOT NULL DEFAULT 'password'"]
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
`)

// 访客画像/来源分析 + 名片夹打标：存量库补列（自愈，CREATE TABLE IF NOT EXISTS 不改老表）
// 必须放在上面的建表 exec 之后——card_views/card_favorites 表此时才存在
addColumnIfMissing('card_views', 'source', "TEXT NOT NULL DEFAULT ''")
addColumnIfMissing('card_views', 'city', "TEXT NOT NULL DEFAULT ''")
addColumnIfMissing('card_favorites', 'note', "TEXT NOT NULL DEFAULT ''")
addColumnIfMissing('card_favorites', 'tags', "TEXT NOT NULL DEFAULT '[]'")
// 索引依赖补列后的字段，必须放在 addColumnIfMissing 之后（存量库 source 列此时才存在）
db.exec('CREATE INDEX IF NOT EXISTS idx_views_source ON card_views(card_id, source);')

// ---------------- 种子数据 ----------------
const seedPackages = [
  { name: '体验卡', description: '7 天试用，完整功能', price_cents: 100, duration_days: 7, features: JSON.stringify(['全部模板', '永久二维码', '一键存通讯录', '实体名片版式下载']), sort: 1 },
  { name: '月度会员', description: '30 天，持续展示', price_cents: 1900, duration_days: 30, features: JSON.stringify(['全部模板', '永久二维码', '一键存通讯录', '实体名片版式下载', '访问数据统计']), sort: 2 },
  { name: '季度会员', description: '90 天，推荐之选', price_cents: 4900, duration_days: 90, features: JSON.stringify(['全部模板', '永久二维码', '一键存通讯录', '实体名片版式下载', '访问数据统计', '交换名片']), sort: 3 },
  { name: '年度会员', description: '365 天，长期商务首选', price_cents: 9900, duration_days: 365, features: JSON.stringify(['全部模板', '永久二维码', '一键存通讯录', '实体名片版式下载', '访问数据统计', '交换名片', '自定义主题']), sort: 4 },
  // 终身套餐：duration_days = 0（唯一口径，勿用负数或魔法天数表示）
  { name: '终身会员', description: '一次开通，永久有效', price_cents: 29900, duration_days: 0, features: JSON.stringify(['全部模板', '永久二维码', '一键存通讯录', '实体名片版式下载', '访问数据统计', '交换名片', '自定义主题', '终身有效']), sort: 5 }
]
// 自愈但幂等：用标记键做种子，避免运营删光套餐/降级管理员后下次启动被「复活」
const insertSeedFlag = db.prepare("INSERT OR IGNORE INTO site_config (key, value) VALUES (?, ?)")
const seeded = key => !!db.prepare('SELECT 1 FROM site_config WHERE key = ?').get(key)
if (!seeded('seed_packages_v1')) {
  const insert = db.prepare('INSERT INTO packages (name, description, price_cents, duration_days, features, sort) VALUES (@name,@description,@price_cents,@duration_days,@features,@sort)')
  db.transaction(rows => { rows.forEach(r => insert.run(r)); insertSeedFlag.run('seed_packages_v1', '1') })(seedPackages)
}

// 自愈补丁：存量库已有 seed_packages_v1 标记，新增终身套餐不会随原种子插入；按「有无终身套餐」幂等补齐
if (!db.prepare('SELECT 1 FROM packages WHERE duration_days = 0 LIMIT 1').get()) {
  const lifetime = seedPackages.find(p => p.duration_days === 0)
  db.prepare('INSERT INTO packages (name, description, price_cents, duration_days, features, sort) VALUES (@name,@description,@price_cents,@duration_days,@features,@sort)').run(lifetime)
}

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

// ---------------- 四级行政区划种子（幂等，仅首次初始化） ----------------
// 自愈约定：标记键存在即跳过；后台 CRUD 后即使清空也不会被「复活」。
const { REGIONS, STREET_EXAMPLES } = require('./utils/region-data')
if (!seeded('seed_regions_v1')) {
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
    insertSeedFlag.run('seed_regions_v1', '1')
  })()
}

module.exports = db
