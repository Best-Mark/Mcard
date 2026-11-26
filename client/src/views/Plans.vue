<template>
  <div class="page">
    <header class="topbar">
      <router-link to="/me" class="brand">M<em>Card</em></router-link>
      <div class="spacer"></div>
      <button class="nav-menu-btn" aria-label="菜单" @click="toggleDrawer"><i class="menu-glyph"></i></button>
    </header>
    <div class="container" style="margin-top:20px">
      <div class="hint" style="margin-bottom:16px">
        套餐按<b>时段</b>计费，支付后立即开通；到期前可随时续期，剩余时长会与新套餐叠加，不会浪费。
      </div>
      <div v-if="loadError" class="card card-pad center" style="margin-bottom:14px">
        <b>套餐加载失败</b><p class="small muted">{{ loadError }}</p>
        <button class="btn btn-sm btn-primary" style="margin-top:10px" @click="load">重新加载</button>
      </div>
      <div v-else-if="!loading && !packages.length" class="card card-pad center">暂无可选套餐</div>
      <div class="plan-grid">
        <div v-for="p in packages" :key="p.id" class="card plan" :class="{ hot: p.sort === 3 || p.duration_days === 0 }">
          <span v-if="p.sort === 3" class="plan-hot">推荐</span>
          <span v-else-if="p.duration_days === 0" class="plan-hot">终身</span>
          <h3>{{ p.name }}</h3>
          <p class="small muted">{{ p.description }}</p>
          <div class="price"><small>¥</small>{{ (p.price_cents / 100).toFixed(p.price_cents % 100 ? 2 : 0) }}<span>/ {{ p.duration_days === 0 ? '永久' : p.duration_days + ' 天' }}</span></div>
          <ul><li v-for="f in p.features" :key="f">✓ {{ f }}</li></ul>
          <button class="btn btn-block" :class="p.sort === 3 ? 'btn-primary' : 'btn-ghost'" :disabled="busy === p.id" @click="buy(p)">
            {{ busy === p.id ? '下单中…' : (p.price_cents <= 0 ? '免费开通' : '立即开通') }}
          </button>
        </div>
      </div>
      <p class="center small muted" style="margin-top:18px">支付由微信支付 / 模拟支付完成，本系统不经手、不沉淀任何资金。</p>

      <!-- 订单是「开通权益」的交易记录，属套餐管理范畴（原误放浏览统计，2026-11-26 用户定稿迁移至此） -->
      <div class="section-title" style="margin:26px 0 12px">我的订单</div>
      <div v-if="ordersError" class="card card-pad center">
        <b>订单加载失败</b><p class="small muted">{{ ordersError }}</p>
        <button class="btn btn-sm btn-primary" style="margin-top:10px" @click="loadOrders">重新加载</button>
      </div>
      <div v-else-if="!ordersLoading && !orders.length" class="card card-pad small muted">还没有订单</div>
      <div v-else class="order-list">
        <div v-for="o in orders" :key="o.id" class="card order-item">
          <div class="order-top"><span class="mono">{{ o.orderNo }}</span><span class="badge" :class="o.status === 'paid' ? 'ok' : 'warn'">{{ statusText(o.status) }}</span></div>
          <div class="order-bottom"><b>{{ o.packageName }}</b><span class="order-amount">¥{{ (o.amountCents / 100).toFixed(2) }}</span></div>
          <div class="order-time small muted">{{ o.createdAt }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api'
import { showToast, toggleDrawer } from '../store'
import { payPreference } from '../utils/pay-env'

const router = useRouter()
const packages = ref([]); const busy = ref(0); const loadError = ref(''); const loading = ref(true)
async function load() {
  if (loading.value && packages.value.length) return
  loading.value = true; loadError.value = ''
  try { packages.value = (await api.get('/api/packages')).data.data }
  catch (e) { loadError.value = e.message || '网络异常' }
  finally { loading.value = false }
}

// 订单是「开通权益」的交易记录，属套餐管理范畴（原误放浏览统计，2026-11-26 迁移至此）
const orders = ref([]); const ordersLoading = ref(true); const ordersError = ref('')
async function loadOrders() {
  ordersLoading.value = true; ordersError.value = ''
  try {
    const d = await api.get('/api/orders/mine')
    orders.value = Array.isArray(d.data?.data) ? d.data.data : []
  } catch (e) { ordersError.value = e.message || '网络异常' }
  finally { ordersLoading.value = false }
}
function statusText(s) { return ({ paid: '已支付', pending: '待支付', cancelled: '已取消' })[s] || s }

onMounted(() => { load(); loadOrders() })

async function buy(p) {
  if (busy.value) return
  busy.value = p.id
  try {
    const pref = payPreference()
    const { data } = await api.post('/api/orders', { package_id: p.id, ...pref })
    // 0 元套餐：服务端已直接免费开通，不再跳支付页（否则会看到「等待支付」误导）
    const body = data.data
    if (body.free || body.pay?.mode === 'free' || body.order?.status === 'paid') {
      showToast(`「${p.name}」已免费开通`, 'success')
      await loadOrders()
      return
    }
    const pay = body.pay || {}
    router.push({
      path: `/me/pay/${body.order.id}`,
      query: { pay: pay.payText || '', payType: pay.payType || pay.mode || '', payParams: pay.payParams ? JSON.stringify(pay.payParams) : '' }
    })
  } catch (e) { showToast(e.message, 'error') } finally { busy.value = 0 }
}
</script>

<style scoped>
.plan-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
.plan { padding: 20px; position: relative; }
.plan.hot { border-color: var(--primary); box-shadow: 0 10px 30px rgba(37,99,235,.14); }
.plan-hot { position: absolute; right: 12px; top: 12px; font-size: 10px; background: var(--primary); color: #fff; padding: 3px 8px; border-radius: 999px; }
.plan h3 { font-size: 17px; }
.price { font-size: 32px; font-weight: 800; margin: 14px 0 10px; letter-spacing: -1px; }
.price small { font-size: 15px; margin-right: 2px; }
.price span { font-size: 12px; color: var(--muted); font-weight: 400; letter-spacing: 0; margin-left: 4px; }
.plan ul { list-style: none; margin: 0 0 18px; }
.plan li { font-size: 12px; color: var(--muted); padding: 4px 0; }

/* 订单卡片化（原在浏览统计页，属套餐/权益范畴，迁至本页） */
.section-title { font-size: 15px; font-weight: 700; }
.order-list { display: flex; flex-direction: column; gap: 10px; }
.order-item { padding: 14px; }
.order-top, .order-bottom { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.order-bottom { margin-top: 8px; }
.order-amount { color: var(--primary); font-weight: 800; }
.order-time { margin-top: 6px; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
</style>
