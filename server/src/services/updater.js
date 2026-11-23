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

const badRequest = msg => Object.assign(new Error(msg), { status: 400 })
const git = args => run('git', args, { cwd: ROOT, maxBuffer: 12 * 1024 * 1024 })
const npm = args => run(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
  cwd: ROOT,
  shell: process.platform === 'win32',
  maxBuffer: 12 * 1024 * 1024
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
  let latest = '', notes = '', publishedAt = '', url = ''
  let apiError = ''
  try {
    const rel = await fetchJson(`https://api.github.com/repos/${cfg.repo}/releases/latest`)
    latest = String(rel.tag_name || '').replace(/^v/i, '')
    notes = String(rel.body || '')
    publishedAt = rel.published_at || ''
    url = rel.html_url || ''
    if (!latest) throw new Error('Release 未标注版本号')
  } catch (e) {
    apiError = e.message
    let file = null
    let fileError = ''
    for (const base of [
      `https://raw.githubusercontent.com/${cfg.repo}/${cfg.branch}/version.json?t=${Date.now()}`,
      `https://github.com/${cfg.repo}/raw/${cfg.branch}/version.json?t=${Date.now()}`
    ]) {
      try { file = await fetchJson(base); break } catch (e2) { fileError = e2.message }
    }
    let source = 'version.json'
    if (!file) {
      try {
        await git(['fetch', 'origin', cfg.branch])
        const text = (await git(['show', `origin/${cfg.branch}:version.json`])).stdout
        file = JSON.parse(text)
        source = 'git 远端'
      } catch (e3) {
        throw Object.assign(new Error(`检查更新失败：GitHub Release(${apiError})；version.json(${fileError})；git 远端(${e3.message})`), { status: 502 })
      }
    }
    latest = String(file.version || '').replace(/^v/i, '')
    notes = String(file.notes || '')
    publishedAt = file.publishedAt || ''
    url = file.url || `https://github.com/${cfg.repo}`
    if (!latest) throw badRequest('version.json 缺少 version 字段')
    apiError = source
  }

  const result = {
    kind: 'check',
    current: currentVersion(),
    latest,
    hasUpdate: compareVersion(latest, currentVersion()) > 0,
    notes, publishedAt, url,
    source: apiError ? 'version.json' : 'GitHub Release'
  }
  result.checkedAt = remember(result)
  return result
}

async function performUpdate(cfg = getConfig()) {
  if (busy) throw Object.assign(new Error('已有更新任务正在执行，请稍候'), { status: 409 })
  if (!fs.existsSync(path.join(ROOT, '.git'))) throw badRequest('当前目录不是 Git 仓库，无法自动更新')
  busy = true
  try {
    try { await git(['remote', 'get-url', 'origin']) } catch { throw badRequest('未配置 origin 远端，无法自动更新') }
    const before = (await git(['rev-parse', 'HEAD'])).stdout.trim()
    await git(['fetch', 'origin', cfg.branch])
    const after = (await git(['rev-parse', `origin/${cfg.branch}`])).stdout.trim()
    if (before === after) {
      const result = { kind: 'apply', updated: false, message: '已是最新版本', log: [] }
      result.checkedAt = remember(result)
      return result
    }
    await git(['pull', '--ff-only', 'origin', cfg.branch])
    const files = (await git(['diff', '--name-only', before, after])).stdout
      .split('\n').map(s => s.trim()).filter(Boolean)
    const log = []

    if (files.some(p => /^server\/package(-lock)?\.json$/.test(p))) {
      await npm(['--prefix', 'server', 'install'])
      log.push('server 依赖已更新')
    }
    if (files.some(p => p.startsWith('client/'))) {
      await npm(['--prefix', 'client', 'run', 'build'])
      log.push('H5 前端已重新构建')
    }
    if (files.some(p => p.startsWith('miniapp/'))) {
      await npm(['--prefix', 'miniapp', 'run', 'build:all'])
      log.push('小程序三端已重新构建')
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
      setTimeout(() => process.exit(0), 2000)
    }
    return result
  } finally { busy = false }
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

module.exports = {
  currentVersion, getConfig, updateConfig, check, performUpdate,
  startAutoUpdateLoop, isBusy: () => busy
}
