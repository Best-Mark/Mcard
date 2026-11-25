<template>
  <div class="page">
    <header class="topbar">
      <button class="back" @click="done" aria-label="返回">‹</button>
      <span class="title">配色风格</span>
      <span class="spacer"></span>
      <button class="btn btn-sm btn-primary" :disabled="saving || loading || !!loadError" @click="done">{{ saving ? '保存中…' : '完成' }}</button>
    </header>

    <div class="container wide">
      <div v-if="loadError" class="card card-pad">
        <b style="color:#b91c1c">名片加载失败</b><p class="small muted">{{ loadError }}</p>
        <button class="btn btn-sm btn-primary" style="margin-top:10px" @click="load">重新加载</button>
      </div>
      <div v-else-if="loading" class="card card-pad">加载中…</div>
      <div v-else-if="!card" class="card card-pad">请先创建名片 <router-link to="/me" style="color:var(--primary)">去创建</router-link></div>

      <template v-else>
        <!-- 顶部常显预览：真实模板的编辑预览组件，改配色/模板即时反映（未保存也能看到） -->
        <div class="preview-panel">
          <div class="card card-pad preview-card">
            <div class="preview-head">
              <div class="section-title" style="margin:0">实时预览 <small>1:1 视觉比例 · 改完即时可见</small></div>
              <span class="badge small">{{ currentTplLabel }}</span>
            </div>
            <CardPreview :card="card" :tags="tags" :qr-url="previewQr" section="identity" />
          </div>
        </div>

        <!-- 底部功能上弹面板：模板 + 二维码风格融合在一个面板。
             强调色不再单列（选模板即配好整套配色）；二维码只留预设/码点/定位角，中心 LOGO 固定居中常显。 -->
        <div class="sheet-mask" :class="{ show: sheetOpen }" @click="sheetOpen = false"></div>
        <div class="edit-sheet" :class="{ show: sheetOpen }" role="dialog" aria-label="模板与二维码设置">
          <div class="sheet-grab" @click="sheetOpen = false"><span></span></div>

          <div class="card card-pad control-panel">
            <div class="section-title" style="margin-top:0">展示模板</div>
            <p class="small muted">选一套模板即应用整套配色（含强调色与二维码配色）。</p>
            <div class="tpl-list">
              <button v-for="tpl in templates" :key="tpl.key" class="tpl-item" :class="{ on: card.template === tpl.key }" @click="chooseTemplate(tpl.key)">
                <span class="tpl-thumb" :class="'thumb-' + tpl.key"><i class="tpl-ava"></i></span>
                <b>{{ tpl.label }}</b>
                <span class="tpl-desc">{{ tpl.desc }}</span>
                <span v-if="card.template === tpl.key" class="tpl-check">✓ 使用中</span>
              </button>
            </div>
            <div v-if="!templates.length" class="small muted">模板列表加载中，请稍候…</div>

            <div class="section-title qr-section-title">二维码</div>
            <p class="small muted">中心 LOGO 固定居中常显，这里只挑码点风格。</p>
            <div class="field"><label>一键预设</label>
              <div class="qr-presets">
                <button v-for="p in QR_PRESETS" :key="p.key" class="qr-preset" :class="{ on: qrPresetActive(p) }" @click="applyQrPreset(p)">
                  <i :style="{ background: p.swatch }"></i>{{ p.label }}
                </button>
              </div>
            </div>
            <div class="grid2">
              <div class="field"><label>码点形状</label>
                <BottomSelect v-model="card.qr_style.dot" :options="DOT_OPTIONS" title="码点形状" />
              </div>
              <div class="field"><label>定位角样式</label>
                <BottomSelect v-model="card.qr_style.eye" :options="EYE_OPTIONS" title="定位角样式" />
              </div>
            </div>
            <!-- 明确收起面板：点了才算本项设置完（真正持久化仍是右上角「完成」） -->
            <div class="sheet-confirm"><button class="btn btn-primary btn-block" @click="sheetOpen = false">确定</button></div>
          </div>
        </div>

        <!-- 常驻底部入口：所有风格项都在同一个面板里 -->
        <div class="bottom-launcher">
          <button :class="{ on: sheetOpen }" @click="sheetOpen = true">
            <span class="tab-ico ico-template"></span><span>模板与二维码</span>
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api'
import { showToast } from '../store'
import { THEMES, paletteOf } from '../utils/themes'
import CardPreview from '../components/CardPreview.vue'
import BottomSelect from '../components/BottomSelect.vue'

