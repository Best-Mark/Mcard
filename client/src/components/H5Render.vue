<template>
  <!-- H5 宣传页渲染器（唯一真相源）：公开页 /h5/:slug 与编辑器实时预览共用同一套渲染，
       改样式只动这里。schema: { accent, pages:[{blocks:[...]}] }；data = { schema, card, watermark }。
       翻页用 CSS scroll-snap（零依赖，移动端手感好）；空图一律 accent 渐变占位，上传后即替换。
       2026-11-27 编辑体验一流化（用户定稿「自由拖动 + 动作」）：
       ① editable 模式长按块 350ms 进入拖动（震动反馈），跟手位移 + 命中即实时重排（emit reorder），
          短手势不拦截滚动；② 块入场动效（IntersectionObserver 进入视口播放，无 IO 老 WebView 降级直接显示），
          anim 字段白名单 none/up/fade/zoom/left/right，未设置按块类型智能默认（cover=zoom、endcard=fade、
          其余 up），显式 none 才关闭；③ 按钮组新增 copy 动作。公开页不传 editable/pageOffset，行为同前。 -->
  <div class="hp" :class="{ 'hp-editable': editable }" :style="{ '--hp-accent': accent }">
    <div class="hp-pages" ref="pagesEl" @scroll.passive="onScroll">
      <section v-for="(p, pi) in pages" :key="pi" class="hp-page"
        @touchstart="onDragStart" @touchmove="onDragMove" @touchend="onDragEnd" @touchcancel="onDragEnd">
        <template v-for="(b, bi) in p.blocks" :key="bi">
          <!-- editable（编辑器画布）模式：点任意块选中（emit pick），长按拖动重排（emit reorder），块内动作全部短路；
               公开页不传 editable，行为与此前完全一致 -->
          <!-- 封面 -->
          <div v-if="b.type === 'cover'" :class="blkCls(pi, bi, b)" :style="[bgStyle(b.cover), dragStyle(bi)]" @click="pick(pi, bi)">
            <div class="hp-cover-in">
              <h1>{{ b.title || '点击编辑标题' }}</h1>
              <p v-if="b.subtitle">{{ b.subtitle }}</p>
            </div>
          </div>
          <!-- 文本 -->
          <div v-else-if="b.type === 'text'" :class="blkCls(pi, bi, b)" :style="dragStyle(bi)" @click="pick(pi, bi)">
            <h2 v-if="b.heading">{{ b.heading }}</h2>
            <p v-if="b.body">{{ b.body }}</p>
          </div>
          <!-- 图文 -->
          <div v-else-if="b.type === 'hero'" :class="blkCls(pi, bi, b)" :style="dragStyle(bi)" @click="pick(pi, bi)">
            <div class="hp-img" :style="bgStyle(b.image)"></div>
            <h2 v-if="b.title">{{ b.title }}</h2>
            <p v-if="b.desc">{{ b.desc }}</p>
          </div>
          <!-- 图集：swipe=横滑条 / grid=两列 -->
          <div v-else-if="b.type === 'gallery'" :class="blkCls(pi, bi, b)" :style="dragStyle(bi)" @click="pick(pi, bi)">
            <div v-if="b.layout === 'swipe'" class="hp-gal-swipe">
              <div v-for="(img, gi) in b.images" :key="gi" class="hp-img" :style="bgStyle(img)"></div>
            </div>
            <div v-else class="hp-gal-grid">
              <div v-for="(img, gi) in b.images" :key="gi" class="hp-img" :style="bgStyle(img)"></div>
            </div>
          </div>
          <!-- 联系方式：拨号 / 复制微信 / 地址 -->
          <div v-else-if="b.type === 'contact'" :class="blkCls(pi, bi, b)" :style="dragStyle(bi)" @click="pick(pi, bi)">
            <button v-if="b.showMobile && tel" class="hp-act" @click="call(tel)"><span class="hp-act-ico">☎</span>{{ tel }}<small>拨打电话</small></button>
            <button v-if="b.showWechat && wechat" class="hp-act" @click="copyWechat"><span class="hp-act-ico">◌</span>微信号：{{ wechat }}<small>{{ copied ? '已复制' : '点击复制' }}</small></button>
            <p v-if="b.showAddress && (card?.address || card?.company)" class="hp-addr">◉ {{ card?.address || card?.company }}</p>
          </div>
          <!-- 地图：有坐标跳高德坐标点，无坐标按关键字搜索 -->
          <div v-else-if="b.type === 'map'" :class="blkCls(pi, bi, b)" :style="dragStyle(bi)" @click="pick(pi, bi)">
            <p class="hp-map-label">◉ {{ b.label || '位置待完善' }}</p>
            <a v-if="b.label || (b.lat && b.lng)" class="hp-act" :href="editable ? 'javascript:;' : mapHref(b)" target="_blank" rel="noopener">导航到这里</a>
          </div>
          <!-- 按钮组 -->
          <div v-else-if="b.type === 'buttons'" :class="blkCls(pi, bi, b)" :style="dragStyle(bi)" @click="pick(pi, bi)">
            <button v-for="(it, ii) in (b.items || [])" :key="ii" class="hp-btn" @click="runAction(it)">{{ it.label || '按钮' }}</button>
          </div>
          <!-- 视频 -->
          <div v-else-if="b.type === 'video'" :class="blkCls(pi, bi, b)" :style="dragStyle(bi)" @click="pick(pi, bi)">
            <video v-if="b.url" :src="b.url" :poster="b.poster" controls playsinline preload="metadata"></video>
          </div>
          <!-- 尾页名片卡：转化关键——访客看完直接进名片/拨号；watermark 为免费版品牌尾注 -->
          <div v-else-if="b.type === 'endcard'" :class="blkCls(pi, bi, b)" :style="dragStyle(bi)" @click="pick(pi, bi)">
            <div class="hp-end-card">
              <img v-if="card?.avatar" :src="card.avatar" alt="头像" />
              <div v-else class="hp-end-ava">{{ (card?.name || '名')[0] }}</div>
              <div class="hp-end-info">
                <b>{{ card?.name || '我的名片' }}</b>
                <span class="small">{{ [card?.title, card?.company].filter(Boolean).join(' · ') || '点击查看名片' }}</span>
              </div>
              <img class="hp-end-qr" :src="cardQr" alt="名片二维码" v-if="card?.slug" />
            </div>
            <button v-if="card?.slug" class="hp-btn" @click="goCard">查看名片 / 存入通讯录</button>
            <p v-if="watermark" class="hp-watermark">免费版由 MCard 制作 · 开通会员可去水印</p>
          </div>
        </template>
      </section>
    </div>
    <!-- 页码指示 + 下滑提示 -->
    <div v-if="pages.length > 1" class="hp-dots"><i v-for="(p, i) in pages" :key="i" :class="{ on: i === cur }"></i></div>
    <div v-if="cur === 0 && pages.length > 1" class="hp-more">︾</div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { scanQrUrl } from '../utils/qr'
