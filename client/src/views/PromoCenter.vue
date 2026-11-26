<template>
  <div class="page promo-page">
    <header class="topbar">
      <span class="title">推广中心</span>
      <div class="spacer"></div>
      <button class="dash-icon" aria-label="返回个人中心" @click="router.push('/me/profile')">▤</button>
      <button class="nav-menu-btn" aria-label="菜单" @click="toggleDrawer"><i class="menu-glyph"></i></button>
    </header>

    <div v-if="loading" class="container"><div class="card card-pad">加载中…</div></div>
    <div v-else-if="error" class="container">
      <div class="card card-pad center" style="padding:44px 20px">
        <div style="font-size:40px;opacity:.3">⚠️</div>
        <h2 style="margin:10px 0">推广数据加载失败</h2>
        <p class="small muted">{{ error }}</p>
        <button class="btn btn-primary" style="margin-top:16px" @click="load">重新加载</button>
      </div>
    </div>

    <div v-else class="container promo-body">
      <!-- 收益概览 + 提现入口同卡：提现是这个数字唯一对应的操作，放卡内才不会被误认为无关动作 -->
      <div class="promo-hero">
        <div class="ph-main">
          <div class="ph-label">可提现佣金</div>
          <div class="ph-amount"><span>¥</span>{{ ((summary.balanceCents || 0) / 100).toFixed(2) }}</div>
          <div class="ph-sub">累计收益 ¥{{ ((summary.totalEarnedCents || 0) / 100).toFixed(2) }} · 已邀请 {{ summary.invitees || 0 }} 人</div>
        </div>
        <button class="ph-withdraw" :disabled="loading || !!error" @click="openWithdraw">申请提现</button>
      </div>

      <!-- 全面邀请：不再单独发邀请链接——任何分享都自动带你的邀请码（仅推广员身份计入）。
           这里只做规则说明，避免用户误以为要复制某个专用链接才生效。 -->
      <div class="card card-pad invite-card">
        <div class="ic-title">邀请方式</div>
        <p class="ic-tip small muted">直接分享你的名片或任意页面即可，系统会自动带上你的邀请码；好友注册后与你绑定，之后每次开通/续费套餐你都能获得返佣。</p>
        <p class="ic-tip small muted">仅推广员身份计入推广收益；取消推广员身份后分享不再计佣。</p>
      </div>

      <!-- 规则说明：一行静态说明，不做多步骤常驻指引 -->
      <div class="rule-line small muted">
        注册奖励 ¥{{ ((rules.registerRewardCents || 0) / 100).toFixed(2) }} · 消费返佣 {{ rules.orderRate || 0 }}% · 满 ¥{{ ((rules.withdrawMinCents || 0) / 100).toFixed(2) }} 可提现
      </div>

      <!-- 明细层：分段切换 -->
      <div class="seg">
        <button v-for="t in TABS" :key="t.k" :class="{ on: tab === t.k }" @click="switchTab(t.k)">{{ t.label }}</button>
      </div>
      <div class="card card-pad list-card">
        <div v-if="tab === 'commissions'">
          <div v-if="!commissions.length" class="empty small">暂无收益记录</div>
          <div v-for="r in commissions" :key="r.id" class="row-item">
            <div class="ri-main"><b>{{ r.type === 'register' ? '注册奖励' : '消费返佣' }}</b><span class="small muted">{{ r.invitee }} · {{ r.createdAt }}</span></div>
            <div class="ri-amount">+¥{{ (r.amountCents / 100).toFixed(2) }}</div>
          </div>
        </div>
        <div v-else-if="tab === 'invitees'">
          <div v-if="!invitees.length" class="empty small">还没有邀请到用户</div>
          <div v-for="u in invitees" :key="u.id" class="row-item">
            <div class="ri-main"><b>{{ u.nickname }}</b><span class="small muted">{{ u.phone }} · {{ u.createdAt }}</span></div>
            <div class="ri-amount small muted">已付 {{ u.paidOrders }} 单</div>
          </div>
        </div>
        <div v-else>
          <div v-if="!withdrawals.length" class="empty small">暂无提现记录</div>
          <div v-for="w in withdrawals" :key="w.id" class="row-item">
            <div class="ri-main"><b>¥{{ (w.amountCents / 100).toFixed(2) }} · {{ w.channel }}</b><span class="small muted">{{ w.createdAt }}<template v-if="w.adminNote"> · {{ w.adminNote }}</template></span></div>
            <div class="ri-amount"><span class="badge" :class="w.status === 'paid' ? 'ok' : w.status === 'rejected' ? 'off' : 'warn'">{{ statusText(w.status) }}</span></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 提现操作收进弹层，不在页面常驻表单 -->
    <BottomSheet :show="withdrawOpen" @update:show="withdrawOpen = $event">
      <div class="ws-head"><b>申请提现</b><button class="btn btn-sm btn-ghost" @click="withdrawOpen = false">关闭</button></div>
      <div class="ws-body">
        <p class="small muted">可提现 ¥{{ ((summary.balanceCents || 0) / 100).toFixed(2) }} · 满 ¥{{ ((rules.withdrawMinCents || 0) / 100).toFixed(2) }} 可提</p>
        <div class="field"><label>提现金额（元）</label><input v-model.trim="wdAmount" class="input" inputmode="decimal" placeholder="如 100.00" /></div>
        <div class="field">
          <label>收款账户</label>
          <BottomSelect v-model="wdType" :options="boundChannelOptions" title="选择收款账户" placeholder="请选择已绑定账户" />
          <button class="link-btn small" type="button" @click="withdrawOpen = false; router.push('/me/withdraw-account')">管理收款账户 ›</button>
        </div>
        <button class="btn btn-primary btn-block" :disabled="wdBusy || withdrawing" @click="submitWithdraw">{{ wdBusy ? '提交中…' : '提交申请' }}</button>
        <p class="small muted ws-tip">只能提现到已绑定账户（微信用授权身份），平台审核后线下打款，驳回金额自动退回余额。</p>
      </div>
    </BottomSheet>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api'
