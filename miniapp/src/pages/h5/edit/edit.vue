<template>
  <!-- 宣传页编辑器（与 H5 /me/h5/:id 同构）：结构化块编辑——选块改字段，改完显式保存；
       预览为纵向简易渲染（小程序独立渲染，不依赖 web-view，业务域名未配置也可用）；
       图片上传走 /api/upload（uploadImage 封装，带隐私授权）。 -->
  <view class="page">
    <view class="top">
      <input class="title-input" :value="title" placeholder="宣传页标题" maxlength="40" @input="e => title = e.detail.value" />
      <button class="btn tiny ghost" @tap="previewOpen = !previewOpen">{{ previewOpen ? '收起预览' : '预览' }}</button>
    </view>
    <view class="save-state muted small">{{ saveState }}</view>

    <!-- 纵向简易预览（块渲染与最终 H5 端口径一致，仅不做翻页） -->
    <view v-if="previewOpen" class="preview">
      <view v-for="(p, pi) in schema.pages" :key="pi" class="pv-page">
        <block v-for="(b, bi) in p.blocks" :key="bi">
          <view v-if="b.type === 'cover'" class="pv-cover" :style="bgStyle(b.cover)">
            <text class="pv-cover-t">{{ b.title || '未填标题' }}</text>
            <text v-if="b.subtitle" class="pv-cover-s">{{ b.subtitle }}</text>
          </view>
          <view v-else-if="b.type === 'text'" class="pv-text">
            <text v-if="b.heading" class="pv-h">{{ b.heading }}</text>
            <text v-if="b.body" class="pv-p">{{ b.body }}</text>
          </view>
          <view v-else-if="b.type === 'hero'" class="pv-text">
            <image v-if="b.image" :src="b.image" mode="widthFix" class="pv-img" />
            <view v-else class="pv-img ph"></view>
            <text v-if="b.title" class="pv-h">{{ b.title }}</text>
            <text v-if="b.desc" class="pv-p">{{ b.desc }}</text>
          </view>
          <view v-else-if="b.type === 'gallery'" class="pv-gal">
            <template v-for="(img, gi) in b.images" :key="gi">
              <image v-if="img" :src="img" mode="aspectFill" class="pv-gal-img" />
              <view v-else class="pv-gal-img ph"></view>
            </template>
          </view>
          <view v-else-if="b.type === 'contact'" class="pv-text">
            <text v-if="b.showMobile && tel" class="pv-act">☎ {{ tel }}</text>
            <text v-if="b.showWechat && wechat" class="pv-act">微信号：{{ wechat }}</text>
            <text v-if="b.showAddress && (card?.address || card?.company)" class="muted small">◉ {{ card?.address || card?.company }}</text>
          </view>
          <view v-else-if="b.type === 'buttons'" class="pv-text">
            <view v-for="(it, ii) in b.items" :key="ii" class="pv-btn">{{ it.label || '按钮' }}</view>
          </view>
          <view v-else-if="b.type === 'video'" class="pv-text">
            <view v-if="b.url" class="muted small">视频：{{ b.url }}</view>
          </view>
          <view v-else-if="b.type === 'endcard'" class="pv-end">
            <text class="pv-end-name">{{ card?.name || '我的名片' }}</text>
            <text class="muted small">{{ [card?.title, card?.company].filter(Boolean).join(' · ') }}</text>
            <text v-if="watermark" class="pv-wm">免费版由 MCard 制作 · 开通会员可去水印</text>
          </view>
        </block>
      </view>
    </view>

    <!-- 页面/块结构 -->
    <view class="card" v-for="(p, pi) in schema.pages" :key="pi">
      <view class="section">第 {{ pi + 1 }} 页
        <text v-if="schema.pages.length > 1" class="del-link" @tap="removePage(pi)">删页</text>
      </view>
      <view v-for="(b, bi) in p.blocks" :key="bi" class="block-row" :class="{ on: selPage === pi && selBlock === bi }" @tap="select(pi, bi)">
        <text class="block-label">{{ TYPE_LABEL[b.type] || b.type }}</text>
        <view class="block-ops">
          <text v-if="bi > 0" @tap.stop="moveBlock(pi, bi, -1)">↑</text>
          <text v-if="bi < p.blocks.length - 1" @tap.stop="moveBlock(pi, bi, 1)">↓</text>
          <text class="danger" @tap.stop="removeBlock(pi, bi)">✕</text>
        </view>
      </view>
      <view class="add-row">
        <text v-for="t in ADDABLE" :key="t" class="add-chip" @tap="addBlock(pi, t)">＋{{ TYPE_LABEL[t] }}</text>
      </view>
    </view>
    <button v-if="schema.pages.length < maxPages" class="btn ghost block" style="margin: 0 24rpx" @tap="addPage">＋ 添加一页</button>
    <view v-else class="muted small center" style="padding:12rpx 24rpx">已达 {{ maxPages }} 页上限{{ paid ? '' : '，开通套餐可加页' }}</view>

    <!-- 选中块的字段表单 -->
    <view class="card" v-if="block">
      <view class="section">编辑「{{ TYPE_LABEL[block.type] }}」</view>

      <template v-if="block.type === 'cover'">
        <view class="field"><text class="label">主标题</text><input :value="block.title" maxlength="40" placeholder="一句话吸引点进来" @input="e => set('title', e.detail.value)" /></view>
        <view class="field"><text class="label">副标题</text><input :value="block.subtitle" maxlength="60" placeholder="公司名 / 一句补充" @input="e => set('subtitle', e.detail.value)" /></view>
        <view class="field">
          <text class="label">封面背景图（不传用主题色渐变）</text>
          <view class="if-row" @tap="pickImage('cover')">
            <image v-if="block.cover" :src="block.cover" mode="aspectFill" class="if-thumb" />
            <view v-else class="if-empty">＋</view>
            <text class="if-btn">{{ uploadTarget === 'cover' ? '上传中…' : (block.cover ? '更换图片' : '上传图片') }}</text>
          </view>
        </view>
      </template>
      <template v-else-if="block.type === 'text'">
        <view class="field"><text class="label">小标题</text><input :value="block.heading" maxlength="40" @input="e => set('heading', e.detail.value)" /></view>
        <view class="field"><text class="label">正文</text><textarea :value="block.body" maxlength="1200" auto-height placeholder="支持换行" @input="e => set('body', e.detail.value)" /></view>
      </template>
      <template v-else-if="block.type === 'hero'">
        <view class="field">
          <text class="label">图片</text>
          <view class="if-row" @tap="pickImage('hero')">
            <image v-if="block.image" :src="block.image" mode="aspectFill" class="if-thumb" />
            <view v-else class="if-empty">＋</view>
            <text class="if-btn">{{ uploadTarget === 'hero' ? '上传中…' : (block.image ? '更换图片' : '上传图片') }}</text>
          </view>
        </view>
        <view class="field"><text class="label">标题</text><input :value="block.title" maxlength="40" @input="e => set('title', e.detail.value)" /></view>
        <view class="field"><text class="label">描述</text><textarea :value="block.desc" maxlength="300" auto-height @input="e => set('desc', e.detail.value)" /></view>
      </template>
      <template v-else-if="block.type === 'gallery'">
        <view v-for="(img, gi) in block.images" :key="gi" class="field">
          <text class="label">图 {{ gi + 1 }}</text>
          <view class="if-row" @tap="pickImage('gallery', gi)">
            <image v-if="img" :src="img" mode="aspectFill" class="if-thumb" />
            <view v-else class="if-empty">＋</view>
            <text class="if-btn">{{ isUploadingGal(gi) ? '上传中…' : (img ? '更换图片' : '上传图片') }}</text>
          </view>
          <text class="del-link" @tap="delImg(gi)">删除</text>
        </view>
        <button v-if="block.images.length < 9" class="btn ghost block" @tap="addImg">＋ 添加图片位</button>
      </template>
      <template v-else-if="block.type === 'contact'">
        <view class="muted small" style="margin-bottom:12rpx">联系方式自动来自名片资料，这里只控制展示项（改号码去「编辑资料 → 联系方式」）</view>
        <view class="field"><text class="label">展示电话</text><switch :checked="block.showMobile" @change="e => set('showMobile', e.detail.value)" /></view>
        <view class="field"><text class="label">展示微信号</text><switch :checked="block.showWechat" @change="e => set('showWechat', e.detail.value)" /></view>
        <view class="field"><text class="label">展示地址</text><switch :checked="block.showAddress" @change="e => set('showAddress', e.detail.value)" /></view>
      </template>
      <template v-else-if="block.type === 'map'">
        <view class="field"><text class="label">位置名称</text><input :value="block.label" maxlength="80" placeholder="如：XX市XX区XX路XX号" @input="e => set('label', e.detail.value)" /></view>
      </template>
      <template v-else-if="block.type === 'buttons'">
        <view v-for="(it, ii) in block.items" :key="ii" class="field btn-field">
          <text class="label">按钮 {{ ii + 1 }}</text>
          <input :value="it.label" maxlength="12" placeholder="按钮文字" @input="e => setItem(ii, 'label', e.detail.value)" />
          <picker :range="['拨打电话', '复制微信号', '打开链接']" :value="['tel','wechat','link'].indexOf(it.action)" @change="e => setItem(ii, 'action', ['tel','wechat','link'][Number(e.detail.value)])">
            <view class="picker">动作：{{ ({ tel: '拨打电话', wechat: '复制微信号', link: '打开链接' })[it.action] }} ▾</view>
          </picker>
          <input :value="it.value" placeholder="号码 / 微信号 / 链接" @input="e => setItem(ii, 'value', e.detail.value)" />
          <text class="del-link" @tap="block.items.splice(ii, 1)">删除此按钮</text>
        </view>
        <button v-if="block.items.length < 3" class="btn ghost block" @tap="block.items.push({ label: '', action: 'tel', value: '' })">＋ 添加按钮</button>
      </template>
      <template v-else-if="block.type === 'video'">
        <view class="field"><text class="label">视频地址（mp4）</text><input :value="block.url" placeholder="上传视频后填入链接" @input="e => set('url', e.detail.value)" /></view>
      </template>
      <template v-else-if="block.type === 'endcard'">
        <view class="muted small">尾页自动展示你的名片卡与二维码，访客看完直接跳名片。{{ watermark ? '免费版尾页带品牌水印，开通套餐后自动去除。' : '当前套餐：无水印。' }}</view>
      </template>
    </view>

    <view class="bottom">
      <button class="btn ghost" style="flex:1" :disabled="saving" @tap="save(false)">保存</button>
      <button class="btn primary" style="flex:2" :disabled="saving" @tap="publish">{{ page?.status === 'published' ? '更新发布' : '发布' }}</button>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { api, toast, uploadImage, ensurePrivacy, baseUrl } from '../../../utils/request'

