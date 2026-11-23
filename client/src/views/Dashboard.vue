<template>
  <div class="page">
    <header class="topbar">
      <router-link to="/" class="brand">M<em>Card</em></router-link>
      <div class="spacer"></div>
      <span class="small muted">{{ auth.user?.phone }}</span>
      <button @click="doLogout">退出</button>
    </header>

    <div class="container" style="margin-top:20px">
      <template v-if="loading"><div class="card card-pad">加载中…</div></template>

      <template v-else-if="!card">
        <div class="card card-pad center" style="padding:44px 20px">
          <div style="font-size:46px;opacity:.25">▤</div>
          <h2 style="margin:10px 0">还没有名片</h2>
          <p class="muted small">创建后即可获得永久二维码，之后换资料不用换码。</p>
          <div style="max-width:320px;margin:20px auto 0">
            <input v-model.trim="newSlug" class="input" placeholder="自定义短码（选填，如 zhangsan）" />
            <button class="btn btn-primary btn-block" style="margin-top:10px" :disabled="busy" @click="createCard">
              {{ busy ? '创建中…' : '立即创建我的名片' }}
            </button>
          </div>
        </div>
      </template>

      <template v-else>
        <div class="card card-pad status-card">
          <div class="status-left">
            <div class="badge" :class="statusBadge.class">{{ statusBadge.text }}</div>
            <h2>{{ card.name || '未填写姓名' }}</h2>
            <p class="small muted">{{ card.title || '点「编辑资料」完善名片内容' }}</p>
            <div class="url-line mono">/c/{{ card.slug }} <span class="muted">· 永久固定</span></div>
          </div>
          <img class="mini-qr" :src="`/api/cards/public/${card.slug}/qr.svg?size=240`" alt="二维码" />
        </div>

        <div class="btn-row" style="margin:14px 0">
          <router-link to="/me/card" class="btn btn-primary">编辑资料</router-link>
          <router-link to="/me/plans" class="btn btn-ghost">{{ card.active ? '续期 / 升级' : '开通名片' }}</router-link>
          <router-link to="/me/print" class="btn btn-ghost">实体名片版式下载</router-link>
          <router-link :to="`/c/${card.slug}`" class="btn btn-ghost">查看公开页 ↗</router-link>
        </div>

        <div class="stat-grid">
          <div class="stat"><b>{{ stats.views }}</b><span>累计浏览</span></div>
          <div class="stat"><b>{{ stats.exchanges }}</b><span>交换名片</span></div>
          <div class="stat"><b>{{ card.active ? expireDays : 0 }}</b><span>剩余有效天数</span></div>
          <div class="stat"><b>{{ card.active ? '已开通' : '待开通' }}</b><span>当前状态</span></div>
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
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api'
import { auth, logout, showToast } from '../store'

const router = useRouter()
const card = ref(null); const stats = ref({ views: 0, exchanges: 0, daily: [] }); const orders = ref([])
const loading = ref(true); const busy = ref(false); const newSlug = ref('')
const maxView = computed(() => Math.max(1, ...(stats.value.daily || []).map(d => d.n)))
const expireDays = computed(() => card.value?.expires_at ? Math.max(0, Math.ceil((new Date(String(card.value.expires_at).replace(' ', 'T') + 'Z') - Date.now()) / 86400000)) : 0)
const statusBadge = computed(() => card.value?.active ? { text: '已开通', class: 'ok' } : { text: '未开通 / 已到期', class: 'warn' })
const statusText = s => ({ paid: '已支付', pending: '待支付', cancelled: '已取消' })[s] || s

async function load() {
  loading.value = true
  try {
    const [c, s, o] = await Promise.all([api.get('/api/cards/mine'), api.get('/api/cards/mine/stats'), api.get('/api/orders/mine')])
    card.value = c.data.data; stats.value = s.data.data; orders.value = o.data.data
  } catch (e) { showToast(e.message, 'error') } finally { loading.value = false }
}
onMounted(load)

async function createCard() {
  busy.value = true
  try {
    const { data } = await api.post('/api/cards/mine', { slug: newSlug.value })
    card.value = data.data
    showToast('名片已创建', 'success')
  } catch (e) { showToast(e.message, 'error') } finally { busy.value = false }
}
function doLogout() { logout(); router.push('/') }
</script>

<style scoped>
.status-card { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.status-left h2 { font-size: 24px; margin: 8px 0 2px; }
.url-line { margin-top: 12px; font-size: 12px; background: #f8fafc; padding: 6px 10px; border-radius: 8px; display: inline-block; }
.mini-qr { width: 104px; height: 104px; border: 1px solid var(--line); border-radius: 10px; padding: 6px; background: #fff; }
.chart { display: flex; align-items: flex-end; gap: 8px; height: 150px; padding-top: 10px; }
.bar-col { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 4px; min-width: 0; }
.bar { width: 100%; max-width: 26px; background: linear-gradient(180deg,#60a5fa,#2563eb); border-radius: 5px 5px 0 0; }
.bar-col span { font-size: 9px; color: var(--muted); }
@media (max-width: 520px) { .mini-qr { width: 80px; height: 80px; } }
</style>