import { showToast, toggleDrawer } from '../store'
import BottomSheet from '../components/BottomSheet.vue'
import BottomSelect from '../components/BottomSelect.vue'

const router = useRouter()
const TABS = [{ k: 'commissions', label: '收益明细' }, { k: 'invitees', label: '邀请的人' }, { k: 'withdrawals', label: '提现记录' }]

const loading = ref(true)
const error = ref('')
const summary = ref({})
const rules = ref({})
const tab = ref('commissions')
const commissions = ref([])
const invitees = ref([])
const withdrawals = ref([])
const accounts = ref([])
const boundChannelOptions = computed(() => accounts.value.filter(a => a.bound).map(a => ({ value: a.type, label: `${a.label} ${a.account}` })))
let loadStarted = false

async function load() {
  if (loadStarted && loading.value) return
  loadStarted = true
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.get('/api/promo/summary')
    summary.value = data.data || {}
    rules.value = data.data?.rules || {}
    // 账户读取失败不拖垮推广页；提现时再拦住并引导去绑定
    try {
      const { data: ad } = await api.get('/api/promo/withdraw-accounts')
      accounts.value = ad.data?.accounts || []
    } catch { accounts.value = [] }
    await loadList()
  } catch (e) { error.value = e.message || '网络异常' }
  finally { loading.value = false }
}
async function loadList() {
  const { data } = await api.get(`/api/promo/${tab.value}`)
  const rows = data.data || []
  if (tab.value === 'commissions') commissions.value = rows
  else if (tab.value === 'invitees') invitees.value = rows
  else withdrawals.value = rows
}
function switchTab(k) {
  if (tab.value === k) return
  tab.value = k
  loadList().catch(e => showToast(e.message, 'error'))
}
onMounted(load)

