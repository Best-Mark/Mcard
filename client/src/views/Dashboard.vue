<template>
  <div class="dash-page" :class="'dash-tpl-' + (card?.template || 'classic')" :style="cardVars">
    <!-- 顶部栏：品牌 + 分享/扫码 + 菜单 -->
    <header class="dash-top">
      <router-link to="/" class="dash-brand">M<em>Card</em></router-link>
      <div class="spacer"></div>
      <button class="dash-icon" aria-label="分享名片" @click="doShare">↗</button>
      <button class="dash-icon" aria-label="二维码" @click="qrModal = true">▦</button>
      <button class="dash-menu-btn" aria-label="打开菜单" @click="menuOpen = true">☰ <span>菜单</span></button>
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
        <div class="cv-brand">{{ card.company || siteConfig.site_name }}</div>
        <button class="cv-edit-cover" @click="goEdit('identity')">✎ 编辑名片</button>
        <div v-if="!card.active" class="cv-cover-status">未开通 / 已到期</div>
      </div>

      <div class="container cv-main">
        <!-- 身份区：参考商务联络卡，姓名/公司/职位突出 -->
        <div class="card cv-profile">
          <div class="cv-avatar">
            <img v-if="card.avatar" :src="card.avatar" :alt="card.name" />
            <span v-else>{{ (card.name || '名').slice(0, 1) }}</span>
          </div>
          <div class="cv-ident">
            <div class="cv-name">
              {{ card.name || card.name_en || '你的姓名' }}
              <span v-if="card.name_en && card.name" class="cv-en">{{ card.name_en }}</span>
            </div>
            <div class="cv-org">{{ card.company || '公司 / 团队' }}</div>
            <div class="cv-title">{{ [card.department, card.title].filter(Boolean).join(' · ') || '职位信息' }}</div>
            <div v-if="card.tags?.length" class="cv-tags"><span v-for="tag in card.tags" :key="tag">{{ tag }}</span></div>
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
          <h3>关于我</h3><p class="cv-bio">{{ card.bio }}</p>
        </div>
        <div v-if="card.company_intro" class="card card-pad cv-block">
          <h3>公司简介 <span class="small muted" v-if="card.company">· {{ card.company }}</span></h3>
          <p class="cv-bio">{{ card.company_intro }}</p>
        </div>

        <!-- 更多链接 -->
        <div v-if="card.links?.length" class="card card-pad cv-block">
          <h3>更多链接</h3>
          <div class="cv-links">
            <a v-for="(l, i) in card.links" :key="i" :href="safeUrl(l.url)" target="_blank" rel="noopener">
              <b>{{ l.label || '链接' }}</b><span>{{ shortUrl(l.url) }} ↗</span>
            </a>
          </div>
        </div>

        <!-- 我的二维码：干净居中，点击放大 -->
        <div class="card cv-qr-card">
          <button class="cv-qr-img" @click="qrModal = true" title="点击放大">
            <img :src="qrApi + '/qr.svg?size=440'" alt="我的名片二维码" />
          </button>
          <div class="cv-qr-text">
            <h3>我的名片二维码</h3>
            <p>扫一扫查看名片 · 点击上方二维码可放大保存</p>
          </div>
        </div>

        <p class="cv-footer">{{ card.company || card.name || siteConfig.site_name }} · 由 <b>{{ siteConfig.site_name }}</b> 提供技术支持</p>
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
          <button class="drawer-close" @click="menuOpen = false" aria-label="关闭">✕</button>
        </div>
        <nav class="drawer-nav">
          <router-link to="/me" @click="menuOpen = false"><i>▤</i>我的名片</router-link>
          <router-link to="/me/card" @click="menuOpen = false"><i>✎</i>编辑资料</router-link>
          <button @click="improveOpen = !improveOpen"><i>📝</i>完善度 {{ completedCount }}/{{ checklist.length }} <span style="margin-left:auto">{{ improveOpen ? '▴' : '▾' }}</span></button>
          <div v-if="improveOpen" class="drawer-improve">
            <div class="progress-track"><i :style="{ width: progressPct + '%' }"></i></div>
            <button v-for="item in checklist" :key="item.key" :class="{ done: item.done }" @click="goEdit(item.focus)">
              <span>{{ item.done ? '✓' : '○' }}</span>{{ item.label }}
            </button>
          </div>
          <router-link :to="`/c/${card?.slug || ''}`" @click="menuOpen = false"><i>↗</i>公开名片页</router-link>
          <router-link to="/me/contacts" @click="menuOpen = false"><i>★</i>我的名片夹</router-link>
          <div class="drawer-sep">数据与运营</div>
          <router-link to="/me/stats" @click="menuOpen = false"><i>📊</i>浏览统计 / 订单</router-link>
          <router-link to="/me/plans" @click="menuOpen = false"><i>💎</i>套餐 / 续期</router-link>
          <router-link to="/me/print" @click="menuOpen = false"><i>🖨</i>实体名片版式</router-link>
          <button @click="menuOpen = false; qrModal = true"><i>▦</i>我的二维码</button>
        </nav>
        <div class="drawer-foot"><button class="btn btn-ghost btn-block" @click="doLogout">退出登录</button></div>
      </aside>
    </div>

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
import { isWeChat, isIOS, saveImageUrl, prepareExternalOpen, openVcfInline } from '../utils/save-image'
import { shareOrCopy, mapLinks } from '../utils/share'
import { setupWechatShare, absoluteMediaUrl } from '../utils/wx-share'