import { showToast } from '../store'

const props = defineProps({
  data: { type: Object, required: true }, // { schema, card, watermark }
  // 编辑器画布模式（2026-11-27 用户定稿「所见即所得」）：块可点选（emit pick）、长按拖动重排（emit reorder），
  // 选中描边，块内动作短路。公开页不传，零影响。
  editable: { type: Boolean, default: false },
  // 编辑器画布只渲染当前一页：pageOffset 让块的 key 与「真实页号」对齐（选中态/切换不串页）
  pageOffset: { type: Number, default: 0 },
  selKey: { type: String, default: '' }
})
const emit = defineEmits(['pick', 'reorder'])
const router = useRouter()

const kOf = (pi, bi) => (pi + props.pageOffset) + '-' + bi
function pick(pi, bi) {
  if (!props.editable) return
  if (Date.now() < coolUntil) return // 长按拖动刚结束，抑制误触 click
  emit('pick', kOf(pi, bi))
}

// ---- 块 class：基础样式 + 选中描边 + 入场动效（shown 命中后加 in 触发 CSS 动画） ----
const ANIMS = ['none', 'up', 'fade', 'zoom', 'left', 'right']
const shown = ref({})
const animOf = b => {
  const a = String(b?.anim || '')
  if (ANIMS.includes(a)) return a // 显式设置（含 none=关闭）
  return b?.type === 'cover' ? 'zoom' : b?.type === 'endcard' ? 'fade' : 'up' // 未设置按类型智能默认
}
function blkCls(pi, bi, b) {
  const arr = ['hp-block', 'hp-' + b.type]
  if (props.editable && props.selKey === kOf(pi, bi)) arr.push('hp-sel')
  const a = animOf(b)
  if (a !== 'none') {
    arr.push('hp-anim', 'hp-anim-' + a)
    if (shown.value[kOf(pi, bi)]) arr.push('in')
  }
  return arr
}

