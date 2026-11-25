<template>
  <div class="cp-wrap">
    <div ref="screen" class="cp-screen cv-page cv-clean" :class="'cv-tpl-' + (card.template || 'classic')" :style="vars">
      <CardSheet
        :card="card" :tags="tags" :materials="materials" :industries="industries"
        :qr-url="qrUrl" :full="true" :interactive="false"
        :site-name="siteName"
      >
        <template #after-profile>
          <div v-if="card.market_opt_in || card.industry" class="card card-pad cv-block" data-sec="market">
            <h3>名片集市 <span>· 上架状态即时生效</span></h3>
            <div class="cp-market-row"><span>上架</span><b :class="{ 'cp-on': card.market_opt_in }">{{ card.market_opt_in ? '✓ 已上架 · 可被附近客户搜到' : '○ 未上架' }}</b></div>
            <div v-if="card.industry" class="cp-market-row"><span>行业</span><b>{{ industryLabel }}</b></div>
            <div v-if="regionLine" class="cp-market-row"><span>地区</span><b>{{ regionLine }}</b></div>
          </div>
        </template>
      </CardSheet>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import CardSheet from './CardSheet.vue'
import { themeOf, themeVars } from '../utils/themes'

const props = defineProps({
  card: { type: Object, required: true },
  tags: { type: Array, default: () => [] },
  materials: { type: Array, default: () => [] },
  qrUrl: { type: String, default: '' },
  section: { type: String, default: 'identity' },
  industries: { type: Array, default: () => [] },
  siteName: { type: String, default: '' }
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
const regionLine = computed(() => {
  const c = props.card || {}
  return [c.province, c.city, c.district, c.street].filter(Boolean).join(' · ')
})
// 主题变量仍需注入：dock/分享等辅助元素与 elite 的 --t-accent 回落依赖它；卡片本体配色走 --cv-* 共享 CSS
const vars = computed(() => themeVars(themeOf(props.card)))

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
/* 预览容器：卡片本体（卡面/区块/页脚）全部由 CardSheet + card-sheet.css 渲染，这里只负责限高滚动外壳。
   挂 cv-page cv-clean cv-tpl-* 是为了让 18 套模板的高特异性统一层（.cv-page.cv-clean ...）命中子组件 DOM。 */
.cp-screen { height: min(72vh, 760px); overflow-y: auto; border: 1px solid var(--line); border-radius: 14px; position: relative; scroll-behavior: smooth; }
.cp-screen.cv-page { min-height: 0; padding: 0; padding-bottom: 0; }
.cp-screen.cv-clean.cv-page { padding-top: 0; }
.cp-screen.cv-clean .cv-main { max-width: none; }
/* 集市展示状态行（预览特有辅助信息，不属于名片卡本体） */
.cp-market-row { display: flex; gap: 8px; padding: 4px 0; font-size: 10px; }
/* 预览辅助信息落在名片卡内部：必须走模板 --cv-* 配色，不能用主题 --t-muted/写死浅底色绿字，
   否则墨夜玻璃等暗色模板上小字直接看不见（2026-11-26 实锤）。 */
.cp-market-row > span { flex: 0 0 32px; color: var(--cv-ink-2); }
.cp-market-row b { font-weight: 500; color: var(--cv-ink); }
.cp-market-row b.cp-on { color: var(--cv-block-title); font-weight: 700; }
</style>
