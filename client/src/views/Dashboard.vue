<template>
  <div class="dash-page" :class="'dash-tpl-' + (card?.template || 'classic')" :style="cardVars">
    <!-- 顶部栏：品牌 + 分享/扫码 + 菜单 -->
    <header class="dash-top">
      <router-link to="/" class="dash-brand">M<em>Card</em></router-link>
      <div class="spacer"></div>
      <button class="dash-icon" aria-label="分享名片" @click="doShare">↗</button>
      <button class="dash-icon" aria-label="二维码" @click="qrModal = true">▦</button>
      <button class="dash-icon" aria-label="菜单" @click="menuOpen = true">☰</button>
    </header>

    <!-- 加载 / 错误 / 未创建 -->
    <div v-if="loading" class="container dash-loading"><div class="card card-pad">加载中…</div></div>
    <div v-else-if="loadError" class="container dash-loading">
      <div class="card card-pad center" style="padding:44px 20px">
        <div style="font-size:40px;opacity:.3">⚠️</div>
        <h2 style="margin:10px 0">数据加载失败</h2>
        <p class="muted small">{{ loadError }}</p>
        <button class="btn btn-primary" style="margin-top:16px" :disabled="loading" @click="load">重新加载</button>
      </div>
    </div>
    <div v-else-if="!card" class="container dash-loading">
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
    </div>

    <!-- 成品名片（持有者视角） -->
    <template v-else>
      <div class="cv-cover">
        <div class="cv-brand">M<em>Card</em></div>
        <button class="cv-edit-cover" @click="goEdit('identity')">✎ 编辑封面资料</button>
      </div>

      <div class="container cv-main">
        <!-- 身份区 -->
        <div class="card cv-profile">
          <button class="block-edit" @click="goEdit('identity')" aria-label="编辑身份">✎</button>
          <div class="cv-avatar">
            <img v-if="card.avatar" :src="card.avatar" :alt="card.name" />
            <span v-else>{{ (card.name || '名').slice(0, 1) }}</span>
          </div>
          <div class="cv-ident">
            <div class="cv-name">
              {{ card.name || '点击填写姓名' }}
              <span v-if="card.name_en" class="cv-en">{{ card.name_en }}</span>
            </div>
            <div class="cv-title">{{ identityLine || '点击完善职位与公司' }}</div>
            <div v-if="card.tags?.length" class="cv-tags"><span v-for="tag in card.tags" :key="tag">{{ tag }}</span></div>
            <span v-if="!card.active" class="badge warn" style="margin-top:8px;display:inline-block">未开通 / 已到期</span>
          </div>
        </div>

        <!-- 完成度引导 -->
        <div class="card card-pad dash-progress-block">
          <div class="progress-head">
            <b>完善你的名片</b>
            <span class="small muted">{{ completedCount }}/{{ checklist.length }} 项已完成</span>
          </div>
          <div class="progress-track"><i :style="{ width: progressPct + '%' }"></i></div>
          <div class="check-list">
            <button v-for="item in checklist" :key="item.key" class="check-item" :class="{ done: item.done }" @click="goEdit(item.focus)">
              <span class="check-ico">{{ item.done ? '✓' : '+' }}</span>
              <span class="check-label">{{ item.label }}</span>
              <span class="check-hint small muted">{{ item.done ? '已完成' : item.hint }}</span>
              <span class="check-arrow">›</span>
            </button>
          </div>
        </div>

        <!-- 快速联系操作（访客视角同款） -->
        <div class="card cv-actions" v-if="hasContact">
          <button @click="tel(card.mobile || card.phone)"><i>✆</i><span>打电话</span></button>
          <button @click="sms(card.mobile)"><i>✎</i><span>发短信</span></button>
          <button @click="mailto(card.email)"><i>✉</i><span>写邮件</span></button>
          <button @click="copy(card.wechat, '微信号')"><i>微</i><span>微信</span></button>
          <button @click="copy(card.alipay, '支付宝账号')"><i>支</i><span>支付宝</span></button>
        </div>
        <div v-else class="card card-pad contact-empty">
          <span>还没有联系方式</span>
          <button class="btn btn-sm btn-ghost" @click="goEdit('contact')">去添加 ›</button>
        </div>

        <!-- 联系方式明细 -->
        <div v-if="hasContact" class="card card-pad cv-block">
          <button class="block-edit" @click="goEdit('contact')" aria-label="编辑联系方式">✎</button>
          <h3>联系方式</h3>
          <div class="contact-list">
            <div v-if="card.mobile" class="contact-row"><span>手机</span><b>{{ card.mobile }}</b><button @click="copy(card.mobile, '手机号')">复制</button></div>
            <div v-if="card.phone" class="contact-row"><span>座机</span><b>{{ card.phone }}</b><button @click="copy(card.phone, '座机')">复制</button></div>
            <div v-if="card.email" class="contact-row"><span>邮箱</span><b>{{ card.email }}</b><button @click="copy(card.email, '邮箱')">复制</button></div>
            <div v-if="card.wechat" class="contact-row"><span>微信</span><b>{{ card.wechat }}</b><button @click="copy(card.wechat, '微信号')">复制</button></div>
            <div v-if="card.address" class="contact-row"><span>地址</span><b>{{ card.address }} {{ card.address_detail }}</b><button @click="goMap">导航</button></div>
          </div>
        </div>

        <!-- 简介 -->
        <div v-if="card.bio" class="card card-pad cv-block">
          <button class="block-edit" @click="goEdit('bio')" aria-label="编辑简介">✎</button>
          <h3>关于我</h3><p class="cv-bio">{{ card.bio }}</p>
        </div>
        <div v-if="card.company_intro" class="card card-pad cv-block">
          <button class="block-edit" @click="goEdit('bio')" aria-label="编辑公司简介">✎</button>
          <h3>公司简介 <span class="small muted" v-if="card.company">· {{ card.company }}</span></h3>
          <p class="cv-bio">{{ card.company_intro }}</p>
        </div>

        <!-- 更多链接 -->
        <div v-if="card.links?.length" class="card card-pad cv-block">
          <button class="block-edit" @click="goEdit('links')" aria-label="编辑链接">✎</button>
          <h3>更多链接</h3>
          <div class="cv-links">
            <a v-for="(l, i) in card.links" :key="i" :href="safeUrl(l.url)" target="_blank" rel="noopener">
              <b>{{ l.label || '链接' }}</b><span>{{ shortUrl(l.url) }} ↗</span>
            </a>
          </div>
        </div>

        <!-- 二维码卡 -->
        <div class="card card-pad cv-qr-card">
          <button class="cv-qr-img" @click="qrModal = true" title="点击查看大图">
            <img :src="qrApi + '/qr.svg?size=440'" alt="名片二维码" />
          </button>
          <div class="cv-qr-info">
            <h3>扫一扫，存入通讯录</h3>
            <p class="small muted">二维码永久固定，资料更新也不会失效。可印在实体名片、工牌、易拉宝上。</p>
            <div class="btn-row" style="margin-top:10px">
              <button class="btn btn-primary btn-sm" @click="saveQr">保存二维码</button>
              <button class="btn btn-ghost btn-sm" @click="saveContact">存入通讯录</button>
              <button class="btn btn-ghost btn-sm" @click="doShare">分享</button>
            </div>
          </div>
        </div>

        <p class="cv-footer">由 <b>{{ siteConfig.site_name }}</b> 提供技术支持 · 资料可改 · 二维码不变</p>
      </div>

      <!-- 底部常驻操作：拨号优先，分享放右下悬浮主按钮（拇指最顺手） -->
      <div class="cv-dock">
        <button v-if="card.mobile || card.phone" class="btn btn-primary" @click="tel(card.mobile || card.phone)">📞 打电话</button>
        <button class="btn btn-ghost" @click="saveContact">存入通讯录</button>
        <button class="btn btn-ghost" @click="qrModal = true">二维码</button>
      </div>
      <button class="share-fab" @click="doShare" aria-label="分享名片">↗<span>分享</span></button>
    </template>

    <!-- 可收缩侧边菜单 -->
    <div v-if="menuOpen" class="drawer-mask" @click.self="menuOpen = false">
      <aside class="drawer">
        <div class="drawer-head">
          <div>
            <b>{{ auth.user?.phone || '我的账户' }}</b>
            <span class="small muted">我的名片工作台</span>
          </div>
          <button class="dash-icon" @click="menuOpen = false" aria-label="关闭">✕</button>
        </div>
        <nav class="drawer-nav">
          <router-link to="/me" @click="menuOpen = false"><i>▤</i>我的名片</router-link>
          <router-link to="/me/card" @click="menuOpen = false"><i>✎</i>编辑资料</router-link>
          <router-link :to="`/c/${card?.slug || ''}`" @click="menuOpen = false"><i>↗</i>公开名片页</router-link>
          <router-link to="/me/contacts" @click="menuOpen = false"><i>★</i>我的名片夹</router-link>
          <div class="drawer-sep">数据与运营</div>
          <button @click="scrollToStats"><i>📊</i>浏览统计</button>
          <router-link to="/me/plans" @click="menuOpen = false"><i>💎</i>套餐 / 续期</router-link>
          <router-link to="/me/print" @click="menuOpen = false"><i>🖨</i>实体名片版式</router-link>
          <button @click="menuOpen = false; qrModal = true"><i>▦</i>我的二维码</button>
        </nav>
        <div class="drawer-foot"><button class="btn btn-ghost btn-block" @click="doLogout">退出登录</button></div>
      </aside>
    </div>

    <!-- 数据中心（侧栏「浏览统计」滚到这里） -->
    <template v-if="card && !loading && !loadError">
      <div class="container dash-data" id="dash-data">
        <div class="stat-grid">
          <div class="stat"><b>{{ stats.views }}</b><span>累计浏览</span></div>
          <div class="stat"><b>{{ stats.exchanges }}</b><span>交换名片</span></div>
          <div class="stat"><b>{{ card.active ? (card.expires_at ? expireDays : '永久') : 0 }}</b><span>剩余有效天数</span></div>
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
      </div>
    </template>

    <!-- 二维码大图 -->
    <div v-if="qrModal" class="modal-mask" @click.self="qrModal = false">
      <div class="modal center">
        <h3>扫码保存名片</h3>
        <img :src="qrApi + '/qr.svg?size=640'" style="width:240px;height:240px;margin:12px auto" alt="二维码大图" />
        <p class="small">长按图片可保存，或用浏览器打开下载</p>
        <div class="btn-row" style="justify-content:center">
          <button class="btn btn-primary" @click="saveQr">下载二维码</button>
          <button class="btn btn-ghost" @click="qrModal = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api'
