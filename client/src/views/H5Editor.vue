<template>
  <!-- 宣传页编辑器（/me/h5/:id）——2026-11-27 用户定稿重构：
       单页单页做 + 所见即所得：画布即当前页的真实渲染（H5Render 编辑模式，点任意块选中、
       琥珀虚线描边、块内动作短路），内容表单在底部弹层里改、画布实时刷新；
       底部操作条与名片工作台 dock 同款四态翻转：main=编辑块/页面/配色/发布，
       点任一键整行翻转出选项行（点中即改、面板不关可连试），↙ 收起回主行。
       发布后自动挂到名片公开页（访客看名片可跳宣传页），宣传页尾页也带名片二维码——双向挂钩。
       2026-11-27 编辑体验一流化（用户反馈「要自由拖动、一些动作」）：
       ① 画布长按块 350ms 拖动排序（跟手 + 命中即重排，H5Render emit reorder 落数组）；
       ② 块入场动效可选（BottomSelect，公开页进入视口自动播放）；
       ③ 加块插到选中块之后（不再固定尾部）、新增复制块；
       ④ 按钮动作原 <select> 违规改 BottomSelect（H5 下拉必须 BottomSelect 约束），动作新增「复制文本」。 -->
  <div class="he">
    <header class="he-top">
      <button class="he-back" @click="router.push('/me/h5')">‹</button>
      <input v-model="title" class="he-title" placeholder="宣传页标题" @input="markDirty" />
      <span class="he-save small muted">{{ saveState }}</span>
    </header>

    <!-- 画布：只渲染当前编辑页，点块选中 -->
    <div class="he-canvas" v-if="loaded">
      <div class="he-canvas-in">
        <!-- page-offset：画布只渲染当前页，offset 让块的 key 与真实页号对齐（选中态/拖动不串页） -->
        <H5Render :data="curPageData" editable :page-offset="selPage" :sel-key="selKey" @pick="onPick" @reorder="onReorder" />
      </div>
      <div class="he-hint small muted">点模块选中 · 再点一下直接改内容 · 长按模块拖动排序{{ block ? ` · 当前：第 ${selPage + 1} 页 ${TYPE_LABEL[block.type]}` : '' }}</div>
    </div>
    <div v-else class="he-loading">加载中…</div>

    <!-- dock 四态翻转（与名片工作台同款交互） -->
    <div :class="['he-dock', { 'he-dock-flip': dockMode !== 'main' }]">
      <template v-if="dockMode === 'main'">
        <button class="he-dock-btn primary" @click="dockMode = 'edit'">✎ 编辑块</button>
        <button class="he-dock-btn" @click="dockMode = 'pages'">▦ 页面</button>
        <button class="he-dock-btn" @click="dockMode = 'theme'">◑ 配色</button>
        <button class="he-dock-btn" @click="dockMode = 'pub'">⇪ 发布</button>
      </template>
      <template v-else>
        <button class="he-dock-back" @click="dockMode = 'main'" aria-label="收起，返回主操作条">↙</button>
        <div class="he-dock-scroll">
          <div class="he-dock-flow">
            <!-- 编辑块行：加块 chips + 选中块操作 -->
            <template v-if="dockMode === 'edit'">
              <span class="he-grp">加模块</span>
              <button v-for="t in ADDABLE" :key="t" class="he-chip" @click="addBlock(t)">＋{{ TYPE_LABEL[t] }}</button>
              <template v-if="block">
                <span class="he-grp">{{ TYPE_LABEL[block.type] }}</span>
                <button class="he-chip on" @click="formOpen = true">编辑内容</button>
                <button class="he-chip" @click="duplicateBlock" :disabled="curPage.blocks.length >= 8">⧉ 复制</button>
                <button class="he-chip" @click="moveBlock(-1)" :disabled="selBlock === 0">↑</button>
                <button class="he-chip" @click="moveBlock(1)" :disabled="selBlock === curPage.blocks.length - 1">↓</button>
                <button class="he-chip warn" @click="removeBlock">✕ 删除</button>
              </template>
            </template>
            <!-- 页面行：切页 / 加页 / 删本页（单页单页做） -->
            <template v-else-if="dockMode === 'pages'">
              <button v-for="(p, i) in schema.pages" :key="i" :class="['he-chip', { on: i === selPage }]" @click="selPage = i; selBlock = 0">第{{ i + 1 }}页·{{ p.blocks.length }}块</button>
              <button v-if="pagesCount < maxPages" class="he-chip on" @click="addPage">＋ 加一页</button>
              <button v-else class="he-chip" @click="showToast(paid ? `最多 ${maxPages} 页` : `免费版最多 ${maxPages} 页，开通套餐解锁`, 'error')">已达上限</button>
              <button v-if="pagesCount > 1" class="he-chip warn" @click="removePage">✕ 删本页</button>
            </template>
            <!-- 配色行：主题色点中即改 + 套用官方模板 -->
            <template v-else-if="dockMode === 'theme'">
              <button v-for="c in COLORS" :key="c" :class="['he-dot', { on: (schema.accent || '') === c }]" :style="{ background: c }" @click="setAccent(c)"></button>
              <span class="he-grp">模板</span>
              <button class="he-chip" @click="openTpls">套用官方模板…</button>
            </template>
            <!-- 发布行：状态 + 发布/更新 + 复制链接 + 下架 -->
            <template v-else>
              <span :class="['he-status', { on: page?.status === 'published' }]">{{ page?.status === 'published' ? '✓ 已发布·名片页可跳转' : '○ 未发布' }}</span>
              <button class="he-chip on" :disabled="publishing" @click="publish">{{ page?.status === 'published' ? '⇪ 更新发布' : '⇪ 发布' }}</button>
              <button v-if="page?.status === 'published'" class="he-chip" @click="copyLink">⧉ 复制链接</button>
              <button v-if="page?.status === 'published'" class="he-chip warn" @click="unpublish">下架</button>
            </template>
          </div>
        </div>
      </template>
    </div>

    <!-- 选中块内容编辑弹层：v-model 直绑块字段，画布实时刷新（所见即所得） -->
    <BottomSheet :show="formOpen" @update:show="formOpen = $event">
      <div class="he-form" v-if="block">
        <div class="he-f-head">
          <b>{{ TYPE_LABEL[block.type] }}</b>
          <span class="he-f-actions">
            <button class="he-mini" @click="duplicateBlock(); formOpen = false" :disabled="curPage.blocks.length >= 8">⧉ 复制</button>
            <button class="he-mini" @click="formOpen = false">完成</button>
          </span>
        </div>
        <template v-if="block.type === 'cover'">
          <label>主标题<input v-model="block.title" maxlength="40" @input="markDirty" placeholder="一句话吸引点进来" /></label>
          <label>副标题<input v-model="block.subtitle" maxlength="60" @input="markDirty" placeholder="公司名 / 一句补充" /></label>
          <ImageField v-model="block.cover" label="封面背景图（不传用主题色渐变）" @update:modelValue="markDirty" />
        </template>
        <template v-else-if="block.type === 'text'">
          <label>小标题<input v-model="block.heading" maxlength="40" @input="markDirty" /></label>
          <label>正文<textarea v-model="block.body" rows="6" maxlength="1200" @input="markDirty" placeholder="支持换行"></textarea></label>
        </template>
        <template v-else-if="block.type === 'hero'">
          <ImageField v-model="block.image" label="图片" @update:modelValue="markDirty" />
          <label>标题<input v-model="block.title" maxlength="40" @input="markDirty" /></label>
          <label>描述<textarea v-model="block.desc" rows="3" maxlength="300" @input="markDirty"></textarea></label>
        </template>
        <template v-else-if="block.type === 'gallery'">
          <div class="he-row"><span class="small muted">排列方式</span>
            <button class="he-btn ghost sm" @click="block.layout = block.layout === 'swipe' ? 'grid' : 'swipe'; markDirty()">{{ block.layout === 'swipe' ? '横滑大图' : '两列网格' }}</button>
          </div>
          <div v-for="(img, gi) in block.images" :key="gi" class="he-gal-row">
            <ImageField v-model="block.images[gi]" @update:modelValue="markDirty" />
            <button class="he-mini danger" @click="block.images.splice(gi, 1); markDirty()">✕</button>
          </div>
          <button v-if="block.images.length < 9" class="he-btn ghost block" @click="block.images.push(''); markDirty()">＋ 添加图片位</button>
        </template>
        <template v-else-if="block.type === 'contact'">
          <p class="small muted" style="margin:0 0 8px">联系方式自动来自你的名片资料，这里只控制展示项。</p>
          <label class="he-switch"><input type="checkbox" v-model="block.showMobile" @change="markDirty" />展示电话（可拨打）</label>
          <label class="he-switch"><input type="checkbox" v-model="block.showWechat" @change="markDirty" />展示微信号（点击复制）</label>
          <label class="he-switch"><input type="checkbox" v-model="block.showAddress" @change="markDirty" />展示地址</label>
        </template>
        <template v-else-if="block.type === 'map'">
          <label>位置名称<input v-model="block.label" maxlength="80" @input="markDirty" placeholder="如：XX市XX区XX路XX号" /></label>
          <p class="small muted" style="margin:4px 0 0">访客点「导航到这里」按名称搜索。</p>
        </template>
        <template v-else-if="block.type === 'buttons'">
          <div v-for="(it, ii) in block.items" :key="ii" class="he-btn-edit">
            <label>按钮文字<input v-model="it.label" maxlength="12" @input="markDirty" /></label>
            <label>动作
              <!-- 原生 select 违反「H5 下拉必须 BottomSelect」约束，已换统一底部弹窗选择器 -->
              <BottomSelect v-model="it.action" :options="ACTION_OPTS" title="按钮动作" @update:modelValue="markDirty" />
            </label>
            <label>{{ ACTION_VALUE_LABEL[it.action] || '内容' }}<input v-model="it.value" @input="markDirty" /></label>
            <button class="he-mini danger" @click="block.items.splice(ii, 1); markDirty()">删除此按钮</button>
          </div>
          <button v-if="block.items.length < 3" class="he-btn ghost block" @click="block.items.push({ label: '', action: 'tel', value: '' }); markDirty()">＋ 添加按钮</button>
        </template>
        <template v-else-if="block.type === 'video'">
          <label>视频地址<input v-model="block.url" @input="markDirty" placeholder="mp4 链接" /></label>
        </template>
        <template v-else-if="block.type === 'endcard'">
          <p class="small muted" style="margin:0">尾页自动展示你的名片卡与二维码，访客看完直接跳名片。{{ watermark ? '免费版尾页带品牌水印，开通套餐后自动去除。' : '当前套餐：无水印。' }}</p>
        </template>
        <!-- 通用：入场动效（所有块）。未设置=按块类型智能默认；公开页滚动到该块时自动播放 -->
        <div class="he-anim-row">
          <label>入场动效
            <BottomSelect v-model="block.anim" :options="ANIM_OPTS" title="入场动效" @update:modelValue="markDirty" />
          </label>
          <p class="small muted" style="margin:4px 0 0">访客浏览到这个模块时自动播放的小动画，让页面更生动。</p>
        </div>
      </div>
    </BottomSheet>

    <!-- 套用官方模板弹层：整页内容被替换（confirm 确认），替换后从第 1 页继续单页编辑 -->
    <BottomSheet :show="tplOpen" @update:show="tplOpen = $event">
      <div class="he-form">
        <div class="he-f-head"><b>套用官方模板</b><button class="he-mini" @click="tplOpen = false">关闭</button></div>
        <p class="small muted" style="margin:0 0 10px">套用会<b>覆盖当前全部页面内容</b>（不可恢复），请先留存当前内容。</p>
        <div class="he-tpl-list">
          <button v-for="t in templates" :key="t.key" class="he-tpl" :disabled="applying" @click="applyTpl(t)">
            <span class="he-tpl-dot" :style="{ background: t.accent }"></span>
            <span class="he-tpl-t"><b>{{ t.name }}</b><span class="small muted">{{ t.industry }} · {{ t.desc }}</span></span>
            <i>›</i>
          </button>
        </div>
      </div>
    </BottomSheet>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../api'