// 入场动效：IO 进入视口才播放（公开页翻页滚动逐块浮现；老 WebView 无 IO 降级直接显示）
let io = null
function keyOfEl(el) {
  const sec = el.closest('.hp-page')
  const pi = sec ? Array.prototype.indexOf.call(sec.parentElement.children, sec) : 0
  const bi = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0
  return kOf(pi, bi)
}
function scanAnims() {
  if (!pagesEl.value) return
  const els = pagesEl.value.querySelectorAll('.hp-anim:not(.in)')
  if (!io) { // 降级：直接全部显示，不做动画
    const patch = {}
    els.forEach(el => { patch[keyOfEl(el)] = true })
    if (Object.keys(patch).length) shown.value = { ...shown.value, ...patch }
    return
  }
  els.forEach(el => io.observe(el))
}
function mountIo() {
  if (typeof IntersectionObserver !== 'function') return
  try { io = new IntersectionObserver(entries => {
    const patch = {}
    for (const en of entries) if (en.isIntersecting) { patch[keyOfEl(en.target)] = true; io.unobserve(en.target) }
    if (Object.keys(patch).length) shown.value = { ...shown.value, ...patch }
  }, { root: pagesEl.value, threshold: 0.12 }) } catch { io = null }
}
watch(() => props.data, () => nextTick(scanAnims), { deep: true })
onMounted(() => { mountIo(); nextTick(scanAnims) })
onBeforeUnmount(() => { if (io) io.disconnect() })

// ---- 编辑器长按拖动排序（editable only）：短手势不拦截滚动，长按 350ms 进入拖动态 ----
const drag = reactive({ on: false, cur: -1, dy: 0, startY: 0 })
let dragTimer = 0, coolUntil = 0
const biOf = el => (el && el.parentElement) ? Array.prototype.indexOf.call(el.parentElement.children, el) : -1
function onDragStart(e) {
  if (!props.editable) return
  const blk = e.target && e.target.closest ? e.target.closest('.hp-block') : null
  drag.cur = biOf(blk)
  drag.startY = e.touches && e.touches[0] ? e.touches[0].clientY : 0
  drag.dy = 0
  drag.on = false
  clearTimeout(dragTimer)
  dragTimer = setTimeout(() => {
    if (drag.cur < 0) return
    drag.on = true
    try { navigator.vibrate && navigator.vibrate(15) } catch {}
  }, 350)
}
function onDragMove(e) {
  if (!props.editable || drag.cur < 0) return
  if (!drag.on) { // 未进入拖动前位移超过阈值 = 用户在滚动/横滑，取消长按计时
    if (e.touches && e.touches[0] && Math.abs(e.touches[0].clientY - drag.startY) > 12) clearTimeout(dragTimer)
    return
  }
  e.preventDefault()
  const t = e.touches && e.touches[0]
  if (!t) return
  drag.dy = t.clientY - drag.startY
  const el = document.elementFromPoint(t.clientX, t.clientY)
  const blk = el && el.closest ? el.closest('.hp-block') : null
  const to = biOf(blk)
  if (to >= 0 && to !== drag.cur) { // 命中其它块即实时重排；起点重置避免位移跳变
    emit('reorder', { from: drag.cur, to })
    drag.cur = to
    drag.startY = t.clientY
    drag.dy = 0
    try { navigator.vibrate && navigator.vibrate(8) } catch {}
  }
}
function onDragEnd() {
  clearTimeout(dragTimer)
  if (drag.on) { coolUntil = Date.now() + 350; try { navigator.vibrate && navigator.vibrate(8) } catch {} }
  drag.on = false
  drag.cur = -1
  drag.dy = 0
}
function dragStyle(bi) {
  if (!drag.on || drag.cur !== bi) return null
  return { transform: `translateY(${drag.dy}px) scale(1.02)`, zIndex: 30, boxShadow: '0 18px 44px rgba(0,0,0,.5)' }
}

