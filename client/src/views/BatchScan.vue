<template>
  <div class="page">
    <header class="topbar">
      <span class="title">展会连扫收名片</span>
      <div class="spacer"></div>
      <button class="nav-menu-btn" aria-label="菜单" @click="toggleDrawer"><i class="menu-glyph"></i></button>
    </header>

    <div class="container" style="margin-top:16px">
      <!-- 套餐闸门：展会连扫（批量收名片）需有效套餐；单张收藏仍为基本功能 -->
      <div v-if="needPlan" class="card card-pad" style="text-align:center;padding:36px 16px">
        <div style="font-size:46px;opacity:.3">▣</div>
        <h3 style="margin:10px 0">展会连扫需要开通套餐</h3>
        <p class="small muted">开通后可一次扫一批名片，统一打标存进名片夹。单张收藏仍可正常使用。</p>
        <router-link to="/me/plans" class="btn btn-primary" style="margin-top:14px;display:inline-block">去开通 / 续期</router-link>
      </div>
      <template v-else>
      <div class="card card-pad intro">
        <b>一次参会，批量收名片</b>
        <p class="small muted">连续扫描对方的名片二维码（或粘贴名片链接），全部收集后统一打标签、写备注，一次性存进名片夹。比扫一张存一张快得多。</p>
      </div>

      <div class="card card-pad scan-card">
        <div class="scan-buttons">
          <button class="btn btn-primary" :disabled="scanning" @click="wxScan">{{ scanning ? '调起扫码中…' : '📷 微信扫一扫' }}</button>
        </div>
        <p v-if="!isWx" class="small muted" style="margin-top:8px">当前不是微信环境，微信扫一扫不可用，请用下方手动粘贴。</p>
        <div class="manual-row">
          <input v-model="manualInput" class="input" placeholder="粘贴名片链接或短码，回车添加" @keyup.enter="addManual" />
          <button class="btn btn-ghost" :disabled="!manualInput.trim()" @click="addManual">添加</button>
        </div>
      </div>

      <div class="card card-pad" style="margin-top:12px">
        <div class="list-head"><b>本次已收集 {{ collected.length }} 张</b>
          <button v-if="collected.length" class="btn btn-sm btn-ghost" @click="collected = []">清空</button>
        </div>
        <div v-if="!collected.length" class="small muted" style="padding:16px 0">还没有扫描到名片。</div>
        <div v-for="(s, i) in collected" :key="s + i" class="slug-chip">
          <span class="mono">{{ s }}</span>
          <button @click="collected.splice(i, 1)">✕</button>
        </div>

        <div class="field" style="margin-top:14px"><label>统一标签（逗号分隔，如 展会,潜在客户）</label>
          <input v-model="tagsText" class="input" placeholder="给这一批名片打标，方便事后筛选" />
        </div>
        <div class="field"><label>统一备注</label>
          <input v-model="note" class="input" maxlength="200" placeholder="如：2026 上海展会认识" />
        </div>
        <button class="btn btn-primary" style="width:100%;margin-top:8px" :disabled="saving || !collected.length" @click="submit">
          {{ saving ? '保存中…' : `保存到名片夹（${collected.length} 张）` }}
        </button>
      </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api'
import { toggleDrawer, showToast } from '../store'
import { isWeChat } from '../utils/save-image'
import { configWx } from '../utils/wx-sdk'

const router = useRouter()
const isWx = computed(() => isWeChat())
const collected = ref([])
const manualInput = ref('')
const tagsText = ref('')
const note = ref('')
const scanning = ref(false)
const saving = ref(false)
const needPlan = ref(false)

// 套餐闸门：拉自己的名片判 active；查不到/请求失败按未开通处理（不阻断页面，给引导）
async function loadPlan() {
  try {
    const { data } = await api.get('/api/cards/mine')
    needPlan.value = !data?.data?.active
  } catch { needPlan.value = true }
}

// 回前台兜底复位：部分微信版本取消扫码不回调 success/fail，按钮会卡在「调起扫码中…」。
// 页面可见后 1s 内没等到回调就按取消收口，按钮立即恢复可用。
let settleScan = null
function onVisible() {
  if (document.visibilityState !== 'visible' || !settleScan) return
  const settle = settleScan
  setTimeout(() => { if (settleScan === settle) settle() }, 1000)
}
onMounted(() => {
  loadPlan()
  // 预热微信 config：进页面即完成签名与权限校验，避免首次点扫一扫正撞「offline verifying」窗口
  if (isWx.value) configWx(api).catch(() => {})
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('pageshow', onVisible)
})
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisible)
  window.removeEventListener('pageshow', onVisible)
  if (settleScan) settleScan()
})

