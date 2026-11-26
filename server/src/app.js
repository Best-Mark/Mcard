const express = require('express')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const config = require('./config')
const db = require('./db')
const updater = require('./services/updater')
const { startPayReconcileLoop } = require('./services/payReconcile')
const { startPlanExpiryLoop } = require('./services/planExpiry')
const settings = require('./utils/settings')
const { originOf } = require('./utils/origin')
const { syncVerifyFile, validName } = require('./utils/verifyFile')
// 首次启动：把 .env 里的支付参数等种子导入配置中心（幂等，DB 已有值不覆盖）
settings.seedDefaults()
// 自愈：以 DB 为权威底本，把微信域名校验文件同步落盘到站点根（重建/部署后自动补回，不依赖动态路由是否回源）
try { syncVerifyFile() } catch (e) { console.error('[VerifyFile] 启动同步失败', e.message) }

const app = express()
app.disable('x-powered-by')
app.use(cors())

// 微信回调签名基于原始报文，必须在 json 解析前挂载 raw
app.use('/api/pay/notify/wechat', express.raw({ type: '*/*', limit: '1mb' }))
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: false }))

app.use('/uploads', express.static(config.UPLOAD_DIR, { maxAge: '7d' }))

app.get('/api/health', (_req, res) => res.json({ code: 0, data: { ok: true, time: Date.now(), payMode: settings.payConfig().PAY_MODE } }))
app.get('/api/public/config', (_req, res) => {
  // 安全：仅下发公开白名单+派生开关，支付密钥/短信密钥/小程序密钥/公众号密钥绝不外泄
  res.json({ code: 0, data: settings.publicView() })
})

// 微信域名校验文件动态路由（第一层）：从 DB 底本按文件名精确匹配下发，部署/git clean 不会丢失。
// 支持多个文件（公众号网页授权域名、小程序业务域名等各一个），文件名放宽到任意合法 .txt。
// 第二层是 utils/verifyFile 把同一批内容落盘到 client/dist，兼容 nginx 直托静态目录（不回源 Node）的场景。
app.get('/:verifyName.txt', (req, res, next) => {
  const name = String(req.params.verifyName || '') + '.txt'
  if (!validName(name)) return next()
  const hit = settings.verifyFiles().find(f => f.name === name)
  if (!hit) return next()
  res.type('text/plain').send(String(hit.content || ''))
})

app.use('/api/auth', require('./routes/auth'))
app.use('/api/geo', require('./routes/geo'))
app.use('/api/pay', require('./routes/pay'))
app.use('/api/cards', require('./routes/cards'))
app.use('/api/notifications', require('./routes/notifications'))
app.use('/api/packages', require('./routes/packages'))
app.use('/api/orders', require('./routes/orders'))
app.use('/api/upload', require('./routes/upload'))
app.use('/api/promo', require('./routes/promo'))
app.use('/api/admin', require('./routes/admin'))

app.use('/api', (_req, res) => res.status(404).json({ code: 404, msg: '接口不存在' }))

// ---------- 前端产物 + 名片页 SEO 元信息注入 ----------
const DIST = path.resolve(__dirname, '../../client/dist')
if (fs.existsSync(DIST)) app.use(express.static(DIST, { index: false }))

const esc = s => String(s || '').replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c])

function sendSpa(req, res) {
  const file = path.join(DIST, 'index.html')
  if (!fs.existsSync(file)) return res.status(404).type('html').send('<h1>请先执行 npm run build</h1>')
  let html = fs.readFileSync(file, 'utf8')

  const m = req.path.match(/^\/c\/([a-z0-9-]+)\/?$/)
  if (m) {
    const card = db.prepare('SELECT slug, name, title, company, bio, company_intro, logo, cover, avatar FROM cards WHERE slug = ?').get(m[1])
    if (card) {
      // 与前端分享口径严格一致（用户定稿）：标题「XXX的名片」，描述首选简介；
      // 缩略图 公司LOGO → 用户头像 → 项目LOGO → 分享池，绝不用二维码当缩略图。
      const title = `${card.name || '名片'}的名片`
      const desc = String(card.bio || card.company_intro || `${card.name || ''} ${card.title || ''} ${card.company || ''}`).slice(0, 150)
      const origin = originOf(req)
      // og:image 必须是绝对 URL（相对路径微信抓不到）。
      // 站点 LOGO 唯一真相源 = site_config.site_logo；分享池唯一真相源 = settings.shareView().share_image。
      // 最终兜底 = 服务端名片卡片图 /api/cards/public/:slug/share.png（无需登录，webp 头像也能渲染，彻底消灭空图）。
      const absOf = u => !u ? '' : /^https?:\/\//i.test(u) ? u : u.startsWith('/') ? `${origin}${u}` : ''
      let shareFirst = ''
      try { shareFirst = settings.shareView()?.share_image?.[0] || '' } catch { /* 分享池读取失败不拖垮 SEO */ }
      const image = absOf(card.logo) || absOf(card.avatar) || absOf(settings.get('site_logo', '')) || absOf(shareFirst)
        || `${origin}/api/cards/public/${m[1]}/share.png`
      const meta = [
        `<title>${esc(title)}</title>`,
        `<meta name="description" content="${esc(desc)}">`,
        `<meta property="og:type" content="profile">`,
        `<meta property="og:title" content="${esc(title)}">`,
        `<meta property="og:description" content="${esc(desc)}">`,
        image ? `<meta property="og:image" content="${esc(image)}">` : '',
        `<meta property="og:url" content="${esc(`${origin}/c/${card.slug || m[1]}`)}">`
      ].filter(Boolean).join('\n    ')
      html = html.replace(/<title>[\s\S]*?<\/title>/, meta)
    }
  }
  // 入口 HTML 永不缓存：hash 资源文件名每次构建都变，浏览器若用缓存里的旧 index.html
  // 会引用已被删除的旧 chunk → SPA 白屏。静态资源本身靠文件名 hash 做长缓存即可。
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate').type('html').send(html)
}

app.get('*', (req, res, next) => req.path.startsWith('/api') ? next() : sendSpa(req, res))

app.use((err, _req, res, _next) => {
  // 兼容：JSON 报文非法时 Express 默认吐 HTML，前端 axios 拿到非 JSON 会二次异常；统一转 JSON
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ code: 400, msg: '请求内容不是合法的 JSON' })
  }
  console.error('[Error]', err)
  if (res.headersSent) return
  res.status(err.status || 500).json({ code: err.status || 500, msg: err.message || '服务器内部错误' })
})

app.listen(config.PORT, config.HOST, () => {
  console.log(`MCard API 已启动: http://localhost:${config.PORT}  (支付模式: ${settings.payConfig().PAY_MODE})`)
  updater.startAutoUpdateLoop()
  startPayReconcileLoop()
  startPlanExpiryLoop()
})
