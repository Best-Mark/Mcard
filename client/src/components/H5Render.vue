<template>
  <!-- H5 宣传页渲染器（唯一真相源）：公开页 /h5/:slug 与编辑器实时预览共用同一套渲染，
       改样式只动这里。schema: { accent, pages:[{blocks:[...]}] }；data = { schema, card, watermark }。
       翻页用 CSS scroll-snap（零依赖，移动端手感好）；空图一律 accent 渐变占位，上传后即替换。
       2026-11-27 编辑体验一流化（用户定稿「自由拖动 + 动作」）：
       ① editable 模式长按块 350ms 进入拖动（震动反馈），跟手位移 + 命中即实时重排（emit reorder），
          短手势不拦截滚动；② 块入场动效（IntersectionObserver 进入视口播放，无 IO 老 WebView 降级直接显示），
          anim 字段白名单 none/up/fade/zoom/left/right，未设置按块类型智能默认（cover=zoom、endcard=fade、
          其余 up），显式 none 才关闭；③ 按钮组新增 copy 动作。公开页不传 editable/pageOffset，行为同前。
       2026-11-27 路线③（页面切换过渡动效 + 背景音乐）：
       ④ schema.transition：scroll=原生滚动（默认，存量页零变化）/ slide / fade / flip 控制式翻页
          （触摸/滚轮/圆点驱动 + CSS 过渡，页内超高先内滚、到边才翻；入场动效改按页显隐，回翻重播）；
       ⑤ music 块（url+autoplay）：编辑画布静态卡，公开页块本身不占位、控制统一在右下浮动 ♪
          （操作层），浏览器禁带声自动播 → 首触解锁起播，循环播放。
       2026-11-27 画布直操化（用户对比 MAKA「体验差太多」）：
       ⑥ 选中块上方浮动快捷条（✎编辑/▣换图/⧉复制/✕，MAKA 同款就近操作）；
       ⑦ 封面/文本/图文的文字就地编辑（contenteditable，改完失焦即落字段，输入不回写防光标跳动）；
       ⑧ emit quick（edit/image/dup/del）与 inplace（变更通知 markDirty）给编辑器。 -->
  <div class="hp" :class="{ 'hp-editable': editable }" :style="{ '--hp-accent': accent }">
    <div class="hp-pages" ref="pagesEl" :class="pagesCls" @scroll.passive="onScroll"
      @touchstart="onPgTouchStart" @touchmove="onPgTouchMove" @touchend="onPgTouchEnd" @touchcancel="onPgTouchEnd" @wheel="onWheel">
      <section v-for="(p, pi) in pages" :key="pi" class="hp-page" :class="{ on: pi === cur }" :style="pageStyle(pi)"
        @touchstart="onDragStart" @touchmove="onDragMove" @touchend="onDragEnd" @touchcancel="onDragEnd">
        <template v-for="(b, bi) in p.blocks" :key="bi">
          <!-- editable（编辑器画布）模式：点任意块选中（emit pick），长按拖动重排（emit reorder），块内动作全部短路；
               公开页不传 editable，行为与此前完全一致 -->
          <!-- 封面 -->
          <div v-if="b.type === 'cover'" :class="blkCls(pi, bi, b)" :style="[bgStyle(b.cover), dragStyle(bi)]" @click="pick(pi, bi)">
            <div class="hp-cover-in">
              <h1 :contenteditable="inEd(pi, bi) ? 'true' : null" :class="{ 'hp-inplace': inEd(pi, bi) }" @input="onIn(pi, bi, b, 'title', $event)" @blur="onInBlur(pi, bi, b, 'title')">{{ inEd(pi, bi) ? b.title : (b.title || '点击编辑标题') }}</h1>
              <p v-if="b.subtitle || inEd(pi, bi)" :contenteditable="inEd(pi, bi) ? 'true' : null" :class="{ 'hp-inplace': inEd(pi, bi) }" @input="onIn(pi, bi, b, 'subtitle', $event)" @blur="onInBlur(pi, bi, b, 'subtitle')">{{ b.subtitle }}</p>
            </div>
          </div>
          <!-- 文本（2026-11-27 路线④ 文字基础样式：align 左/中/右 + size 小/正常/大） -->
          <div v-else-if="b.type === 'text'" :class="[blkCls(pi, bi, b), 'hp-align-' + (b.align || 'left'), 'hp-size-' + (b.size || 'md')]" :style="dragStyle(bi)" @click="pick(pi, bi)">
            <h2 v-if="b.heading || inEd(pi, bi)" :contenteditable="inEd(pi, bi) ? 'true' : null" :class="{ 'hp-inplace': inEd(pi, bi) }" @input="onIn(pi, bi, b, 'heading', $event)" @blur="onInBlur(pi, bi, b, 'heading')">{{ b.heading }}</h2>
            <p v-if="b.body || inEd(pi, bi)" :contenteditable="inEd(pi, bi) ? 'true' : null" :class="{ 'hp-inplace': inEd(pi, bi) }" @input="onIn(pi, bi, b, 'body', $event)" @blur="onInBlur(pi, bi, b, 'body')">{{ b.body }}</p>
          </div>
          <!-- 图文 -->
          <div v-else-if="b.type === 'hero'" :class="blkCls(pi, bi, b)" :style="dragStyle(bi)" @click="pick(pi, bi)">
            <div class="hp-img" :style="bgStyle(b.image)"></div>
            <h2 v-if="b.title || inEd(pi, bi)" :contenteditable="inEd(pi, bi) ? 'true' : null" :class="{ 'hp-inplace': inEd(pi, bi) }" @input="onIn(pi, bi, b, 'title', $event)" @blur="onInBlur(pi, bi, b, 'title')">{{ b.title }}</h2>
            <p v-if="b.desc || inEd(pi, bi)" :contenteditable="inEd(pi, bi) ? 'true' : null" :class="{ 'hp-inplace': inEd(pi, bi) }" @input="onIn(pi, bi, b, 'desc', $event)" @blur="onInBlur(pi, bi, b, 'desc')">{{ b.desc }}</p>
          </div>
          <!-- 图集：showcase=动效展播（自动轮播+Ken Burns）/ swipe=横滑条 / grid=两列；
               source='card' 时图片自动取自公司相册（data.card.gallery），与名片页同一份数据 -->
          <div v-else-if="b.type === 'gallery'" :class="blkCls(pi, bi, b)" :style="dragStyle(bi)" @click="pick(pi, bi)">
            <div v-if="b.layout === 'showcase'" class="hp-show">
              <div v-for="(img, gi) in galImgs(b)" :key="gi" class="hp-show-img" :class="{ on: scOf(pi, bi) === gi }" :style="bgStyle(img)"></div>
              <div v-if="!galImgs(b).length" class="hp-img" :style="bgStyle('')"></div>
              <div v-if="galImgs(b).length > 1" class="hp-show-dots">
                <i v-for="(img, gi) in galImgs(b)" :key="gi" :class="{ on: scOf(pi, bi) === gi }" @click.stop="setSc(pi, bi, gi)"></i>
              </div>
            </div>
            <div v-else-if="b.layout === 'swipe'" class="hp-gal-swipe">
              <div v-for="(img, gi) in galImgs(b)" :key="gi" class="hp-img" :style="bgStyle(img)"></div>
            </div>
            <!-- 错落瀑布（stagger，2026-11-27 路线④）：奇偶分两列、第二列整体下沉，错落有致 -->
            <div v-else-if="b.layout === 'stagger'" class="hp-gal-stagger">
              <template v-if="galImgs(b).length">
                <div class="hp-gal-col">
                  <div v-for="(img, gi) in stCol(galImgs(b), 0)" :key="gi" class="hp-img" :style="bgStyle(img)"></div>
                </div>
                <div class="hp-gal-col hp-gal-col-b">
                  <div v-for="(img, gi) in stCol(galImgs(b), 1)" :key="gi" class="hp-img" :style="bgStyle(img)"></div>
                </div>
              </template>
              <div v-else class="hp-img" :style="bgStyle('')"></div>
            </div>
            <div v-else class="hp-gal-grid">
              <div v-for="(img, gi) in galImgs(b)" :key="gi" class="hp-img" :style="bgStyle(img)"></div>
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
          <!-- 表单留资（2026-11-27）：姓名/电话/留言收集线索；提交成功换成功态，操作全在块内表单层 -->
          <div v-else-if="b.type === 'form'" :class="blkCls(pi, bi, b)" :style="dragStyle(bi)" @click="pick(pi, bi)">
            <template v-if="formDone(kOf(pi, bi))">
              <div class="hp-form-done">
                <span class="hp-form-done-ico">✓</span>
                <p>{{ b.successText || '已收到，我们会尽快联系你' }}</p>
              </div>
            </template>
            <template v-else>
              <h2 v-if="b.heading">{{ b.heading }}</h2>
              <p v-if="b.desc" class="hp-form-desc">{{ b.desc }}</p>
              <input v-if="b.showName" class="hp-input" type="text" maxlength="30" placeholder="姓名" :value="formVal(kOf(pi, bi), 'name')" @input="setFormVal(kOf(pi, bi), 'name', $event.target.value)" />
              <input v-if="b.showPhone" class="hp-input" type="tel" maxlength="30" placeholder="电话" :value="formVal(kOf(pi, bi), 'phone')" @input="setFormVal(kOf(pi, bi), 'phone', $event.target.value)" />
              <textarea v-if="b.showMessage" class="hp-input hp-textarea" rows="3" maxlength="300" placeholder="留言（选填）" :value="formVal(kOf(pi, bi), 'message')" @input="setFormVal(kOf(pi, bi), 'message', $event.target.value)"></textarea>
              <button class="hp-btn" :disabled="formBusy(kOf(pi, bi))" @click="submitForm(pi, bi, b)">{{ formBusy(kOf(pi, bi)) ? '提交中…' : (b.buttonText || '提交') }}</button>
            </template>
          </div>
          <!-- 背景音乐（2026-11-27 路线③）：配置载体块。编辑画布显示静态卡；公开页块本身不占内容位
               （display:none，DOM 保留保证块索引一致），播放控制统一在右下浮动 ♪（操作层） -->
          <div v-else-if="b.type === 'music'" :class="blkCls(pi, bi, b)" :style="dragStyle(bi)" @click="pick(pi, bi)">
            <div class="hp-music-card">
              <span class="hp-music-ico">♪</span>
              <div class="hp-music-info">
                <b>背景音乐</b>
                <span class="small">{{ b.url ? (b.autoplay !== false ? '已设置 · 访客打开页面自动播放' : '已设置 · 访客点右下 ♪ 播放') : '未设置音频地址' }}</span>
              </div>
            </div>
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
        <!-- 选中元素浮动快捷条（2026-11-27 画布直操化，仅编辑画布）：MAKA 同款贴选中块上方，
             编辑/换图/复制/删除就近操作；就地编辑时换「✓ 完成 / Aa 样式」。JS 量位置，随内容滚动 -->
        <div v-if="editable && selOn(pi)" class="hp-quickbar" :style="{ top: qbTop + 'px' }" @click.stop>
          <template v-if="inplaceKey">
            <button class="hp-qb done" @click="finishInplace">✓ 完成</button>
            <button class="hp-qb" @click="quickStyleOpen">Aa 样式</button>
          </template>
          <template v-else>
            <button class="hp-qb" @click="quickEdit">✎ 编辑</button>
            <button v-if="selHasImg" class="hp-qb" @click="emit('quick', { action: 'image' })">▣ 换图</button>
            <button class="hp-qb" @click="emit('quick', { action: 'dup' })">⧉ 复制</button>
            <button class="hp-qb warn" @click="emit('quick', { action: 'del' })">✕</button>
          </template>
        </div>
      </section>
    </div>
    <!-- 页码指示 + 下滑提示（圆点可点直达） -->
    <div v-if="pages.length > 1" class="hp-dots"><i v-for="(p, i) in pages" :key="i" :class="{ on: i === cur }" @click="goPage(i)"></i></div>
    <div v-if="cur === 0 && pages.length > 1" class="hp-more">︾</div>
    <!-- 背景音乐（路线③）：音频本体隐藏；公开页右下浮动 ♪ 承载播放/暂停（操作层，不占内容区）。
         autoplay 时挂一次首触解锁（浏览器禁带声自动播），循环播放 -->
    <audio v-if="musicUrl && !editable" ref="audioEl" class="hp-audio" :src="musicUrl" loop preload="auto"
      @play="musicPlaying = true" @pause="musicPlaying = false"></audio>
    <button v-if="musicUrl && !editable" class="hp-music-btn" :class="{ on: musicPlaying }" @click="toggleMusic" aria-label="背景音乐开关">♪</button>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api'
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
const emit = defineEmits(['pick', 'reorder', 'quick', 'inplace'])
const router = useRouter()

