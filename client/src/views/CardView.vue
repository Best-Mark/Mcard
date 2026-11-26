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
      <CardSheet
        :card="card" :tags="card.tags || []" :materials="materialsList" :site-name="siteConfig.site_name"
        :qr-url="full ? (qrApi + '/qr.png?size=200&scan=1&v=' + qrStamp) : ''"
        :full="full" :interactive="full && !embed" :show-edit="!!owner"
        @edit="router.push('/me/card')" @qr="qrModal = true"
        @copy="copy" @tel="tel" @sms="sms" @mailto="mailto"
        @open-gallery="openGallery" @open-material="openMaterial" @map="openMapSheet"
      >
        <template #after-profile>
          <div v-if="full && !card.active" class="card card-pad notice-card">
            <b>这张名片尚未开通或已到期</b>
            <p class="small muted">联系持有者开通后，二维码仍会指向这里，无需更换。</p>
          </div>
          <div v-if="full && isOwner && !card.active" class="btn-row" style="margin:12px 0">
            <router-link to="/me/plans" class="btn btn-primary">立即开通</router-link>
          </div>
        </template>
        <template #after-address>
          <div v-if="showCreateOwn" class="card card-pad cv-create-own">
            <div class="cv-create-copy">
              <b>也想拥有这样一张名片？</b>
              <p class="small muted">二维码终身不变、资料随时改，免费创建</p>
            </div>
            <router-link :to="auth.token ? '/me/card' : '/login?redirect=/me/card'" class="btn btn-primary">免费创建我的名片 →</router-link>
          </div>
        </template>
      </CardSheet>
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
      <!-- dock 三态翻转（2026-11-26 用户终稿，与小程序 me 页完全一致）：main=编辑/配色/二维码；
           点「配色」整行翻转成模板缩略行（H5 同款 template-thumbs 缩略，点中即换、页面实时预览、可连着试）；
           点「二维码」翻转成二维码风格预设调节行（改的是二维码本身，不是弹码；弹码走身份卡小码）；
           行首 ✕ 收起。公开页 dock 不变：打电话 / 复制号码 / 存入通讯录 / 分享 -->
      <div v-if="full && owner" :class="['cv-dock cv-dock-glass', { 'cv-dock-flip': dockMode !== 'main' }]">
        <template v-if="dockMode === 'main'">
          <button class="btn btn-primary dock-btn" @click="router.push('/me/card')"><span class="dock-ico">✎</span>编辑</button>
          <button class="btn btn-ghost dock-btn" @click="toggleDock('tpl')"><span class="dock-ico">▦</span>配色</button>
          <button class="btn btn-ghost dock-btn" @click="toggleDock('qr')"><span class="dock-ico">▣</span>二维码</button>
        </template>
        <!-- 模板行：左右滑动点中即应用整套配色并保存，页面即实时预览 -->
        <template v-else-if="dockMode === 'tpl'">
          <button class="dock-back" @click="dockMode = 'main'">&lt;</button>
          <div class="dock-scroll">
            <div class="dock-flow">
              <button v-for="t in tpls" :key="t.key" :class="['dock-tpl', { on: card.template === t.key, busy: tplBusy }]" @click="chooseTpl(t)">
                <span class="tpl-thumb" :class="'thumb-' + t.key"><i class="tpl-ava"></i></span>
                <span class="dock-tpl-label">{{ t.label }}</span>
              </button>
            </div>
            <div v-if="!tpls.length" class="dock-tpl-loading">模板清单加载中…</div>
          </div>
        </template>
        <!-- 二维码调节行：一键风格预设（码点/定位角/渐变，与配色风格页同款 4 个），点中即保存实时生效 -->
        <template v-else>
          <button class="dock-back" @click="dockMode = 'main'">&lt;</button>
          <div class="dock-scroll">
            <div class="dock-flow">
              <button v-for="p in QR_PRESETS" :key="p.key" :class="['dock-tpl', { on: qrPresetActive(p), busy: qrBusy }]" @click="applyQrPreset(p)">
                <span class="qr-swatch" :style="{ background: p.swatch }"></span>
                <span class="dock-tpl-label">{{ p.label }}</span>
              </button>
            </div>
          </div>
        </template>
      </div>
      <div v-else-if="full" class="cv-dock cv-dock-glass">
        <button class="btn btn-primary dock-btn" :disabled="!contactPhone" @click="tel(contactPhone)"><span class="dock-ico dock-ico-phone"></span>打电话</button>
        <button class="btn btn-ghost dock-btn" :disabled="!contactPhone" @click="copy(contactPhone, '号码')"><span class="dock-ico">⧉</span>复制号码</button>
        <a v-if="contactNative" class="btn btn-ghost dock-btn" :title="contactActionTip" :aria-label="contactActionLabel" :href="contactHref"><span class="dock-ico">◉</span>存入通讯录</a>
        <button v-else class="btn btn-ghost dock-btn" :title="contactActionTip" :aria-label="contactActionLabel" @click="saveContact"><span class="dock-ico">◉</span>存入通讯录</button>
        <button class="btn btn-ghost dock-btn" @click="doShare"><span class="dock-ico">↗</span>分享</button>
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

    <!-- 名片二维码双码弹层（2026-11-26 用户定稿：两个都要）：联系人码=vCard 瘦身版（只放主流字段，
         扫一扫直接弹「添加到通讯录」）；名片链接码=地址短链（扫了打开名片页）。默认联系人码。
         一律 PNG（微信「识别图中二维码」不认 SVG），链接仅作文案可复制 -->
    <div v-if="qrModal" class="modal-mask" @click.self="qrModal = false">
      <div class="modal center">
        <h3>我的名片</h3>
        <div class="qr-mode-tabs">
          <button :class="['qr-mode-tab', { on: qrMode === 'vcard' }]" @click="qrMode = 'vcard'">联系人码</button>
          <button :class="['qr-mode-tab', { on: qrMode === 'link' }]" @click="qrMode = 'link'">名片链接码</button>
        </div>
        <img :src="scanQrUrl(slug, qrMode === 'vcard' ? 'vcard.png' : 'qr.png', 640) + '&v=' + qrStamp" style="width:264px;height:264px;margin:4px auto 10px;display:block" :alt="qrMode === 'vcard' ? '名片联系人二维码' : '名片地址二维码'" />
        <p class="small muted center">{{ qrMode === 'vcard' ? '手机相机/微信扫一扫，直接把名片存入通讯录（已瘦身只含主流字段，保证可扫）' : '扫一扫打开名片页，名片里的资料随时更新、链接永久不变' }}</p>
        <!-- 一个入口承载三件事：存联系人的码/打开名片的码、复制链接、公开页（关闭弹层即当前公开页） -->
        <div class="btn-row" style="justify-content:center;margin-top:14px;flex-wrap:wrap">
          <button class="btn btn-primary" @click="copy(publicLink, '名片链接')">复制名片链接</button>
          <button class="btn btn-ghost" @click="saveQr">保存二维码</button>
          <button class="btn btn-ghost" @click="qrModal = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 全屏看图：左右滑动切换、下滑关闭、双击缩放、底部缩略图条；操作全在这一层，不铺在名片内容区 -->
    <div v-if="galleryIndex >= 0" class="gallery-fullscreen" role="dialog" aria-label="相册大图浏览">
      <div class="gf-top">
        <button class="gf-back" aria-label="返回名片" @click="closeGallery">‹ 返回</button>
        <span class="gf-count">{{ galleryIndex + 1 }} / {{ imageMaterials.length }}</span>
        <span class="gf-title">{{ imageMaterials[galleryIndex]?.title || '相册' }}</span>
        <button class="gf-save" type="button" @click="saveGalleryImage">保存</button>
      </div>
      <div class="gf-stage" @touchstart.passive="onGfTouchStart" @touchend.passive="onGfTouchEnd" @click.self="closeGallery">
        <img
          v-if="!gfFailed"
          :key="gfRetryKey + '-' + galleryIndex"
          :class="{ 'is-zoomed': gfZoom }"
          :src="fullUrl(imageMaterials[galleryIndex]?.url)"
          :alt="imageMaterials[galleryIndex]?.title"
          @error="gfFailed = true"
        />
        <div v-else class="gf-error">
          <span>图片加载失败</span>
          <button type="button" @click="retryGalleryImage">重试</button>
        </div>
      </div>
      <div v-if="imageMaterials.length > 1" ref="gfThumbs" class="gf-thumbs">
        <button
          v-for="(m, i) in imageMaterials" :key="m.id || (m.url + '-' + i)"
          class="gf-thumb" :class="{ on: i === galleryIndex }"
          type="button" :data-idx="i" :aria-label="'查看第 ' + (i + 1) + ' 张'"
          @click="jumpGallery(i)"
        >
          <img :src="fullUrl(m.url)" :alt="m.title || ('第 ' + (i + 1) + ' 张')" loading="lazy" />
        </button>
      </div>
      <div class="gf-nav">
        <button :disabled="galleryIndex <= 0" @click="stepGallery(-1)">‹ 上一张</button>
        <span class="gf-hint">左右滑动切换 · 双击缩放 · 下滑关闭</span>
        <button :disabled="galleryIndex >= imageMaterials.length - 1" @click="stepGallery(1)">下一张 ›</button>
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
        <img v-if="guide !== 'contact'" :src="guideImage || scanQrUrl(slug, 'vcard.png', 520)" style="width:200px;height:200px;margin:10px auto;object-fit:contain" alt="二维码" />
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
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
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
import { THEMES, TEMPLATE_PALETTES, themeOf, themeVars } from '../utils/themes'
import { isWeChat, isIOS, saveImageUrl, prepareExternalOpen, openVcfInline, androidContactIntent, deviceEnv, SAVE_IMAGE_TIPS } from '../utils/save-image'
import { shareOrCopy, mapLinks } from '../utils/share'
import { setCardShare } from '../utils/wx-share'
import { scanQrUrl } from '../utils/qr'
// dock 翻转行的模板缩略（与配色风格页/编辑页同一份唯一真相源）
import '../styles/template-thumbs.css'
import { getCachedPosition } from '../utils/geo'
import BottomSheet from '../components/BottomSheet.vue'
import CardSheet from '../components/CardSheet.vue'

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
// 二维码分工（2026-11-26 用户定稿）：弹层大码/保存码 = vCard 联系人码（扫一扫直接存通讯录，
// 服务端 scanOptions 硬化保证可扫）；身份卡右上角小装饰码仍用地址短链（尺寸小，vCard 太密难扫），
// 打开名片由分享链接点击承担，不需要二维码。此前的「vCard 太密不用」结论仅针对小尺寸场景。
const card = ref(null); const loading = ref(true); const error = ref('')

