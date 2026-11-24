<template>
  <div class="page">
    <header class="topbar">
      <button class="back" @click="router.back ? router.back() : router.push('/me')">‹</button>
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
      <!-- 主视觉：累计浏览大数字 -->
      <div class="hero-panel">
        <div class="hero-glow"></div>
        <div class="hero-top">
          <span class="hero-tag">📊 数据总览</span>
          <span class="hero-status">{{ card?.active ? '● 已开通' : '○ 待开通' }}</span>
        </div>
        <div class="hero-main">
          <div class="hero-number"><CountUp :value="stats.views" :duration="1600" /></div>
          <div class="hero-unit">累计浏览次数</div>
        </div>
        <div class="hero-foot">
          <span>近14天 <b>{{ recentTotal }}</b> 次</span>
          <span class="sep">·</span>
          <span>日均 <b>{{ dailyAvg }}</b> 次</span>
          <span class="sep">·</span>
          <span>二维码永久有效</span>
        </div>
      </div>

      <!-- 三张核心指标卡 -->
      <div class="stat-grid">
        <div class="stat-card c2">
          <div class="stat-ico">🔄</div>
          <div class="stat-num"><CountUp :value="stats.exchanges" :duration="1300" :delay="120" /></div>
          <div class="stat-label">交换名片</div>
          <div class="stat-bar"></div>
        </div>
        <div class="stat-card c3">
          <div class="stat-ico">📈</div>
          <div class="stat-num"><CountUp :value="recentTotal" :duration="1300" :delay="240" /></div>
          <div class="stat-label">近14天浏览</div>
          <div class="stat-bar"></div>
        </div>
        <div class="stat-card c4">
          <div class="stat-ico">⏳</div>
          <div class="stat-num">
            <template v-if="card?.active && !card?.expires_at">永久</template>
            <CountUp v-else :value="card?.active ? expireDays : 0" :duration="1300" :delay="360" suffix=" 天" />
          </div>
          <div class="stat-label">剩余有效期</div>
          <div class="stat-bar"></div>
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
              <div class="bar" :class="{ peak: d.n === maxView }" :style="{ height: Math.max(4, d.n / maxView * 100) + '%', animationDelay: (i * 45) + 'ms' }"></div>
            </div>
            <span class="bar-day">{{ d.day.slice(5) }}</span>
          </div>
        </div>
      </div>

      <!-- 访客画像：来源 / 城市 / 时段（借鉴同类 analytics，用现有浏览数据落地） -->
      <div class="section-title">访客画像 <span class="small muted">· 近 30 天</span></div>
      <div class="profile-grid">
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
      </div>
      <div class="card card-pad profile-card" style="margin-top:12px">
        <h4>浏览时段分布（24 小时）</h4>
        <div v-if="!stats.hourly?.length" class="empty small">暂无数据</div>
        <div v-else class="hour-chart">
          <div v-for="h in 24" :key="h" class="hour-col" :title="`${h - 1}:00 · ${hourMap[h - 1] || 0} 次`">
            <div class="hour-bar" :style="{ height: Math.max(3, (hourMap[h - 1] || 0) / hourMax * 100) + '%' }"></div>
          </div>
        </div>
        <div class="hour-axis"><span>0 点</span><span>6 点</span><span>12 点</span><span>18 点</span><span>23 点</span></div>
      </div>

      <div class="section-title">最近订单</div>
      <div v-if="!orders.length" class="card card-pad small muted">还没有订单</div>
      <div v-else class="table-wrap">
        <table><thead><tr><th>订单号</th><th>套餐</th><th>金额</th><th>状态</th><th>时间</th></tr></thead>
          <tbody><tr v-for="o in orders" :key="o.id">
            <td class="mono">{{ o.orderNo }}</td><td>{{ o.packageName }}</td>
            <td>¥{{ (o.amountCents / 100).toFixed(2) }}</td>
            <td><span class="badge" :class="o.status === 'paid' ? 'ok' : 'warn'">{{ statusText(o.status) }}</span></td>
            <td>{{ o.createdAt }}</td>
          </tr></tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api'
import { toggleDrawer } from '../store'
import CountUp from '../components/CountUp.vue'

