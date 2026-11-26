// 微信域名校验文件落盘：DB（site_config.wechat_verify_files）是权威底本，磁盘文件只是它的镜像。
// 背景：公众号网页授权域名、JS 接口安全域名、小程序业务域名等配置时，微信要求把校验 .txt 放到站点根，
// 并可通过 https://域名/<文件名> 访问。每个场景一个独立文件，必须能同时存在多个、互不覆盖。
// 双保险：① app.js 动态路由从 DB 直接下发（请求回源到 Node 时生效）；
// ② 本模块把同一批文件落盘到 client/dist，兼容 nginx 直托静态目录（请求不回源 Node）的场景。
// 崩溃安全：写文件用 临时文件 + rename 原子替换；任何异常都不抛给主流程（只告警）。
const fs = require('fs')
const path = require('path')
const settings = require('./settings')

// 文件名放宽：微信通常给 MP_verify_xxx.txt，但浏览器重复下载会带 (1) 等后缀、也可能被改名。
// 只拦真正危险的：路径穿越、路径分隔符、控制字符、非 .txt 结尾；长度 ≤128。
function validName(name) {
  const n = String(name || '')
  return n.length > 0 && n.length <= 128 && /\.txt$/i.test(n) && !/[\\/\0-\x1f]/.test(n) && !n.includes('..')
}

const MANIFEST = '.verify-files.json'

function distRoot() {
  // 本文件在 server/src/utils/，上溯三级才是项目根；与 app.js 的 DIST 指向同一目录。
  return path.resolve(__dirname, '../../../client/dist')
}

function readManifest(dist) {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(dist, MANIFEST), 'utf8'))
    return Array.isArray(m) ? m : []
  } catch { return [] }
}

function writeManifest(dist, names) {
  const target = path.join(dist, MANIFEST)
  const tmp = path.join(dist, `.${MANIFEST}.${process.pid}.tmp`)
  fs.writeFileSync(tmp, JSON.stringify(names), 'utf8')
  fs.renameSync(tmp, target)
}

// 从 DB 底本同步校验文件到站点根：
//  - 列表里每个合法文件原子写入 dist/<name>
//  - 上次由本系统写入、这次列表里已没有的文件删除（靠 manifest 精确识别，绝不误删其它静态资源）
// 返回 { ok, action:'written'|'removed'|'none'|'error', names, count, reason }
function syncVerifyFile() {
  let files = []
  try {
    files = settings.verifyFiles()
  } catch (e) {
    return { ok: false, action: 'error', names: [], reason: '读取配置失败: ' + e.message }
  }
  const dist = distRoot()
  // dist 不存在（未构建）没有落盘意义，动态路由仍可工作，静默跳过
  if (!fs.existsSync(dist)) return { ok: true, action: 'none', names: [], reason: 'dist 未构建，跳过落盘' }

  const oldNames = readManifest(dist)
  const nextNames = []
  let written = 0
  let removed = 0
  const failures = []

  for (const f of files) {
    const name = String(f.name || '').trim()
    if (!validName(name)) { failures.push(`非法文件名 ${name}`); continue }
    try {
      const target = path.join(dist, name)
      const tmp = path.join(dist, `.${name}.${process.pid}.tmp`)
      fs.writeFileSync(tmp, String(f.content || ''), 'utf8')
      fs.renameSync(tmp, target)
      nextNames.push(name)
      written++
    } catch (e) {
      try { fs.unlinkSync(path.join(dist, `.${name}.${process.pid}.tmp`)) } catch { /* ignore */ }
      failures.push(`${name}: ${e.message}`)
    }
  }

  // 清理：只删 manifest 记录过、且本次未再写入的文件
  for (const name of oldNames) {
    if (!validName(name) || nextNames.includes(name)) continue
    try { fs.unlinkSync(path.join(dist, name)); removed++ }
    catch (e) { if (e.code !== 'ENOENT') console.warn('[VerifyFile] 删除旧校验文件失败', name, e.message) }
  }

  try { writeManifest(dist, nextNames) }
  catch (e) { console.error('[VerifyFile] 写入 manifest 失败', e.message) }

  const action = written ? 'written' : (removed ? 'removed' : 'none')
  if (failures.length) console.error('[VerifyFile] 部分校验文件处理失败:', failures.join('; '))
  return { ok: failures.length === 0, action, names: nextNames, count: nextNames.length, reason: failures.join('; ') }
}

module.exports = { syncVerifyFile, validName, distRoot }