// dock 三态翻转（owner「配色」/「二维码」键，与小程序 me 页终稿完全一致）：
// main（编辑/配色/二维码）→ tpl（模板缩略行）/ qr（二维码风格预设行），✕ 收起。
// 模板清单来自公开接口（与 CardStyle/CardEdit 同源，缓存一次）；
// 点中即 PUT /api/cards/mine 应用整套配色（与 CardStyle done 同口径），card 就地合并 → 页面实时预览；
// 条保持打开可连续切换对比。未开通由服务端套餐闸门拦（403 → toast）。
const dockMode = ref('main')
const tpls = ref([]); const tplBusy = ref(false)
let tplsLoaded = false
function toggleDock(m) {
  dockMode.value = dockMode.value === m ? 'main' : m
  if (dockMode.value === 'tpl' && !tplsLoaded) {
    api.get(`/api/cards/public/templates?t=${Date.now()}`).then(({ data }) => {
      const list = data?.data?.templates || []
      if (list.length) { tpls.value = list; tplsLoaded = true }
    }).catch(() => { /* 清单拉取失败静默，行内显示「加载中」可收起再开重试 */ })
  }
}
async function chooseTpl(t) {
  if (tplBusy.value || !card.value || card.value.template === t.key) return
  const pal = TEMPLATE_PALETTES[t.key] || { theme: 'ocean', qrFg: '#0f172a', qrBg: '#ffffff' }
  const patch = {
    template: t.key,
    theme: pal.theme,
    accent: (THEMES[pal.theme] || THEMES.ocean).accent,
    qr_fg: pal.qrFg,
    qr_bg: pal.qrBg
  }
  tplBusy.value = true
  try {
    await api.put('/api/cards/mine', patch)
    // 不弹成功 toast：名片本体实时变化 + 缩略高亮即是反馈，弹层反而挡行打断「连着试」（2026-11-26 用户定）
    card.value = { ...card.value, ...patch }
    // ⚠️ 名片本体的模板类名/主题色变量由独立 ref 派生（load() 时赋值，根类名 cv-tpl-{template}、vars 走 currentTheme）：
    // 必须与 card 合并同步更新，否则只有缩略高亮变、上面名片不跟着换（2026-11-26 用户截图实锤）。
    currentTheme.value = THEMES[patch.theme] ? patch.theme : 'ocean'
    template.value = patch.template || 'contact'
    // 整套配色含二维码前景/背景色（服务端渲染）：击穿二维码图缓存让新色立刻可见
    qrStamp.value = Date.now()
  } catch (e) { showToast(e.message, 'error') } finally { tplBusy.value = false }
}
// 二维码风格预设（dock「二维码」键翻转出的调节行，与配色风格页同款 4 个）：
// 改码点/定位角/渐变组合，点中即保存实时生效；更细的前景/背景色、背景图等微调在配色风格页
const QR_PRESETS = [
  { key: 'classic', label: '经典', swatch: '#0f172a', dot: 'square', eye: 'square', gradTo: '' },
  { key: 'dots', label: '圆点', swatch: '#2563eb', dot: 'dots', eye: 'rounded', gradTo: '' },
  { key: 'tech', label: '科技渐变', swatch: 'linear-gradient(135deg,#2563eb,#06b6d4)', dot: 'rounded', eye: 'rounded', gradTo: '#06b6d4' },
  { key: 'elegant', label: '典雅', swatch: '#b45309', dot: 'rounded', eye: 'circle', gradTo: '' }
]
const qrBusy = ref(false)
// 二维码图 URL 缓存击穿：qr_style 等由服务端渲染，固定 URL 会被 CDN/浏览器缓存 60s，
// 预设点中后必须换 query 才能立刻看到新码（2026-11-26）
const qrStamp = ref(0)
function qrPresetActive(p) {
  const s = card.value?.qr_style || {}
  return s.dot === p.dot && s.eye === p.eye && (s.gradTo || '') === p.gradTo
}
async function applyQrPreset(p) {
  if (qrBusy.value) return
  const qr_style = { ...(card.value?.qr_style || {}), dot: p.dot, eye: p.eye, gradTo: p.gradTo }
  qrBusy.value = true
  try {
    await api.put('/api/cards/mine', { qr_style })
    // 同模板切换：选中高亮 + 二维码实时刷新即反馈，不弹成功 toast
    card.value = { ...card.value, qr_style }
    qrStamp.value = Date.now()
  } catch (e) { showToast(e.message, 'error') } finally { qrBusy.value = false }
}
const currentTheme = ref('ocean'); const isOwner = ref(false)
const template = ref('contact')
// 18 套模板统一同一套「连续大卡」骨架（2026-11-25 用户定稿）：模板切换只换 --cv-* 配色，不再有结构差异。
// 旧版 6 套（classic/minimal/elite/vivid/seal/navygold）原先是分开的多张卡，现在也走 cv-clean 骨架，
// 配色在样式表末尾「全模板统一层」里给出；原模板专属结构规则被该统一层按特异性覆盖，不逐条删除以便回滚。
const isCleanTpl = computed(() => true)
const qrModal = ref(false); const qrMode = ref('vcard'); const guide = ref(''); const guideImage = ref(''); const exchangeOpen = ref(false)
const contactFallbackOpen = ref(false) // 安卓 intent 拉不起通讯录时的兜底：复制基本信息卡片（全程不下载）
const mapOpen = ref(false); const moreOpen = ref(false)
const mySlug = ref(''); const exchanging = ref(false)
const favorite = ref(false); const favBusy = ref(false)
const materialsList = ref([])
const galleryIndex = ref(-1)
const imageMaterials = computed(() => materialsList.value.filter(m => isImageMaterial(m)))
// 链接/资源 URL 归一：CardSheet 展示时已处理，这里供全屏看图与资料直开使用
function safeUrl(u) {
  if (!u) return '#'
  const s = String(u).trim()
  const full = /^https?:\/\//i.test(s) ? s : `https://${s}`
  try { const x = new URL(full); return ['http:', 'https:'].includes(x.protocol) ? x.href : '#' } catch { return '#' }
}
const fullUrl = u => (u ? new URL(u, window.location.origin).href : '')
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