const router = useRouter()
const card = ref(null)
const stats = ref({ views: 0, exchanges: 0, daily: [], sources: [], cities: [], hourly: [] })
const orders = ref([])
const loading = ref(true)
const error = ref('')
let loadStarted = false

const maxView = computed(() => Math.max(1, ...(stats.value.daily || []).map(d => d.n)))
const recentTotal = computed(() => (stats.value.daily || []).reduce((s, d) => s + (Number(d.n) || 0), 0))
const dailyAvg = computed(() => {
  const days = (stats.value.daily || []).length || 14
  return Math.round(recentTotal.value / days)
})
const expireDays = computed(() => card.value?.expires_at ? Math.max(0, Math.ceil((new Date(String(card.value.expires_at).replace(' ', 'T') + 'Z') - Date.now()) / 86400000)) : 0)
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
    const [s, o, c] = await Promise.all([api.get('/api/cards/mine/stats'), api.get('/api/orders/mine'), api.get('/api/cards/mine')])
    // 兜底：接口异常/无名片时字段一律给默认值，绝不把 null 丢给模板的 .length / .map
    stats.value = { views: 0, exchanges: 0, daily: [], sources: [], cities: [], hourly: [], ...(s.data?.data || {}) }
    orders.value = Array.isArray(o.data?.data) ? o.data.data : []
    card.value = c.data?.data || null
  } catch (e) { error.value = e.message || '网络异常' } finally { loading.value = false }
}
onMounted(load)

function statusText(s) { return ({ paid: '已支付', pending: '待支付', cancelled: '已取消' })[s] || s }
</script>