import { showToast } from '../store'
import H5Render from '../components/H5Render.vue'
import ImageField from '../components/ImageField.vue'
import BottomSheet from '../components/BottomSheet.vue'
import BottomSelect from '../components/BottomSelect.vue'

const route = useRoute()
const router = useRouter()

const TYPE_LABEL = { cover: '封面', text: '文本', hero: '图文', gallery: '图集', contact: '联系方式', map: '位置', buttons: '按钮组', video: '视频', endcard: '名片尾页' }
const ADDABLE = ['cover', 'text', 'hero', 'gallery', 'contact', 'map', 'buttons', 'video', 'endcard']
// 入场动效选项（'' = 智能默认，与渲染层 animOf 的类型默认一致；none = 关闭）
const ANIM_OPTS = [
  { value: '', label: '默认（智能）' }, { value: 'none', label: '无动效' }, { value: 'up', label: '向上浮入' },
  { value: 'fade', label: '淡入' }, { value: 'zoom', label: '缩放入场' }, { value: 'left', label: '左侧滑入' }, { value: 'right', label: '右侧滑入' }
]
// 按钮动作（2026-11-27 新增 copy）：value 的语义随动作变化，输入框标签跟着换
const ACTION_OPTS = [{ value: 'tel', label: '拨打电话' }, { value: 'wechat', label: '复制微信号' }, { value: 'link', label: '打开链接' }, { value: 'copy', label: '复制文本' }]
const ACTION_VALUE_LABEL = { tel: '电话号码', wechat: '微信号（留空用名片微信号）', link: '链接地址', copy: '要复制的文本' }
// 主题色板：与名片模板色系呼应，点中即改全页 accent
const COLORS = ['#a62b2b', '#c2410c', '#b45309', '#0f766e', '#4338ca', '#17357c', '#7c2d92', '#be185d']
const FREE_MAX_PAGES = 3, PAID_MAX_PAGES = 12

