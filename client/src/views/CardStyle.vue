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

        <!-- 底部功能上弹面板：横滑模板条 + 配色/二维码调节，与实体名片设计同一交互 -->
        <div class="sheet-mask" :class="{ show: sheetOpen }" @click="sheetOpen = false"></div>
        <div class="edit-sheet" :class="{ show: sheetOpen }" role="dialog" aria-label="配色风格设置">
          <div class="sheet-grab" @click="sheetOpen = false"><span></span></div>
          <div class="control-tabs" role="tablist">
            <button v-for="s in SECTIONS" :key="s.k" class="control-tab" :class="{ on: openSection === s.k }" role="tab" :aria-selected="openSection === s.k" @click="openSection = s.k">
              <span class="tab-ico" :class="'ico-' + s.k"></span><span class="tab-txt">{{ s.label }}</span>
              <span class="tab-dot" v-if="openSection === s.k"></span>
            </button>
          </div>

          <div class="card card-pad control-panel">
            <template v-if="openSection === 'template'">
              <div class="section-title" style="margin-top:0">展示模板</div>
              <p class="small muted">选一套模板即应用整套配色（含二维码颜色）；想微调可在「强调色」里改。</p>
              <div class="tpl-list">
                <button v-for="tpl in templates" :key="tpl.key" class="tpl-item" :class="{ on: card.template === tpl.key }" @click="chooseTemplate(tpl.key)">
                  <span class="tpl-thumb" :class="'thumb-' + tpl.key"><i class="tpl-ava"></i></span>
                  <b>{{ tpl.label }}</b>
                  <span class="tpl-desc">{{ tpl.desc }}</span>
                  <span v-if="card.template === tpl.key" class="tpl-check">✓ 使用中</span>
                </button>
              </div>
              <div v-if="!templates.length" class="small muted">模板列表加载中，请稍候…</div>
            </template>

            <template v-else-if="openSection === 'color'">
              <div class="section-title" style="margin-top:0">强调色</div>
              <p class="small muted">点色块即可切换，选模板时也会自动配好整套颜色。</p>
              <div class="swatch-grid">
                <button v-for="s in ACCENT_SWATCHES" :key="s.key" class="swatch-item" :class="{ on: card.accent === s.color }" @click="card.accent = s.color; card.theme = s.key">
                  <i :style="{ background: s.color }"></i><span>{{ s.label }}</span>
                </button>
              </div>
            </template>

            <template v-else-if="openSection === 'qr'">
              <div class="section-title" style="margin-top:0">二维码美化</div>
              <div class="field"><label>一键预设</label>
                <div class="qr-presets">
                  <button v-for="p in QR_PRESETS" :key="p.key" class="qr-preset" :class="{ on: qrPresetActive(p) }" @click="applyQrPreset(p)">
                    <i :style="{ background: p.swatch }"></i>{{ p.label }}
                  </button>
                </div>
              </div>
              <div class="field"><label>码色（深码浅底才扫得出）</label>
                <div class="swatch-grid compact">
                  <button v-for="s in QR_SWATCHES" :key="s.color" class="swatch-item" :class="{ on: card.qr_fg === s.color }" @click="card.qr_fg = s.color">
                    <i :style="{ background: s.color }"></i><span>{{ s.label }}</span>
                  </button>
                </div>
              </div>
              <div class="field"><label>底色</label>
                <div class="swatch-grid compact">
                  <button v-for="s in QR_SWATCHES" :key="s.color" class="swatch-item" :class="{ on: card.qr_bg === s.color }" @click="card.qr_bg = s.color">
                    <i :style="{ background: s.color }"></i><span>{{ s.label }}</span>
                  </button>
                </div>
              </div>
              <div class="grid2">
                <div class="field"><label>码点形状</label>
                  <select v-model="card.qr_style.dot" class="input"><option value="square">方形</option><option value="dots">圆点</option><option value="rounded">圆角</option></select>
                </div>
                <div class="field"><label>定位角样式</label>
                  <select v-model="card.qr_style.eye" class="input"><option value="square">方形</option><option value="rounded">圆角</option><option value="circle">圆形</option></select>
                </div>
                <div class="field"><label>渐变终点色（不选=纯色）</label>
                  <div class="swatch-grid compact">
                    <button v-for="s in QR_SWATCHES" :key="s.color" class="swatch-item" :class="{ on: card.qr_style.gradTo === s.color }" @click="card.qr_style.gradTo = s.color">
                      <i :style="{ background: s.color }"></i><span>{{ s.label }}</span>
                    </button>
                    <button class="swatch-item" :class="{ on: !card.qr_style.gradTo }" @click="card.qr_style.gradTo = ''"><i style="background:#fff;border:1px solid var(--line)"></i><span>纯色</span></button>
                  </div>
                </div>
                <div class="field"><label>中心 Logo 底板</label>
                  <select v-model="card.qr_style.logoShape" class="input"><option value="rounded">圆角方</option><option value="circle">圆形</option><option value="none">无底板</option></select>
                </div>
                <div class="field"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" v-model="card.qr_logo" /> 二维码中心 Logo</label></div>
              </div>
              <p class="small muted">二维码请保持足够对比度（深码 + 浅底），否则可能扫不出来。</p>
            </template>
            <!-- 明确收起面板：点了才算本项设置完（真正持久化仍是右上角「完成」） -->
            <div class="sheet-confirm"><button class="btn btn-primary btn-block" @click="sheetOpen = false">确定</button></div>
          </div>
        </div>

        <!-- 常驻底部功能入口：点任意项打开调节面板（与实体名片设计一致） -->
        <div class="bottom-launcher">
          <button v-for="s in SECTIONS" :key="s.k" :class="{ on: sheetOpen && openSection === s.k }" @click="openSection = s.k; sheetOpen = true">
            <span class="tab-ico" :class="'ico-' + s.k"></span><span>{{ s.label }}</span>
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

