<template>
  <div class="cp-wrap">
    <!-- 预览与真实名片页共用 --cv-* 配色：挂同款 cv-clean / cv-tpl-*，配色由共享 card-template-palettes.css 注入 -->
    <div ref="screen" class="cp-screen" :class="['cp-tpl-' + (card.template || 'classic'), 'cv-clean', 'cv-tpl-' + (card.template || 'classic')]" :style="vars">
      <div class="cp-cover">
        <div class="cp-brand">M<em>Card</em></div>
      </div>

      <div class="cp-body">
        <div class="cp-profile" data-sec="identity">
          <div class="cp-avatar" :class="{ 'is-logo': !!card.logo }">
            <img v-if="card.logo || card.avatar" :src="card.logo || card.avatar" :alt="card.logo ? ((card.company || '公司') + ' LOGO') : card.name" />
            <span v-else>{{ (card.name || '名').slice(0, 1) }}</span>
          </div>
          <div class="cp-ident">
            <div class="cp-name">{{ card.name || card.name_en || '你的姓名' }}
              <span v-if="card.name_en" class="cp-en">{{ card.name_en }}</span>
            </div>
            <div class="cp-title">{{ displayTitle || '职位 · 部门' }}</div>
            <div v-if="card.company" class="cp-org">{{ card.company }}</div>
            <div v-if="tags.length" class="cp-tags"><span v-for="tag in tags" :key="tag">{{ tag }}</span></div>
          </div>
        </div>

        <div v-if="card.market_opt_in || card.industry" class="cp-block" data-sec="market">
          <h3>名片集市 <span>· 上架状态即时生效</span></h3>
          <div class="cp-market-row"><span>上架</span><b :class="{ 'cp-on': card.market_opt_in }">{{ card.market_opt_in ? '✓ 已上架 · 可被附近客户搜到' : '○ 未上架' }}</b></div>
          <div v-if="card.industry" class="cp-market-row"><span>行业</span><b>{{ industryLabel }}</b></div>
          <div v-if="regionLine" class="cp-market-row"><span>地区</span><b>{{ regionLine }}</b></div>
        </div>

        <div v-if="contactFields.length" class="cp-block" data-sec="contact">
          <h3>联系方式 <span>· 点一行复制</span></h3>
          <div v-for="f in contactFields" :key="f.key" class="cp-contact-row">
            <div class="cp-contact-label">{{ f.label }}：</div>
            <div class="cp-contact-value">{{ f.value }}</div>
            <span class="cp-contact-acts">
              <i v-if="f.key === 'mobile' || f.key === 'phone'">打电话</i>
              <i v-if="f.key === 'mobile'">短信</i>
              <i v-if="f.key === 'email'">邮件</i>
            </span>
          </div>
        </div>

        <!-- 与名片页同口径：只显示一个「简介」区块，存量 company_intro 回落 -->
        <div v-if="introText" class="cp-block" data-sec="bio">
          <h3>简介</h3><p class="cp-bio">{{ introText }}</p>
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

        <div v-if="fullAddress" class="cp-block" data-sec="contact">
          <h3>地址</h3>
          <div v-if="regionLine" class="cp-region-line">{{ regionLine }}</div>
          <div class="cp-address">
            <span v-if="detailAddress">地址：{{ detailAddress }}</span>
            <button type="button" class="cp-map-btn">导航</button>
          </div>
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
// 行业名称唯一真相源：先按传入的行业清单映射 key→label；未传清单时回落服务端随名片下发的
// industryLabel（/api/cards/mine、集市列表均已算好），绝不把原始 key（如 service）直接露给用户。
const industryLabel = computed(() => {
  const key = String(props.card?.industry || '').toLowerCase()
  if (!key) return '未选择'
  const hit = (props.industries || []).find(i => i.key === key)
  if (hit) return hit.label
  const serverLabel = String(props.card?.industryLabel || '')
  if (serverLabel && serverLabel !== key) return serverLabel
  return key
})
const vars = computed(() => themeVars(themeOf(props.card)))

