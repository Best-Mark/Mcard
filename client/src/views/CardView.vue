<template>
  <div class="cv-page" :class="'cv-tpl-' + template" :style="vars">
    <div class="cv-cover">
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
        <div class="cv-profile card" :data-wm="template === 'navygold' ? (card.company || '').slice(0, 4) : ''">
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
            <div class="cv-title">{{ displayTitle || '点击进入编辑，完善你的职业信息' }}</div>
            <div v-if="template === 'navygold' && displayOrg" class="cv-org">{{ displayOrg }}</div>
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
          <button @click="copy(card.alipay, '支付宝账号')"><i>支</i><span>支付宝</span></button>
        </div>

        <div v-if="contactFields.length" class="card card-pad cv-block">
          <h3>联系方式 <span class="small muted">· 点右侧复制</span></h3>
          <div v-for="f in contactFields" :key="f.key" class="cv-contact-row">
            <div class="cv-contact-label">{{ f.label }}</div>
            <div class="cv-contact-value">{{ f.value }}</div>
            <button class="btn btn-sm btn-ghost" @click="copy(f.value, f.label)">复制</button>
          </div>
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

        <div v-if="materialsList.length" class="card card-pad cv-block">
          <h3>资料夹 <span class="small muted">· 点击查看，可扫码存我名片</span></h3>
          <router-link v-for="m in materialsList" :key="m.id" :to="`/m/${card.slug}`" class="cv-material-row">
            <span class="cv-material-ico">{{ m.type === 'file' ? '📄' : '🔗' }}</span>
            <span class="cv-material-title">{{ m.title }}</span>
            <span class="cv-material-more">查看 ›</span>
          </router-link>
        </div>

        <div v-if="siteLinks.length" class="card card-pad cv-block">
          <h3>主页与店铺</h3>
          <div v-for="l in siteLinks" :key="l.key" class="cv-site">
            <div><b>{{ l.label }}</b><span class="small muted">{{ shortUrl(l.url) }}</span></div>
            <div class="btn-row">
              <a :href="safeUrl(l.url)" target="_blank" rel="noopener" class="btn btn-sm btn-primary">打开</a>
              <button class="btn btn-sm btn-ghost" @click="copy(l.url, l.label)">复制</button>
            </div>
          </div>
        </div>

        <div v-if="hasAnyQr" class="card card-pad cv-block">
          <h3>加好友 / 收付款</h3>
          <div class="qr-grid">
            <div v-for="q in contactQrs" :key="q.key" class="qr-tile">
              <img :src="fullUrl(q.url)" :alt="q.label" loading="lazy" @click="previewQr(q)" />
              <b>{{ q.label }}</b>
              <span class="small muted">{{ qrHint(q.platform) }}</span>
              <div class="btn-row">
                <button v-if="q.account" class="btn btn-sm btn-ghost" @click="copy(q.account, q.accountLabel)">复制账号</button>
                <button class="btn btn-sm btn-ghost" @click="saveQrFile(q)">保存二维码</button>
              </div>
            </div>
          </div>
          <p class="small muted" style="margin-top:10px">付款前请核对收款方与金额；二维码由名片主人自行上传。</p>
        </div>

        <div v-if="fullAddress" class="card card-pad cv-block">
          <h3>地址</h3>
          <div v-if="regionLine" class="cv-region-line">{{ regionLine }}</div>
          <div class="cv-address">
            <span>{{ fullAddress }}</span>
            <button class="btn btn-sm btn-ghost" @click="copy(fullAddress, '地址')">复制</button>
          </div>
          <div v-if="card.latitude != null && card.longitude != null" class="cv-geo-hint small muted">
            ⌖ {{ card.latitude.toFixed(4) }}, {{ card.longitude.toFixed(4) }}
          </div>
          <div class="cv-maps">
            <a v-for="m in maps" :key="m.key" :href="m.href" target="_blank" rel="noopener">{{ m.label }}导航 ↗</a>
          </div>
        </div>

        <!-- 通讯录二维码：内容就是 vCard，相机扫一扫直接弹「添加到通讯录」 -->
        <div class="card card-pad cv-block cv-contact-qr" id="contact-qr">
          <h3 class="cv-sec-title">存入通讯录</h3>
          <p class="small muted cv-qr-lead">用手机相机扫一扫下方二维码，即可把名片直接存入通讯录（iPhone / 安卓 / 鸿蒙通用）</p>
          <button class="cv-vcard-qr" @click="vcardQrModal = true" title="点击放大">
            <img v-if="vcardQrDataUrl" :src="vcardQrDataUrl" alt="存入通讯录二维码" />
            <img v-else :src="vcardQrApi" alt="存入通讯录二维码" fetchpriority="high" decoding="async" />
          </button>
          <div class="cv-qr-actions">
            <button class="btn btn-primary" @click="vcardQrModal = true">放大二维码</button>
            <button class="btn btn-ghost" @click="saveContact">iPhone 一键添加</button>
          </div>
          <p class="small muted" style="margin-top:8px">也可点击底部「存入通讯录」，在 iPhone 上直接打开系统添加界面</p>
        </div>

        <div class="card card-pad cv-block">
          <h3 class="cv-sec-title">分享这张名片</h3>
          <p class="small muted">下方二维码打开的是名片网页，可转发给朋友浏览</p>
          <button class="cv-share-qr" @click="qrModal = true" title="点击放大">
            <img :src="qrApi + '/qr.svg?size=360'" alt="名片网页二维码" />
          </button>
        </div>

        <div class="card card-pad cv-exchange">
          <div><h3>交换名片</h3><p class="small muted">扫描对方二维码后，在这里留下互换记录</p></div>
          <button class="btn btn-ghost btn-sm" @click="openExchange">我要交换</button>
        </div>

        <p class="cv-footer">由 <b>{{ siteConfig.site_name }}</b> 提供技术支持 · 资料可改 · 二维码不变</p>
      </div>

      <div class="cv-dock">
        <button class="btn btn-primary" @click="tel(card.mobile || card.phone)">📞 打电话</button>
        <button class="btn btn-ghost" @click="saveContact">存入通讯录</button>
        <button class="btn btn-ghost" @click="goMap">导航</button>
        <button class="btn btn-ghost" :class="{ 'fav-on': favorite }" @click="toggleFavorite">{{ favorite ? '★ 已收藏' : '☆ 收藏' }}</button>
      </div>
      <button class="cv-share-fab" @click="doShare" aria-label="分享名片">↗<span>分享</span></button>
    </template>

    <!-- 通讯录二维码大图：相机扫一扫直接加联系人 -->
    <div v-if="vcardQrModal" class="modal-mask" @click.self="vcardQrModal = false">
      <div class="modal center">
        <h3>存入通讯录</h3>
        <p class="small muted" style="margin:6px 0 12px">用<i style="font-style:normal;color:#07c160;font-weight:700">手机相机</i>扫一扫（不是微信扫一扫），直接弹出联系人卡片，点「添加到通讯录」即可</p>
        <img :src="vcardQrDataUrl || vcardQrLargeApi" style="width:260px;height:260px;margin:4px auto;display:block" alt="通讯录二维码" />
        <p class="small muted">iPhone 相机 / 安卓相机 / 鸿蒙相机 / 系统扫一扫均可识别</p>
        <div class="btn-row" style="justify-content:center;margin-top:12px">
          <button class="btn btn-primary" @click="saveQrFile({ url: vcardQrDataUrl || vcardQrApi, label: '通讯录二维码' })">保存二维码图片</button>
          <button class="btn btn-ghost" @click="vcardQrModal = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 名片网页二维码大图 -->
    <div v-if="qrModal" class="modal-mask" @click.self="qrModal = false">
      <div class="modal center">
        <h3>分享名片</h3>
        <img :src="qrApi + '/qr.svg?size=640'" style="width:240px;height:240px;margin:12px auto" alt="二维码大图" />
        <p class="small">扫一扫打开名片网页；长按图片可保存</p>
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
        <p>微信内置浏览器限制通讯录写入。请点右上角「···」→ <b>在浏览器中打开</b>（已自动带上登录状态，无需再次登录），再点「存入通讯录」即可一键添加联系人。</p>
        <img v-if="guide !== 'contact'" :src="guideImage || (qrApi + '/qr.svg?size=520')" style="width:200px;height:200px;margin:10px auto;object-fit:contain" alt="二维码" />
        <div class="btn-row">
          <button v-if="guide === 'contact'" class="btn btn-primary" @click="openVcf">直接打开名片文件</button>
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
import { isWeChat, isIOS, saveImageUrl, prepareExternalOpen, openVcfInline } from '../utils/save-image'
import { shareOrCopy, mapLinks } from '../utils/share'
import { setupWechatShare, absoluteMediaUrl } from '../utils/wx-share'
import { getCachedPosition } from '../utils/geo'
// QRCode 动态加载：只在进入名片页、需要本地生成 vCard 高清二维码时才下载，不拖慢首屏

