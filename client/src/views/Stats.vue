<template>
  <div class="page">
    <header class="topbar">
      <span class="title">浏览统计</span>
      <div class="spacer"></div>
      <button class="dash-icon" aria-label="回到名片" @click="router.push('/me')">▤</button>
      <button class="nav-menu-btn" aria-label="菜单" @click="toggleDrawer"><i class="menu-glyph"></i></button>
    </header>

    <div v-if="loading" class="container dash-loading"><div class="card card-pad">加载中…</div></div>
    <div v-else-if="error" class="container dash-loading">
      <div class="card card-pad center" style="padding:44px 20px">
        <div style="font-size:40px;opacity:.3">⚠️</div>
        <h2 style="margin:10px 0">数据加载失败</h2>
        <p class="small muted">{{ error }}</p>
        <button class="btn btn-primary" style="margin-top:16px" @click="load">重新加载</button>
      </div>
    </div>
    <div v-else class="container stats-page">
      <!-- 轻量概览：白底 + 主色点缀，不再是大紫块 -->
      <div class="summary">
        <div class="summary-label"><i>◉</i> 累计浏览</div>
        <div class="summary-value"><CountUp :value="stats.views" :duration="1200" /><span>次</span></div>
        <div class="summary-meta">
          <span>近 14 天 <b>{{ recentTotal }}</b> 次</span>
          <span class="dot">·</span>
          <span>日均 <b>{{ dailyAvg }}</b> 次</span>
        </div>
      </div>

      <!-- 紧凑指标：一行两个，无进度条（绝对值数据画进度条没有意义）；
           套餐有效期/开通状态属套餐管理（Plans 页 + 个人中心头卡），不进统计页（2026-11-28 用户定稿） -->
      <div class="kpi-row">
        <div class="kpi">
          <div class="kpi-ico i-blue">⇄</div>
          <div class="kpi-num"><CountUp :value="stats.exchanges" :duration="1100" /></div>
          <div class="kpi-label">交换名片</div>
        </div>
        <div class="kpi">
          <div class="kpi-ico i-teal">▥</div>
          <div class="kpi-num"><CountUp :value="recentTotal" :duration="1100" :delay="100" /></div>
          <div class="kpi-label">近 14 天</div>
        </div>
      </div>

      <div class="section-title">近 14 天浏览趋势</div>
      <div class="card card-pad trend-card">
        <div v-if="!stats.daily?.length" class="empty small">暂无浏览记录，把二维码分享出去就能看到数据</div>
        <div v-else class="chart">
          <div v-for="(d, i) in stats.daily" :key="d.day" class="bar-col" :title="`${d.day}：${d.n} 次`">
            <span v-if="d.n > 0" class="bar-val">{{ d.n }}</span>
            <span v-else class="bar-val bar-val-empty">&nbsp;</span>
            <div class="bar-track">
              <div class="bar" :class="{ peak: d.n === maxView }" :style="{ height: Math.max(4, d.n / maxView * 100) + '%', animationDelay: (i * 40) + 'ms' }"></div>
            </div>
            <span class="bar-day">{{ d.day.slice(5) }}</span>
          </div>
        </div>
      </div>

      <!-- 访客画像 -->
      <div class="section-title">访客画像 <span class="small muted">· 近 30 天</span></div>
      <div class="profile-stack">
        <div class="card card-pad profile-card">
          <h4>访客来源</h4>
          <div v-if="!stats.sources?.length" class="empty small">暂无数据</div>
          <div v-else v-for="s in stats.sources" :key="s.key" class="dist-row">
            <span class="dist-label">{{ sourceLabel(s.key) }}</span>
            <div class="dist-track"><div class="dist-fill" :style="{ width: pct(s.n, sourceTotal) + '%' }"></div></div>
            <b class="dist-num">{{ s.n }}</b>
          </div>
        </div>
        <div class="card card-pad profile-card">
          <h4>访客城市 TOP</h4>
          <div v-if="!stats.cities?.length" class="empty small">定位成功后显示</div>
          <div v-else v-for="c in stats.cities" :key="c.key" class="dist-row">
            <span class="dist-label">{{ c.key }}</span>
            <div class="dist-track"><div class="dist-fill c2" :style="{ width: pct(c.n, cityTotal) + '%' }"></div></div>
            <b class="dist-num">{{ c.n }}</b>
          </div>
        </div>
        <div class="card card-pad profile-card">
          <h4>浏览时段分布</h4>
          <div v-if="!stats.hourly?.length" class="empty small">暂无数据</div>
          <div v-else class="hour-chart">
            <div v-for="h in 24" :key="h" class="hour-col" :title="`${h - 1}:00 · ${hourMap[h - 1] || 0} 次`">
              <div class="hour-bar" :style="{ height: Math.max(3, (hourMap[h - 1] || 0) / hourMax * 100) + '%' }"></div>
            </div>
          </div>
          <div v-if="stats.hourly?.length" class="hour-axis"><span>0 点</span><span>6 点</span><span>12 点</span><span>18 点</span><span>23 点</span></div>
        </div>
      </div>

      <!-- 宣传页统计与线索（2026-11-28 用户定稿：从宣传页列表行收进这里统一看） -->
      <div class="section-title">宣传页 <span class="small muted">· 浏览与线索</span></div>
      <div class="kpi-row">
        <div class="kpi">
          <div class="kpi-ico i-teal">◈</div>
          <div class="kpi-num"><CountUp :value="h5.views" :duration="1000" /></div>
          <div class="kpi-label">宣传页浏览</div>
        </div>
        <div class="kpi">
          <div class="kpi-ico i-blue">✎</div>
          <div class="kpi-num"><CountUp :value="h5.leads_total" :duration="1000" :delay="100" /></div>
          <div class="kpi-label">留资线索</div>
        </div>
      </div>
      <div class="card card-pad promo-card">
        <h4>各宣传页</h4>
        <div v-if="!h5.promos.length" class="empty small">还没有宣传页，去「宣传页制作」创建并上架</div>
        <div v-else v-for="p in h5.promos" :key="p.id" class="promo-row">
          <span class="promo-name">{{ p.title }}</span>
          <span class="promo-badge" :class="{ on: p.status === 'published' }">{{ p.status === 'published' ? '已上架' : '草稿' }}</span>
          <span class="promo-cell"><b>{{ p.views }}</b> 浏览</span>
          <span class="promo-cell"><b>{{ p.leads }}</b> 线索</span>
        </div>
      </div>
      <div class="card card-pad promo-card">
        <h4>线索明细</h4>
        <p v-if="!h5.leads.length" class="empty small">还没有线索。宣传页带「表单留资」模块时，访客提交后会出现在这里。</p>
        <div v-for="l in h5.leads" :key="l.id" class="lead-row">
          <div class="lead-main">
            <b>{{ l.name || '（未填姓名）' }}</b>
            <a v-if="l.phone" class="lead-phone" :href="'tel:' + l.phone">{{ l.phone }}</a>
            <span v-else class="small muted">未填电话</span>
            <p v-if="l.message" class="lead-msg">{{ l.message }}</p>
            <span class="small muted">{{ l.page_title }} · {{ fmtTime(l.created_at) }}</span>
          </div>
          <div class="lead-ops">
            <button v-if="l.phone" class="btn btn-sm btn-ghost" @click="copyLeadPhone(l)">复制电话</button>
            <button class="btn btn-sm btn-ghost lead-del" :disabled="leadBusy === l.id" @click="removeLead(l)">{{ leadBusy === l.id ? '…' : '删除' }}</button>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api'
