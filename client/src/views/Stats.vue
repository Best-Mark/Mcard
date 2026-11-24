<template>
  <div class="page">
    <header class="topbar">
      <button class="back" @click="router.back ? router.back() : router.push('/me')">‹</button>
      <span class="title">浏览统计</span>
      <div class="spacer"></div>
      <button class="dash-icon" aria-label="回到名片" @click="router.push('/me')">▤</button>
      <button class="nav-menu-btn" aria-label="打开菜单" @click="openDrawer">☰</button>
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
      <div class="stat-grid">
        <div class="stat"><b>{{ stats.views }}</b><span>累计浏览</span></div>
        <div class="stat"><b>{{ stats.exchanges }}</b><span>交换名片</span></div>
        <div class="stat"><b>{{ card?.active ? (card?.expires_at ? expireDays : '永久') : 0 }}</b><span>剩余有效天数</span></div>
        <div class="stat"><b>{{ card?.active ? '已开通' : '待开通' }}</b><span>当前状态</span></div>
      </div>

      <div class="section-title">近 14 天浏览趋势</div>
      <div class="card card-pad">
        <div v-if="!stats.daily?.length" class="empty small">暂无浏览记录，把二维码分享出去就能看到数据</div>
        <div v-else class="chart">
          <div v-for="d in stats.daily" :key="d.day" class="bar-col" :title="`${d.day}：${d.n} 次`">
            <div class="bar" :style="{ height: Math.max(4, d.n / maxView * 100) + '%' }"></div>
            <span>{{ d.day.slice(5) }}</span>
          </div>
        </div>
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
import { openDrawer } from '../store'

const router = useRouter()
const card = ref(null)
const stats = ref({ views: 0, exchanges: 0, daily: [] })
const orders = ref([])
const loading = ref(true)
const error = ref('')
let loadStarted = false

const maxView = computed(() => Math.max(1, ...(stats.value.daily || []).map(d => d.n)))
const expireDays = computed(() => card.value?.expires_at ? Math.max(0, Math.ceil((new Date(String(card.value.expires_at).replace(' ', 'T') + 'Z') - Date.now()) / 86400000)) : 0)

async function load() {
  if (loadStarted && loading.value) return
  loadStarted = true
  loading.value = true
  error.value = ''
  try {
    const [c, s, o] = await Promise.all([api.get('/api/cards/mine/stats'), api.get('/api/orders/mine'), api.get('/api/cards/mine')])
    stats.value = s.data.data; orders.value = o.data.data; card.value = c.data.data
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
.chart { display: flex; align-items: flex-end; gap: 6px; height: 160px; padding-top: 10px; }
.bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; min-width: 0; }
.bar-col .bar { width: 100%; max-width: 22px; background: linear-gradient(180deg, #2f6feb, #06b6d4); border-radius: 6px 6px 0 0; }
.bar-col span { font-size: 10px; color: var(--muted); margin-top: 6px; }
.section-title { font-size: 15px; font-weight: 700; margin: 22px 0 10px; }
</style>
