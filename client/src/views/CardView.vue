<template>
  <div class="cv-page" :class="['cv-tpl-' + template, { 'cv-clean': isCleanTpl }]" :style="vars">
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
        <div class="cv-profile card" :data-wm="(template === 'navygold' || isCleanTpl) ? (card.company || '').slice(0, 4) : ''">
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

        <!-- 简洁联络模板：卡内操作区（拨号 / 复制号码 / 金色存档）+ 按环境的操作指引 -->
        <div v-if="isCleanTpl" class="cv-cta">
          <div class="cv-cta-grid">
            <a v-if="contactPhone" class="cv-cta-btn cv-cta-main" :href="'tel:' + contactPhone">拨打电话</a>
            <button v-else class="cv-cta-btn cv-cta-main" @click="showToast('尚未填写电话')">拨打电话</button>
            <button class="cv-cta-btn cv-cta-ghost" @click="copy(contactPhone || '', '号码')">复制号码</button>
          </div>
          <a v-if="contactNative" class="cv-cta-save" :href="vcfApi">{{ contactActionLabel }}</a>
          <button v-else class="cv-cta-save" @click="saveContact">{{ contactActionLabel }}</button>
          <div class="cv-cta-steps">
            <div class="cv-cta-steps-t">{{ contactSteps.title }}</div>
            <ol><li v-for="(s, i) in contactSteps.lines" :key="i" v-html="s"></li></ol>
          </div>
          <div class="cv-cta-mini">
            <button @click="openMapSheet">↗ 导航到此处</button>
            <button :class="{ 'on': favorite }" @click="toggleFavorite">{{ favorite ? '★ 已收藏' : '☆ 收藏名片' }}</button>
            <button @click="doShare">⤴ 分享名片</button>
          </div>
        </div>

        <div v-if="contactFields.length" class="card card-pad cv-block">
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

        <!-- 名片二维码：码里是名片地址短链（不是整段 vCard），微信扫一扫必开；
             打开名片页后再点页面里的「存入通讯录」按钮保存，兼容 iPhone / 安卓 / 鸿蒙。 -->
        <div class="card card-pad cv-block cv-contact-qr" id="contact-qr">
          <h3 class="cv-sec-title">扫码打开名片 · 存入通讯录</h3>
          <p class="small muted cv-qr-lead">用微信或手机相机扫一扫下方二维码打开名片，再点页面里的「存入通讯录」按钮即可保存（iPhone / 安卓 / 鸿蒙通用）。也可把二维码转发给朋友浏览</p>
          <button class="cv-vcard-qr" @click="qrModal = true" title="点击放大">
            <img :src="qrApi + '/qr.svg?size=360'" alt="名片地址二维码" fetchpriority="high" decoding="async" />
          </button>
          <div class="cv-qr-actions">
            <button class="btn btn-primary" @click="qrModal = true">放大二维码</button>
            <a v-if="contactNative" class="btn btn-ghost" :href="vcfApi">{{ contactActionLabel }}</a>
            <button v-else class="btn btn-ghost" @click="saveContact">{{ contactActionLabel }}</button>
          </div>
          <p class="small muted" style="margin-top:8px">{{ contactActionTip }}</p>
        </div>

        <!-- 扫码进来的多是未登录访客：看完名片顺手引导「我也要一张」，登录后直达建卡页 -->
        <div v-if="showCreateOwn" class="card card-pad cv-create-own">
          <div class="cv-create-copy">
            <b>也想拥有这样一张名片？</b>
            <p class="small muted">二维码终身不变、资料随时改，免费创建</p>
          </div>
          <router-link to="/login?redirect=/me/card" class="btn btn-primary">免费创建我的名片 →</router-link>
        </div>

        <div class="card card-pad cv-exchange">
          <div><h3>交换名片</h3><p class="small muted">扫描对方二维码后，在这里留下互换记录</p></div>
          <button class="btn btn-ghost btn-sm" @click="openExchange">我要交换</button>
        </div>

        <p class="cv-footer">由 <b>{{ siteConfig.site_name }}</b> 提供技术支持 · 资料可改 · 二维码不变</p>
      </div>
      <p v-if="isCleanTpl" class="cv-cta-hint">扫码即见名片 · 一键拨号 · 一键存档</p>

      <div class="cv-dock" :class="{ 'cv-dock-hidden': isCleanTpl }">
        <button class="btn btn-primary" @click="tel(card.mobile || card.phone)">📞 打电话</button>
        <a v-if="contactNative" class="btn btn-ghost" :href="vcfApi">存入通讯录</a>
        <button v-else class="btn btn-ghost" @click="saveContact">存入通讯录</button>
        <button class="btn btn-ghost" @click="openMapSheet">导航</button>
        <button class="btn btn-ghost" :class="{ 'fav-on': favorite }" @click="toggleFavorite">{{ favorite ? '★ 已收藏' : '☆ 收藏' }}</button>
      </div>
      <button v-if="!isCleanTpl" class="cv-share-fab" @click="doShare" aria-label="分享名片">↗<span>分享</span></button>
      <BottomSheet :show="mapOpen" @update:show="mapOpen = $event">
        <div class="map-sheet-head"><b>选择导航地图</b><button @click="mapOpen = false">×</button></div>
        <div class="map-sheet-list">
          <a v-for="m in maps" :key="m.key" :href="m.href" target="_blank" rel="noopener" @click="mapOpen = false">
            <span class="map-ico" v-html="mapIcon(m.key)"></span><span>{{ m.label }}地图</span><span class="map-arrow">↗</span>
          </a>
        </div>
      </BottomSheet>
    </template>

    <!-- 名片地址二维码大图：微信扫一扫打开名片页，再点页面里的「存入通讯录」保存 -->
    <div v-if="qrModal" class="modal-mask" @click.self="qrModal = false">
      <div class="modal center">
        <h3>扫码打开名片</h3>
        <p class="small muted" style="margin:6px 0 12px">用<i style="font-style:normal;color:#07c160;font-weight:700">微信扫一扫</i>下方二维码打开名片，再点页面里的「存入通讯录」按钮保存</p>
        <img :src="qrApi + '/qr.svg?size=640'" style="width:260px;height:260px;margin:4px auto;display:block" alt="名片地址二维码" />
        <p class="small muted">微信 / 手机相机 / 系统扫一扫均可打开，地址短、更好扫</p>
        <div class="btn-row" style="justify-content:center;margin-top:12px">
          <button class="btn btn-primary" @click="saveQr">保存二维码图片</button>
          <button class="btn btn-ghost" @click="qrModal = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 相册大图：点缩略图直接看，不跳中间页；资料场景不放二维码，避免与名片二维码混淆 -->
    <div v-if="galleryIndex >= 0" class="modal-mask gallery-mask" @click.self="galleryIndex = -1">
      <div class="gallery-viewer">
        <img :src="fullUrl(imageMaterials[galleryIndex]?.url)" :alt="imageMaterials[galleryIndex]?.title" />
        <div class="gallery-cap">
          <span class="small">{{ imageMaterials[galleryIndex]?.title }}</span>
          <span class="small muted">{{ galleryIndex + 1 }} / {{ imageMaterials.length }}</span>
        </div>
        <div class="btn-row" style="justify-content:center;gap:8px">
          <button class="btn btn-ghost" :disabled="galleryIndex <= 0" @click="galleryIndex--">上一张</button>
          <button class="btn btn-ghost" :disabled="galleryIndex >= imageMaterials.length - 1" @click="galleryIndex++">下一张</button>
        </div>
        <button class="btn btn-ghost" style="margin-top:8px" @click="galleryIndex = -1">关闭</button>
      </div>
    </div>

    <!-- 保存引导：微信内引导去浏览器；Safari/iOS 长按图片保存 -->
    <div v-if="guide" class="modal-mask" @click.self="guide = ''">
      <div class="modal">
        <h3>{{ guide === 'contact' ? '存入通讯录' : '保存二维码' }}</h3>
        <template v-if="inWeChat">
          <p>微信内置浏览器限制通讯录写入与下载。请点右上角「···」→ <b>在浏览器中打开</b>（已自动带上登录状态，无需再次登录），再点「存入通讯录」即可直接打开系统添加界面。</p>
        </template>
        <template v-else>
          <p v-html="saveTip"></p>
        </template>
        <img v-if="guide !== 'contact'" :src="guideImage || (qrApi + '/qr.svg?size=520')" style="width:200px;height:200px;margin:10px auto;object-fit:contain" alt="二维码" />
        <div class="btn-row">
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
import { isWeChat, isIOS, saveImageUrl, prepareExternalOpen, openVcfInline, deviceEnv, SAVE_IMAGE_TIPS } from '../utils/save-image'
import { shareOrCopy, mapLinks } from '../utils/share'
import { setupWechatShare, absoluteMediaUrl } from '../utils/wx-share'
import { getCachedPosition } from '../utils/geo'
import BottomSheet from '../components/BottomSheet.vue'
import AppIcon from '../components/AppIcon.vue'
import { BRAND_ICONS, FUNC_ICONS } from '../utils/icons'