const router = useRouter()
const card = ref(null)
const tags = ref([])
const templates = ref([])
const saving = ref(false)
const busyLoad = ref(false)
const loading = ref(false)
const loadError = ref('')
const sheetOpen = ref(false)
// 弹层打开锁页面滚动，避免上拖时带动背后的页（弹层内部自己滚）
let bodyOverflowBefore = ''
watch(sheetOpen, on => {
  if (on) { bodyOverflowBefore = document.body.style.overflow; document.body.style.overflow = 'hidden' }
  else document.body.style.overflow = bodyOverflowBefore
})
onBeforeUnmount(() => { document.body.style.overflow = bodyOverflowBefore })

// 二维码只留三项可调：一键预设 + 码点形状 + 定位角样式。
// 码色/底色跟模板走，中心 LOGO 固定居中常显（logoShape 锁 rounded、qr_logo 锁 true）。
const DOT_OPTIONS = [{ value: 'square', label: '方形' }, { value: 'dots', label: '圆点' }, { value: 'rounded', label: '圆角' }]
const EYE_OPTIONS = [{ value: 'square', label: '方形' }, { value: 'rounded', label: '圆角' }, { value: 'circle', label: '圆形' }]
const QR_PRESETS = [
  { key: 'classic', label: '经典', swatch: '#0f172a', dot: 'square', eye: 'square', gradTo: '' },
  { key: 'dots', label: '圆点', swatch: '#2563eb', dot: 'dots', eye: 'rounded', gradTo: '' },
  { key: 'tech', label: '科技渐变', swatch: 'linear-gradient(135deg,#2563eb,#06b6d4)', dot: 'rounded', eye: 'rounded', gradTo: '#06b6d4' },
  { key: 'elegant', label: '典雅', swatch: '#b45309', dot: 'rounded', eye: 'circle', gradTo: '' }
]
// LOGO 永远居中常显：底板固定圆角方（qrcode.js 里居中绘制），开关强制开
const FIXED_LOGO_SHAPE = 'rounded'
const currentTplLabel = computed(() => templates.value.find(t => t.key === card.value?.template)?.label || card.value?.template || '默认')
const previewQr = computed(() => {
  const c = card.value
  if (!c?.slug) return ''
  const st = encodeURIComponent(JSON.stringify(c.qr_style || {}))
  return `/api/cards/public/${c.slug}/qr.svg?size=320&brand=M&fg=${encodeURIComponent(c.qr_fg || '#0f172a')}&bg=${encodeURIComponent(c.qr_bg || '#ffffff')}&logo=1&style=${st}`
})

function qrPresetActive(p) {
  const s = card.value?.qr_style || {}
  return s.dot === p.dot && s.eye === p.eye && (s.gradTo || '') === p.gradTo
}
function applyQrPreset(p) {
  card.value.qr_style = { ...(card.value.qr_style || {}), dot: p.dot, eye: p.eye, gradTo: p.gradTo }
}
function chooseTemplate(key) {
  const pal = paletteOf(key)
  card.value.template = key
  card.value.theme = pal.theme
  card.value.accent = (THEMES[pal.theme] || THEMES.ocean).accent
  card.value.qr_fg = pal.qrFg
  card.value.qr_bg = pal.qrBg
  showToast(`已应用「${currentTplLabel.value}」整套配色`, 'success')
}

async function load() {
  if (busyLoad.value) return
  busyLoad.value = true
  loading.value = true
  loadError.value = ''
  try {
    const { data } = await api.get('/api/cards/mine')
    if (!data.data) return router.replace('/me')
    card.value = {
      ...data.data,
      // 中心 LOGO 永远居中常显：存量关掉/异形底板的也在这里归一，保存时一并落库
      qr_logo: true,
      qr_style: { dot: 'square', eye: 'square', gradTo: '', bgImage: '', ...(data.data.qr_style || {}), logoShape: FIXED_LOGO_SHAPE }
    }
    tags.value = data.data.tags || []
  } catch (e) { loadError.value = e.message || '网络异常' } finally { loading.value = false; busyLoad.value = false }
}
async function loadTemplates() {
  try { const { data } = await api.get(`/api/cards/public/templates?t=${Date.now()}`); templates.value = data.data?.templates || [] } catch {}
}
onMounted(async () => { await load(); loadTemplates() })