const page = ref(null)
const title = ref('')
const schema = ref({ pages: [] })
const loaded = ref(false)
const selPage = ref(0)
const selBlock = ref(0)
const saveState = ref('')
const publishing = ref(false)
// dock 四态翻转 + 弹层
const dockMode = ref('main')
const formOpen = ref(false)
const tplOpen = ref(false)
const templates = ref([])
const applying = ref(false)
// 闸门口径展示：以服务端实测为准（保存超限会被拦），前端只做引导
const paid = ref(false)
const maxPages = ref(PAID_MAX_PAGES) // 前端只做引导，服务端强制
const watermark = ref(true)

const cardData = ref(null)
// 画布只渲染当前页（单页单页做），其余页在「页面」行切换
const curPage = computed(() => schema.value.pages[selPage.value] || { blocks: [] })
const curPageData = computed(() => ({ schema: { accent: schema.value.accent || '', pages: [curPage.value] }, card: cardData.value, watermark: watermark.value }))
const selKey = computed(() => `${selPage.value}-${selBlock.value}`)
const block = computed(() => curPage.value.blocks[selBlock.value] || null)
const pagesCount = computed(() => schema.value.pages.length)

// 快捷编辑（2026-11-27 用户定稿「像名片那样」，对齐名片工作台两段式）：
// 首点模块只选中（琥珀虚线描边，防误触——画布块很大，误点成本是弹层开关）；
// 再点同一个已选中的块直接弹内容表单，省去「✎编辑块 → 编辑内容」两级 dock。
// 弹层 v-model 直绑块字段、画布实时刷新，markDirty 自动保存——与 dock 路径完全同一套状态。
function onPick(key) {
  const [pi, bi] = key.split('-').map(Number)
  if (selPage.value === pi && selBlock.value === bi && block.value) { formOpen.value = true; return }
  selPage.value = pi
  selBlock.value = bi
}

