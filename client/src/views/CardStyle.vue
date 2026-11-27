<template>
  <div class="page">
    <header class="topbar">
      <button class="back" @click="done" aria-label="返回">‹</button>
      <span class="title">配色风格</span>
      <span class="spacer"></span>
    </header>

    <div class="container wide">
      <div v-if="loadError" class="card card-pad">
        <b style="color:#b91c1c">名片加载失败</b><p class="small muted">{{ loadError }}</p>
        <button class="btn btn-sm btn-primary" style="margin-top:10px" @click="load">重新加载</button>
      </div>
      <div v-else-if="loading" class="card card-pad">加载中…</div>
      <div v-else-if="!card" class="card card-pad">请先创建名片 <router-link to="/me" style="color:var(--primary)">去创建</router-link></div>
      <!-- 套餐闸门：配色风格（模板/主题/二维码配色）需要有效套餐，未开通只给引导 -->
      <div v-else-if="!planActive" class="card card-pad" style="text-align:center;padding:36px 16px">
        <div style="font-size:46px;opacity:.3">◐</div>
        <h3 style="margin:10px 0">配色风格需要开通套餐</h3>
        <p class="small muted">开通后可自由切换展示模板、主题色与二维码配色。</p>
        <router-link to="/me/plans" class="btn btn-primary" style="margin-top:14px;display:inline-block">去开通 / 续期</router-link>
      </div>

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

        <!-- 底部功能上弹面板：模板 / 二维码两个分区分开（按之前那样的交互）。
             二维码只留码色（2026-11-27 识别率定稿：码点/码眼固定标准方点、中心 LOGO 已移除）。
             分区清单唯一真相源 = SECTIONS：弹层内 tab 与底部入口都从它渲染，不各写一份。 -->
        <div class="sheet-mask" :class="{ show: sheetOpen }" @click="sheetOpen = false"></div>
        <div class="edit-sheet" :class="{ show: sheetOpen }" role="dialog" aria-label="配色风格设置">
          <div class="sheet-grab" @click="sheetOpen = false"><span></span></div>

          <div class="control-tabs" role="tablist">
            <button v-for="s in SECTIONS" :key="s.k" class="control-tab" :class="{ on: openSection === s.k }" role="tab"
                    :aria-selected="openSection === s.k" @click="openSection = s.k">
              <span class="tab-ico" :class="'ico-' + s.k"></span><span class="tab-txt">{{ s.label }}</span>
              <span class="tab-dot" v-if="openSection === s.k"></span>
            </button>
          </div>

          <div class="card card-pad control-panel">
            <template v-if="openSection === 'template'">
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
            </template>
            <template v-else>
              <div class="section-title" style="margin-top:0">二维码</div>
              <p class="small muted">码点/码眼已固定为标准方点、中心 LOGO 已移除（2026-11-27 识别率优先定稿），保证微信扫一扫与长按识别；可自定义的只剩配色，不影响识别。</p>
              <div class="field"><label>码色（深码浅底成对，保证可扫）</label>
                <BottomSelect v-model="colorKey" :options="colorKeyOptions" title="码色" />
              </div>
            </template>
            <!-- 只收起面板，不保存；保存统一走页面底部唯一「完成」按钮 -->
            <div class="sheet-confirm"><button class="btn btn-ghost btn-block" @click="sheetOpen = false">收起面板</button></div>
          </div>
        </div>

        <!-- 常驻底部入口：模板 / 二维码各一个，保持分开的交互 -->
        <div class="bottom-launcher">
          <button v-for="s in SECTIONS" :key="s.k" :class="{ on: sheetOpen && openSection === s.k }"
                  @click="openSection = s.k; sheetOpen = true">
            <span class="tab-ico" :class="'ico-' + s.k"></span><span>{{ s.label }}</span>
          </button>
        </div>

        <!-- 唯一保存入口：与资料编辑页同构，弹层里的按钮只负责收起 -->
        <div class="design-done-bar">
          <span class="small muted">选好后点完成，返回个人中心</span>
          <button class="btn btn-finish" :disabled="saving || loading || !!loadError" @click="done">{{ saving ? '保存中…' : '完成，返回名片' }}</button>
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
import { loadQrStyles } from '../utils/qrStyles'

const router = useRouter()
const card = ref(null)
const tags = ref([])
const templates = ref([])
const saving = ref(false)
const busyLoad = ref(false)
const loading = ref(false)
const loadError = ref('')
const sheetOpen = ref(false)
// 套餐是否有效（与后端 publicView.active 同口径）
const planActive = computed(() => !!card.value?.active)
// 模板 / 二维码两个分区：弹层内 tab 与底部入口共用这份清单（强调色已精简掉，不再回来）
const SECTIONS = [
  { k: 'template', label: '模板' },
  { k: 'qr', label: '二维码' }
]
const openSection = ref('template')
// 弹层打开锁页面滚动，避免上拖时带动背后的页（弹层内部自己滚）
let bodyOverflowBefore = ''
watch(sheetOpen, on => {
  if (on) { bodyOverflowBefore = document.body.style.overflow; document.body.style.overflow = 'hidden' }
  else document.body.style.overflow = bodyOverflowBefore
})
onBeforeUnmount(() => { document.body.style.overflow = bodyOverflowBefore })