const TYPE_LABEL = { cover: '封面', text: '文本', hero: '图文', gallery: '图集', contact: '联系方式', map: '位置', buttons: '按钮组', video: '视频', endcard: '名片尾页' }
const ADDABLE = ['cover', 'text', 'hero', 'gallery', 'contact', 'map', 'buttons', 'video', 'endcard']
const FREE_MAX_PAGES = 3, PAID_MAX_PAGES = 12

const page = ref(null)
const title = ref('')
const schema = ref({ pages: [{ blocks: [{ type: 'cover', title: '', subtitle: '', cover: '' }] }] })
const selPage = ref(0)
const selBlock = ref(0)
const saveState = ref('')
const saving = ref(false)
const previewOpen = ref(false)
const card = ref(null)
const paid = ref(false)
const watermark = ref(true)
const maxPages = ref(PAID_MAX_PAGES) // 前端只做引导，服务端强制

const block = computed(() => schema.value.pages[selPage.value]?.blocks[selBlock.value] || null)
const pagesCount = computed(() => schema.value.pages.length)
const tel = computed(() => card.value?.mobile || card.value?.phone || '')
const wechat = computed(() => card.value?.wechat || '')

// 统一图片上传：target 'cover'|'hero'|('gallery', idx)——chooseImage → uploadImage → 写入对应字段
const uploadTarget = ref('') // 'cover' | 'hero' | 'gallery'
const uploadGalIdx = ref(-1)
const isUploadingGal = gi => uploadTarget.value === 'gallery' && uploadGalIdx.value === gi
async function pickImage(target, gi = -1) {
  if (uploadTarget.value) return
  if (!(await ensurePrivacy())) return toast('需要同意隐私授权才能选择图片')
  uni.chooseImage({ count: 1, sizeType: ['compressed'], success: async res => {
    uploadTarget.value = target; uploadGalIdx.value = gi
    try {
      const url = await uploadImage(res.tempFilePaths[0])
      const b = block.value; if (!b) return
      if (target === 'cover') b.cover = url
      else if (target === 'hero') b.image = url
      else if (target === 'gallery' && b.type === 'gallery' && b.images[gi] !== undefined) b.images[gi] = url
    } catch (e) { toast(e.message || '上传失败') } finally { uploadTarget.value = ''; uploadGalIdx.value = -1 }
  } })
}