import { auth, logout, showToast, siteConfig } from '../store'
import { THEMES, themeOf, themeVars } from '../utils/themes'
import { isWeChat, saveImageUrl } from '../utils/save-image'
import { shareOrCopy, mapLinks } from '../utils/share'

const router = useRouter()
const card = ref(null); const stats = ref({ views: 0, exchanges: 0, daily: [] }); const orders = ref([])
const loading = ref(true); const busy = ref(false); const newSlug = ref(''); const loadError = ref('')
const menuOpen = ref(false); const qrModal = ref(false)
let loadStarted = false
const qrApi = computed(() => `/api/cards/public/${card.value?.slug || ''}`)
const t = computed(() => themeOf({ theme: THEMES[card.value?.theme] ? card.value.theme : 'ocean', accent: card.value?.accent }))
const cardVars = computed(() => card.value ? themeVars(t.value) : {})
const maps = computed(() => mapLinks(card.value?.address || ''))
const maxView = computed(() => Math.max(1, ...(stats.value.daily || []).map(d => d.n)))
const expireDays = computed(() => card.value?.expires_at ? Math.max(0, Math.ceil((new Date(String(card.value.expires_at).replace(' ', 'T') + 'Z') - Date.now()) / 86400000)) : 0)
const identityLine = computed(() => [card.value?.title, card.value?.company, card.value?.department].filter(Boolean).join(' · '))
const hasContact = computed(() => !!(card.value?.mobile || card.value?.phone || card.value?.email || card.value?.wechat || card.value?.alipay || card.value?.address))
const checklist = computed(() => {
  const c = card.value || {}
  return [
    { key: 'identity', label: '姓名 / 职位 / 公司', hint: '访客第一眼看到的身份', focus: 'identity', done: !!(c.name && (c.title || c.company)) },
    { key: 'contact', label: '联系方式', hint: '电话 / 微信 / 邮箱，方便联系', focus: 'contact', done: hasContact.value },
    { key: 'bio', label: '个人 / 公司简介', hint: '让对方快速了解你', focus: 'bio', done: !!(c.bio || c.company_intro) },
    { key: 'qr', label: '加好友 / 收款码', hint: '可直接扫码添加或付款', focus: 'qr', done: !!(c.wechat_qr || c.alipay_qr || c.wechat_pay_qr || c.alipay_pay_qr) },
    { key: 'links', label: '更多链接', hint: '主页 / 店铺 / 作品集', focus: 'links', done: !!c.links?.length }
  ]
})
const completedCount = computed(() => checklist.value.filter(x => x.done).length)
const progressPct = computed(() => Math.round(completedCount.value / checklist.value.length * 100))