const route = useRoute(); const router = useRouter()
const slug = route.params.slug
const qrApi = `/api/cards/public/${slug}`
const vcfApi = `${qrApi}/card.vcf`
const vcardQrApi = `${qrApi}/vcard.svg?size=520`
const vcardQrLargeApi = `${qrApi}/vcard.svg?size=720`
const vcardQrPngApi = `${qrApi}/vcard.png?size=720`
// vCard 高清图用服务端 vcard.png（与公开二维码同款美化样式：码点/码眼/渐变/配色），秒开且保存即高清
const vcardQrDataUrl = ref('')
const card = ref(null); const loading = ref(true); const error = ref('')
const currentTheme = ref('ocean'); const isOwner = ref(false)
const template = ref('classic')
const qrModal = ref(false); const vcardQrModal = ref(false); const guide = ref(''); const guideImage = ref(''); const exchangeOpen = ref(false)
const mySlug = ref(''); const exchanging = ref(false)
const favorite = ref(false); const favBusy = ref(false)
const materialsList = ref([])

const t = computed(() => themeOf({ theme: currentTheme.value, accent: card.value?.accent }))
const vars = computed(() => themeVars(t.value))
const regionLine = computed(() => {
  const c = card.value || {}
  return [c.province, c.city, c.district, c.street].filter(Boolean).join(' · ')
})
const fullAddress = computed(() => {
  const c = card.value || {}
  const region = [c.province, c.city, c.district, c.street].filter(Boolean).join('')
  return [region, c.address, c.address_detail].filter(Boolean).join(' ')
})
// 有坐标时优先用经纬度生成各地图导航，否则回落地址字符串
const maps = computed(() => {
  const c = card.value || {}
  if (c.latitude != null && c.longitude != null) {
    const lat = Number(c.latitude), lng = Number(c.longitude), name = encodeURIComponent(c.name || '位置')
    return [
      { key: 'amap', label: '高德', href: `https://uri.amap.com/marker?position=${lng},${lat}&name=${name}` },
      { key: 'baidu', label: '百度', href: `https://api.map.baidu.com/marker?location=${lat},${lng}&title=${name}&content=${name}&output=html` },
      { key: 'qq', label: '腾讯', href: `https://apis.map.qq.com/uri/v1/marker?marker=coord:${lat},${lng};title:${name}&referer=MCard` },
      { key: 'apple', label: 'Apple', href: `https://maps.apple.com/?ll=${lat},${lng}&q=${name}` }
    ]
  }
  return mapLinks(c.address || '')
})
// 深蓝鎏金模板把「公司」从职位行拆成独立署名行，其余模板保持原拼接口径
const displayOrg = computed(() => (template.value === 'navygold' ? (card.value?.company || '') : ''))
const displayTitle = computed(() => {
  const c = card.value || {}
  const parts = template.value === 'navygold' ? [c.title, c.department] : [c.title, c.company, c.department]
  return parts.filter(Boolean).join(' · ')
})
const windowRef = window
const isAlipay = () => /AlipayClient/i.test(navigator.userAgent || '')
const fullUrl = u => (u ? new URL(u, windowRef.location.origin).href : '')

