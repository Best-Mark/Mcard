<template>
  <!--
    名片卡信息区唯一真相源（2026-11-26 重构）：真实名片页 CardView、编辑预览 CardEdit、
    配色预览 CardStyle、集市预览 CardMarket 都渲染本组件，保证「同一套卡片、只在辅助功能上区别」。
    视觉样式全部来自 styles/card-sheet.css（全局，18 套模板规则在此）。
    本组件只负责信息展示；拨号/复制/导航/二维码/编辑等操作通过 emit 交给所在页面处理，
    预览页面不接事件即为静态示意，不会出现跳转/分享等副作用。
    信息/操作分层约定见 CardView.vue 顶部注释，本组件只含信息层。
  -->
  <div class="container cv-main">
    <div class="cv-profile card" data-sec="identity" :data-wm="wmText">
      <span class="cv-sheen" aria-hidden="true"></span>
      <div :class="['cv-avatar', { 'is-logo': !!card.logo, 'cv-qe-on': qeOn('logo') }]" @click="qeTap($event,'logo')">
        <img v-if="card.logo || card.avatar" :src="card.logo || card.avatar" :alt="card.logo ? ((card.company || '公司') + ' LOGO') : card.name" />
        <span v-else>{{ (card.name || '名').slice(0, 1) }}</span>
      </div>
      <div class="cv-ident">
        <!-- 快捷编辑（owner 工作台）：点字段 → 后面浮出「✎ 改这项」标 → 点标弹层只改这一项。
             quickEdit=false（公开页/编辑预览/配色预览）时所有点击行为保持原样。 -->
        <button v-if="qeOn('logo')" class="cv-qe-tag" type="button" @click.stop="editField('logo')">✎ 改头像 / LOGO</button>
        <div class="cv-name-row">
          <div :class="['cv-name', { 'cv-qe-on': qeOn('name') }]" @click="qeTap($event,'name')">{{ card.name || card.name_en || '未填写姓名' }}
            <span v-if="card.name_en" :class="['cv-en', { 'cv-qe-on': qeOn('name_en') }]" @click="qeTap($event,'name_en')">{{ card.name_en }}</span>
          </div>
          <button v-if="qeOn('name')" class="cv-qe-tag" type="button" @click.stop="editField('name')">✎ 改姓名</button>
          <button v-if="qeOn('name_en')" class="cv-qe-tag" type="button" @click.stop="editField('name_en')">✎ 改英文名</button>
        </div>
        <div :class="['cv-title', { 'cv-qe-on': qeOn('title') }]" @click="qeTap($event,'title')">{{ displayTitle || '点击进入编辑，完善你的职业信息' }}</div>
        <button v-if="qeOn('title')" class="cv-qe-tag" type="button" @click.stop="editField('title')">✎ 改职位 / 部门</button>
        <div v-if="displayOrg" :class="['cv-org', { 'cv-qe-on': qeOn('company') }]" @click="qeTap($event,'company')">{{ displayOrg }}</div>
        <button v-if="qeOn('company')" class="cv-qe-tag" type="button" @click.stop="editField('company')">✎ 改公司</button>
        <div v-if="tagList.length" :class="['cv-tags', { 'cv-qe-on': qeOn('tags') }]" @click="qeTap($event,'tags')"><span v-for="tag in tagList" :key="tag">{{ tag }}</span></div>
        <button v-if="qeOn('tags')" class="cv-qe-tag" type="button" @click.stop="editField('tags')">✎ 改标签</button>
        <!-- 未填字段的占位胶囊：点中直接弹编辑层 -->
        <div v-if="ghostFields('identity').length" class="cv-qe-ghosts">
          <button v-for="g in ghostFields('identity')" :key="g.key" class="cv-qe-ghost" type="button" @click.stop="editField(g.key)">＋ {{ g.label }}</button>
        </div>
      </div>
      <!-- 二维码是信息入口：小图常驻姓名区右上角，点击弹层放大；正文不摆大块二维码卡 -->
      <button v-if="qrUrl" class="cv-qr-entry" type="button" @click="$emit('qr')" title="扫码打开名片 · 点击放大" aria-label="查看名片二维码">
        <img :src="qrUrl" alt="名片二维码" />
      </button>
      <span v-if="!card.active" class="badge warn cv-status">未开通 / 已到期</span>
    </div>

    <!-- 各页面特有辅助块（未开通提示/集市展示状态）由 slot 注入，卡片本体不含业务流程 -->
    <slot name="after-profile" />

    <!-- 地址本身属于联系信息，作为本卡最后一行（2026-11-26 用户定），不再单独成块 -->
    <div v-if="full && (contactFields.length || fullAddress || quickEdit)" class="card card-pad cv-block" data-sec="contact">
      <h3>联系方式 <span class="small muted">· {{ quickEdit ? '点字段或＋号即可修改' : '点一行即复制该字段' }}</span></h3>
      <div v-for="f in contactFields" :key="f.key" :class="['cv-contact-row', { 'cv-qe-on': qeOn(f.key) }]" @click="onRowTap(f)">
        <div class="cv-contact-label">{{ f.label }}：</div>
        <div class="cv-contact-value">{{ f.value }}</div>
        <div v-if="interactive" class="cv-contact-acts" @click.stop>
          <button v-if="f.key === 'mobile' || f.key === 'phone'" class="cv-row-act" type="button" :title="'拨打 ' + f.value" :aria-label="'拨打 ' + f.value" @click="$emit('tel', f.value)"><AppIcon name="phone" :size="14" /></button>
          <button v-if="f.key === 'mobile'" class="cv-row-act" type="button" :title="'发短信给 ' + f.value" :aria-label="'发短信给 ' + f.value" @click="$emit('sms', f.value)"><AppIcon name="sms" :size="14" /></button>
          <button v-if="f.key === 'email'" class="cv-row-act" type="button" :title="'发邮件到 ' + f.value" :aria-label="'发邮件到 ' + f.value" @click="$emit('mailto', f.value)"><AppIcon name="mail" :size="14" /></button>
        </div>
        <button v-if="qeOn(f.key)" class="cv-qe-tag" type="button" @click.stop="editField(f.key)">✎ 改这项</button>
      </div>
      <div v-if="fullAddress" :class="['cv-contact-row', { 'cv-qe-on': qeOn('address') }]" @click="onAddressTap">
        <div class="cv-contact-label">地址：</div>
        <div class="cv-contact-value">
          <span v-if="regionLine">{{ regionLine }}</span>
          <span v-if="detailAddress">{{ detailAddress }}</span>
        </div>
        <div v-if="interactive && maps.length" class="cv-contact-acts" @click.stop>
          <button class="cv-row-act" type="button" title="地图导航" aria-label="地图导航" @click="$emit('map')"><AppIcon name="nav" :size="14" /></button>
        </div>
        <button v-if="qeOn('address')" class="cv-qe-tag" type="button" @click.stop="editField('address')">✎ 改地址</button>
      </div>
      <!-- 未填的联系方式/地址占位胶囊；收款码已传时给「✎ 改收款码」入口（上传在快捷编辑弹层里） -->
      <div v-if="ghostFields('contact').length || !hasAddress || (quickEdit && payQrSet)" class="cv-qe-ghosts">
        <button v-for="g in ghostFields('contact')" :key="g.key" class="cv-qe-ghost" type="button" @click.stop="editField(g.key)">＋ {{ g.label }}</button>
        <button v-if="!hasAddress" class="cv-qe-ghost" type="button" @click.stop="editField('address')">＋ 地址</button>
        <button v-if="quickEdit && payQrSet" class="cv-qe-ghost" type="button" @click.stop="editField('pay_qr')">✎ 改收款码</button>
      </div>
    </div>

    <template v-if="full">
      <div v-if="introText || quickEdit" class="card card-pad cv-block" data-sec="bio">
        <h3>简介</h3>
        <template v-if="introText">
          <p :class="['cv-bio', { 'cv-qe-on': qeOn('bio') }]" @click="qeTap($event,'bio')">{{ introText }}</p>
          <button v-if="qeOn('bio')" class="cv-qe-tag" type="button" @click.stop="editField('bio')">✎ 改简介</button>
        </template>
        <button v-else class="cv-qe-ghost cv-qe-ghost-block" type="button" @click.stop="editField('bio')">＋ 简介</button>
      </div>

      <!-- 更多链接（自定义链接多条）：集合型数据与相册同口径——快捷编辑弹「管理链接」整组增删改 -->
      <div v-if="(card.links && card.links.length) || quickEdit" class="card card-pad cv-block" data-sec="links">
        <h3>更多链接 <span v-if="quickEdit" class="small muted">· 点「管理链接」增删改</span>
          <button v-if="quickEdit" class="cv-qe-tag" type="button" @click.stop="editField('links')">✎ 管理链接</button>
        </h3>
        <div class="cv-links">
          <a v-for="(l, i) in (card.links || [])" :key="i" :href="safeUrl(l.url)" target="_blank" rel="noopener">
            <b>{{ l.label || '链接' }}</b><span>{{ shortUrl(l.url) }} ↗</span>
          </a>
        </div>
        <button v-if="quickEdit && !(card.links && card.links.length)" class="cv-qe-ghost cv-qe-ghost-block" type="button" @click.stop="editField('links')">＋ 添加链接（作品集 / 公众号 等）</button>
      </div>

      <div v-if="siteLinks.length || quickEdit" class="card card-pad cv-block" data-sec="links">
        <h3>主页与店铺</h3>
        <div v-for="l in siteLinks" :key="l.key" class="cv-site">
          <div :class="{ 'cv-qe-on': qeOn(l.key) }" @click="qeTap($event,l.key)"><b>{{ l.label }}</b><span class="small muted">{{ shortUrl(l.url) }}</span></div>
          <button v-if="qeOn(l.key)" class="cv-qe-tag" type="button" @click.stop="editField(l.key)">✎ 改网址</button>
          <div class="btn-row">
            <a :href="safeUrl(l.url)" target="_blank" rel="noopener" class="btn btn-sm btn-primary btn-icon" :title="'打开' + l.label" :aria-label="'打开' + l.label"><AppIcon name="link" :size="15" /></a>
            <button class="btn btn-sm btn-ghost btn-icon" type="button" :title="'复制' + l.label" :aria-label="'复制' + l.label" @click="onCopy(l.url, l.label)"><AppIcon name="copy" :size="15" /></button>
          </div>
        </div>
        <!-- 未填的主页/店铺占位胶囊 -->
        <div v-if="ghostFields('links').length" class="cv-qe-ghosts">
          <button v-for="g in ghostFields('links')" :key="g.key" class="cv-qe-ghost" type="button" @click.stop="editField(g.key)">＋ {{ g.label }}</button>
        </div>
      </div>

      <slot name="after-address" />

      <!-- 快捷编辑·公司相册（2026-11-27）：quickEdit 模式下区块常驻（空相册也能点进来传图），
           头部「✎ 管理相册」直接弹管理弹层（集合型数据不做两段式选中）；公开页行为不变。 -->
      <div v-if="materials.length || quickEdit" class="card card-pad cv-block" data-sec="materials">
        <h3>相册 <span class="small muted">· {{ quickEdit ? '点「管理相册」上传图片' : '点开直接看' }}</span>
          <button v-if="quickEdit" class="cv-qe-tag" type="button" @click.stop="editField('gallery')">✎ 管理相册</button>
        </h3>
        <div class="cv-gallery">
          <template v-for="m in materials" :key="m.id || m.title">
            <button v-if="isImageMaterial(m)" class="cv-gallery-cell" type="button" @click="$emit('open-gallery', m)">
              <img :src="fullUrl(m.url)" :alt="m.title || '相册图片'" loading="lazy" />
              <span>{{ m.title }}</span>
            </button>
            <button v-else class="cv-gallery-cell cv-gallery-file" type="button" @click="$emit('open-material', m)">
              <span class="cv-gallery-file-ico"><AppIcon :name="m.type === 'file' ? 'file' : 'link'" :size="24" /></span>
              <span>{{ m.title || '未命名资料' }}</span>
              <small>{{ m.type === 'link' ? '网页链接' : '文件' }}</small>
            </button>
          </template>
          <button v-if="quickEdit && !materials.length" class="cv-qe-ghost cv-qe-ghost-block" type="button" @click.stop="editField('gallery')">＋ 上传公司相册图片</button>
        </div>
      </div>
    </template>

    <p class="cv-footer">由 <b>{{ siteName }}</b> 提供技术支持</p>

  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import AppIcon from './AppIcon.vue'