import { toggleDrawer, showToast } from '../store'
import CountUp from '../components/CountUp.vue'

const router = useRouter()
const stats = ref({ views: 0, exchanges: 0, daily: [], sources: [], cities: [], hourly: [] })
const loading = ref(true)
const error = ref('')
let loadStarted = false

const maxView = computed(() => Math.max(1, ...(stats.value.daily || []).map(d => d.n)))
const recentTotal = computed(() => (stats.value.daily || []).reduce((s, d) => s + (Number(d.n) || 0), 0))
const dailyAvg = computed(() => {
  const days = (stats.value.daily || []).length || 14
  return Math.round(recentTotal.value / days)
})
const SOURCE_LABELS = { qr: '扫码', market: '名片集市', share: '好友分享', search: '搜索引擎', direct: '直接访问' }
function sourceLabel(k) { return SOURCE_LABELS[k] || k || '其他' }
const sourceTotal = computed(() => (stats.value.sources || []).reduce((s, x) => s + Number(x.n || 0), 0))
const cityTotal = computed(() => Math.max(1, ...(stats.value.cities || []).map(x => Number(x.n) || 0)))
const hourMap = computed(() => {
  const m = {}
  for (const h of stats.value.hourly || []) m[h.hour] = h.n
  return m
})
const hourMax = computed(() => Math.max(1, ...Object.values(hourMap.value)))
function pct(n, total) { return total ? Math.round(Number(n || 0) / total * 100) : 0 }