let saveTimer = 0
function markDirty() {
  clearTimeout(saveTimer)
  saveState.value = '有未保存的修改…'
  saveTimer = setTimeout(save, 1200)
}
async function save(silent = true) {
  clearTimeout(saveTimer)
  try {
    await api.put(`/api/h5/${route.params.id}`, { title: title.value, schema: schema.value })
    saveState.value = '✓ 已自动保存'
  } catch (e) {
    saveState.value = '保存失败：' + (e?.message || '网络异常')
    if (!silent) showToast(saveState.value, 'error')
  }
}
async function publish() {
  clearTimeout(saveTimer); await save()
  publishing.value = true
  try {
    await api.post(`/api/h5/${route.params.id}/publish`)
    page.value.status = 'published'
    showToast('已发布！入口已自动挂到你的名片页', 'success')
    copyLink()
  } catch (e) { showToast(e?.message || '发布失败', 'error') } finally { publishing.value = false }
}
async function unpublish() {
  try {
    await api.post(`/api/h5/${route.params.id}/unpublish`)
    page.value.status = 'draft'
    showToast('已下架，名片页入口同步隐藏', 'success')
  } catch (e) { showToast(e?.message || '操作失败', 'error') }
}
async function copyLink() {
  const link = `${window.location.origin}/h5/${page.value.slug}`
  try { await navigator.clipboard.writeText(link); showToast('链接已复制，可直接发给客户', 'success') } catch { showToast(link) }
}