// 看图操作层：手势/按钮/键盘三条入口共用同一组状态，切换时统一复位（加载失败、缩放、双击计时）。
const gfZoom = ref(false)
const gfFailed = ref(false)
const gfRetryKey = ref(0)
const gfThumbs = ref(null)
let gfTouch = null
let gfLastTap = 0
let gfKeyHandler = null
function closeGallery() { galleryIndex.value = -1 }
function stepGallery(step) {
  const next = galleryIndex.value + step
  if (next < 0 || next >= imageMaterials.value.length) return
  galleryIndex.value = next
}
function jumpGallery(i) {
  if (i >= 0 && i < imageMaterials.value.length) galleryIndex.value = i
}
function retryGalleryImage() { gfFailed.value = false; gfRetryKey.value++ }
async function saveGalleryImage() {
  const m = imageMaterials.value[galleryIndex.value]
  if (!m) return
  const r = await saveImageUrl(fullUrl(m.url), `相册-${galleryIndex.value + 1}`)
  if (r?.kind === 'downloaded') showToast('已开始下载', 'success')
  else if (r?.kind === 'longpress') showToast(isWeChat() ? '长按图片保存到手机' : '长按图片保存', 'success')
  else showToast('已在新窗口打开，长按可保存', 'success')
}
function onGfTouchStart(e) {
  const pt = e.touches?.[0]
  if (!pt) return
  gfTouch = { x: pt.clientX, y: pt.clientY, at: Date.now() }
}
function onGfTouchEnd(e) {
  if (!gfTouch) return
  const pt = e.changedTouches?.[0]
  if (!pt) { gfTouch = null; return }
  const dx = pt.clientX - gfTouch.x
  const dy = pt.clientY - gfTouch.y
  const quick = Date.now() - gfTouch.at < 400
  gfTouch = null
  // 轻点：300ms 内第二次即双击缩放；单击只记录时间，不误触关闭
  if (Math.abs(dx) < 14 && Math.abs(dy) < 14) {
    if (quick && Date.now() - gfLastTap < 320) { gfLastTap = 0; gfZoom.value = !gfZoom.value }
    else gfLastTap = Date.now()
    return
  }
  if (gfZoom.value) return
  if (Math.abs(dy) > 90 && Math.abs(dy) > Math.abs(dx) * 1.2) { closeGallery(); return }
  if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.2) stepGallery(dx < 0 ? 1 : -1)
}
function preloadNeighbors() {
  const i = galleryIndex.value
  for (const n of [i - 1, i + 1]) {
    const u = imageMaterials.value[n]?.url
    if (u) { const img = new Image(); img.src = fullUrl(u) }
  }
}
function centerGalleryThumb() {
  const el = gfThumbs.value?.querySelector(`[data-idx="${galleryIndex.value}"]`)
  if (!el || !el.scrollIntoView) return
  try { el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }) }
  catch { el.scrollIntoView() }
}
function onGalleryKey(e) {
  if (e.key === 'Escape') closeGallery()
  else if (e.key === 'ArrowLeft') stepGallery(-1)
  else if (e.key === 'ArrowRight') stepGallery(1)
}
watch(galleryIndex, v => {
  gfZoom.value = false
  gfFailed.value = false
  gfLastTap = 0
  gfTouch = null
  if (v >= 0) {
    preloadNeighbors()
    nextTick(centerGalleryThumb)
    if (!gfKeyHandler) { gfKeyHandler = onGalleryKey; window.addEventListener('keydown', gfKeyHandler) }
  } else if (gfKeyHandler) {
    window.removeEventListener('keydown', gfKeyHandler)
    gfKeyHandler = null
  }
})
onBeforeUnmount(() => {
  if (gfKeyHandler) window.removeEventListener('keydown', gfKeyHandler)
})