// 从任意文本里提取名片短码：支持 /c/xxx、完整 URL、纯短码
function extractSlug(text) {
  const s = String(text || '').trim()
  if (!s) return ''
  let m = s.match(/\/c\/([a-z0-9-]+)/i)
  if (m) return m[1].toLowerCase()
  m = s.match(/[?&](?:slug|invite)=([a-z0-9-]+)/i)
  if (m) return m[1].toLowerCase()
  if (/^[a-z0-9-]{3,40}$/i.test(s)) return s.toLowerCase()
  return ''
}
function addSlug(slug) {
  if (!slug) return showToast('没识别到名片短码', 'error')
  if (collected.value.includes(slug)) return showToast('这张已在本次列表里')
  collected.value.push(slug)
}
function addManual() {
  addSlug(extractSlug(manualInput.value))
  manualInput.value = ''
}
function scanErrText(e) {
  const msg = String(e?.message || '')
  if (/cancel/i.test(msg)) return ''
  if (/timeout/i.test(msg)) return '扫码超时，请重试'
  if (/offline\s*verifying/i.test(msg)) return '微信扫码权限校验未就绪，请稍后再试'
  return '扫码失败，请重试'
}
// 单次调起扫码；cancel / 超时 / 回前台兜底统一从 settle 收口
function scanOnce(wx) {
  return new Promise((resolve, reject) => {
    let settled = false
    let timer = null
    const finish = (fn, v) => { if (!settled) { settled = true; clearTimeout(timer); settleScan = null; fn(v) } }
    // 180s 仅是「什么回调都没来」的最后兜底；正常收口走 success/fail/cancel/回前台
    timer = setTimeout(() => finish(reject, new Error('scanQRCode:timeout')), 180000)
    settleScan = () => finish(reject, new Error('scanQRCode:cancel'))
    try {
      wx.scanQRCode({
        needResult: 1,
        scanType: ['qrCode', 'barCode'],
        success: res => finish(resolve, res?.resultStr || ''),
        fail: err => finish(reject, new Error(err?.errMsg || 'scanQRCode:fail')),
        cancel: () => finish(reject, new Error('scanQRCode:cancel'))
      })
    } catch (e) { finish(reject, e) }
  })
}
async function wxScan() {
  if (scanning.value) return
  scanning.value = true
  try {
    const { wx, ok } = await configWx(api)
    if (!ok) { showToast('微信权限未就绪，请稍后重试', 'error'); return }
    // offline verifying：config 后微信异步校验权限，首次拉起撞窗口就透明重拉（300/600/900ms 递增）
    let result = ''
    for (let attempt = 0; ; attempt++) {
      try { result = await scanOnce(wx); break }
      catch (e) {
        const msg = String(e?.message || '')
        if (!/offline\s*verifying/i.test(msg) || attempt >= 3) throw e
        await new Promise(r => setTimeout(r, 300 * (attempt + 1)))
      }
    }
    const slug = extractSlug(result)
    if (slug) { addSlug(slug); showToast('已收集，继续扫下一张', 'success') }
    else showToast('二维码不是本系统的名片', 'error')
  } catch (e) {
    const text = scanErrText(e)
    if (text) showToast(text, 'error')
  }
  finally { scanning.value = false }
}
async function submit() {
  if (saving.value) return
  saving.value = true
  try {
    const tags = tagsText.value.split(/[,，]/).map(s => s.trim()).filter(Boolean).slice(0, 8)
    const { data } = await api.post('/api/cards/mine/contacts/batch', {
      slugs: collected.value, tags, note: note.value.trim()
    })
    const { added = 0, updated = 0, skipped = 0 } = data.data || {}
    showToast(`已存 ${added} 张${updated ? `，更新 ${updated} 张` : ''}${skipped ? `，跳过 ${skipped} 张` : ''}`, 'success')
    collected.value = []
    router.push('/me/contacts')
  } catch (e) { showToast(e.message || '保存失败', 'error') }
  finally { saving.value = false }
}
</script>

<style scoped>
.back { width: 34px; height: 34px; display: grid; place-items: center; font-size: 26px; color: var(--primary); }
.title { font-size: 15px; font-weight: 700; }
.spacer { flex: 1; }
.intro b { font-size: 15px; }
.intro p { margin: 6px 0 0; line-height: 1.6; }
.scan-card { margin-top: 12px; }
.scan-buttons .btn { width: 100%; }
.manual-row { display: flex; gap: 8px; margin-top: 10px; }
.manual-row .input { flex: 1; }
.list-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.slug-chip { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; margin-bottom: 6px; background: var(--bg-page, #f4f6fb); border-radius: 8px; font-size: 13px; }
.slug-chip button { color: var(--muted); }
.field label { display: block; font-size: 13px; margin-bottom: 5px; }
</style>
