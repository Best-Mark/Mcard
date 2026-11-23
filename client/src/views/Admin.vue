<template>
  <!-- 后台登录 -->
  <div v-if="!logged" class="login-wrap">
    <div class="card card-pad login-card">
      <div class="brand">M<em>Card</em> 管理后台</div>
      <h2 style="margin:18px 0 6px">管理员登录</h2>
      <p class="small muted" style="margin-bottom:18px">默认账号 admin / admin123456，部署后请立即修改</p>
      <div class="field"><label>账号（手机号）</label><input v-model.trim="phone" class="input" @keyup.enter="login" /></div>
      <div class="field"><label>密码</label><input v-model="password" class="input" type="password" @keyup.enter="login" /></div>
      <button class="btn btn-primary btn-block btn-lg" :disabled="busy" @click="login">{{ busy ? '登录中…' : '登录后台' }}</button>
      <router-link to="/" class="small muted" style="display:block;text-align:center;margin-top:14px">返回首页</router-link>
    </div>
  </div>

  <!-- 后台主体 -->
  <div v-else class="admin-layout">
    <aside class="side">
      <div class="side-brand">M<em>Card</em><small>管理后台</small></div>
      <button v-for="m in menus" :key="m.k" :class="{ on: tab === m.k }" @click="switchTab(m.k)">{{ m.t }}</button>
      <div class="side-foot">
        <router-link to="/" target="_blank">查看前台 ↗</router-link>
        <button @click="logout">退出登录</button>
      </div>
    </aside>

    <main class="main">
      <header class="topbar">
        <b>{{ menus.find(m => m.k === tab)?.t }}</b>
        <div class="spacer"></div>
        <span class="small muted">{{ adminAuth.user?.nickname }} ({{ adminAuth.user?.phone }})</span>
      </header>

      <div class="main-body">
        <!-- 概览 -->
        <section v-if="tab === 'overview'">
          <div class="stat-grid">
            <div class="stat"><b>{{ stats.users || 0 }}</b><span>注册用户</span></div>
            <div class="stat"><b>{{ stats.cards || 0 }}</b><span>名片总数</span></div>
            <div class="stat"><b>{{ stats.activeCards || 0 }}</b><span>已开通名片</span></div>
            <div class="stat"><b>{{ stats.paidOrders || 0 }}</b><span>已支付订单</span></div>
            <div class="stat"><b>¥{{ ((stats.revenueCents || 0) / 100).toFixed(2) }}</b><span>累计收入</span></div>
            <div class="stat"><b>{{ stats.todayViews || 0 }}</b><span>今日浏览</span></div>
          </div>
          <div class="section-title">最近订单</div>
          <div class="table-wrap"><table><thead><tr><th>订单号</th><th>用户</th><th>套餐</th><th>金额</th><th>状态</th><th>时间</th></tr></thead>
            <tbody><tr v-for="o in stats.recentOrders || []" :key="o.id">
              <td class="mono">{{ o.order_no }}</td><td>{{ o.phone }}</td><td>{{ o.package_name }}</td>
              <td>¥{{ (o.amount_cents / 100).toFixed(2) }}</td>
              <td><span class="badge" :class="o.status === 'paid' ? 'ok' : 'warn'">{{ o.status }}</span></td><td>{{ o.created_at }}</td>
            </tr></tbody></table></div>
          <div class="section-title">最近名片</div>
          <div class="table-wrap"><table><thead><tr><th>短码</th><th>姓名</th><th>公司</th><th>状态</th><th>浏览</th><th>用户</th></tr></thead>
            <tbody><tr v-for="c in stats.recentCards || []" :key="c.id">
              <td><router-link :to="`/c/${c.slug}`" target="_blank" class="mono">{{ c.slug }}</router-link></td>
              <td>{{ c.name }}</td><td>{{ c.company }}</td>
              <td><span class="badge" :class="c.status === 'active' ? 'ok' : 'off'">{{ c.status }}</span></td>
              <td>{{ c.views }}</td><td>{{ c.user_phone }}</td>
            </tr></tbody></table></div>
        </section>

        <!-- 套餐 -->
        <section v-if="tab === 'packages'">
          <div class="section-title" style="margin-top:0">
            时段套餐
            <button class="btn btn-primary btn-sm" style="margin-left:auto" @click="openPkg()">+ 新建套餐</button>
          </div>
          <div class="table-wrap"><table><thead><tr><th>名称</th><th>价格</th><th>天数</th><th>权益</th><th>排序</th><th>状态</th><th>操作</th></tr></thead>
            <tbody><tr v-for="p in packages" :key="p.id">
              <td><b>{{ p.name }}</b><div class="small muted">{{ p.description }}</div></td>
              <td>¥{{ (p.price_cents / 100).toFixed(2) }}</td><td>{{ p.duration_days }} 天</td>
              <td class="small muted">{{ (p.features || []).join(' / ') }}</td><td>{{ p.sort }}</td>
              <td><span class="badge" :class="p.enabled ? 'ok' : 'off'">{{ p.enabled ? '上架' : '下架' }}</span></td>
              <td><button class="btn btn-sm btn-ghost" @click="openPkg(p)">编辑</button>
                  <button class="btn btn-sm btn-danger" @click="delPkg(p)">删除</button></td>
            </tr></tbody></table></div>
        </section>

        <!-- 名片 -->
        <section v-if="tab === 'cards'">
          <div class="section-title" style="margin-top:0">名片管理</div>
          <div class="filter-row"><input v-model.trim="cardQ" class="input" placeholder="搜索姓名 / 公司 / 短码 / 手机号" @keyup.enter="loadCards" />
            <select v-model="cardStatus" class="select" @change="loadCards"><option value="">全部状态</option><option value="active">已开通</option><option value="draft">草稿</option><option value="expired">已过期</option><option value="disabled">已停用</option></select>
            <button class="btn btn-primary" @click="loadCards">搜索</button></div>
          <div class="table-wrap"><table><thead><tr><th>短码</th><th>姓名</th><th>公司</th><th>用户</th><th>状态</th><th>浏览</th><th>到期</th><th>操作</th></tr></thead>
            <tbody><tr v-for="c in cards" :key="c.id">
              <td><router-link :to="`/c/${c.slug}`" target="_blank" class="mono">{{ c.slug }}</router-link></td>
              <td>{{ c.name }}</td><td>{{ c.company }}</td><td>{{ c.user_phone }}</td>
              <td><span class="badge" :class="c.status === 'active' ? 'ok' : 'off'">{{ c.status }}</span></td>
              <td>{{ c.views }}</td><td>{{ c.expires_at || '-' }}</td>
              <td><button class="btn btn-sm btn-ghost" @click="setCardStatus(c, 'disabled')">停用</button>
                  <button class="btn btn-sm btn-ghost" @click="setCardStatus(c, 'active')">启用</button></td>
            </tr></tbody></table></div>
        </section>

        <!-- 订单 -->
        <section v-if="tab === 'orders'">
          <div class="section-title" style="margin-top:0">订单管理</div>
          <div class="filter-row"><select v-model="orderStatus" class="select" @change="loadOrders"><option value="">全部状态</option><option value="pending">待支付</option><option value="paid">已支付</option><option value="cancelled">已取消</option></select>
            <button class="btn btn-primary" @click="loadOrders">筛选</button></div>
          <div class="table-wrap"><table><thead><tr><th>订单号</th><th>用户</th><th>套餐</th><th>金额</th><th>状态</th><th>支付单号</th><th>时间</th><th>操作</th></tr></thead>
            <tbody><tr v-for="o in orders" :key="o.id">
              <td class="mono">{{ o.order_no }}</td><td>{{ o.user_phone }}</td><td>{{ o.package_name }}</td>
              <td>¥{{ (o.amount_cents / 100).toFixed(2) }}</td>
              <td><span class="badge" :class="o.status === 'paid' ? 'ok' : 'warn'">{{ o.status }}</span></td>
              <td class="small muted">{{ o.pay_no || '-' }}</td><td>{{ o.created_at }}</td>
              <td><button v-if="o.status !== 'paid'" class="btn btn-sm btn-primary" @click="markPaid(o)">标记已支付</button></td>
            </tr></tbody></table></div>
        </section>

        <!-- 用户 -->
        <section v-if="tab === 'users'">
          <div class="section-title" style="margin-top:0">用户管理</div>
          <div class="table-wrap"><table><thead><tr><th>手机号</th><th>昵称</th><th>角色</th><th>名片数</th><th>已付订单</th><th>状态</th><th>操作</th></tr></thead>
            <tbody><tr v-for="u in users" :key="u.id">
              <td>{{ u.phone }}</td><td>{{ u.nickname }}</td><td>{{ u.role }}</td><td>{{ u.card_count }}</td><td>{{ u.paid_orders }}</td>
              <td><span class="badge" :class="u.status === 'active' ? 'ok' : 'off'">{{ u.status }}</span></td>
              <td><button class="btn btn-sm btn-ghost" :disabled="u.role === 'super_admin'" @click="setUserStatus(u)">{{ u.status === 'active' ? '停用' : '启用' }}</button></td>
            </tr></tbody></table></div>
        </section>

        <!-- 配置 -->
        <section v-if="tab === 'config'">
          <div class="section-title" style="margin-top:0">站点配置</div>
          <div class="card card-pad" style="max-width:560px">
            <div class="field"><label>站点名称</label><input v-model="cfg.site_name" class="input" /></div>
            <div class="field"><label>站点简介</label><input v-model="cfg.site_desc" class="input" /></div>
            <div class="field"><label>联系方式</label><input v-model="cfg.contact" class="input" /></div>
            <div class="field"><label>公告</label><textarea v-model="cfg.notice" class="textarea"></textarea></div>
            <div class="field"><label>二维码中心品牌字</label><input v-model="cfg.qr_brand" class="input" maxlength="2" /></div>
            <button class="btn btn-primary" :disabled="busy" @click="saveConfig">{{ busy ? '保存中…' : '保存配置' }}</button>
          </div>
        </section>

        <!-- 版本更新 -->
        <section v-if="tab === 'update'">
          <div class="section-title" style="margin-top:0">版本更新 <small>手动检查 / 自动更新</small></div>
          <div class="card card-pad">
            <div class="ver-grid">
              <div><span>当前版本</span><b>v{{ updateInfo.current || '-' }}</b></div>
              <div><span>最新版本</span><b :class="{ hot: checkResult?.hasUpdate }">{{ checkResult ? 'v' + checkResult.latest : '未检查' }}</b></div>
              <div><span>检查时间</span><b class="small">{{ fmtTime(updateInfo.config?.lastCheck) }}</b></div>
              <div><span>任务状态</span><b class="small">{{ updateInfo.busy ? '更新中…' : '空闲' }}</b></div>
            </div>
            <div class="btn-row" style="margin-top:14px">
              <button class="btn btn-primary" :disabled="updBusy" @click="checkUpdate">{{ updBusy ? '处理中…' : '检查更新' }}</button>
              <button v-if="checkResult?.hasUpdate" class="btn btn-ok" :disabled="updBusy" @click="applyOpen = true">立即更新</button>
              <span v-if="checkResult && !checkResult.hasUpdate" class="badge ok">已是最新版本</span>
              <span v-if="checkResult?.stale" class="badge warn">网络不可用 · 缓存结果</span>
            </div>
            <p class="small muted" style="margin-top:12px">更新来源：GitHub Release（无 Release 时读取远端仓库 package.json 的 version）。更新会拉取代码、按变更重建前端并按需重启服务。</p>
          </div>

          <div v-if="checkResult" class="card card-pad" style="margin-top:14px">
            <div class="section-title" style="margin-top:0">更新说明 <small>来源 {{ checkResult.source }}</small></div>
            <pre class="notes">{{ checkResult.notes || '无更新说明' }}</pre>
            <a v-if="checkResult.url" :href="checkResult.url" target="_blank" class="small" style="color:var(--primary)">查看发布页 ↗</a>
          </div>

          <div class="card card-pad" style="margin-top:14px;max-width:620px">
            <div class="section-title" style="margin-top:0">自动更新设置</div>
            <div class="field"><label>GitHub 仓库（所有者/仓库名）</label><input v-model="updCfg.repo" class="input" /></div>
            <div class="field"><label>分支</label><input v-model="updCfg.branch" class="input" /></div>
            <div class="grid2">
              <label class="check"><input type="checkbox" v-model="updCfg.autoCheck" /> 定时自动检查</label>
              <label class="check"><input type="checkbox" v-model="updCfg.autoApply" /> 发现新版本自动更新</label>
            </div>
            <div class="field" style="margin-top:12px"><label>检查间隔（小时，1–720）</label><input v-model.number="updCfg.intervalHours" class="input" type="number" min="1" max="720" /></div>
            <div class="hint warm" style="margin-bottom:12px">自动更新会直接拉取代码并重启服务，建议先开启「自动检查」确认稳定后再打开自动更新。</div>
            <button class="btn btn-primary" :disabled="updBusy" @click="saveUpdateConfig">保存设置</button>
          </div>

          <div v-if="updateInfo.config?.lastResult" class="card card-pad" style="margin-top:14px">
            <div class="section-title" style="margin-top:0">最近一次记录</div>
            <pre class="notes">{{ JSON.stringify(updateInfo.config.lastResult, null, 2) }}</pre>
          </div>
        </section>
      </div>
    </main>

    <div v-if="applyOpen" class="modal-mask" @click.self="applyOpen = false">
      <div class="modal">
        <h3>确认立即更新？</h3>
        <p>将从 {{ updCfg.repo }} / {{ updCfg.branch }} 拉取代码；如有前后端变更会自动重建。服务端变更会触发进程重启，期间接口短暂不可用。</p>
        <div class="btn-row" style="justify-content:flex-end">
          <button class="btn btn-ghost" @click="applyOpen = false">取消</button>
          <button class="btn btn-primary" :disabled="updBusy" @click="applyUpdate">{{ updBusy ? '更新中…' : '确认更新' }}</button>
        </div>
      </div>
    </div>

    <!-- 套餐编辑弹窗 -->
    <div v-if="pkgModal" class="modal-mask" @click.self="pkgModal = false">
      <div class="modal">
        <h3>{{ pkgForm.id ? '编辑套餐' : '新建套餐' }}</h3>
        <div class="grid2">
          <div class="field"><label>名称</label><input v-model="pkgForm.name" class="input" /></div>
          <div class="field"><label>价格（元）</label><input v-model.number="pkgPrice" class="input" type="number" min="0" step="0.01" /></div>
          <div class="field"><label>有效天数</label><input v-model.number="pkgForm.duration_days" class="input" type="number" min="1" /></div>
          <div class="field"><label>排序</label><input v-model.number="pkgForm.sort" class="input" type="number" /></div>
        </div>
        <div class="field"><label>说明</label><input v-model="pkgForm.description" class="input" /></div>
        <div class="field"><label>权益（逗号分隔）</label><input v-model="pkgFeatures" class="input" /></div>
        <label class="check"><input type="checkbox" v-model="pkgForm.enabled" /> 上架销售</label>
        <div class="btn-row" style="justify-content:flex-end;margin-top:16px">
          <button class="btn btn-ghost" @click="pkgModal = false">取消</button>
          <button class="btn btn-primary" :disabled="busy" @click="savePkg">{{ busy ? '保存中…' : '保存' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api'
import { adminAuth, setAdminAuth, adminLogout, showToast } from '../store'

const menus = [
  { k: 'overview', t: '数据概览' }, { k: 'packages', t: '时段套餐' }, { k: 'cards', t: '名片管理' },
  { k: 'orders', t: '订单管理' }, { k: 'users', t: '用户管理' }, { k: 'config', t: '站点配置' },
  { k: 'update', t: '版本更新' }
]
const logged = computed(() => !!adminAuth.token)
const phone = ref(''); const password = ref(''); const busy = ref(false)
const tab = ref('overview'); const stats = ref({}); const packages = ref([]); const cards = ref([])
const orders = ref([]); const users = ref([]); const cfg = ref({})
const cardQ = ref(''); const cardStatus = ref(''); const orderStatus = ref('')
const pkgModal = ref(false); const pkgForm = ref({}); const pkgFeatures = ref('')
const updateInfo = ref({}); const checkResult = ref(null); const updCfg = ref({})
const updBusy = ref(false); const applyOpen = ref(false)
const fmtTime = v => v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '从未检查'
const pkgPrice = computed({ get: () => (pkgForm.value.price_cents || 0) / 100, set: v => { pkgForm.value.price_cents = Math.round(Number(v) * 100) } })

async function login() {
  busy.value = true
  try {
    const { data } = await api.post('/api/admin/login', { phone: phone.value, password: password.value })
    setAdminAuth(data.data.token, data.data.user)
    showToast('登录成功', 'success'); loadTab('overview')
  } catch (e) { showToast(e.message, 'error') } finally { busy.value = false }
}
function logout() { adminLogout(); tab.value = 'overview' }

function switchTab(k) { tab.value = k; loadTab(k) }
async function loadTab(k) {
  try {
    if (k === 'overview') stats.value = (await api.get('/api/admin/overview')).data.data
    if (k === 'packages') packages.value = (await api.get('/api/admin/packages')).data.data
    if (k === 'cards') await loadCards()
    if (k === 'orders') await loadOrders()
    if (k === 'users') users.value = (await api.get('/api/admin/users')).data.data
    if (k === 'config') cfg.value = (await api.get('/api/admin/config')).data.data
    if (k === 'update') await loadUpdate()
  } catch (e) { showToast(e.message, 'error') }
}
async function loadCards() {
  cards.value = (await api.get('/api/admin/cards', { params: { q: cardQ.value, status: cardStatus.value } })).data.data
}
async function loadOrders() {
  orders.value = (await api.get('/api/admin/orders', { params: { status: orderStatus.value } })).data.data
}
onMounted(() => { if (logged.value) loadTab('overview') })

function openPkg(p) {
  pkgForm.value = p ? { ...p } : { name: '', price_cents: 1900, duration_days: 30, features: [], sort: 0, enabled: true }
  pkgFeatures.value = (pkgForm.value.features || []).join(', ')
  pkgModal.value = true
}
async function savePkg() {
  busy.value = true
  try {
    const payload = { ...pkgForm.value, features: pkgFeatures.value.split(/[,，]/).map(s => s.trim()).filter(Boolean) }
    if (payload.id) await api.put(`/api/admin/packages/${payload.id}`, payload)
    else await api.post('/api/admin/packages', payload)
    showToast('套餐已保存', 'success'); pkgModal.value = false; loadTab('packages')
  } catch (e) { showToast(e.message, 'error') } finally { busy.value = false }
}
async function delPkg(p) {
  if (!confirm(`确定删除/下架「${p.name}」？`)) return
  try { await api.delete(`/api/admin/packages/${p.id}`); loadTab('packages'); showToast('已处理', 'success') }
  catch (e) { showToast(e.message, 'error') }
}
async function setCardStatus(c, status) {
  try { await api.put(`/api/admin/cards/${c.id}/status`, { status }); loadCards(); showToast('状态已更新', 'success') }
  catch (e) { showToast(e.message, 'error') }
}
async function markPaid(o) {
  try { await api.post(`/api/orders/${o.id}/mark-paid`); loadOrders(); showToast('已标记支付，名片已开通', 'success') }
  catch (e) { showToast(e.message, 'error') }
}
async function setUserStatus(u) {
  try { await api.put(`/api/admin/users/${u.id}/status`, { status: u.status === 'active' ? 0 : 1 }); loadTab('users'); showToast('已更新', 'success') }
  catch (e) { showToast(e.message, 'error') }
}
async function saveConfig() {
  busy.value = true
  try { await api.put('/api/admin/config', cfg.value); showToast('配置已保存', 'success') }
  catch (e) { showToast(e.message, 'error') } finally { busy.value = false }
}

async function loadUpdate() {
  const d = await api.get('/api/admin/update/status')
  updateInfo.value = d.data
  updCfg.value = { ...d.data.config }
  if (d.data.config?.lastResult?.kind === 'check') checkResult.value = d.data.config.lastResult
}
async function checkUpdate() {
  updBusy.value = true
  try {
    checkResult.value = await api.post('/api/admin/update/check')
    showToast(checkResult.value.stale ? '远端不可用，已显示上次检查结果' : (checkResult.value.hasUpdate ? `发现新版本 v${checkResult.value.latest}` : '已是最新版本'), checkResult.value.stale ? 'error' : 'success')
    await loadUpdate()
  }
  catch (e) { showToast(e.message, 'error') } finally { updBusy.value = false }
}
async function applyUpdate() {
  updBusy.value = true
  try {
    const r = await api.post('/api/admin/update/apply')
    showToast(r.updated ? '更新完成' : (r.message || '无需更新'), 'success')
    applyOpen.value = false
    await loadUpdate()
    if (r.restartRequired) showToast(r.restartScheduled ? '服务端变更已更新，正在自动重启' : '服务端已更新，请手动重启 Node 进程', 'success')
  } catch (e) { showToast(e.message, 'error') } finally { updBusy.value = false }
}
async function saveUpdateConfig() {
  updBusy.value = true
  try { await api.put('/api/admin/update/config', updCfg.value); showToast('更新设置已保存', 'success'); await loadUpdate() }
  catch (e) { showToast(e.message, 'error') } finally { updBusy.value = false }
}
</script>

<style scoped>
.login-wrap { min-height: 100vh; display: grid; place-items: center; padding: 20px; background: radial-gradient(800px 400px at 30% 0,#dbeafe,transparent); }
.login-card { width: min(100%,400px); }
.brand { font-size: 20px; font-weight: 800; }
.brand em { color: var(--primary); font-style: normal; }
.admin-layout { display: flex; min-height: 100vh; }
.side { width: 204px; flex: 0 0 204px; background: #0f172a; color: #cbd5e1; padding: 18px 12px; display: flex; flex-direction: column; }
.side-brand { font-size: 20px; font-weight: 800; color: #fff; padding: 4px 10px 22px; }
.side-brand em { color: #60a5fa; font-style: normal; }
.side-brand small { display: block; font-size: 11px; color: #64748b; font-weight: 400; }
.side button { text-align: left; padding: 10px 12px; border-radius: 8px; font-size: 13px; color: #cbd5e1; }
.side button:hover { background: #1e293b; }
.side button.on { background: #2563eb; color: #fff; font-weight: 700; }
.side-foot { margin-top: auto; border-top: 1px solid #1e293b; padding-top: 12px; display: flex; flex-direction: column; gap: 4px; }
.side-foot a, .side-foot button { font-size: 12px; color: #94a3b8; }
.main { flex: 1; min-width: 0; }
.main-body { padding: 18px 22px 60px; }
.filter-row { display: flex; gap: 10px; margin-bottom: 12px; max-width: 640px; }
.filter-row .input { flex: 1; }
.filter-row .select { width: 150px; }
.check { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.ver-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; }
.ver-grid > div { background: #f8fafc; border-radius: 10px; padding: 12px; }
.ver-grid span { display: block; font-size: 11px; color: var(--muted); margin-bottom: 4px; }
.ver-grid b { font-size: 17px; }
.ver-grid b.hot { color: var(--primary); }
.notes { white-space: pre-wrap; word-break: break-word; background: #f8fafc; border-radius: 10px; padding: 12px; font-size: 12px; color: #475569; max-height: 240px; overflow: auto; line-height: 1.6; }
@media (max-width: 760px) { .side { width: 64px; flex-basis: 64px; } .side-brand, .side button { font-size: 0; text-align: center; } .side-brand small, .side-foot { display: none; } .side button::first-letter { font-size: 14px; } }
</style>