// ---- 结构编辑 ----
function blank(type) {
  if (type === 'cover') return { type, title: '', subtitle: '', cover: '' }
  if (type === 'text') return { type, heading: '', body: '' }
  if (type === 'hero') return { type, image: '', title: '', desc: '' }
  if (type === 'gallery') return { type, images: [''], layout: 'grid' }
  if (type === 'contact') return { type, showMobile: true, showWechat: true, showAddress: true }
  if (type === 'map') return { type, lat: null, lng: null, label: '' }
  if (type === 'buttons') return { type, items: [{ label: '', action: 'tel', value: '' }] }
  if (type === 'video') return { type, url: '', poster: '' }
  return { type: 'endcard' }
}
// 插入位置：有选中块（非尾页卡）→ 插到其后，跟着当前编辑焦点走；否则插到尾页卡之前
function insertAt() {
  const arr = curPage.value.blocks
  const cap = arr.length && arr[arr.length - 1].type === 'endcard' ? arr.length - 1 : arr.length
  if (block.value && block.value.type !== 'endcard') return Math.min(selBlock.value + 1, cap)
  return cap
}
function addBlock(type) {
  const arr = curPage.value.blocks
  const at = insertAt()
  arr.splice(at, 0, blank(type))
  selBlock.value = at
  markDirty()
}
function duplicateBlock() {
  const src = block.value
  if (!src) return
  const arr = curPage.value.blocks
  const at = insertAt()
  arr.splice(at, 0, JSON.parse(JSON.stringify(src)))
  selBlock.value = at
  markDirty()
  showToast('已复制一个相同模块，可拖动到任意位置', 'success')
}
// 画布长按拖动重排（H5Render emit）：from/to 都是本页块索引；尾页卡一样可以被拖（用户自由优先）
function onReorder({ from, to }) {
  const arr = curPage.value.blocks
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return
  const [m] = arr.splice(from, 1)
  arr.splice(to, 0, m)
  selBlock.value = to
  markDirty()
}
function removeBlock() { curPage.value.blocks.splice(selBlock.value, 1); selBlock.value = Math.max(0, selBlock.value - 1); markDirty() }
function moveBlock(d) {
  const arr = curPage.value.blocks
  const t = arr[selBlock.value]; arr[selBlock.value] = arr[selBlock.value + d]; arr[selBlock.value + d] = t
  selBlock.value += d; markDirty()
}
function addPage() {
  schema.value.pages.push({ blocks: [blank('cover')] })
  selPage.value = schema.value.pages.length - 1; selBlock.value = 0
  markDirty()
}
function removePage() {
  if (schema.value.pages.length <= 1) return
  schema.value.pages.splice(selPage.value, 1)
  selPage.value = Math.max(0, selPage.value - 1); selBlock.value = 0
  markDirty()
}
function setAccent(c) { schema.value.accent = c; markDirty() }
async function openTpls() {
  if (!templates.value.length) {
    try { templates.value = (await api.get('/api/h5/templates')).data.data.list } catch {}
  }
  tplOpen.value = true
}
function applyTpl(t) {
  if (applying.value) return
  if (!confirm(`套用「${t.name}」会覆盖当前全部页面内容，确定？`)) return
  schema.value = { accent: t.accent, pages: JSON.parse(JSON.stringify(t.pages)) }
  selPage.value = 0; selBlock.value = 0
  tplOpen.value = false; dockMode.value = 'main'
  markDirty()
  showToast(`已套用「${t.name}」，继续单页修改即可`, 'success')
}

