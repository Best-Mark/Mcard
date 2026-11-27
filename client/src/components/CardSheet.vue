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
          <button v-if="showEdit" class="cv-inline-edit" type="button" @click="$emit('edit')" title="编辑名片资料" aria-label="编辑名片资料">✎</button>
        </div>
        <div :class="['cv-title', { 'cv-qe-on': qeOn('title') }]" @click="qeTap($event,'title')">{{ displayTitle || '点击进入编辑，完善你的职业信息' }}</div>
        <button v-if="qeOn('title')" class="cv-qe-tag" type="button" @click.stop="editField('title')">✎ 改职位 / 部门</button>
        <div v-if="displayOrg" :class="['cv-org', { 'cv-qe-on': qeOn('company') }]" @click="qeTap($event,'company')">{{ displayOrg }}</div>
        <button v-if="qeOn('company')" class="cv-qe-tag" type="button" @click.stop="editField('company')">✎ 改公司</button>
        <div v-if="tagList.length" :class="['cv-tags', { 'cv-qe-on': qeOn('tags') }]" @click="qeTap($event,'tags')"><span v-for="tag in tagList" :key="tag">{{ tag }}</span></div>
        <button v-if="qeOn('tags')" class="cv-qe-tag" type="button" @click.stop="editField('tags')">✎ 改标签</button>
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
    <div v-if="full && (contactFields.length || fullAddress)" class="card card-pad cv-block" data-sec="contact">
      <h3>联系方式 <span class="small muted">· {{ quickEdit ? '点字段出「✎ 改这项」' : '点一行即复制该字段' }}</span></h3>
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
    </div>

    <template v-if="full">
      <div v-if="introText" class="card card-pad cv-block" data-sec="bio">
        <h3>简介</h3>
        <p :class="['cv-bio', { 'cv-qe-on': qeOn('bio') }]" @click="qeTap($event,'bio')">{{ introText }}</p>
        <button v-if="qeOn('bio')" class="cv-qe-tag" type="button" @click.stop="editField('bio')">✎ 改简介</button>
      </div>

      <div v-if="card.links?.length" class="card card-pad cv-block" data-sec="links">
        <h3>更多链接</h3>
        <div class="cv-links">
          <a v-for="(l, i) in card.links" :key="i" :href="safeUrl(l.url)" target="_blank" rel="noopener">
            <b>{{ l.label || '链接' }}</b><span>{{ shortUrl(l.url) }} ↗</span>
          </a>
        </div>
      </div>

      <div v-if="siteLinks.length" class="card card-pad cv-block" data-sec="links">
        <h3>主页与店铺</h3>
        <div v-for="l in siteLinks" :key="l.key" class="cv-site">
          <div :class="{ 'cv-qe-on': qeOn(l.key) }" @click="qeTap($event,l.key)"><b>{{ l.label }}</b><span class="small muted">{{ shortUrl(l.url) }}</span></div>
          <button v-if="qeOn(l.key)" class="cv-qe-tag" type="button" @click.stop="editField(l.key)">✎ 改网址</button>
          <div class="btn-row">
            <a :href="safeUrl(l.url)" target="_blank" rel="noopener" class="btn btn-sm btn-primary btn-icon" :title="'打开' + l.label" :aria-label="'打开' + l.label"><AppIcon name="link" :size="15" /></a>
            <button class="btn btn-sm btn-ghost btn-icon" type="button" :title="'复制' + l.label" :aria-label="'复制' + l.label" @click="onCopy(l.url, l.label)"><AppIcon name="copy" :size="15" /></button>
          </div>
        </div>
      </div>

      <slot name="after-address" />

      <div v-if="materials.length" class="card card-pad cv-block" data-sec="materials">
        <h3>相册 <span class="small muted">· 点开直接看</span></h3>
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
  showEdit: { type: Boolean, default: false },
  // 快捷编辑（2026-11-27 用户定稿）：仅 owner 工作台开启。两段式——点字段只选中并浮出编辑标，
  // 点标才 emit('edit-field') 弹层改这一项；公开页/编辑预览/配色预览默认 false，行为零变化。
  quickEdit: { type: Boolean, default: false }
})
const emit = defineEmits(['copy', 'tel', 'sms', 'mailto', 'edit', 'qr', 'open-gallery', 'open-material', 'map', 'edit-field'])

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