const t = computed(() => themeOf({ theme: currentTheme.value, accent: card.value?.accent }))
// 动态光效用主题强调色而非写死白色：把 #rrggbb 转 rgb 分量，CSS 里 rgba(var(--glow-rgb), .x)
function hexToRgb(hex) {
  const h = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''))
  if (!h) return '37,99,235'
  const n = parseInt(h[1], 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}
const vars = computed(() => ({ ...themeVars(t.value), '--glow-rgb': hexToRgb(t.value.accent) }))
// 访客点开分享的名片必须先看到名片本身；「我也要创建」只作为名片下方的次要入口（对所有非持有者显示，含已登录），
// 绝不能反过来一进来就拦去创建页——那会完全忽视「先看名片」的场景需要。
const showCreateOwn = computed(() => !owner && !isOwner.value)
const fullAddress = computed(() => {
  const c = card.value || {}
  return [c.province, c.city, c.district, c.street, c.address, c.address_detail].filter(Boolean).join('')
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
const windowRef = window
// 分享唯一真相源：服务端 publicView 下发的 url = ${origin}/c/${slug}（动态域名、干净无 query）。
// 微信「···」原生转发用的是 JS-SDK 配置的 link，不是地址栏 URL——owner 页也必须配成这个地址，
// 否则别人打开的是 /me（被守卫踢去登录，登录后看到「我的名片页」），而不是被分享的那张名片。
const publicLink = computed(() => card.value?.url || `${windowRef.location.origin}/c/${slug.value}`)
// 微信内引导「在浏览器中打开」是否真的带上了登录凭证：未登录访客拿不到 ticket，文案不能谎称已带登录态
const guideWithLogin = ref(false)
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
    // 分享缩略图口径（用户定稿）：公司LOGO → 用户头像 → 项目LOGO → 名片卡片图 → 分享池。
    // 名片卡片图由服务端公开接口 /api/cards/public/:slug/share.png 生成（无需登录、webp 头像也能渲染），
    // 访客转发/未登录场景也能用，彻底消灭空图。传作第 4 候选，前三档可用时自动优先。
    if (full) setCardShare(api, card.value, publicLink.value, `${qrApi.value}/share.png`)
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
  // 保存当前切换到的码：联系人码（vCard 瘦身版，扫=直接存通讯录）或名片链接码
  const isVcard = qrMode.value === 'vcard'
  const r = await saveImageUrl(
    scanQrUrl(slug.value, isVcard ? 'vcard.png' : 'qr.png', 900),
    `${slug.value}-${isVcard ? '名片码' : '二维码'}.png`
  )
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