onMounted(async () => {
  try {
    const { data } = await api.get(`/api/h5/${route.params.id}`)
    page.value = data.data.page
    title.value = page.value.title
    schema.value = page.value.schema || { pages: [{ blocks: [blank('cover')] }] }
    loaded.value = true
    // 预览数据：名片公开资料 + 套餐闸门口径（服务端实测，含水印开关）
    try {
      const mine = (await api.get('/api/h5/mine')).data.data
      paid.value = !!mine.limits?.paid
      watermark.value = !mine.limits?.paid
      maxPages.value = mine.limits?.maxPages || (paid.value ? PAID_MAX_PAGES : FREE_MAX_PAGES)
    } catch {}
    try { cardData.value = (await api.get('/api/cards/mine')).data.data } catch {}
  } catch (e) { showToast(e?.message || '加载失败', 'error'); router.push('/me/h5') }
})
watch(() => route.params.id, () => { if (route.name === 'h5-editor') location.reload() })
</script>

<style scoped>
/* 底部操作条 fixed 贴底（与配色/资料编辑页同款，2026-11-27 实修）：
   原 sticky bottom:0 在老微信 X5 WebView 上可能不贴视口底、且会被全局 tabbar 盖住；
   页面留 76px 空位，画布与提示行不会被操作条遮住。 */
