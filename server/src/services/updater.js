const { execFile } = require('child_process')
const { promisify } = require('util')
const fs = require('fs')
const path = require('path')
const db = require('../db')

const run = promisify(execFile)
const ROOT = path.resolve(__dirname, '../../..')
const PKG = path.join(ROOT, 'package.json')
let busy = false
let timer = null
// 异步任务进度：前端轮询 /update/status 显示进度条，避免 axios 20s 超时误判
let progress = { kind: '', step: '', pct: 0, detail: '', startedAt: 0, updatedAt: 0, done: false, error: '' }

function setProgress(patch) {
  progress = { ...progress, ...patch, updatedAt: Date.now() }
}
function getProgress() { return { ...progress, busy } }
function startProgress(kind) {
  progress = { kind, step: '准备中', pct: 0, detail: '', startedAt: Date.now(), updatedAt: Date.now(), done: false, error: '' }
  busy = true
}
function finishProgress(result, error = '') {
  progress = { ...progress, pct: 100, step: error ? '失败' : '完成', detail: error || progress.detail, done: true, error, updatedAt: Date.now() }
  busy = false
  return result
}

const badRequest = msg => Object.assign(new Error(msg), { status: 400 })
// 自愈/健壮：子进程必须有超时，否则 git fetch / npm install 异常挂起会让 busy 永久为 true、更新功能死锁
const EXEC_TIMEOUT = 180000
const git = args => run('git', args, { cwd: ROOT, maxBuffer: 12 * 1024 * 1024, timeout: EXEC_TIMEOUT })
const npm = args => run(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
  cwd: ROOT,
  shell: process.platform === 'win32',
  maxBuffer: 12 * 1024 * 1024,
  timeout: EXEC_TIMEOUT
})

function readCfg(key, fallback) {
  const row = db.prepare('SELECT value FROM site_config WHERE key = ?').get(key)
  if (!row) return fallback
  try { return JSON.parse(row.value) } catch { return fallback }
}

function writeCfg(key, value) {
  db.prepare(`INSERT INTO site_config (key, value, updated_at) VALUES (?,?,datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`).run(key, JSON.stringify(value))
}

function currentVersion() {
  try { return JSON.parse(fs.readFileSync(PKG, 'utf8')).version || '0.0.0' } catch { return '0.0.0' }
}

function currentCommit() {
  try {
    const head = fs.readFileSync(path.join(ROOT, '.git', 'HEAD'), 'utf8').trim()
    if (head.startsWith('ref:')) {
      const ref = head.slice(5).trim()
      return fs.readFileSync(path.join(ROOT, '.git', ref), 'utf8').trim().slice(0, 7)
    }
    return head.slice(0, 7)
  } catch { return '' }
}

// 进程启动时锁定的 commit：git pull 只改磁盘文件，不会重载已运行进程的内存代码。
// 用「磁盘 commit ≠ 启动 commit」判定「代码已更新但需重启才生效」，避免版本页误报「已是最新版本」。
const BOOT_COMMIT = currentCommit()
function runningCommit() { return BOOT_COMMIT }
function needsRestart() {
  const disk = currentCommit()
  return !!BOOT_COMMIT && !!disk && disk !== BOOT_COMMIT
}

// 主动重启（供后台「重启服务」按钮调用）：先让响应发出，再退出由 pm2 自动拉起。
function scheduleRestart() {
  if (!process.env.pm_id) throw badRequest('当前进程非 pm2 托管，无法自动重启；请在服务器执行 pm2 restart mcard')
  setTimeout(() => process.exit(0), 1200)
  return true
}

