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
          <div class="cv-address" @click="copy(fullAddress, '地址')">
            <span v-if="detailAddress">地址：{{ detailAddress }}</span>
            <button v-if="maps.length" class="cv-map-launch" @click.stop="mapOpen = true">导航</button>
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
            <button class="btn btn-ghost" @click="saveContact">{{ contactActionLabel }}</button>
          </div>
          <p class="small muted" style="margin-top:8px">{{ contactActionTip }}</p>
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
        <button class="btn btn-ghost" @click="openMapSheet">导航</button>
        <button class="btn btn-ghost" :class="{ 'fav-on': favorite }" @click="toggleFavorite">{{ favorite ? '★ 已收藏' : '☆ 收藏' }}</button>
      </div>
      <button class="cv-share-fab" @click="doShare" aria-label="分享名片">↗<span>分享</span></button>
      <BottomSheet :show="mapOpen" @update:show="mapOpen = $event">
        <div class="map-sheet-head"><b>选择导航地图</b><button @click="mapOpen = false">×</button></div>
        <div class="map-sheet-list">
          <a v-for="m in maps" :key="m.key" :href="m.href" target="_blank" rel="noopener" @click="mapOpen = false">
            <span class="map-ico" v-html="mapIcon(m.key)"></span><span>{{ m.label }}地图</span><span class="map-arrow">↗</span>
          </a>
        </div>
      </BottomSheet>
    </template>

    <!-- 通讯录二维码大图：相机扫一扫直接加联系人 -->
    <div v-if="vcardQrModal" class="modal-mask" @click.self="vcardQrModal = false">
      <div class="modal center">
        <h3>存入通讯录</h3>
        <p class="small muted" style="margin:6px 0 12px">用<i style="font-style:normal;color:#07c160;font-weight:700">手机相机</i>或系统扫一扫，扫下方二维码即可添加（不是微信扫一扫）。</p>
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
const isAlipay = () => /AlipayClient/i.test(navigator.userAgent || '')
const fullUrl = u => (u ? new URL(u, windowRef.location.origin).href : '')
// 模板里区分微信/Safari 的保存引导（微信→去浏览器，iOS→长按图片）
const inWeChat = isWeChat()
const deviceEnvKey = deviceEnv()
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
  if (c.website) extra.push(`主页：${c.website}`)
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
    // 若被拦截无法弹出，用户可点页面上的二维码图标用相机扫码兜底——不再主动弹窗打断。
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
.qr-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
.qr-tile { border: 1px solid var(--line); border-radius: 12px; padding: 12px; text-align: center; background: var(--t-bg); display: flex; flex-direction: column; align-items: center; gap: 5px; }
.qr-tile img { width: 116px; height: 116px; object-fit: contain; background: #fff; border-radius: 8px; cursor: zoom-in; }
.qr-tile b { font-size: 13px; }
.qr-tile .btn-row { justify-content: center; margin-top: 4px; }
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

/* ============ 通讯录二维码卡（各模板通用，不属于骨架）============ */
.cv-contact-qr { background: var(--t-surface, #fff); text-align: center; padding: 20px 16px; }
.cv-contact-qr .cv-sec-title { text-align: left; }
.cv-contact-qr .cv-qr-lead { text-align: left; line-height: 1.6; margin-bottom: 14px; font-size: 12px; }
.cv-vcard-qr { display: block; width: 240px; height: 240px; margin: 0 auto 14px; padding: 10px; background: #fff; border: 2px solid var(--t-accent, #1a3f86); border-radius: 12px; box-shadow: 0 6px 20px rgba(26,63,134,.14); }
.cv-vcard-qr img { display: block; width: 100%; height: 100%; }
.cv-qr-actions { display: flex; gap: 10px; justify-content: center; }
.cv-qr-actions .btn { min-width: 128px; }
.cv-share-qr { display: block; width: 160px; height: 160px; margin: 8px auto 0; padding: 8px; background: #fff; border: 1px solid var(--line, #d9e1ee); border-radius: 10px; }
.cv-share-qr img { display: block; width: 100%; height: 100%; }

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
.cv-tpl-elite .cv-links a, .cv-tpl-elite .qr-tile { background: #1c1f26; border-color: rgba(255,255,255,.09); }
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
.cv-tpl-seal .cv-links a, .cv-tpl-seal .qr-tile { border-radius: 0; border: 2px solid #111827; }
.cv-tpl-seal .cv-map-launch { border-radius: 0; border: 2px solid #111827; }
.cv-tpl-seal .cv-dock { background: #111827; border-top: 5px solid var(--t-accent); }
.cv-tpl-seal .cv-dock .btn-ghost { background: #fff; color: #111827; }

/* ⑥ 联络卡 contact：深蓝封面 + 居中身份 + 业务标签 + 拨号卡（扫码即联系） */
.cv-tpl-contact { background: var(--t-bg); }
.cv-tpl-contact .cv-cover { height: 150px; border-radius: 0 0 20px 20px; background: var(--t-cover); }
.cv-tpl-contact .cv-main { margin-top: -34px; }
.cv-tpl-contact .cv-profile { border-radius: 12px; border: 1px solid var(--line, #dbe4f5); box-shadow: 0 8px 24px rgba(30,64,175,.12); padding: 20px 18px; align-items: center; background: var(--t-surface); }
.cv-tpl-contact .cv-avatar { border-radius: 10px; width: 78px; height: 78px; flex-basis: 78px; border: 2px solid #fff; box-shadow: 0 4px 14px rgba(0,0,0,.2); }
.cv-tpl-contact .cv-name { color: var(--t-text); font-size: 24px; letter-spacing: .5px; }
.cv-tpl-contact .cv-title { color: var(--t-accent); font-weight: 600; }
.cv-tpl-contact .cv-tags span { border-radius: 4px; border: 1px solid var(--t-accent); background: color-mix(in srgb, var(--t-accent) 8%, #fff); color: var(--t-accent); padding: 4px 10px; }
.cv-tpl-contact .cv-actions { border-radius: 12px; border: 1px solid var(--line, #dbe4f5); background: var(--t-surface); }
.cv-tpl-contact .cv-actions i { border-radius: 10px; background: color-mix(in srgb, var(--t-accent) 10%, #fff); color: var(--t-accent); }
.cv-tpl-contact .card { border-radius: 12px; }
.cv-tpl-contact .cv-block h3, .cv-tpl-contact .cv-sec-title { color: var(--t-text); border-left: 3px solid var(--t-accent); }
.cv-tpl-contact .cv-exchange { background: color-mix(in srgb, var(--t-accent) 8%, #fff); }
.cv-tpl-contact .cv-dock { background: #0b1a3a; border-top: 2px solid var(--t-accent); }
.cv-tpl-contact .cv-dock .btn-ghost { background: rgba(255,255,255,.14); color: #fff; }

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
