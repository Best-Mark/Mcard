<template>
  <!--
    名片模板全局约定（所有 18 套模板必须遵守，新增模板时逐条核对）：
    1. 二维码是信息入口：小图只放姓名区右上角，点击弹层放大；正文不摆大块二维码卡，避免无谓下拉；
    2. 主操作（拨号/复制号码/存入通讯录/分享）单排 4 个收在底部 dock；次要操作（导航/收藏/交换名片）收进悬浮「⋯」，不铺在内容区；
    3. 「存入通讯录」的操作步骤只在 guide 弹层内展示，页面任何位置都不摆步骤；
    4. 公司名水印缩在卡片右下角、低透明，不遮挡姓名/职位/联系方式；
    5. 联系方式值按模板底色取高对比色：固定配色模板用 --cv-ink，主题驱动模板用 --t-text，不得用装饰色牺牲可读性；
       次级操作（导航/收藏/交换）只在公开访客页的悬浮「⋯」里；owner 工作台预览不显示——
       自己的名片无收藏/交换可言（后端也会拦「不能收藏自己的名片」），导航在地址区已有按钮（2026-11-25 用户定稿）；
    6. 页面底部留白 ≥ dock 高度（单排约 92px），末张卡片不被遮挡；
    7. 配色/质感跟随主题强调色，不写死白色；尊重 prefers-reduced-motion。
  -->
  <div class="cv-page" :class="['cv-tpl-' + template, { 'cv-clean': isCleanTpl, 'cv-embed': embed, 'cv-owner': owner }]" :style="vars">
    <div class="cv-cover">
      <button v-if="!owner && full" class="cv-back" @click="goBack" aria-label="返回">‹</button>
      <div class="cv-brand">M<em>Card</em></div>
    </div>

    <div v-if="loading" class="container cv-loading">名片加载中…</div>
    <div v-else-if="error" class="container cv-loading">
      <b>名片加载失败</b><p class="small muted">{{ error }}</p>
      <button class="btn btn-primary" @click="load">重新加载</button>
    </div>

    <template v-else-if="card">
      <div class="container cv-main">
        <div class="cv-profile card" :data-wm="(template === 'navygold' || isCleanTpl) ? (card.company || '').slice(0, 4) : ''">
          <span class="cv-sheen" aria-hidden="true"></span>
          <div class="cv-avatar" :class="{ 'is-logo': !!card.logo }">
            <img v-if="card.logo || card.avatar" :src="card.logo || card.avatar" :alt="card.logo ? ((card.company || '公司') + ' LOGO') : card.name" />
            <span v-else>{{ (card.name || '名').slice(0, 1) }}</span>
          </div>
          <div class="cv-ident">
            <div class="cv-name-row">
              <div class="cv-name">{{ card.name || card.name_en || '未填写姓名' }}
                <span v-if="card.name_en" class="cv-en">{{ card.name_en }}</span>
              </div>
              <button v-if="owner" class="cv-inline-edit" @click="router.push('/me/card')" title="编辑名片资料" aria-label="编辑名片资料">✎</button>
            </div>
            <div class="cv-title">{{ displayTitle || '点击进入编辑，完善你的职业信息' }}</div>
            <div v-if="template === 'navygold' && displayOrg" class="cv-org">{{ displayOrg }}</div>
            <div v-if="card.tags?.length" class="cv-tags"><span v-for="tag in card.tags" :key="tag">{{ tag }}</span></div>
          </div>
          <!-- 二维码是信息入口：小图常驻姓名区右上角，点击弹层放大；正文不再摆大码卡 -->
          <button v-if="full" class="cv-qr-entry" @click="qrModal = true" title="扫码打开名片 · 点击放大" aria-label="查看名片二维码">
            <img :src="qrApi + '/qr.svg?size=200'" alt="名片二维码" />
          </button>
          <span v-if="!card.active" class="badge warn cv-status">未开通 / 已到期</span>
        </div>

        <div v-if="full && !card.active" class="card card-pad notice-card">
          <b>这张名片尚未开通或已到期</b>
          <p class="small muted">联系持有者开通后，二维码仍会指向这里，无需更换。</p>
        </div>
        <div v-if="full && isOwner && !card.active" class="btn-row" style="margin:12px 0">
          <router-link to="/me/plans" class="btn btn-primary">立即开通</router-link>
        </div>

        <div v-if="full && (contactFields.length || fullAddress)" class="card card-pad cv-block">
          <h3>联系方式 <span class="small muted">· 点一行即复制该字段</span></h3>
          <div v-for="f in contactFields" :key="f.key" class="cv-contact-row" @click="copy(f.value, f.label)">
            <div class="cv-contact-label">{{ f.label }}：</div>
            <div class="cv-contact-value">{{ f.value }}</div>
            <div class="cv-contact-acts" @click.stop>
              <button v-if="f.key === 'mobile' || f.key === 'phone'" class="cv-row-act" @click="tel(f.value)">打电话</button>
              <button v-if="f.key === 'mobile'" class="cv-row-act" @click="sms(f.value)">短信</button>
              <button v-if="f.key === 'email'" class="cv-row-act" @click="mailto(f.value)">邮件</button>
            </div>
          </div>
        </div>

        <!-- 仅 embed 裁剪正文；owner 与公开页渲染完全相同的整页内容 -->
        <template v-if="full">
        <!-- 简介只保留一个区块：字段 bio，标题统一叫「简介」；存量 company_intro 由 introText 回落 -->
        <div v-if="introText" class="card card-pad cv-block">
          <h3>简介</h3><p class="cv-bio">{{ introText }}</p>
        </div>

        <div v-if="card.links?.length" class="card card-pad cv-block">
          <h3>更多链接</h3>
          <div class="cv-links">
            <a v-for="(l, i) in card.links" :key="i" :href="safeUrl(l.url)" target="_blank" rel="noopener">
              <b>{{ l.label || '链接' }}</b><span>{{ shortUrl(l.url) }} ↗</span>
            </a>
          </div>
        </div>

        <div v-if="materialsList.length" class="card card-pad cv-block" data-sec="materials">
          <h3>相册 <span class="small muted">· 点开直接看</span></h3>
          <div class="cv-gallery">
            <template v-for="m in materialsList" :key="m.id">
              <button v-if="isImageMaterial(m)" class="cv-gallery-cell" @click="openGallery(m)">
                <img :src="fullUrl(m.url)" :alt="m.title" loading="lazy" />
                <span>{{ m.title }}</span>
              </button>
              <button v-else class="cv-gallery-cell cv-gallery-file" @click="openMaterial(m)">
                <span class="cv-gallery-file-ico"><AppIcon :name="m.type === 'file' ? 'file' : 'link'" :size="24" /></span>
                <span>{{ m.title }}</span>
                <small>{{ m.type === 'link' ? '网页链接' : '文件' }}</small>
              </button>
            </template>
          </div>
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

        <div v-if="fullAddress" class="card card-pad cv-block">
          <h3>地址</h3>
          <div v-if="regionLine" class="cv-region-line">{{ regionLine }}</div>
          <div class="cv-address" @click="copy(fullAddress, '地址')">
            <span v-if="detailAddress">地址：{{ detailAddress }}</span>
            <button v-if="maps.length" class="cv-map-launch" @click.stop="mapOpen = true">导航</button>
          </div>
        </div>

        <!-- 扫码进来的多是未登录访客：看完名片顺手引导「我也要一张」，登录后直达建卡页 -->
        <div v-if="showCreateOwn" class="card card-pad cv-create-own">
          <div class="cv-create-copy">
            <b>也想拥有这样一张名片？</b>
            <p class="small muted">二维码终身不变、资料随时改，免费创建</p>
          </div>
          <router-link to="/login?redirect=/me/card" class="btn btn-primary">免费创建我的名片 →</router-link>
        </div>

        <p class="cv-footer">由 <b>{{ siteConfig.site_name }}</b> 提供技术支持</p>
        </template>
      </div>
      <!-- 次级操作收进悬浮「⋯」：导航/收藏/交换名片，不铺在正文。
           owner 工作台是自己的名片：收藏会被后端拦、交换对自己无意义、导航地址区已有按钮，故不显示。 -->
      <button v-if="full && !owner" class="cv-fab" :class="{ on: moreOpen }" @click="moreOpen = !moreOpen" aria-label="更多操作">⋯</button>
      <div v-if="full && !owner && moreOpen" class="cv-fab-mask" @click="moreOpen = false">
        <div class="cv-fab-menu" @click.stop>
          <button v-if="fullAddress && maps.length" @click="moreOpen = false; openMapSheet()">导航到此处</button>
          <button @click="moreOpen = false; toggleFavorite()">{{ favorite ? '已收藏' : '收藏名片' }}</button>
          <button @click="moreOpen = false; openExchange()">交换名片</button>
        </div>
      </div>
      <!-- 主操作单排 4 个。持有者视角：编辑名片 / 配色风格 / 名片集市 / 分享；
           公开页：打电话 / 复制号码 / 存入通讯录 / 分享。2026-11-25 用户定稿。 -->
      <div v-if="full" class="cv-dock cv-dock-glass">
        <template v-if="owner">
          <button class="btn btn-primary dock-btn" @click="router.push('/me/card')"><span class="dock-ico">✎</span>编辑名片</button>
          <button class="btn btn-ghost dock-btn" @click="router.push('/me/card/style')"><span class="dock-ico">◐</span>配色风格</button>
          <button class="btn btn-ghost dock-btn" @click="router.push('/me/card/market')"><span class="dock-ico">⌕</span>名片集市</button>
          <button class="btn btn-ghost dock-btn" @click="doShare"><span class="dock-ico">↗</span>分享</button>
        </template>
        <template v-else>
          <button class="btn btn-primary dock-btn" :disabled="!contactPhone" @click="tel(contactPhone)"><span class="dock-ico dock-ico-phone"></span>打电话</button>
          <button class="btn btn-ghost dock-btn" :disabled="!contactPhone" @click="copy(contactPhone, '号码')"><span class="dock-ico">⧉</span>复制号码</button>
          <a v-if="contactNative" class="btn btn-ghost dock-btn" :title="contactActionTip" :aria-label="contactActionLabel" :href="contactHref"><span class="dock-ico">◉</span>存入通讯录</a>
          <button v-else class="btn btn-ghost dock-btn" :title="contactActionTip" :aria-label="contactActionLabel" @click="saveContact"><span class="dock-ico">◉</span>存入通讯录</button>
          <button class="btn btn-ghost dock-btn" @click="doShare"><span class="dock-ico">↗</span>分享</button>
        </template>
      </div>
      <BottomSheet :show="mapOpen" @update:show="mapOpen = $event">
        <div class="map-sheet-head"><b>选择导航地图</b><button @click="mapOpen = false">×</button></div>
        <div class="map-sheet-list">
          <a v-for="m in maps" :key="m.key" :href="m.href" target="_blank" rel="noopener" @click="mapOpen = false">
            <img class="map-ico" :src="mapIcon(m.key)" alt="" /><span>{{ m.label }}地图</span><span class="map-arrow">↗</span>
          </a>
        </div>
      </BottomSheet>
      <!-- 通讯录兜底：intent 拉不起来的个别机型/PC/鸿蒙，用复制基本信息代替下载 VCF（信息层展示，操作收在弹层） -->
      <BottomSheet :show="contactFallbackOpen" @update:show="contactFallbackOpen = $event">
        <div class="map-sheet-head"><b>存入通讯录 · 复制信息</b><button @click="contactFallbackOpen = false">×</button></div>
        <div class="cf-body">
          <p class="small muted">当前手机无法直接打开通讯录，复制下面的信息，到通讯录新建联系人粘贴即可。</p>
          <pre class="cf-info">{{ contactCopyText }}</pre>
          <button class="btn btn-primary btn-block" @click="copyContactInfo">一键复制名片信息</button>
        </div>
      </BottomSheet>
    </template>

    <!-- 名片地址二维码大图：微信扫一扫打开名片页，再点页面里的「存入通讯录」保存 -->
    <div v-if="qrModal" class="modal-mask" @click.self="qrModal = false">
      <div class="modal center">
        <h3>我的名片</h3>
        <img :src="qrApi + '/qr.svg?size=640&scan=1'" style="width:264px;height:264px;margin:4px auto 10px;display:block" alt="名片地址二维码" />
        <p class="cv-qr-url" @click="copy(publicLink, '名片链接')" title="点击复制名片链接">{{ publicLink }}</p>
        <p class="small muted center">客户扫一扫即可打开名片、存入通讯录；链接永久不变</p>
        <!-- 一个入口承载三件事：看二维码、复制链接、公开页（关闭弹层即当前公开页） -->
        <div class="btn-row" style="justify-content:center;margin-top:14px;flex-wrap:wrap">
          <button class="btn btn-primary" @click="copy(publicLink, '名片链接')">复制名片链接</button>
          <button class="btn btn-ghost" @click="saveQr">保存二维码</button>
          <button class="btn btn-ghost" @click="qrModal = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 全屏看图：点相册缩略图进入，顶部「返回」回名片，左右切换；对齐小程序 uni.previewImage 观感 -->
    <div v-if="galleryIndex >= 0" class="gallery-fullscreen" role="dialog" aria-label="相册大图浏览">
      <div class="gf-top">
        <button class="gf-back" aria-label="返回名片" @click="galleryIndex = -1">‹ 返回</button>
        <span class="gf-count">{{ galleryIndex + 1 }} / {{ imageMaterials.length }}</span>
        <span class="gf-title">{{ imageMaterials[galleryIndex]?.title || '相册' }}</span>
      </div>
      <div class="gf-stage" @click.self="galleryIndex = -1">
        <img :src="fullUrl(imageMaterials[galleryIndex]?.url)" :alt="imageMaterials[galleryIndex]?.title" />
      </div>
      <div class="gf-nav">
        <button :disabled="galleryIndex <= 0" @click="galleryIndex--">‹ 上一张</button>
        <button :disabled="galleryIndex >= imageMaterials.length - 1" @click="galleryIndex++">下一张 ›</button>
      </div>
    </div>

    <!-- 保存引导弹层：微信内「去浏览器添加」的步骤只在这里出现，不铺在名片页面上 -->
    <div v-if="guide" class="modal-mask" @click.self="closeGuide">
      <div class="modal">
        <h3>{{ guide === 'contact' ? '存入通讯录' : '保存二维码' }}</h3>
        <template v-if="guide === 'contact'">
          <p class="guide-lead">按下面步骤操作即可把名片存进手机通讯录：</p>
          <div class="guide-steps">
            <div class="guide-steps-t">{{ contactSteps.title }}</div>
            <ol><li v-for="(s, i) in contactSteps.lines" :key="i" v-html="s"></li></ol>
          </div>
          <p class="small muted" style="margin-top:10px">{{ guideWithLogin ? '已自动带上登录状态，在浏览器里无需再次登录。' : '访客无需登录，在浏览器里一样能保存名片。' }}</p>
        </template>
        <template v-else-if="inWeChat">
          <p>微信内置浏览器限制下载。请点右上角「···」→ <b>在浏览器中打开</b>{{ guideWithLogin ? '（已自动带上登录状态）' : '（无需登录）' }}，再点保存。</p>
        </template>
        <template v-else>
          <p v-html="saveTip"></p>
        </template>
        <img v-if="guide !== 'contact'" :src="guideImage || (qrApi + '/qr.svg?size=520&scan=1')" style="width:200px;height:200px;margin:10px auto;object-fit:contain" alt="二维码" />
        <div class="btn-row">
          <button class="btn btn-ghost" @click="closeGuide">知道了</button>
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
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