// 与展示页同口径（2026-11-25）：公司名独立一行，职位行只放 title + department，不重复公司
const displayTitle = computed(() => {
  const c = props.card || {}
  return [c.title, c.department].filter(Boolean).join(' · ')
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
// 与名片页同口径：简介 bio 优先，存量 company_intro 回落
const introText = computed(() => props.card?.bio || props.card?.company_intro || '')
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
/* 实时预览配色唯一真相源 = ../styles/card-template-palettes.css 的 --cv-*（与真实名片页 CardView 同一套）。
   预览根节点挂同款 cv-clean / cv-tpl-<key>，共享 CSS 自动注入 18 套配色；组件内不再自建 --t-* 配色，
   保证「配色风格页所见 = 公开名片页所得」。下方统一层只管结构（一张连续大卡）。 */
.cp-wrap { display: flex; flex-direction: column; gap: 8px; }
.cp-screen { height: min(72vh, 760px); overflow-y: auto; background: var(--cv-page-bg); color: var(--cv-ink); border: 1px solid var(--cv-line, var(--line)); border-radius: 14px; position: relative; scroll-behavior: smooth; }
.cp-cover { height: 92px; position: relative; border-radius: 0 0 18px 18px; background: var(--cv-topbar-bg, var(--t-cover)); }
.cp-brand { position: absolute; right: 12px; top: 12px; color: var(--cv-brand-color, #fff); font-weight: 800; font-size: 13px; opacity: .9; }
.cp-brand em { font-style: normal; opacity: .75; }
.cp-body { padding: 0 10px 14px; margin-top: -24px; position: relative; }
.cp-profile { display: flex; gap: 10px; align-items: flex-start; padding: 12px; background: var(--cv-card-bg); border-radius: 12px; border: 1px solid var(--cv-line, var(--line)); }
.cp-avatar { flex: 0 0 52px; width: 52px; height: 52px; border-radius: 12px; overflow: hidden; background: var(--cv-btn-main-solid, var(--cv-btn-main-bg)); color: var(--cv-btn-main-color, #fff); display: grid; place-items: center; font-size: 22px; font-weight: 800; }
.cp-avatar img { width: 100%; height: 100%; object-fit: cover; }
.cp-avatar.is-logo { background: #fff; padding: 4px; }
.cp-avatar.is-logo img { object-fit: contain; }
.cp-ident { flex: 1; min-width: 0; }
.cp-name { font-size: 17px; font-weight: 800; line-height: 1.25; word-break: break-all; }
.cp-en { display: block; font-size: 10px; color: var(--cv-ink-2); font-weight: 500; }
.cp-title { color: var(--cv-role-color, var(--cv-block-title)); font-size: 11px; font-weight: 600; margin-top: 3px; line-height: 1.4; }
.cp-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.cp-tags span { font-size: 10px; padding: 2px 7px; border-radius: var(--cv-tag-radius, 999px); background: var(--cv-tag-bg, rgba(0,0,0,.05)); color: var(--cv-tag-color, var(--cv-ink)); font-weight: 600; }
.cp-block { margin-top: 10px; padding: 12px; background: var(--cv-panel-bg); border-radius: 12px; border: 1px solid var(--cv-line, var(--line)); }
.cp-block h3 { font-size: 13px; margin: 0 0 8px; padding-left: 8px; border-left: 3px solid var(--cv-block-title); line-height: 1.3; }
.cp-block h3 span { font-size: 10px; font-weight: 400; color: var(--cv-ink-2); }
.cp-contact-row { display: flex; align-items: center; gap: 6px; padding: 7px 0; border-bottom: 1px solid var(--cv-line, var(--line)); }
.cp-contact-row:last-child { border-bottom: 0; }
.cp-contact-label { flex: 0 0 44px; font-size: 10px; color: var(--cv-ink-2); }
.cp-contact-value { flex: 1; min-width: 0; font-size: 11px; word-break: break-all; }
.cp-contact-acts { display: flex; align-items: center; gap: 4px; flex: 0 0 auto; }
.cp-contact-acts i { font-style: normal; font-size: 9px; padding: 3px 5px; border-radius: 5px; background: var(--cv-mini-bg, rgba(0,0,0,.05)); color: var(--cv-mini-color, var(--cv-ink)); white-space: nowrap; }
.cp-bio { color: var(--cv-ink-2); font-size: 11px; white-space: pre-wrap; line-height: 1.55; margin: 0; }
.cp-links { display: grid; gap: 6px; }
.cp-links div { border: 1px solid var(--cv-line, var(--line)); border-radius: 8px; padding: 7px 9px; display: flex; flex-direction: column; background: var(--cv-panel-bg); }
.cp-links b { font-size: 11px; }
.cp-links span { font-size: 9px; color: var(--cv-ink-2); }
.cp-site { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 7px 0; border-bottom: 1px solid var(--cv-line, var(--line)); }
.cp-site:last-child { border-bottom: 0; }
.cp-site div { display: flex; flex-direction: column; min-width: 0; }
.cp-site b { font-size: 11px; }
.cp-site span { font-size: 9px; color: var(--cv-ink-2); }
.cp-material-row { display: flex; align-items: center; gap: 8px; padding: 7px 0; border-bottom: 1px solid var(--cv-line, var(--line)); font-size: 11px; }
.cp-material-row:last-child { border-bottom: 0; }
.cp-material-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cp-market-row { display: flex; gap: 8px; padding: 4px 0; font-size: 10px; }
.cp-market-row > span { flex: 0 0 32px; color: var(--cv-ink-2); }
.cp-market-row b { font-weight: 500; }
.cp-market-row b.cp-on { color: #0f766e; font-weight: 700; }
.cp-region-line { font-size: 11px; font-weight: 600; color: var(--cv-link-color, var(--cv-block-title)); margin-bottom: 4px; }
.cp-address { font-size: 11px; line-height: 1.5; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.cp-map-btn { flex: 0 0 auto; padding: 4px 10px; border: 0; border-radius: 6px; background: var(--cv-btn-main-solid, var(--cv-btn-main-bg)); color: var(--cv-btn-main-color, #fff); font-size: 10px; }
.cp-center { text-align: center; }
.cp-center h3 { text-align: left; }
.cp-share-qr { width: 110px; height: 110px; object-fit: contain; background: #fff; border: 1px solid var(--cv-line, var(--line)); border-radius: 8px; padding: 4px; }
.cp-foot { font-size: 9px; color: var(--cv-foot-color, var(--cv-ink-2)); margin: 8px 0 0; }

/* ============ 预览统一层（放在最后覆盖上面的基础规则）============
   与公开名片页同口径：18 套模板预览都是「一张连续大卡」，区块间只用细线分隔，不再各自成卡断开。
   配色统一来自共享 card-template-palettes.css 的 --cv-*，切换模板当场能看到颜色变化；结构差异全部抹平。 */
/* 封面归零、正文卡一体化 */
.cp-screen .cp-cover { height: 0; border-radius: 0; border-bottom: 0; background: transparent; }
.cp-screen .cp-body { margin-top: 0; padding: 0; border-radius: 12px; overflow: hidden; border: 1px solid var(--cv-line, var(--line)); background: var(--cv-card-bg); }
.cp-screen .cp-profile, .cp-screen .cp-block {
  margin-top: 0; padding: 12px; border: 0; border-radius: 0; box-shadow: none;
  background: transparent; border-bottom: 0;
}
/* 区块之间细线分隔（首块 profile 也带下边框），最后一块不留线 */
.cp-screen .cp-profile, .cp-screen .cp-block:not(:last-child) { border-bottom: 1px solid var(--cv-line, var(--line)); }
.cp-screen .cp-body > :last-child { border-bottom: 0; }
/* 抹平各模板骨架差异：头像统一方形左置、姓名区左对齐，抹掉居中/圆形/圆角/描边等专属形态 */
.cp-screen .cp-profile { flex-direction: row; align-items: flex-start; text-align: left; }
.cp-screen .cp-avatar { border-radius: 12px; border: 0; }
.cp-screen .cp-ident { text-align: left; }
/* 姓名字色固定取 --cv-ink：neon 的 --cv-name-color 是 transparent（渐变字），预览不复用渐变，避免隐身 */
.cp-screen .cp-name { letter-spacing: normal; color: var(--cv-ink); }
.cp-screen .cp-block h3 { text-align: left; }
.cp-screen .cp-org { color: var(--cv-org-color, var(--cv-ink-2)); font-size: 10px; margin-top: 3px; line-height: 1.4; }
</style>