// 二维码可调：只剩码色（2026-11-27 识别率定稿：码点/码眼固定标准方点、中心 LOGO 渲染层移除、渐变/背景图已下线）。
// 码色清单由服务端 /api/cards/public/meta 下发（唯一真相源）；码点/码眼/LOGO 已在渲染层收敛移除。
const colorOptions = ref([])
// 码色是 fg/bg 成对字段（cards.qr_fg / qr_bg），BottomSelect 单值用 key 代理，watch 写回两个字段。
const colorKeyOptions = computed(() => colorOptions.value.map(c => ({ value: c.key, label: c.label })))
const colorKey = computed({
  get: () => colorOptions.value.find(c => c.fg === card.value?.qr_fg && c.bg === card.value?.qr_bg)?.key || colorOptions.value[0]?.key || '',
  set: k => {
    const c = colorOptions.value.find(x => x.key === k)
    if (c && card.value) { card.value.qr_fg = c.fg; card.value.qr_bg = c.bg }
  }
})
const currentTplLabel = computed(() => templates.value.find(t => t.key === card.value?.template)?.label || card.value?.template || '默认')
const previewQr = computed(() => {
  const c = card.value
  if (!c?.slug) return ''
  const st = encodeURIComponent(JSON.stringify(c.qr_style || {}))
  // 中心 LOGO 已整体移除（2026-11-27 识别率定稿），预览恒 logo=0
  return `/api/cards/public/${c.slug}/qr.svg?size=320&fg=${encodeURIComponent(c.qr_fg || '#0f172a')}&bg=${encodeURIComponent(c.qr_bg || '#ffffff')}&logo=0&style=${st}`
})
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
      // qr_style 由服务端 normalizeStyle 归一（2026-11-27 识别率定稿：圆点/圆角眼自动回落标准方点），
      // 中心 LOGO 渲染层已移除、渐变/背景图已下线，这里只补缺省值。
      qr_style: { dot: 'square', eye: 'square', gradTo: '', bgImage: '', ...(data.data.qr_style || {}) }
    }
    tags.value = data.data.tags || []
  } catch (e) { loadError.value = e.message || '网络异常' } finally { loading.value = false; busyLoad.value = false }
}
async function loadTemplates() {
  try { const { data } = await api.get(`/api/cards/public/templates?t=${Date.now()}`); templates.value = data.data?.templates || [] } catch {}
}
onMounted(async () => {
  // 样式选项/模板清单独立启动，不挂在 load 链尾（前置请求失败/重启窗口会拖住关键选项）
  loadQrStyles().then(s => { colorOptions.value = s.colors })
  loadTemplates()
  await load()
})

async function done() {
  if (saving.value || !card.value) return
  if (!planActive.value) { showToast('配色风格需要先开通套餐', 'error'); return }
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
/* 弹层内分区 tab：与底部入口共用 SECTIONS，选中态两处一致 */
.control-tabs { display: flex; gap: 4px; padding: 6px 12px; overflow-x: auto; border-bottom: 1px solid var(--line); }
.control-tab { position: relative; flex: 0 0 auto; display: flex; align-items: center; gap: 5px; padding: 8px 12px; border-radius: 8px; color: var(--muted); font-size: 13px; }
.control-tab.on { background: #eef4ff; background: color-mix(in srgb, var(--primary) 10%, transparent); color: var(--primary); font-weight: 700; }
.tab-dot { position: absolute; left: 50%; bottom: 1px; width: 12px; height: 2px; margin-left: -6px; border-radius: 2px; background: currentColor; }
.tab-ico { width: 14px; height: 14px; border-radius: 3px; background: currentColor; opacity: .75; flex: 0 0 14px; }
.ico-template { border-radius: 3px; }
.ico-qr { border-radius: 2px; }
.control-panel { margin: 0; border-radius: 0; border: 0; flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
/* tabbar 在本页已隐藏（App.vue hideMemberNav），功能条贴底；z105 仍低于弹层 120/121 */
.bottom-launcher { position: fixed; left: 0; right: 0; bottom: 0; z-index: 105; display: flex; gap: 6px; padding: 8px 12px calc(10px + env(safe-area-inset-bottom)); background: #fff; border-top: 1px solid var(--line); box-shadow: 0 -4px 16px rgba(0,0,0,.06); }
.bottom-launcher button { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 0; border-radius: 8px; color: var(--muted); font-size: 12px; }
.bottom-launcher button.on { color: var(--primary); background: #eef4ff; background: color-mix(in srgb, var(--primary) 10%, transparent); }
/* 宽屏（PC 桌面壳）限宽居中，与 sheet 对齐，避免通栏横条 */
@media (min-width: 900px) { .bottom-launcher { max-width: 560px; left: 50%; right: auto; transform: translateX(-50%); border-radius: 14px 14px 0 0; } }
/* 缩略图骨架与配色来自共享 template-thumbs.css，这里只把面板内改 3 列 + 缩略图稍矮 */
.tpl-list { grid-template-columns: repeat(3, 1fr); gap: 8px; }
.tpl-thumb { height: 46px; }
/* 层级：模板缩略图 .tpl-ava 带 z-index:2，确定按钮必须更高，否则头像块会穿透盖到按钮上 */
.sheet-confirm { position: sticky; bottom: 0; z-index: 3; padding: 10px 0 2px; background: #fff; margin-top: 6px; }
.qr-presets { display: flex; gap: 8px; flex-wrap: wrap; }
.qr-preset { display: flex; align-items: center; gap: 5px; padding: 6px 10px; border: 1px solid var(--line); border-radius: 8px; font-size: 12px; }
.qr-preset.on { border-color: var(--primary); color: var(--primary); }
.qr-preset i { width: 16px; height: 16px; border-radius: 3px; }
</style>