// embed：嵌入模式（只渲染封面+身份区，其余由宿主页呈现）；owner：持有者预览（/me 我的名片）。
// ⚠️ owner 与公开页「同一套模板、同一套样式、同一屏内容」；差异只在 dock（持有者=编辑名片/配色风格/名片集市/分享，
// 公开页=打电话/复制号码/存入通讯录/分享）与封面左上的编辑入口，且不设置微信分享/不查收藏/不上报访问。
// 2026-11-25 用户定稿。
const props = defineProps({
  embed: { type: Boolean, default: false },
  embedSlug: { type: String, default: '' },
  owner: { type: Boolean, default: false }
})
import api from '../api'
import { showToast, auth, siteConfig } from '../store'
import { THEMES, themeOf, themeVars } from '../utils/themes'
import { isWeChat, isIOS, saveImageUrl, prepareExternalOpen, openVcfInline, androidContactIntent, deviceEnv, SAVE_IMAGE_TIPS } from '../utils/save-image'
import { shareOrCopy, mapLinks } from '../utils/share'
import { setCardShare } from '../utils/wx-share'
import { buildAndUploadShareImage } from '../utils/shareCardImage'
import { getCachedPosition } from '../utils/geo'
import BottomSheet from '../components/BottomSheet.vue'
import AppIcon from '../components/AppIcon.vue'

const route = useRoute(); const router = useRouter()
// 返回要「回到来源」而不是盲调 history.back：从集市点进来的名片必须回集市；
// 直接打开/分享链接没有上一页时回首页，避免点了没反应被当成没有返回入口。
function goBack() {
  if (String(route.query.src || '') === 'market') return router.push('/market')
  if (window.history.state?.back) return router.back()
  router.replace('/')
}
const embed = props.embed
const owner = props.owner
// 是否渲染公开页整页内容：owner 模式与公开页完全一致，只有 embed 才裁成头部
const full = !embed
// slug 必须响应式：名片夹/后台可连续打开 /c/a → /c/b，组件复用时不会重新挂载，
// 常量写法会让第二张名片仍显示第一张（编辑返回不更新的同类问题）。
const slug = computed(() => props.embedSlug || route.params.slug)
const qrApi = computed(() => `/api/cards/public/${slug.value}`)
const vcfApi = computed(() => `${qrApi.value}/card.vcf`)
// 二维码统一用名片地址短链（qr.svg/qr.png）：码点少、微信扫一扫必开；
// 存通讯录在打开的名片页里点按钮完成，不再把整段 vCard 塞进二维码（太密、微信不认、难扫）。
const card = ref(null); const loading = ref(true); const error = ref('')
const currentTheme = ref('ocean'); const isOwner = ref(false)
const template = ref('contact')
// 十二套「简洁舒适」模板共用单卡骨架与卡内操作区：
// contact 金黑 / paper 纸白 / glass 墨夜 / wood 暖木 / neon 霓虹 / acid 荧光 / pop 多巴胺 / magazine 杂志
// poster 竖版海报 / ticket 票据存根 / horizontal 横版名片 / sidebar 侧栏竖排
const CLEAN_TEMPLATES = ['contact', 'paper', 'glass', 'wood', 'neon', 'acid', 'pop', 'magazine', 'poster', 'ticket', 'horizontal', 'sidebar']
const isCleanTpl = computed(() => CLEAN_TEMPLATES.includes(template.value))
const qrModal = ref(false); const guide = ref(''); const guideImage = ref(''); const exchangeOpen = ref(false)
const contactFallbackOpen = ref(false) // 安卓 intent 拉不起通讯录时的兜底：复制基本信息卡片（全程不下载）
const mapOpen = ref(false); const moreOpen = ref(false)
const mySlug = ref(''); const exchanging = ref(false)
const favorite = ref(false); const favBusy = ref(false)
const materialsList = ref([])
const galleryIndex = ref(-1)
const imageMaterials = computed(() => materialsList.value.filter(m => isImageMaterial(m)))
// 相册直看：图片是可预览的图片文件链接，其余（网页/文档）直接打开不跳页
function isImageMaterial(m) {
  if (!m || m.type !== 'file' || !m.url) return false
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(m.url)
}
function openGallery(m) {
  const idx = imageMaterials.value.findIndex(x => x.id === m.id)
  galleryIndex.value = idx < 0 ? 0 : idx
  countMaterialView(m)
}
async function openMaterial(m) {
  const u = m.type === 'link' ? safeUrl(m.url) : fullUrl(m.url)
  if (!u || u === '#') return showToast('链接无效')
  countMaterialView(m)
  windowRef.open(u, '_blank', 'noopener')
}
async function countMaterialView(m) {
  try { await api.post(`/api/cards/public/materials/${m.id}/view`) } catch { /* 计数失败不影响查看 */ }
}

const t = computed(() => themeOf({ theme: currentTheme.value, accent: card.value?.accent }))
// 动态光效用主题强调色而非写死白色：把 #rrggbb 转 rgb 分量，CSS 里 rgba(var(--glow-rgb), .x)
function hexToRgb(hex) {
  const h = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''))
  if (!h) return '37,99,235'
  const n = parseInt(h[1], 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}
const vars = computed(() => ({ ...themeVars(t.value), '--glow-rgb': hexToRgb(t.value.accent) }))
// 扫码进来的访客多为未登录：只在未登录且非本人时展示建卡引导，避免打扰名片主人
const showCreateOwn = computed(() => !owner && !auth.token && !isOwner.value)
const regionLine = computed(() => {
  const c = card.value || {}
  return [c.province, c.city, c.district, c.street].filter(Boolean).join(' · ')
})
// 详细地址行只放街道门牌：省市区已由 regionLine 单独一行，避免同一地址出现两遍
const detailAddress = computed(() => {
  const c = card.value || {}
  return [c.address, c.address_detail].filter(Boolean).join(' ')
})
const fullAddress = computed(() => [regionLine.value.replace(/ · /g, ''), detailAddress.value].filter(Boolean).join(' '))
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
// 简介唯一真相源：只保留「简介」一个概念（bio），不再分「关于我/公司简介」两块。
// 存量兼容：老名片只填了 company_intro 的，回落到简介展示，避免历史内容凭空消失。
const introText = computed(() => card.value?.bio || card.value?.company_intro || '')
const windowRef = window
// 分享唯一真相源：服务端 publicView 下发的 url = ${origin}/c/${slug}（动态域名、干净无 query）。
// 微信「···」原生转发用的是 JS-SDK 配置的 link，不是地址栏 URL——owner 页也必须配成这个地址，
// 否则别人打开的是 /me（被守卫踢去登录，登录后看到「我的名片页」），而不是被分享的那张名片。
const publicLink = computed(() => card.value?.url || `${windowRef.location.origin}/c/${slug.value}`)
// 微信内引导「在浏览器中打开」是否真的带上了登录凭证：未登录访客拿不到 ticket，文案不能谎称已带登录态
const guideWithLogin = ref(false)
const fullUrl = u => (u ? new URL(u, windowRef.location.origin).href : '')
// 模板里区分微信/Safari 的保存引导（微信→去浏览器，iOS→长按图片）
const inWeChat = isWeChat()
const deviceEnvKey = deviceEnv()
// iOS：用真实 <a href=".vcf"> 顶层导航弹系统添加联系人（Safari 只信任用户点击的顶层导航）。
// 安卓：必须走按钮点击 saveContact —— 需要监听 visibilitychange 判断 intent 是否拉起，拉不起来弹复制卡片兜底。
const contactNative = deviceEnvKey === 'ios'
// iOS：.vcf 直链弹添加联系人；安卓：intent:// 直接拉起预填的添加联系人界面（收到 vcf 只会下载，必须走 intent）。
// 安卓不设 browser_fallback_url（那是下载），拉不起来时由 saveContact 的 visibilitychange 检测弹「复制信息」卡片。
const contactHref = computed(() => {
  if (deviceEnvKey !== 'android') return vcfApi.value
  return androidContactIntent(card.value)
})
const saveTip = SAVE_IMAGE_TIPS[deviceEnvKey] || SAVE_IMAGE_TIPS.other
// 通讯录操作按环境出文案：iOS/Android 直接开系统界面、鸿蒙/其它下载 vcf、微信引导去浏览器
const CONTACT_ACTION = {
  ios: { label: '打开通讯录', tip: '点此直接打开系统添加联系人界面' },
  android: { label: '打开通讯录', tip: '点此直接打开系统添加联系人界面' },
  harmony: { label: '复制信息', tip: '点此复制名片信息，到通讯录新建联系人粘贴' },
  wechat: { label: '去浏览器添加', tip: '微信内无法直接写入通讯录，请点右上角「···」在浏览器中打开' },
  other: { label: '复制信息', tip: '点此复制名片信息，到通讯录新建联系人粘贴' }
}
const contactActionLabel = (CONTACT_ACTION[deviceEnvKey] || CONTACT_ACTION.other).label
const contactActionTip = (CONTACT_ACTION[deviceEnvKey] || CONTACT_ACTION.other).tip
const contactPhone = computed(() => String(card.value?.mobile || card.value?.phone || '').trim())
// 卡内「按环境」操作指引：参考简洁联络卡的 steps 区块，文案按当前环境给可操作步骤
const CONTACT_STEPS = {
  wechat: { title: '微信内 · 推荐这样存', lines: [
    '点右上角「···」→ <b>在浏览器中打开</b>（已自动带上登录状态，无需再次登录）',
    '在浏览器页面底部点「存入通讯录」',
    '按系统提示添加；或先点底部「复制号码」，再去通讯录新建联系人粘贴'
  ] },
  ios: { title: 'iPhone 浏览器 · 三步存好', lines: [
    '点页面底部「存入通讯录」，系统弹出添加联系人界面',
    '确认姓名与号码无误',
    '点「完成」即保存到通讯录'
  ] },
  android: { title: '安卓 · 通常一步到位', lines: [
    '点页面底部「存入通讯录」，直接拉起已填好资料的添加联系人界面',
    '确认姓名与号码无误，点「保存」即存入',
    '个别机型拉不起时，会自动弹出名片信息，一键复制后到通讯录新建粘贴即可'
  ] },
  harmony: { title: '鸿蒙 · 复制信息保存', lines: [
    '点页面底部「存入通讯录」，弹出名片信息',
    '点「一键复制名片信息」',
    '到通讯录新建联系人，粘贴保存即可'
  ] },
  other: { title: '电脑端 / 其他浏览器', lines: [
    '点页面底部「存入通讯录」，弹出名片信息',
    '点「一键复制名片信息」',
    '到通讯录 / Outlook 新建联系人，粘贴保存即可'
  ] }
}
const contactSteps = computed(() => {
  const base = CONTACT_STEPS[deviceEnvKey] || CONTACT_STEPS.other
  if (deviceEnvKey !== 'wechat') return base
  // 未登录访客拿不到 wx_ticket，文案不能谎称「已自动带上登录状态」——
  // 保存名片到通讯录本就不需要登录，访客在浏览器里照样能保存。
  return {
    title: base.title,
    lines: [
      `点右上角「···」→ <b>在浏览器中打开</b>${guideWithLogin.value ? '（已自动带上登录状态，无需再次登录）' : '（无需登录，访客也能保存）'}`,
      ...base.lines.slice(1)
    ]
  }
})

// 联系方式逐项一键复制（借鉴名片全能王「点字段直接复制」，比只打电话更通用）
// 标签与值同排展示，统一带冒号（复制提示仍用纯字段名）
const CONTACT_LABELS = { mobile: '手机', phone: '座机', email: '邮箱', wechat: '微信', alipay: '支付宝', whatsapp: 'WhatsApp' }
const contactFields = computed(() => {
  const c = card.value || {}
  return Object.keys(CONTACT_LABELS)
    .map(key => ({ key, label: CONTACT_LABELS[key], value: c[key] }))
    .filter(f => f.value)
})
const siteLinks = computed(() => {
  const c = card.value || {}
  const arr = []
  if (c.website) arr.push({ key: 'website', label: '公司主页', url: c.website })
  if (c.shop_url) arr.push({ key: 'shop', label: '店铺主页', url: c.shop_url })
  return arr
})