const kOf = (pi, bi) => (pi + props.pageOffset) + '-' + bi
function pick(pi, bi) {
  if (!props.editable) return
  if (Date.now() < coolUntil) return // 长按拖动刚结束，抑制误触 click
  const k = kOf(pi, bi)
  if (inplaceKey.value && inplaceKey.value !== k) finishInplace()
  if (props.selKey === k) {
    const b = pages.value[pi] && pages.value[pi].blocks ? pages.value[pi].blocks[bi] : null
    if (b && INPLACE_TYPES.includes(b.type)) { startInplace(); return } // 二次点文字类块 = 就地编辑
  }
  emit('pick', k)
}

// ---- 画布直操化（2026-11-27 MAKA 对标）：选中块浮动快捷条 + 文字就地编辑 ----
const INPLACE_TYPES = ['cover', 'text', 'hero'] // 文字可就地改的块；结构块仍走表单弹层
const inplaceKey = ref('')
const inBuf = {} // 就地输入缓冲（不回写响应式，防 contenteditable 光标跳动），失焦时落字段
const inEd = (pi, bi) => inplaceKey.value === kOf(pi, bi)
// 选中块对象（编辑画布只渲染一页：pi 恒为当前渲染页，真实页号由 pageOffset 对齐）
const selBlockObj = computed(() => {
  const parts = String(props.selKey || '').split('-')
  const pi = Number(parts[0]) - props.pageOffset, bi = Number(parts[1])
  if (isNaN(pi) || isNaN(bi)) return null
  const pg = pages.value[pi]
  return (pg && pg.blocks) ? (pg.blocks[bi] || null) : null
})
const selHasImg = computed(() => {
  const t = selBlockObj.value?.type
  return t === 'cover' || t === 'hero'
})
function selOn(pi) {
  return !!(props.editable && props.selKey && Number(String(props.selKey).split('-')[0]) === pi + props.pageOffset)
}
function startInplace() {
  const b = selBlockObj.value
  if (!b || !INPLACE_TYPES.includes(b.type)) return
  if (inplaceKey.value === props.selKey) return
  inplaceKey.value = props.selKey
  nextTick(() => {
    const el = pagesEl.value && pagesEl.value.querySelector('.hp-sel .hp-inplace')
    if (el && el.focus) { try { el.focus() } catch {} }
  })
}
function onIn(pi, bi, b, field, e) {
  inBuf[kOf(pi, bi) + '|' + field] = { b, field, v: (e.target.innerText != null ? e.target.innerText : e.target.textContent) || '' }
}
function onInBlur(pi, bi, b, field) {
  const key = kOf(pi, bi) + '|' + field
  const rec = inBuf[key]
  if (rec && rec.v !== b[field]) { b[field] = rec.v; emit('inplace') }
  delete inBuf[key]
}
function finishInplace() {
  // 兜底落盘：正常走 blur 逐字段提交，这里防未失焦就点「完成/样式」
  const keys = Object.keys(inBuf)
  let changed = false
  keys.forEach(key => {
    const rec = inBuf[key]
    if (rec && rec.v !== rec.b[rec.field]) { rec.b[rec.field] = rec.v; changed = true }
    delete inBuf[key]
  })
  if (changed) emit('inplace')
  inplaceKey.value = ''
}
function quickEdit() {
  const b = selBlockObj.value
  if (!b) return
  if (INPLACE_TYPES.includes(b.type)) startInplace()
  else emit('quick', { action: 'edit' })
}
function quickStyleOpen() {
  finishInplace()
  emit('quick', { action: 'edit' })
}
// 快捷条位置：量选中块相对所在页的偏移，贴块上方 54px（页有 64px 顶部内边距，不会顶出界）
const qbTop = ref(-100)
function positionQuick() {
  nextTick(() => {
    if (!props.editable || !props.selKey || !pagesEl.value) return
    const selEl = pagesEl.value.querySelector('.hp-sel')
    const sec = selEl && selEl.closest ? selEl.closest('.hp-page') : null
    if (!selEl || !sec) return
    const top = selEl.getBoundingClientRect().top - sec.getBoundingClientRect().top - 54
    qbTop.value = Math.max(6, top)
  })
}