const router = useRouter()
const card = ref(null)
const tags = ref([])
const templates = ref([])
const saving = ref(false)
const busyLoad = ref(false)
const loading = ref(false)
const loadError = ref('')
const sheetOpen = ref(false)
const openSection = ref('template')
// 弹层打开锁页面滚动，避免上拖时带动背后的页（弹层内部自己滚）
let bodyOverflowBefore = ''
watch(sheetOpen, on => {
  if (on) { bodyOverflowBefore = document.body.style.overflow; document.body.style.overflow = 'hidden' }
  else document.body.style.overflow = bodyOverflowBefore
})
onBeforeUnmount(() => { document.body.style.overflow = bodyOverflowBefore })

const SECTIONS = [
  { k: 'template', label: '模板' },
  { k: 'color', label: '强调色' },
  { k: 'qr', label: '二维码' }
]
// 强调色板：直接来自主题唯一真相源 THEMES（不再弹系统取色器，那东西在手机上没有确定的返回语义）
const ACCENT_SWATCHES = Object.entries(THEMES).map(([k, v]) => ({ key: k, label: v.label, color: v.accent }))
// 二维码配色板：常用深码 / 浅底安全色；渐变终点允许「无」
const QR_SWATCHES = [
  { label: '墨黑', color: '#0f172a' }, { label: '深蓝', color: '#1e3a8a' },
  { label: '翠绿', color: '#0f766e' }, { label: '金棕', color: '#b45309' },
  { label: '纯白', color: '#ffffff' }, { label: '米白', color: '#f8fafc' },
  { label: '浅青', color: '#e0f2fe' }
]
const QR_PRESETS = [
  { key: 'classic', label: '经典', swatch: '#0f172a', dot: 'square', eye: 'square', gradTo: '', logoShape: 'rounded' },
  { key: 'dots', label: '圆点', swatch: '#2563eb', dot: 'dots', eye: 'rounded', gradTo: '', logoShape: 'circle' },
  { key: 'tech', label: '科技渐变', swatch: 'linear-gradient(135deg,#2563eb,#06b6d4)', dot: 'rounded', eye: 'rounded', gradTo: '#06b6d4', logoShape: 'circle' },
  { key: 'elegant', label: '典雅', swatch: '#b45309', dot: 'rounded', eye: 'circle', gradTo: '', logoShape: 'rounded' }
]
const currentTplLabel = computed(() => templates.value.find(t => t.key === card.value?.template)?.label || card.value?.template || '默认')
const previewQr = computed(() => {
  const c = card.value
  if (!c?.slug) return ''
  const st = encodeURIComponent(JSON.stringify(c.qr_style || {}))
  return `/api/cards/public/${c.slug}/qr.svg?size=320&brand=M&fg=${encodeURIComponent(c.qr_fg || '#0f172a')}&bg=${encodeURIComponent(c.qr_bg || '#ffffff')}&logo=${c.qr_logo ? 1 : 0}&style=${st}`
})

