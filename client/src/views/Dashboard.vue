<template>
  <div class="dash-page" :class="'dash-tpl-' + (card?.template || 'classic')" :style="cardVars">
    <!-- 顶部栏：品牌 + 分享/扫码 + 菜单 -->
    <header class="dash-top">
      <router-link to="/" class="dash-brand">M<em>Card</em></router-link>
      <div class="spacer"></div>
      <button class="dash-icon" aria-label="分享名片" @click="doShare">↗</button>
      <button class="dash-icon" aria-label="二维码" @click="qrModal = true">▦</button>
      <button class="dash-menu-btn" aria-label="菜单" @click="toggleDrawer"><i class="menu-glyph"></i><span>菜单</span></button>
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
        <div class="card cv-profile" :data-wm="card?.template === 'navygold' ? (card.company || '').slice(0, 4) : ''">
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
          <button @click="tel(card.mobile || card.phone)"><i><AppIcon name="phone" :size="20" /></i><span>打电话</span></button>
          <button @click="sms(card.mobile)"><i><AppIcon name="sms" :size="20" /></i><span>发短信</span></button>
          <button @click="mailto(card.email)"><i><AppIcon name="mail" :size="20" /></i><span>写邮件</span></button>
          <button @click="copy(card.wechat, '微信号')"><i><AppIcon name="wechat" :size="20" /></i><span>微信</span></button>
          <button @click="copy(card.alipay, '支付宝账号')"><i><AppIcon name="alipay" :size="20" /></i><span>支付宝</span></button>
        </div>
        <div v-else class="card card-pad contact-empty">
          <span>还没有联系方式</span>
          <button class="btn btn-sm btn-ghost" @click="goEdit('contact')">去添加 ›</button>
        </div>

        <!-- 上架到名片集市：把名片变成持续获客入口（重点引导） -->
        <div class="cv-market-card" :class="{ listed: card.market_opt_in }">
          <div class="cv-market-icon">⌖</div>
          <div class="cv-market-body">
            <div class="cv-market-title">
              {{ card.market_opt_in ? '✅ 已在名片集市上架' : '🚀 上架名片集市 · 获取更多业务流量' }}
            </div>
            <p>{{ card.market_opt_in
              ? '附近及同行业的人可按距离/行业找到你，点击名片即可存入通讯录。想调整行业、城市或下架，可随时编辑。'
              : '让附近、业务对口的客户主动找到你——按距离与行业曝光，点击名片即可存入通讯录，持续为你带来咨询与订单。' }}</p>
            <div class="cv-market-actions">
              <button class="btn btn-sm" :class="card.market_opt_in ? 'btn-ghost' : 'btn-primary'" @click="goEdit('market')">
                {{ card.market_opt_in ? '管理上架信息 ›' : '立即上架 ›' }}
              </button>
              <router-link to="/market" class="cv-market-link">看看集市里都有谁 →</router-link>
            </div>
          </div>
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

        <!-- 通讯录/分享二维码统一到公开名片页（那里有本地 vCard 二维码，各环境都能存通讯录） -->
        <div class="card cv-qr-card">
          <button class="cv-qr-img" @click="router.push(`/c/${card.slug}?save=1`)" title="点击查看存入通讯录二维码">
            <img :src="qrApi + '/qr.svg?size=440'" alt="我的名片二维码" />
          </button>
          <div class="cv-qr-text">
            <h3>我的名片二维码</h3>
            <p>点击查看「存入通讯录」二维码 · 相机扫一扫即可保存</p>
          </div>
        </div>

        <p class="cv-footer">{{ card.company || card.name || siteConfig.site_name }} · 由 <b>{{ siteConfig.site_name }}</b> 提供技术支持</p>
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
import { showToast, siteConfig, toggleDrawer } from '../store'
import { THEMES, themeOf, themeVars } from '../utils/themes'
import { isWeChat, saveImageUrl } from '../utils/save-image'
import { shareOrCopy, mapLinks } from '../utils/share'
import { setupWechatShare, absoluteMediaUrl } from '../utils/wx-share'
import AppIcon from '../components/AppIcon.vue'