// ---- 块 class：基础样式 + 选中描边 + 入场动效（shown 命中后加 in 触发 CSS 动画） ----
const ANIMS = ['none', 'up', 'fade', 'zoom', 'left', 'right']
const shown = ref({})
const animOf = b => {
  if (b?.type === 'music') return 'none' // 背景音乐块公开页不占位，不播入场
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
  if (isPaged.value) { markPageShown(cur.value); return } // 控制式翻页：按页显隐，不走 IO
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
watch(() => props.data, () => { nextTick(scanAnims); positionQuick() }, { deep: true })
watch(() => props.selKey, k => {
  if (inplaceKey.value && inplaceKey.value !== k) finishInplace()
  positionQuick()
})
onMounted(() => {
  if (!isPaged.value) mountIo()
  nextTick(scanAnims)
  if (!props.editable) scTimer = setInterval(scAdvance, 3800) // 展播自动轮播（编辑画布不播）
  armMusic()
  positionQuick()
})
onBeforeUnmount(() => {
  if (io) io.disconnect()
  clearInterval(scTimer)
  clearTimeout(pgReplayTimer)
  disarmUnlock()
  if (audioEl.value) { try { audioEl.value.pause() } catch {} }
})

// ---- 编辑器长按拖动排序（editable only）：短手势不拦截滚动，长按 350ms 进入拖动态 ----
const drag = reactive({ on: false, cur: -1, dy: 0, startY: 0 })
let dragTimer = 0, coolUntil = 0
const biOf = el => (el && el.parentElement) ? Array.prototype.indexOf.call(el.parentElement.children, el) : -1
function onDragStart(e) {
  if (!props.editable) return
  if (inplaceKey.value && e.target && e.target.closest && e.target.closest('.hp-inplace')) return // 就地编辑中，长按是选字不是拖块
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

const schema = computed(() => props.data?.page?.schema || props.data?.schema || {})
const pages = computed(() => (Array.isArray(schema.value.pages) && schema.value.pages.length) ? schema.value.pages : [{ blocks: [{ type: 'cover' }] }])
const accent = computed(() => /^#[0-9a-fA-F]{6}$/.test(schema.value.accent || '') ? schema.value.accent : '#a62b2b')
const card = computed(() => props.data?.card || {})
// 公开页数据是 { page:{schema,watermark,slug}, card }（服务端 /h5/public/:slug 形态），编辑器传扁平 { schema, card, watermark }——两种形态都认
const watermark = computed(() => !!(props.data?.page ? props.data.page.watermark : props.data?.watermark))
const pageSlug = computed(() => props.data?.page?.slug || props.data?.slug || '')
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

// ---- 页面切换过渡动效（2026-11-27 路线③）：scroll=原生滚动（默认，存量页零变化），
//      slide/fade/flip = 控制式翻页（触摸/滚轮/圆点驱动 + CSS 过渡；编辑画布单页渲染不参与） ----
const TRANSITIONS = ['scroll', 'slide', 'fade', 'flip']
const transition = computed(() => TRANSITIONS.includes(schema.value.transition) ? schema.value.transition : 'scroll')
const isPaged = computed(() => !props.editable && transition.value !== 'scroll')
const pagesCls = computed(() => (isPaged.value ? 'hp-paged hp-' + transition.value : ''))
// slide：每页按 (页号-当前) 百分比位移，方向天然感知（上一页向上让位、下一页从下补位）；
// 拖动跟手时叠加 dragDy 且停过渡，松手过阈值才真正翻页
const pageStyle = pi => {
  if (!isPaged.value || transition.value !== 'slide') return null
  const off = dragging.value ? ` + ${dragDy.value}px` : ''
  return { transform: `translateY(calc(${(pi - cur.value) * 100}%${off}))`, transition: dragging.value ? 'none' : '' }
}
const dragging = ref(false)
const dragDy = ref(0)
const pg = { active: false, axis: '', startY: 0, startX: 0, dy: 0, hold: false }
let pgReplayTimer = 0, wheelLock = 0
function pageEl(pi) { return pagesEl.value ? pagesEl.value.querySelectorAll('.hp-page')[pi] : null }
function pageScrollable(pi) { const el = pageEl(pi); return !!(el && el.scrollHeight > el.clientHeight + 2) }
function pageAtEdge(pi, dir) {
  const el = pageEl(pi)
  if (!el) return true
  return dir > 0 ? el.scrollTop + el.clientHeight >= el.scrollHeight - 2 : el.scrollTop <= 2
}
// 入场动效按页显隐：进页播一次，离场页复位、回翻再播（H5 通行手感）
function markPageShown(pi) {
  const p = pages.value[pi]
  if (!p) return
  const patch = {}
  ;(p.blocks || []).forEach((b, bi) => { patch[kOf(pi, bi)] = true })
  if (Object.keys(patch).length) shown.value = { ...shown.value, ...patch }
}
function resetOtherPages(pi) {
  const patch = {}
  pages.value.forEach((p, idx) => {
    if (idx === pi) return
    ;(p.blocks || []).forEach((b, bi) => { patch[kOf(idx, bi)] = false })
  })
  if (Object.keys(patch).length) shown.value = { ...shown.value, ...patch }
}
function goPage(i) {
  const t = Math.max(0, Math.min(pages.value.length - 1, i))
  if (isPaged.value) {
    if (t === cur.value) return
    cur.value = t
    markPageShown(t)
    clearTimeout(pgReplayTimer)
    pgReplayTimer = setTimeout(() => resetOtherPages(t), 700)
    return
  }
  if (!pagesEl.value) return
  cur.value = t
  const top = t * pagesEl.value.clientHeight
  try { pagesEl.value.scrollTo({ top, behavior: 'smooth' }) } catch { pagesEl.value.scrollTop = top }
}
function onPgTouchStart(e) {
  if (!isPaged.value) return
  const t = e.touches && e.touches[0]
  if (!t) return
  pg.active = true; pg.axis = ''; pg.hold = false; pg.dy = 0
  pg.startY = t.clientY; pg.startX = t.clientX
}
function onPgTouchMove(e) {
  if (!isPaged.value || !pg.active) return
  const t = e.touches && e.touches[0]
  if (!t) return
  const dy = t.clientY - pg.startY, dx = t.clientX - pg.startX
  if (!pg.axis) {
    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) { pg.axis = 'x'; return } // 横滑（图集横滑条）放行
    if (Math.abs(dy) > 12) pg.axis = 'y'
    else return
  }
  if (pg.axis !== 'y') return
  pg.dy = dy
  // 页内内容还能滚就交给内滚，滚到边才翻页
  if (pageScrollable(cur.value) && !pageAtEdge(cur.value, dy < 0 ? 1 : -1)) { pg.active = false; return }
  if (!pg.hold && ((dy > 0 && cur.value === 0) || (dy < 0 && cur.value >= pages.value.length - 1))) pg.hold = true
  if (pg.hold) return
  e.preventDefault()
  dragging.value = true
  dragDy.value = dy
}
function onPgTouchEnd() {
  if (!isPaged.value) return
  const dy = pg.dy
  const moved = dragging.value
  dragging.value = false
  dragDy.value = 0
  pg.active = false; pg.hold = false; pg.axis = ''; pg.dy = 0
  const need = transition.value === 'slide' ? 60 : 36 // slide 有跟手反馈阈值可大些；fade/flip 无跟手，小些
  if (!moved || Math.abs(dy) < need) return
  goPage(cur.value + (dy < 0 ? 1 : -1))
}
function onWheel(e) {
  if (!isPaged.value) return
  if (Math.abs(e.deltaY) < 8) return
  const dir = e.deltaY > 0 ? 1 : -1
  if (pageScrollable(cur.value) && !pageAtEdge(cur.value, dir)) return
  e.preventDefault()
  const now = Date.now()
  if (now < wheelLock) return
  wheelLock = now + 650
  goPage(cur.value + dir)
}

const copied = ref(false)
let copyTimer = 0

// ---- 图集展播（2026-11-27 用户定稿「公司相册 H5 式动效展示」）----
// galImgs：source='card' 时取公司相册图（data.card.gallery，与名片页同源），否则用块自己的 images
//（含空图位——bgStyle 渐变占位提示「这里该上传图」，与原行为一致，不过滤）。
const galImgs = b => (b?.source === 'card' ? (card.value?.gallery || []) : (b?.images || []))
// 错落布局（stagger）：奇偶分列——第一列偶数位、第二列奇数位，第二列 CSS 整体下沉形成错落
const stCol = (imgs, col) => (imgs || []).filter((_, i) => i % 2 === col)
// 展播当前页码（key = 页-块）：一个定时器驱动所有 showcase 块循环轮播（3.8s/张），
// 编辑画布不自动播（editable 时只手动点进度点预览），避免画布里图片自己动干扰编辑。
const scIdx = ref({})
const scOf = (pi, bi) => scIdx.value[kOf(pi, bi)] || 0
function setSc(pi, bi, i) { scIdx.value = { ...scIdx.value, [kOf(pi, bi)]: i } }
function scAdvance() {
  if (props.editable) return
  const patch = {}
  const ps = pages.value || []
  ps.forEach((p, pi) => (p.blocks || []).forEach((b, bi) => {
    if (b.type === 'gallery' && b.layout === 'showcase') {
      const n = galImgs(b).length
      if (n > 1) patch[kOf(pi, bi)] = (scOf(pi, bi) + 1) % n
    }
  }))
  if (Object.keys(patch).length) scIdx.value = { ...scIdx.value, ...patch }
}
let scTimer = 0
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

// ---- 表单留资（2026-11-27）：访客填姓名/电话/留言 → POST /api/h5/public/:slug/leads 落 h5_leads ----
// 状态按块 key 隔离（一页可放多个表单）；成对防重入（按钮 disabled + busy 守卫），成功换成功态不再可提交。
const formVals = ref({})
const formBusyMap = ref({})
const formDoneMap = ref({})
const formVal = (k, f) => (formVals.value[k] || {})[f] || ''
function setFormVal(k, f, v) {
  const cur = formVals.value[k] || {}
  formVals.value = { ...formVals.value, [k]: { ...cur, [f]: v } }
}
const formBusy = k => !!formBusyMap.value[k]
const formDone = k => !!formDoneMap.value[k]
async function submitForm(pi, bi, b) {
  if (props.editable) return // 编辑画布短路，不真提交
  const k = kOf(pi, bi)
  if (formBusyMap.value[k] || formDoneMap.value[k]) return
  const v = formVals.value[k] || {}
  const name = String(v.name || '').trim().slice(0, 30)
  const phone = String(v.phone || '').trim().slice(0, 30)
  const message = String(v.message || '').trim().slice(0, 300)
  if (!name && !phone) { showToast('请至少填写姓名或电话', 'error'); return }
  if (!pageSlug.value) { showToast('页面未发布，暂不能提交', 'error'); return }
  formBusyMap.value = { ...formBusyMap.value, [k]: true }
  try {
    await api.post(`/api/h5/public/${encodeURIComponent(pageSlug.value)}/leads`, { name, phone, message })
    formDoneMap.value = { ...formDoneMap.value, [k]: true }
  } catch (e) {
    showToast(e?.message || '提交失败，请稍后重试', 'error')
  } finally {
    formBusyMap.value = { ...formBusyMap.value, [k]: false }
  }
}

// ---- 背景音乐（2026-11-27 路线③）：music 块存 url+autoplay，公开页右下浮动 ♪ 承载播放控制 ----
const musicBlock = computed(() => {
  for (const p of pages.value) for (const b of (p.blocks || [])) if (b.type === 'music' && b.url) return b
  return null
})
const musicUrl = computed(() => musicBlock.value?.url || '')
const musicPlaying = ref(false)
const audioEl = ref(null)
let unlockHandler = null
function startMusic() {
  const a = audioEl.value
  if (!a || !musicUrl.value || musicPlaying.value) return
  try {
    const pr = a.play()
    if (pr && pr.catch) pr.catch(() => {}) // 被浏览器拦截时保持暂停态，等首触解锁再试
  } catch {}
}
function disarmUnlock() {
  if (!unlockHandler) return
  document.removeEventListener('touchend', unlockHandler)
  document.removeEventListener('click', unlockHandler)
  unlockHandler = null
}
function toggleMusic() {
  const a = audioEl.value
  if (!a) return
  disarmUnlock() // 手动接管后不再自动起播（避免点暂停又被解锁钩子拉回播放）
  if (musicPlaying.value) { try { a.pause() } catch {} }
  else startMusic()
}
function armMusic() {
  if (props.editable || !musicUrl.value || musicBlock.value?.autoplay === false) return
  startMusic() // 桌面端可能直接成功
  unlockHandler = () => { disarmUnlock(); startMusic() } // 移动端首触解锁自动播放
  document.addEventListener('touchend', unlockHandler)
  document.addEventListener('click', unlockHandler)
}
</script>

<style scoped>
/* 翻页容器：scroll-snap 全页翻页；每页最小一屏，块少时内容垂直居中 */
.hp { position: relative; height: 100%; }
.hp-pages { height: 100%; overflow-y: auto; scroll-snap-type: y mandatory; -webkit-overflow-scrolling: touch; background: #0f1115; }
.hp-page { position: relative; min-height: 100svh; scroll-snap-align: start; scroll-snap-stop: always; display: flex; flex-direction: column; justify-content: center; gap: 22px; padding: 64px 22px 56px; box-sizing: border-box; color: #f3f4f6; }
.hp-block { width: 100%; max-width: 560px; margin: 0 auto; position: relative; }
/* 编辑器画布选中态：琥珀虚线描边（深浅底都可见），不参与公开页 */
.hp-sel:after { content: ''; position: absolute; top: -6px; right: -6px; bottom: -6px; left: -6px; border: 2px dashed #fbbf24; border-radius: 14px; pointer-events: none; z-index: 5; }
/* 编辑器画布：禁止长按呼出系统菜单/选中文字，保证长按=拖动手势干净 */
.hp-editable { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
/* 画布直操化（2026-11-27 MAKA 对标）：选中块浮动快捷条（白胶囊，编辑画布专用）+ 文字就地编辑态 */
.hp-quickbar { position: absolute; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 6px; padding: 7px 10px; border-radius: 999px; background: rgba(255,255,255,.97); box-shadow: 0 10px 30px rgba(0,0,0,.35); z-index: 32; white-space: nowrap; }
.hp-qb { border: 0; border-radius: 999px; background: #eef1f6; color: #1f2937; font-size: 13px; font-weight: 700; padding: 8px 12px; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.hp-qb:active { filter: brightness(.94); }
.hp-qb.warn { background: #fee2e2; color: #b91c1c; }
.hp-qb.done { background: var(--hp-accent, #a62b2b); color: #fff; padding: 8px 18px; }
/* 就地编辑：文字可输入（覆盖 .hp-editable 的 user-select:none），焦点环提示在改哪个字段 */
.hp-inplace { -webkit-user-select: text; user-select: text; cursor: text; }
.hp-inplace:focus { outline: 2px solid #fbbf24; outline-offset: 3px; border-radius: 4px; }
.hp-img { width: 100%; aspect-ratio: 4 / 3; border-radius: 14px; background-size: cover; background-position: center; background-color: #1c2029; }

/* 控制式翻页（transition=slide/fade/flip，2026-11-27 路线③）：
   页绝对定位满屏叠放；slide 按页内联 transform 位移（方向天然感知），fade/flip 按 .on 显隐/翻转过渡；
   无 3D 的老 WebView 上 flip 退化为淡入淡出（rotateX 不生效只剩 opacity），无害；
   页内内容超高可内滚（到边才触发翻页手势）。prefers-reduced-motion 关闭过渡 */
.hp-paged { overflow: hidden; }
.hp-paged .hp-page { position: absolute; top: 0; left: 0; right: 0; height: 100%; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; justify-content: center; justify-content: safe center; }
.hp-slide .hp-page { transition: transform .52s cubic-bezier(.22, .8, .3, 1); }
.hp-fade .hp-page, .hp-flip .hp-page { opacity: 0; pointer-events: none; transition: opacity .5s ease; }
.hp-fade .hp-page.on, .hp-flip .hp-page.on { opacity: 1; pointer-events: auto; }
.hp-flip { perspective: 1100px; -webkit-perspective: 1100px; }
.hp-flip .hp-page { transform: rotateX(72deg); transition: opacity .45s ease, transform .55s ease; }
.hp-flip .hp-page.on { transform: rotateX(0deg); }
@media (prefers-reduced-motion: reduce) { .hp-paged .hp-page { transition: none !important; } }

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
/* 文字基础样式（2026-11-27 路线④）：对齐（小下划线跟着标题走）+ 字号三档 */
.hp-text.hp-align-center { text-align: center; }
.hp-text.hp-align-right { text-align: right; }
.hp-text.hp-align-center h2:after { margin-left: auto; margin-right: auto; }
.hp-text.hp-align-right h2:after { margin-left: auto; margin-right: 0; }
.hp-text.hp-size-sm h2 { font-size: 18px; }
.hp-text.hp-size-sm p { font-size: 13px; }
.hp-text.hp-size-lg h2 { font-size: 25px; }
.hp-text.hp-size-lg p { font-size: 17px; line-height: 1.9; }
.hp-hero .hp-img { margin-bottom: 14px; }

.hp-gal-swipe { display: flex; gap: 10px; overflow-x: auto; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
.hp-gal-swipe::-webkit-scrollbar { display: none; }
.hp-gal-swipe .hp-img { flex: 0 0 82%; scroll-snap-align: center; aspect-ratio: 16 / 10; }
.hp-gal-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.hp-gal-grid .hp-img { aspect-ratio: 1; }
/* 图集错落瀑布（stagger，2026-11-27 路线④）：双列奇偶分列、第二列整体下沉，高度随图交替；
   老 WebView 不支持 flex/gap 只是竖排单列，无害 */
.hp-gal-stagger { display: flex; gap: 10px; align-items: flex-start; }
.hp-gal-col { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: 10px; }
.hp-gal-col-b { margin-top: 26px; }
.hp-gal-stagger .hp-img { width: 100%; aspect-ratio: 3 / 4; }
.hp-gal-stagger .hp-img:nth-child(2n) { aspect-ratio: 1 / 1; }
.hp-gal-stagger > .hp-img { aspect-ratio: 16 / 10; }
/* 图集展播（showcase）：整幅舞台 + Ken Burns 缓推缓拉 + 底部进度点，纯 CSS 动效
   （老 WebView 不支持动画只是不动，无害）；prefers-reduced-motion 关闭 */
.hp-show { position: relative; width: 100%; aspect-ratio: 16 / 10; border-radius: 14px; overflow: hidden; background: #1c2029; }
.hp-show-img { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-size: cover; background-position: center; opacity: 0; transition: opacity .7s ease; }
.hp-show-img.on { opacity: 1; animation: hp-show-kb 4.2s linear both; }
@keyframes hp-show-kb { from { transform: scale(1) translate(0, 0); } to { transform: scale(1.1) translate(-1.5%, -1%); } }
.hp-show-dots { position: absolute; left: 0; right: 0; bottom: 10px; display: flex; align-items: center; justify-content: center; gap: 6px; z-index: 2; }
.hp-show-dots i { width: 7px; height: 7px; border-radius: 999px; background: rgba(255,255,255,.45); transition: all .25s; cursor: pointer; }
.hp-show-dots i.on { width: 18px; background: #fff; }
@media (prefers-reduced-motion: reduce) { .hp-show-img.on { animation: none; } }

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
.hp-btn:disabled { opacity: .6; cursor: default; }

/* 表单留资块：深底输入框 + 主题色提交钮；成功态居中对勾 */
.hp-form-desc { margin: -4px 0 12px; font-size: 13px; line-height: 1.7; color: #9ca3af; white-space: pre-line; }
.hp-input { display: block; width: 100%; box-sizing: border-box; margin-bottom: 12px; padding: 13px 15px; border: 1px solid rgba(255,255,255,.16); border-radius: 12px; background: rgba(255,255,255,.07); color: #f3f4f6; font-size: 15px; }
.hp-input::placeholder { color: #6b7280; }
.hp-textarea { resize: none; line-height: 1.6; }
.hp-form-done { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 26px 16px; border-radius: 14px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12); }
.hp-form-done-ico { width: 46px; height: 46px; border-radius: 50%; background: var(--hp-accent); color: #fff; display: grid; place-items: center; font-size: 22px; font-weight: 700; }
.hp-form-done p { margin: 0; font-size: 15px; color: #d1d5db; text-align: center; }

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

/* 背景音乐块（路线③）：编辑画布静态卡；公开页块本身隐藏（DOM 保留保证块索引一致），控制在浮动 ♪。
   浮动钮挂 .hp 内绝对定位（.hp 高度=整视口），限宽 560px 手机列内；env 两级兜底 */
.hp-music { display: none; }
.hp-editable .hp-music { display: block; }
.hp-music-card { display: flex; align-items: center; gap: 12px; padding: 16px; border-radius: 14px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12); }
.hp-music-ico { width: 42px; height: 42px; flex: 0 0 42px; border-radius: 50%; background: var(--hp-accent); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 20px; }
.hp-music-info { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.hp-music-info b { font-size: 15px; }
.hp-music-info .small { font-size: 12px; color: #9ca3af; }
.hp-audio { display: none; }
.hp-music-btn { position: absolute; right: 16px; bottom: 20px; bottom: calc(20px + env(safe-area-inset-bottom)); width: 46px; height: 46px; padding: 0; border-radius: 50%; border: 1px solid rgba(255,255,255,.22); background: rgba(15,23,42,.72); color: #fff; font-size: 20px; line-height: 1; cursor: pointer; z-index: 40; }
.hp-music-btn.on { color: var(--hp-accent); border-color: var(--hp-accent); animation: hp-music-pulse 2.6s ease-in-out infinite; }
@keyframes hp-music-pulse { 50% { transform: scale(1.08); } }
@media (prefers-reduced-motion: reduce) { .hp-music-btn.on { animation: none; } }

/* PC 桌面浏览：内容居中成手机宽度卡片，不铺满全屏 */
@media (min-width: 720px) {
  .hp-pages { background: #050608; }
  .hp-page { max-width: 460px; margin: 0 auto; min-height: 100svh; }
}
</style>
