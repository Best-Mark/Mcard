<template>
  <div class="cp-wrap">
    <div class="cp-hint">正在编辑：<b>{{ sectionLabel }}</b> · 下方即时更新（未保存也能看到）</div>
    <div ref="screen" class="cp-screen" :class="'cp-tpl-' + (card.template || 'classic')" :style="vars">
      <div class="cp-cover">
        <div class="cp-brand">M<em>Card</em></div>
      </div>

      <div class="cp-body">
        <div class="cp-profile" data-sec="identity">
          <div class="cp-avatar">
            <img v-if="card.avatar || card.logo" :src="card.avatar || card.logo" :alt="card.name" />
            <span v-else>{{ (card.name || '名').slice(0, 1) }}</span>
          </div>
          <div class="cp-ident">
            <div class="cp-name">{{ card.name || card.name_en || '你的姓名' }}
              <span v-if="card.name_en" class="cp-en">{{ card.name_en }}</span>
            </div>
            <div class="cp-title">{{ displayTitle || '职位 · 公司 · 部门' }}</div>
            <div v-if="tags.length" class="cp-tags"><span v-for="tag in tags" :key="tag">{{ tag }}</span></div>
          </div>
        </div>

        <div class="cp-actions" data-sec="contact">
          <button v-for="a in actions" :key="a.key" type="button">
            <i><AppIcon :name="a.icon" :size="18" /></i><span>{{ a.label }}</span>
          </button>
        </div>

        <div v-if="card.market_opt_in || card.industry" class="cp-block" data-sec="market">
          <h3>名片集市 <span>· 上架状态即时生效</span></h3>
          <div class="cp-market-row"><span>上架</span><b :class="{ 'cp-on': card.market_opt_in }">{{ card.market_opt_in ? '✓ 已上架 · 可被附近客户搜到' : '○ 未上架' }}</b></div>
          <div v-if="card.industry" class="cp-market-row"><span>行业</span><b>{{ industryLabel }}</b></div>
          <div v-if="regionLine" class="cp-market-row"><span>地区</span><b>{{ regionLine }}</b></div>
        </div>

        <div v-if="contactFields.length" class="cp-block" data-sec="contact">
          <h3>联系方式 <span>· 点右侧复制</span></h3>
          <div v-for="f in contactFields" :key="f.key" class="cp-contact-row">
            <div class="cp-contact-label">{{ f.label }}</div>
            <div class="cp-contact-value">{{ f.value }}</div>
            <button type="button" class="cp-mini-btn">复制</button>
          </div>
        </div>

        <div v-if="card.bio" class="cp-block" data-sec="bio">
          <h3>关于我</h3><p class="cp-bio">{{ card.bio }}</p>
        </div>

        <div v-if="card.company_intro" class="cp-block" data-sec="bio">
          <h3>公司简介 <span v-if="card.company">· {{ card.company }}</span></h3>
          <p class="cp-bio">{{ card.company_intro }}</p>
        </div>

        <div v-if="card.links?.length" class="cp-block" data-sec="links">
          <h3>更多链接</h3>
          <div class="cp-links">
            <div v-for="(l, i) in card.links" :key="i"><b>{{ l.label || '链接' }}</b><span>{{ shortUrl(l.url) }}</span></div>
          </div>
        </div>

        <div v-if="siteLinks.length" class="cp-block" data-sec="links">
          <h3>主页与店铺</h3>
          <div v-for="l in siteLinks" :key="l.key" class="cp-site">
            <div><b>{{ l.label }}</b><span>{{ shortUrl(l.url) }}</span></div>
            <button type="button" class="cp-mini-btn">打开</button>
          </div>
        </div>

        <div v-if="materials.length" class="cp-block" data-sec="materials">
          <h3>相册 <span>· 点开直接看</span></h3>
          <div v-for="(m, i) in materials" :key="m.id || i" class="cp-material-row">
            <span><AppIcon :name="m.type === 'file' ? 'file' : 'link'" :size="16" /></span>
            <span class="cp-material-title">{{ m.title || '未命名资料' }}</span>
            <span>查看 ›</span>
          </div>
        </div>

        <div v-if="contactQrs.length" class="cp-block" data-sec="qr">
          <h3>加好友 / 收付款</h3>
          <div class="cp-qr-grid">
            <div v-for="q in contactQrs" :key="q.key" class="cp-qr-tile">
              <img :src="q.url" :alt="q.label" />
              <b>{{ q.label }}</b>
              <span v-if="q.account">{{ q.account }}</span>
            </div>
          </div>
        </div>

        <div v-if="fullAddress" class="cp-block" data-sec="contact">
          <h3>地址</h3>
          <div v-if="regionLine" class="cp-region-line">{{ regionLine }}</div>
          <div class="cp-address">{{ fullAddress }}</div>
          <div v-if="card.latitude != null && card.longitude != null" class="cp-geo">⌖ {{ card.latitude.toFixed(4) }}, {{ card.longitude.toFixed(4) }}</div>
          <button type="button" class="cp-map-btn">导航</button>
        </div>

        <div class="cp-block cp-center">
          <h3>分享这张名片</h3>
          <img v-if="qrUrl" :src="qrUrl" class="cp-share-qr" alt="名片二维码" />
          <p class="cp-foot">资料可改 · 二维码不变</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import AppIcon from './AppIcon.vue'
