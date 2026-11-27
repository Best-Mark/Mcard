<template>
  <!-- 宣传页编辑器（/me/h5/:id）：结构化块编辑（非自由画布）——页面=块序列，选块改字段，改完即存。
       渲染复用 H5Render（与公开页同一真相源），右侧实时预览；移动端预览走全屏抽屉。
       自动保存：任何改动 1.2s 防抖 PUT（与 CardEdit 自动保存口径一致）。 -->
  <div class="he">
    <header class="he-top">
      <button class="he-back" @click="router.push('/me/h5')">‹</button>
      <input v-model="title" class="he-title" placeholder="宣传页标题" @input="markDirty" />
      <button class="he-btn ghost" @click="previewOpen = true">预览</button>
      <button class="he-btn" :disabled="publishing" @click="publish">{{ page?.status === 'published' ? '更新发布' : '发布' }}</button>
    </header>
    <div class="he-save small muted">{{ saveState }}</div>

    <div class="he-body" v-if="loaded">
      <!-- 左：页面/块结构树 -->
      <aside class="he-tree">
        <div v-for="(p, pi) in schema.pages" :key="pi" class="he-page" :class="{ on: selPage === pi }">
          <div class="he-page-head" @click="selPage = pi">
            <b>第 {{ pi + 1 }} 页</b>
            <span class="small muted">{{ p.blocks.length }} 个内容块</span>
            <button v-if="schema.pages.length > 1" class="he-mini danger" @click.stop="removePage(pi)">删页</button>
          </div>
          <div v-for="(b, bi) in p.blocks" :key="bi" class="he-block-row" :class="{ on: selPage === pi && selBlock === bi }" @click="select(pi, bi)">
            <span>{{ TYPE_LABEL[b.type] || b.type }}</span>
            <span class="he-mini-wrap">
              <button class="he-mini" @click.stop="moveBlock(pi, bi, -1)" :disabled="bi === 0">↑</button>
              <button class="he-mini" @click.stop="moveBlock(pi, bi, 1)" :disabled="bi === p.blocks.length - 1">↓</button>
              <button class="he-mini danger" @click.stop="removeBlock(pi, bi)">✕</button>
            </span>
          </div>
          <div class="he-add-row">
            <button v-for="t in ADDABLE" :key="t" class="he-add" @click="addBlock(pi, t)">＋{{ TYPE_LABEL[t] }}</button>
          </div>
          <button v-if="pagesCount < maxPages" class="he-page-add" @click="addPage">＋ 添加一页</button>
          <div v-else class="small muted" style="padding:4px 2px">已达 {{ maxPages }} 页上限{{ paid ? '' : '，开通套餐可加页' }}</div>
        </div>
      </aside>

      <!-- 中：选中块字段表单 -->
      <div class="he-form" v-if="block">
        <h3 class="he-f-title">{{ TYPE_LABEL[block.type] }}</h3>

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
          <p class="small muted" style="margin:0 0 8px">联系方式自动来自你的名片资料，这里只控制展示项（改号码去「编辑名片 → 联系方式」）。</p>
          <label class="he-switch"><input type="checkbox" v-model="block.showMobile" @change="markDirty" />展示电话（可拨打）</label>
          <label class="he-switch"><input type="checkbox" v-model="block.showWechat" @change="markDirty" />展示微信号（点击复制）</label>
          <label class="he-switch"><input type="checkbox" v-model="block.showAddress" @change="markDirty" />展示地址</label>
        </template>
        <template v-else-if="block.type === 'map'">
          <label>位置名称<input v-model="block.label" maxlength="80" @input="markDirty" placeholder="如：XX市XX区XX路XX号" /></label>
          <p class="small muted" style="margin:4px 0 0">访客点「导航到这里」按名称搜索；填写过名片地址后此处文案自动带出。</p>
        </template>
        <template v-else-if="block.type === 'buttons'">
          <div v-for="(it, ii) in block.items" :key="ii" class="he-btn-edit">
            <label>按钮文字<input v-model="it.label" maxlength="12" @input="markDirty" /></label>
            <label>动作
              <select v-model="it.action" @change="markDirty"><option value="tel">拨打电话</option><option value="wechat">复制微信号</option><option value="link">打开链接</option></select>
            </label>
            <label>{{ it.action === 'link' ? '链接地址' : '号码 / 微信号' }}<input v-model="it.value" @input="markDirty" /></label>
            <button class="he-mini danger" @click="block.items.splice(ii, 1); markDirty()">删除此按钮</button>
          </div>
          <button v-if="block.items.length < 3" class="he-btn ghost block" @click="block.items.push({ label: '', action: 'tel', value: '' }); markDirty()">＋ 添加按钮</button>
        </template>
        <template v-else-if="block.type === 'video'">
          <label>视频地址<input v-model="block.url" @input="markDirty" placeholder="mp4 链接（可后台上传视频后填入）" /></label>
        </template>
        <template v-else-if="block.type === 'endcard'">
          <p class="small muted" style="margin:0">尾页自动展示你的名片卡与二维码，访客看完直接跳名片。{{ watermark ? '免费版尾页带品牌水印，开通套餐后自动去除。' : '当前套餐：无水印。' }}</p>
        </template>
      </div>

      <!-- 右：实时预览（PC）；移动端走全屏抽屉 -->
      <aside class="he-preview">
        <div class="he-preview-in">
          <H5Render :data="previewData" />
        </div>
      </aside>
    </div>
    <div v-else class="he-loading">加载中…</div>

    <!-- 移动端全屏预览 -->
    <div v-if="previewOpen" class="he-preview-mask">
      <div class="he-preview-head">
        <span class="small muted">预览（未保存的改动也已实时反映）</span>
        <button class="he-btn ghost sm" @click="previewOpen = false">关闭</button>
      </div>
      <div class="he-preview-in"><H5Render :data="previewData" /></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../api'