async function load() {
  if (loadStarted && loading.value) return
  loadStarted = true
  loading.value = true
  loadError.value = ''
  try {
    const [c, s, o] = await Promise.all([api.get('/api/cards/mine'), api.get('/api/cards/mine/stats'), api.get('/api/orders/mine')])
    card.value = c.data.data; stats.value = s.data.data; orders.value = o.data.data
  } catch (e) { loadError.value = e.message || '网络异常' } finally { loading.value = false }
}
onMounted(load)

async function createCard() {
  if (busy.value) return
  busy.value = true
  try {
    const { data } = await api.post('/api/cards/mine', { slug: newSlug.value })
    card.value = data.data
    showToast('名片已创建，开始完善资料吧', 'success')
  } catch (e) { showToast(e.message, 'error') } finally { busy.value = false }
}

function goEdit(focus) { router.push({ path: '/me/card', query: focus ? { focus } : {} }) }
function scrollToStats() {
  menuOpen.value = false
  setTimeout(() => document.getElementById('dash-data')?.scrollIntoView({ behavior: 'smooth' }), 50)
}
function statusText(s) { return ({ paid: '已支付', pending: '待支付', cancelled: '已取消' })[s] || s }
function shortUrl(u) { return String(u || '').replace(/^https?:\/\//, '').slice(0, 30) }
function safeUrl(u) { try { const x = new URL(u); return ['http:', 'https:'].includes(x.protocol) ? x.href : '#' } catch { return '#' } }
function tel(v) { if (v) window.location.href = `tel:${v}`; else showToast('尚未填写电话') }
function sms(v) { if (v) window.location.href = `sms:${v}`; else showToast('尚未填写手机号') }
function mailto(v) { if (v) window.location.href = `mailto:${v}`; else showToast('尚未填写邮箱') }
function goMap() { if (card.value?.address) window.location.href = maps.value[0].href; else showToast('尚未填写地址') }
async function copy(v, label) {
  if (!v) return showToast(`尚未填写${label}`)
  try { await navigator.clipboard.writeText(v); showToast(`${label}已复制`, 'success') }
  catch { showToast(v) }
}
async function saveQr() {
  const r = await saveImageUrl(`${qrApi.value}/qr.png?size=900`, `${card.value?.slug || 'card'}-二维码.png`)
  if (r.kind === 'longpress') return showToast('请长按二维码图片保存', 'error')
  showToast(r.kind === 'downloaded' ? '二维码已开始下载' : '已打开，请长按保存', 'success')
}
async function saveContact() {
  if (!card.value) return
  const vcfApi = `${qrApi.value}/card.vcf`
  if (isWeChat()) return showToast('请点右上角「···」→ 在浏览器中打开后保存，或长按二维码保存', 'error')
  const r = await saveImageUrl(vcfApi, `${card.value.name || card.value.slug}.vcf`)
  showToast(r.kind === 'downloaded' ? '已下载，打开即可导入通讯录' : '已打开名片文件，请选择导入通讯录', 'success')
}
async function doShare() {
  const r = await shareOrCopy({ title: card.value?.name || '电子名片', text: card.value?.title || '扫一扫保存我的名片', url: card.value?.url || window.location.href })
  if (r === 'copied') showToast('链接已复制，快分享给朋友', 'success')
  else if (r === 'failed') showToast('复制失败，请手动复制地址栏链接', 'error')
}
function doLogout() { logout(); router.push('/') }
</script>

<style scoped>
.dash-page { min-height: 100vh; background: var(--t-bg, var(--bg-page)); color: var(--t-text, var(--text)); padding-bottom: 84px; }
.dash-top { height: 52px; display: flex; align-items: center; gap: 6px; padding: 0 12px; position: sticky; top: 0; z-index: 20; background: var(--t-cover, var(--primary)); color: #fff; }
.dash-brand { font-weight: 800; font-size: 18px; color: #fff; }
.dash-brand em { font-style: normal; opacity: .75; }
.dash-icon { width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,.16); color: #fff; font-size: 18px; display: grid; place-items: center; }
.dash-loading { margin-top: 20px; }
.cv-cover { height: 120px; position: relative; background: var(--t-cover, var(--primary)); border-radius: 0 0 24px 24px; }
.cv-brand { position: absolute; right: 16px; top: 16px; color: #fff; font-weight: 800; opacity: .9; }
.cv-brand em { font-style: normal; opacity: .75; }
.cv-edit-cover { position: absolute; left: 16px; top: 16px; color: #fff; background: rgba(255,255,255,.16); padding: 5px 10px; border-radius: 999px; font-size: 12px; }
.cv-main { margin-top: -40px; position: relative; }
.cv-profile { position: relative; display: flex; gap: 14px; align-items: center; padding: 18px; }
.cv-avatar { width: 64px; height: 64px; flex: 0 0 64px; border-radius: 50%; overflow: hidden; background: var(--t-accent, var(--primary)); color: #fff; display: grid; place-items: center; font-size: 26px; font-weight: 700; }
.cv-avatar img { width: 100%; height: 100%; object-fit: cover; }
.cv-ident { min-width: 0; }
.cv-name { font-size: 22px; font-weight: 800; }
.cv-en { font-size: 12px; font-weight: 400; opacity: .6; margin-left: 6px; }
.cv-title { font-size: 13px; color: var(--muted); margin-top: 3px; line-height: 1.4; }
.cv-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.cv-tags span { font-size: 11px; padding: 3px 8px; border-radius: 999px; background: #eef2ff; background: color-mix(in srgb, var(--t-accent, var(--primary)) 12%, transparent); color: var(--t-accent, var(--primary)); }
.block-edit { position: absolute; right: 10px; top: 10px; width: 28px; height: 28px; border-radius: 50%; background: rgba(0,0,0,.04); color: var(--muted); font-size: 13px; }
.cv-block { position: relative; margin-top: 12px; }
.cv-block h3 { font-size: 15px; margin: 0 0 10px; }
.cv-actions { display: flex; margin-top: 12px; padding: 12px 4px; }
.cv-actions button { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 11px; color: var(--text); }
.cv-actions i { width: 34px; height: 34px; border-radius: 50%; background: #eef2ff; background: color-mix(in srgb, var(--t-accent, var(--primary)) 12%, transparent); color: var(--t-accent, var(--primary)); display: grid; place-items: center; font-style: normal; font-size: 14px; font-weight: 700; }
.contact-empty { margin-top: 12px; display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: var(--muted); }
.contact-list { display: flex; flex-direction: column; gap: 8px; }
.contact-row { display: flex; align-items: center; gap: 10px; font-size: 13px; }
.contact-row span { width: 36px; color: var(--muted); flex: 0 0 36px; }
.contact-row b { flex: 1; word-break: break-all; font-weight: 500; }
.contact-row button { color: var(--primary); font-size: 12px; }
.cv-bio { font-size: 13px; line-height: 1.7; white-space: pre-wrap; }
.cv-links { display: flex; flex-direction: column; gap: 8px; }
.cv-links a { display: flex; justify-content: space-between; padding: 10px 12px; border-radius: 8px; background: var(--bg-page); font-size: 13px; }
.cv-links a span { color: var(--muted); font-size: 11px; }
.cv-qr-card { margin-top: 12px; display: flex; gap: 16px; align-items: center; }
.cv-qr-img { width: 104px; height: 104px; flex: 0 0 104px; padding: 6px; background: #fff; border: 1px solid var(--line); border-radius: 10px; }
.cv-qr-img img { width: 100%; height: 100%; }
.cv-qr-info h3 { font-size: 15px; margin: 0 0 6px; }
.cv-footer { text-align: center; font-size: 11px; color: var(--muted); padding: 24px 0 8px; }
.cv-dock { position: fixed; bottom: 0; left: 0; right: 0; z-index: 15; display: flex; gap: 8px; padding: 10px 12px calc(10px + env(safe-area-inset-bottom)); background: #fff; border-top: 1px solid #e2e8f0; }
.cv-dock .btn { flex: 1; }
.share-fab { position: fixed; right: 16px; bottom: calc(74px + env(safe-area-inset-bottom)); z-index: 18; width: 58px; height: 58px; border-radius: 50%; background: #2563eb; color: #fff; box-shadow: 0 8px 24px rgba(37,99,235,.42); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; font-size: 20px; }
.share-fab span { font-size: 10px; }

.dash-progress-block { margin-top: 12px; }
.progress-head { display: flex; justify-content: space-between; align-items: center; font-size: 14px; }
.progress-track { height: 6px; border-radius: 4px; background: var(--line); overflow: hidden; margin: 10px 0 12px; }
.progress-track i { display: block; height: 100%; background: var(--primary); transition: width .3s; }
.check-list { display: flex; flex-direction: column; }
.check-item { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-top: 1px solid var(--line); text-align: left; }
.check-item:first-child { border-top: 0; }
.check-ico { width: 22px; height: 22px; flex: 0 0 22px; border-radius: 50%; display: grid; place-items: center; font-size: 12px; background: var(--line); color: var(--muted); }
.check-item.done .check-ico { background: var(--ok); color: #fff; }
.check-label { flex: 1; font-size: 13px; }
.check-item.done .check-label { color: var(--muted); }
.check-arrow { color: var(--muted); }

.drawer-mask { position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,.55); }
.drawer { position: absolute; right: 0; left: auto; top: 0; bottom: 0; width: min(86vw, 340px); max-width: 100%; background: #fff; color: #0f172a; display: flex; flex-direction: column; animation: slideIn .22s ease; box-shadow: -4px 0 24px rgba(0,0,0,.25); }
@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
.drawer-head { display: flex; align-items: center; justify-content: space-between; padding: 18px 16px; background: #2563eb; color: #fff; flex: 0 0 auto; }
.drawer-head b { display: block; font-size: 14px; }
.drawer-head span { color: rgba(255,255,255,.7); }
.drawer-head .dash-icon { background: rgba(255,255,255,.16); }
.drawer-nav { flex: 1; overflow-y: auto; padding: 8px 0; background: #fff; }
.drawer-nav a, .drawer-nav button { display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 18px; font-size: 14px; color: #0f172a; text-align: left; }
.drawer-nav a:hover, .drawer-nav button:hover { background: #f1f5f9; }
.drawer-nav i { width: 22px; text-align: center; font-style: normal; }
.drawer-sep { padding: 14px 18px 6px; font-size: 11px; color: #64748b; }
.drawer-foot { padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); border-top: 1px solid #e2e8f0; background: #fff; flex: 0 0 auto; }
.dash-data { margin-top: 24px; padding-bottom: 20px; }
/* 联络卡模板在工作台的呼应 */
.dash-tpl-contact .cv-cover { background: linear-gradient(135deg,#0b1a3a 0%,#1e40af 58%,#3b82f6 100%); }
.dash-tpl-contact .cv-profile { border-radius: 12px; border: 1px solid #dbe4f5; box-shadow: 0 8px 24px rgba(30,64,175,.10); }
.dash-tpl-contact .cv-avatar { border-radius: 10px; border: 2px solid #fff; }
.dash-tpl-contact .cv-tags span { border-radius: 4px; border: 1px solid #1e40af; background: #eff4ff; }
.dash-tpl-contact .cv-actions i { border-radius: 10px; background: #eff4ff; color: #1e40af; }
.dash-tpl-contact .cv-qr-card { border: 2px solid #1e40af; }
.dash-tpl-contact .cv-dock { background: rgba(11,26,58,.97); border-top: 2px solid #1e40af; }
.dash-tpl-contact .cv-dock .btn-ghost { background: rgba(255,255,255,.14); color: #fff; border-color: transparent; }
@media (min-width: 720px) { .cv-main { max-width: 640px; } }
</style>