async function load() {
  if (loadStarted && loading.value) return
  loadStarted = true
  loading.value = true
  error.value = ''
  try {
    const s = await api.get('/api/cards/mine/stats')
    // 兜底：接口异常时字段一律给默认值，绝不把 null 丢给模板的 .length / .map
    stats.value = { views: 0, exchanges: 0, daily: [], sources: [], cities: [], hourly: [], ...(s.data?.data || {}) }
  } catch (e) { error.value = e.message || '网络异常' } finally { loading.value = false }
}
onMounted(load)

// ---- 宣传页统计与线索（2026-11-28 从宣传页列表行收进本页）：失败不拖垮名片统计主流程 ----
const h5 = ref({ promos: [], views: 0, leads_total: 0, leads: [] })
const leadBusy = ref(0)
async function loadH5() {
  try {
    const { data } = await api.get('/api/h5/mine/stats')
    h5.value = { promos: [], views: 0, leads_total: 0, leads: [], ...(data?.data || {}) }
  } catch { /* 宣传页统计失败不影响本页名片统计展示 */ }
}
function fmtTime(s) { return String(s || '').replace('T', ' ').slice(5, 16) }
async function copyLeadPhone(l) {
  try { await navigator.clipboard.writeText(l.phone); showToast('电话已复制', 'success') } catch { showToast(l.phone) }
}
async function removeLead(l) {
  if (leadBusy.value) return
  leadBusy.value = l.id
  try {
    await api.delete(`/api/h5/${l.page_id}/leads/${l.id}`)
    h5.value = { ...h5.value, leads: h5.value.leads.filter(x => x.id !== l.id), leads_total: Math.max(0, h5.value.leads_total - 1) }
    const p = h5.value.promos.find(x => x.id === l.page_id)
    if (p) p.leads = Math.max(0, p.leads - 1)
    showToast('已删除', 'success')
  } catch (e) { showToast(e.message || '删除失败', 'error') } finally { leadBusy.value = 0 }
}
onMounted(loadH5)
</script>

