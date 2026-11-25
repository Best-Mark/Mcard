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
      <!-- 信息层：收益概览（只读展示，不夹杂操作按钮） -->
      <div class="promo-hero">
        <div class="ph-label">可提现佣金</div>
        <div class="ph-amount"><span>¥</span>{{ ((summary.balanceCents || 0) / 100).toFixed(2) }}</div>
        <div class="ph-sub">累计收益 ¥{{ ((summary.totalEarnedCents || 0) / 100).toFixed(2) }} · 已邀请 {{ summary.invitees || 0 }} 人</div>
      </div>

      <!-- 操作层：邀请码/链接统一放在一个操作卡里，信息区不铺按钮 -->
      <div class="card card-pad invite-card">
        <div class="ic-title">我的邀请码</div>
        <div class="ic-code">{{ summary.inviteCode || '-' }}</div>
        <div class="ic-link" :title="summary.inviteUrl">{{ summary.inviteUrl || '-' }}</div>
        <div class="ic-actions">
          <button class="btn btn-sm btn-primary" :disabled="!summary.inviteUrl" @click="copy(summary.inviteUrl, '邀请链接')">复制邀请链接</button>
          <button class="btn btn-sm btn-ghost" :disabled="!summary.inviteCode" @click="copy(summary.inviteCode, '邀请码')">复制邀请码</button>
        </div>
        <p class="ic-tip small muted">好友通过链接注册后即与你绑定；之后他每次开通/续费套餐，你都可获得返佣。</p>
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
        <div class="field"><label>收款方式</label><BottomSelect v-model="wdChannel" :options="CHANNELS" title="选择收款方式" placeholder="请选择" /></div>
        <div class="field"><label>收款账号</label><input v-model.trim="wdAccount" class="input" placeholder="微信/支付宝账号或银行卡号" /></div>
        <button class="btn btn-primary btn-block" :disabled="wdBusy || withdrawing" @click="submitWithdraw">{{ wdBusy ? '提交中…' : '提交申请' }}</button>
        <p class="small muted ws-tip">提交后由平台审核并线下打款，驳回金额会自动退回余额。</p>
      </div>
    </BottomSheet>

    <!-- 常驻提现入口：放在底部，不铺在信息区 -->
    <div class="promo-dock"><button class="btn btn-primary" :disabled="loading || !!error" @click="openWithdraw">申请提现</button></div>
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
const CHANNELS = [{ value: 'wechat', label: '微信' }, { value: 'alipay', label: '支付宝' }, { value: 'bank', label: '银行卡' }]

const loading = ref(true)
const error = ref('')
const summary = ref({})
const rules = ref({})
const tab = ref('commissions')
const commissions = ref([])
const invitees = ref([])
const withdrawals = ref([])
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
const wdChannel = ref('')
const wdAccount = ref('')
const wdBusy = ref(false)
const withdrawing = ref(false)
function openWithdraw() {
  if (withdrawing.value) return
  wdAmount.value = ''; wdAccount.value = ''
  withdrawOpen.value = true
}
async function submitWithdraw() {
  if (wdBusy.value || withdrawing.value) return
  const amount = Number(wdAmount.value)
  if (!Number.isFinite(amount) || amount <= 0) return showToast('请输入正确的提现金额', 'error')
  if (!wdChannel.value) return showToast('请选择收款方式', 'error')
  if (!wdAccount.value) return showToast('请填写收款账号', 'error')
  withdrawing.value = true
  wdBusy.value = true
  try {
    await api.post('/api/promo/withdraw', {
      amount_cents: Math.round(amount * 100), channel: wdChannel.value, account: wdAccount.value
    })
    showToast('提现申请已提交', 'success')
    withdrawOpen.value = false
    await load()
  } catch (e) { showToast(e.message, 'error') }
  finally { wdBusy.value = false; withdrawing.value = false }
}

const statusText = s => ({ pending: '审核中', paid: '已打款', rejected: '已驳回' })[s] || s

async function copy(v, label) {
  if (!v) return showToast(`尚未获取${label}`)
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) await navigator.clipboard.writeText(v)
    else {
      const ta = document.createElement('textarea')
      ta.value = v; ta.style.cssText = 'position:fixed;left:-9999px;opacity:0'
      document.body.appendChild(ta); ta.select()
      const ok = document.execCommand('copy'); document.body.removeChild(ta)
      if (!ok) throw new Error('copy failed')
    }
    showToast(`${label}已复制`, 'success')
  } catch { showToast('复制失败，请长按文字手动复制', 'error') }
}
</script>

<style scoped>
.promo-page { padding-bottom: calc(84px + env(safe-area-inset-bottom)); }
.promo-body { margin-top: 12px; }
.promo-hero { padding: 22px 20px; border-radius: 16px; color: #fff; background: linear-gradient(122deg, #7c5a12, #b8860b 52%, #d4a72c); box-shadow: 0 8px 24px rgba(184,134,11,.22); }
.ph-label { font-size: 12px; opacity: .9; }
.ph-amount { font-size: 34px; font-weight: 800; letter-spacing: -.5px; margin-top: 4px; }
.ph-amount span { font-size: 18px; margin-right: 2px; }
.ph-sub { font-size: 12px; opacity: .92; margin-top: 6px; }
.invite-card { margin-top: 12px; }
.ic-title { font-size: 12px; color: var(--muted); }
.ic-code { font-size: 22px; font-weight: 800; letter-spacing: 2px; margin-top: 4px; }
.ic-link { font-size: 12px; color: var(--primary); word-break: break-all; margin-top: 6px; }
.ic-actions { display: flex; gap: 10px; margin-top: 12px; }
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
.promo-dock { position: fixed; left: 0; right: 0; bottom: 0; z-index: 105; padding: 10px 16px calc(10px + env(safe-area-inset-bottom)); background: var(--bg-card, #fff); border-top: 1px solid var(--line); }
@media (min-width: 900px) { .promo-dock { max-width: 560px; left: 50%; right: auto; transform: translateX(-50%); } }
.ws-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--line); }
.ws-body { padding: 16px; }
.field { margin-top: 12px; }
.field label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 6px; }
.input { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; font-size: 14px; }
.ws-tip { margin-top: 12px; line-height: 1.6; }
</style>