async function done() {
  if (saving.value || !card.value) return
  saving.value = true
  const c = card.value
  try {
    await api.put('/api/cards/mine', {
      template: c.template, theme: c.theme, accent: c.accent,
      qr_fg: c.qr_fg, qr_bg: c.qr_bg, qr_logo: !!c.qr_logo, qr_style: c.qr_style || {}
    })
    showToast('配色已保存', 'success')
    router.push('/me')
  } catch (e) { showToast(e.message || '保存失败', 'error') } finally { saving.value = false }
}
</script>

<style scoped>
.page { padding-bottom: calc(100px + env(safe-area-inset-bottom)); }
/* 顶栏统一用 global.css 的沉浸式 .topbar（含 safe-area 贴顶、34px 返回按钮、左右 16px 对齐） */
.preview-panel { margin-top: 12px; }
.preview-card { padding: 12px; }
.preview-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }

/* 与实体名片设计同款层级：tabbar=110，launcher=105，遮罩=120，弹层=121。
   ⚠️ 层级低于 tabbar 会导致弹层里底部字段被 tabbar 盖住点不到；visibility 必须隐藏，否则拦截背后滚动。 */
/* 四边定位兼容老 WebView（inset:0 在部分 X5/iOS 内核不生效） */
.sheet-mask { position: fixed; top: 0; right: 0; bottom: 0; left: 0; background: rgba(15,23,42,.45); z-index: 120; opacity: 0; pointer-events: none; transition: opacity .2s; }
.sheet-mask.show { opacity: 1; pointer-events: auto; }
.edit-sheet { position: fixed; left: 0; right: 0; bottom: 0; z-index: 121; background: #fff; border-radius: 16px 16px 0 0; transform: translateY(105%); transition: transform .24s ease; visibility: hidden; max-height: 78vh; overflow-y: auto; overscroll-behavior: contain; display: flex; flex-direction: column; padding-bottom: calc(18px + env(safe-area-inset-bottom)); }
.edit-sheet.show { transform: translateY(0); visibility: visible; }
@media (min-width: 900px) { .edit-sheet { left: 50%; right: auto; width: 560px; margin-left: -280px; border-radius: 16px 16px 0 0; } }
.sheet-grab { height: 18px; display: grid; place-items: center; flex: 0 0 18px; }
.sheet-grab span { width: 36px; height: 4px; border-radius: 2px; background: var(--line); }
.tab-ico { width: 14px; height: 14px; border-radius: 3px; background: currentColor; opacity: .75; flex: 0 0 14px; }
.control-panel { margin: 0; border-radius: 0; border: 0; flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
.qr-section-title { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--line); }
/* tabbar 在本页已隐藏（App.vue hideMemberNav），功能条贴底；z105 仍低于弹层 120/121 */
.bottom-launcher { position: fixed; left: 0; right: 0; bottom: 0; z-index: 105; display: flex; gap: 6px; padding: 8px 12px calc(10px + env(safe-area-inset-bottom)); background: #fff; border-top: 1px solid var(--line); box-shadow: 0 -4px 16px rgba(0,0,0,.06); }
.bottom-launcher button { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 0; border-radius: 8px; color: var(--muted); font-size: 12px; }
.bottom-launcher button.on { color: var(--primary); background: #eef4ff; background: color-mix(in srgb, var(--primary) 10%, transparent); }
/* 宽屏（PC 桌面壳）限宽居中，与 sheet 对齐，避免通栏横条 */
@media (min-width: 900px) { .bottom-launcher { max-width: 560px; left: 50%; right: auto; transform: translateX(-50%); border-radius: 14px 14px 0 0; } }
/* 缩略图骨架与配色来自共享 template-thumbs.css，这里只把面板内改 3 列 + 缩略图稍矮 */
.tpl-list { grid-template-columns: repeat(3, 1fr); gap: 8px; }
.tpl-thumb { height: 46px; }
.sheet-confirm { position: sticky; bottom: 0; padding: 10px 0 2px; background: #fff; margin-top: 6px; }
.qr-presets { display: flex; gap: 8px; flex-wrap: wrap; }
.qr-preset { display: flex; align-items: center; gap: 5px; padding: 6px 10px; border: 1px solid var(--line); border-radius: 8px; font-size: 12px; }
.qr-preset.on { border-color: var(--primary); color: var(--primary); }
.qr-preset i { width: 16px; height: 16px; border-radius: 3px; }
</style>