const contactQrs = computed(() => {
  const c = card.value || {}
  return [
    { key: 'wechat_qr', url: c.wechat_qr, label: '微信 · 加好友', platform: 'wechat', account: c.wechat, accountLabel: '微信号' },
    { key: 'alipay_qr', url: c.alipay_qr, label: '支付宝 · 加好友', platform: 'alipay', account: c.alipay, accountLabel: '支付宝账号' },
    { key: 'wechat_pay_qr', url: c.wechat_pay_qr, label: '微信 · 收款码', platform: 'wechat', account: '', accountLabel: '' },
    { key: 'alipay_pay_qr', url: c.alipay_pay_qr, label: '支付宝 · 收款码', platform: 'alipay', account: '', accountLabel: '' }
  ].filter(q => q.url)
})
const hasAnyQr = computed(() => contactQrs.value.length > 0)
// 联系方式逐项一键复制（借鉴名片全能王「点字段直接复制」，比只打电话更通用）
const contactFields = computed(() => {
  const c = card.value || {}
  return [
    { key: 'mobile', label: '手机', value: c.mobile },
    { key: 'phone', label: '座机', value: c.phone },
    { key: 'email', label: '邮箱', value: c.email },
    { key: 'wechat', label: '微信', value: c.wechat },
    { key: 'alipay', label: '支付宝', value: c.alipay },
    { key: 'whatsapp', label: 'WhatsApp', value: c.whatsapp }
  ].filter(f => f.value)
})
const siteLinks = computed(() => {
  const c = card.value || {}
  const arr = []
  if (c.website) arr.push({ key: 'website', label: '公司主页', url: c.website })
  if (c.shop_url) arr.push({ key: 'shop', label: '店铺主页', url: c.shop_url })
  return arr
})