const router = useRouter()
const card = ref(null)
const loading = ref(true); const busy = ref(false); const newSlug = ref(''); const loadError = ref('')
const menuOpen = ref(false); const qrModal = ref(false); const improveOpen = ref(false)
let loadStarted = false
const qrApi = computed(() => `/api/cards/public/${card.value?.slug || ''}`)
const t = computed(() => themeOf({ theme: THEMES[card.value?.theme] ? card.value.theme : 'ocean', accent: card.value?.accent }))
const cardVars = computed(() => card.value ? themeVars(t.value) : {})
const maps = computed(() => mapLinks(card.value?.address || ''))

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
    const { data } = await api.get('/api/cards/mine')
    card.value = data.data
    setupWechatShare(api, {
      title: `${card.value.name || '我的'} · ${card.value.title || card.value.company || '电子名片'}`,
      desc: `${[card.value.company, card.value.department, card.value.title].filter(Boolean).join(' · ') || '电子名片'}，扫码即可存入通讯录`,
      link: card.value.url || window.location.href,
      imgUrl: absoluteMediaUrl(card.value.avatar || card.value.logo || card.value.cover)
    })
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
  if (isIOS()) {
    if (isWeChat()) {
      await prepareExternalOpen(api)
      return showToast('请点右上角「···」→ 在浏览器中打开，再点「存入通讯录」即可一键添加联系人（已带登录状态）', 'error')
    }
    openVcfInline(vcfApi)
    return showToast('正在打开通讯录添加界面…', 'success')
  }
  const r = await saveImageUrl(vcfApi, `${card.value.name || card.value.slug}.vcf`)
  showToast(r.kind === 'downloaded' ? '已下载，打开即可导入通讯录' : '已打开名片文件，请选择导入通讯录', 'success')
}
async function doShare() {
  if (isWeChat()) {
    // 微信不允许 JS 主动拉起转发面板，只能配置好卡片内容后引导用户走右上角菜单
    showToast('已设为名片卡片：点右上角「···」→ 发送给朋友 / 分享到朋友圈', 'error')
    return
  }
  const r = await shareOrCopy({ title: card.value?.name || '电子名片', text: card.value?.title || '扫一扫保存我的名片', url: card.value?.url || window.location.href })
  if (r === 'copied') showToast('链接已复制，快分享给朋友', 'success')
  else if (r === 'failed') showToast('复制失败，请手动复制地址栏链接', 'error')
}
function doLogout() { logout(); router.push('/') }
</script>