function getConfig() {
  return {
    repo: String(readCfg('update_repo', 'Best-Mark/Mcard')),
    branch: String(readCfg('update_branch', 'main')),
    autoCheck: !!readCfg('update_auto_check', true),
    autoApply: !!readCfg('update_auto_apply', false),
    intervalHours: Math.max(1, Number(readCfg('update_interval_hours', 6)) || 6),
    lastCheck: String(readCfg('update_last_check', '')),
    lastResult: (() => {
      const raw = readCfg('update_last_result', '')
      if (!raw) return null
      try { return typeof raw === 'string' ? JSON.parse(raw) : raw } catch { return null }
    })()
  }
}

function updateConfig(patch = {}) {
  const cfg = getConfig()
  if (patch.repo !== undefined) {
    const repo = String(patch.repo).trim()
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw badRequest('仓库格式应为 所有者/仓库名')
    writeCfg('update_repo', repo)
    cfg.repo = repo
  }
  if (patch.branch !== undefined) {
    const branch = String(patch.branch).trim()
    if (!/^[\w./-]{1,60}$/.test(branch)) throw badRequest('分支名不合法')
    writeCfg('update_branch', branch)
    cfg.branch = branch
  }
  if (patch.autoCheck !== undefined) { writeCfg('update_auto_check', !!patch.autoCheck); cfg.autoCheck = !!patch.autoCheck }
  if (patch.autoApply !== undefined) { writeCfg('update_auto_apply', !!patch.autoApply); cfg.autoApply = !!patch.autoApply }
  if (patch.intervalHours !== undefined) {
    const h = Math.min(720, Math.max(1, Number(patch.intervalHours) || 6))
    writeCfg('update_interval_hours', h); cfg.intervalHours = h
  }
  return cfg
}

function compareVersion(a, b) {
  const pa = String(a || '0').replace(/^v/i, '').split(/[.-]/).map(n => parseInt(n, 10) || 0)
  const pb = String(b || '0').replace(/^v/i, '').split(/[.-]/).map(n => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d) return d > 0 ? 1 : -1
  }
  return 0
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'MCard-Updater' },
    signal: AbortSignal.timeout(8000)
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

function remember(result) {
  const checkedAt = new Date().toISOString()
  writeCfg('update_last_check', checkedAt)
  writeCfg('update_last_result', { ...result, checkedAt })
  return checkedAt
}

async function check(cfg = getConfig()) {
  let latest = '', notes = '', publishedAt = '', url = '', remoteCommit = ''
  let apiError = ''
  setProgress({ step: '连接 GitHub 检查版本', pct: 10 })
  try {
    const rel = await fetchJson(`https://api.github.com/repos/${cfg.repo}/releases/latest`)
    latest = String(rel.tag_name || '').replace(/^v/i, '')
    notes = String(rel.body || '')
    publishedAt = rel.published_at || ''
    url = rel.html_url || ''
    if (!latest) throw new Error('Release 未标注版本号')
    setProgress({ step: '已获取 Release 信息', pct: 45 })
  } catch (e) {
    apiError = e.message
    setProgress({ step: 'GitHub 不可用，改用 git 远端', pct: 20 })
    try {
      await git(['fetch', 'origin', cfg.branch])
      setProgress({ step: 'git 拉取完成，读取远端信息', pct: 55 })
      const pkg = JSON.parse((await git(['show', `origin/${cfg.branch}:package.json`])).stdout)
      latest = String(pkg.version || '').replace(/^v/i, '')
      notes = (await git(['log', '-1', '--pretty=%B', `origin/${cfg.branch}`])).stdout.trim()
      remoteCommit = (await git(['rev-parse', `origin/${cfg.branch}`])).stdout.trim().slice(0, 7)
      url = `https://github.com/${cfg.repo}`
      if (!latest) throw new Error('远端 package.json 缺少 version 字段')
      apiError = 'git 远端'
    } catch (e2) {
      const cached = readCfg('update_last_result', '')
      if (cached && cached.latest) {
        const result = {
          kind: 'check', current: currentVersion(), latest: cached.latest,
          hasUpdate: compareVersion(cached.latest, currentVersion()) > 0 || !!(cached.remoteCommit && cached.remoteCommit !== currentCommit()),
          remoteCommit: cached.remoteCommit || '', currentCommit: currentCommit(),
          notes: cached.notes || '', publishedAt: cached.publishedAt || '', url: cached.url || '',
          source: '缓存（网络不可用）', stale: true,
          error: `GitHub Release(${apiError})；git 远端(${e2.message})`
        }
        result.checkedAt = remember(result)
        return result
      }
      throw Object.assign(new Error(`检查更新失败：GitHub Release(${apiError})；git 远端(${e2.message})`), { status: 502 })
    }
  }

  // 兼容：没有 Release 时 version 常年不变；用 commit 比对兜底，避免永远显示「已是最新版本」
  // GitHub Release 分支也尝试读一次本地已知的 remote commit（fetch 过就有）
  if (!remoteCommit) {
    try { remoteCommit = (await git(['rev-parse', `origin/${cfg.branch}`])).stdout.trim().slice(0, 7) } catch { /* 未 fetch 过则留空 */ }
  }
  setProgress({ step: '对比版本', pct: 75 })
  const versionAhead = compareVersion(latest, currentVersion()) > 0
  const commitAhead = !!remoteCommit && !!currentCommit() && remoteCommit !== currentCommit()
  const result = {
    kind: 'check',
    current: currentVersion(), currentCommit: currentCommit(),
    latest, remoteCommit,
    hasUpdate: versionAhead || commitAhead,
    notes, publishedAt, url,
    source: apiError === 'git 远端' ? 'git 远端' : (apiError ? 'GitHub Release(字段异常)' : 'GitHub Release')
  }
  result.checkedAt = remember(result)
  return result
}