function qrPresetActive(p) {
  const s = card.value?.qr_style || {}
  return s.dot === p.dot && s.eye === p.eye && (s.gradTo || '') === p.gradTo && s.logoShape === p.logoShape
}
function applyQrPreset(p) {
  card.value.qr_style = { ...(card.value.qr_style || {}), dot: p.dot, eye: p.eye, gradTo: p.gradTo, logoShape: p.logoShape }
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
      qr_style: { dot: 'square', eye: 'square', gradTo: '', logoShape: 'rounded', bgImage: '' },
      ...data.data,
      qr_style: { dot: 'square', eye: 'square', gradTo: '', logoShape: 'rounded', bgImage: '', ...(data.data.qr_style || {}) }
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
.topbar { height: 50px; display: flex; align-items: center; gap: 10px; padding: 0 12px; background: #fff; border-bottom: 1px solid var(--line); }
.topbar .back { font-size: 30px; line-height: 1; color: var(--text); }
.topbar .title { font-weight: 700; font-size: 15px; }
.topbar .spacer { flex: 1; }
.preview-panel { margin-top: 12px; }
.preview-card { padding: 12px; }
.preview-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }

/* 与实体名片设计同款层级：tabbar=110，launcher=105，遮罩=120，弹层=121。
   ⚠️ 层级低于 tabbar 会导致弹层里底部字段被 tabbar 盖住点不到；visibility 必须隐藏，否则拦截背后滚动。 */
.sheet-mask { position: fixed; inset: 0; background: rgba(15,23,42,.45); z-index: 120; opacity: 0; pointer-events: none; transition: opacity .2s; }
.sheet-mask.show { opacity: 1; pointer-events: auto; }
.edit-sheet { position: fixed; left: 0; right: 0; bottom: 0; z-index: 121; background: #fff; border-radius: 16px 16px 0 0; transform: translateY(105%); transition: transform .24s ease; visibility: hidden; max-height: 78vh; overflow-y: auto; overscroll-behavior: contain; display: flex; flex-direction: column; padding-bottom: calc(18px + env(safe-area-inset-bottom)); }
.edit-sheet.show { transform: translateY(0); visibility: visible; }
@media (min-width: 900px) { .edit-sheet { left: 50%; right: auto; width: 560px; margin-left: -280px; border-radius: 16px 16px 0 0; } }
.sheet-grab { height: 18px; display: grid; place-items: center; flex: 0 0 18px; }
.sheet-grab span { width: 36px; height: 4px; border-radius: 2px; background: var(--line); }
.control-tabs { display: flex; gap: 4px; padding: 6px 12px; overflow-x: auto; border-bottom: 1px solid var(--line); }
.control-tab { position: relative; flex: 0 0 auto; display: flex; align-items: center; gap: 5px; padding: 8px 12px; border-radius: 8px; color: var(--muted); font-size: 13px; }
.control-tab.on { background: color-mix(in srgb, var(--primary) 10%, transparent); color: var(--primary); font-weight: 700; }
.tab-ico { width: 14px; height: 14px; border-radius: 4px; background: currentColor; opacity: .75; flex: 0 0 14px; }
.ico-template { border-radius: 3px; }
.ico-color { border-radius: 50%; }
.ico-qr { border-radius: 2px; }
.tab-dot { position: absolute; bottom: 0; left: 50%; width: 4px; height: 4px; border-radius: 50%; background: var(--primary); }
.control-panel { margin: 0; border-radius: 0; border: 0; flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
/* tabbar 在本页已隐藏（App.vue hideMemberNav），功能条贴底；z105 仍低于弹层 120/121 */
.bottom-launcher { position: fixed; left: 0; right: 0; bottom: 0; z-index: 105; display: flex; gap: 6px; padding: 8px 12px calc(10px + env(safe-area-inset-bottom)); background: #fff; border-top: 1px solid var(--line); box-shadow: 0 -4px 16px rgba(0,0,0,.06); }
.bottom-launcher button { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 0; border-radius: 8px; color: var(--muted); font-size: 12px; }
.bottom-launcher button.on { color: var(--primary); background: color-mix(in srgb, var(--primary) 10%, transparent); }
/* 缩略图骨架与配色来自共享 template-thumbs.css，这里只把面板内改 3 列 + 缩略图稍矮 */
.tpl-list { grid-template-columns: repeat(3, 1fr); gap: 8px; }
.tpl-thumb { height: 46px; }
/* 色板点选替代系统取色器：无吸色器/无确定歧义，点了即选中 */
.swatch-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.swatch-grid.compact { grid-template-columns: repeat(6, 1fr); gap: 6px; }
.swatch-item { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 6px 2px; border: 1px solid var(--line); border-radius: 8px; font-size: 11px; color: var(--muted); }
.swatch-item i { width: 100%; height: 26px; border-radius: 6px; display: block; }
.swatch-item.on { border-color: var(--primary); color: var(--primary); font-weight: 700; box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 18%, transparent); }
.sheet-confirm { position: sticky; bottom: 0; padding: 10px 0 2px; background: #fff; margin-top: 6px; }
.qr-presets { display: flex; gap: 8px; flex-wrap: wrap; }
.qr-preset { display: flex; align-items: center; gap: 5px; padding: 6px 10px; border: 1px solid var(--line); border-radius: 8px; font-size: 12px; }
.qr-preset.on { border-color: var(--primary); color: var(--primary); }
.qr-preset i { width: 16px; height: 16px; border-radius: 3px; }
</style>