<style scoped>
/* 工作台参考商务名片风格：深蓝→亮蓝→青蓝渐变 + 浅蓝底 + 白卡大圆角 */
.dash-page { min-height: 100vh; background: #f4f7fe; color: #172033; padding-bottom: 84px; --dash-cover: linear-gradient(90deg,#143b8f 0%,#2f6feb 52%,#06b6d4 100%); }
.dash-top { height: 52px; display: flex; align-items: center; gap: 6px; padding: 0 12px; position: sticky; top: 0; z-index: 20; background: var(--dash-cover); color: #fff; }
.dash-brand { font-weight: 800; font-size: 18px; color: #fff; }
.dash-brand em { font-style: normal; opacity: .75; }
.dash-icon { width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,.16); color: #fff; font-size: 18px; display: grid; place-items: center; }
.dash-menu-btn { display: flex; align-items: center; gap: 5px; height: 36px; padding: 0 12px; border-radius: 18px; background: rgba(255,255,255,.18); color: #fff; font-size: 12px; font-weight: 600; }
.dash-menu-btn span { font-size: 12px; }
.dash-loading { margin-top: 20px; }
.cv-cover { height: 148px; position: relative; background: var(--dash-cover); border-radius: 0 0 28px 28px; overflow: hidden; }
.cv-cover::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: linear-gradient(90deg, transparent, rgba(255,255,255,.7), transparent); opacity: .8; }
.cv-brand { position: absolute; right: 18px; top: 20px; color: #fff; font-weight: 800; font-size: 15px; letter-spacing: .5px; max-width: 60%; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cv-brand em { font-style: normal; opacity: .75; }
.cv-edit-cover { position: absolute; left: 16px; top: 18px; color: #fff; background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.25); padding: 6px 12px; border-radius: 999px; font-size: 12px; }
.cv-cover-status { position: absolute; left: 16px; bottom: 16px; color: #fff; background: rgba(0,0,0,.28); padding: 4px 10px; border-radius: 999px; font-size: 11px; }
.cv-main { margin-top: -52px; position: relative; }
.cv-profile { position: relative; display: flex; gap: 16px; align-items: center; padding: 22px 18px; border-radius: 16px; box-shadow: 0 10px 30px rgba(15,23,42,.10); }
.cv-avatar { width: 78px; height: 78px; flex: 0 0 78px; border-radius: 14px; overflow: hidden; background: var(--t-accent, var(--primary)); color: #fff; display: grid; place-items: center; font-size: 32px; font-weight: 800; border: 2px solid rgba(255,255,255,.9); box-shadow: 0 6px 18px rgba(0,0,0,.14); }
.cv-avatar img { width: 100%; height: 100%; object-fit: cover; }
.cv-ident { min-width: 0; }
.cv-name { font-size: 25px; font-weight: 800; letter-spacing: -.3px; line-height: 1.2; }
.cv-en { font-size: 12px; font-weight: 500; opacity: .55; margin-left: 8px; letter-spacing: .3px; }
.cv-org { font-size: 14px; color: var(--t-accent, var(--primary)); font-weight: 700; margin-top: 4px; }
.cv-title { font-size: 12px; color: var(--muted); margin-top: 2px; line-height: 1.4; }
.cv-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.cv-tags span { font-size: 11px; padding: 4px 10px; border-radius: 4px; background: #eef2ff; background: color-mix(in srgb, var(--t-accent, var(--primary)) 10%, transparent); color: var(--t-accent, var(--primary)); border: 1px solid #c7d2fe; border-color: color-mix(in srgb, var(--t-accent, var(--primary)) 30%, transparent); font-weight: 600; }

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
.cv-links a { display: flex; justify-content: space-between; padding: 10px 12px; border-radius: 8px; background: #f4f7fe; font-size: 13px; }
.cv-links a span { color: var(--muted); font-size: 11px; }
.cv-qr-card { margin-top: 12px; padding: 22px 18px 20px; text-align: center; }
.cv-qr-img { display: block; width: 140px; height: 140px; margin: 0 auto 14px; padding: 8px; background: #fff; border: 1px solid var(--line); border-radius: 10px; box-shadow: 0 4px 14px rgba(15,23,42,.06); }
.cv-qr-img img { display: block; width: 100%; height: 100%; }
.cv-qr-text h3 { font-size: 14px; margin: 0 0 4px; font-weight: 600; }
.cv-qr-text p { font-size: 12px; margin: 0; color: var(--muted); }
.cv-footer { text-align: center; font-size: 11px; color: var(--muted); padding: 24px 0 8px; }
.cv-dock { position: fixed; bottom: 0; left: 0; right: 0; z-index: 15; display: flex; gap: 8px; padding: 10px 12px calc(10px + env(safe-area-inset-bottom)); background: #fff; border-top: 1px solid #e2e8f0; }
.cv-dock .btn { flex: 1; }
.share-fab { position: fixed; right: 16px; bottom: calc(74px + env(safe-area-inset-bottom)); z-index: 18; width: 58px; height: 58px; border-radius: 50%; background: #2563eb; color: #fff; box-shadow: 0 8px 24px rgba(37,99,235,.42); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; font-size: 20px; }
.share-fab span { font-size: 10px; }

.progress-track { height: 6px; border-radius: 4px; background: var(--line); overflow: hidden; margin: 10px 0 12px; }
.progress-track i { display: block; height: 100%; background: var(--primary); transition: width .3s; }

.drawer-mask { position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,.55); }
/* 右上角下拉：贴住触发按钮下方展开，避免整屏侧栏压住名片 */
.drawer { position: absolute; right: 12px; left: auto; top: 56px; bottom: auto; width: min(86vw, 340px); max-width: 100%; max-height: calc(100vh - 72px); border-radius: 14px; overflow: hidden; background: #fff; color: #0f172a; display: flex; flex-direction: column; animation: dropIn .2s ease; box-shadow: 0 12px 40px rgba(0,0,0,.3); }
@keyframes dropIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
.drawer-head { display: flex; align-items: center; justify-content: space-between; padding: 18px 16px; background: #2563eb; color: #fff; flex: 0 0 auto; }
.drawer-head b { display: block; font-size: 14px; }
.drawer-head span { color: rgba(255,255,255,.7); }
.drawer-close { width: 30px; height: 30px; flex: 0 0 30px; border-radius: 50%; background: rgba(255,255,255,.16); color: #fff; font-size: 14px; }
.drawer-nav { flex: 1; overflow-y: auto; padding: 8px 0; background: #fff; min-height: 0; }
.drawer-nav a, .drawer-nav button { display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 18px; font-size: 14px; color: #0f172a; text-align: left; }
.drawer-nav a:hover, .drawer-nav button:hover { background: #f1f5f9; }
.drawer-nav i { width: 22px; text-align: center; font-style: normal; }
.drawer-sep { padding: 14px 18px 6px; font-size: 11px; color: #64748b; }
.drawer-improve { padding: 4px 18px 10px 34px; background: #f8fafc; }
.drawer-improve .progress-track { margin: 4px 0 8px; }
.drawer-improve button { padding: 7px 0 !important; font-size: 12px !important; color: #475569; }
.drawer-improve button.done { color: #64748b; }
.drawer-improve button span { width: 16px; display: inline-block; color: #2563eb; }
.drawer-foot { padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); border-top: 1px solid #e2e8f0; background: #fff; flex: 0 0 auto; }
/* 工作台配色统一为参考商务名片（深蓝→亮蓝→青蓝），不随名片模板/主题改变 */
.dash-tpl-contact .cv-cover, .dash-tpl-classic .cv-cover, .dash-tpl-minimal .cv-cover,
.dash-tpl-elite .cv-cover, .dash-tpl-vivid .cv-cover, .dash-tpl-seal .cv-cover { background: var(--dash-cover); }
.dash-page .cv-profile { background: #fff; border: 1px solid #e8eef8; border-radius: 24px; box-shadow: 0 4px 16px rgba(15,23,42,.05); }
.dash-page .cv-name { color: #172033; }
.dash-page .cv-org { color: #2f6feb; }
.dash-page .cv-tags span { border-color: #c7d2fe; background: #eff6ff; color: #1d4ed8; border-radius: 8px; }
.dash-page .card { border-radius: 20px; border-color: #e8eef8; box-shadow: 0 4px 16px rgba(15,23,42,.05); }
.dash-page .cv-dock { background: #fff; border-top: 1px solid #e8eef8; }
.share-fab { background: linear-gradient(135deg,#2f6feb,#06b6d4); box-shadow: 0 8px 20px rgba(47,111,235,.32); }
@media (min-width: 720px) { .cv-main { max-width: 640px; } }
</style>