async function performUpdate(cfg = getConfig()) {
  if (busy) throw Object.assign(new Error('已有更新任务正在执行，请稍候'), { status: 409 })
  if (!fs.existsSync(path.join(ROOT, '.git'))) throw badRequest('当前目录不是 Git 仓库，无法自动更新')
  startProgress('apply')
  try {
    setProgress({ step: '检查 Git 远端', pct: 8 })
    try { await git(['remote', 'get-url', 'origin']) } catch { throw badRequest('未配置 origin 远端，无法自动更新') }
    const before = (await git(['rev-parse', 'HEAD'])).stdout.trim()
    setProgress({ step: '拉取远端代码（git fetch）', pct: 18 })
    await git(['fetch', 'origin', cfg.branch])
    const after = (await git(['rev-parse', `origin/${cfg.branch}`])).stdout.trim()
    if (before === after) {
      const result = {
        kind: 'apply', updated: false, message: '已是最新版本', log: [],
        // 供前端同步刷新检查状态：当前已追上远端，绝不能继续显示「发现新版本」
        hasUpdate: false, currentCommit: before.slice(0, 7), remoteCommit: after.slice(0, 7)
      }
      result.checkedAt = remember(result)
      return finishProgress(result)
    }
    setProgress({ step: '合并代码（git pull）', pct: 32 })
    await git(['pull', '--ff-only', 'origin', cfg.branch])
    const files = (await git(['diff', '--name-only', before, after])).stdout
      .split('\n').map(s => s.trim()).filter(Boolean)
    const log = []
    const needServer = files.some(p => /^server\/package(-lock)?\.json$/.test(p))
    const needClient = files.some(p => p.startsWith('client/'))
    const needMiniapp = files.some(p => p.startsWith('miniapp/'))
    const totalJobs = [needServer, needClient, needMiniapp].filter(Boolean).length || 1
    let doneJobs = 0

    try {
      if (needServer) {
        setProgress({ step: '更新 server 依赖', pct: 40 + Math.round(50 * (++doneJobs / totalJobs)) })
        await npm(['--prefix', 'server', 'install'])
        log.push('server 依赖已更新')
      }
      if (needClient) {
        setProgress({ step: '重新构建 H5 前端', pct: 40 + Math.round(50 * (++doneJobs / totalJobs)) })
        await npm(['--prefix', 'client', 'run', 'build'])
        log.push('H5 前端已重新构建')
      }
      if (needMiniapp) {
        setProgress({ step: '重新构建小程序三端', pct: 40 + Math.round(50 * (++doneJobs / totalJobs)) })
        await npm(['--prefix', 'miniapp', 'run', 'build:all'])
        log.push('小程序三端已重新构建')
      }
    } catch (e) {
      // 自愈：重建/依赖安装失败时把代码回滚到更新前，避免「代码新、产物旧」的不一致状态
      try { await git(['reset', '--hard', before]) } catch (rb) { console.error('[Updater] 回滚失败', rb.message) }
      throw Object.assign(new Error(`更新后重建失败，已回滚代码：${e.message}`), { status: 500 })
    }

    const restartRequired = files.some(p => p.startsWith('server/'))
    const result = {
      kind: 'apply', updated: true,
      from: before.slice(0, 8), to: after.slice(0, 8),
      version: currentVersion(), changed: files, log,
      restartRequired, restartScheduled: false
    }
    result.checkedAt = remember(result)
    if (restartRequired && process.env.pm_id) {
      result.restartScheduled = true
      // 明确标记 restartScheduled：前端据此「等重启恢复再放行」，而不是拿到 done 就当可操作，
      // 否则那 2 秒 + pm2 拉起窗口里的请求会撞 502（2026-11-25 用户截图实锤）。
      setProgress({ step: '服务即将重启', pct: 98, restartScheduled: true, detail: '服务端有变更，2 秒后自动重启（页面会短暂断连，重启后自动恢复）' })
      setTimeout(() => process.exit(0), 2000)
    }
    return finishProgress(result)
  } finally {
    // busy 由 finishProgress 统一释放；异常抛出时也要释放，避免死锁
    if (busy && !progress.done) { busy = false; setProgress({ step: '失败', done: true, error: progress.error || '更新失败', updatedAt: Date.now() }) }
  }
}