import { themeOf, themeVars } from '../utils/themes'

const props = defineProps({
  card: { type: Object, required: true },
  tags: { type: Array, default: () => [] },
  materials: { type: Array, default: () => [] },
  qrUrl: { type: String, default: '' },
  section: { type: String, default: 'identity' },
  industries: { type: Array, default: () => [] }
})

const screen = ref(null)
const industryLabel = computed(() => {
  const hit = (props.industries || []).find(i => i.key === props.card.industry)
  return hit ? hit.label : (props.card.industry || '未选择')
})
const vars = computed(() => themeVars(themeOf(props.card)))
const SECTION_LABELS = {
  identity: '身份信息', bio: '简介与标签', contact: '联系方式', qr: '二维码',
  links: '更多链接', materials: '资料夹', market: '名片集市', appearance: '外观风格'
}
const sectionLabel = computed(() => SECTION_LABELS[props.section] || '身份信息')

const displayTitle = computed(() => {
  const c = props.card || {}
  const parts = c.template === 'navygold' ? [c.title, c.department] : [c.title, c.company, c.department]
  return parts.filter(Boolean).join(' · ')
})
const regionLine = computed(() => {
  const c = props.card || {}
  return [c.province, c.city, c.district, c.street].filter(Boolean).join(' · ')
})
const fullAddress = computed(() => {
  const c = props.card || {}
  const region = [c.province, c.city, c.district, c.street].filter(Boolean).join('')
  return [region, c.address, c.address_detail].filter(Boolean).join(' ')
})
const contactFields = computed(() => {
  const c = props.card || {}
  return [
    { key: 'mobile', label: '手机', value: c.mobile },
    { key: 'phone', label: '座机', value: c.phone },
    { key: 'email', label: '邮箱', value: c.email },
    { key: 'wechat', label: '微信', value: c.wechat },
    { key: 'alipay', label: '支付宝', value: c.alipay },
    { key: 'whatsapp', label: 'WhatsApp', value: c.whatsapp }
  ].filter(f => f.value)
})
const actions = computed(() => {
  const c = props.card || {}
  const arr = []
  if (c.mobile || c.phone) arr.push({ key: 'tel', icon: 'phone', label: '打电话' })
  if (c.mobile) arr.push({ key: 'sms', icon: 'sms', label: '发短信' })
  if (c.email) arr.push({ key: 'mail', icon: 'mail', label: '写邮件' })
  if (c.wechat || c.whatsapp) arr.push({ key: 'wechat', icon: 'wechat', label: '微信' })
  if (c.alipay) arr.push({ key: 'alipay', icon: 'alipay', label: '支付宝' })
  return arr
})
const contactQrs = computed(() => {
  const c = props.card || {}
  return [
    { key: 'wechat_qr', url: c.wechat_qr, label: '微信 · 加好友', account: c.wechat },
    { key: 'alipay_qr', url: c.alipay_qr, label: '支付宝 · 加好友', account: c.alipay },
    { key: 'wechat_pay_qr', url: c.wechat_pay_qr, label: '微信 · 收款码', account: '' },
    { key: 'alipay_pay_qr', url: c.alipay_pay_qr, label: '支付宝 · 收款码', account: '' }
  ].filter(q => q.url)
})
const siteLinks = computed(() => {
  const c = props.card || {}
  const arr = []
  if (c.website) arr.push({ key: 'website', label: '公司主页', url: c.website })
  if (c.shop_url) arr.push({ key: 'shop', label: '店铺主页', url: c.shop_url })
  return arr
})
function shortUrl(u) { return String(u || '').replace(/^https?:\/\//, '').slice(0, 24) }

// 每改一项自动滚到对应区块，让用户当场看到变化（集市/外观无独立区块，滚回顶部看整体）
watch(() => props.section, async () => {
  await nextTick()
  const box = screen.value
  if (!box) return
  const selector = props.section === 'market' || props.section === 'appearance'
    ? null
    : `[data-sec="${props.section}"]`
  const el = selector ? box.querySelector(selector) : null
  box.scrollTo({ top: el ? el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 6 : 0, behavior: 'smooth' })
})
</script>

<style scoped>
.cp-wrap { display: flex; flex-direction: column; gap: 8px; }
.cp-hint { font-size: 11px; color: var(--muted); background: #eff6ff; border: 1px solid #dbeafe; border-radius: 8px; padding: 7px 10px; line-height: 1.5; }
.cp-hint b { color: var(--primary); }
.cp-screen { height: min(72vh, 760px); overflow-y: auto; background: var(--t-bg); color: var(--t-text); border: 1px solid var(--line); border-radius: 14px; position: relative; scroll-behavior: smooth; }
.cp-cover { height: 92px; position: relative; border-radius: 0 0 18px 18px; background: var(--t-cover); }
.cp-brand { position: absolute; right: 12px; top: 12px; color: #fff; font-weight: 800; font-size: 13px; opacity: .9; }
.cp-brand em { font-style: normal; opacity: .75; }
.cp-body { padding: 0 10px 14px; margin-top: -24px; position: relative; }
.cp-profile { display: flex; gap: 10px; align-items: flex-start; padding: 12px; background: var(--t-surface); border-radius: 12px; border: 1px solid var(--line); }
.cp-avatar { flex: 0 0 52px; width: 52px; height: 52px; border-radius: 12px; overflow: hidden; background: var(--t-accent); color: #fff; display: grid; place-items: center; font-size: 22px; font-weight: 800; }
.cp-avatar img { width: 100%; height: 100%; object-fit: cover; }
.cp-ident { flex: 1; min-width: 0; }
.cp-name { font-size: 17px; font-weight: 800; line-height: 1.25; word-break: break-all; }
.cp-en { display: block; font-size: 10px; color: var(--t-muted); font-weight: 500; }
.cp-title { color: var(--t-accent); font-size: 11px; font-weight: 600; margin-top: 3px; line-height: 1.4; }
.cp-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.cp-tags span { font-size: 10px; padding: 2px 7px; border-radius: 999px; background: rgba(0,0,0,.05); background: color-mix(in srgb, var(--t-accent) 12%, transparent); color: var(--t-accent); font-weight: 600; }
.cp-actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(48px, 1fr)); gap: 2px; margin-top: 10px; padding: 8px 4px; background: var(--t-surface); border-radius: 12px; border: 1px solid var(--line); }
.cp-actions button { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 10px; color: var(--t-muted); }
.cp-actions i { font-style: normal; width: 30px; height: 30px; border-radius: 50%; background: rgba(0,0,0,.05); background: color-mix(in srgb, var(--t-accent) 12%, transparent); color: var(--t-accent); display: grid; place-items: center; }
.cp-block { margin-top: 10px; padding: 12px; background: var(--t-surface); border-radius: 12px; border: 1px solid var(--line); }
.cp-block h3 { font-size: 13px; margin: 0 0 8px; padding-left: 8px; border-left: 3px solid var(--t-accent); line-height: 1.3; }
.cp-block h3 span { font-size: 10px; font-weight: 400; color: var(--t-muted); }
.cp-contact-row { display: flex; align-items: center; gap: 6px; padding: 7px 0; border-bottom: 1px solid var(--line); }
.cp-contact-row:last-child { border-bottom: 0; }
.cp-contact-label { flex: 0 0 44px; font-size: 10px; color: var(--t-muted); }
.cp-contact-value { flex: 1; min-width: 0; font-size: 11px; word-break: break-all; }
.cp-mini-btn { font-size: 10px; color: var(--t-accent); border: 1px solid var(--line); border-radius: 6px; padding: 2px 6px; background: transparent; }
.cp-bio { color: var(--t-muted); font-size: 11px; white-space: pre-wrap; line-height: 1.55; margin: 0; }
.cp-links { display: grid; gap: 6px; }
.cp-links div { border: 1px solid var(--line); border-radius: 8px; padding: 7px 9px; display: flex; flex-direction: column; background: var(--t-bg); }
.cp-links b { font-size: 11px; }
.cp-links span { font-size: 9px; color: var(--t-muted); }
.cp-site { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 7px 0; border-bottom: 1px solid var(--line); }
.cp-site:last-child { border-bottom: 0; }
.cp-site div { display: flex; flex-direction: column; min-width: 0; }
.cp-site b { font-size: 11px; }
.cp-site span { font-size: 9px; color: var(--t-muted); }
.cp-material-row { display: flex; align-items: center; gap: 8px; padding: 7px 0; border-bottom: 1px solid var(--line); font-size: 11px; }
.cp-material-row:last-child { border-bottom: 0; }
.cp-material-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cp-market-row { display: flex; gap: 8px; padding: 4px 0; font-size: 10px; }
.cp-market-row > span { flex: 0 0 32px; color: var(--t-muted); }
.cp-market-row b { font-weight: 500; }
.cp-market-row b.cp-on { color: #0f766e; font-weight: 700; }
.cp-qr-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.cp-qr-tile { display: flex; flex-direction: column; align-items: center; gap: 3px; border: 1px solid var(--line); border-radius: 8px; padding: 8px 4px; text-align: center; }
.cp-qr-tile img { width: 84px; height: 84px; object-fit: contain; background: #fff; border-radius: 5px; }
.cp-qr-tile b { font-size: 10px; }
.cp-qr-tile span { font-size: 9px; color: var(--t-muted); word-break: break-all; }
.cp-region-line { font-size: 11px; font-weight: 600; color: var(--t-accent); margin-bottom: 4px; }
.cp-address { font-size: 11px; line-height: 1.5; }
.cp-geo { font-size: 9px; color: var(--t-muted); margin-top: 4px; }
.cp-map-btn { width: 100%; margin-top: 8px; padding: 8px; border: 0; border-radius: 8px; background: var(--t-accent); color: #fff; font-size: 11px; }
.cp-center { text-align: center; }
.cp-center h3 { text-align: left; }
.cp-share-qr { width: 110px; height: 110px; object-fit: contain; background: #fff; border: 1px solid var(--line); border-radius: 8px; padding: 4px; }
.cp-foot { font-size: 9px; color: var(--t-muted); margin: 8px 0 0; }

/* 模板骨架差异（与公开名片页同口径），让换模板当场可见 */
.cp-tpl-minimal .cp-cover { height: 40px; border-radius: 0; background: var(--t-surface); border-bottom: 1px solid var(--line); }
.cp-tpl-minimal .cp-brand { color: var(--t-text); }
.cp-tpl-minimal .cp-body { margin-top: 0; }
.cp-tpl-minimal .cp-block, .cp-tpl-minimal .cp-profile, .cp-tpl-minimal .cp-actions { border-radius: 0; border: 0; border-bottom: 1px solid var(--line); box-shadow: none; }
.cp-tpl-minimal .cp-avatar { border-radius: 50%; }
.cp-tpl-elite .cp-profile { flex-direction: column; align-items: center; text-align: center; }
.cp-tpl-elite .cp-avatar { border-radius: 50%; border: 2px solid var(--t-accent); }
.cp-tpl-elite .cp-name { letter-spacing: 1px; }
.cp-tpl-vivid .cp-cover { height: 108px; border-radius: 0 0 26px 26px; }
.cp-tpl-vivid .cp-profile, .cp-tpl-vivid .cp-block { border-radius: 16px; }
.cp-tpl-vivid .cp-avatar { border-radius: 16px; }
.cp-tpl-seal .cp-cover { border-radius: 0; border-bottom: 3px solid #1e3a8a; }
.cp-tpl-seal .cp-profile, .cp-tpl-seal .cp-block, .cp-tpl-seal .cp-actions { border-radius: 0; border: 1px solid #cbd5e1; }
.cp-tpl-contact .cp-cover { border-radius: 0 0 12px 12px; }
.cp-tpl-contact .cp-name { color: #0f2147; }
</style>
