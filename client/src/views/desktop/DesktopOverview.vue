<template>
  <div class="pc-overview">
    <div class="pc-hero">
      <div class="pc-hero-left">
        <p class="pc-hello">{{ greeting }}，{{ auth.user?.phone || '朋友' }} 👋</p>
        <h1>你的名片，正在为生意持续获客</h1>
        <p class="pc-sub">一张永久有效的电子名片 · 改资料不换二维码 · 上架集市被更多对口伙伴发现</p>
        <div class="pc-hero-actions">
          <button class="btn btn-primary" @click="$router.push('/me/card')">✎ 完善我的名片</button>
          <button class="btn btn-ghost" @click="$router.push('/market')">⌕ 去集市发现伙伴</button>
          <button class="btn btn-ghost" @click="$router.push('/me/card?focus=market')">🚀 {{ card?.market_opt_in ? '管理集市上架' : '上架集市获客' }}</button>
        </div>
      </div>
      <div v-if="card" class="pc-hero-card" @click="$router.push('/c/' + card.slug)">
        <div class="pc-hc-top">
          <div class="pc-hc-ava">{{ (card.name || '名').slice(0, 1) }}</div>
          <div><b>{{ card.name || '我的名片' }}</b><span>{{ [card.title, card.company].filter(Boolean).join(' · ') || '点击预览公开名片 ↗' }}</span></div>
        </div>
        <div class="pc-hc-foot"><span>/c/{{ card.slug }}</span><span class="pc-hc-badge" :class="{ on: card.active }">{{ card.active ? '展示中' : '未开通' }}</span></div>
      </div>
    </div>

    <div v-if="loading" class="pc-loading">正在加载工作台数据…</div>
    <template v-else>
      <div class="pc-kpis">
        <div class="pc-kpi"><span class="pc-kpi-ico">👁</span><div><small>累计浏览</small><CountUp :value="stats.views || 0" /><em>次</em></div></div>
        <div class="pc-kpi"><span class="pc-kpi-ico c2">🤝</span><div><small>交换名片</small><CountUp :value="stats.exchanges || 0" /><em>张</em></div></div>
        <div class="pc-kpi"><span class="pc-kpi-ico c3">📅</span><div><small>剩余天数</small><CountUp :value="days" /><em>天</em></div></div>
        <div class="pc-kpi"><span class="pc-kpi-ico c4">🔔</span><div><small>未读通知</small><CountUp :value="unread" /><em>条</em></div></div>
      </div>

      <div class="pc-cols">
        <section class="card card-pad pc-trend">
          <h4>近 14 天浏览趋势</h4>
          <div class="pc-bars">
            <div v-for="d in daily" :key="d.day" class="pc-bar-wrap" :title="`${d.day} · ${d.n} 次`">
              <div class="pc-bar" :style="{ height: Math.max(3, (d.n / maxView) * 100) + '%' }"></div>
              <span>{{ d.day.slice(5) }}</span>
            </div>
          </div>
          <p v-if="!daily.length" class="small muted">暂无浏览数据，分享名片后即可看到趋势。</p>
        </section>

        <section class="card card-pad pc-source">
          <h4>访客来源分布</h4>
          <div v-if="!sources.length" class="small muted">暂无来源数据</div>
          <div v-for="s in sources" :key="s.key" class="pc-src-row">
            <span class="pc-src-label">{{ sourceLabel(s.key) }}</span>
            <div class="pc-src-track"><div class="pc-src-fill" :style="{ width: pct(s.n, sourceTotal) + '%' }"></div></div>
            <b>{{ s.n }}</b>
          </div>
        </section>
      </div>

      <div class="pc-cols-3">
        <section class="card card-pad">
          <h4>快捷操作</h4>
          <div class="pc-quick">
            <button @click="$router.push('/me/card')"><i>✎</i>编辑资料</button>
            <button @click="$router.push('/me/card?focus=appearance')"><i>🎨</i>模板配色</button>
            <button @click="$router.push('/me/card?focus=materials')"><i>📚</i>资料夹</button>
            <button @click="$router.push('/me/print')"><i>🖨</i>实体版式</button>
            <button @click="$router.push('/me/contacts')"><i>▤</i>名片夹</button>
            <button @click="$router.push('/me/batch-scan')"><i>📷</i>展会连扫</button>
            <button @click="$router.push('/me/stats')"><i>📊</i>完整统计</button>
            <button @click="$router.push('/me/notifications')"><i>🔔</i>消息通知</button>
          </div>
        </section>
        <section class="card card-pad pc-cards-preview">
          <h4>你的名片状态</h4>
          <div v-if="!card" class="small muted">还没有名片，去创建一张吧。</div>
          <template v-else>
            <div class="pc-status-row"><span>上架集市</span><b :class="card.market_opt_in ? 'ok' : 'warn'">{{ card.market_opt_in ? '已上架 · 可被发现' : '未上架' }}</b></div>
            <div class="pc-status-row"><span>行业</span><b>{{ card.industryLabel || '未设置' }}</b></div>
            <div class="pc-status-row"><span>所在城市</span><b>{{ [card.province, card.city].filter(Boolean).join(' · ') || '未设置' }}</b></div>
            <div class="pc-status-row"><span>二维码</span><b class="ok">永久固定</b></div>
            <button class="btn btn-sm btn-ghost" style="margin-top:12px" @click="$router.push('/me/card?focus=identity')">补全资料提升曝光 ›</button>
          </template>
        </section>
        <section class="card card-pad pc-orders-preview">
          <h4>最近订单</h4>
          <div v-if="!orders.length" class="small muted">还没有订单</div>
          <div v-for="o in orders.slice(0, 5)" :key="o.id" class="pc-order">
            <span>{{ o.packageName }}</span><b>¥{{ (o.amountCents / 100).toFixed(2) }}</b>
            <small :class="o.status === 'paid' ? 'ok' : 'warn'">{{ statusText(o.status) }}</small>
          </div>
          <button class="btn btn-sm btn-ghost" style="margin-top:12px" @click="$router.push('/me/plans')">查看套餐 / 续期 ›</button>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../../api'