const schema = computed(() => props.data?.schema || {})
const pages = computed(() => (Array.isArray(schema.value.pages) && schema.value.pages.length) ? schema.value.pages : [{ blocks: [{ type: 'cover' }] }])
const accent = computed(() => /^#[0-9a-fA-F]{6}$/.test(schema.value.accent || '') ? schema.value.accent : '#a62b2b')
const card = computed(() => props.data?.card || {})
const watermark = computed(() => !!props.data?.watermark)
const tel = computed(() => card.value.mobile || card.value.phone || '')
const wechat = computed(() => card.value.wechat || '')
const cardQr = computed(() => card.value.slug ? scanQrUrl(card.value.slug, 'qr.png', 240) : '')

// 图片统一 object-fit cover 呈现；空图走 accent 渐变占位（不出现破图，也提示「这里该上传图」）
const isImg = u => /\.(png|jpe?g|gif|webp)(\?|$)/i.test(String(u || '')) || String(u || '').startsWith('/uploads/') || /^https?:\/\//.test(String(u || ''))
function bgStyle(u) {
  return isImg(u)
    ? { backgroundImage: `url(${u})` }
    : { background: `linear-gradient(135deg, color-mix(in srgb, var(--hp-accent) 78%, #000), color-mix(in srgb, var(--hp-accent) 45%, #fff))` }
}

// 翻页指示：scroll-snap 容器滚动位置换算当前页
const pagesEl = ref(null)
const cur = ref(0)
function onScroll(e) {
  const el = e.target
  cur.value = Math.round(el.scrollTop / Math.max(1, el.clientHeight))
}

const copied = ref(false)
let copyTimer = 0
async function copyText(t) {
  try { await navigator.clipboard.writeText(t) } catch {
    const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select()
    try { document.execCommand('copy') } catch {} ta.remove()
  }
}
async function copyWechat() { if (props.editable) return; await copyText(wechat.value); copied.value = true; clearTimeout(copyTimer); copyTimer = setTimeout(() => (copied.value = false), 1500) }
function call(t) { if (props.editable) return; window.location.href = `tel:${t}` }
function runAction(it) {
  if (props.editable) return
  if (it.action === 'tel' && it.value) return call(it.value)
  if (it.action === 'wechat') return copyText(it.value || wechat.value)
  if (it.action === 'copy' && it.value) { copyText(it.value); showToast('已复制', 'success'); return }
  if (it.action === 'link' && it.value) window.open(it.value, '_blank', 'noopener')
}
function mapHref(b) {
  if (b.lat && b.lng) return `https://uri.amap.com/marker?position=${b.lng},${b.lat}&name=${encodeURIComponent(b.label || '位置')}`
  return `https://uri.amap.com/search?keyword=${encodeURIComponent(b.label || '')}`
}
function goCard() { if (props.editable) return; router.push(`/c/${card.value.slug}`) }
</script>

<style scoped>
/* 翻页容器：scroll-snap 全页翻页；每页最小一屏，块少时内容垂直居中 */
.hp { position: relative; height: 100%; }
.hp-pages { height: 100%; overflow-y: auto; scroll-snap-type: y mandatory; -webkit-overflow-scrolling: touch; background: #0f1115; }
.hp-page { min-height: 100svh; scroll-snap-align: start; scroll-snap-stop: always; display: flex; flex-direction: column; justify-content: center; gap: 22px; padding: 64px 22px 56px; box-sizing: border-box; color: #f3f4f6; }
.hp-block { width: 100%; max-width: 560px; margin: 0 auto; position: relative; }
/* 编辑器画布选中态：琥珀虚线描边（深浅底都可见），不参与公开页 */
.hp-sel:after { content: ''; position: absolute; inset: -6px; border: 2px dashed #fbbf24; border-radius: 14px; pointer-events: none; z-index: 5; }
/* 编辑器画布：禁止长按呼出系统菜单/选中文字，保证长按=拖动手势干净 */
.hp-editable { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
.hp-img { width: 100%; aspect-ratio: 4 / 3; border-radius: 14px; background-size: cover; background-position: center; background-color: #1c2029; }

/* 入场动效：进入视口加 .in 播放一次；prefers-reduced-motion 用户直接显示 */
.hp-anim { opacity: 0; }
.hp-anim.in { opacity: 1; animation: hp-anim-up .55s cubic-bezier(.22, .8, .3, 1) both; }
@keyframes hp-anim-up { from { opacity: 0; transform: translateY(26px); } }
.hp-anim-fade.in { animation-name: hp-anim-fade; animation-duration: .7s; }
@keyframes hp-anim-fade { from { opacity: 0; } }
.hp-anim-zoom.in { animation-name: hp-anim-zoom; }
@keyframes hp-anim-zoom { from { opacity: 0; transform: scale(.92); } }
.hp-anim-left.in { animation-name: hp-anim-left; }
@keyframes hp-anim-left { from { opacity: 0; transform: translateX(-32px); } }
.hp-anim-right.in { animation-name: hp-anim-right; }
@keyframes hp-anim-right { from { opacity: 0; transform: translateX(32px); } }
@media (prefers-reduced-motion: reduce) { .hp-anim, .hp-anim.in { opacity: 1 !important; animation: none !important; } }

.hp-cover { min-height: 78svh; display: flex; align-items: flex-end; border-radius: 16px; background-size: cover; background-position: center; padding: 30px 24px; box-sizing: border-box; }
.hp-cover-in h1 { margin: 0; font-size: clamp(26px, 7vw, 40px); line-height: 1.25; text-shadow: 0 2px 18px rgba(0,0,0,.4); }
.hp-cover-in p { margin: 10px 0 0; font-size: 15px; opacity: .88; text-shadow: 0 1px 10px rgba(0,0,0,.4); }

.hp-text h2, .hp-hero h2 { margin: 0 0 10px; font-size: 21px; color: var(--hp-accent); }
.hp-text h2:after, .hp-hero h2:after { content: ''; display: block; width: 34px; height: 3px; margin-top: 9px; border-radius: 2px; background: var(--hp-accent); }
.hp-text p, .hp-hero p { margin: 0; font-size: 15px; line-height: 1.85; white-space: pre-line; color: #d1d5db; }
.hp-hero .hp-img { margin-bottom: 14px; }

.hp-gal-swipe { display: flex; gap: 10px; overflow-x: auto; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
.hp-gal-swipe::-webkit-scrollbar { display: none; }
.hp-gal-swipe .hp-img { flex: 0 0 82%; scroll-snap-align: center; aspect-ratio: 16 / 10; }
.hp-gal-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.hp-gal-grid .hp-img { aspect-ratio: 1; }

.hp-act { display: flex; align-items: center; gap: 10px; width: 100%; padding: 14px 16px; border: 1px solid rgba(255,255,255,.14); border-radius: 12px; background: rgba(255,255,255,.06); color: #f3f4f6; font-size: 15px; text-align: left; text-decoration: none; cursor: pointer; }
.hp-act small { margin-left: auto; font-size: 12px; color: var(--hp-accent); font-weight: 700; }
.hp-act-ico { font-size: 17px; color: var(--hp-accent); }
.hp-addr { margin: 0; font-size: 13px; color: #9ca3af; line-height: 1.6; }

.hp-map { display: flex; flex-direction: column; gap: 10px; align-items: stretch; }
.hp-map-label { margin: 0; font-size: 14px; color: #d1d5db; }
.hp-map .hp-act { justify-content: center; text-align: center; color: var(--hp-accent); font-weight: 700; }

.hp-buttons { display: flex; flex-direction: column; gap: 12px; }
.hp-btn { width: 100%; padding: 15px; border: 0; border-radius: 999px; background: var(--hp-accent); color: #fff; font-size: 16px; font-weight: 700; cursor: pointer; }
.hp-btn:active { filter: brightness(.92); }

.hp-video video { width: 100%; border-radius: 14px; background: #000; display: block; }

.hp-endcard { display: flex; flex-direction: column; gap: 16px; align-items: center; }
.hp-end-card { display: flex; align-items: center; gap: 14px; width: 100%; padding: 18px; border-radius: 16px; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.12); }
.hp-end-card img { width: 52px; height: 52px; border-radius: 50%; object-fit: cover; }
.hp-end-ava { width: 52px; height: 52px; border-radius: 50%; background: var(--hp-accent); color: #fff; display: grid; place-items: center; font-size: 22px; font-weight: 700; }
.hp-end-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.hp-end-info b { font-size: 17px; }
.hp-end-info .small { font-size: 12px; color: #9ca3af; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hp-end-qr { width: 52px !important; height: 52px !important; border-radius: 8px !important; background: #fff !important; }
.hp-watermark { margin: 0; font-size: 11px; color: #6b7280; text-align: center; }

.hp-dots { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; gap: 7px; z-index: 5; }
.hp-dots i { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,.28); transition: all .2s; }
.hp-dots i.on { background: var(--hp-accent); height: 16px; border-radius: 4px; }
.hp-more { position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%); color: rgba(255,255,255,.55); font-size: 18px; animation: hp-bob 1.4s ease-in-out infinite; pointer-events: none; }
@keyframes hp-bob { 50% { transform: translate(-50%, 6px); } }
@media (prefers-reduced-motion: reduce) { .hp-more { animation: none; } }

/* PC 桌面浏览：内容居中成手机宽度卡片，不铺满全屏 */
@media (min-width: 720px) {
  .hp-pages { background: #050608; }
  .hp-page { max-width: 460px; margin: 0 auto; min-height: 100svh; }
}
</style>