function set(k, v) { const b = block.value; if (b) { b[k] = v; saveState.value = '有未保存的修改，记得点「保存」' } }
function setImg(gi, u) { const b = block.value; if (b?.type === 'gallery') { b.images[gi] = u; saveState.value = '有未保存的修改，记得点「保存」' } }
function delImg(gi) { const b = block.value; if (b?.type === 'gallery') { b.images.splice(gi, 1); saveState.value = '有未保存的修改，记得点「保存」' } }
function addImg() { const b = block.value; if (b?.type === 'gallery' && b.images.length < 9) { b.images.push(''); saveState.value = '有未保存的修改，记得点「保存」' } }
function setItem(ii, k, v) { const b = block.value; if (b?.type === 'buttons') { b.items[ii][k] = v; saveState.value = '有未保存的修改，记得点「保存」' } }

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
function select(pi, bi) { selPage.value = pi; selBlock.value = bi }
function addBlock(pi, t) {
  schema.value.pages[pi].blocks.push(blank(t))
  selPage.value = pi; selBlock.value = schema.value.pages[pi].blocks.length - 1
}
function removeBlock(pi, bi) { schema.value.pages[pi].blocks.splice(bi, 1); selBlock.value = 0 }
function moveBlock(pi, bi, d) {
  const arr = schema.value.pages[pi].blocks
  const t = arr[bi]; arr[bi] = arr[bi + d]; arr[bi + d] = t
  selBlock.value = bi + d
}
function addPage() { schema.value.pages.push({ blocks: [blank('cover')] }); selPage.value = schema.value.pages.length - 1; selBlock.value = 0 }
function removePage(pi) {
  if (schema.value.pages.length <= 1) return
  schema.value.pages.splice(pi, 1); selPage.value = 0; selBlock.value = 0
}