import { auth } from '../../store'
import CountUp from '../../components/CountUp.vue'

const card = ref(null)
const stats = ref({ views: 0, exchanges: 0, daily: [], sources: [] })
const orders = ref([])
const unread = ref(0)
const loading = ref(true)
let loadStarted = false

const greeting = computed(() => { const h = new Date().getHours(); return h < 6 ? '夜深了' : h < 12 ? '早上好' : h < 18 ? '下午好' : '晚上好' })
const days = computed(() => card.value?.expires_at
  ? Math.max(0, Math.ceil((new Date(String(card.value.expires_at).replace(' ', 'T') + 'Z').getTime() - Date.now()) / 86400000))
  : 0)
const daily = computed(() => stats.value.daily || [])
const sources = computed(() => stats.value.sources || [])
const maxView = computed(() => Math.max(1, ...daily.value.map(d => d.n)))
const sourceTotal = computed(() => sources.value.reduce((s, x) => s + (Number(x.n) || 0), 0) || 1)
const pct = (n, total) => Math.round((Number(n) || 0) / total * 100)
const SOURCE_LABELS = { qr: '扫码', market: '名片集市', share: '分享链接', search: '搜索', direct: '直接访问' }
const sourceLabel = k => SOURCE_LABELS[k] || k || '其他'
const statusText = s => ({ paid: '已支付', pending: '待支付', cancelled: '已取消', expired: '已过期' })[s] || s

async function load() {
  if (loadStarted) return
  loadStarted = true
  loading.value = true
  try {
    const [c, s, o, n] = await Promise.all([
      api.get('/api/cards/mine'),
      api.get('/api/cards/mine/stats'),
      api.get('/api/orders/mine'),
      api.get('/api/notifications/unread')
    ])
    card.value = c.data?.data || null
    stats.value = { views: 0, exchanges: 0, daily: [], sources: [], ...(s.data?.data || {}) }
    orders.value = o.data?.data || []
    unread.value = n.data?.data?.unread || 0
  } catch { /* 空数据兜底，不显示假数字 */ } finally { loading.value = false; loadStarted = false }
}
onMounted(load)
</script>