const route = useRoute(); const router = useRouter()
const slug = route.params.slug
const qrApi = `/api/cards/public/${slug}`
const vcfApi = `${qrApi}/card.vcf`
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
const mapOpen = ref(false)
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
const vars = computed(() => themeVars(t.value))
// 扫码进来的访客多为未登录：只在未登录且非本人时展示建卡引导，避免打扰名片主人
const showCreateOwn = computed(() => !auth.token && !isOwner.value)
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
const windowRef = window
const fullUrl = u => (u ? new URL(u, windowRef.location.origin).href : '')
// 模板里区分微信/Safari 的保存引导（微信→去浏览器，iOS→长按图片）
const inWeChat = isWeChat()
const deviceEnvKey = deviceEnv()
// iOS Safari：必须用真实 <a href=".vcf"> 链接（Safari 只信任用户点击的顶层导航），
// 而不是 JS location.href——后者在 iOS 上常被当下载/拦截，导致「存不进通讯录」。
const contactNative = deviceEnvKey === 'ios'
const saveTip = SAVE_IMAGE_TIPS[deviceEnvKey] || SAVE_IMAGE_TIPS.other
// 通讯录操作按环境出文案：iOS 直接开系统界面、Android/鸿蒙下载 vcf、微信引导去浏览器
const CONTACT_ACTION = {
  ios: { label: '打开通讯录', tip: '点此直接打开系统添加联系人界面' },
  android: { label: '下载联系人', tip: '点此下载联系人文件，打开即可导入通讯录' },
  harmony: { label: '下载联系人', tip: '点此下载联系人文件，打开即可导入通讯录' },
  wechat: { label: '去浏览器添加', tip: '微信内无法直接写入通讯录，请点右上角「···」在浏览器中打开' },
  other: { label: '添加联系人', tip: '点此下载联系人文件，打开即可导入通讯录' }
}
const contactActionLabel = (CONTACT_ACTION[deviceEnvKey] || CONTACT_ACTION.other).label
const contactActionTip = (CONTACT_ACTION[deviceEnvKey] || CONTACT_ACTION.other).tip
const contactPhone = computed(() => String(card.value?.mobile || card.value?.phone || '').trim())
// 卡内「按环境」操作指引：参考简洁联络卡的 steps 区块，文案按当前环境给可操作步骤
const CONTACT_STEPS = {
  wechat: { title: '微信内 · 推荐这样存', lines: [
    '点上方金色按钮，名片信息即复制到剪贴板',
    '打开通讯录 → 右上角「+」→「新建联系人」→ 粘贴',
    '或点右上角「···」→ <b>在浏览器中打开</b>，再点金色按钮存为通讯录文件'
  ] },
  ios: { title: 'iPhone 浏览器 · 三步存好', lines: [
    '点上方金色按钮，文件存入「文件」App 的下载项',
    '打开「文件」→ 浏览 → 下载 → 点开联系人文件',
    '系统弹出联系人预览，点「添加所有信息」'
  ] },
  android: { title: '安卓 · 通常一步到位', lines: [
    '点上方金色按钮，直接下载联系人文件',
    '通知栏点该文件，或到「文件管理」→ 下载 里点开',
    '选「导入到通讯录」，确认即完成'
  ] },
  harmony: { title: '鸿蒙 · 通常一步到位', lines: [
    '点上方金色按钮，直接下载联系人文件',
    '到「文件管理」→ 下载 里点开',
    '选「导入到通讯录」，确认即完成'
  ] },
  other: { title: '电脑端 / 其他浏览器', lines: [
    '点上方金色按钮下载联系人文件（.vcf）',
    '双击文件即可导入 Outlook / 系统通讯录',
    '手机扫码打开此页，可直接拨号、一键存档'
  ] }
}
const contactSteps = computed(() => CONTACT_STEPS[deviceEnvKey] || CONTACT_STEPS.other)

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
function safeUrl(u) { try { const x = new URL(u); return ['http:', 'https:'].includes(x.protocol) ? x.href : '#' } catch { return '#' } }
// 微信内显示「去浏览器打开」引导前，先把登录凭证写进当前 URL，外部浏览器打开即免二次登录
async function showGuide(kind) {
  if (isWeChat()) await prepareExternalOpen(api)
  guide.value = kind
}