async function save(silent = true) {
  saving.value = true
  try {
    await api.put(`/api/h5/${page.value.id}`, { title: title.value, schema: schema.value }, true)
    saveState.value = '✓ 已保存'
  } catch (e) {
    saveState.value = '保存失败：' + (e.message || '网络异常')
    if (!silent) toast(saveState.value)
  } finally { saving.value = false }
}
async function publish() {
  await save(true)
  saving.value = true
  try {
    await api.post(`/api/h5/${page.value.id}/publish`, {}, true)
    page.value.status = 'published'
    uni.showModal({
      title: '已发布', content: '访客可通过链接访问。复制链接发给客户？',
      success: m => {
        if (!m.confirm) return
        uni.setClipboardData({ data: `${baseUrl}/h5/${page.value.slug}` })
      }
    })
  } catch (e) { toast(e.message || '发布失败') } finally { saving.value = false }
}

// 封面占位：空图用主题色渐变（与 H5 渲染口径一致）
function bgStyle(u) {
  return u ? `background-image:url(${u});background-size:cover;background-position:center` : 'background:linear-gradient(135deg,#7f1d1d,#a62b2b)'
}

onLoad(async opt => {
  if (!uni.getStorageSync('mcard_token')) return toast('请先登录')
  try {
    const mine = await api.get('/api/h5/mine', true)
    paid.value = !!mine.limits?.paid
    watermark.value = !mine.limits?.paid
    maxPages.value = mine.limits?.maxPages || (paid.value ? PAID_MAX_PAGES : FREE_MAX_PAGES)
  } catch {}
  try {
    const d = await api.get(`/api/h5/${opt?.id}`, true)
    page.value = d.page
    title.value = d.page.title
    if (Array.isArray(d.page.schema?.pages) && d.page.schema.pages.length) schema.value = d.page.schema
  } catch (e) { toast(e.message || '加载失败'); setTimeout(() => uni.navigateBack(), 800) }
  try { card.value = await api.get('/api/cards/mine', true) } catch {}
})
</script>

