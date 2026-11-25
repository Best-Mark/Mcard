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

    <!-- 成品名片（持有者视角）：直接复用公开名片页的同一套模板渲染，所见即用户所见 -->
    <template v-else>
      <div class="dash-preview-wrap">
        <button class="cv-edit-cover" @click="goEdit('identity')">✎ 编辑名片</button>
        <CardView embed :embed-slug="card.slug" />
      </div>

      <div class="container cv-main">
        <!-- 集市上架：轻量提示，不占主视觉；详情去编辑页/集市 -->
        <button class="cv-market-tip" :class="{ listed: card.market_opt_in }" @click="goEdit('market')">
          <span class="tip-ico">⌖</span>
          <span class="tip-text">{{ card.market_opt_in ? '已在名片集市上架 · 点此管理' : '上架名片集市，让附近的人找到你 ›' }}</span>
          <span class="tip-arrow">›</span>
        </button>

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

        <!-- 名片二维码统一到公开名片页：码内容是名片地址（短链好扫），微信扫开名片页后再点「存入通讯录」 -->
        <div class="card cv-qr-card">
          <button class="cv-qr-img" @click="router.push(`/c/${card.slug}?save=1`)" title="点击查看我的名片二维码">
            <img :src="qrApi + '/qr.svg?size=440'" alt="我的名片二维码" />
          </button>
          <div class="cv-qr-text">
            <h3>我的名片二维码</h3>
            <p>点击查看大图 · 微信扫一扫打开名片后可存入通讯录</p>
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
import CardView from './CardView.vue'

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
/* 名片预览容器：里面是真实的 CardView 模板，编辑按钮浮在封面「左上」。
   ⚠️ 不要同时给 .cv-edit-cover 设 left 和 right——absolute 左右都定值会被拉成通栏，
   与 CardView 自带的右上角 MCard 角标挤成一团（2026-11-25 实修）。 */
.dash-preview-wrap { position: relative; }
.dash-preview-wrap .cv-edit-cover { position: absolute; left: 16px; top: 18px; z-index: 3; }
.cv-edit-cover { color: #fff; background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.25); padding: 6px 12px; border-radius: 999px; font-size: 12px; }
/* 预览卡由 CardView 自己渲染封面+身份区；下方内容走正常间距，不再用旧版负边距上提造成压叠 */
.cv-main { margin-top: 12px; position: relative; }

.cv-block { position: relative; margin-top: 12px; }
.cv-block h3 { font-size: 15px; margin: 0 0 10px; }

/* 集市上架：一行轻提示（已上架/未上架同形态），不抢名片视觉 */
.cv-market-tip { display: flex; align-items: center; gap: 9px; width: 100%; margin-top: 12px; padding: 10px 14px; border: 1px solid var(--line); border-radius: 10px; background: transparent; color: var(--t-accent, var(--primary)); font-size: 12px; text-align: left; }
.cv-market-tip.listed { color: var(--muted); }
.tip-ico { font-size: 15px; line-height: 1; }
.tip-text { flex: 1; }
.tip-arrow { font-size: 16px; }
.dash-tpl-navygold .cv-market-tip { border-color: rgba(185,147,85,.35); color: var(--ng-gold-2); }
.dash-tpl-navygold .cv-market-tip.listed { color: #9aa3ad; }
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
/* 工作台自身的内容卡样式；名片封面/身份卡由 CardView 真实模板自控，不在这里重复定义 */
.dash-page .card { border-radius: 20px; border-color: #e8eef8; box-shadow: 0 4px 16px rgba(15,23,42,.05); }

/* 深蓝鎏金 navygold：深蓝放射底 + 白卡金线 + 淡水印 + 纸色业务标签 + 表格化联系方式 */
.dash-tpl-navygold { color: var(--ng-ink); background: var(--ng-page-bg); --dash-cover: linear-gradient(135deg, var(--ng-navy) 0%, var(--ng-deep) 100%); }
.dash-tpl-navygold .dash-top { background: linear-gradient(90deg, var(--ng-navy), var(--ng-deep)); border-bottom: 2px solid var(--ng-gold); }
.dash-tpl-navygold .dash-icon { background: rgba(216,187,133,.18); }
.dash-tpl-navygold .cv-edit-cover { color: var(--ng-gold-2); border-color: rgba(216,187,133,.5); }
.dash-tpl-navygold .card { border-color: var(--ng-line); border-radius: 16px; box-shadow: 0 10px 30px -18px rgba(0,0,0,.55); }
.dash-tpl-navygold .cv-main { max-width: 430px; }
.dash-tpl-navygold .contact-row { border-top: 1px solid var(--ng-line); padding: 13px 0; }
.dash-tpl-navygold .contact-row span { width: 46px; flex-basis: 46px; color: #9aa3ad; letter-spacing: .16em; }
.dash-tpl-navygold .contact-row b { color: var(--ng-navy); }
.dash-tpl-navygold .contact-row button { color: var(--ng-gold); }
.dash-tpl-navygold .cv-block h3 { color: var(--ng-navy); border-left: 3px solid var(--ng-gold); padding-left: 9px; }
.dash-tpl-navygold .cv-footer { color: #a9b1ba; letter-spacing: .1em; }
.dash-tpl-navygold .cv-footer b { color: var(--ng-gold); }

@media (min-width: 720px) { .cv-main { max-width: 640px; } }
</style>