import { mapLinks } from '../utils/share'
import { siteConfig } from '../store'

const props = defineProps({
  card: { type: Object, required: true },
  tags: { type: Array, default: () => [] },
  materials: { type: Array, default: () => [] },
  industries: { type: Array, default: () => [] },
  siteName: { type: String, default: '' },
  qrUrl: { type: String, default: '' },
  full: { type: Boolean, default: true },
  interactive: { type: Boolean, default: false },
  // 快捷编辑（2026-11-27 用户定稿；2026-11-28 起封面 ✎ 完整表单入口一并撤掉，编辑全走快捷编辑）：
  // 仅 owner 工作台开启。两段式——点字段只选中并浮出编辑标，点标才 emit('edit-field') 弹层改这一项；
  // 集合型数据（更多链接/相册）走独立管理弹层。公开页/编辑预览/配色预览默认 false，行为零变化。
  quickEdit: { type: Boolean, default: false }
})
const emit = defineEmits(['copy', 'tel', 'sms', 'mailto', 'qr', 'open-gallery', 'open-material', 'map', 'edit-field'])

const quickField = ref('')
const qeOn = key => props.quickEdit && quickField.value === key
// quickEdit=false 时连冒泡都不拦（公开页/预览页零影响）；开启时才 stop + 选中
function qeTap(e, key) {
  if (!props.quickEdit) return
  e.stopPropagation()
  tapField(key)
}
function tapField(key) {
  if (!props.quickEdit) return
  quickField.value = quickField.value === key ? '' : key // 再点同一字段取消选中
}
function editField(key) { quickField.value = ''; emit('edit-field', key) } // 点标即收起标记、交弹层
// owner 工作台：点联系方式/地址行不再复制，改为选中字段；右侧拨号/导航按钮仍 @click.stop 照常可用
function onRowTap(f) {
  if (!props.quickEdit) return onCopy(f.value, f.label)
  tapField(f.key)
}
function onAddressTap() {
  if (!props.quickEdit) return onCopy(fullAddress.value, '地址')
  tapField('address')
}

