const express = require('express')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const config = require('./config')
const db = require('./db')
const updater = require('./services/updater')

const app = express()
app.disable('x-powered-by')
app.use(cors())

// 微信回调签名基于原始报文，必须在 json 解析前挂载 raw
app.use('/api/pay/notify/wechat', express.raw({ type: '*/*', limit: '1mb' }))
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: false }))

app.use('/uploads', express.static(config.UPLOAD_DIR, { maxAge: '7d' }))

app.get('/api/health', (_req, res) => res.json({ code: 0, data: { ok: true, time: Date.now(), payMode: config.PAY_MODE } }))
app.get('/api/public/config', (_req, res) => {
  const rows = db.prepare('SELECT key, value FROM site_config').all()
  const cfg = Object.fromEntries(rows.map(r => { try { return [r.key, JSON.parse(r.value)] } catch { return [r.key, ''] } }))
  res.json({ code: 0, data: cfg })
})

app.use('/api/auth', require('./routes/auth'))
app.use('/api/pay', require('./routes/pay'))
app.use('/api/cards', require('./routes/cards'))
app.use('/api/packages', require('./routes/packages'))
app.use('/api/orders', require('./routes/orders'))
app.use('/api/upload', require('./routes/upload'))
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
    const card = db.prepare('SELECT slug, name, title, company, bio, cover, avatar FROM cards WHERE slug = ?').get(m[1])
    if (card) {
      const title = `${card.name || '名片'} · ${card.title || card.company || '电子名片'}`
      const desc = String(card.bio || `${card.name || ''} ${card.title || ''} ${card.company || ''}`).slice(0, 150)
      const image = card.cover || card.avatar || ''
      const meta = [
        `<title>${esc(title)}</title>`,
        `<meta name="description" content="${esc(desc)}">`,
        `<meta property="og:type" content="profile">`,
        `<meta property="og:title" content="${esc(title)}">`,
        `<meta property="og:description" content="${esc(desc)}">`,
        image ? `<meta property="og:image" content="${esc(image)}">` : '',
        `<meta property="og:url" content="${esc(`${config.BASE_URL}/c/${card.slug || m[1]}`)}">`
      ].filter(Boolean).join('\n    ')
      html = html.replace(/<title>[\s\S]*?<\/title>/, meta)
    }
  }
  res.type('html').send(html)
}

app.get('*', (req, res, next) => req.path.startsWith('/api') ? next() : sendSpa(req, res))

app.use((err, _req, res, _next) => {
  console.error('[Error]', err)
  if (res.headersSent) return
  res.status(err.status || 500).json({ code: err.status || 500, msg: err.message || '服务器内部错误' })
})

app.listen(config.PORT, config.HOST, () => {
  console.log(`MCard API 已启动: http://localhost:${config.PORT}  (支付模式: ${config.PAY_MODE})`)
  updater.startAutoUpdateLoop()
})