<style scoped>
.page { min-height: 100vh; background: #f7f2e7; padding-bottom: 180rpx; }
.top { display: flex; align-items: center; gap: 12rpx; padding: 20rpx 24rpx 8rpx; }
.title-input { flex: 1; min-width: 0; background: #fff; border-radius: 14rpx; padding: 18rpx 22rpx; font-size: 28rpx; font-weight: 700; }
.save-state { padding: 4rpx 28rpx; }
.preview { margin: 0 24rpx 16rpx; background: #171a21; border-radius: 20rpx; overflow: hidden; }
.pv-page { padding: 40rpx 32rpx; display: flex; flex-direction: column; gap: 22rpx; border-bottom: 2rpx solid rgba(255,255,255,.06); }
.pv-cover { min-height: 320rpx; border-radius: 16rpx; display: flex; flex-direction: column; justify-content: flex-end; padding: 30rpx; gap: 8rpx; }
.pv-cover-t { color: #fff; font-size: 38rpx; font-weight: 800; }
.pv-cover-s { color: rgba(255,255,255,.85); font-size: 24rpx; }
.pv-text { display: flex; flex-direction: column; gap: 8rpx; }
.pv-h { color: #f0a; color: #d8b06a; font-size: 30rpx; font-weight: 700; }
.pv-p { color: #d1d5db; font-size: 24rpx; line-height: 1.8; white-space: pre-line; }
.pv-img { width: 100%; border-radius: 14rpx; }
.pv-img.ph { height: 220rpx; background: linear-gradient(135deg,#3a2f22,#5a4630); }
.pv-gal { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10rpx; }
.pv-gal-img { width: 100%; height: 200rpx; border-radius: 12rpx; }
.pv-gal-img.ph { background: linear-gradient(135deg,#3a2f22,#5a4630); }
.pv-act { background: rgba(255,255,255,.08); color: #f3f4f6; border-radius: 12rpx; padding: 16rpx; font-size: 24rpx; }
.pv-btn { background: #a62b2b; color: #fff; text-align: center; border-radius: 999rpx; padding: 18rpx; font-size: 26rpx; font-weight: 700; }
.pv-end { background: rgba(255,255,255,.07); border-radius: 16rpx; padding: 24rpx; display: flex; flex-direction: column; gap: 6rpx; }
.pv-end-name { color: #fff; font-size: 30rpx; font-weight: 700; }
.pv-wm { color: #6b7280; font-size: 20rpx; margin-top: 8rpx; }
.card { margin: 0 24rpx 16rpx; background: #fff; border-radius: 16rpx; padding: 22rpx; }
.section { font-size: 26rpx; font-weight: 700; margin-bottom: 14rpx; display: flex; align-items: center; gap: 16rpx; }
.del-link { color: #b91c1c; font-size: 22rpx; font-weight: 700; }
.block-row { display: flex; align-items: center; justify-content: space-between; padding: 16rpx 18rpx; border-radius: 12rpx; font-size: 25rpx; background: #faf6ec; margin-bottom: 10rpx; }
.block-row.on { background: #a62b2b; color: #fff; font-weight: 700; }
.block-label { flex: 1; }
.block-ops { display: flex; gap: 20rpx; }
.block-ops text { padding: 2rpx 10rpx; }
.block-ops .danger { color: #fca5a5; }
.block-row:not(.on) .danger { color: #b91c1c; }
.add-row { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 12rpx; padding-top: 14rpx; border-top: 2rpx dashed #e8dcc2; }
.add-chip { font-size: 22rpx; padding: 8rpx 16rpx; border: 2rpx solid #e8dcc2; border-radius: 999rpx; background: #fdf8ec; color: #6b5a3e; }
.field { display: flex; flex-direction: column; gap: 10rpx; margin-bottom: 18rpx; }
.field .label { font-size: 23rpx; color: #6b5a3e; font-weight: 700; }
.field input, .field textarea { background: #faf6ec; border-radius: 12rpx; padding: 16rpx 20rpx; font-size: 26rpx; }
.field switch { transform: scale(.8); transform-origin: left center; }
.btn-field { border: 2rpx dashed #e8dcc2; border-radius: 14rpx; padding: 16rpx; }
.picker { background: #faf6ec; border-radius: 12rpx; padding: 16rpx 20rpx; font-size: 26rpx; }
.if-row { display: flex; align-items: center; gap: 16rpx; }
.if-thumb { width: 120rpx; height: 120rpx; border-radius: 14rpx; }
.if-empty { width: 120rpx; height: 120rpx; border: 3rpx dashed #e8dcc2; border-radius: 14rpx; display: flex; align-items: center; justify-content: center; font-size: 44rpx; color: #b09a72; }
.if-btn { font-size: 24rpx; color: #a62b2b; font-weight: 700; }
.bottom { position: fixed; left: 0; right: 0; bottom: 0; display: flex; gap: 14rpx; padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom, 0px)); background: rgba(255,255,255,.97); box-shadow: 0 -4rpx 20rpx rgba(15,23,42,.06); }
.center { text-align: center; }
.small { font-size: 22rpx; }
.muted { color: #8a7355; }
.btn { border-radius: 999rpx; font-size: 27rpx; font-weight: 700; display: flex; align-items: center; justify-content: center; padding: 16rpx 0; }
.btn.primary { background: #a62b2b; color: #fff; }
.btn.ghost { background: #fff; color: #4b3d2b; border: 2rpx solid #e8dcc2; }
.btn.tiny { padding: 8rpx 24rpx; font-size: 22rpx; width: fit-content; }
.btn.block { width: 100%; }
.btn.danger { background: #fee2e2; color: #b91c1c; }
</style>