.he { min-height: 100vh; padding-bottom: calc(76px + env(safe-area-inset-bottom)); background: var(--bg-page, #f4f6fb); display: flex; flex-direction: column; }
.he-top { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; gap: 8px; padding: calc(10px + var(--safe-top, 0px)) 12px 10px; background: rgba(255,255,255,.95); backdrop-filter: blur(8px); border-bottom: 1px solid var(--line); }
.he-back { width: 34px; height: 34px; border: 1px solid var(--line); border-radius: 9px; background: #fff; font-size: 19px; color: #374151; cursor: pointer; flex: 0 0 34px; }
.he-title { flex: 1; min-width: 0; padding: 9px 12px; border: 1px solid var(--line); border-radius: 9px; font-size: 15px; font-weight: 700; }
.he-save { flex: 0 0 auto; white-space: nowrap; padding-right: 2px; }

/* 画布：手机宽度居中，占满剩余高度；内容即真实渲染（所见即所得） */
.he-canvas { flex: 1; display: flex; flex-direction: column; padding: 12px 12px 0; min-height: 0; }
.he-canvas-in { flex: 1; min-height: 0; width: min(430px, 100%); margin: 0 auto; border-radius: 18px; overflow: hidden; border: 1px solid var(--line); box-shadow: 0 12px 32px rgba(15,23,42,.14); background: #0f1115; }
.he-hint { text-align: center; padding: 8px 0 4px; flex: 0 0 auto; }
.he-loading { flex: 1; display: grid; place-items: center; color: #6b7280; }

/* dock：底部固定操作条，四态翻转（与名片工作台同款交互语言） */
.he-dock { position: fixed; left: 0; right: 0; bottom: 0; z-index: 105; width: min(560px, 100%); margin: 0 auto; display: flex; align-items: center; gap: 8px; padding: 10px 12px calc(10px + var(--safe-bottom, 0px)); background: rgba(15,23,42,.92); backdrop-filter: blur(10px); border-radius: 16px 16px 0 0; }
@media (min-width: 900px) { .he-dock { left: 50%; right: auto; transform: translateX(-50%); border-radius: 14px 14px 0 0; } }
.he-dock-flip { background: rgba(15,23,42,.96); }
.he-dock-btn { flex: 1; padding: 12px 4px; border: 1px solid rgba(255,255,255,.22); border-radius: 11px; background: rgba(255,255,255,.08); color: #fff; font-size: 13.5px; font-weight: 700; cursor: pointer; white-space: nowrap; -webkit-tap-highlight-color: transparent; }
.he-dock-btn.primary { background: var(--primary, #a62b2b); border-color: transparent; }
.he-dock-back { flex: 0 0 36px; height: 44px; border: 1px solid rgba(255,255,255,.28); border-radius: 11px; background: rgba(255,255,255,.08); color: #fff; font-size: 17px; cursor: pointer; }
.he-dock-scroll { flex: 1; min-width: 0; overflow-x: auto; scrollbar-width: none; }
.he-dock-scroll::-webkit-scrollbar { display: none; }
.he-dock-flow { display: flex; align-items: center; gap: 8px; width: max-content; padding: 2px; }
.he-chip { height: 44px; padding: 0 14px; border: 1px solid rgba(255,255,255,.28); border-radius: 999px; background: rgba(255,255,255,.08); color: #fff; font-size: 12.5px; white-space: nowrap; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.he-chip.on { background: var(--primary, #a62b2b); border-color: transparent; font-weight: 700; }
.he-chip.warn { color: #fde68a; }
.he-chip:disabled { opacity: .45; cursor: default; }
.he-grp { flex: 0 0 auto; font-size: 10.5px; letter-spacing: .12em; color: #9ca3af; background: rgba(255,255,255,.06); padding: 4px 9px; border-radius: 7px; white-space: nowrap; }
.he-dot { width: 40px; height: 40px; flex: 0 0 40px; border-radius: 50%; border: 2px solid rgba(255,255,255,.35); cursor: pointer; -webkit-tap-highlight-color: transparent; }
.he-dot.on { box-shadow: 0 0 0 3px #fff; }
.he-status { flex: 0 0 auto; font-size: 11.5px; color: #9ca3af; white-space: nowrap; padding: 0 2px; }
.he-status.on { color: #4ade80; font-weight: 700; }

/* 内容编辑弹层表单 */
.he-form { padding: 4px 2px 8px; max-height: 72vh; overflow-y: auto; overscroll-behavior: contain; }
.he-f-head { display: flex; align-items: center; justify-content: space-between; padding-bottom: 8px; border-bottom: 1px solid var(--line); margin-bottom: 10px; }
.he-f-head b { font-size: 15px; }
.he-f-actions { display: flex; gap: 8px; }
.he-anim-row { margin-top: 4px; padding-top: 10px; border-top: 1px dashed var(--line); }
.he-form label { display: block; margin-bottom: 10px; font-size: 12.5px; color: #6b7280; }
.he-form input, .he-form textarea, .he-form select { display: block; width: 100%; box-sizing: border-box; margin-top: 5px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 9px; font-size: 14px; background: #fff; }
.he-form .he-switch { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #374151; }
.he-form .he-switch input { width: auto; margin: 0; }
.he-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.he-gal-row { display: flex; align-items: center; gap: 8px; }
.he-gal-row > *:first-child { flex: 1; }
.he-btn-edit { border: 1px solid var(--line); border-radius: 10px; padding: 10px; margin-bottom: 10px; }
.he-mini { padding: 6px 12px; border: 1px solid var(--line); border-radius: 8px; background: #fff; color: #374151; font-size: 12px; cursor: pointer; }
.he-btn { padding: 10px 14px; border: 0; border-radius: 9px; background: var(--primary, #a62b2b); color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; }
.he-btn.ghost { background: #fff; color: #374151; border: 1px solid var(--line); }
.he-btn.sm { padding: 6px 10px; font-size: 12px; }
.he-btn.block { width: 100%; margin-top: 4px; }
.he-mini.danger { color: #dc2626; border-color: #fecaca; background: #fef2f2; }
/* 套模板弹层 */
.he-tpl-list { display: flex; flex-direction: column; gap: 8px; }
.he-tpl { display: flex; align-items: center; gap: 10px; padding: 12px; border: 1px solid var(--line); border-radius: 11px; background: #fff; text-align: left; cursor: pointer; }
.he-tpl:active { border-color: var(--primary, #a62b2b); }
.he-tpl-dot { width: 14px; height: 14px; flex: 0 0 14px; border-radius: 50%; }
.he-tpl-t { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; font-size: 14px; }
.he-tpl i { font-style: normal; color: #9ca3af; }
</style>