<style scoped>
.pc-overview { max-width: 1240px; }
.pc-hero { display: flex; gap: 28px; align-items: center; justify-content: space-between; padding: 26px 30px; border-radius: 18px; background: linear-gradient(120deg, #12213c, #1d3a55 55%, #2563eb); color: #fff; margin-bottom: 18px; }
.pc-hello { font-size: 13px; opacity: .8; margin: 0 0 6px; }
.pc-hero h1 { font-size: 26px; margin: 0 0 8px; }
.pc-sub { font-size: 13px; opacity: .82; margin: 0 0 18px; }
.pc-hero-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.pc-hero-actions .btn { font-size: 13px; padding: 10px 16px; }
.pc-hero-actions .btn-ghost { background: rgba(255,255,255,.12); color: #fff; border-color: rgba(255,255,255,.3); }
.pc-hero-card { flex: 0 0 300px; background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.22); border-radius: 14px; padding: 18px; cursor: pointer; }
.pc-hc-top { display: flex; align-items: center; gap: 12px; }
.pc-hc-ava { width: 46px; height: 46px; border-radius: 12px; background: rgba(255,255,255,.2); display: grid; place-items: center; font-size: 20px; font-weight: 800; }
.pc-hc-top b { display: block; font-size: 16px; }
.pc-hc-top span { font-size: 12px; opacity: .8; }
.pc-hc-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 18px; font-size: 11px; opacity: .8; }
.pc-hc-badge { padding: 3px 9px; border-radius: 999px; background: rgba(255,255,255,.16); }
.pc-hc-badge.on { background: rgba(34,197,94,.3); }
.pc-loading { text-align: center; padding: 60px; color: var(--muted); }
.pc-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 18px; }
.pc-kpi { display: flex; align-items: center; gap: 14px; background: var(--bg-card, #fff); border: 1px solid var(--line, #e8edf4); border-radius: 14px; padding: 18px 20px; }
.pc-kpi-ico { width: 46px; height: 46px; border-radius: 12px; display: grid; place-items: center; font-size: 22px; background: #eff6ff; }
.pc-kpi-ico.c2 { background: #ecfdf5; } .pc-kpi-ico.c3 { background: #fffbeb; } .pc-kpi-ico.c4 { background: #fef2f2; }
.pc-kpi small { display: block; font-size: 12px; color: var(--muted); margin-bottom: 2px; }
.pc-kpi :deep(.countup) { font-size: 26px; font-weight: 800; color: var(--text); }
.pc-kpi em { font-style: normal; font-size: 12px; color: var(--muted); margin-left: 4px; }
.pc-cols { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(260px, 1fr); gap: 14px; margin-bottom: 18px; }
.pc-cols-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.pc-cols h4, .pc-cols-3 h4 { margin: 0 0 14px; font-size: 15px; }
.pc-bars { display: flex; align-items: flex-end; gap: 6px; height: 180px; }
.pc-bar-wrap { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; }
.pc-bar { width: 100%; max-width: 26px; border-radius: 6px 6px 0 0; background: linear-gradient(180deg, #60a5fa, #2563eb); }
.pc-bar-wrap span { font-size: 9px; color: var(--muted); margin-top: 6px; white-space: nowrap; }
.pc-src-row { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; font-size: 12px; }
.pc-src-label { flex: 0 0 72px; color: var(--muted); }
.pc-src-track { flex: 1; height: 8px; border-radius: 999px; background: #eef2f7; overflow: hidden; }
.pc-src-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #2563eb, #38bdf8); }
.pc-src-row b { min-width: 28px; text-align: right; }
.pc-quick { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.pc-quick button { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border: 1px solid var(--line, #e8edf4); border-radius: 10px; background: var(--bg-page, #f8fafc); font-size: 13px; color: var(--text); cursor: pointer; }
.pc-quick button:hover { border-color: var(--primary, #2563eb); color: var(--primary); }
.pc-quick i { font-style: normal; }
.pc-status-row { display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid var(--line, #eef2f7); font-size: 13px; }
.pc-status-row span { color: var(--muted); }
.pc-status-row b.ok { color: #059669; } .pc-status-row b.warn { color: #d97706; }
.pc-order { display: flex; justify-content: space-between; align-items: center; padding: 9px 0; border-bottom: 1px solid var(--line, #eef2f7); font-size: 13px; }
.pc-order small.ok { color: #059669; } .pc-order small.warn { color: #d97706; }
@media (max-width: 1200px) { .pc-cols-3 { grid-template-columns: repeat(2, 1fr); } }
</style>
