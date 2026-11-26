// 微信域名校验文件落盘：DB（site_config）是权威底本，磁盘文件只是它的镜像。
// 背景：小程序/公众号在微信后台配置业务域名、JS 接口安全域名、网页授权域名时，
// 微信会要求把 MP_verify_xxx.txt 放到站点根目录并可通过 https://域名/MP_verify_xxx.txt 访问。
// 双保险：① app.js 的动态路由从 DB 直接下发（请求回源到 Node 时生效）；
// ② 本模块把同一份内容落盘到 client/dist，兼容 nginx 直托静态目录（请求不回源 Node）的场景。
// 崩溃安全：写文件用 临时文件 + rename 原子替换；任何异常都不抛给主流程（只告警）。
const fs = require('fs')
const path = require('path')
const config = require('../config')
const settings = require('./settings')

const NAME_RE = /^MP_verify_[A-Za-z0-9_-]{1,64}\.txt$/

function distRoot() {
  // 本文件在 server/src/utils/，上溯三级才是项目根；与 app.js 的 DIST 指向同一目录。
  return path.resolve(__dirname, '../../../client/dist')
}

// 从 DB 底本同步校验文件到站点根：
//  - 文件名/内容合法 → 原子写入 dist/<name>
//  - DB 未配置（名为空/内容为空）→ 删除旧的 MP_verify_*.txt（避免残留导致微信仍在校验旧域名）
// 返回 { ok, action: 'written'|'removed'|'none'|'error', name, reason }
function syncVerifyFile() {
  let name = ''
  let content = ''
  try {
    const c = settings.wechatOauthConfig()
    name = String(c.verifyName || '').trim()
    content = String(c.verifyContent || '').replace(/\s+/g, '')
  } catch (e) {
    return { ok: false, action: 'error', name, reason: '读取配置失败: ' + e.message }
  }
  const dist = distRoot()
  // dist 不存在（未构建）没有落盘意义，动态路由仍可工作，静默跳过
  if (!fs.existsSync(dist)) return { ok: true, action: 'none', name, reason: 'dist 未构建，跳过落盘' }

  // 清理历史校验文件：只动 MP_verify_*.txt，不碰其它静态资源；新配置无效时全部清掉。
  const clean = keep => {
    for (const f of fs.readdirSync(dist)) {
      if (NAME_RE.test(f) && f !== keep) {
        try { fs.unlinkSync(path.join(dist, f)) } catch (e) { console.warn('[VerifyFile] 删除旧校验文件失败', f, e.message) }
      }
    }
  }

  if (!NAME_RE.test(name) || !content) {
    try { clean('') } catch (e) { return { ok: false, action: 'error', name, reason: e.message } }
    return { ok: true, action: 'removed', name: '', reason: 'DB 未配置校验文件' }
  }

  try {
    clean(name)
    const target = path.join(dist, name)
    const tmp = path.join(dist, `.${name}.${process.pid}.tmp`)
    fs.writeFileSync(tmp, content, 'utf8')
    fs.renameSync(tmp, target)
    return { ok: true, action: 'written', name }
  } catch (e) {
    try { fs.unlinkSync(path.join(dist, `.${name}.${process.pid}.tmp`)) } catch { /* ignore */ }
    console.error('[VerifyFile] 校验文件落盘失败', e.message)
    return { ok: false, action: 'error', name, reason: e.message }
  }
}

module.exports = { syncVerifyFile, NAME_RE, distRoot }