<style scoped>
.back { width: 34px; height: 34px; display: grid; place-items: center; font-size: 26px; color: var(--primary); }
.title { font-size: 15px; font-weight: 700; }
.spacer { flex: 1; }
.dash-icon { width: 34px; height: 34px; border-radius: 50%; background: #eef2ff; color: var(--primary); font-size: 16px; }
.dash-loading { margin-top: 20px; }
.stats-page { padding-top: 16px; padding-bottom: 30px; }

/* 主视觉 */
.hero-panel { position: relative; overflow: hidden; border-radius: 20px; padding: 22px 24px; color: #fff; background: linear-gradient(135deg, #1e3a8a 0%, #4f46e5 55%, #7c3aed 100%); box-shadow: 0 18px 44px rgba(30,58,138,.26); animation: rise .55s ease both; }
.hero-glow { position: absolute; width: 300px; height: 300px; right: -60px; top: -140px; border-radius: 50%; background: radial-gradient(circle, rgba(255,255,255,.28), transparent 65%); pointer-events: none; animation: breathe 6s ease-in-out infinite; }
.hero-top { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; }
.hero-tag { font-size: 13px; font-weight: 600; letter-spacing: .06em; opacity: .92; }
.hero-status { font-size: 12px; padding: 4px 12px; border-radius: 999px; background: rgba(255,255,255,.18); }
.hero-main { position: relative; z-index: 1; margin: 22px 0 18px; }
.hero-number { font-size: clamp(48px, 13vw, 78px); font-weight: 800; line-height: 1; letter-spacing: -2px; text-shadow: 0 0 28px rgba(255,255,255,.42); }
.hero-unit { margin-top: 8px; font-size: 14px; letter-spacing: .1em; opacity: .86; }
.hero-foot { position: relative; z-index: 1; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding-top: 14px; border-top: 1px solid rgba(255,255,255,.2); font-size: 12px; opacity: .92; }
.hero-foot b { font-size: 14px; }
.hero-foot .sep { opacity: .5; }

/* 指标卡 */
.stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 14px; }
.stat-card { position: relative; overflow: hidden; padding: 16px 14px 14px; background: var(--bg-card, #fff); border: 1px solid var(--line, #e8edf4); border-radius: 16px; box-shadow: 0 6px 20px rgba(15,23,42,.05); animation: rise .55s ease both; }
.stat-card::before { content: ''; position: absolute; left: 0; top: 0; right: 0; height: 3px; background: var(--c); }
.stat-card:nth-child(1) { animation-delay: .08s; }
.stat-card:nth-child(2) { animation-delay: .16s; }
.stat-card:nth-child(3) { animation-delay: .24s; }
.stat-ico { font-size: 20px; line-height: 1; }
.stat-num { margin: 10px 0 4px; font-size: clamp(24px, 6vw, 34px); font-weight: 800; letter-spacing: -1px; color: var(--c); }
.stat-label { font-size: 12px; color: var(--muted, #6b7688); }
.stat-bar { position: relative; height: 4px; margin-top: 12px; border-radius: 999px; background: var(--line, #eef2f7); overflow: hidden; }
.stat-bar::after { content: ''; position: absolute; inset: 0; background: var(--c); transform-origin: left; animation: barFill 1.1s ease-out both; animation-delay: .3s; }
.c2 { --c: #2563eb; }
.c3 { --c: #0891b2; }
.c4 { --c: #ea580c; }

/* 趋势图 */
.section-title { font-size: 15px; font-weight: 700; margin: 22px 0 10px; }
.trend-card { animation: rise .55s ease both; animation-delay: .3s; }
.chart { display: flex; align-items: flex-end; gap: 5px; height: 180px; padding-top: 14px; }
.bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; min-width: 0; }
.bar-val { height: 16px; font-size: 10px; color: var(--muted, #6b7688); font-variant-numeric: tabular-nums; }
.bar-val-empty { visibility: hidden; }
.bar-track { flex: 1; width: 100%; max-width: 22px; display: flex; align-items: flex-end; }
.bar { width: 100%; border-radius: 6px 6px 0 0; background: linear-gradient(180deg, #2f6feb, #06b6d4); transform-origin: bottom; animation: barGrow .8s cubic-bezier(.2, .8, .2, 1) both; }
.bar.peak { background: linear-gradient(180deg, #f59e0b, #ef4444); }
.bar-day { height: 18px; margin-top: 6px; font-size: 10px; color: var(--muted, #6b7688); white-space: nowrap; }

/* 访客画像 */
.profile-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.profile-card { animation: rise .55s ease both; }
.profile-card h4 { font-size: 13px; margin: 0 0 10px; }
.dist-row { display: flex; align-items: center; gap: 8px; margin: 7px 0; font-size: 12px; }
.dist-label { flex: 0 0 66px; color: var(--muted, #6b7688); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dist-track { flex: 1; height: 7px; border-radius: 99px; background: var(--line, #eef2f7); overflow: hidden; }
.dist-fill { height: 100%; border-radius: 99px; background: linear-gradient(90deg, #2563eb, #06b6d4); animation: barFill .9s ease-out both; }
.dist-fill.c2 { background: linear-gradient(90deg, #7c3aed, #ec4899); }
.dist-num { flex: 0 0 26px; text-align: right; font-variant-numeric: tabular-nums; }
.hour-chart { display: flex; align-items: flex-end; gap: 2px; height: 90px; }
.hour-col { flex: 1; height: 100%; display: flex; align-items: flex-end; }
.hour-bar { width: 100%; background: linear-gradient(180deg, #8b5cf6, #2563eb); border-radius: 3px 3px 0 0; min-height: 3px; }
.hour-axis { display: flex; justify-content: space-between; margin-top: 6px; font-size: 10px; color: var(--muted, #6b7688); }
.empty { padding: 10px 0; }

@keyframes rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes breathe { 0%, 100% { opacity: .45; transform: scale(1); } 50% { opacity: .85; transform: scale(1.12); } }
@keyframes barFill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes barGrow { from { transform: scaleY(0); } to { transform: scaleY(1); } }

@media (max-width: 520px) {
  .stat-grid { grid-template-columns: 1fr; }
  .profile-grid { grid-template-columns: 1fr; }
  .stat-card { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 0 12px; }
  .stat-ico { grid-row: span 2; }
  .stat-num { margin: 0; }
  .stat-bar { grid-column: span 2; }
}
@media (prefers-reduced-motion: reduce) {
  .hero-panel, .stat-card, .trend-card, .bar, .stat-bar::after, .hero-glow { animation: none !important; }
}
</style>