async function load() {
  loading.value = true; error.value = ''
  try {
    const { data } = await api.get(qrApi)
    card.value = data.data
    currentTheme.value = THEMES[data.data.theme] ? data.data.theme : 'ocean'
    template.value = data.data.template || 'contact'
    setupWechatShare(api, {
      title: `${card.value.name || '名片'} · ${card.value.title || card.value.company || '电子名片'}`,
      desc: `${[card.value.company, card.value.department, card.value.title].filter(Boolean).join(' · ') || '电子名片'}，扫码打开名片`,
      link: card.value.url || windowRef.location.href,
      imgUrl: absoluteMediaUrl(card.value.avatar || card.value.logo || card.value.cover)
    })
    if (auth.token) {
      try { const mine = await api.get('/api/cards/mine'); isOwner.value = mine.data.data?.slug === slug } catch { /* 忽略 */ }
      if (!isOwner.value) {
        try { favorite.value = !!(await api.get(`/api/cards/public/${slug}/favorite`)).data.data?.favorite } catch { /* 忽略 */ }
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
function openMapSheet() {
  if (!maps.value.length) return showToast('尚未填写地址')
  mapOpen.value = true
}
// 地图图标：全部用各产品官方 logo path（simple-icons / arcticons），白底渲染原色，去除自绘准星。
// 全部内联、零外部依赖。指示性使用场景（点击即用该地图导航）。
const MAP_ICON_CFG = {
  amap: { brand: 'amap', bg: '#fff' },
  baidu: { brand: 'baidu', bg: '#fff' },
  qq: { brand: 'qq', bg: '#fff' },
  apple: { brand: 'apple', bg: '#fff' },
  google: { brand: 'googlemaps', bg: '#fff' }
}
function mapIcon(key) {
  const cfg = MAP_ICON_CFG[key]
  if (!cfg) return `<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="${FUNC_ICONS.nav.path}" fill="none" stroke="#64748b" stroke-width="1.8"/></svg>`
  const b = BRAND_ICONS[cfg.brand]
  const vb = b.viewBox || '0 0 24 24'
  const inner = b.stroke
    ? `<path d="${b.path}" fill="none" stroke="${b.color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`
    : `<path d="${b.path}" fill="${b.color}"/>`
  return `<svg viewBox="${vb}" width="100%" height="100%"><rect x="0" y="0" width="${vb.includes('48') ? 48 : 24}" height="${vb.includes('48') ? 48 : 24}" rx="6" fill="${cfg.bg}"/>${inner}</svg>`
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
    // iOS Safari：直接跳 .vcf 唤起系统「添加联系人」弹层（覆盖在当前页，不会触发 visibilitychange）。
    // 若被拦截无法弹出，用户可复制页面里的手机号手动新建联系人——不再主动弹窗打断。
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
/* 高档商务名片：卡片大圆角 + 轻阴影，浅灰蓝底衬托层次 */
.cv-page .card { border-radius: 20px; box-shadow: 0 4px 18px rgba(30,64,120,.07); border: 0; overflow: hidden; }
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
/* 操作栏已并入联系方式行：整行点击复制该字段，行尾按钮给出电话/短信/邮件等操作 */
.cv-contact-acts { display: flex; align-items: center; gap: 6px; flex: 0 0 auto; }
.cv-row-act { padding: 5px 9px; border-radius: 7px; background: color-mix(in srgb, var(--t-accent) 12%, transparent); color: var(--t-accent); font-size: 11px; font-weight: 600; white-space: nowrap; }
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
.cv-contact-value { flex: 1; min-width: 0; font-size: 13px; word-break: break-all; }
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
.cv-gallery-file-ico { width: 100%; aspect-ratio: 1; display: grid; place-items: center; border-radius: 6px; background: color-mix(in srgb, var(--t-accent) 12%, transparent); color: var(--t-accent); }
.cv-gallery-file small { font-size: 9px; color: var(--t-muted); }
.gallery-mask { z-index: 3000; }
.gallery-viewer { width: min(92vw, 560px); max-height: 92vh; overflow-y: auto; background: var(--t-surface); border-radius: 14px; padding: 14px; display: flex; flex-direction: column; gap: 8px; }
.gallery-viewer > img { width: 100%; max-height: 68vh; object-fit: contain; background: #fff; border-radius: 8px; }
.gallery-cap { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
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
.map-ico { flex: 0 0 34px; width: 34px; height: 34px; display: grid; place-items: center; }
.map-ico svg { display: block; width: 100%; height: 100%; }
.map-arrow { margin-left: auto; color: #94a3b8; font-size: 16px; }
.cv-qr-card { margin-top: 12px; display: flex; flex-direction: column; align-items: center; text-align: center; background: var(--t-surface); padding: 22px 18px 20px; }
.cv-qr-img { display: block; width: 140px; height: 140px; margin: 0 auto 14px; padding: 8px; background: #fff; border-radius: 10px; border: 1px solid var(--line); box-shadow: 0 4px 14px rgba(15,23,42,.06); }
.cv-qr-img img { display: block; width: 100%; height: 100%; }
.cv-qr-info h3 { font-size: 14px; font-weight: 600; }
.cv-qr-info p { margin-top: 4px; font-size: 12px; }
.cv-exchange { margin-top: 12px; display: flex; justify-content: space-between; align-items: center; background: var(--t-surface); }
.cv-exchange h3 { font-size: 14px; }
.cv-footer { text-align: center; color: var(--t-muted); font-size: 11px; padding: 26px 0 10px; }
/* 高档深灰底栏：主操作蓝，次操作深灰半透明，参考商务数字名片质感 */
.cv-dock { position: fixed; left: 0; right: 0; bottom: 0; display: flex; gap: 6px; padding: 10px 12px calc(10px + env(safe-area-inset-bottom)); background: #252a33; border-top: 1px solid rgba(255,255,255,.08); z-index: 60; }
.cv-dock .btn { flex: 1; padding-left: 4px; padding-right: 4px; font-size: 13px; }
.cv-dock .btn-primary { background: var(--t-accent, #2563eb); color: #fff; border-color: transparent; }
.cv-dock .btn-ghost { background: rgba(255,255,255,.12); color: #e2e8f0; border-color: transparent; }
.cv-dock .fav-on { color: #fbbf24; background: rgba(251,191,36,.16); border-color: rgba(251,191,36,.4); }
.cv-share-fab { position: fixed; right: 16px; bottom: calc(76px + env(safe-area-inset-bottom)); z-index: 61; width: 58px; height: 58px; border-radius: 16px; background: var(--t-accent, #2563eb); color: #fff; box-shadow: 0 8px 24px rgba(37,99,235,.42); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; font-size: 20px; }
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
.cv-tpl-seal .cv-links a { border-radius: 4px; }
.cv-tpl-seal .cv-maps a, .cv-tpl-seal .btn-ghost { border-radius: 3px; }
.cv-tpl-seal .cv-qr-img { border-radius: 4px; border: 2px solid #1e3a8a; }
.cv-tpl-seal .cv-footer { color: #64748b; letter-spacing: 1px; }
.cv-tpl-seal .cv-dock { background: rgba(18,33,60,.96); border-top: 3px solid #1e3a8a; }
.cv-tpl-seal .cv-dock .btn-ghost { background: rgba(255,255,255,.14); color: #fff; border-color: transparent; }

/* 联络卡 contact 的样式统一在下方「② 生效版」定义（此处旧版已废弃，避免双重定义冲突） */

/* ============ 通讯录二维码卡（各模板通用，不属于骨架）============ */
.cv-contact-qr { background: var(--t-surface, #fff); text-align: center; padding: 20px 16px; }
.cv-contact-qr .cv-sec-title { text-align: left; }
.cv-contact-qr .cv-qr-lead { text-align: left; line-height: 1.6; margin-bottom: 14px; font-size: 12px; }
.cv-vcard-qr { display: block; width: 240px; height: 240px; margin: 0 auto 14px; padding: 10px; background: #fff; border: 2px solid var(--t-accent, #1a3f86); border-radius: 12px; box-shadow: 0 6px 20px rgba(26,63,134,.14); }
.cv-vcard-qr img { display: block; width: 100%; height: 100%; }
.cv-qr-actions { display: flex; gap: 10px; justify-content: center; }
.cv-qr-actions .btn { min-width: 128px; }
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
.cv-tpl-classic .small.muted, .cv-tpl-classic .cv-qr-lead { color: var(--t-muted); }
.cv-tpl-classic .cv-profile { border-radius: 16px; border: 1px solid var(--line, #dbe4f5); box-shadow: 0 8px 26px rgba(16,36,70,.12); background: var(--t-surface); }
.cv-tpl-classic .cv-name { color: var(--t-text); font-size: 23px; }
.cv-tpl-classic .cv-title { color: var(--t-accent); font-weight: 600; }
.cv-tpl-classic .cv-dock { background: #0f1c33; border-top: 1px solid var(--t-accent); padding: 10px 12px calc(10px + env(safe-area-inset-bottom)); }
.cv-tpl-classic .cv-dock .btn { font-size: 13px; border-radius: 8px; }
.cv-tpl-classic .cv-dock .btn-ghost { background: #263550; color: #fff; border-color: transparent; }
.cv-tpl-classic .cv-share-fab { background: var(--t-accent); border-radius: 16px; width: 60px; height: 60px; }

/* ② 极简白 minimal：无封面 + 大留白 + 超大姓名 + 细线分隔（瑞士极简） */
.cv-tpl-minimal { background: #fff; }
.cv-tpl-minimal .cv-cover { height: 54px; border-radius: 0; background: #fff; border-bottom: 1px solid #e5e7eb; }
.cv-tpl-minimal .cv-brand { color: #111827; opacity: 1; top: calc(16px + env(safe-area-inset-top)); }
.cv-tpl-minimal .cv-back { color: #111827; }
.cv-tpl-minimal .cv-themes { display: none; }
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
.cv-tpl-minimal .cv-dock { background: #fff; border-top: 1px solid #e5e7eb; }
.cv-tpl-minimal .cv-dock .btn-primary { background: var(--t-accent); }
.cv-tpl-minimal .cv-dock .btn-ghost { background: #f3f4f6; color: #374151; }
.cv-tpl-minimal .cv-share-fab { background: #fff; border: 2px solid var(--t-accent); color: var(--t-accent); box-shadow: 0 4px 14px rgba(0,0,0,.12); }

/* ③ 尊享黑金 elite：深色沉浸 + 居中大头像金环 + 衬线署名（固定深底，强调色跟主题） */
.cv-tpl-elite { background: #0b0d12; color: #f5f5f4; }
.cv-tpl-elite .cv-cover { height: 210px; border-radius: 0 0 40px 40px; background: var(--t-cover); }
.cv-tpl-elite .cv-main { margin-top: -70px; }
.cv-tpl-elite .card { background: #15171c; border: 1px solid rgba(255,255,255,.09); }
.cv-tpl-elite .cv-profile { flex-direction: column; align-items: center; text-align: center; gap: 10px; padding: 24px 18px; background: #15171c; border-color: rgba(255,255,255,.1); }
.cv-tpl-elite .cv-avatar { width: 92px; height: 92px; flex: 0 0 92px; border-radius: 50%; border: 3px solid var(--t-accent); box-shadow: 0 0 0 5px #15171c, 0 12px 30px rgba(0,0,0,.4); }
.cv-tpl-elite .cv-name-row { justify-content: center; }
.cv-tpl-elite .cv-name { font-family: Georgia,'Songti SC',serif; font-size: 26px; letter-spacing: 4px; color: #f5f5f4; }
.cv-tpl-elite .cv-en { display: block; margin: 4px 0 0; letter-spacing: 2px; }
.cv-tpl-elite .cv-title { letter-spacing: 2px; color: var(--t-muted); }
.cv-tpl-elite .cv-tags { justify-content: center; }
.cv-tpl-elite .cv-tags span { border-radius: 0; border-bottom: 1px solid var(--t-accent); background: transparent; color: var(--t-accent); }
.cv-tpl-elite .cv-block h3, .cv-tpl-elite .cv-sec-title { text-align: center; font-size: 12px; letter-spacing: 4px; color: var(--t-accent); border-left: 0; padding-left: 0; }
.cv-tpl-elite .cv-bio, .cv-tpl-elite .small.muted, .cv-tpl-elite .cv-qr-lead { color: #a1a1aa; }
.cv-tpl-elite .cv-links a { background: #1c1f26; border-color: rgba(255,255,255,.09); }
.cv-tpl-elite .cv-dock { background: #0b0d12; border-top: 2px solid var(--t-accent); }
.cv-tpl-elite .cv-dock .btn-ghost { background: rgba(255,255,255,.1); color: #f5f5f4; }
.cv-tpl-elite .cv-share-fab { background: var(--t-accent); }

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
.cv-tpl-seal .cv-themes { display: none; }
.cv-tpl-seal .cv-main { margin-top: -20px; }
.cv-tpl-seal .card { border-radius: 0; border: 2px solid #111827; box-shadow: 4px 4px 0 rgba(17,24,39,.12); background: #fff; }
.cv-tpl-seal .cv-profile { border-top: 6px solid #111827; padding: 18px 16px; align-items: flex-end; }
.cv-tpl-seal .cv-avatar { border-radius: 0; width: 76px; height: 76px; flex-basis: 76px; border: 3px solid #111827; }
.cv-tpl-seal .cv-name { font-weight: 900; font-size: 34px; letter-spacing: -1px; line-height: 1; color: #111827; }
.cv-tpl-seal .cv-name::first-letter { font-size: 1.45em; }
.cv-tpl-seal .cv-title { font-weight: 700; color: var(--t-accent); }
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
  --cv-logo-bg: linear-gradient(145deg,var(--ng-navy),#0e2233); --cv-logo-radius: 14px;
  --cv-logo-shadow: inset 0 0 0 2px rgba(216,187,133,.5),0 8px 18px -8px rgba(18,32,46,.6);
  --cv-name-size: 27px; --cv-name-weight: 900; --cv-name-spacing: .04em; --cv-name-color: #12202e; --cv-name-font: inherit;
  --cv-role-color: #4a5b6e; --cv-role-size: 12.5px; --cv-role-spacing: .06em;
  --cv-org-color: #1d3a55; --cv-org-border: 1px dashed #e2ddd2;
  --cv-tag-bg: #f4f1ea; --cv-tag-color: #6b5a3c; --cv-tag-shadow: inset 0 0 0 1px rgba(185,147,85,.28); --cv-tag-radius: 99px;
  --cv-btn-radius: 13px; --cv-btn-font: inherit; --cv-btn-spacing: .02em;
  --cv-btn-main-bg: linear-gradient(135deg,var(--ng-navy),#0f2739); --cv-btn-main-color: #fff; --cv-btn-main-shadow: 0 10px 22px -12px rgba(18,32,46,.85);
  --cv-btn-ghost-bg: #f7f5f0; --cv-btn-ghost-color: #1d3a55; --cv-btn-ghost-shadow: inset 0 0 0 1px #e6e0d4;
  --cv-btn-save-bg: linear-gradient(135deg,#c9a163,#a8834a); --cv-btn-save-color: #fff; --cv-btn-save-shadow: 0 12px 24px -14px rgba(169,131,74,.9);
  --cv-steps-bg: #faf8f3; --cv-steps-color: #5c6a79; --cv-steps-shadow: inset 0 0 0 1px #eee8dc; --cv-steps-radius: 12px; --cv-steps-title: #a8834a; --cv-steps-b: #1d3a55;
  --cv-mini-bg: #f4f1ea; --cv-mini-color: #1d3a55; --cv-mini-shadow: inset 0 0 0 1px rgba(185,147,85,.28); --cv-mini-on-bg: linear-gradient(135deg,#c9a163,#a8834a); --cv-mini-on-color: #fff;
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
  --cv-panel-bg: transparent; --cv-card-bg: linear-gradient(160deg,rgba(255,255,255,.09),rgba(255,255,255,.03));
  --cv-card-border: 1px solid rgba(255,255,255,.12); --cv-card-radius: 20px; --cv-card-pad: 30px 24px 22px;
  --cv-card-shadow: 0 30px 70px -30px #000, inset 0 1px 0 rgba(255,255,255,.15); --cv-card-blur: blur(14px);
  --cv-topbar-h: 0; --cv-topbar-bg: transparent;
  --cv-logo-bg: rgba(127,211,193,.12); --cv-logo-radius: 16px; --cv-logo-shadow: inset 0 0 0 1px rgba(127,211,193,.4);
  --cv-name-size: 27px; --cv-name-weight: 900; --cv-name-spacing: .06em; --cv-name-color: #f2f7fb;
  --cv-role-color: #8fa6ba; --cv-role-size: 12.5px; --cv-role-spacing: .1em;
  --cv-org-color: #cfe6e0; --cv-org-border: 1px solid rgba(255,255,255,.12);
  --cv-tag-bg: rgba(255,255,255,.07); --cv-tag-color: #a8c3d6; --cv-tag-shadow: inset 0 0 0 1px rgba(255,255,255,.1); --cv-tag-radius: 99px;
  --cv-btn-main-bg: linear-gradient(135deg,#2ea88f,#1b7d6a); --cv-btn-main-color: #fff; --cv-btn-main-shadow: 0 14px 28px -16px rgba(46,168,143,.9);
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
  --cv-ink: #3b2f24; --cv-ink-2: #8a7358; --cv-line: #f0e7d8;
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
  --cv-page-bg: #f7f3ec; --cv-ink: #2a2118; --cv-ink-2: #9c8871; --cv-line: #eee4d6;
  --cv-card-bg: #fffdf9; --cv-card-border: 0; --cv-card-radius: 2px; --cv-card-pad: 26px 22px 20px;
  --cv-card-shadow: 0 22px 44px -32px rgba(80,55,30,.5);
  --cv-topbar-h: 0; --cv-topbar-bg: transparent;
  --cv-logo-bg: #6b4a2e; --cv-logo-radius: 50%; --cv-logo-shadow: none;
  --cv-name-size: 28px; --cv-name-weight: 600; --cv-name-spacing: .18em; --cv-name-color: #2a2118; --cv-name-font: "Noto Serif SC","Songti SC",serif;
  --cv-role-color: #9c8871; --cv-role-size: 11px; --cv-role-spacing: .2em;
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
.cv-clean.cv-page { font-family: var(--cv-name-font, inherit); padding-bottom: 34px; }
.cv-tpl-acid.cv-page { background-image: var(--cv-page-grid); }
/* 渐变文字（E 霓虹） */
.cv-tpl-neon .cv-name { -webkit-background-clip: text; background-clip: text; background-image: var(--cv-name-gradient); color: transparent; -webkit-text-fill-color: transparent; }
/* 彩色标签轮换（G 多巴胺） */
.cv-tpl-pop .cv-tags span:nth-child(4n+2) { background: #a0e7e5; }
.cv-tpl-pop .cv-tags span:nth-child(4n+3) { background: #ffb3c1; }
.cv-tpl-pop .cv-tags span:nth-child(4n+4) { background: #c9b8ff; }
/* 指引块补充：虚线边（G）/ 左侧色条（H / L1 / L2） */
.cv-tpl-pop .cv-cta-steps, .cv-tpl-magazine .cv-cta-steps, .cv-tpl-poster .cv-cta-steps, .cv-tpl-ticket .cv-cta-steps { border: var(--cv-steps-border, 0); border-left: var(--cv-steps-border-left, 0); }
/* ===== L1 竖版海报：无卡片通栏、公司名居中、信息两列 ===== */
.cv-tpl-poster .cv-main > .cv-profile { background: transparent; }
.cv-tpl-poster .cv-profile { flex-direction: column; align-items: flex-start; gap: 0; }
.cv-tpl-poster .cv-avatar { display: none; }
.cv-tpl-poster .cv-org { text-align: center; letter-spacing: .28em; font-size: 11px; font-weight: 400; padding-bottom: 16px; }
.cv-tpl-poster .cv-title { margin-top: 10px; }
.cv-tpl-poster .cv-block, .cv-tpl-poster .cv-cta { padding-left: 0; padding-right: 0; }
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
.cv-tpl-horizontal .cv-cta-grid { grid-template-columns: 1fr; gap: 7px; }
.cv-tpl-horizontal .cv-cta-btn, .cv-tpl-horizontal .cv-cta-save { height: 38px; font-size: 12.5px; }
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
.cv-tpl-sidebar .cv-contact-value, .cv-tpl-sidebar .cv-cta, .cv-tpl-sidebar .cv-block { text-align: right; }
.cv-tpl-sidebar .cv-cta-mini, .cv-tpl-sidebar .cv-qr-actions { justify-content: flex-end; }
.cv-clean .cv-cover { height: 0; border-radius: 0; background: transparent; }
.cv-clean .cv-back { top: calc(10px + env(safe-area-inset-top)); left: 12px; color: var(--cv-back-color); background: var(--cv-back-bg); border-radius: 50%; width: 34px; height: 34px; display: grid; place-items: center; font-size: 24px; backdrop-filter: blur(6px); }
.cv-clean .cv-brand { top: calc(18px + env(safe-area-inset-top)); color: var(--cv-brand-color); }
.cv-clean .cv-themes { bottom: auto; top: calc(20px + env(safe-area-inset-top)); }
.cv-clean .cv-main { max-width: 430px; margin: 44px auto 0; }
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
  content: attr(data-wm); position: absolute; right: -26px; top: 54px;
  font-size: 88px; font-weight: 900; color: var(--cv-wm-color); opacity: var(--cv-wm-opacity);
  letter-spacing: -4px; line-height: 1; pointer-events: none;
}
.cv-clean .cv-profile > * { position: relative; z-index: 2; }
.cv-clean .cv-avatar { width: 64px; height: 64px; flex: 0 0 64px; border-radius: var(--cv-logo-radius); font-size: 26px; color: var(--cv-btn-main-color); background: var(--cv-logo-bg); box-shadow: var(--cv-logo-shadow); }
.cv-clean .cv-name { color: var(--cv-name-color); font-size: var(--cv-name-size); font-weight: var(--cv-name-weight); letter-spacing: var(--cv-name-spacing); font-family: var(--cv-name-font); }
.cv-clean .cv-en { color: var(--cv-ink-2); }
.cv-clean .cv-title { color: var(--cv-role-color); font-size: var(--cv-role-size); letter-spacing: var(--cv-role-spacing); font-weight: 400; }
.cv-clean .cv-tags span { border-radius: var(--cv-tag-radius); background: var(--cv-tag-bg); color: var(--cv-tag-color); box-shadow: var(--cv-tag-shadow); }
.cv-clean .cv-status { right: 14px; bottom: 6px; }
.cv-cta { background: var(--cv-panel-bg); padding: 0 var(--cv-card-x) 8px; }
.cv-cta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.cv-cta-btn { display: flex; align-items: center; justify-content: center; height: 50px; border-radius: var(--cv-btn-radius); font-size: 14.5px; font-weight: 700; letter-spacing: var(--cv-btn-spacing); font-family: var(--cv-btn-font); text-decoration: none; }
.cv-cta-main { background: var(--cv-btn-main-bg); color: var(--cv-btn-main-color); box-shadow: var(--cv-btn-main-shadow); }
.cv-cta-ghost { background: var(--cv-btn-ghost-bg); color: var(--cv-btn-ghost-color); box-shadow: var(--cv-btn-ghost-shadow); }
.cv-cta-save { display: flex; align-items: center; justify-content: center; width: 100%; margin-top: 10px; height: 52px; border-radius: var(--cv-btn-radius); background: var(--cv-btn-save-bg); color: var(--cv-btn-save-color); box-shadow: var(--cv-btn-save-shadow); font-size: 15px; font-weight: 700; font-family: var(--cv-btn-font); text-decoration: none; }
.cv-cta-steps { margin-top: 10px; background: var(--cv-steps-bg); border-radius: var(--cv-steps-radius); padding: 11px 13px; font-size: 11.5px; line-height: 1.9; color: var(--cv-steps-color); box-shadow: var(--cv-steps-shadow); }
.cv-cta-steps-t { font-size: 11px; color: var(--cv-steps-title); font-weight: 700; letter-spacing: .08em; margin-bottom: 2px; }
.cv-cta-steps ol { margin: 0; padding-left: 16px; }
.cv-cta-steps b { color: var(--cv-steps-b); }
.cv-cta-mini { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 10px; }
.cv-cta-mini button { padding: 9px 2px; border-radius: var(--cv-btn-radius); background: var(--cv-mini-bg); color: var(--cv-mini-color); box-shadow: var(--cv-mini-shadow); font-size: 11.5px; font-weight: 600; }
.cv-cta-mini button.on { background: var(--cv-mini-on-bg); color: var(--cv-mini-on-color); }
.cv-clean .cv-block { padding: 14px var(--cv-card-x); background: var(--cv-panel-bg); margin-top: 0; }
.cv-clean .cv-block h3, .cv-clean .cv-sec-title { font-size: 12px; letter-spacing: .1em; color: var(--cv-block-title); border-left: 0; padding-left: 0; }
.cv-clean .cv-block h3 .small.muted { letter-spacing: 0; }
.cv-clean .cv-contact-row { padding: 11px 0; border-top: 1px solid var(--cv-line); }
.cv-clean .cv-contact-label { flex-basis: 52px; color: var(--cv-ink-2); letter-spacing: .08em; }
.cv-clean .cv-bio, .cv-clean .small.muted, .cv-clean .cv-qr-lead { color: var(--cv-ink-2); }
.cv-clean .cv-links a, .cv-clean .cv-gallery-cell { border-color: var(--cv-line); background: var(--cv-panel-bg); }
.cv-clean .cv-links b, .cv-clean .cv-region-line, .cv-clean .cv-contact-row b { color: var(--cv-link-color); }
.cv-clean .cv-map-launch, .cv-clean .cv-maps a { background: var(--cv-mini-bg); color: var(--cv-mini-color); box-shadow: var(--cv-mini-shadow); }
.cv-clean .cv-vcard-qr { border: 3px solid var(--cv-mini-color); }
.cv-clean .cv-create-own { border-top: 1px solid var(--cv-line); }
.cv-clean .cv-create-copy b { color: var(--cv-link-color); }
.cv-clean .cv-footer { background: var(--cv-panel-bg); border-radius: 0 0 var(--cv-card-radius) var(--cv-card-radius); padding: 16px var(--cv-card-x) 20px; color: var(--cv-foot-color); letter-spacing: .1em; }
.cv-clean .cv-footer b { color: var(--cv-foot-b); }
.cv-cta-hint { text-align: center; color: var(--cv-hint-color); font-size: 11px; letter-spacing: .08em; margin: 14px 0 0; }
.cv-dock-hidden { display: none !important; }

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
.cv-tpl-navygold .cv-links a { border-color: var(--ng-line); background: #fff; }
.cv-tpl-navygold .cv-links b { color: var(--ng-navy); }
.cv-tpl-navygold .cv-maps a { background: var(--ng-paper); color: var(--ng-navy); box-shadow: inset 0 0 0 1px rgba(185,147,85,.28); }
.cv-tpl-navygold .cv-vcard-qr { border: 4px solid rgba(185,147,85,.45); }
.cv-tpl-navygold .cv-footer { color: #a9b1ba; letter-spacing: .1em; }
.cv-tpl-navygold .cv-footer b { color: var(--ng-gold); }
.cv-tpl-navygold .cv-dock { background: rgba(18,32,46,.96); border-top: 2px solid var(--ng-gold); }
.cv-tpl-navygold .cv-dock .btn-primary { background: linear-gradient(135deg, #c9a163, #a8834a); color: #fff; box-shadow: 0 12px 24px -14px rgba(169,131,74,.9); }
.cv-tpl-navygold .cv-dock .btn-ghost { background: rgba(255,255,255,.12); color: #fff; border-color: rgba(216,187,133,.35); }
.cv-tpl-navygold .cv-share-fab { background: linear-gradient(135deg, #c9a163, #a8834a); box-shadow: 0 8px 20px rgba(169,131,74,.4); border-radius: 18px; }
</style>