import { showToast } from '../store'
import H5Render from '../components/H5Render.vue'
import ImageField from '../components/ImageField.vue'

const route = useRoute()
const router = useRouter()

const TYPE_LABEL = { cover: '封面', text: '文本', hero: '图文', gallery: '图集', contact: '联系方式', map: '位置', buttons: '按钮组', video: '视频', endcard: '名片尾页' }
const ADDABLE = ['cover', 'text', 'hero', 'gallery', 'contact', 'map', 'buttons', 'video', 'endcard']
const FREE_MAX_PAGES = 3, PAID_MAX_PAGES = 12

const page = ref(null)
const title = ref('')
const schema = ref({ pages: [] })
const loaded = ref(false)
const selPage = ref(0)
const selBlock = ref(0)
const saveState = ref('')
const publishing = ref(false)
const previewOpen = ref(false)
// 闸门口径展示：以服务端实测为准（保存超限会被拦），前端只做引导
const paid = ref(false)
const maxPages = ref(PAID_MAX_PAGES) // 前端只做引导，服务端强制
const watermark = ref(true)

const cardData = ref(null)
const previewData = computed(() => ({ schema: schema.value, card: cardData.value, watermark: watermark.value }))
const block = computed(() => schema.value.pages[selPage.value]?.blocks[selBlock.value] || null)
const pagesCount = computed(() => schema.value.pages.length)

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
    showToast('已发布！访客可通过链接访问', 'success')
    copyLink()
  } catch (e) { showToast(e?.message || '发布失败', 'error') } finally { publishing.value = false }
}
async function copyLink() {
  const link = `${window.location.origin}/h5/${page.value.slug}`
  try { await navigator.clipboard.writeText(link); showToast('链接已复制，可直接发给客户', 'success') } catch { showToast(link) }
}

// ---- 结构编辑 ----
function select(pi, bi) { selPage.value = pi; selBlock.value = bi }
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
function addBlock(pi, type) {
  schema.value.pages[pi].blocks.push(blank(type))
  selPage.value = pi; selBlock.value = schema.value.pages[pi].blocks.length - 1
  markDirty()
}
function removeBlock(pi, bi) { schema.value.pages[pi].blocks.splice(bi, 1); selBlock.value = 0; markDirty() }
function moveBlock(pi, bi, d) {
  const arr = schema.value.pages[pi].blocks
  const t = arr[bi]; arr[bi] = arr[bi + d]; arr[bi + d] = t
  selBlock.value = bi + d; markDirty()
}
function addPage() {
  schema.value.pages.push({ blocks: [blank('cover')] })
  selPage.value = schema.value.pages.length - 1; selBlock.value = 0
  markDirty()
}
function removePage(pi) {
  if (schema.value.pages.length <= 1) return
  schema.value.pages.splice(pi, 1)
  selPage.value = 0; selBlock.value = 0
  markDirty()
}