function shortUrl(u) { return String(u || '').replace(/^https?:\/\//, '').slice(0, 30) }
function safeUrl(u) { try { const x = new URL(u); return ['http:', 'https:'].includes(x.protocol) ? x.href : '#' } catch { return '#' } }
function qrHint(platform) {
  const env = isWeChat() ? 'wechat' : isAlipay() ? 'alipay' : 'other'
  if (env === platform) return '长按图片即可识别'
  if (env === 'other') return '保存后用对应 App 扫一扫'
  return `保存图片后用${platform === 'wechat' ? '微信' : '支付宝'}扫一扫`
}
function previewQr(q) { guideImage.value = fullUrl(q.url); guide.value = 'qr' }
// 微信内显示「去浏览器打开」引导前，先把登录凭证写进当前 URL，外部浏览器打开即免二次登录
async function showGuide(kind) {
  if (isWeChat()) await prepareExternalOpen(api)
  guide.value = kind
}
async function saveQrFile(q) {
  guideImage.value = fullUrl(q.url)
  const r = await saveImageUrl(guideImage.value, `${q.label.replace(' · ', '-')}.png`)
  if (r.kind === 'longpress') { await showGuide('qr'); return }
  showToast(r.kind === 'downloaded' ? '二维码已开始下载' : '已打开二维码，请长按保存', 'success')
}

// 与 server/src/services/vcard.js 同口径的本地构造：优先用服务端 vcard.txt（唯一真相源），
// 失败（如服务端未重启）时用本函数兜底，保证二维码永远能显示、相机扫一扫能加联系人。
function localVcard(c) {
  if (!c) return ''
  const esc = s => String(s || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
  const name = String(c.name || c.name_en || '').trim()
  const western = /^[\x00-\x7F]+$/.test(name) && name.includes(' ')
  const i = western ? name.lastIndexOf(' ') : -1
  const family = i >= 0 ? name.slice(0, i) : ''
  const given = i >= 0 ? name.slice(i + 1) : name
  const origin = windowRef.location.origin
  const url = `${origin}/c/${c.slug}`
  const notes = []
  if (c.bio) notes.push(c.bio)
  if (c.company_intro) notes.push(`公司简介：${c.company_intro}`)
  const extra = []
  if (c.wechat) extra.push(`微信：${c.wechat}`)
  if (c.alipay) extra.push(`支付宝：${c.alipay}`)
  if (c.whatsapp) extra.push(`WhatsApp：${c.whatsapp}`)
  if (c.shop_url) extra.push(`店铺：${c.shop_url}`)
  if (extra.length) notes.push(extra.join('\n'))
  notes.push(`电子名片：${url}`)
  const lines = [
    'BEGIN:VCARD', 'VERSION:3.0',
    `N:${esc(family)};${esc(given)};;;`,
    `FN:${esc(name || '名片')}`,
    c.company || c.department ? `ORG:${esc(c.company)};${esc(c.department)}` : '',
    c.title ? `TITLE:${esc(c.title)}` : '',
    c.mobile ? `TEL;TYPE=CELL,VOICE:${esc(c.mobile)}` : '',
    c.phone ? `TEL;TYPE=WORK,VOICE:${esc(c.phone)}` : '',
    c.email ? `EMAIL;TYPE=INTERNET,WORK:${esc(c.email)}` : '',
    c.address || c.address_detail ? `ADR;TYPE=WORK:;;${esc(c.address_detail)};${esc(c.address)};;;` : '',
    c.website ? `URL;TYPE=WORK:${esc(c.website)}` : '',
    `URL:${esc(url)}`,
    `NOTE:${esc(notes.filter(Boolean).join('\n'))}`,
    'END:VCARD'
  ].filter(Boolean)
  return lines.join('\r\n') + '\r\n'
}

function buildVcardQr(c) {
  if (!c) return
  // 直接用服务端 vcard.png：与公开二维码同款美化样式，免前端生成（省 ~45ms 且样式一致）
  vcardQrDataUrl.value = vcardQrPngApi
}

async function load() {
  loading.value = true; error.value = ''
  try {
    const { data } = await api.get(qrApi)
    card.value = data.data
    buildVcardQr(data.data)
    currentTheme.value = THEMES[data.data.theme] ? data.data.theme : 'ocean'
    template.value = data.data.template || 'classic'
    setupWechatShare(api, {
      title: `${card.value.name || '名片'} · ${card.value.title || card.value.company || '电子名片'}`,
      desc: `${[card.value.company, card.value.department, card.value.title].filter(Boolean).join(' · ') || '电子名片'}，扫码即可存入通讯录`,
      link: card.value.url || windowRef.location.href,
      imgUrl: absoluteMediaUrl(card.value.avatar || card.value.logo || card.value.cover)
    })
    if (auth.token) {
      try { const mine = await api.get('/api/cards/mine'); isOwner.value = mine.data.data?.slug === slug } catch { /* 忽略 */ }
      if (!isOwner.value) {
        try { favorite.value = !!(await api.get(`/api/cards/public/${slug}/favorite`)).data.data?.favorite } catch { /* 忽略 */ }
      }
    }
    // 工作台「存入通讯录」跳过来：立即弹层（弹层图默认用服务端 vcard.svg，秒开；
    // 本地高清 dataURL 后台生成好后无缝替换，供保存 PNG 用），不再干等 JS 生成
    if (String(route.query.save) === '1') {
      vcardQrModal.value = true
      // save 是一次性展示参数，清掉它和可能残留的登录凭证，避免被原生转发带出去
      const u = new URL(windowRef.location.href)
      let changed = false
      for (const k of ['save', 'wx_ticket']) if (u.searchParams.has(k)) { u.searchParams.delete(k); changed = true }
      if (changed) windowRef.history.replaceState(null, '', u.toString())
    }
  } catch (e) { error.value = e.message } finally { loading.value = false }
  // 资料夹与来源/城市上报：不阻塞名片主流程，失败静默
  try { materialsList.value = (await api.get(`${qrApi}/materials`)).data.data?.list || [] } catch { /* 忽略 */ }
  traceVisit()
}
async function traceVisit() {
  try {
    const src = String(route.query.src || '')
    // 只读已缓存位置，不主动触发定位授权（看名片不该弹定位框）；
    // 默认城市兜底不算真实定位，不上报，避免把未授权访客都记成「上海」脏数据
    let city = ''
    try { const p = getCachedPosition(); city = p.source && p.source !== 'default' ? (p.city || '') : '' } catch { /* 无缓存 */ }
    if (src || city) await api.post(`${qrApi}/trace`, { source: src, city })
  } catch { /* 上报失败静默 */ }
}
onMounted(load)

function tel(v) { if (v) windowRef.location.href = `tel:${v}`; else showToast('尚未填写电话') }
function sms(v) { if (v) windowRef.location.href = `sms:${v}`; else showToast('尚未填写手机号') }
function mailto(v) { if (v) windowRef.location.href = `mailto:${v}`; else showToast('尚未填写邮箱') }
function goMap() { if (card.value?.address) windowRef.location.href = maps.value[0].href; else showToast('尚未填写地址') }
function openVcf() {
  guide.value = ''
  if (isIOS() && !isWeChat()) return openVcfInline(vcfApi)
  windowRef.open(vcfApi, '_blank')
}
async function copy(v, label) {
  if (!v) return showToast(`尚未填写${label}`)
  try { await navigator.clipboard.writeText(v); showToast(`${label}已复制`, 'success') }
  catch { showToast(v) }
}
async function saveQr() {
  guideImage.value = ''
  const r = await saveImageUrl(`${qrApi}/qr.png?size=900`, `${slug}-二维码.png`)
  if (r.kind === 'longpress') { await showGuide('qr'); return }
  showToast(r.kind === 'downloaded' ? '二维码已开始下载' : '已打开二维码，请长按保存', 'success')
}
async function saveContact() {
  if (!card.value) return
  if (isWeChat()) { await showGuide('contact'); return }
  if (isIOS()) {
    // 先弹 vCard 二维码大图（最稳），同时尝试直开 .vcf（iOS Safari 支持时直接弹系统添加界面）
    vcardQrModal.value = true
    openVcfInline(vcfApi)
    return
  }
  const r = await saveImageUrl(vcfApi, `${card.value.name || slug}.vcf`)
  if (r.kind === 'downloaded') showToast('已下载，打开即可导入通讯录', 'success')
  else showToast('已打开名片文件，请选择导入通讯录')
}
async function doShare() {
  if (isWeChat()) {
    showToast('已设为名片卡片：点右上角「···」→ 发送给朋友 / 分享到朋友圈', 'error')
    return
  }
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
async function toggleFavorite() {
  if (favBusy.value) return
  if (!auth.token) return showToast('请先登录再收藏名片', 'error')
  if (isOwner.value) return showToast('不能收藏自己的名片')
  favBusy.value = true
  try {
    const { data } = await api.post(`${qrApi}/favorite`)
    favorite.value = !!data.data?.favorite
    showToast(favorite.value ? '已收藏到我的名片夹' : '已取消收藏', 'success')
  } catch (e) { showToast(e.message, 'error') } finally { favBusy.value = false }
}
</script>

<style scoped>
.cv-page { background: var(--t-bg); color: var(--t-text); min-height: 100vh; padding-bottom: 84px; }
.cv-cover { height: 168px; position: relative; border-radius: 0 0 28px 28px; background: var(--t-cover); }
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
.cv-tags span { font-size: 11px; padding: 3px 9px; border-radius: 999px; background: rgba(0,0,0,.05); background: color-mix(in srgb, var(--t-accent) 12%, transparent); color: var(--t-accent); font-weight: 600; }
.cv-status { position: absolute; right: 14px; bottom: 12px; }
.notice-card { margin-top: 12px; border-color: #fcd34d; background: #fffbeb; color: #92400e; }
.cv-actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(58px, 1fr)); margin-top: 12px; padding: 8px 0; background: var(--t-surface); }
.cv-actions button { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 11px; color: var(--t-muted); }
.cv-actions i { font-style: normal; width: 38px; height: 38px; border-radius: 50%; background: rgba(0,0,0,.05); background: color-mix(in srgb, var(--t-accent) 12%, transparent); color: var(--t-accent); display: grid; place-items: center; font-size: 17px; font-weight: 700; }
.cv-block { margin-top: 12px; background: var(--t-surface); }
.cv-block h3 { font-size: 14px; margin-bottom: 8px; }
.cv-bio { color: var(--t-muted); font-size: 13px; white-space: pre-wrap; }
.cv-links { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; }
.cv-links a { border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; background: var(--t-bg); }
.cv-links b { font-size: 13px; }
.cv-links span { font-size: 10px; color: var(--t-muted); }
.cv-site { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
.cv-site:last-child { border-bottom: 0; }
.cv-site > div:first-child { display: flex; flex-direction: column; min-width: 0; }
.qr-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
.qr-tile { border: 1px solid var(--line); border-radius: 12px; padding: 12px; text-align: center; background: var(--t-bg); display: flex; flex-direction: column; align-items: center; gap: 5px; }
.qr-tile img { width: 116px; height: 116px; object-fit: contain; background: #fff; border-radius: 8px; cursor: zoom-in; }
.qr-tile b { font-size: 13px; }
.qr-tile .btn-row { justify-content: center; margin-top: 4px; }
.cv-address { display: flex; align-items: center; gap: 8px; justify-content: space-between; }
.cv-region-line { font-size: 13px; font-weight: 600; color: var(--t-accent); margin-bottom: 6px; }
.cv-contact-row { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--t-line, rgba(0,0,0,.06)); }
.cv-contact-row:last-child { border-bottom: 0; }
.cv-contact-label { flex: 0 0 56px; font-size: 12px; color: var(--t-muted); }
.cv-contact-value { flex: 1; min-width: 0; font-size: 13px; word-break: break-all; }
.cv-material-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--t-line, rgba(0,0,0,.06)); color: inherit; text-decoration: none; }
.cv-material-row:last-child { border-bottom: 0; }
.cv-material-ico { font-size: 18px; }
.cv-material-title { flex: 1; min-width: 0; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cv-material-more { font-size: 12px; color: var(--t-accent); }
.cv-geo-hint { margin-top: 6px; font-variant-numeric: tabular-nums; }
.cv-maps { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.cv-maps a { font-size: 12px; padding: 6px 10px; border-radius: 8px; background: rgba(0,0,0,.05); background: color-mix(in srgb, var(--t-accent) 12%, transparent); color: var(--t-accent); font-weight: 600; }
.cv-qr-card { margin-top: 12px; display: flex; flex-direction: column; align-items: center; text-align: center; background: var(--t-surface); padding: 22px 18px 20px; }
.cv-qr-img { display: block; width: 140px; height: 140px; margin: 0 auto 14px; padding: 8px; background: #fff; border-radius: 10px; border: 1px solid var(--line); box-shadow: 0 4px 14px rgba(15,23,42,.06); }
.cv-qr-img img { display: block; width: 100%; height: 100%; }
.cv-qr-info h3 { font-size: 14px; font-weight: 600; }
.cv-qr-info p { margin-top: 4px; font-size: 12px; }
.cv-exchange { margin-top: 12px; display: flex; justify-content: space-between; align-items: center; background: var(--t-surface); }
.cv-exchange h3 { font-size: 14px; }
.cv-footer { text-align: center; color: var(--t-muted); font-size: 11px; padding: 26px 0 10px; }
.cv-dock { position: fixed; left: 0; right: 0; bottom: 0; display: flex; gap: 6px; padding: 10px 12px calc(10px + env(safe-area-inset-bottom)); background: rgba(255,255,255,.96); backdrop-filter: blur(12px); border-top: 1px solid var(--line); z-index: 60; }
.cv-dock .btn { flex: 1; padding-left: 4px; padding-right: 4px; font-size: 13px; }
.cv-dock .fav-on { color: #d97706; background: #fffbeb; border-color: #fcd34d; }
.cv-share-fab { position: fixed; right: 16px; bottom: calc(76px + env(safe-area-inset-bottom)); z-index: 61; width: 58px; height: 58px; border-radius: 50%; background: var(--t-accent, #2563eb); color: #fff; box-shadow: 0 8px 24px rgba(0,0,0,.28); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; font-size: 20px; }
.cv-share-fab span { font-size: 10px; }

/* ============ 布局模板：template × theme 正交组合，template 只改布局/形状，配色仍走 --t-* 变量 ============ */

/* 经典商务 classic：默认样式即经典，这里只做轻微增强（封面圆润、头像方形圆角） */
.cv-tpl-classic .cv-cover { border-radius: 0 0 28px 28px; }
.cv-tpl-classic .cv-avatar { border-radius: 18px; }

/* 极简素雅 minimal：去掉彩色封面改为浅色细条、细分割线、无卡片阴影、克制留白 */
.cv-tpl-minimal .cv-cover { height: 76px; border-radius: 0; background: var(--t-surface); border-bottom: 1px solid var(--line); }
.cv-tpl-minimal .cv-brand { color: var(--t-accent); opacity: 1; }
.cv-tpl-minimal .cv-back { color: var(--t-text); }
.cv-tpl-minimal .cv-themes { display: none; }
.cv-tpl-minimal .cv-main { margin-top: 0; }
.cv-tpl-minimal .card { box-shadow: none; border: 0; border-bottom: 1px solid var(--line); border-radius: 0; background: transparent; }
.cv-tpl-minimal .cv-profile { padding: 24px 18px; }
.cv-tpl-minimal .cv-avatar { border-radius: 50%; background: var(--t-accent); }
.cv-tpl-minimal .cv-actions i { border-radius: 50%; }
.cv-tpl-minimal .cv-name { font-weight: 700; letter-spacing: -.3px; }
.cv-tpl-minimal .cv-block h3 { font-size: 12px; letter-spacing: 1px; color: var(--t-muted); text-transform: uppercase; }
.cv-tpl-minimal .cv-tags span { border-radius: 4px; }

/* 尊享黑金 elite：高封面 + 居中头像描金边 + 大写间距 + 居中署名，强调仪式感 */
.cv-tpl-elite .cv-cover { height: 210px; border-radius: 0 0 40px 40px; background: var(--t-cover); }
.cv-tpl-elite .cv-main { margin-top: -70px; }
.cv-tpl-elite .cv-profile { flex-direction: column; align-items: center; text-align: center; gap: 8px; padding: 22px 18px; background: var(--t-surface); }
.cv-tpl-elite .cv-avatar { flex: 0 0 96px; width: 96px; height: 96px; border-radius: 50%; border: 3px solid var(--t-accent); box-shadow: 0 0 0 5px var(--t-surface), 0 12px 30px rgba(0,0,0,.25); }
.cv-tpl-elite .cv-name-row { justify-content: center; }
.cv-tpl-elite .cv-name { font-size: 24px; letter-spacing: 2px; }
.cv-tpl-elite .cv-en { display: block; margin: 2px 0 0; letter-spacing: 1px; }
.cv-tpl-elite .cv-tags { justify-content: center; }
.cv-tpl-elite .cv-status { position: static; margin-top: 6px; }
.cv-tpl-elite .cv-block h3 { text-align: center; font-size: 12px; letter-spacing: 3px; color: var(--t-accent); }
.cv-tpl-elite .cv-qr-card { flex-direction: column; text-align: center; gap: 12px; }
.cv-tpl-elite .cv-qr-info .btn-row { justify-content: center; }
.cv-tpl-elite .cv-footer { letter-spacing: 1px; }

/* 活力格调 vivid：大圆角封面、头像悬浮叠加、彩色标签、更有呼吸感的圆角卡片 */
.cv-tpl-vivid .cv-cover { height: 188px; border-radius: 0 0 48px 48px; }
.cv-tpl-vivid .cv-main { margin-top: -56px; }
.cv-tpl-vivid .card { border-radius: 20px; box-shadow: 0 12px 34px rgba(15,23,42,.09); }
.cv-tpl-vivid .cv-profile { padding: 20px 18px; }
.cv-tpl-vivid .cv-avatar { border-radius: 26px; width: 84px; height: 84px; flex-basis: 84px; box-shadow: 0 8px 24px rgba(0,0,0,.16); box-shadow: 0 8px 24px color-mix(in srgb, var(--t-accent) 35%, transparent); }
.cv-tpl-vivid .cv-name { font-size: 23px; }
.cv-tpl-vivid .cv-tags span { border-radius: 8px; padding: 4px 12px; }
.cv-tpl-vivid .cv-actions i { border-radius: 14px; }
.cv-tpl-vivid .cv-block h3 { color: var(--t-accent); }
.cv-tpl-vivid .cv-qr-img { border-radius: 18px; }

/* 印章方格 seal：深蓝方块印章风，直角、回字描边、几何对称 */
.cv-tpl-seal { background: #eef2f9; }
.cv-tpl-seal .cv-cover {
  height: 190px; border-radius: 0;
  background: #12213c;
  background-image:
    linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px),
    linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px);
  background-size: 28px 28px;
  border-bottom: 4px solid #1e3a8a;
}
.cv-tpl-seal .cv-cover::after {
  content: ''; position: absolute; right: 18px; top: 18px; width: 34px; height: 34px;
  border: 3px solid rgba(147,197,253,.5); border-radius: 2px;
  box-shadow: inset 0 0 0 5px #12213c, inset 0 0 0 8px rgba(147,197,253,.35);
}
.cv-tpl-seal .cv-back, .cv-tpl-seal .cv-brand { color: #fff; }
.cv-tpl-seal .cv-main { margin-top: -44px; }
.cv-tpl-seal .card { border-radius: 4px; border: 1px solid #cbd5e1; box-shadow: 4px 4px 0 rgba(30,58,138,.12); }
.cv-tpl-seal .cv-profile { border-top: 3px solid #1e3a8a; padding: 20px 16px; }
.cv-tpl-seal .cv-avatar { border-radius: 4px; border: 3px solid #1e3a8a; box-shadow: 3px 3px 0 rgba(30,58,138,.18); }
.cv-tpl-seal .cv-name { font-weight: 800; letter-spacing: 1px; color: #12213c; }
.cv-tpl-seal .cv-en { letter-spacing: .5px; }
.cv-tpl-seal .cv-title { font-weight: 600; color: #1e3a8a; }
.cv-tpl-seal .cv-tags span { border-radius: 2px; border: 1px solid #1e3a8a; background: transparent; color: #1e3a8a; }
.cv-tpl-seal .cv-actions i { border-radius: 4px; border: 1px solid #1e3a8a; background: transparent; color: #1e3a8a; }
.cv-tpl-seal .cv-block h3 { color: #12213c; border-left: 4px solid #1e3a8a; padding-left: 9px; letter-spacing: 1px; }
.cv-tpl-seal .cv-links a, .cv-tpl-seal .qr-tile { border-radius: 4px; }
.cv-tpl-seal .cv-maps a, .cv-tpl-seal .btn-ghost { border-radius: 3px; }
.cv-tpl-seal .cv-qr-img { border-radius: 4px; border: 2px solid #1e3a8a; }
.cv-tpl-seal .cv-footer { color: #64748b; letter-spacing: 1px; }
.cv-tpl-seal .cv-dock { background: rgba(18,33,60,.96); border-top: 3px solid #1e3a8a; }
.cv-tpl-seal .cv-dock .btn-ghost { background: rgba(255,255,255,.14); color: #fff; border-color: transparent; }

/* 联络卡 contact：简洁商务联络卡（参考「扫码即联系 / 一键拨号 / 一键存档」形态）
   深蓝封面 + 白底信息卡 + 业务范围标签 + 表格化联系方式 + 深色底栏 */
.cv-tpl-contact { background: #f4f6fb; }
.cv-tpl-contact .cv-cover { height: 150px; border-radius: 0 0 20px 20px; background: linear-gradient(135deg,#0b1a3a 0%,#1e40af 58%,#3b82f6 100%); }
.cv-tpl-contact .cv-brand { letter-spacing: 1px; }
.cv-tpl-contact .cv-main { margin-top: -34px; }
.cv-tpl-contact .cv-profile { border-radius: 14px; border: 1px solid #dbe4f5; box-shadow: 0 8px 24px rgba(30,64,175,.10); padding: 20px 18px; align-items: center; }
.cv-tpl-contact .cv-avatar { border-radius: 10px; width: 78px; height: 78px; flex-basis: 78px; border: 2px solid #fff; box-shadow: 0 4px 14px rgba(30,64,175,.22); }
.cv-tpl-contact .cv-name { color: #0f2147; font-size: 24px; letter-spacing: .5px; }
.cv-tpl-contact .cv-title { color: #1e40af; font-weight: 600; }
.cv-tpl-contact .cv-tags span { border-radius: 4px; border: 1px solid #1e40af; background: #eff4ff; color: #1e40af; padding: 4px 10px; }
.cv-tpl-contact .cv-actions { border-radius: 12px; border: 1px solid #dbe4f5; background: #fff; }
.cv-tpl-contact .cv-actions i { border-radius: 10px; background: #eff4ff; color: #1e40af; }
.cv-tpl-contact .card { border-radius: 12px; }
.cv-tpl-contact .cv-block h3 { color: #0f2147; font-size: 13px; letter-spacing: 1px; border-left: 3px solid #1e40af; padding-left: 9px; }
.cv-tpl-contact .cv-bio { color: #475569; }
.cv-tpl-contact .contact-row { border-bottom: 1px dashed #e2e8f0; padding: 8px 0; }
.cv-tpl-contact .contact-row:last-child { border-bottom: 0; }
.cv-tpl-contact .contact-row b { color: #0f2147; }
.cv-tpl-contact .cv-qr-card { border-color: #dbe4f5; background: #fff; }
.cv-tpl-contact .cv-qr-info h3 { color: #0f2147; }
.cv-tpl-contact .cv-qr-img { border-radius: 8px; border: 1px solid #cbd5e1; }
.cv-tpl-contact .cv-exchange { background: #eff4ff; }
.cv-tpl-contact .cv-footer { color: #64748b; letter-spacing: 1px; padding-top: 18px; }
.cv-tpl-contact .cv-footer b { color: #1e40af; }
.cv-tpl-contact .cv-dock { background: rgba(11,26,58,.97); border-top: 2px solid #1e40af; }
.cv-tpl-contact .cv-dock .btn-ghost { background: rgba(255,255,255,.14); color: #fff; border-color: transparent; }

/* ============ 参考商务名片风（统一强化，放在最后覆盖）============ */
.cv-page { background: #eef3f8; }
.cv-page .card { border: 1px solid #dbe3ef; border-radius: 14px; box-shadow: 0 2px 10px rgba(16,36,70,.10); }
.cv-page .cv-block h3, .cv-page .cv-sec-title { font-size: 16px; font-weight: 700; color: #17233c; border-left: 4px solid #2454e8; padding-left: 10px; margin-bottom: 10px; }
.cv-page .small.muted, .cv-page .cv-qr-lead { color: #6c788c; }

/* 通讯录二维码卡：一眼就知道「扫这个存通讯录」 */
.cv-contact-qr { background: #fff; text-align: center; padding: 20px 16px; }
.cv-contact-qr .cv-sec-title { text-align: left; }
.cv-contact-qr .cv-qr-lead { text-align: left; line-height: 1.6; margin-bottom: 14px; font-size: 12px; }
.cv-vcard-qr { display: block; width: 240px; height: 240px; margin: 0 auto 14px; padding: 10px; background: #fff; border: 2px solid #1a3f86; border-radius: 12px; box-shadow: 0 6px 20px rgba(26,63,134,.14); }
.cv-vcard-qr img { display: block; width: 100%; height: 100%; }
.cv-qr-actions { display: flex; gap: 10px; justify-content: center; }
.cv-qr-actions .btn { min-width: 128px; }
.cv-share-qr { display: block; width: 160px; height: 160px; margin: 8px auto 0; padding: 8px; background: #fff; border: 1px solid #d9e1ee; border-radius: 10px; }
.cv-share-qr img { display: block; width: 100%; height: 100%; }

/* 身份卡：深蓝金高档质感 */
.cv-page .cv-profile { border-radius: 16px; border: 1px solid #dbe4f5; box-shadow: 0 8px 26px rgba(16,36,70,.12); background: #fff; }
.cv-page .cv-name { color: #132a53; font-size: 23px; }
.cv-page .cv-title { color: #2454e8; font-weight: 600; }

/* 底部深蓝操作栏 */
.cv-page .cv-dock { background: #0f1c33; border-top: 1px solid #1e3a8a; padding: 10px 12px calc(10px + env(safe-area-inset-bottom)); }
.cv-page .cv-dock .btn { font-size: 13px; border-radius: 8px; }
.cv-page .cv-dock .btn-ghost { background: #263550; color: #fff; border-color: transparent; }
.cv-page .cv-share-fab { background: #2454e8; border-radius: 16px; width: 60px; height: 60px; }

/* ============ 深蓝鎏金 navygold：参考名片配色与结构（放在最后覆盖通用商务风）============ */
.cv-tpl-navygold { color: var(--ng-ink); background: var(--ng-page-bg); }
.cv-tpl-navygold .cv-cover { border-radius: 0 0 22px 22px; background: linear-gradient(135deg, var(--ng-navy) 0%, var(--ng-deep) 100%); }
.cv-tpl-navygold .cv-themes button { border-color: rgba(216,187,133,.6); }
.cv-tpl-navygold .card { border-color: rgba(185,147,85,.28); border-radius: 16px; box-shadow: 0 10px 30px -18px rgba(0,0,0,.55); }
.cv-tpl-navygold .cv-profile {
  position: relative; overflow: hidden; border-radius: 22px; padding: 30px 24px 22px;
  border: 1px solid rgba(185,147,85,.28); background: #fff;
  box-shadow: 0 26px 60px -22px rgba(0,0,0,.65), 0 0 0 1px rgba(255,255,255,.06);
}
.cv-tpl-navygold .cv-profile::before {
  content: ''; position: absolute; inset: 0 0 auto 0; height: 6px;
  background: linear-gradient(90deg, var(--ng-navy), var(--ng-navy-2) 40%, var(--ng-gold-2) 78%, var(--ng-gold));
}
.cv-tpl-navygold .cv-main { max-width: 430px; }
.cv-tpl-navygold .cv-profile::after {
  content: attr(data-wm); position: absolute; right: -26px; top: 54px;
  font-size: 80px; font-weight: 900; color: var(--ng-ink); opacity: .04;
  letter-spacing: -4px; line-height: 1; pointer-events: none;
}
.cv-tpl-navygold .cv-profile > * { position: relative; z-index: 2; }
.cv-tpl-navygold .cv-avatar {
  width: 64px; height: 64px; flex: 0 0 64px; border-radius: 14px; font-size: 26px; color: #fff;
  background: linear-gradient(145deg, var(--ng-navy), #0e2233);
  box-shadow: inset 0 0 0 2px rgba(216,187,133,.5), 0 8px 18px -8px rgba(18,32,46,.6);
}
.cv-tpl-navygold .cv-name { color: var(--ng-ink); font-size: 27px; font-weight: 900; letter-spacing: .04em; }
.cv-tpl-navygold .cv-en { color: var(--ng-ink-2); }
.cv-tpl-navygold .cv-title { color: var(--ng-ink-2); font-size: 12.5px; letter-spacing: .06em; font-weight: 400; }
.cv-tpl-navygold .cv-org {
  color: var(--ng-navy); border-top: 1px dashed var(--ng-line); padding-top: 12px; margin-top: 12px;
  font-size: 13.5px; font-weight: 700; letter-spacing: .03em;
}
.cv-tpl-navygold .cv-tags span {
  border-radius: 99px; background: var(--ng-paper); color: #6b5a3c;
  box-shadow: inset 0 0 0 1px rgba(185,147,85,.28);
}
.cv-tpl-navygold .cv-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 0; overflow: hidden; background: transparent; border: 0; box-shadow: none; }
.cv-tpl-navygold .cv-actions button {
  display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 8px;
  height: 50px; border-radius: 13px; background: #f7f5f0; color: var(--ng-navy);
  font-size: 14.5px; font-weight: 700; letter-spacing: .02em; box-shadow: inset 0 0 0 1px #e6e0d4;
}
.cv-tpl-navygold .cv-actions button:first-child {
  background: linear-gradient(135deg, var(--ng-navy), #0f2739); color: #fff;
  box-shadow: 0 10px 22px -12px rgba(18,32,46,.85);
}
.cv-tpl-navygold .cv-actions button:last-child:nth-child(odd) { grid-column: 1 / -1; }
.cv-tpl-navygold .cv-actions i { width: auto; height: auto; border-radius: 0; background: transparent; color: inherit; font-size: 17px; }
.cv-tpl-navygold .cv-block h3, .cv-tpl-navygold .cv-sec-title { color: var(--ng-navy); border-left: 3px solid var(--ng-gold); padding-left: 9px; }
.cv-tpl-navygold .cv-bio, .cv-tpl-navygold .small.muted, .cv-tpl-navygold .cv-qr-lead { color: var(--ng-ink-2); }
.cv-tpl-navygold .cv-links a, .cv-tpl-navygold .qr-tile { border-color: var(--ng-line); background: #fff; }
.cv-tpl-navygold .cv-links b, .cv-tpl-navygold .qr-tile b { color: var(--ng-navy); }
.cv-tpl-navygold .cv-maps a { background: var(--ng-paper); color: var(--ng-navy); box-shadow: inset 0 0 0 1px rgba(185,147,85,.28); }
.cv-tpl-navygold .cv-vcard-qr { border: 4px solid rgba(185,147,85,.45); }
.cv-tpl-navygold .cv-footer { color: #a9b1ba; letter-spacing: .1em; }
.cv-tpl-navygold .cv-footer b { color: var(--ng-gold); }
.cv-tpl-navygold .cv-dock { background: rgba(18,32,46,.96); border-top: 2px solid var(--ng-gold); }
.cv-tpl-navygold .cv-dock .btn-primary { background: linear-gradient(135deg, #c9a163, #a8834a); color: #fff; box-shadow: 0 12px 24px -14px rgba(169,131,74,.9); }
.cv-tpl-navygold .cv-dock .btn-ghost { background: rgba(255,255,255,.12); color: #fff; border-color: rgba(216,187,133,.35); }
.cv-tpl-navygold .cv-share-fab { background: linear-gradient(135deg, #c9a163, #a8834a); box-shadow: 0 8px 20px rgba(169,131,74,.4); border-radius: 18px; }
</style>