const router = useRouter()
const card = ref(null)
const loading = ref(true); const busy = ref(false); const newSlug = ref(''); const loadError = ref('')
const qrModal = ref(false)
let loadStarted = false
const qrApi = computed(() => `/api/cards/public/${card.value?.slug || ''}`)
const t = computed(() => themeOf({ theme: THEMES[card.value?.theme] ? card.value.theme : 'ocean', accent: card.value?.accent }))
const cardVars = computed(() => card.value ? themeVars(t.value) : {})
const maps = computed(() => mapLinks(card.value?.address || ''))

const hasContact = computed(() => !!(card.value?.mobile || card.value?.phone || card.value?.email || card.value?.wechat || card.value?.alipay || card.value?.address))

async function load() {
  if (loadStarted && loading.value) return
  loadStarted = true
  loading.value = true
  loadError.value = ''
  try {
    const { data } = await api.get('/api/cards/mine')
    const c = data?.data
    if (!c || typeof c !== 'object') {
      // 接口返回空数据：不当成加载失败，落到「还没有名片」态，避免 .name 空引用崩溃
      card.value = null
      return
    }
    card.value = c
    try {
      await setupWechatShare(api, {
        title: `${c.name || '我的'} · ${c.title || c.company || '电子名片'}`,
        desc: `${[c.company, c.department, c.title].filter(Boolean).join(' · ') || '电子名片'}，扫码即可存入通讯录`,
        link: c.url || window.location.href,
        imgUrl: absoluteMediaUrl(c.avatar || c.logo || c.cover)
      })
    } catch { /* 微信分享配置失败不影响名片展示 */ }
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
async function doShare() {
  // 分享前先抹掉地址栏里的 wx_ticket：这是登录凭证，绝不能随分享发出去
  const cur = new URL(window.location.href)
  if (cur.searchParams.has('wx_ticket')) {
    cur.searchParams.delete('wx_ticket')
    window.history.replaceState(null, '', cur.toString())
  }
  // 分享链接永远是公开名片页，绝不分享工作台 /me（含个人信息与凭证）
  const shareUrl = card.value?.slug ? `${window.location.origin}/c/${card.value.slug}` : (card.value?.url || `${window.location.origin}/`)
  if (isWeChat()) {
    // 微信原生转发的是当前页面 URL，先把当前页也切到干净的名片页再提示转发
    if (card.value?.slug) window.history.replaceState(null, '', shareUrl)
    showToast('已设为名片卡片：点右上角「···」→ 发送给朋友 / 分享到朋友圈', 'error')
    return
  }
  const r = await shareOrCopy({ title: card.value?.name || '电子名片', text: card.value?.title || '扫一扫保存我的名片', url: shareUrl })
  if (r === 'copied') showToast('链接已复制，快分享给朋友', 'success')
  else if (r === 'failed') showToast('复制失败，请手动复制地址栏链接', 'error')
}
</script>

<style scoped>
/* 工作台参考商务名片风格：深蓝→亮蓝→青蓝渐变 + 浅蓝底 + 白卡大圆角 */
.dash-page { min-height: 100vh; background: #f4f7fe; color: #172033; padding-bottom: 84px; --dash-cover: linear-gradient(90deg,#143b8f 0%,#2f6feb 52%,#06b6d4 100%); }
.dash-top { height: 52px; display: flex; align-items: center; gap: 6px; padding: 0 12px; position: sticky; top: 0; z-index: 20; background: var(--dash-cover); color: #fff; }
.dash-top .spacer { flex: 1; }
.dash-brand { font-weight: 800; font-size: 18px; color: #fff; }
.dash-brand em { font-style: normal; opacity: .75; }
.dash-icon { width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,.16); color: #fff; font-size: 18px; display: grid; place-items: center; }
.dash-menu-btn { display: flex; align-items: center; gap: 7px; height: 36px; padding: 0 12px; border-radius: 18px; background: rgba(255,255,255,.18); color: #fff; font-size: 12px; font-weight: 600; }
.dash-menu-btn span { font-size: 12px; }
.dash-menu-btn .menu-glyph { width: 15px; height: 13px; }
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

/* 上架集市引导卡：未上架用醒目渐变，已上架收敛为静态提示 */
.cv-market-card { position: relative; margin-top: 12px; display: flex; gap: 14px; padding: 18px 16px; border-radius: 16px; color: #fff; background: linear-gradient(135deg, #0e7490, #2563eb 62%, #4f46e5); box-shadow: 0 10px 26px rgba(37,99,235,.22); overflow: hidden; }
.cv-market-card::after { content: ''; position: absolute; right: -30px; top: -40px; width: 130px; height: 130px; border-radius: 50%; background: radial-gradient(circle, rgba(255,255,255,.2), transparent 70%); pointer-events: none; }
.cv-market-card.listed { background: linear-gradient(135deg, #0f766e, #115e59); box-shadow: 0 6px 18px rgba(15,118,110,.18); }
.cv-market-icon { flex: 0 0 42px; width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center; font-size: 22px; background: rgba(255,255,255,.18); }
.cv-market-body { flex: 1; min-width: 0; }
.cv-market-title { font-size: 15px; font-weight: 800; line-height: 1.3; }
.cv-market-body p { margin: 6px 0 0; font-size: 12px; line-height: 1.6; opacity: .92; }
.cv-market-actions { display: flex; align-items: center; gap: 14px; margin-top: 12px; flex-wrap: wrap; }
.cv-market-card .btn { background: #fff; color: #1d4ed8; border-color: #fff; font-weight: 700; }
.cv-market-card.listed .btn { background: rgba(255,255,255,.18); color: #fff; border-color: rgba(255,255,255,.5); }
.cv-market-link { font-size: 12px; color: #fff; opacity: .9; text-decoration: underline; }
/* navygold 主题下收敛为纸色+金线，避免亮蓝破坏深蓝鎏金视觉 */
.dash-tpl-navygold .cv-market-card { background: linear-gradient(135deg, var(--ng-navy), var(--ng-deep)); border: 1px solid rgba(185,147,85,.35); color: #f5f0e6; }
.dash-tpl-navygold .cv-market-card.listed { background: linear-gradient(135deg, #1a3a34, #14352f); }
.dash-tpl-navygold .cv-market-card .btn { background: var(--ng-gold); color: var(--ng-navy); border-color: var(--ng-gold); }
.dash-tpl-navygold .cv-market-card.listed .btn { background: rgba(216,187,133,.16); color: var(--ng-gold-2); border-color: rgba(216,187,133,.5); }
.dash-tpl-navygold .cv-market-link { color: var(--ng-gold-2); }
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
/* 工作台配色统一为参考商务名片（深蓝→亮蓝→青蓝），不随名片模板/主题改变 */
.dash-tpl-contact .cv-cover, .dash-tpl-classic .cv-cover, .dash-tpl-minimal .cv-cover,
.dash-tpl-elite .cv-cover, .dash-tpl-vivid .cv-cover, .dash-tpl-seal .cv-cover { background: var(--dash-cover); }
.dash-page .cv-profile { background: #fff; border: 1px solid #e8eef8; border-radius: 24px; box-shadow: 0 4px 16px rgba(15,23,42,.05); }
.dash-page .cv-name { color: #172033; }
.dash-page .cv-org { color: #2f6feb; }
.dash-page .cv-tags span { border-color: #c7d2fe; background: #eff6ff; color: #1d4ed8; border-radius: 8px; }
.dash-page .card { border-radius: 20px; border-color: #e8eef8; box-shadow: 0 4px 16px rgba(15,23,42,.05); }

/* 深蓝鎏金 navygold：深蓝放射底 + 白卡金线 + 淡水印 + 纸色业务标签 + 表格化联系方式 */
.dash-tpl-navygold { color: var(--ng-ink); background: var(--ng-page-bg); --dash-cover: linear-gradient(135deg, var(--ng-navy) 0%, var(--ng-deep) 100%); }
.dash-tpl-navygold .dash-top { background: linear-gradient(90deg, var(--ng-navy), var(--ng-deep)); border-bottom: 2px solid var(--ng-gold); }
.dash-tpl-navygold .dash-icon { background: rgba(216,187,133,.18); }
.dash-tpl-navygold .cv-cover { border-radius: 0 0 22px 22px; background: var(--dash-cover); }
.dash-tpl-navygold .cv-cover::after { height: 4px; background: linear-gradient(90deg, var(--ng-navy-2), var(--ng-gold-2) 70%, var(--ng-gold)); }
.dash-tpl-navygold .cv-edit-cover { color: var(--ng-gold-2); border-color: rgba(216,187,133,.5); }
.dash-tpl-navygold .card { border-color: var(--ng-line); border-radius: 16px; box-shadow: 0 10px 30px -18px rgba(0,0,0,.55); }
.dash-tpl-navygold .cv-profile {
  position: relative; overflow: hidden; border-radius: 22px; padding: 30px 24px 22px;
  border: 1px solid rgba(185,147,85,.28);
  box-shadow: 0 26px 60px -22px rgba(0,0,0,.65), 0 0 0 1px rgba(255,255,255,.06);
}
.dash-tpl-navygold .cv-profile::before {
  content: ''; position: absolute; inset: 0 0 auto 0; height: 6px;
  background: linear-gradient(90deg, var(--ng-navy), var(--ng-navy-2) 40%, var(--ng-gold-2) 78%, var(--ng-gold));
}
.dash-tpl-navygold .cv-main { max-width: 430px; }
.dash-tpl-navygold .cv-profile::after {
  content: attr(data-wm); position: absolute; right: -26px; top: 54px;
  font-size: 80px; font-weight: 900; color: var(--ng-ink); opacity: .04;
  letter-spacing: -4px; line-height: 1; pointer-events: none;
}
.dash-tpl-navygold .cv-profile > * { position: relative; z-index: 2; }
.dash-tpl-navygold .cv-avatar {
  width: 64px; height: 64px; flex-basis: 64px; border-radius: 14px; font-size: 26px;
  background: linear-gradient(145deg, var(--ng-navy), #0e2233);
  box-shadow: inset 0 0 0 2px rgba(216,187,133,.5), 0 8px 18px -8px rgba(18,32,46,.6);
}
.dash-tpl-navygold .cv-name { color: var(--ng-ink); font-size: 27px; font-weight: 900; letter-spacing: .04em; }
.dash-tpl-navygold .cv-en { color: var(--ng-ink-2); }
.dash-tpl-navygold .cv-title { color: var(--ng-ink-2); font-size: 12.5px; letter-spacing: .06em; }
.dash-tpl-navygold .cv-org {
  color: var(--ng-navy); border-top: 1px dashed var(--ng-line); padding-top: 12px; margin-top: 12px;
  font-size: 13.5px; font-weight: 700; letter-spacing: .03em;
}
.dash-tpl-navygold .cv-tags span {
  border-radius: 99px; background: var(--ng-paper); color: #6b5a3c;
  border: 0; box-shadow: inset 0 0 0 1px rgba(185,147,85,.28);
}
.dash-tpl-navygold .cv-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 0; overflow: hidden; background: transparent; border: 0; box-shadow: none; }
.dash-tpl-navygold .cv-actions button {
  display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 8px;
  height: 50px; border-radius: 13px; background: #f7f5f0; color: var(--ng-navy);
  font-size: 14.5px; font-weight: 700; letter-spacing: .02em; box-shadow: inset 0 0 0 1px #e6e0d4;
}
.dash-tpl-navygold .cv-actions button:first-child {
  background: linear-gradient(135deg, var(--ng-navy), #0f2739); color: #fff;
  box-shadow: 0 10px 22px -12px rgba(18,32,46,.85);
}
.dash-tpl-navygold .cv-actions button:last-child:nth-child(odd) { grid-column: 1 / -1; }
.dash-tpl-navygold .cv-actions i { width: auto; height: auto; border-radius: 0; background: transparent; color: inherit; font-size: 17px; }
.dash-tpl-navygold .contact-row { border-top: 1px solid var(--ng-line); padding: 13px 0; }
.dash-tpl-navygold .contact-row span { width: 46px; flex-basis: 46px; color: #9aa3ad; letter-spacing: .16em; }
.dash-tpl-navygold .contact-row b { color: var(--ng-navy); }
.dash-tpl-navygold .contact-row button { color: var(--ng-gold); }
.dash-tpl-navygold .cv-block h3 { color: var(--ng-navy); border-left: 3px solid var(--ng-gold); padding-left: 9px; }
.dash-tpl-navygold .cv-footer { color: #a9b1ba; letter-spacing: .1em; }
.dash-tpl-navygold .cv-footer b { color: var(--ng-gold); }

@media (min-width: 720px) { .cv-main { max-width: 640px; } }
</style>