onMounted(async () => {
  try {
    const { data } = await api.get(`/api/h5/${route.params.id}`)
    page.value = data.data.page
    title.value = page.value.title
    schema.value = page.value.schema || { pages: [{ blocks: [blank('cover')] }] }
    loaded.value = true
    // 预览数据：名片公开资料（头像/姓名/电话/微信/slug）+ 套餐闸门口径（服务端实测，含水印开关）
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
.he { min-height: 100vh; background: var(--bg-page, #f4f6fb); display: flex; flex-direction: column; }
.he-top { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; gap: 8px; padding: calc(10px + var(--safe-top, 0px)) 12px 10px; background: rgba(255,255,255,.95); backdrop-filter: blur(8px); border-bottom: 1px solid var(--line); }
.he-back { width: 34px; height: 34px; border: 1px solid var(--line); border-radius: 9px; background: #fff; font-size: 19px; color: #374151; cursor: pointer; flex: 0 0 34px; }
.he-title { flex: 1; min-width: 0; padding: 9px 12px; border: 1px solid var(--line); border-radius: 9px; font-size: 15px; font-weight: 700; }
.he-btn { padding: 9px 14px; border: 0; border-radius: 9px; background: var(--primary, #a62b2b); color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap; }
.he-btn.ghost { background: #fff; color: #374151; border: 1px solid var(--line); }
.he-btn.sm { padding: 6px 10px; font-size: 12px; }
.he-btn.block { width: 100%; }
.he-btn:disabled { opacity: .55; }
.he-save { padding: 6px 14px 0; }
.he-body { flex: 1; display: grid; grid-template-columns: 1fr; gap: 12px; padding: 12px; align-items: start; }
@media (min-width: 1000px) { .he-body { grid-template-columns: 300px 1fr 340px; } .he-preview { display: block !important; } }

/* 结构树 */
.he-tree { display: flex; flex-direction: column; gap: 10px; }
.he-page { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 10px; }
.he-page.on { border-color: var(--primary, #a62b2b); }
.he-page-head { display: flex; align-items: center; gap: 8px; cursor: pointer; padding-bottom: 6px; border-bottom: 1px dashed var(--line); margin-bottom: 6px; }
.he-page-head b { font-size: 13px; }
.he-page-head .small { flex: 1; }
.he-page-add { width: 100%; margin-top: 8px; padding: 8px; border: 1px dashed var(--line); border-radius: 9px; background: none; color: var(--primary, #a62b2b); font-size: 13px; font-weight: 700; cursor: pointer; }
.he-block-row { display: flex; align-items: center; justify-content: space-between; padding: 7px 9px; border-radius: 8px; font-size: 13px; cursor: pointer; }
.he-block-row.on { background: color-mix(in srgb, var(--primary, #a62b2b) 9%, #fff); color: var(--primary, #a62b2b); font-weight: 700; }
.he-mini-wrap { display: flex; gap: 4px; }
.he-mini { width: 24px; height: 24px; border: 1px solid var(--line); border-radius: 6px; background: #fff; font-size: 11px; cursor: pointer; color: #6b7280; display: inline-grid; place-items: center; }
.he-mini:disabled { opacity: .35; }
.he-mini.danger { color: #b91c1c; }
.he-add-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--line); }
.he-add { padding: 5px 9px; border: 1px solid var(--line); border-radius: 999px; background: #fff; font-size: 12px; cursor: pointer; color: #374151; }

/* 字段表单 */
.he-form { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 12px; }
.he-f-title { margin: 0; font-size: 15px; }
.he-form label { display: flex; flex-direction: column; gap: 5px; font-size: 13px; color: #374151; font-weight: 600; }
.he-form input, .he-form textarea, .he-form select { padding: 9px 11px; border: 1px solid var(--line); border-radius: 9px; font-size: 14px; font-family: inherit; }
.he-form input:focus, .he-form textarea:focus { outline: none; border-color: var(--primary, #a62b2b); }
.he-switch { flex-direction: row !important; align-items: center; gap: 8px !important; font-weight: 500 !important; }
.he-row { display: flex; align-items: center; justify-content: space-between; }
.he-gal-row { display: flex; align-items: flex-start; gap: 8px; }
.he-gal-row > :first-child { flex: 1; }
.he-btn-edit { border: 1px dashed var(--line); border-radius: 10px; padding: 10px; display: flex; flex-direction: column; gap: 8px; }

/* 预览 */
.he-preview { display: none; position: sticky; top: 90px; }
.he-preview-in { height: calc(100vh - 130px); max-height: 760px; border-radius: 18px; overflow: hidden; border: 1px solid var(--line); box-shadow: 0 18px 50px rgba(15,23,42,.18); background: #0f1115; }
.he-preview-mask { position: fixed; inset: 0; z-index: 90; background: #0f1115; display: flex; flex-direction: column; }
.he-preview-head { display: flex; align-items: center; justify-content: space-between; padding: calc(10px + var(--safe-top, 0px)) 14px 10px; color: #d1d5db; }
.he-preview-mask .he-preview-in { flex: 1; margin: 0 10px 10px; border-radius: 16px; }
.he-loading { padding: 40px; text-align: center; color: #6b7280; }
</style>