const withdrawOpen = ref(false)
const wdAmount = ref('')
const wdType = ref('')
const wdBusy = ref(false)
const withdrawing = ref(false)
function openWithdraw() {
  if (withdrawing.value) return
  const bound = accounts.value.filter(a => a.bound)
  if (!bound.length) {
    showToast('请先绑定收款账户', 'error')
    router.push('/me/withdraw-account')
    return
  }
  wdAmount.value = ''
  wdType.value = (bound.find(a => a.default) || bound[0]).type
  withdrawOpen.value = true
}
async function submitWithdraw() {
  if (wdBusy.value || withdrawing.value) return
  const amount = Number(wdAmount.value)
  if (!Number.isFinite(amount) || amount <= 0) return showToast('请输入正确的提现金额', 'error')
  if (!wdType.value) return showToast('请选择已绑定的收款账户', 'error')
  withdrawing.value = true
  wdBusy.value = true
  try {
    await api.post('/api/promo/withdraw', { amount_cents: Math.round(amount * 100), type: wdType.value })
    showToast('提现申请已提交', 'success')
    withdrawOpen.value = false
    await load()
  } catch (e) { showToast(e.message, 'error') }
  finally { wdBusy.value = false; withdrawing.value = false }
}

const statusText = s => ({ pending: '审核中', paid: '已打款', rejected: '已驳回' })[s] || s
</script>

<style scoped>
.promo-page { padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px)); }
.promo-body { margin-top: 12px; }
.promo-hero { display: flex; align-items: center; gap: 14px; padding: 22px 20px; border-radius: 16px; color: #fff; background: linear-gradient(122deg, #7c5a12, #b8860b 52%, #d4a72c); box-shadow: 0 8px 24px rgba(184,134,11,.22); }
.ph-main { flex: 1; min-width: 0; }
.ph-withdraw { flex: 0 0 auto; padding: 10px 16px; border: 0; border-radius: 10px; font-size: 13px; font-weight: 700; color: #7c5a12; background: #fff; box-shadow: 0 2px 10px rgba(0,0,0,.12); }
.ph-withdraw:disabled { opacity: .6; }
.ph-label { font-size: 12px; opacity: .9; }
.ph-amount { font-size: 34px; font-weight: 800; letter-spacing: -.5px; margin-top: 4px; }
.ph-amount span { font-size: 18px; margin-right: 2px; }
.ph-sub { font-size: 12px; opacity: .92; margin-top: 6px; }
.invite-card { margin-top: 12px; }
.ic-title { font-size: 12px; color: var(--muted); }
.ic-tip { margin-top: 10px; line-height: 1.6; }
.rule-line { margin: 10px 2px 2px; line-height: 1.5; }
.seg { display: flex; gap: 6px; margin: 14px 0 8px; }
.seg button { flex: 1; padding: 8px 0; border: 1px solid var(--line); border-radius: 8px; font-size: 12px; color: var(--muted); background: transparent; }
.seg button.on { border-color: var(--primary); color: var(--primary); font-weight: 700; background: #eff6ff; }
.list-card { padding-top: 4px; padding-bottom: 4px; }
.row-item { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 0; border-bottom: 1px solid var(--line); }
.row-item:last-child { border-bottom: 0; }
.ri-main { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.ri-main b { font-size: 13px; }
.ri-amount { font-weight: 700; color: #b8860b; flex-shrink: 0; }
.badge { padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
.badge.ok { color: #059669; background: #d1fae5; }
.badge.off { color: #94a3b8; background: #f1f5f9; }
.badge.warn { color: #b45309; background: #fef3c7; }
.empty { padding: 30px 0; text-align: center; color: var(--muted); }
.ws-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--line); }
.ws-body { padding: 16px; }
.field { margin-top: 12px; }
.field label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 6px; }
.input { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; font-size: 14px; }
.ws-tip { margin-top: 12px; line-height: 1.6; }
.link-btn { display: inline-block; margin-top: 6px; padding: 0; border: 0; background: transparent; color: var(--primary, #2563eb); cursor: pointer; }
</style>