function shortUrl(u) { return String(u || '').replace(/^https?:\/\//, '').slice(0, 30) }
// 用户常填「Card.microdot.net」这类无协议网址：自动补 https:// 再校验，否则按钮变 '#' 点了没反应
function safeUrl(u) {
  if (!u) return '#'
  const s = String(u).trim()
  const full = /^https?:\/\//i.test(s) ? s : `https://${s}`
  try { const x = new URL(full); return ['http:', 'https:'].includes(x.protocol) ? x.href : '#' } catch { return '#' }
}
// 微信内显示「去浏览器打开」引导前，尝试把登录凭证写进当前 URL，外部浏览器打开即免二次登录。
// 未登录访客（含非注册用户）拿不到 ticket——记录结果，文案据实说明，不能谎称已带登录态。
async function showGuide(kind) {
  guideWithLogin.value = isWeChat() ? !!(await prepareExternalOpen(api)) : false
  guide.value = kind
}
// 引导看完即抹掉地址栏上的一次性登录凭证：避免用户紧接着用微信「···」转发时把 ticket 带出去
function closeGuide() {
  guide.value = ''
  const u = new URL(windowRef.location.href)
  if (u.searchParams.has('wx_ticket')) {
    u.searchParams.delete('wx_ticket')
    windowRef.history.replaceState(null, '', u.toString())
  }
}

async function load() {
  loading.value = true; error.value = ''
  try {
    const { data } = await api.get(qrApi.value)
    card.value = data.data
    currentTheme.value = THEMES[data.data.theme] ? data.data.theme : 'ocean'
    template.value = data.data.template || 'contact'
    // owner 页（/me）同样要配置微信分享卡片：微信「···」原生转发取的是这里配的 link，
    // 不配就会把当前 /me 链接发出去 → 别人打开被守卫踢去登录，登录后看到「我的名片页」。
    // 口径与工作台共用 setCardShare（唯一真相源）。
    if (full) setCardShare(api, card.value, publicLink.value)
    // 分享缩略图：生成一张名片卡片样式图（头像/姓名/二维码）替代难看的纯二维码。
    // 需要登录态才能上传；失败静默保留二维码兜底。生成后重设分享卡片（wx-share 的 key 含图 URL，会重新 config）。
    if (full && auth.token) {
      buildAndUploadShareImage(api, { ...card.value, url: publicLink.value }).then(url => {
        if (url && card.value?.slug === slug.value) setCardShare(api, card.value, publicLink.value, url)
      }).catch(() => {})
    }
    if (!embed && !owner && auth.token) {
      try { const mine = await api.get('/api/cards/mine'); isOwner.value = mine.data.data?.slug === slug.value } catch { /* 忽略 */ }
      if (!isOwner.value) {
        try { favorite.value = !!(await api.get(`${qrApi.value}/favorite`)).data.data?.favorite } catch { /* 忽略 */ }
      }
    }
    // 工作台「我的名片二维码」跳过来：弹名片地址码，微信扫开名片页后再存入通讯录
    if (String(route.query.save) === '1') {
      qrModal.value = true
      // save 是一次性展示参数，清掉它和可能残留的登录凭证，避免被原生转发带出去
      const u = new URL(windowRef.location.href)
      let changed = false
      for (const k of ['save', 'wx_ticket']) if (u.searchParams.has(k)) { u.searchParams.delete(k); changed = true }
      if (changed) windowRef.history.replaceState(null, '', u.toString())
    }
  } catch (e) { error.value = e.message } finally { loading.value = false }
  // 资料夹是名片正文的一部分：owner 预览也要拉，否则「公司相册」在 /me 永远空白。
  // 嵌入预览（只裁头部的旧用法）才整段跳过。失败静默不阻塞主流程。
  if (!embed) {
    try { materialsList.value = (await api.get(`${qrApi.value}/materials`)).data.data?.list || [] } catch { /* 忽略 */ }
  }
  // 浏览上报仅公开页：owner/embed 不污染访问统计
  if (!embed && !owner) traceVisit()
}
async function traceVisit() {
  try {
    const src = String(route.query.src || '')
    // 只读已缓存位置，不主动触发定位授权（看名片不该弹定位框）；
    // 默认城市兜底不算真实定位，不上报，避免把未授权访客都记成「上海」脏数据
    let city = ''
    try { const p = getCachedPosition(); city = p.source && p.source !== 'default' ? (p.city || '') : '' } catch { /* 无缓存 */ }
    if (src || city) await api.post(`${qrApi.value}/trace`, { source: src, city })
  } catch { /* 上报失败静默 */ }
}
onMounted(load)
// 同组件参数变化（名片夹连续看 /c/a → /c/b）：组件复用不会重新 mounted，
// 必须重置跟随名片的状态再重新加载，否则第二张名片显示第一张的内容。
watch(slug, () => {
  card.value = null
  materialsList.value = []
  qrModal.value = false; guide.value = ''; exchangeOpen.value = false
  mapOpen.value = false; moreOpen.value = false; galleryIndex.value = -1
  favorite.value = false; isOwner.value = false; mySlug.value = ''
  windowRef.scrollTo?.(0, 0)
  load()
})

function tel(v) { if (v) windowRef.location.href = `tel:${v}`; else showToast('尚未填写电话') }
function sms(v) { if (v) windowRef.location.href = `sms:${v}`; else showToast('尚未填写手机号') }
function mailto(v) { if (v) windowRef.location.href = `mailto:${v}`; else showToast('尚未填写邮箱') }
function openMapSheet() {
  if (!maps.value.length) return showToast('尚未填写地址')
  mapOpen.value = true
}
// 地图图标：直接用各家 App Store 上架的官方图标（client/public/maps/*.png，本地静态资源）。
// simple-icons 那种单色剪影和真实 App 图标对不上，用户看不出来是哪家；这里只做「点开即用该地图」的指示性使用。
const MAP_ICON_KEYS = ['amap', 'baidu', 'qq', 'apple', 'google']
function mapIcon(key) {
  const k = MAP_ICON_KEYS.includes(key) ? key : 'amap'
  return `${import.meta.env.BASE_URL}maps/${k}.png`
}
async function copy(v, label) {
  if (!v) return showToast(`尚未填写${label}`)
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
  } catch { showToast(`复制失败，${label}：${v}`) }
}
async function saveQr() {
  guideImage.value = ''
  const r = await saveImageUrl(`${qrApi.value}/qr.png?size=900&scan=1`, `${slug.value}-二维码.png`)
  if (r.kind === 'longpress') { await showGuide('qr'); return }
  showToast(r.kind === 'downloaded' ? '二维码已开始下载' : '已打开二维码，请长按保存', 'success')
}
// 复制名片里的关键信息（不下载任何文件）：安卓 intent 拉不起通讯录时的兜底，用户复制到通讯录新建即可。
const contactCopyText = computed(() => {
  const c = card.value || {}
  const lines = [['姓名', c.name || c.name_en], ['公司', c.company], ['职位', [c.title, c.department].filter(Boolean).join(' · ')], ['手机', c.mobile || c.phone], ['邮箱', c.email]]
  return lines.filter(([, v]) => v).map(([k, v]) => `${k}：${v}`).join('\n')
})
async function copyContactInfo() {
  if (!contactCopyText.value) return
  await copy(contactCopyText.value, '名片信息')
  contactFallbackOpen.value = false
  showToast('已复制，去通讯录新建联系人粘贴即可', 'success')
}

let contactLeftPage = false
async function saveContact() {
  if (!card.value) return
  if (isWeChat()) { await showGuide('contact'); return }
  if (/Android|Adr/i.test(navigator.userAgent)) {
    // 安卓：intent 拉起预填的添加联系人界面。若 1.2s 内页面没进入后台（说明 intent 没拉起），
    // 弹「复制基本信息」卡片兜底——全程不下载 VCF，个别机型照样能存。
    contactLeftPage = false
    const markLeft = () => {
      if (document.visibilityState === 'hidden') contactLeftPage = true
    }
    document.addEventListener('visibilitychange', markLeft)
    window.addEventListener('pagehide', () => { contactLeftPage = true })
    window.location.href = contactHref.value
    setTimeout(() => {
      document.removeEventListener('visibilitychange', markLeft)
      if (!contactLeftPage && document.visibilityState === 'visible') contactFallbackOpen.value = true
    }, 1200)
    return
  }
  if (isIOS()) {
    // iOS Safari：.vcf 直链弹系统「添加联系人」界面（服务端按 UA 去掉 attachment）。
    openVcfInline(vcfApi.value)
    return
  }
  // PC / 鸿蒙 / 其它：不下载，直接弹复制信息卡片
  contactFallbackOpen.value = true
}
async function doShare() {
  if (isWeChat()) {
    showToast('已设为名片卡片：点右上角「···」→ 发送给朋友 / 分享到朋友圈', 'error')
    return
  }
  // 复制出去的必须是干净的公开名片地址，绝不能是带 wx_ticket/save 的地址栏 URL
  const r = await shareOrCopy({ title: card.value?.name || '电子名片', text: card.value?.title || '扫一扫保存我的名片', url: publicLink.value })
  if (r === 'copied') showToast('链接已复制，快分享给朋友', 'success')
  else if (r === 'failed') showToast('复制失败，请手动复制地址栏链接', 'error')
}
function openExchange() {
  if (isOwner.value && card.value) mySlug.value = slug.value
  exchangeOpen.value = true
}
async function doExchange() {
  if (!mySlug.value) return showToast('请填写你的名片短码')
  exchanging.value = true
  try {
    await api.post(`${qrApi.value}/exchange`, { slug: mySlug.value })
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
    const { data } = await api.post(`${qrApi.value}/favorite`)
    favorite.value = !!data.data?.favorite
    showToast(favorite.value ? '已收藏到我的名片夹' : '已取消收藏', 'success')
  } catch (e) { showToast(e.message, 'error') } finally { favBusy.value = false }
}
</script>

<style scoped>
/* 底部 dock 单排常驻，所有模板统一留足底部空间，避免遮住最后一张卡片 */
.cv-page { background: var(--t-bg); color: var(--t-text); min-height: 100vh; padding-bottom: 92px; }
/* 嵌入模式（仅裁头部的旧用法，保留兼容）：不吃整屏、不留 dock 空间 */
.cv-page.cv-embed { min-height: 0; padding-bottom: 0; background: transparent; }
.cv-embed .cv-cover { border-radius: 0 0 18px 18px; }
.cv-embed .cv-main { margin-top: -34px; }
.cv-embed .cv-profile { margin-top: 0; }
/* 持有者预览：整页与公开页同款，但 /me 是 tab 页、底部还有 MemberNav（z110），dock/fab 抬到它上方避免被盖 */
/* padding-top 用页面背景色给出与顶栏的间距（不用 margin，避免透出 body 白色） */
.cv-page.cv-owner { padding-top: 12px; padding-bottom: 148px; }
.cv-owner .cv-dock { bottom: 56px; }
.cv-owner .cv-fab { bottom: calc(128px + env(safe-area-inset-bottom)); }
.cv-owner .cv-fab-menu { bottom: calc(180px + env(safe-area-inset-bottom)); }
/* 高档商务名片：卡片大圆角 + 轻阴影，浅灰蓝底衬托层次 */
.cv-page .card { border-radius: 20px; box-shadow: 0 4px 18px rgba(30,64,120,.07); border: 0; overflow: hidden; }
.cv-cover { height: 168px; position: relative; border-radius: 0 0 28px 28px; background: var(--t-cover); overflow: hidden; }
/* 封面动态光晕：主题色柔光呼吸（无位移），低亮度不压文字 */
.cv-cover::before {
  content: ''; position: absolute; inset: -30%; pointer-events: none; z-index: 0;
  background: radial-gradient(70% 90% at 22% 10%, rgba(var(--glow-rgb, 37,99,235), .22), transparent 62%);
  animation: cvGlowBreath 30s ease-in-out infinite alternate;
}
.cv-cover > * { position: relative; z-index: 1; }
@media (prefers-reduced-motion: reduce) { .cv-cover::before { animation: none; opacity: .7; } }
/* 返回键：主题毛玻璃圆钮（不是裸字符），任何模板都清晰可见、与名片同色系 */
.cv-back { position: absolute; left: 14px; top: calc(12px + var(--safe-top)); width: 34px; height: 34px; display: grid; place-items: center; border-radius: 50%; font-size: 26px; line-height: 1; color: #fff; background: rgba(var(--glow-rgb, 37,99,235), .30); border: 1px solid rgba(255,255,255,.30); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); box-shadow: inset 0 1px 0 rgba(255,255,255,.18); }
/* 持有者预览：编辑入口收进名片卡的姓名行（卡片右上角是二维码，不再在封面上放铅笔） */
.cv-inline-edit { flex: 0 0 auto; width: 26px; height: 26px; margin-left: 2px; display: grid; place-items: center; border-radius: 50%; font-size: 15px; line-height: 1; color: var(--t-accent, var(--primary)); background: rgba(var(--glow-rgb, 37,99,235), .10); border: 1px solid rgba(var(--glow-rgb, 37,99,235), .22); cursor: pointer; -webkit-tap-highlight-color: transparent; }
.cv-inline-edit:active { transform: scale(.92); }
/* owner 页已有蓝色工作台顶栏：封面白条不再需要，名片卡直接贴近顶栏（不影响公开页的模板封面） */
.cv-owner .cv-cover { display: none; }
.cv-owner .cv-main { margin-top: 0 !important; }
.cv-brand { position: absolute; right: 16px; top: calc(18px + var(--safe-top)); color: #fff; font-weight: 800; opacity: .9; }
.cv-brand em { font-style: normal; opacity: .75; }
.cv-main { margin-top: -48px; position: relative; }
.cv-loading { padding: 60px 0; text-align: center; }
.cv-profile { padding: 18px; display: flex; gap: 14px; align-items: flex-start; position: relative; background: var(--t-surface); }
.cv-avatar { flex: 0 0 70px; height: 70px; border-radius: 18px; overflow: hidden; background: var(--t-accent); color: #fff; display: grid; place-items: center; font-size: 30px; font-weight: 800; }
.cv-avatar img { width: 100%; height: 100%; object-fit: cover; }
/* LOGO 多为横向/带字，用 contain 完整显示 + 白底，避免 cover 裁掉内容 */
.cv-avatar.is-logo { background: #fff; padding: 6px; }
.cv-avatar.is-logo img { object-fit: contain; }
.cv-ident { flex: 1; min-width: 0; padding-right: 62px; }
/* 居中排版的模板姓名不与右上角二维码同排，无需留位 */
.cv-tpl-elite .cv-ident, .cv-tpl-glass .cv-ident, .cv-tpl-wood .cv-ident { padding-right: 0; }
.cv-name-row { display: flex; align-items: center; gap: 10px; }
/* 姓名区二维码入口：白底小图、贴卡片右上角，所有模板共用；点击走 qrModal 弹层 */
.cv-qr-entry {
  position: absolute; right: 16px; top: 16px; z-index: 4;
  width: 54px; height: 54px; padding: 4px; border: 1px solid rgba(15,23,42,.1);
  border-radius: 12px; background: #fff; box-shadow: 0 6px 18px rgba(15,23,42,.14);
  cursor: pointer; -webkit-tap-highlight-color: transparent;
}
/* .cv-clean .cv-profile > * 会把子元素强制 position:relative，这里用更高优先级锁回绝对定位 */
.cv-clean .cv-main > .cv-profile > .cv-qr-entry { position: absolute; }
.cv-qr-entry img { display: block; width: 100%; height: 100%; }
/* 二维码弹层里的名片地址：可点复制，长链接省略不撑破卡片 */
.cv-qr-url { margin: 0 0 8px; padding: 8px 10px; border-radius: 8px; background: var(--bg-page, #f1f5f9); color: var(--primary, #2563eb); font-size: 12px; font-weight: 600; text-align: center; word-break: break-all; cursor: pointer; }
.cv-name { font-size: 22px; font-weight: 800; letter-spacing: -.5px; }
.cv-en { font-size: 12px; color: var(--t-muted); font-weight: 500; margin-left: 6px; }
.cv-title { color: var(--t-muted); font-size: 12px; margin-top: 3px; }
.cv-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 9px; }
.cv-tags span { font-size: 11px; padding: 3px 9px; border-radius: 999px; background: rgba(0,0,0,.05); background: color-mix(in srgb, var(--t-accent) 12%, transparent); color: var(--t-accent); font-weight: 600; }
.cv-status { position: absolute; right: 14px; bottom: 12px; }
.notice-card { margin-top: 12px; border-color: #fcd34d; background: #fffbeb; color: #92400e; }
/* 操作栏已并入联系方式行：整行点击复制该字段，行尾按钮给出电话/短信/邮件等操作 */
.cv-contact-acts { display: flex; align-items: center; gap: 6px; flex: 0 0 auto; }
.cv-row-act { padding: 5px 9px; border-radius: 7px; background: rgba(0,0,0,.05); background: color-mix(in srgb, var(--t-accent) 12%, transparent); color: var(--t-accent); font-size: 11px; font-weight: 600; white-space: nowrap; }
.cv-block { margin-top: 12px; background: var(--t-surface); }
.cv-block h3, .cv-sec-title { font-size: 14px; margin-bottom: 10px; padding-left: 10px; border-left: 3px solid var(--t-accent, #2563eb); line-height: 1.3; }
.cv-bio { color: var(--t-muted); font-size: 13px; white-space: pre-wrap; }
.cv-links { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; }
.cv-links a { border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; background: var(--t-bg); }
.cv-links b { font-size: 13px; }
.cv-links span { font-size: 10px; color: var(--t-muted); }
.cv-site { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
.cv-site:last-child { border-bottom: 0; }
.cv-site > div:first-child { display: flex; flex-direction: column; min-width: 0; }
.cv-address { display: flex; align-items: center; gap: 8px; justify-content: space-between; cursor: pointer; }
.cv-region-line { font-size: 13px; font-weight: 600; color: var(--t-accent); margin-bottom: 6px; }
.cv-contact-row { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--t-line, rgba(0,0,0,.06)); cursor: pointer; }
.cv-contact-row:last-child { border-bottom: 0; }
.cv-contact-label { flex: 0 0 56px; font-size: 12px; color: var(--t-muted); }
/* 号码/邮箱等字段值全局高对比：默认继承主题正文色；固定配色模板另按底色写死 */
.cv-contact-value { flex: 1; min-width: 0; font-size: 13px; word-break: break-all; color: var(--t-text); font-weight: 600; }
/* 固定配色的老模板不跟主题变量：浅底写深字、深底写亮字，避免浅字压白底看不清 */
.cv-tpl-minimal .cv-contact-value, .cv-tpl-seal .cv-contact-value { color: #111827; }
.cv-tpl-elite .cv-contact-value { color: #f5f5f4; }
.cv-material-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--t-line, rgba(0,0,0,.06)); color: inherit; text-decoration: none; }
.cv-material-row:last-child { border-bottom: 0; }
.cv-material-ico { font-size: 18px; }
.cv-material-title { flex: 1; min-width: 0; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cv-material-more { font-size: 12px; color: var(--t-accent); }
/* 相册：图片缩略图直看，链接/文档点开直跳，不再绕中间资料页 */
.cv-gallery { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.cv-gallery-cell { display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 6px; border: 1px solid var(--line); border-radius: 10px; background: var(--t-bg); min-width: 0; }
.cv-gallery-cell img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 6px; background: #fff; }
.cv-gallery-cell > span:not(.cv-gallery-file-ico) { font-size: 10px; line-height: 1.3; width: 100%; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cv-gallery-file { justify-content: center; min-height: 96px; }
.cv-gallery-file-ico { width: 100%; aspect-ratio: 1; display: grid; place-items: center; border-radius: 6px; background: rgba(0,0,0,.05); background: color-mix(in srgb, var(--t-accent) 12%, transparent); color: var(--t-accent); }
.cv-gallery-file small { font-size: 9px; color: var(--t-muted); }
/* 全屏看图：四边定位（老 WebView 不认 inset:0），z 高于 dock(60)/fab(64)/tabbar(110)，低于微信原生层 */
.gallery-fullscreen { position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 3000; background: #0b0f16; display: flex; flex-direction: column; color: #fff; }
.gf-top { flex: 0 0 auto; min-height: calc(50px + var(--safe-top)); padding: var(--safe-top) 14px 0; display: flex; align-items: center; gap: 12px; background: rgba(0,0,0,.55); }
.gf-back { border: 0; background: transparent; color: #fff; font-size: 15px; font-weight: 600; padding: 8px 4px; min-width: 60px; text-align: left; }
.gf-count { font-size: 13px; color: rgba(255,255,255,.85); font-variant-numeric: tabular-nums; }
.gf-title { flex: 1; min-width: 0; text-align: right; font-size: 12px; color: rgba(255,255,255,.7); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gf-stage { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; padding: 10px; overflow: hidden; }
.gf-stage img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
.gf-nav { flex: 0 0 auto; display: flex; justify-content: center; gap: 14px; padding: 12px 14px calc(12px + env(safe-area-inset-bottom, 0px)); background: rgba(0,0,0,.55); }
.gf-nav button { border: 0; border-radius: 999px; background: rgba(255,255,255,.14); color: #fff; font-size: 14px; font-weight: 600; padding: 10px 18px; }
.gf-nav button:disabled { opacity: .35; }
.cv-maps { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.cv-maps a { font-size: 12px; padding: 6px 10px; border-radius: 8px; background: rgba(0,0,0,.05); background: color-mix(in srgb, var(--t-accent) 12%, transparent); color: var(--t-accent); font-weight: 600; }
/* 导航入口：地址区只留一个「导航到此处」，点底部「导航」或此处再选地图 */
.cv-map-launch { flex: 0 0 auto; padding: 6px 14px; border: 0; border-radius: 8px; background: var(--t-accent, #2454e8); color: #fff; font-size: 12px; font-weight: 600; }
.map-sheet-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px 10px; border-bottom: 1px solid #e8edf5; }
.map-sheet-head b { font-size: 16px; color: #17233c; }
.map-sheet-head button { width: 30px; height: 30px; border: 0; background: #f1f4f9; border-radius: 50%; font-size: 18px; line-height: 1; color: #64748b; }
.map-sheet-list { padding: 6px 12px 18px; overflow-y: auto; }
.map-sheet-list a { display: flex; align-items: center; gap: 12px; padding: 13px 10px; border-bottom: 1px solid #f0f3f8; text-decoration: none; color: #17233c; font-size: 14px; }
.map-sheet-list a:last-child { border-bottom: 0; }
.cf-body { padding: 14px 18px calc(20px + env(safe-area-inset-bottom)); }
.cf-info { margin: 12px 0; padding: 14px; border: 1px solid var(--line); border-radius: 10px; background: var(--bg-page); font-size: 14px; line-height: 1.9; white-space: pre-wrap; word-break: break-all; user-select: all; }
.map-ico { flex: 0 0 34px; width: 34px; height: 34px; display: block; object-fit: contain; border-radius: 8px; }
.map-arrow { margin-left: auto; color: #94a3b8; font-size: 16px; }
.cv-footer { text-align: center; color: var(--t-muted); font-size: 11px; padding: 26px 0 10px; }
/* 高档深灰底栏：四个主操作单排铺满，窄屏也不换行 */
.cv-dock { position: fixed; left: 0; right: 0; bottom: 0; display: flex; gap: 5px; padding: 10px 10px calc(10px + env(safe-area-inset-bottom)); background: #252a33; border-top: 1px solid rgba(255,255,255,.08); z-index: 60; color: #e2e8f0; }
.cv-dock .btn { flex: 1; min-width: 0; padding: 0 2px; font-size: 12.5px; white-space: nowrap; }
.cv-dock .btn-primary { background: var(--t-accent, #2563eb); color: #fff; border-color: transparent; }
.cv-dock .btn-ghost { background: rgba(255,255,255,.12); color: #e2e8f0; border-color: transparent; }
/* ===== 主题毛玻璃底栏（2026-11-25 用户定稿：底栏与四个按钮都跟名片配色走）=====
   色相唯一真相源 = .cv-page 内联的 --t-accent / --glow-rgb（由名片主题算出），
   不再写死深灰 + 香槟金，任何主题（皇家紫/翡翠绿/黑金）都自动匹配。
   半透明渐变 + backdrop-filter 做毛玻璃；不支持滤镜的老 WebView 由第一层不透明底色兜底。
   粒子用 radial-gradient 字面量，无 canvas 开销。 */
.cv-page .cv-dock.cv-dock-glass {
  /* ⚠️ 必须保持 fixed 贴底：这里若写 position:relative 会让 dock 掉进内容流悬在半空（2026-11-25 实锤）。 */
  overflow: hidden;
  gap: 8px; padding: 12px 12px calc(12px + env(safe-area-inset-bottom));
  background: rgba(18,22,36,.7);
  background: linear-gradient(180deg, rgba(var(--glow-rgb, 37,99,235), .36), rgba(var(--glow-rgb, 37,99,235), .56));
  border-top: 1px solid rgba(255,255,255,.26);
  box-shadow: 0 -8px 30px -14px rgba(var(--glow-rgb, 37,99,235), .75);
  -webkit-backdrop-filter: blur(18px) saturate(1.35); backdrop-filter: blur(18px) saturate(1.35);
}
/* 微光粒子：白点 + 主题色点交替，低透明度不抢内容；四边定位代替 inset（老 WebView 兼容） */
.cv-page .cv-dock.cv-dock-glass::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none;
  background:
    radial-gradient(circle at 12% 30%, rgba(255,255,255,.28) 0 2px, transparent 3px),
    radial-gradient(circle at 34% 72%, rgba(var(--glow-rgb, 37,99,235),.85) 0 1.5px, transparent 3px),
    radial-gradient(circle at 62% 24%, rgba(255,255,255,.20) 0 1.5px, transparent 3px),
    radial-gradient(circle at 84% 66%, rgba(var(--glow-rgb, 37,99,235),.75) 0 2px, transparent 3px),
    radial-gradient(circle at 52% 88%, rgba(255,255,255,.16) 0 1px, transparent 2px);
}
/* 四个主操作按钮本身就是毛玻璃：淡透明白底 + 主题色描边，第一枚用主题色加深强调 */
.cv-page .cv-dock.cv-dock-glass .dock-btn {
  position: relative; min-height: 50px; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 3px;
  font-size: 12px; font-weight: 600; letter-spacing: .02em;
  border-radius: 16px; border: 1px solid rgba(255,255,255,.24); padding: 6px 2px;
  background: rgba(255,255,255,.12); color: #fff;
  -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.16);
  transition: transform .16s ease, filter .16s ease;
}
.cv-page .cv-dock.cv-dock-glass .dock-btn:active { transform: scale(.94); filter: brightness(1.08); }
.cv-page .cv-dock.cv-dock-glass .dock-btn:disabled { opacity: .45; }
.cv-page .cv-dock.cv-dock-glass .dock-ico {
  display: block; height: 20px; line-height: 20px; font-size: 17px; font-family: inherit; font-style: normal;
}
/* 电话手柄：CSS 画，避免 emoji 跨端不一致；用 currentColor 跟按钮文字色 */
.cv-page .cv-dock.cv-dock-glass .dock-ico-phone {
  width: 18px; height: 18px; position: relative;
  background: currentColor;
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.2.4 2.4.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1l-2.3 2.2z'/%3E%3C/svg%3E") center/contain no-repeat;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.2.4 2.4.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1l-2.3 2.2z'/%3E%3C/svg%3E") center/contain no-repeat;
}
.cv-page .cv-dock.cv-dock-glass .btn-primary {
  background: var(--t-accent, #2563eb);
  background: linear-gradient(135deg, rgba(var(--glow-rgb, 37,99,235), .68), rgba(var(--glow-rgb, 37,99,235), .94));
  color: #fff; border-color: rgba(255,255,255,.38);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.28), 0 10px 24px -12px rgba(var(--glow-rgb, 37,99,235), .95);
}
.cv-page .cv-dock.cv-dock-glass .btn-ghost {
  background: rgba(255,255,255,.10); color: #fff;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.10);
}
/* 极简白 / 纸白模板：换成浅色毛玻璃，按钮文字走名片深色，底与描边仍带主题色 */
.cv-page.cv-tpl-minimal .cv-dock.cv-dock-glass,
.cv-page.cv-clean.cv-tpl-paper .cv-dock.cv-dock-glass {
  background: rgba(255,255,255,.88);
  background: linear-gradient(180deg, rgba(255,255,255,.88), rgba(var(--glow-rgb, 37,99,235), .16));
  border-top-color: rgba(var(--glow-rgb, 37,99,235), .30);
  box-shadow: 0 -6px 22px -14px rgba(var(--glow-rgb, 37,99,235), .35);
}
.cv-page.cv-tpl-minimal .cv-dock.cv-dock-glass .dock-btn,
.cv-page.cv-clean.cv-tpl-paper .cv-dock.cv-dock-glass .dock-btn { color: var(--t-text, #374151); border-color: rgba(var(--glow-rgb, 37,99,235), .20); }
.cv-page.cv-tpl-minimal .cv-dock.cv-dock-glass .btn-ghost,
.cv-page.cv-clean.cv-tpl-paper .cv-dock.cv-dock-glass .btn-ghost { background: rgba(var(--glow-rgb, 37,99,235), .10); color: var(--t-text, #374151); box-shadow: inset 0 0 0 1px rgba(var(--glow-rgb, 37,99,235), .14); }
.cv-page.cv-tpl-minimal .cv-dock.cv-dock-glass .btn-primary,
.cv-page.cv-clean.cv-tpl-paper .cv-dock.cv-dock-glass .btn-primary { background: var(--t-accent, #2563eb); color: #fff; border-color: transparent; box-shadow: 0 8px 20px -12px rgba(var(--glow-rgb, 37,99,235), .9); }
/* 悬浮次级入口：导航/收藏/交换名片收进这里；菜单用中性白底，任何主题都清晰 */
.cv-fab { position: fixed; right: 14px; bottom: calc(72px + env(safe-area-inset-bottom)); z-index: 64; width: 44px; height: 44px; border: 0; border-radius: 50%; background: var(--t-accent, #2563eb); color: #fff; font-size: 24px; line-height: 1; box-shadow: 0 8px 24px rgba(15,23,42,.3); cursor: pointer; -webkit-tap-highlight-color: transparent; }
.cv-fab.on { transform: scale(.94); }
.cv-fab-mask { position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 63; background: rgba(15,23,42,.28); }
.cv-fab-menu { position: absolute; right: 14px; bottom: calc(124px + env(safe-area-inset-bottom)); width: 168px; padding: 6px; border-radius: 14px; background: #fff; box-shadow: 0 18px 44px rgba(15,23,42,.28); }
.cv-fab-menu button { display: block; width: 100%; padding: 12px 14px; border: 0; border-radius: 9px; background: transparent; color: #1f2937; font-size: 14px; font-weight: 600; text-align: left; }
.cv-fab-menu button:active { background: #f1f5f9; }


/* ============ 布局模板：template × theme 正交组合，template 只改布局/形状，配色仍走 --t-* 变量 ============ */

/* 经典商务 classic：默认样式即经典，这里只做轻微增强（封面圆润、头像方形圆角） */
.cv-tpl-classic .cv-cover { border-radius: 0 0 28px 28px; }
.cv-tpl-classic .cv-avatar { border-radius: 18px; }

/* 极简素雅 minimal：去掉彩色封面改为浅色细条、细分割线、无卡片阴影、克制留白 */
.cv-tpl-minimal .cv-cover { height: 76px; border-radius: 0; background: var(--t-surface); border-bottom: 1px solid var(--line); }
.cv-tpl-minimal .cv-brand { color: var(--t-accent); opacity: 1; }
.cv-tpl-minimal .cv-back { color: var(--t-text); }
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
.cv-tpl-seal .cv-links a { border-radius: 4px; }
.cv-tpl-seal .cv-maps a, .cv-tpl-seal .btn-ghost { border-radius: 3px; }
.cv-tpl-seal .cv-footer { color: #64748b; letter-spacing: 1px; }
.cv-tpl-seal .cv-dock { background: rgba(18,33,60,.96); border-top: 3px solid #1e3a8a; }
.cv-tpl-seal .cv-dock .btn-ghost { background: rgba(255,255,255,.14); color: #fff; border-color: transparent; }

/* 联络卡 contact 的样式统一在下方「② 生效版」定义（此处旧版已废弃，避免双重定义冲突） */

/* 访客建卡引导：醒目但不喧宾夺主，按钮在窄屏换行居中 */
.cv-create-own { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; text-align: left; background: var(--t-surface, #fff); }
.cv-create-copy b { color: var(--t-accent, #1a3f86); }
.cv-create-own .btn { white-space: nowrap; }

/* ============ 7 套模板骨架差异化 ============
   换「模板」= 换排版骨架（封面形态 / 头像位置 / 信息排布 / 底栏）；
   换「主题」= 只换 --t-* 颜色。两者正交，任何模板都跟随主题配色。
   navygold 是唯一例外：品牌金蓝固定（用户指定的高端名片）。 */

/* ① 经典商务 classic：渐变横幅 + 左对齐头像 + 白卡列表（最通用） */
.cv-tpl-classic { background: var(--t-bg); }
.cv-tpl-classic .card { border: 1px solid var(--line, #dbe3ef); border-radius: 14px; box-shadow: 0 2px 10px rgba(16,36,70,.09); }
.cv-tpl-classic .cv-block h3, .cv-tpl-classic .cv-sec-title { font-size: 16px; font-weight: 700; color: var(--t-text); border-left: 4px solid var(--t-accent); padding-left: 10px; margin-bottom: 10px; }
.cv-tpl-classic .small.muted { color: var(--t-muted); }
.cv-tpl-classic .cv-profile { border-radius: 16px; border: 1px solid var(--line, #dbe4f5); box-shadow: 0 8px 26px rgba(16,36,70,.12); background: var(--t-surface); }
.cv-tpl-classic .cv-name { color: var(--t-text); font-size: 23px; }
.cv-tpl-classic .cv-title { color: var(--t-accent); font-weight: 600; }
.cv-tpl-classic .cv-dock { background: #0f1c33; border-top: 1px solid var(--t-accent); padding: 10px 12px calc(10px + env(safe-area-inset-bottom)); }
.cv-tpl-classic .cv-dock .btn { font-size: 13px; border-radius: 8px; }
.cv-tpl-classic .cv-dock .btn-ghost { background: #263550; color: #fff; border-color: transparent; }

/* ② 极简白 minimal：无封面 + 大留白 + 超大姓名 + 细线分隔（瑞士极简） */
.cv-tpl-minimal { background: #fff; }
.cv-tpl-minimal .cv-cover { height: 54px; border-radius: 0; background: #fff; border-bottom: 1px solid #e5e7eb; }
.cv-tpl-minimal .cv-brand { color: #111827; opacity: 1; top: calc(16px + var(--safe-top)); }
.cv-tpl-minimal .cv-back { color: #111827; }
.cv-tpl-minimal .cv-main { margin-top: 0; }
.cv-tpl-minimal .card { border: 0; border-bottom: 1px solid #eef0f3; border-radius: 0; box-shadow: none; background: transparent; }
.cv-tpl-minimal .cv-profile { padding: 26px 18px 22px; align-items: flex-start; gap: 16px; }
.cv-tpl-minimal .cv-avatar { width: 54px; height: 54px; flex-basis: 54px; border-radius: 50%; }
.cv-tpl-minimal .cv-name { font-size: 30px; font-weight: 800; letter-spacing: -1.2px; line-height: 1.15; color: #111827; }
.cv-tpl-minimal .cv-en { display: block; margin-top: 2px; letter-spacing: .5px; }
.cv-tpl-minimal .cv-title { font-size: 13px; color: #6b7280; margin-top: 8px; }
.cv-tpl-minimal .cv-tags span { border-radius: 0; background: transparent; border-bottom: 1px solid var(--t-accent); color: var(--t-accent); padding: 2px 0; }
.cv-tpl-minimal .cv-block h3, .cv-tpl-minimal .cv-sec-title { font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #9ca3af; border-left: 0; padding-left: 0; }
.cv-tpl-minimal .cv-actions { padding: 14px 0; }
.cv-tpl-minimal .cv-actions i { border-radius: 50%; border: 1px solid #e5e7eb; background: transparent; color: #374151; }
.cv-tpl-minimal .cv-dock { background: #fff; border-top: 1px solid #e5e7eb; color: #374151; }
.cv-tpl-minimal .cv-dock .btn-primary { background: var(--t-accent); }
.cv-tpl-minimal .cv-dock .btn-ghost { background: #f3f4f6; color: #374151; }

/* ③ 尊享黑金 elite：深色沉浸 + 居中大头像金环 + 衬线署名（固定深底，强调色跟主题） */
.cv-tpl-elite { background: #0b0d12; color: #f5f5f4; }
.cv-tpl-elite .cv-cover { height: 210px; border-radius: 0 0 40px 40px; background: var(--t-cover); }
.cv-tpl-elite .cv-main { margin-top: -70px; }
.cv-tpl-elite .card { background: #15171c; border: 1px solid rgba(255,255,255,.09); }
.cv-tpl-elite .cv-profile { flex-direction: column; align-items: center; text-align: center; gap: 10px; padding: 24px 18px; background: #15171c; border-color: rgba(255,255,255,.1); }
/* 曜石黑金质感：斜向金属拉丝 + 顶部暖金高光（静态，不动画） */
.cv-tpl-elite .cv-profile {
  background-image:
    linear-gradient(180deg, rgba(185,147,85,.16), transparent 30%),
    repeating-linear-gradient(112deg, rgba(255,255,255,.035) 0 1px, transparent 1px 4px);
}
.cv-tpl-elite .cv-avatar { width: 92px; height: 92px; flex: 0 0 92px; border-radius: 50%; border: 3px solid var(--t-accent); box-shadow: 0 0 0 5px #15171c, 0 12px 30px rgba(0,0,0,.4); }
.cv-tpl-elite .cv-name-row { justify-content: center; }
.cv-tpl-elite .cv-name { font-family: Georgia,'Songti SC',serif; font-size: 26px; letter-spacing: 4px; color: #f5f5f4; }
.cv-tpl-elite .cv-en { display: block; margin: 4px 0 0; letter-spacing: 2px; }
.cv-tpl-elite .cv-title { letter-spacing: 2px; color: #c4c4c8; }
.cv-tpl-elite .cv-tags { justify-content: center; }
.cv-tpl-elite .cv-tags span { border-radius: 0; border-bottom: 1px solid var(--t-accent); background: transparent; color: var(--t-accent); }
.cv-tpl-elite .cv-block h3, .cv-tpl-elite .cv-sec-title { text-align: center; font-size: 12px; letter-spacing: 4px; color: var(--t-accent); border-left: 0; padding-left: 0; }
.cv-tpl-elite .cv-bio, .cv-tpl-elite .small.muted { color: #a1a1aa; }
.cv-tpl-elite .cv-links a { background: #1c1f26; border-color: rgba(255,255,255,.09); }
.cv-tpl-elite .cv-dock { background: #0b0d12; border-top: 2px solid var(--t-accent); }
.cv-tpl-elite .cv-dock .btn-ghost { background: rgba(255,255,255,.1); color: #f5f5f4; }

/* ④ 活力渐变 vivid：大圆角渐变封面 + 悬浮头像 + 胶囊标签（年轻创业） */
.cv-tpl-vivid { background: var(--t-bg); }
.cv-tpl-vivid .cv-cover { height: 188px; border-radius: 0 0 48px 48px; background: var(--t-cover); }
.cv-tpl-vivid .cv-main { margin-top: -56px; }
.cv-tpl-vivid .card { border: 0; border-radius: 20px; box-shadow: 0 12px 34px rgba(15,23,42,.10); }
.cv-tpl-vivid .cv-profile { padding: 20px 18px; }
.cv-tpl-vivid .cv-avatar { border-radius: 26px; width: 84px; height: 84px; flex-basis: 84px; box-shadow: 0 8px 24px color-mix(in srgb, var(--t-accent) 35%, transparent); }
.cv-tpl-vivid .cv-name { font-size: 24px; }
.cv-tpl-vivid .cv-tags span { border-radius: 999px; padding: 4px 12px; }
.cv-tpl-vivid .cv-actions i { border-radius: 14px; }
.cv-tpl-vivid .cv-block h3, .cv-tpl-vivid .cv-sec-title { color: var(--t-accent); }
.cv-tpl-vivid .cv-dock { background: var(--t-cover); border-top: 0; }

/* ⑤ 杂志方格 seal：黑白高对比 + 超大首字 + 直角细框（设计媒体风） */
.cv-tpl-seal { background: #fafafa; }
.cv-tpl-seal .cv-cover { height: 96px; border-radius: 0; background: #111827; border-bottom: 5px solid var(--t-accent); }
.cv-tpl-seal .cv-cover::after { display: none; }
.cv-tpl-seal .cv-brand { color: #fff; letter-spacing: 3px; }
.cv-tpl-seal .cv-back { color: #fff; }
.cv-tpl-seal .cv-main { margin-top: -20px; }
.cv-tpl-seal .card { border-radius: 0; border: 2px solid #111827; box-shadow: 4px 4px 0 rgba(17,24,39,.12); background: #fff; }
.cv-tpl-seal .cv-profile { border-top: 6px solid #111827; padding: 18px 16px; align-items: flex-end; }
.cv-tpl-seal .cv-avatar { border-radius: 0; width: 76px; height: 76px; flex-basis: 76px; border: 3px solid #111827; }
.cv-tpl-seal .cv-name { font-weight: 900; font-size: 34px; letter-spacing: -1px; line-height: 1; color: #111827; }
.cv-tpl-seal .cv-name::first-letter { font-size: 1.45em; }
.cv-tpl-seal .cv-title { font-weight: 700; color: #111827; }
.cv-tpl-seal .cv-tags span { border-radius: 0; border: 2px solid #111827; background: #fff; color: #111827; }
.cv-tpl-seal .cv-actions i { border-radius: 0; border: 2px solid #111827; background: #fff; color: #111827; }
.cv-tpl-seal .cv-block h3, .cv-tpl-seal .cv-sec-title { color: #111827; border-left: 6px solid #111827; padding-left: 10px; letter-spacing: 1px; }
.cv-tpl-seal .cv-links a { border-radius: 0; border: 2px solid #111827; }
.cv-tpl-seal .cv-map-launch { border-radius: 0; border: 2px solid #111827; }
.cv-tpl-seal .cv-dock { background: #111827; border-top: 5px solid var(--t-accent); }
.cv-tpl-seal .cv-dock .btn-ghost { background: #fff; color: #111827; }

/* ===== 简洁四套模板（contact 金黑 / paper 极简纸白 / glass 墨夜玻璃 / wood 暖木衬线）=====
   同一套骨架：深蓝/纸白/玻璃/暖木背景 + 单张圆角卡内聚全部信息 + 卡内拨号/复制/存档 + 环境指引。
   四套差异全部走 --cv-* 变量（线条粗细、圆角、字体、阴影、配色），避免多份样式复制。 */
.cv-clean {
  --cv-page-bg: var(--ng-page-bg); --cv-ink: #12202e; --cv-ink-2: #4a5b6e;
  --cv-line: #efece5; --cv-panel-bg: #fff; --cv-card-bg: #fff; --cv-card-border: 0;
  --cv-card-radius: 22px; --cv-card-x: 24px; --cv-card-pad: 30px 24px 22px;
  --cv-card-shadow: 0 26px 60px -22px rgba(0,0,0,.65), 0 0 0 1px rgba(255,255,255,.06);
  --cv-card-blur: none; --cv-topbar-h: 6px; --cv-topbar-x: 0;
  --cv-topbar-bg: linear-gradient(90deg,var(--ng-navy),var(--ng-navy-2) 40%,var(--ng-gold-2) 78%,var(--ng-gold));
  --cv-logo-bg-solid: #1d3a55; --cv-logo-bg: linear-gradient(145deg,#1d3a55,#0e2233); --cv-logo-radius: 14px;
  --cv-logo-shadow: inset 0 0 0 2px rgba(216,187,133,.5),0 8px 18px -8px rgba(18,32,46,.6);
  --cv-name-size: 27px; --cv-name-weight: 900; --cv-name-spacing: .04em; --cv-name-color: #12202e; --cv-name-font: inherit;
  --cv-role-color: #4a5b6e; --cv-role-size: 12.5px; --cv-role-spacing: .06em;
  --cv-org-color: #1d3a55; --cv-org-border: 1px dashed #e2ddd2;
  --cv-tag-bg: #f4f1ea; --cv-tag-color: #6b5a3c; --cv-tag-shadow: inset 0 0 0 1px rgba(185,147,85,.28); --cv-tag-radius: 99px;
  --cv-btn-radius: 13px; --cv-btn-font: inherit; --cv-btn-spacing: .02em;
  /* ⚠️ 微信老 WebView 解析不了「渐变里嵌 var()」，会整条失效变白底 → 白字消失（2026-11-25 实锤）。
     渐变内的色值一律写字面量；使用处再加同色纯色 fallback（见 .cv-clean .cv-site/.cv-dock .btn-primary）。 */
  --cv-btn-main-solid: #1d3a55; --cv-btn-main-bg: linear-gradient(135deg,#1d3a55,#0f2739); --cv-btn-main-color: #fff; --cv-btn-main-shadow: 0 10px 22px -12px rgba(18,32,46,.85);
  --cv-btn-ghost-bg: #f7f5f0; --cv-btn-ghost-color: #1d3a55; --cv-btn-ghost-shadow: inset 0 0 0 1px #e6e0d4;
  --cv-btn-save-solid: #a8834a; --cv-btn-save-bg: linear-gradient(135deg,#c9a163,#a8834a); --cv-btn-save-color: #fff; --cv-btn-save-shadow: 0 12px 24px -14px rgba(169,131,74,.9);
  --cv-steps-bg: #faf8f3; --cv-steps-color: #5c6a79; --cv-steps-shadow: inset 0 0 0 1px #eee8dc; --cv-steps-radius: 12px; --cv-steps-title: #a8834a; --cv-steps-b: #1d3a55;
  --cv-mini-bg: #f4f1ea; --cv-mini-color: #1d3a55; --cv-mini-shadow: inset 0 0 0 1px rgba(185,147,85,.28); --cv-mini-on-solid: #a8834a; --cv-mini-on-bg: linear-gradient(135deg,#c9a163,#a8834a); --cv-mini-on-color: #fff;
  --cv-block-title: #b99355; --cv-link-color: #1d3a55;
  --cv-foot-color: #a9b1ba; --cv-foot-b: #b99355; --cv-hint-color: #9fb0c0;
  --cv-wm-color: #12202e; --cv-wm-opacity: .04;
  --cv-back-color: #d8bb85; --cv-back-bg: rgba(12,26,38,.5); --cv-brand-color: rgba(255,255,255,.85);
  background: var(--cv-page-bg); color: var(--cv-ink);
}
/* B 极简纸白：6px 小圆角 + 1px 发丝线 + 细体大字 + 描边按钮 */
.cv-tpl-paper {
  --cv-page-bg: #eeede9; --cv-ink: #111; --cv-ink-2: #8a8a8a; --cv-line: #f0eee9;
  --cv-card-bg: #fff; --cv-card-border: 1px solid #e7e5df; --cv-card-radius: 6px; --cv-card-x: 26px; --cv-card-pad: 36px 26px 24px;
  --cv-card-shadow: 0 1px 0 #dcdad4, 0 30px 60px -40px rgba(0,0,0,.28);
  --cv-topbar-h: 1px; --cv-topbar-x: 26px; --cv-topbar-bg: #111;
  --cv-logo-bg: #111; --cv-logo-radius: 50%; --cv-logo-shadow: none;
  --cv-name-size: 30px; --cv-name-weight: 300; --cv-name-spacing: .14em; --cv-name-color: #111;
  --cv-role-color: #8a8a8a; --cv-role-size: 11px; --cv-role-spacing: .18em;
  --cv-org-color: #111; --cv-org-border: 1px solid #eceae5;
  --cv-tag-bg: #fff; --cv-tag-color: #555; --cv-tag-shadow: inset 0 0 0 1px #ddd; --cv-tag-radius: 3px;
  --cv-btn-radius: 3px; --cv-btn-main-bg: #111; --cv-btn-main-color: #fff; --cv-btn-main-shadow: none;
  --cv-btn-ghost-bg: #fff; --cv-btn-ghost-color: #111; --cv-btn-ghost-shadow: inset 0 0 0 1px #ccc;
  --cv-btn-save-bg: #fff; --cv-btn-save-color: #111; --cv-btn-save-shadow: inset 0 0 0 1.5px #111;
  --cv-steps-bg: #fafaf8; --cv-steps-color: #777; --cv-steps-shadow: inset 0 0 0 1px #eceae5; --cv-steps-radius: 3px; --cv-steps-title: #111; --cv-steps-b: #000;
  --cv-mini-bg: #fff; --cv-mini-color: #111; --cv-mini-shadow: inset 0 0 0 1px #ddd; --cv-mini-on-bg: #111; --cv-mini-on-color: #fff;
  --cv-block-title: #111; --cv-link-color: #111; --cv-foot-color: #b5b2ab; --cv-foot-b: #111; --cv-hint-color: #8a8a8a;
  --cv-back-color: #111; --cv-back-bg: rgba(255,255,255,.7); --cv-brand-color: #111;
}
/* C 墨夜玻璃：20px 圆角 + 半透玻璃 + 薄荷绿点缀 + 内发光 */
.cv-tpl-glass {
  --cv-page-bg: radial-gradient(900px 600px at 15% 0%,#173049 0%,#0b1622 55%,#060c13 100%);
  --cv-ink: #e8eef4; --cv-ink-2: #8fa6ba; --cv-line: rgba(255,255,255,.09);
  --cv-panel-bg: rgba(9,20,31,.82); --cv-card-bg: linear-gradient(160deg,rgba(255,255,255,.09),rgba(255,255,255,.03));
  --cv-card-border: 1px solid rgba(255,255,255,.12); --cv-card-radius: 20px; --cv-card-pad: 30px 24px 22px;
  --cv-card-shadow: 0 30px 70px -30px #000, inset 0 1px 0 rgba(255,255,255,.15); --cv-card-blur: blur(14px);
  --cv-topbar-h: 0; --cv-topbar-bg: transparent;
  --cv-logo-bg: rgba(127,211,193,.12); --cv-logo-radius: 16px; --cv-logo-shadow: inset 0 0 0 1px rgba(127,211,193,.4);
  --cv-name-size: 27px; --cv-name-weight: 900; --cv-name-spacing: .06em; --cv-name-color: #f2f7fb;
  --cv-role-color: #8fa6ba; --cv-role-size: 12.5px; --cv-role-spacing: .1em;
  --cv-org-color: #cfe6e0; --cv-org-border: 1px solid rgba(255,255,255,.12);
  --cv-tag-bg: rgba(255,255,255,.07); --cv-tag-color: #a8c3d6; --cv-tag-shadow: inset 0 0 0 1px rgba(255,255,255,.1); --cv-tag-radius: 99px;
  --cv-btn-main-solid: #1b7d6a; --cv-btn-main-bg: linear-gradient(135deg,#2ea88f,#1b7d6a); --cv-btn-main-color: #fff; --cv-btn-main-shadow: 0 14px 28px -16px rgba(46,168,143,.9);
  --cv-btn-ghost-bg: rgba(255,255,255,.08); --cv-btn-ghost-color: #dfeaf2; --cv-btn-ghost-shadow: inset 0 0 0 1px rgba(255,255,255,.14);
  --cv-btn-save-bg: rgba(255,255,255,.1); --cv-btn-save-color: #eaf4f1; --cv-btn-save-shadow: inset 0 0 0 1px rgba(255,255,255,.2);
  --cv-steps-bg: rgba(255,255,255,.05); --cv-steps-color: #9db1c2; --cv-steps-shadow: inset 0 0 0 1px rgba(255,255,255,.1); --cv-steps-title: #7fd3c1; --cv-steps-b: #dff0ec;
  --cv-mini-bg: rgba(255,255,255,.07); --cv-mini-color: #dfeaf2; --cv-mini-shadow: inset 0 0 0 1px rgba(255,255,255,.12); --cv-mini-on-bg: linear-gradient(135deg,#2ea88f,#1b7d6a); --cv-mini-on-color: #fff;
  --cv-block-title: #7fd3c1; --cv-link-color: #9ee8d5; --cv-foot-color: #6d8093; --cv-foot-b: #7fd3c1; --cv-hint-color: #718499;
  --cv-wm-color: #9ee8d5; --cv-wm-opacity: .03;
  --cv-back-color: #9ee8d5; --cv-back-bg: rgba(6,12,19,.5); --cv-brand-color: #9fb3c6;
}
/* D 暖木衬线：4px 直角 + 双层细框 + 衬线字体 + 棕色系 */
.cv-tpl-wood {
  --cv-page-bg: radial-gradient(circle at 20% 0%,#f6eee1 0%,#e8dbc8 60%,#ddcdb6 100%);
  --cv-ink: #3b2f24; --cv-ink-2: #735b3f; --cv-line: #f0e7d8;
  --cv-card-bg: #fffdf8; --cv-card-border: 1px solid #e4d8c6; --cv-card-radius: 4px; --cv-card-x: 26px; --cv-card-pad: 32px 26px 24px;
  --cv-card-shadow: 0 1px 0 #efe7db, 0 26px 50px -34px rgba(90,64,40,.55), inset 0 0 0 6px #fffdf8, inset 0 0 0 7px #efe4d4;
  --cv-topbar-h: 0; --cv-topbar-bg: transparent;
  --cv-logo-bg: #8b5e3c; --cv-logo-radius: 50%; --cv-logo-shadow: inset 0 0 0 3px rgba(255,255,255,.18);
  --cv-name-size: 29px; --cv-name-weight: 600; --cv-name-spacing: .16em; --cv-name-color: #3b2f24; --cv-name-font: "Songti SC","Noto Serif SC",serif;
  --cv-role-color: #8a7358; --cv-role-size: 11.5px; --cv-role-spacing: .14em;
  --cv-org-color: #5a462f; --cv-org-border: 1px solid #eadfce;
  --cv-tag-bg: #faf4e9; --cv-tag-color: #7b6344; --cv-tag-shadow: inset 0 0 0 1px #e3d5bf; --cv-tag-radius: 2px;
  --cv-btn-radius: 3px; --cv-btn-font: "Songti SC","Noto Serif SC",serif; --cv-btn-spacing: .06em;
  --cv-btn-main-bg: #5a462f; --cv-btn-main-color: #f9f2e5; --cv-btn-main-shadow: none;
  --cv-btn-ghost-bg: #faf4e9; --cv-btn-ghost-color: #5a462f; --cv-btn-ghost-shadow: inset 0 0 0 1px #dbcdb6;
  --cv-btn-save-bg: linear-gradient(135deg,#a87550,#8b5e3c); --cv-btn-save-color: #fff9ee; --cv-btn-save-shadow: none;
  --cv-steps-bg: #faf6ec; --cv-steps-color: #7d6a52; --cv-steps-shadow: inset 0 0 0 1px #ebe0cd; --cv-steps-radius: 2px; --cv-steps-title: #8b5e3c; --cv-steps-b: #4a3927;
  --cv-mini-bg: #faf4e9; --cv-mini-color: #5a462f; --cv-mini-shadow: inset 0 0 0 1px #dbcdb6; --cv-mini-on-bg: #8b5e3c; --cv-mini-on-color: #fff9ee;
  --cv-block-title: #8b5e3c; --cv-link-color: #6b4a2e; --cv-foot-color: #b3a08a; --cv-foot-b: #8b5e3c; --cv-hint-color: #9c8871;
  --cv-back-color: #8b5e3c; --cv-back-bg: rgba(255,253,248,.75); --cv-brand-color: #8b5e3c;
}
/* E 霓虹夜景：粉紫→冰蓝渐变玻璃 + 渐变文字 + 霓虹光晕 */
.cv-tpl-neon {
  --cv-page-bg: radial-gradient(760px 540px at 82% 0%,#3d1a72 0%,#190b32 46%,#08040f 100%);
  --cv-ink: #ece7ff; --cv-ink-2: #a99bd8; --cv-line: rgba(255,255,255,.09);
  --cv-panel-bg: rgba(18,8,36,.82);
  --cv-card-bg: linear-gradient(160deg,rgba(255,79,163,.13),rgba(79,216,255,.09) 60%,rgba(255,255,255,.03));
  --cv-card-border: 1px solid rgba(255,255,255,.16); --cv-card-radius: 26px; --cv-card-pad: 30px 24px 22px;
  --cv-card-shadow: 0 0 70px -14px rgba(255,79,163,.55),0 30px 70px -34px #000,inset 0 1px 0 rgba(255,255,255,.22); --cv-card-blur: blur(16px);
  --cv-topbar-h: 0; --cv-topbar-bg: transparent;
  --cv-logo-bg: linear-gradient(135deg,#ff4fa3,#4fd8ff); --cv-logo-radius: 50%; --cv-logo-shadow: 0 0 26px -6px rgba(255,79,163,.85);
  --cv-name-size: 29px; --cv-name-weight: 700; --cv-name-spacing: .1em; --cv-name-color: transparent;
  --cv-name-gradient: linear-gradient(115deg,#ffd3ea,#ff4fa3 45%,#4fd8ff);
  --cv-role-color: #a99bd8; --cv-role-size: 12.5px; --cv-role-spacing: .1em;
  --cv-org-color: #d7d0ff; --cv-org-border: 1px solid rgba(255,255,255,.14);
  --cv-tag-bg: rgba(255,255,255,.07); --cv-tag-color: #c3b7ef; --cv-tag-shadow: inset 0 0 0 1px rgba(255,255,255,.14); --cv-tag-radius: 99px;
  --cv-btn-main-bg: linear-gradient(135deg,#ff4fa3,#b13cf0); --cv-btn-main-color: #fff; --cv-btn-main-shadow: 0 14px 30px -14px rgba(255,79,163,.9);
  --cv-btn-ghost-bg: rgba(255,255,255,.08); --cv-btn-ghost-color: #dcd5ff; --cv-btn-ghost-shadow: inset 0 0 0 1px rgba(255,255,255,.18);
  --cv-btn-save-bg: linear-gradient(135deg,#4fd8ff,#3f8bff); --cv-btn-save-color: #05121d; --cv-btn-save-shadow: 0 14px 30px -16px rgba(79,216,255,.85);
  --cv-steps-bg: rgba(255,255,255,.05); --cv-steps-color: #a99bd8; --cv-steps-shadow: inset 0 0 0 1px rgba(255,255,255,.1); --cv-steps-title: #4fd8ff; --cv-steps-b: #ffd3ea;
  --cv-mini-bg: rgba(255,255,255,.07); --cv-mini-color: #dcd5ff; --cv-mini-shadow: inset 0 0 0 1px rgba(255,255,255,.14); --cv-mini-on-bg: linear-gradient(135deg,#ff4fa3,#4fd8ff); --cv-mini-on-color: #0a0416;
  --cv-block-title: #4fd8ff; --cv-link-color: #8fe6ff; --cv-foot-color: #7b6cae; --cv-foot-b: #ff4fa3; --cv-hint-color: #7b6cae;
  --cv-wm-color: #ff4fa3; --cv-wm-opacity: .03; --cv-back-color: #4fd8ff; --cv-back-bg: rgba(8,4,15,.5); --cv-brand-color: #b3a7e2;
}
/* F 酸性荧光：黑底荧光绿网格 + 直角硬边 + 8px 硬投影 */
.cv-tpl-acid {
  --cv-page-bg: #050505; --cv-page-grid: repeating-linear-gradient(0deg,rgba(204,255,0,.055) 0 1px,transparent 1px 20px),repeating-linear-gradient(90deg,rgba(204,255,0,.035) 0 1px,transparent 1px 20px);
  --cv-ink: #ccff00; --cv-ink-2: #7f8f2e; --cv-line: rgba(204,255,0,.22);
  --cv-panel-bg: #0a0a0a;
  --cv-card-bg: #0a0a0a; --cv-card-border: 1px solid #ccff00; --cv-card-radius: 0; --cv-card-pad: 30px 24px 22px;
  --cv-card-shadow: 8px 8px 0 rgba(204,255,0,.9),0 30px 60px -30px #000;
  --cv-topbar-h: 0; --cv-topbar-bg: transparent;
  --cv-logo-bg: #ccff00; --cv-logo-radius: 0; --cv-logo-shadow: none;
  --cv-name-size: 32px; --cv-name-weight: 900; --cv-name-spacing: .02em; --cv-name-color: #ccff00;
  --cv-role-color: #7f8f2e; --cv-role-size: 10.5px; --cv-role-spacing: .22em;
  --cv-org-color: #e8ff8a; --cv-org-border: 1px solid rgba(204,255,0,.4);
  --cv-tag-bg: transparent; --cv-tag-color: #ccff00; --cv-tag-shadow: inset 0 0 0 1px rgba(204,255,0,.5); --cv-tag-radius: 0;
  --cv-btn-radius: 0; --cv-btn-main-bg: #ccff00; --cv-btn-main-color: #000; --cv-btn-main-shadow: 4px 4px 0 rgba(255,255,255,.28);
  --cv-btn-ghost-bg: transparent; --cv-btn-ghost-color: #ccff00; --cv-btn-ghost-shadow: inset 0 0 0 1px #ccff00;
  --cv-btn-save-bg: transparent; --cv-btn-save-color: #ccff00; --cv-btn-save-shadow: inset 0 0 0 1px rgba(204,255,0,.55);
  --cv-steps-bg: #111; --cv-steps-color: #8d9a52; --cv-steps-shadow: inset 0 0 0 1px rgba(204,255,0,.25); --cv-steps-radius: 0; --cv-steps-title: #ccff00; --cv-steps-b: #e8ff8a;
  --cv-mini-bg: transparent; --cv-mini-color: #ccff00; --cv-mini-shadow: inset 0 0 0 1px rgba(204,255,0,.4); --cv-mini-on-bg: #ccff00; --cv-mini-on-color: #000;
  --cv-block-title: #ccff00; --cv-link-color: #ccff00; --cv-foot-color: #6f7a3a; --cv-foot-b: #ccff00; --cv-hint-color: #6f7a3a;
  --cv-back-color: #ccff00; --cv-back-bg: #0d0d0d; --cv-brand-color: #ccff00;
}
/* G 多巴胺：3px 厚黑描边 + 硬投影 + 彩色标签轮换 */
.cv-tpl-pop {
  --cv-page-bg: linear-gradient(165deg,#fff4e8 0%,#ffe4f0 52%,#e8f0ff 100%);
  --cv-ink: #241b3a; --cv-ink-2: #6d5f8c; --cv-line: #eee6f6;
  --cv-panel-bg: #fff; --cv-card-bg: #fff; --cv-card-border: 3px solid #241b3a; --cv-card-radius: 26px; --cv-card-pad: 30px 24px 22px;
  --cv-card-shadow: 10px 10px 0 #ffd166,0 26px 54px -30px rgba(36,27,58,.42);
  --cv-topbar-h: 0; --cv-topbar-bg: transparent;
  --cv-logo-bg: #ff6b6b; --cv-logo-radius: 50%; --cv-logo-shadow: inset 0 0 0 3px #241b3a;
  --cv-name-size: 29px; --cv-name-weight: 900; --cv-name-spacing: 0; --cv-name-color: #241b3a;
  --cv-role-color: #6d5f8c; --cv-role-size: 12.5px; --cv-role-spacing: .1em;
  --cv-org-color: #241b3a; --cv-org-border: 3px dashed #ffd166;
  --cv-tag-bg: #ffe066; --cv-tag-color: #241b3a; --cv-tag-shadow: none; --cv-tag-radius: 99px; --cv-tag-alt: 1;
  --cv-btn-radius: 14px; --cv-btn-main-bg: #ff6b6b; --cv-btn-main-color: #fff; --cv-btn-main-shadow: 4px 4px 0 #241b3a;
  --cv-btn-ghost-bg: #a0e7e5; --cv-btn-ghost-color: #241b3a; --cv-btn-ghost-shadow: 4px 4px 0 #241b3a;
  --cv-btn-save-bg: #b8a1ff; --cv-btn-save-color: #241b3a; --cv-btn-save-shadow: 4px 4px 0 #241b3a;
  --cv-steps-bg: #fffaf2; --cv-steps-color: #6d5f8c; --cv-steps-shadow: none; --cv-steps-radius: 14px; --cv-steps-title: #d1462f; --cv-steps-b: #241b3a; --cv-steps-border: 2px dashed #ffd166;
  --cv-mini-bg: #fff; --cv-mini-color: #241b3a; --cv-mini-shadow: inset 0 0 0 2px #241b3a; --cv-mini-on-bg: #ffd166; --cv-mini-on-color: #241b3a;
  --cv-block-title: #d1462f; --cv-link-color: #7a4fd6; --cv-foot-color: #a99cc4; --cv-foot-b: #d1462f; --cv-hint-color: #8d80a8;
  --cv-back-color: #241b3a; --cv-back-bg: #fff; --cv-brand-color: #241b3a;
}
/* H 杂志编辑：米色 + 番茄红 + 2px 直角 + 衬线大标题 + 红顶条 */
.cv-tpl-magazine {
  --cv-page-bg: #f2efe9; --cv-ink: #1a1a1a; --cv-ink-2: #6b675f; --cv-line: #e6e1d5;
  --cv-card-bg: #faf8f3; --cv-card-border: 1px solid #ddd7c9; --cv-card-radius: 2px; --cv-card-x: 26px; --cv-card-pad: 34px 26px 22px;
  --cv-card-shadow: 0 24px 46px -36px rgba(60,50,35,.5);
  --cv-topbar-h: 8px; --cv-topbar-bg: #d1462f;
  --cv-logo-bg: #1a1a1a; --cv-logo-radius: 2px; --cv-logo-shadow: none;
  --cv-name-size: 34px; --cv-name-weight: 700; --cv-name-spacing: .02em; --cv-name-color: #1a1a1a; --cv-name-font: "Noto Serif SC","Songti SC",serif;
  --cv-role-color: #d1462f; --cv-role-size: 10px; --cv-role-spacing: .24em;
  --cv-org-color: #1a1a1a; --cv-org-border: 2px solid #1a1a1a;
  --cv-tag-bg: transparent; --cv-tag-color: #5c5850; --cv-tag-shadow: inset 0 0 0 1px #cdc7b8; --cv-tag-radius: 0;
  --cv-btn-radius: 0; --cv-btn-main-bg: #d1462f; --cv-btn-main-color: #fff; --cv-btn-main-shadow: none;
  --cv-btn-ghost-bg: transparent; --cv-btn-ghost-color: #1a1a1a; --cv-btn-ghost-shadow: inset 0 0 0 1px #1a1a1a;
  --cv-btn-save-bg: #1a1a1a; --cv-btn-save-color: #f7f4ee; --cv-btn-save-shadow: none;
  --cv-steps-bg: #fff; --cv-steps-color: #6b675f; --cv-steps-shadow: none; --cv-steps-radius: 0; --cv-steps-title: #d1462f; --cv-steps-b: #1a1a1a; --cv-steps-border-left: 3px solid #d1462f;
  --cv-mini-bg: transparent; --cv-mini-color: #1a1a1a; --cv-mini-shadow: inset 0 0 0 1px #1a1a1a; --cv-mini-on-bg: #d1462f; --cv-mini-on-color: #fff;
  --cv-block-title: #d1462f; --cv-link-color: #b83a25; --cv-foot-color: #a8a299; --cv-foot-b: #d1462f; --cv-hint-color: #8b867c;
  --cv-back-color: #d1462f; --cv-back-bg: #fff; --cv-brand-color: #1a1a1a;
}
/* L1 竖版海报：无卡片通栏 + 46px 巨字 + 信息两列 */
.cv-tpl-poster {
  --cv-page-bg: radial-gradient(900px 600px at 50% -8%,#22384d 0%,#101d29 50%,#070d14 100%);
  --cv-ink: #eef3f7; --cv-ink-2: #8fa3b7; --cv-line: rgba(255,255,255,.1);
  --cv-panel-bg: rgba(9,18,27,.82);
  --cv-card-bg: transparent; --cv-card-border: 0; --cv-card-radius: 0; --cv-card-shadow: none; --cv-card-pad: 0;
  --cv-topbar-h: 0; --cv-topbar-bg: transparent;
  --cv-logo-bg: transparent; --cv-logo-radius: 0; --cv-logo-shadow: none;
  --cv-name-size: 46px; --cv-name-weight: 900; --cv-name-spacing: .16em; --cv-name-color: #fff;
  --cv-role-color: #9db0c2; --cv-role-size: 12px; --cv-role-spacing: .24em;
  --cv-org-color: #8fa3b7; --cv-org-border: 0;
  --cv-tag-bg: rgba(255,255,255,.07); --cv-tag-color: #cfe0ee; --cv-tag-shadow: inset 0 0 0 1px rgba(255,255,255,.12); --cv-tag-radius: 0;
  --cv-btn-radius: 0; --cv-btn-main-bg: #d8bb85; --cv-btn-main-color: #0b1620; --cv-btn-main-shadow: none;
  --cv-btn-ghost-bg: transparent; --cv-btn-ghost-color: #e6eef5; --cv-btn-ghost-shadow: inset 0 0 0 1px rgba(255,255,255,.25);
  --cv-btn-save-bg: transparent; --cv-btn-save-color: #d8bb85; --cv-btn-save-shadow: inset 0 0 0 1px rgba(216,187,133,.5);
  --cv-steps-bg: rgba(255,255,255,.04); --cv-steps-color: #8fa3b7; --cv-steps-shadow: none; --cv-steps-radius: 0; --cv-steps-title: #d8bb85; --cv-steps-b: #e6eef5; --cv-steps-border-left: 2px solid #d8bb85;
  --cv-mini-bg: transparent; --cv-mini-color: #cfe0ee; --cv-mini-shadow: inset 0 0 0 1px rgba(255,255,255,.16); --cv-mini-on-bg: #d8bb85; --cv-mini-on-color: #0b1620;
  --cv-block-title: #d8bb85; --cv-link-color: #d8bb85; --cv-foot-color: #6d8298; --cv-foot-b: transparent; --cv-hint-color: #6d8298;
  --cv-wm-opacity: 0; --cv-back-color: #d8bb85; --cv-back-bg: rgba(12,26,38,.5); --cv-brand-color: #d8bb85;
}
/* L2 票据存根：白纸锯齿边 + 等宽数字 + 虚线分隔 */
.cv-tpl-ticket {
  --cv-page-bg: #e9e6df; --cv-ink: #232323; --cv-ink-2: #777; --cv-line: #dedbd3;
  --cv-panel-bg: #fffefb; --cv-card-bg: #fffefb; --cv-card-border: 0; --cv-card-radius: 0; --cv-card-pad: 24px 24px 20px;
  --cv-card-shadow: 0 20px 44px -26px rgba(0,0,0,.4);
  --cv-topbar-h: 0; --cv-topbar-bg: transparent;
  --cv-logo-bg: transparent; --cv-logo-radius: 0; --cv-logo-shadow: none;
  --cv-name-size: 30px; --cv-name-weight: 900; --cv-name-spacing: .18em; --cv-name-color: #232323;
  --cv-name-font: ui-monospace,Menlo,"Noto Sans SC",monospace;
  --cv-role-color: #666; --cv-role-size: 11px; --cv-role-spacing: .3em;
  --cv-org-color: #232323; --cv-org-border: 1px dashed #c9c9c9;
  --cv-tag-bg: #f2f0ea; --cv-tag-color: #555; --cv-tag-shadow: none; --cv-tag-radius: 0;
  --cv-btn-radius: 0; --cv-btn-main-bg: #232323; --cv-btn-main-color: #fff; --cv-btn-main-shadow: none;
  --cv-btn-ghost-bg: #fff; --cv-btn-ghost-color: #232323; --cv-btn-ghost-shadow: inset 0 0 0 1px #232323;
  --cv-btn-save-bg: #f7f5ee; --cv-btn-save-color: #232323; --cv-btn-save-shadow: inset 0 0 0 1px #c9c9c9; --cv-btn-font: ui-monospace,Menlo,monospace; --cv-btn-spacing: .08em;
  --cv-steps-bg: #faf9f4; --cv-steps-color: #777; --cv-steps-shadow: none; --cv-steps-radius: 0; --cv-steps-title: #232323; --cv-steps-b: #000; --cv-steps-border-left: 2px dashed #d5d5d5;
  --cv-mini-bg: #f7f5ee; --cv-mini-color: #232323; --cv-mini-shadow: inset 0 0 0 1px #c9c9c9; --cv-mini-on-bg: #232323; --cv-mini-on-color: #fff;
  --cv-block-title: #232323; --cv-link-color: #232323; --cv-foot-color: #9a9a9a; --cv-foot-b: #232323; --cv-hint-color: #8a8a8a;
  --cv-back-color: #232323; --cv-back-bg: #fff; --cv-brand-color: #232323;
}
/* L3 横版名片：右侧深色色块（手机竖屏保留色块特征、维持单列可读） */
.cv-tpl-horizontal {
  --cv-page-bg: linear-gradient(170deg,#eef1f4,#dfe4ea); --cv-ink: #17222e; --cv-ink-2: #7d8b99; --cv-line: #eceff2;
  --cv-card-bg: #fff; --cv-card-border: 0; --cv-card-radius: 10px; --cv-card-pad: 22px 20px 18px;
  --cv-card-shadow: 0 22px 46px -24px rgba(23,34,46,.45);
  --cv-topbar-h: 0; --cv-topbar-bg: transparent;
  --cv-logo-bg: rgba(23,34,46,.1); --cv-logo-radius: 8px; --cv-logo-shadow: none;
  --cv-name-size: 25px; --cv-name-weight: 900; --cv-name-spacing: .1em; --cv-name-color: #17222e;
  --cv-role-color: #7d8b99; --cv-role-size: 10.5px; --cv-role-spacing: .14em;
  --cv-org-color: #17222e; --cv-org-border: 1px solid #e6e9ed;
  --cv-tag-bg: #f2f4f6; --cv-tag-color: #5d6a78; --cv-tag-shadow: none; --cv-tag-radius: 2px;
  --cv-btn-radius: 6px; --cv-btn-main-bg: #17222e; --cv-btn-main-color: #fff; --cv-btn-main-shadow: none;
  --cv-btn-ghost-bg: #f2f4f6; --cv-btn-ghost-color: #17222e; --cv-btn-ghost-shadow: inset 0 0 0 1px #dfe3e8;
  --cv-btn-save-bg: #f2f4f6; --cv-btn-save-color: #17222e; --cv-btn-save-shadow: inset 0 0 0 1px #dfe3e8;
  --cv-steps-bg: #f7f9fb; --cv-steps-color: #7d8b99; --cv-steps-shadow: none; --cv-steps-radius: 6px; --cv-steps-title: #17222e; --cv-steps-b: #17222e;
  --cv-mini-bg: #f2f4f6; --cv-mini-color: #17222e; --cv-mini-shadow: inset 0 0 0 1px #dfe3e8; --cv-mini-on-bg: #17222e; --cv-mini-on-color: #fff;
  --cv-block-title: #17222e; --cv-link-color: #17222e; --cv-foot-color: #9aa6b2; --cv-foot-b: #17222e; --cv-hint-color: #7d8b99;
  --cv-back-color: #17222e; --cv-back-bg: #fff; --cv-brand-color: #17222e;
}
/* L4 侧栏竖排：左侧竖色带 + 右对齐内容 */
.cv-tpl-sidebar {
  --cv-page-bg: #f7f3ec; --cv-ink: #2a2118; --cv-ink-2: #7d6a52; --cv-line: #eee4d6;
  --cv-card-bg: #fffdf9; --cv-card-border: 0; --cv-card-radius: 2px; --cv-card-pad: 26px 22px 20px;
  --cv-card-shadow: 0 22px 44px -32px rgba(80,55,30,.5);
  --cv-topbar-h: 0; --cv-topbar-bg: transparent;
  --cv-logo-bg: #6b4a2e; --cv-logo-radius: 50%; --cv-logo-shadow: none;
  --cv-name-size: 28px; --cv-name-weight: 600; --cv-name-spacing: .18em; --cv-name-color: #2a2118; --cv-name-font: "Noto Serif SC","Songti SC",serif;
  --cv-role-color: #7d6a52; --cv-role-size: 11px; --cv-role-spacing: .2em;
  --cv-org-color: #2a2118; --cv-org-border: 0;
  --cv-tag-bg: transparent; --cv-tag-color: #7d6a52; --cv-tag-shadow: inset 0 0 0 1px #e0d4c2; --cv-tag-radius: 0;
  --cv-btn-radius: 2px; --cv-btn-main-bg: #6b4a2e; --cv-btn-main-color: #f9f2e5; --cv-btn-main-shadow: none; --cv-btn-font: "Noto Serif SC","Songti SC",serif;
  --cv-btn-ghost-bg: transparent; --cv-btn-ghost-color: #6b4a2e; --cv-btn-ghost-shadow: inset 0 0 0 1px #d9c9b2;
  --cv-btn-save-bg: #f7f1e6; --cv-btn-save-color: #5a462f; --cv-btn-save-shadow: inset 0 0 0 1px #e3d5bf;
  --cv-steps-bg: #fbf7ee; --cv-steps-color: #8a7358; --cv-steps-shadow: inset 0 0 0 1px #eee2cf; --cv-steps-radius: 2px; --cv-steps-title: #6b4a2e; --cv-steps-b: #3b2f24;
  --cv-mini-bg: transparent; --cv-mini-color: #6b4a2e; --cv-mini-shadow: inset 0 0 0 1px #e0d4c2; --cv-mini-on-bg: #6b4a2e; --cv-mini-on-color: #f9f2e5;
  --cv-block-title: #6b4a2e; --cv-link-color: #5a462f; --cv-foot-color: #b3a08a; --cv-foot-b: #6b4a2e; --cv-hint-color: #9c8871;
  --cv-back-color: #6b4a2e; --cv-back-bg: #fff; --cv-brand-color: #2a2118;
}
.cv-clean.cv-page { font-family: var(--cv-name-font, inherit); padding-bottom: 92px; }
.cv-clean.cv-page.cv-owner { padding-top: 12px; padding-bottom: 148px; }
.cv-tpl-acid.cv-page { background-image: var(--cv-page-grid); }
/* 渐变文字（E 霓虹） */
.cv-tpl-neon .cv-name { -webkit-background-clip: text; background-clip: text; background-image: var(--cv-name-gradient); color: transparent; -webkit-text-fill-color: transparent; }
/* 彩色标签轮换（G 多巴胺） */
.cv-tpl-pop .cv-tags span:nth-child(4n+2) { background: #a0e7e5; }
.cv-tpl-pop .cv-tags span:nth-child(4n+3) { background: #ffb3c1; }
.cv-tpl-pop .cv-tags span:nth-child(4n+4) { background: #c9b8ff; }
/* ===== 结构签名：雷同的 7 套简洁模板各给一个专属骨架特征（不只是换色） ===== */
/* B 极简纸白：头像方形左置 + 姓名下的细分隔线（报纸式） */
.cv-tpl-paper .cv-profile { flex-wrap: wrap; }
.cv-tpl-paper .cv-ident { flex: 1; min-width: 0; padding-bottom: 12px; border-bottom: 1px solid #d8d3c8; }
.cv-tpl-paper .cv-tags { width: 100%; padding-top: 10px; }
/* C 墨夜玻璃：头像居中 + 姓名居中，卡片如玻璃徽章 */
.cv-tpl-glass .cv-profile { flex-direction: column; align-items: center; text-align: center; }
.cv-tpl-glass .cv-avatar { margin-bottom: 10px; }
.cv-tpl-glass .cv-tags { justify-content: center; }
/* D 暖木衬线：头像居中圆 + 上下细金线包围姓名（证书式） */
.cv-tpl-wood .cv-profile { flex-direction: column; align-items: center; text-align: center; }
.cv-tpl-wood .cv-ident { width: 100%; padding: 14px 0; border-top: 1px solid rgba(139,94,60,.4); border-bottom: 1px solid rgba(139,94,60,.4); margin-top: 12px; }
.cv-tpl-wood .cv-tags { justify-content: center; }
/* E 霓虹夜景：头像外发光圆环 + 顶条加粗霓虹 */
.cv-tpl-neon .cv-avatar { border-radius: 50%; box-shadow: 0 0 0 2px #ff4fa3, 0 0 18px rgba(255,79,163,.7); }
.cv-tpl-neon .cv-main > .cv-profile::before { height: 8px; box-shadow: 0 0 14px rgba(79,216,255,.8); }
/* F 酸性荧光：头像直角荧光块 + 卡片直角硬投影 */
.cv-tpl-acid .cv-avatar { border-radius: 0; box-shadow: 5px 5px 0 #ccff00; }
.cv-tpl-acid .cv-main > .cv-profile { box-shadow: 8px 8px 0 #ccff00; }
/* G 多巴胺：头像圆形 + 彩色描边 + 顶条多彩分段 */
.cv-tpl-pop .cv-avatar { border-radius: 50%; box-shadow: 0 0 0 3px #ff6b6b; }
.cv-tpl-pop .cv-main > .cv-profile::before { background: linear-gradient(90deg,#ffd93d,#ff6b9d,#6bcbff,#a0e7e5); }
/* H 杂志编辑：头像方形大图左置 + 顶部红条的杂志封面感 */
.cv-tpl-magazine .cv-avatar { border-radius: 0; width: 82px; height: 82px; flex-basis: 82px; }
.cv-tpl-magazine .cv-ident { border-left: 3px solid #c0392b; padding-left: 12px; }

/* ===== L1 竖版海报：无卡片通栏、公司名居中、信息两列 ===== */
.cv-tpl-poster .cv-main > .cv-profile { background: transparent; }
.cv-tpl-poster .cv-profile { flex-direction: column; align-items: flex-start; gap: 0; }
.cv-tpl-poster .cv-avatar { display: none; }
.cv-tpl-poster .cv-org { text-align: center; letter-spacing: .28em; font-size: 11px; font-weight: 400; padding-bottom: 16px; }
.cv-tpl-poster .cv-title { margin-top: 10px; }
.cv-tpl-poster .cv-block { padding-left: 0; padding-right: 0; }
.cv-tpl-poster .cv-contact-row { flex-direction: column; align-items: flex-start; gap: 4px; }
.cv-tpl-poster .cv-contact-label { flex-basis: auto; letter-spacing: .2em; }
.cv-tpl-poster .cv-block:has(.cv-contact-row) { display: grid; grid-template-columns: 1fr 1fr; gap: 0 18px; }
.cv-tpl-poster .cv-footer b { display: none; }
/* ===== L2 票据存根：锯齿纸边（mask）+ 虚线分隔 ===== */
.cv-tpl-ticket .cv-main > .cv-profile {
  --notch: 10px;
  -webkit-mask: radial-gradient(circle at 0 0,transparent var(--notch),#000 calc(var(--notch) + .5px)) 0 0/26px 26px repeat-x, linear-gradient(#000,#000);
  mask: radial-gradient(circle at 0 0,transparent var(--notch),#000 calc(var(--notch) + .5px)) 0 0/26px 26px repeat-x, linear-gradient(#000,#000);
}
.cv-tpl-ticket .cv-org { border-top: 1px dashed #c9c9c9; border-bottom: 1px dashed #c9c9c9; padding: 10px 0; }
.cv-tpl-ticket .cv-contact-row { border-top: 1px dashed #dedbd3; border-bottom: 0; }
.cv-tpl-ticket .cv-contact-value, .cv-tpl-ticket .cv-name { font-family: ui-monospace,Menlo,"Noto Sans SC",monospace; }
.cv-tpl-ticket .cv-footer { border-top: 2px solid #232323; }
/* ===== L3 横版名片：右侧深色色块（省去按钮文字换行，按钮单列紧凑） ===== */
.cv-tpl-horizontal .cv-main > .cv-profile::after {
  content: ''; right: 0; top: 0; bottom: 0; width: 52px; height: auto;
  background: linear-gradient(180deg,#17222e,#0f1822); opacity: 1; border-radius: 0 10px 0 0;
}
.cv-tpl-horizontal .cv-profile { padding-right: 72px; }

/* ===== L4 侧栏竖排：左侧竖色带 + 内容右对齐 ===== */
.cv-tpl-sidebar .cv-main > .cv-profile { padding-left: 72px; }
.cv-tpl-sidebar .cv-main > .cv-profile::after {
  content: 'M C A R D'; left: 0; right: auto; top: 0; bottom: 0; width: 52px; height: auto;
  writing-mode: vertical-rl; letter-spacing: .32em; font-size: 11px; font-weight: 400;
  color: #f7f3ec; background: #2a2118; opacity: 1; border-radius: 2px 0 0 0;
  display: flex; align-items: center; justify-content: center; padding: 20px 0; box-sizing: border-box;
}
.cv-tpl-sidebar .cv-profile { flex-direction: row-reverse; text-align: right; }
.cv-tpl-sidebar .cv-ident { text-align: right; }
.cv-tpl-sidebar .cv-tags { justify-content: flex-end; }
.cv-tpl-sidebar .cv-org { display: none; }
.cv-tpl-sidebar .cv-contact-row { flex-direction: row-reverse; }
.cv-tpl-sidebar .cv-contact-label { text-align: right; }
.cv-tpl-sidebar .cv-contact-value, .cv-tpl-sidebar .cv-block { text-align: right; }
/* 无封面模板：封面高度为 0，必须放开 overflow，否则 absolute 的返回键/品牌字被裁掉（截图实锤「没有返回的地方」） */
.cv-clean .cv-cover { height: 0; border-radius: 0; background: transparent; overflow: visible; }
.cv-clean .cv-back { top: calc(10px + var(--safe-top)); left: 14px; color: var(--cv-back-color); background: var(--cv-back-bg); border-color: rgba(var(--glow-rgb, 255,255,255), .34); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); }
.cv-clean .cv-brand { top: calc(18px + var(--safe-top)); color: var(--cv-brand-color); }
.cv-clean .cv-main { max-width: 430px; margin: 30px auto 0; }
.cv-clean .cv-main > .card, .cv-clean .cv-main > .cv-profile { border-radius: 0; border: 0; box-shadow: none; background: transparent; margin-top: 0; }
.cv-clean .cv-main > .cv-profile {
  border-radius: var(--cv-card-radius) var(--cv-card-radius) 0 0; padding: var(--cv-card-pad);
  background: var(--cv-card-bg); border: var(--cv-card-border); backdrop-filter: var(--cv-card-blur);
  box-shadow: var(--cv-card-shadow); position: relative; overflow: hidden;
}
.cv-clean .cv-main > .cv-profile::before {
  content: ''; position: absolute; left: var(--cv-topbar-x); right: var(--cv-topbar-x); top: 0; height: var(--cv-topbar-h);
  background: var(--cv-topbar-bg);
}
.cv-clean .cv-main > .cv-profile::after {
  content: attr(data-wm); position: absolute; right: 10px; bottom: -6px;
  font-size: 34px; font-weight: 800; color: var(--cv-wm-color); opacity: calc(var(--cv-wm-opacity, .04) * .7);
  letter-spacing: -1px; line-height: 1; pointer-events: none; max-width: 60%; overflow: hidden; white-space: nowrap; text-overflow: clip;
}
.cv-clean .cv-profile > * { position: relative; z-index: 2; }
/* ===== 名片卡光效：照 MShop 个人中心 .mh 定稿参数（26s / 呼吸不位移 / 光带亮度 .05）=====
   微颗粒 + 极细缎纹 + 大尺度光影做静态质感；柔光只 opacity 呼吸，斜光带扫完淡出停半程。
   色相用主题强调色代替纯白，浅色名片上也能隐约看见；四边定位替 inset 兼容老 WebView。 */
.cv-sheen { position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 1; pointer-events: none; overflow: hidden; border-radius: inherit; background-image: radial-gradient(rgba(255,255,255,.055) .8px, transparent 1.1px), radial-gradient(rgba(255,255,255,.03) .7px, transparent 1px), repeating-linear-gradient(115deg, rgba(var(--glow-rgb, 37,99,235), .02) 0 1px, transparent 1px 4px), radial-gradient(160% 120% at 20% 0%, rgba(255,255,255,.12) 0%, transparent 52%), radial-gradient(130% 110% at 85% 95%, rgba(0,0,0,.09) 0%, transparent 55%); background-size: .4em .4em, .4em .4em, auto, auto, auto; background-position: 0 0, .2em .2em, 0 0, center, center; background-repeat: repeat, repeat, no-repeat, no-repeat, no-repeat; }
.cv-sheen::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background: radial-gradient(140% 110% at 28% 12%, rgba(255,255,255,.10) 0%, rgba(255,255,255,.03) 42%, transparent 68%);
  animation: cvGlowBreath 26s ease-in-out infinite alternate;
}
.cv-sheen::after {
  content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(105deg, transparent 42%, rgba(var(--glow-rgb, 37,99,235), .05) 50%, transparent 58%);
  transform: translateX(-130%);
  animation: cvSheenSweep 26s ease-in-out infinite;
}
@keyframes cvGlowBreath { 0% { opacity: .45; } 100% { opacity: 1; } }
@keyframes cvSheenSweep {
  0% { transform: translateX(-130%); opacity: 0; }
  20% { opacity: 1; }
  46% { transform: translateX(130%); opacity: 1; }
  60% { opacity: 0; }
  100% { transform: translateX(130%); opacity: 0; }
}
/* 尊重系统「减少动画」：静态显示一层柔光，不闪不动 */
@media (prefers-reduced-motion: reduce) {
  .cv-sheen::before { animation: none; opacity: .7; }
  .cv-sheen::after { display: none; }
}
/* 顶缘 1px 内高光保留在卡面本身；微颗粒/细缎纹/大尺度光影统一由 .cv-sheen 承担，避免两层纹理叠加显脏 */
.cv-clean .cv-main > .cv-profile { background-image: linear-gradient(180deg, rgba(255,255,255,.5), rgba(255,255,255,0) 32%); }
.cv-clean .cv-avatar { width: 64px; height: 64px; flex: 0 0 64px; border-radius: var(--cv-logo-radius); font-size: 26px; color: var(--cv-btn-main-color); background: var(--cv-logo-bg-solid, #1d3a55); background: var(--cv-logo-bg); box-shadow: var(--cv-logo-shadow); }
.cv-clean .cv-name { color: var(--cv-name-color); font-size: var(--cv-name-size); font-weight: var(--cv-name-weight); letter-spacing: var(--cv-name-spacing); font-family: var(--cv-name-font); }
.cv-clean .cv-en { color: var(--cv-ink-2); }
.cv-clean .cv-title { color: var(--cv-role-color); font-size: var(--cv-role-size); letter-spacing: var(--cv-role-spacing); font-weight: 400; }
.cv-clean .cv-tags span { border-radius: var(--cv-tag-radius); background: var(--cv-tag-bg); color: var(--cv-tag-color); box-shadow: var(--cv-tag-shadow); }
.cv-clean .cv-status { right: 14px; bottom: 6px; }
/* ⚠️ 特异性必须 ≥ L1216 的 `.cv-clean .cv-main > .card {background:transparent}`，
   否则简洁模板（尤其深底 contact/neon/acid）的内容卡变透明、号码/简介深色字融进深底看不见（2026-11-25 实修） */
.cv-clean .cv-main > .cv-block, .cv-clean .cv-block { padding: 14px var(--cv-card-x); background: var(--cv-panel-bg); margin-top: 0; }
.cv-clean .cv-block h3, .cv-clean .cv-sec-title { font-size: 12px; letter-spacing: .1em; color: var(--cv-block-title); border-left: 0; padding-left: 0; }
.cv-clean .cv-block h3 .small.muted { letter-spacing: 0; }
.cv-clean .cv-contact-row { padding: 11px 0; border-top: 1px solid var(--cv-line); }
.cv-clean .cv-contact-label { flex-basis: 52px; color: var(--cv-ink-2); letter-spacing: .08em; }
/* 简洁模板是固定配色（不跟主题），号码值取自己的 --cv-ink；主题色 --t-text 可能与深色卡相反 */
.cv-clean .cv-contact-value { color: var(--cv-ink); font-weight: 600; }
.cv-clean .cv-bio, .cv-clean .small.muted { color: var(--cv-ink-2); }
.cv-clean .cv-links a, .cv-clean .cv-gallery-cell { border-color: var(--cv-line); background: var(--cv-panel-bg); }
.cv-clean .cv-links b, .cv-clean .cv-region-line, .cv-clean .cv-contact-row b { color: var(--cv-link-color); }
.cv-clean .cv-map-launch, .cv-clean .cv-maps a { background: var(--cv-mini-bg); color: var(--cv-mini-color); box-shadow: var(--cv-mini-shadow); }
/* 主页与店铺「打开/复制」、联系方式行内按钮：跟模板配色，不再用全局蓝渐变/灰描边。
   ⚠️ 每条 background 前先写同色纯色兜底：微信老 WebView 解析不了渐变里的 var / color-mix，
   整条 background 失效会露白底，配合白字就「文字消失」（2026-11-25 打电话/开网址返回后实锤）。 */
.cv-clean .cv-site .btn { border-radius: var(--cv-btn-radius, 8px); font-size: 12px; padding: 7px 12px; }
.cv-clean .cv-site .btn-primary { background: var(--cv-btn-main-solid, var(--t-accent, #2563eb)); background: var(--cv-btn-main-bg, var(--t-accent)); color: var(--cv-btn-main-color, #fff); box-shadow: var(--cv-btn-main-shadow, none); border-color: transparent; }
.cv-clean .cv-site .btn-ghost { background: var(--cv-btn-ghost-bg, transparent); color: var(--cv-btn-ghost-color, var(--cv-ink)); box-shadow: var(--cv-btn-ghost-shadow, inset 0 0 0 1px var(--cv-line)); border-color: transparent; }
.cv-clean .cv-row-act { background: var(--cv-mini-bg); color: var(--cv-mini-color); box-shadow: var(--cv-mini-shadow); border-radius: var(--cv-btn-radius, 7px); }
/* 简洁模板底部 dock（/me 与公开页共用同一套）：跟模板配色，拉开主/次层次，不再通用深灰+主题绿 */
.cv-clean .cv-dock { gap: 7px; padding: 10px 10px calc(10px + env(safe-area-inset-bottom)); background: var(--cv-panel-bg); border-top: 1px solid var(--cv-line); color: var(--cv-ink); }
.cv-clean .cv-dock .btn { border-radius: var(--cv-btn-radius, 8px); font-weight: 700; }
.cv-clean .cv-dock .btn-primary { background: var(--cv-btn-main-solid, var(--t-accent, #2563eb)); background: var(--cv-btn-main-bg, var(--t-accent)); color: var(--cv-btn-main-color, #fff); box-shadow: var(--cv-btn-main-shadow, none); border-color: transparent; }
/* ghost 用模板主色的极淡底 + 描边，比纯透明底有层次；color-mix 前先给纯透明兜底，避免老 WebView 解析失败露白底 */
.cv-clean .cv-dock .btn-ghost { background: transparent; background: color-mix(in srgb, var(--cv-btn-ghost-color, var(--cv-ink)) 10%, var(--cv-panel-bg)); color: var(--cv-btn-ghost-color, var(--cv-ink)); box-shadow: var(--cv-btn-ghost-shadow, inset 0 0 0 1px var(--cv-line)); border-color: transparent; }
.cv-clean .cv-create-own { border-top: 1px solid var(--cv-line); }
.cv-clean .cv-create-copy b { color: var(--cv-link-color); }
.cv-clean .cv-footer { background: var(--cv-panel-bg); border-radius: 0 0 var(--cv-card-radius) var(--cv-card-radius); padding: 16px var(--cv-card-x) 20px; color: var(--cv-foot-color); letter-spacing: .1em; }
.cv-clean .cv-footer b { color: var(--cv-foot-b); }
.guide-lead { margin: 4px 0 10px; }
.guide-steps { background: var(--t-bg, #f6f8fb); border-radius: 10px; padding: 12px 14px; }
.guide-steps-t { font-size: 12px; font-weight: 700; color: var(--t-accent, #2563eb); margin-bottom: 6px; }
.guide-steps ol { margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.85; color: var(--t-text, #0f172a); }
.guide-steps li + li { margin-top: 4px; }

/* ============ 深蓝鎏金 navygold：参考名片配色与结构（放在最后覆盖通用商务风）============ */
.cv-tpl-navygold { color: var(--ng-ink); background: var(--ng-page-bg); }
.cv-tpl-navygold .cv-cover { border-radius: 0 0 22px 22px; background: #1d3a55; background: linear-gradient(135deg, #1d3a55 0%, #0c1a26 100%); }
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
  content: attr(data-wm); position: absolute; right: 10px; bottom: -4px;
  font-size: 32px; font-weight: 800; color: var(--ng-ink); opacity: .028;
  letter-spacing: -1px; line-height: 1; pointer-events: none; max-width: 60%; overflow: hidden; white-space: nowrap;
}
.cv-tpl-navygold .cv-profile > * { position: relative; z-index: 2; }
.cv-tpl-navygold .cv-avatar {
  width: 64px; height: 64px; flex: 0 0 64px; border-radius: 14px; font-size: 26px; color: #fff;
  background: #1d3a55; background: linear-gradient(145deg, #1d3a55, #0e2233);
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
  background: #1d3a55; background: linear-gradient(135deg, #1d3a55, #0f2739); color: #fff;
  box-shadow: 0 10px 22px -12px rgba(18,32,46,.85);
}
.cv-tpl-navygold .cv-actions button:last-child:nth-child(odd) { grid-column: 1 / -1; }
.cv-tpl-navygold .cv-actions i { width: auto; height: auto; border-radius: 0; background: transparent; color: inherit; font-size: 17px; }
/* 深蓝底上的内容块必须白底深字，否则号码/邮箱等文字看不清 */
.cv-tpl-navygold .cv-main > .card, .cv-tpl-navygold .cv-block {
  background: #fff; border: 1px solid var(--ng-line);
}
.cv-tpl-navygold .cv-contact-value { color: var(--ng-ink); font-weight: 700; }
.cv-tpl-navygold .cv-contact-label, .cv-tpl-navygold .small.muted { color: var(--ng-ink-2); }
.cv-tpl-navygold .cv-block h3, .cv-tpl-navygold .cv-sec-title { color: var(--ng-navy); border-left: 3px solid var(--ng-gold); padding-left: 9px; }
.cv-tpl-navygold .cv-bio, .cv-tpl-navygold .small.muted { color: var(--ng-ink-2); }
.cv-tpl-navygold .cv-links a { border-color: var(--ng-line); background: #fff; }
.cv-tpl-navygold .cv-links b { color: var(--ng-navy); }
.cv-tpl-navygold .cv-maps a { background: var(--ng-paper); color: var(--ng-navy); box-shadow: inset 0 0 0 1px rgba(185,147,85,.28); }
.cv-tpl-navygold .cv-footer { color: #a9b1ba; letter-spacing: .1em; }
.cv-tpl-navygold .cv-footer b { color: var(--ng-gold); }
.cv-tpl-navygold .cv-dock { background: rgba(18,32,46,.96); border-top: 2px solid var(--ng-gold); }
.cv-tpl-navygold .cv-dock .btn-primary { background: #a8834a; background: linear-gradient(135deg, #c9a163, #a8834a); color: #fff; box-shadow: 0 12px 24px -14px rgba(169,131,74,.9); }
.cv-tpl-navygold .cv-dock .btn-ghost { background: rgba(255,255,255,.12); color: #fff; border-color: rgba(216,187,133,.35); }
/* 正文「主页与店铺」按钮同样走深蓝鎏金配色：纯色兜底 + 字面量渐变，不用全局蓝（深蓝页上刺眼且老 WebView 会解析失败露白底） */
.cv-tpl-navygold .cv-site .btn-primary { background: #1d3a55; background: linear-gradient(135deg, #1d3a55, #0f2739); color: #fff; border-color: transparent; }
.cv-tpl-navygold .cv-site .btn-ghost { background: #f4f1ea; color: #1d3a55; border-color: transparent; }
</style>