const siteName = computed(() => props.siteName || siteConfig?.site_name || '')
const tagList = computed(() => props.tags?.length ? props.tags : (props.card?.tags || []))
const wmText = computed(() => (props.card?.company || '').slice(0, 4))
const displayOrg = computed(() => props.card?.company || '')
const displayTitle = computed(() => {
  const c = props.card || {}
  return [c.title, c.department].filter(Boolean).join(' · ')
})
const introText = computed(() => props.card?.bio || props.card?.company_intro || '')
const CONTACT_LABELS = { mobile: '手机', phone: '座机', email: '邮箱', wechat: '微信', alipay: '支付宝', whatsapp: 'WhatsApp' }
const contactFields = computed(() => {
  const c = props.card || {}
  return Object.keys(CONTACT_LABELS)
    .map(key => ({ key, label: CONTACT_LABELS[key], value: c[key] }))
    .filter(f => f.value)
})
const siteLinks = computed(() => {
  const c = props.card || {}
  const arr = []
  if (c.website) arr.push({ key: 'website', label: '公司主页', url: c.website })
  if (c.shop_url) arr.push({ key: 'shop', label: '店铺主页', url: c.shop_url })
  return arr
})

// 空字段占位（2026-11-27 用户追问）：快捷编辑模式下没填的字段原来根本不渲染、点不到，
// 现在渲染虚线占位胶囊「＋ 字段名」，点击直接弹编辑层——空字段意图明确，无需两段式选中。
// 公开页 quickEdit=false，占位一个都不渲染，零影响。
const QE_GHOSTS = {
  identity: [
    { key: 'name_en', label: '英文名', test: c => !c.name_en },
    { key: 'company', label: '公司 / 品牌', test: c => !c.company },
    { key: 'tags', label: '标签', test: c => !(Array.isArray(c.tags) ? c.tags.length : c.tags) }
  ],
  contact: [
    { key: 'mobile', label: '手机号', test: c => !c.mobile },
    { key: 'phone', label: '座机', test: c => !c.phone },
    { key: 'email', label: '邮箱', test: c => !c.email },
    { key: 'wechat', label: '微信号', test: c => !c.wechat },
    { key: 'alipay', label: '支付宝', test: c => !c.alipay },
    { key: 'whatsapp', label: 'WhatsApp', test: c => !c.whatsapp },
    { key: 'pay_qr', label: '收款码', test: c => !c.wechat_pay_qr && !c.alipay_pay_qr }
  ],
  links: [
    { key: 'website', label: '公司主页', test: c => !c.website },
    { key: 'shop_url', label: '店铺主页', test: c => !c.shop_url }
  ]
}
const ghostFields = grp => (props.quickEdit ? QE_GHOSTS[grp].filter(g => g.test(props.card || {})) : [])
const hasAddress = computed(() => !!(regionLine.value || detailAddress.value))
const payQrSet = computed(() => !!(props.card?.wechat_pay_qr || props.card?.alipay_pay_qr))
const regionLine = computed(() => {
  const c = props.card || {}
  return [c.province, c.city, c.district, c.street].filter(Boolean).join(' · ')
})
const detailAddress = computed(() => {
  const c = props.card || {}
  return [c.address, c.address_detail].filter(Boolean).join(' ')
})
const fullAddress = computed(() => [regionLine.value.replace(/ · /g, ''), detailAddress.value].filter(Boolean).join(' '))
const maps = computed(() => {
  const c = props.card || {}
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
function shortUrl(u) { return String(u || '').replace(/^https?:\/\//, '').slice(0, 30) }
function safeUrl(u) {
  if (!u) return '#'
  const s = String(u).trim()
  const full = /^https?:\/\//i.test(s) ? s : `https://${s}`
  try { const x = new URL(full); return ['http:', 'https:'].includes(x.protocol) ? x.href : '#' } catch { return '#' }
}
function fullUrl(u) { return u ? new URL(u, window.location.origin).href : '' }
function isImageMaterial(m) {
  if (!m || m.type !== 'file') return false
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(m.url || '')
}
function onCopy(v, label) { if (props.interactive) emit('copy', v, label) }
</script>