<style scoped>
.back { width: 34px; height: 34px; display: grid; place-items: center; font-size: 26px; color: var(--primary); }
.title { font-size: 15px; font-weight: 700; }
.spacer { flex: 1; }
.dash-icon { width: 34px; height: 34px; border-radius: 50%; background: #eef2ff; color: var(--primary); font-size: 16px; }
.dash-loading { margin-top: 20px; }
.stats-page { padding-top: 14px; padding-bottom: 30px; }

/* 轻量概览 */
.summary { padding: 20px; border-radius: 16px; background: linear-gradient(135deg, #f0f6ff, #e8f0fe); border: 1px solid #dbeafe; }
.summary-label { font-size: 13px; font-weight: 600; color: #475569; }
.summary-label i { font-style: normal; color: #2563eb; margin-right: 4px; }
.summary-value { margin: 8px 0 12px; font-size: 44px; font-weight: 800; line-height: 1; letter-spacing: -1px; color: #1d4ed8; }
.summary-value span { font-size: 14px; font-weight: 600; margin-left: 6px; color: #64748b; }
.summary-meta { display: flex; gap: 6px; flex-wrap: wrap; font-size: 11px; color: #64748b; }
.summary-meta b { color: #1d4ed8; }
.summary-meta .dot { opacity: .5; }

/* 紧凑指标 */
.kpi-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 12px; }
.kpi { padding: 14px 10px; text-align: center; background: var(--bg-card, #fff); border: 1px solid var(--line, #e8edf4); border-radius: 14px; }
.kpi-ico { width: 32px; height: 32px; margin: 0 auto 8px; border-radius: 10px; display: grid; place-items: center; font-size: 16px; font-weight: 700; }
.kpi-ico.i-blue { background: #eff6ff; color: #2563eb; }
.kpi-ico.i-teal { background: #ecfeff; color: #0891b2; }
.kpi-num { font-size: 24px; font-weight: 800; color: var(--text, #0f172a); line-height: 1.1; }
.kpi-label { margin-top: 5px; font-size: 11px; color: var(--muted, #6b7688); }

.section-title { font-size: 14px; font-weight: 700; margin: 20px 0 10px; }
.trend-card { padding: 14px 12px; }
.chart { display: flex; align-items: flex-end; gap: 4px; height: 150px; padding-top: 12px; }
.bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; min-width: 0; }
.bar-val { height: 16px; font-size: 10px; color: var(--muted, #6b7688); font-variant-numeric: tabular-nums; }
.bar-val-empty { visibility: hidden; }
.bar-track { flex: 1; width: 100%; max-width: 20px; display: flex; align-items: flex-end; }
.bar { width: 100%; border-radius: 5px 5px 0 0; background: linear-gradient(180deg, #60a5fa, #2563eb); transform-origin: bottom; animation: barGrow .7s cubic-bezier(.2, .8, .2, 1) both; }
.bar.peak { background: linear-gradient(180deg, #fbbf24, #f97316); }
.bar-day { height: 18px; margin-top: 5px; font-size: 9px; color: var(--muted, #6b7688); white-space: nowrap; }

/* 访客画像：单列堆叠，移动端更易读 */
.profile-stack { display: flex; flex-direction: column; gap: 10px; }
.profile-card h4 { font-size: 13px; margin: 0 0 10px; }
.dist-row { display: flex; align-items: center; gap: 8px; margin: 7px 0; font-size: 12px; }
.dist-label { flex: 0 0 66px; color: var(--muted, #6b7688); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dist-track { flex: 1; height: 7px; border-radius: 99px; background: var(--line, #eef2f7); overflow: hidden; }
.dist-fill { height: 100%; border-radius: 99px; background: linear-gradient(90deg, #2563eb, #60a5fa); animation: barFill .8s ease-out both; }
.dist-fill.c2 { background: linear-gradient(90deg, #0891b2, #22d3ee); }
.dist-num { flex: 0 0 26px; text-align: right; font-variant-numeric: tabular-nums; }
.hour-chart { display: flex; align-items: flex-end; gap: 2px; height: 80px; }
.hour-col { flex: 1; height: 100%; display: flex; align-items: flex-end; }
.hour-bar { width: 100%; background: linear-gradient(180deg, #93c5fd, #2563eb); border-radius: 3px 3px 0 0; min-height: 3px; }
.hour-axis { display: flex; justify-content: space-between; margin-top: 6px; font-size: 10px; color: var(--muted, #6b7688); }
.empty { padding: 10px 0; }

/* 宣传页统计与线索 */
.promo-card { margin-top: 10px; }
.promo-card h4 { font-size: 13px; margin: 0 0 8px; }
.promo-row { display: flex; align-items: center; gap: 8px; padding: 9px 0; border-bottom: 1px solid var(--line, #eef2f7); font-size: 13px; }
.promo-row:last-child { border-bottom: 0; }
.promo-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.promo-badge { flex: 0 0 auto; font-size: 11px; font-weight: 700; padding: 1px 8px; border-radius: 999px; color: #92400e; background: #fef3c7; }
.promo-badge.on { color: #15803d; background: #dcfce7; }
.promo-cell { flex: 0 0 auto; color: var(--muted, #6b7688); font-size: 12px; }
.promo-cell b { color: var(--text, #0f172a); font-variant-numeric: tabular-nums; }
.lead-row { display: flex; align-items: flex-start; gap: 10px; padding: 11px 0; border-bottom: 1px solid var(--line, #eef2f7); }
.lead-row:last-child { border-bottom: 0; }
.lead-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.lead-main b { font-size: 14px; }
.lead-phone { font-size: 14px; color: var(--primary, #a62b2b); font-weight: 700; text-decoration: none; }
.lead-msg { margin: 2px 0 0; font-size: 13px; line-height: 1.6; color: #374151; white-space: pre-line; word-break: break-all; }
.lead-ops { flex: 0 0 auto; display: flex; flex-direction: column; gap: 6px; }
.lead-del { color: #b91c1c !important; }

@keyframes barFill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes barGrow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
@media (prefers-reduced-motion: reduce) { .bar, .dist-fill { animation: none !important; } }
</style>
