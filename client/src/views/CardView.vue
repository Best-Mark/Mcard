<template>
  <div class="cv-page" :style="vars">
    <div class="cv-cover" :style="{ background: t.cover }">
      <button class="cv-back" @click="router.back ? router.back() : router.push('/')" aria-label="返回">‹</button>
      <div class="cv-brand">M<em>Card</em></div>
      <div class="cv-themes">
        <button v-for="(v, k) in THEMES" :key="k" :style="{ background: v.accent }"
                :class="{ on: currentTheme === k }" :title="v.label" @click="currentTheme = k" />
      </div>
    </div>

    <div v-if="loading" class="container cv-loading">名片加载中…</div>
    <div v-else-if="error" class="container cv-loading">
      <b>名片加载失败</b><p class="small muted">{{ error }}</p>
      <button class="btn btn-primary" @click="load">重新加载</button>
    </div>

    <template v-else-if="card">
      <div class="container cv-main">
        <div class="cv-profile card">
          <div class="cv-avatar">
            <img v-if="card.avatar" :src="card.avatar" :alt="card.name" />
            <span v-else>{{ (card.name || '名').slice(0, 1) }}</span>
          </div>
          <div class="cv-ident">
            <div class="cv-name-row">
              <img v-if="card.logo" class="cv-logo" :src="card.logo" :alt="(card.company || '公司') + ' LOGO'" />
              <div class="cv-name">{{ card.name || card.name_en || '未填写姓名' }}
                <span v-if="card.name_en" class="cv-en">{{ card.name_en }}</span>
              </div>
            </div>
            <div class="cv-title">{{ [card.title, card.company, card.department].filter(Boolean).join(' · ') || '点击进入编辑，完善你的职业信息' }}</div>
            <div v-if="card.tags?.length" class="cv-tags"><span v-for="tag in card.tags" :key="tag">{{ tag }}</span></div>
          </div>
          <span v-if="!card.active" class="badge warn cv-status">未开通 / 已到期</span>
        </div>

        <div v-if="!card.active" class="card card-pad notice-card">
          <b>这张名片尚未开通或已到期</b>
          <p class="small muted">联系持有者开通后，二维码仍会指向这里，无需更换。</p>
        </div>
        <div v-if="isOwner && !card.active" class="btn-row" style="margin:12px 0">
          <router-link to="/me/plans" class="btn btn-primary">立即开通</router-link>
        </div>

        <div class="cv-actions card">
          <button @click="tel(card.mobile || card.phone)"><i>✆</i><span>打电话</span></button>
          <button @click="sms(card.mobile || card.phone)"><i>✎</i><span>发短信</span></button>
          <button @click="mailto(card.email)"><i>✉</i><span>写邮件</span></button>
          <button @click="copy(card.wechat || card.whatsapp, '微信号')"><i>微</i><span>微信</span></button>
        </div>

        <div v-if="card.bio" class="card card-pad cv-block">
          <h3>关于我</h3><p class="cv-bio">{{ card.bio }}</p>
        </div>

        <div v-if="card.company_intro" class="card card-pad cv-block">
          <h3>公司简介 <span class="small muted" v-if="card.company">· {{ card.company }}</span></h3>
          <p class="cv-bio">{{ card.company_intro }}</p>
        </div>

        <div v-if="card.links?.length" class="card card-pad cv-block">
          <h3>更多链接</h3>
          <div class="cv-links">
            <a v-for="(l, i) in card.links" :key="i" :href="safeUrl(l.url)" target="_blank" rel="noopener">
              <b>{{ l.label || '链接' }}</b><span>{{ shortUrl(l.url) }} ↗</span>
            </a>
          </div>
        </div>

        <div v-if="card.address" class="card card-pad cv-block">
          <h3>地址</h3>
          <div class="cv-address">
            <span>{{ card.address }} {{ card.address_detail }}</span>
            <button class="btn btn-sm btn-ghost" @click="copy(card.address + (card.address_detail || ''), '地址')">复制</button>
          </div>
          <div class="cv-maps">
            <a v-for="m in maps" :key="m.key" :href="m.href" target="_blank" rel="noopener">{{ m.label }}导航 ↗</a>
          </div>
        </div>

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

        <div class="card card-pad cv-exchange">
          <div><h3>交换名片</h3><p class="small muted">扫描对方二维码后，在这里留下互换记录</p></div>
          <button class="btn btn-ghost btn-sm" @click="openExchange">我要交换</button>
        </div>

        <p class="cv-footer">由 <b>{{ siteConfig.site_name }}</b> 提供技术支持 · 资料可改 · 二维码不变</p>
      </div>

      <div class="cv-dock">
        <button class="btn btn-primary" @click="saveContact">存入通讯录</button>
        <button class="btn btn-ghost" @click="goMap">导航</button>
        <button class="btn btn-ghost" @click="doShare">分享</button>
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

    <!-- 微信内下载引导 -->
    <div v-if="guide" class="modal-mask" @click.self="guide = ''">
      <div class="modal">
        <h3>{{ guide === 'contact' ? '保存到通讯录' : '保存二维码' }}</h3>
        <p>微信内置浏览器限制文件下载。请点右上角「···」→ 在浏览器中打开，再点击保存；或长按下方二维码图片保存。</p>
        <img :src="qrApi + '/qr.svg?size=520'" style="width:200px;height:200px;margin:10px auto" alt="二维码" />
        <div class="btn-row">
          <button class="btn btn-primary" @click="openVcf">打开名片文件</button>
          <button class="btn btn-ghost" @click="guide = ''">知道了</button>
        </div>
      </div>
    </div>

    <!-- 交换名片 -->
    <div v-if="exchangeOpen" class="modal-mask" @click.self="exchangeOpen = false">
      <div class="modal">
        <h3>交换名片</h3>
        <p>填入你的名片短码（例如名片链接 /c/ 后面的部分），双方即建立互换记录。</p>
        <input v-model.trim="mySlug" class="input" placeholder="你的名片短码" />
        <div class="btn-row" style="margin-top:14px;justify-content:flex-end">
          <button class="btn btn-ghost" @click="exchangeOpen = false">取消</button>
          <button class="btn btn-primary" :disabled="exchanging" @click="doExchange">{{ exchanging ? '提交中…' : '确认交换' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../api'
import { showToast, auth, siteConfig } from '../store'
import { THEMES, themeOf, themeVars } from '../utils/themes'
import { isWeChat, saveImageUrl, saveText } from '../utils/save-image'
import { shareOrCopy, mapLinks } from '../utils/share'

const route = useRoute(); const router = useRouter()
const slug = route.params.slug
const qrApi = `/api/cards/public/${slug}`
const vcfApi = `${qrApi}/card.vcf`
const card = ref(null); const loading = ref(true); const error = ref('')
const currentTheme = ref('ocean'); const isOwner = ref(false)
const qrModal = ref(false); const guide = ref(''); const exchangeOpen = ref(false)
const mySlug = ref(''); const exchanging = ref(false)

const t = computed(() => themeOf({ theme: currentTheme.value, accent: card.value?.accent }))
const vars = computed(() => themeVars(t.value))
const maps = computed(() => mapLinks(card.value?.address || ''))
const windowRef = window

function shortUrl(u) { return String(u || '').replace(/^https?:\/\//, '').slice(0, 30) }
function safeUrl(u) { try { const x = new URL(u); return ['http:', 'https:'].includes(x.protocol) ? x.href : '#' } catch { return '#' } }

async function load() {
  loading.value = true; error.value = ''
  try {
    const { data } = await api.get(qrApi)
    card.value = data.data
    currentTheme.value = THEMES[data.data.theme] ? data.data.theme : 'ocean'
    if (auth.token) {
      try { const mine = await api.get('/api/cards/mine'); isOwner.value = mine.data.data?.slug === slug } catch { /* 忽略 */ }
    }
  } catch (e) { error.value = e.message } finally { loading.value = false }
}
onMounted(load)

function tel(v) { if (v) windowRef.location.href = `tel:${v}`; else showToast('尚未填写电话') }
function sms(v) { if (v) windowRef.location.href = `sms:${v}`; else showToast('尚未填写手机号') }
function mailto(v) { if (v) windowRef.location.href = `mailto:${v}`; else showToast('尚未填写邮箱') }
function goMap() { if (card.value?.address) windowRef.location.href = maps.value[0].href; else showToast('尚未填写地址') }
function openVcf() { windowRef.open(vcfApi, '_blank'); guide.value = '' }
async function copy(v, label) {
  if (!v) return showToast(`尚未填写${label}`)
  try { await navigator.clipboard.writeText(v); showToast(`${label}已复制`, 'success') }
  catch { showToast(v) }
}
async function saveQr() {
  const r = await saveImageUrl(`${qrApi}/qr.png?size=900`, `${slug}-二维码.png`)
  if (r.kind === 'longpress') { guide.value = 'qr'; return }
  showToast(r.kind === 'downloaded' ? '二维码已开始下载' : '已打开二维码，请长按保存', 'success')
}
async function saveContact() {
  if (!card.value) return
  if (isWeChat()) { guide.value = 'contact'; return }
  const r = await saveImageUrl(vcfApi, `${card.value.name || slug}.vcf`)
  if (r.kind === 'downloaded') showToast('已下载，打开即可导入通讯录', 'success')
  else showToast('已打开名片文件，请选择导入通讯录')
}
async function doShare() {
  const r = await shareOrCopy({ title: card.value?.name || '电子名片', text: card.value?.title || '扫一扫保存我的名片', url: card.value?.url || windowRef.location.href })
  if (r === 'copied') showToast('链接已复制，快分享给朋友', 'success')
  else if (r === 'failed') showToast('复制失败，请手动复制地址栏链接', 'error')
}
function openExchange() {
  if (isOwner.value && card.value) mySlug.value = slug
  exchangeOpen.value = true
}
async function doExchange() {
  if (!mySlug.value) return showToast('请填写你的名片短码')
  exchanging.value = true
  try {
    await api.post(`${qrApi}/exchange`, { slug: mySlug.value })
    showToast('交换成功，已在双方记录中留存', 'success')
    exchangeOpen.value = false
  } catch (e) { showToast(e.message, 'error') } finally { exchanging.value = false }
}
</script>

<style scoped>
.cv-page { background: var(--t-bg); color: var(--t-text); min-height: 100vh; padding-bottom: 84px; }
.cv-cover { height: 168px; position: relative; border-radius: 0 0 28px 28px; }
.cv-back { position: absolute; left: 14px; top: calc(14px + env(safe-area-inset-top)); font-size: 30px; color: #fff; line-height: 1; }
.cv-brand { position: absolute; right: 16px; top: calc(18px + env(safe-area-inset-top)); color: #fff; font-weight: 800; opacity: .9; }
.cv-brand em { font-style: normal; opacity: .75; }
.cv-themes { position: absolute; right: 16px; bottom: 14px; display: flex; gap: 6px; }
.cv-themes button { width: 16px; height: 16px; border-radius: 50%; border: 2px solid rgba(255,255,255,.6); }
.cv-themes button.on { box-shadow: 0 0 0 2px #fff; transform: scale(1.15); }
.cv-main { margin-top: -48px; position: relative; }
.cv-loading { padding: 60px 0; text-align: center; }
.cv-profile { padding: 18px; display: flex; gap: 14px; align-items: flex-start; position: relative; background: var(--t-surface); }
.cv-avatar { flex: 0 0 70px; height: 70px; border-radius: 18px; overflow: hidden; background: var(--t-accent); color: #fff; display: grid; place-items: center; font-size: 30px; font-weight: 800; }
.cv-avatar img { width: 100%; height: 100%; object-fit: cover; }
.cv-ident { flex: 1; min-width: 0; }
.cv-name-row { display: flex; align-items: center; gap: 10px; }
.cv-logo { width: 40px; height: 40px; object-fit: contain; flex-shrink: 0; border-radius: 8px; background: rgba(127,127,127,.06); padding: 3px; }
.cv-name { font-size: 22px; font-weight: 800; letter-spacing: -.5px; }
.cv-en { font-size: 12px; color: var(--t-muted); font-weight: 500; margin-left: 6px; }
.cv-title { color: var(--t-muted); font-size: 12px; margin-top: 3px; }
.cv-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 9px; }
.cv-tags span { font-size: 11px; padding: 3px 9px; border-radius: 999px; background: color-mix(in srgb, var(--t-accent) 12%, transparent); color: var(--t-accent); font-weight: 600; }
.cv-status { position: absolute; right: 14px; bottom: 12px; }
.notice-card { margin-top: 12px; border-color: #fcd34d; background: #fffbeb; color: #92400e; }
.cv-actions { display: grid; grid-template-columns: repeat(4, 1fr); margin-top: 12px; padding: 8px 0; background: var(--t-surface); }
.cv-actions button { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 11px; color: var(--t-muted); }
.cv-actions i { font-style: normal; width: 38px; height: 38px; border-radius: 50%; background: color-mix(in srgb, var(--t-accent) 12%, transparent); color: var(--t-accent); display: grid; place-items: center; font-size: 17px; font-weight: 700; }
.cv-block { margin-top: 12px; background: var(--t-surface); }
.cv-block h3 { font-size: 14px; margin-bottom: 8px; }
.cv-bio { color: var(--t-muted); font-size: 13px; white-space: pre-wrap; }
.cv-links { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; }
.cv-links a { border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; background: var(--t-bg); }
.cv-links b { font-size: 13px; }
.cv-links span { font-size: 10px; color: var(--t-muted); }
.cv-address { display: flex; align-items: center; gap: 8px; justify-content: space-between; }
.cv-maps { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.cv-maps a { font-size: 12px; padding: 6px 10px; border-radius: 8px; background: color-mix(in srgb, var(--t-accent) 12%, transparent); color: var(--t-accent); font-weight: 600; }
.cv-qr-card { margin-top: 12px; display: flex; gap: 16px; align-items: center; background: var(--t-surface); }
.cv-qr-img { flex: 0 0 116px; width: 116px; height: 116px; padding: 6px; background: #fff; border-radius: 12px; border: 1px solid var(--line); }
.cv-qr-img img { width: 100%; height: 100%; }
.cv-qr-info h3 { font-size: 15px; }
.cv-qr-info p { margin-top: 4px; }
.cv-exchange { margin-top: 12px; display: flex; justify-content: space-between; align-items: center; background: var(--t-surface); }
.cv-exchange h3 { font-size: 14px; }
.cv-footer { text-align: center; color: var(--t-muted); font-size: 11px; padding: 26px 0 10px; }
.cv-dock { position: fixed; left: 0; right: 0; bottom: 0; display: flex; gap: 8px; padding: 10px 14px calc(10px + env(safe-area-inset-bottom)); background: rgba(255,255,255,.94); backdrop-filter: blur(12px); border-top: 1px solid var(--line); z-index: 60; }
.cv-dock .btn { flex: 1; }
@media (max-width: 520px) { .cv-qr-card { flex-direction: column; align-items: flex-start; } }
</style>