async function tick() {
  if (busy) return
  const cfg = getConfig()
  if (!cfg.autoCheck) return
  const last = cfg.lastCheck ? Date.parse(cfg.lastCheck) : 0
  if (Date.now() - last < cfg.intervalHours * 3600000) return
  try {
    const r = await check(cfg)
    if (cfg.autoApply && r.hasUpdate) await performUpdate(cfg)
  } catch (e) { console.error('[Updater]', e.message) }
}

function startAutoUpdateLoop() {
  if (timer) return
  timer = setInterval(tick, 10 * 60 * 1000)
  timer.unref?.()
  setTimeout(tick, 30 * 1000).unref?.()
}

// 异步启动：接口立即返回，前端轮询进度，彻底绕开 axios 20s 超时
function startCheck() {
  if (busy) throw Object.assign(new Error('已有更新任务正在执行，请稍候'), { status: 409 })
  startProgress('check')
  Promise.resolve().then(() => check()).then(r => finishProgress(r)).catch(e => finishProgress(null, e.message || '检查失败'))
  return getProgress()
}
function startApply() {
  if (busy) throw Object.assign(new Error('已有更新任务正在执行，请稍候'), { status: 409 })
  // performUpdate 内部会 startProgress('apply') 并置 busy，这里不预置，否则它自己的 busy 检查会误报 409
  const p = performUpdate() // 同步执行到第一个 await 前即已 startProgress，busy 已置位
  Promise.resolve(p).then(r => finishProgress(r)).catch(e => finishProgress(null, e.message || '更新失败'))
  return getProgress()
}

module.exports = {
  currentVersion, currentCommit, runningCommit, needsRestart, scheduleRestart,
  getConfig, updateConfig, check, performUpdate,
  startCheck, startApply, getProgress,
  startAutoUpdateLoop, isBusy: () => busy
}
