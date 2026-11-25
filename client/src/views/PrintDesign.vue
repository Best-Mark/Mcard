<template>
  <div class="page">
    <header class="topbar">
      <router-link to="/me" class="brand">M<em>Card</em></router-link>
      <div class="spacer"></div>
      <button class="nav-menu-btn" aria-label="菜单" @click="toggleDrawer"><i class="menu-glyph"></i></button>
      <span class="small muted">实体名片设计</span>
    </header>
    <div class="container wide" style="margin-top:18px">
      <div class="hint" style="margin-bottom:14px">
        版式按 <b>90 × 54mm</b> 标准名片设计，四周 <b>3mm 出血</b>、内侧 <b>4.5mm 安全线</b>。可下载 SVG 矢量稿或 300dpi PNG 交印厂；二维码内容就是你的永久名片链接。
      </div>

      <div v-if="loadError" class="card card-pad">
        <b style="color:#b91c1c">名片加载失败</b><p class="small muted">{{ loadError }}</p>
        <button class="btn btn-sm btn-primary" style="margin-top:10px" @click="load">重新加载</button>
      </div>
      <div v-else-if="!card" class="card card-pad">请先创建名片 <router-link to="/me" style="color:var(--primary)">去创建</router-link></div>

      <template v-else>
        <!-- 一屏式：上面完整看预览，底部一排功能往上弹出调节，弹出后仍是横向功能条 -->
        <div class="print-layout">
          <div class="preview-panel">
            <div class="card card-pad preview-card">
              <div class="preview-head">
                <div class="section-title" style="margin:0">预览 <small>1:1 视觉比例</small></div>
                <div class="tpl-list side-switch">
                  <button :class="{ on: side === 'front' }" @click="side = 'front'">正面</button>
                  <button :class="{ on: side === 'back' }" @click="side = 'back'">背面</button>
                </div>
              </div>
              <div class="paper" v-html="svgHtml"></div>
              <p class="small muted center preview-cap">{{ side === 'front' ? '正面' : '背面' }} · {{ guides ? '含辅助线' : '成品效果' }} · {{ currentLabel }}</p>
            </div>
          </div>
        </div>

        <!-- 底部一排功能：点击往上弹 sheet，弹出后里面还是横向 6 项 -->
        <div class="sheet-mask" :class="{ show: sheetOpen }" @click="sheetOpen = false"></div>
        <div class="edit-sheet" :class="{ show: sheetOpen }" role="dialog" aria-label="实体名片设置">
          <div class="sheet-grab" @click="sheetOpen = false"><span></span></div>
          <div class="control-tabs" role="tablist">
            <button v-for="s in SECTIONS" :key="s.k" class="control-tab" :class="{ on: openSection === s.k }" role="tab" :aria-selected="openSection === s.k" @click="openSection = s.k">
              <span class="tab-ico" :class="'ico-' + s.k"></span>
              <span class="tab-txt">{{ s.label }}</span>
              <span class="tab-dot" v-if="openSection === s.k"></span>
            </button>
          </div>

          <div class="card card-pad control-panel">
            <template v-if="openSection === 'color'">
              <div class="section-title" style="margin-top:0">印刷配色</div>
              <p class="small muted">实体印刷配色独立于电子名片，改动不会影响线上名片。选一套主题底色，再挑强调色，即可搭配出实体配色模板。</p>
              <div class="section-title" style="font-size:13px;margin:12px 0 6px">主题（底色 / 文字）</div>
              <div class="color-list">
                <button v-for="v in PRINT_THEMES" :key="v.k" class="color-item" :class="{ on: printTheme === v.k }" @click="printTheme = v.k; printAccent = ''">
                  <i :style="{ background: v.accent }"></i><span>{{ v.label }}</span>
                </button>
              </div>
              <div class="section-title" style="font-size:13px;margin:12px 0 6px">强调色（可选，留空=主题默认）</div>
              <div class="color-list">
                <button class="color-item" :class="{ on: !printAccent }" @click="printAccent = ''"><i style="background:#fff;border:1px solid var(--line)"></i><span>默认</span></button>
                <button v-for="s in ACCENT_SWATCHES" :key="s.key" class="color-item" :class="{ on: printAccent === s.color }" @click="printAccent = s.color">
                  <i :style="{ background: s.color }"></i><span>{{ s.label }}</span>
                </button>
              </div>
            </template>

            <template v-else-if="openSection === 'front'">
              <div class="section-title" style="margin-top:0">正面版式</div>
              <div class="tpl-grid">
                <button v-for="v in FRONT_TPLS" :key="v.k" class="tpl-card" :class="{ on: template === v.k }" @click="template = v.k; side = 'front'">
                  <span class="tpl-thumb" :style="{ background: v.cover }"><i :class="'th th-' + v.k"></i></span>
                  <b>{{ v.label }}</b>
                  <span class="tpl-desc">{{ v.desc }}</span>
                  <span v-if="template === v.k" class="tpl-check">✓ 使用中</span>
                </button>
              </div>
            </template>

            <template v-else-if="openSection === 'back'">
              <div class="section-title" style="margin-top:0">背面版式</div>
              <div class="tpl-grid">
                <button v-for="v in BACK_TPLS" :key="v.k" class="tpl-card" :class="{ on: printBack === v.k }" @click="printBack = v.k; side = 'back'">
                  <span class="tpl-thumb" :style="{ background: v.cover }"><i :class="'th th-back-' + v.k"></i></span>
                  <b>{{ v.label }}</b>
                  <span class="tpl-desc">{{ v.desc }}</span>
                  <span v-if="printBack === v.k" class="tpl-check">✓ 使用中</span>
                </button>
              </div>
            </template>

            <template v-else-if="openSection === 'detail'">
              <div class="section-title" style="margin-top:0">卡片细节</div>
              <label class="check"><input type="checkbox" v-model="guides" /> 显示出血线与安全线（仅预览）</label>
              <div class="field" style="margin-top:12px"><label>卡片上的品牌文字</label><input v-model="brand" class="input" maxlength="16" /></div>
            </template>

            <template v-else-if="openSection === 'download'">
              <div class="section-title" style="margin-top:0">下载印刷文件</div>
              <div class="btn-row">
                <button class="btn btn-primary" :disabled="busy" @click="download('svg')">下载 SVG 矢量稿</button>
                <button class="btn btn-ghost" :disabled="busy" @click="download('png')">下载 300dpi PNG</button>
              </div>
              <p class="small muted" style="margin-top:10px">当前：{{ side === 'front' ? '正面' : '背面' }} · {{ currentLabel }}。正/背面可分别选版式、分别下载。</p>
            </template>

            <template v-else-if="openSection === 'tips'">
              <div class="section-title" style="margin-top:0">印刷 & 延展用法</div>
              <ol class="tips small">
                <li>裁切成品 90×54mm，文件含 3mm 出血，总尺寸 96×60mm；请按 1:1 输出，勿缩放。</li>
                <li>SVG 中文字体由印刷方转曲后再制版；PNG 已是 300dpi，可直接用于普通彩印。</li>
                <li>二维码纠错等级为 H（30%），局部磨损/覆膜后仍可识别；印刷时不要拉伸变形。</li>
                <li>可把同一二维码写入 NFC 标签贴在后背或工牌上，手机碰一碰即可打开电子名片。</li>
              </ol>
            </template>
          </div>
        </div>

        <!-- 常驻底部的一排功能入口：点任意项打开上面的调节面板 -->
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
import { ref, computed, watch, onMounted } from 'vue'
import api from '../api'
import { showToast, siteConfig, toggleDrawer } from '../store'
import { THEMES, themeOf } from '../utils/themes'
import { buildPrintSvg, svgToPngBlob } from '../utils/printCard'
import { saveText, saveBlob } from '../utils/save-image'

const card = ref(null)
const template = ref('classic'); const printBack = ref('solid')
const side = ref('front'); const guides = ref(false)
// 实体印刷配色完全独立于电子名片：只存本地，不读也不写 cards.theme / cards.accent。
// 用户要的是「用配色方案搭配出实体模板」，不是把线上名片配色同步过来。
const PRINT_PALETTE_KEY = 'mcard_print_palette_v1'
const printTheme = ref('ocean')
const printAccent = ref('')       // 空 = 用主题默认强调色
try {
  const saved = JSON.parse(localStorage.getItem(PRINT_PALETTE_KEY) || '{}')
  if (saved.theme && THEMES[saved.theme]) printTheme.value = saved.theme
  if (typeof saved.accent === 'string') printAccent.value = saved.accent
} catch { /* 本地损坏时回默认，不拖垮页面 */ }
const brand = ref('MCard'); const svgHtml = ref(''); const busy = ref(false); const loadError = ref('')
// 横向功能条：6 项一次只显示一项内容，预览常驻顶部（抖音发布页同款）
const SECTIONS = [
  { k: 'color', label: '配色' },
  { k: 'front', label: '正面' },
  { k: 'back', label: '背面' },
  { k: 'detail', label: '细节' },
  { k: 'download', label: '下载' },
  { k: 'tips', label: '说明' }
]
const openSection = ref('color')
const sheetOpen = ref(false)

// 色板值复用 THEMES 定义（颜色本身只有一处），但「选中哪套」是实体印刷自己的状态，与电子名片无关
const PRINT_THEMES = Object.entries(THEMES).map(([k, v]) => ({ k, label: v.label, accent: v.accent }))
const ACCENT_SWATCHES = Object.entries(THEMES).map(([k, v]) => ({ key: k, label: v.label, color: v.accent }))

const FRONT_TPLS = [
  { k: 'classic', label: '经典商务', desc: '色条 + 头像 + 信息，最通用', cover: 'linear-gradient(135deg,#1e3a8a,#2563eb)' },
  { k: 'modern', label: '现代色块', desc: '上主色块 + 悬浮头像，清爽', cover: 'linear-gradient(135deg,#2563eb 55%,#f2f7ff 55%)' },
  { k: 'minimal', label: '极简线条', desc: '细边框大留白，克制高级', cover: 'linear-gradient(135deg,#f8fafc,#e2e8f0)' },
  { k: 'elite', label: '深蓝鎏金', desc: '深底金线 + 居中署名，高端', cover: 'linear-gradient(135deg,#111827,#c9a163)' },
  { k: 'editorial', label: '杂志排版', desc: '黑白高对比 + 大首字，设计感', cover: 'linear-gradient(135deg,#111827 40%,#fff 40%)' },
  { k: 'split', label: '左右分栏', desc: '左主色署名 + 右白底信息', cover: 'linear-gradient(90deg,#2563eb 44%,#fff 44%)' },
  { k: 'badge', label: '圆章徽记', desc: '圆环头像居中，仪式感', cover: 'radial-gradient(circle at 50% 40%,#2563eb 0 26%,#f2f7ff 27%)' },
  { k: 'corner', label: '斜切现代', desc: '斜切色块 + 底部信息，利落', cover: 'linear-gradient(135deg,#2563eb 0 46%,#fff 47%)' }
]
const BACK_TPLS = [
  { k: 'solid', label: '纯色经典', desc: '满版主色 + 居中署名', cover: 'linear-gradient(135deg,#1e3a8a,#2563eb)' },
  { k: 'white', label: '素白信息', desc: '白底二维码 + 信息栏', cover: 'linear-gradient(90deg,#fff 55%,#e2e8f0 55%)' },
  { k: 'split', label: '左右分栏', desc: '左主色署名 + 右二维码', cover: 'linear-gradient(90deg,#2563eb 44%,#fff 44%)' },
  { k: 'frame', label: '细框留白', desc: '双层细框 + 居中信息', cover: 'linear-gradient(135deg,#f8fafc,#fff)' }
]

const currentLabel = computed(() => {
  const list = side.value === 'front' ? FRONT_TPLS : BACK_TPLS
  const key = side.value === 'front' ? template.value : printBack.value
  return list.find(x => x.k === key)?.label || ''
})

async function render() {
  if (!card.value) return
  const payload = { ...card.value, printTemplate: template.value }
  const pt = themeOf({ theme: printTheme.value, accent: printAccent.value })
  svgHtml.value = await buildPrintSvg(payload, pt, {
    side: side.value, guides: guides.value, brand: brand.value, baseUrl: location.origin, printBack: printBack.value
  })
}
watch([template, printBack, side, guides, brand, printTheme, printAccent], render)
watch([printTheme, printAccent], () => {
  try { localStorage.setItem(PRINT_PALETTE_KEY, JSON.stringify({ theme: printTheme.value, accent: printAccent.value })) } catch { /* 隐私模式下不落盘，本次会话仍生效 */ }
})

async function load() {
  loadError.value = ''
  try {
    const { data } = await api.get('/api/cards/mine')
    card.value = data.data
    brand.value = siteConfig.site_name || 'MCard'
    await render()
  } catch (e) { loadError.value = e.message || '网络异常' }
}
onMounted(load)

async function download(kind) {
  if (busy.value || !svgHtml.value) return
  busy.value = true
  try {
    const name = `名片-${card.value.name || card.value.slug}-${side.value}`
    const pt = themeOf({ theme: printTheme.value, accent: printAccent.value })
    if (kind === 'svg') saveText(svgHtml.value, `${name}.svg`, 'image/svg+xml;charset=utf-8')
    else {
      const svg = await buildPrintSvg({ ...card.value, printTemplate: template.value }, pt, {
        side: side.value, guides: false, brand: brand.value, baseUrl: location.origin,
        printBack: printBack.value, raster: true, dpi: 300
      })
      const blob = await svgToPngBlob(svg, 300)
      if (!blob) throw new Error('图片生成失败')
      saveBlob(blob, `${name}.png`)
    }
    showToast('已开始下载', 'success')
  } catch (e) { showToast(e.message, 'error') } finally { busy.value = false }
}
</script>

<style scoped>
/* 一屏式：预览常驻，调节从底部上弹；页面留出底部两排（功能入口+会员导航）高度 */
.page { padding-bottom: calc(132px + env(safe-area-inset-bottom)); }
.print-layout { display: flex; flex-direction: column; gap: 12px; }
.preview-panel { padding-bottom: 6px; }
.preview-card { padding: 14px 16px 12px; }
.preview-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
.side-switch button { padding: 6px 18px; font-size: 12px; }
.preview-cap { margin-top: 8px; }

/* 横向功能条：6 项一行铺满，窄屏可横向滑动；选中项主题色高亮，下方只出该项内容 */
.control-tabs { display: flex; gap: 4px; overflow-x: auto; -webkit-overflow-scrolling: touch; padding: 2px 0 4px; scrollbar-width: none; }
.control-tabs::-webkit-scrollbar { display: none; }
.control-tab { position: relative; flex: 1 0 56px; min-width: 56px; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 10px 4px 12px; border: 0; border-radius: 12px; background: transparent; color: var(--muted, #6b7688); font-size: 12px; }
.control-tab.on { background: rgba(37,99,235,.1); background: color-mix(in srgb, var(--t-accent, var(--primary, #2563eb)) 12%, transparent); color: var(--t-accent, var(--primary, #2563eb)); font-weight: 700; }
.tab-ico { width: 22px; height: 22px; border-radius: 7px; background: currentColor; opacity: .75; position: relative; }
.tab-ico::after { content: ''; position: absolute; inset: 6px 5px; border-radius: 3px; background: var(--bg-card, #fff); }
.control-tab.on .tab-ico { opacity: 1; }
.ico-color::after { border-radius: 50%; inset: 5px; }
.ico-front::after { inset: 4px 5px 10px; }
.ico-back::after { inset: 10px 5px 4px; }
.ico-detail::after { inset: 9px 4px; border-radius: 50%; }
.ico-download::after { inset: 4px 8px 9px; border-radius: 2px 2px 0 0; }
.ico-tips::after { inset: 6px 5px; border-radius: 3px; }
.tab-dot { position: absolute; bottom: 4px; width: 12px; height: 3px; border-radius: 2px; background: var(--t-accent, var(--primary, #2563eb)); }
.control-panel { margin-top: 6px; }
.control-panel .section-title { font-size: 15px; }
/* 底部常驻一排功能入口：抬到会员导航（约 60px）之上，宽屏限宽居中 */
.bottom-launcher {
  position: fixed; left: 0; right: 0; z-index: 105;
  bottom: calc(60px + env(safe-area-inset-bottom));
  display: flex; gap: 2px; padding: 6px 6px calc(6px + env(safe-area-inset-bottom));
  background: var(--bg-card, #fff); border-top: 1px solid var(--line); box-shadow: 0 -4px 18px rgba(15,23,42,.06);
}
.bottom-launcher button { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 4px 0; border: 0; background: transparent; color: var(--muted, #6b7688); font-size: 11px; }
.bottom-launcher button.on { color: var(--t-accent, var(--primary, #2563eb)); font-weight: 700; }
@media (min-width: 900px) { .bottom-launcher { max-width: 520px; left: 50%; right: auto; transform: translateX(-50%); border-radius: 14px 14px 0 0; } }

/* 上弹调节面板：内部仍是横向 6 项功能条，点遮罩或把手收起 */
.sheet-mask { position: fixed; inset: 0; z-index: 120; background: rgba(15,23,42,.45); opacity: 0; pointer-events: none; transition: opacity .2s; }
.sheet-mask.show { opacity: 1; pointer-events: auto; }
.edit-sheet {
  position: fixed; left: 0; right: 0; z-index: 121;
  bottom: 0; max-height: 78vh; overflow-y: auto; overscroll-behavior: contain;
  padding: 6px 14px calc(18px + env(safe-area-inset-bottom));
  background: var(--bg-page, #f4f6fb); border-radius: 18px 18px 0 0; box-shadow: 0 -10px 40px rgba(15,23,42,.22);
  transform: translateY(105%); transition: transform .24s ease; visibility: hidden;
}
.edit-sheet.show { transform: translateY(0); visibility: visible; }
@media (min-width: 900px) { .edit-sheet { max-width: 560px; left: 50%; right: auto; transform: translate(-50%, 105%); } .edit-sheet.show { transform: translate(-50%, 0); } }
.sheet-grab { display: grid; place-items: center; height: 20px; cursor: pointer; }
.sheet-grab span { display: block; width: 38px; height: 4px; border-radius: 3px; background: var(--line, #d7dce5); }
.tpl-list { display: flex; gap: 8px; flex-wrap: wrap; }
.tpl-list button { padding: 8px 14px; border: 1px solid var(--line); border-radius: 9px; font-size: 12px; }
.tpl-list button.on { border-color: var(--primary); background: #eff6ff; color: var(--primary); font-weight: 700; }
.check { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.tips { padding-left: 18px; color: var(--muted); line-height: 1.9; }
/* 预览卡在宽屏不超过 560px，卡片按真实 96:60 比例居中；窄屏铺满 */
.preview-card { max-width: 560px; margin: 0 auto; }
.paper { width: 100%; max-width: 520px; margin: 0 auto; aspect-ratio: 96 / 60; background: #fff; box-shadow: 0 12px 40px rgba(0,0,0,.15); border: 1px solid var(--line); }
.paper :deep(svg) { width: 100%; height: 100%; display: block; }

/* 印刷配色 */
.color-list { display: flex; gap: 10px; flex-wrap: wrap; }
.color-item { display: flex; flex-direction: column; align-items: center; gap: 5px; font-size: 12px; color: var(--muted); }
.color-item i { display: block; width: 34px; height: 34px; border-radius: 50%; border: 3px solid transparent; box-shadow: 0 2px 8px rgba(0,0,0,.12); }
.color-item.on i { border-color: var(--text); box-shadow: 0 0 0 3px #fff, 0 0 0 5px var(--primary); }
.color-item.on { color: var(--primary); font-weight: 700; }

/* 版式卡片：带骨架缩略图，一眼区分 */
.tpl-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
@media (max-width: 620px) { .tpl-grid { grid-template-columns: repeat(2, 1fr); } }
.tpl-card { position: relative; text-align: left; border: 1px solid var(--line); border-radius: 10px; padding: 7px; font-size: 12px; background: var(--bg-card, #fff); }
.tpl-card.on { border-color: var(--primary); box-shadow: 0 0 0 2px rgba(37,99,235,.14); }
.tpl-thumb { display: block; height: 46px; border-radius: 6px; position: relative; overflow: hidden; }
.tpl-card b { display: block; margin-top: 6px; font-size: 12px; }
.tpl-desc { display: block; font-size: 10px; color: var(--muted); line-height: 1.4; min-height: 26px; }
.tpl-check { position: absolute; right: 7px; top: 7px; font-size: 10px; color: #fff; background: var(--primary); padding: 2px 6px; border-radius: 999px; }
.th { position: absolute; background: rgba(255,255,255,.92); box-shadow: 0 1px 4px rgba(0,0,0,.2); }
/* 正面缩略骨架 */
.th-classic { width: 26px; height: 30px; left: 8px; top: 8px; border-left: 3px solid #2563eb; }
.th-modern { width: 40px; height: 16px; left: 3px; top: 3px; }
.th-minimal { inset: 5px; background: transparent; border: 1px solid #94a3b8; box-shadow: none; }
.th-elite { inset: 5px; background: rgba(201,161,99,.35); border: 1px solid #c9a163; }
.th-editorial { width: 3px; height: 36px; left: 6px; top: 5px; background: #111827; box-shadow: none; }
.th-split { width: 18px; height: 100%; left: 0; top: 0; background: #2563eb; box-shadow: none; }
.th-badge { width: 22px; height: 22px; border-radius: 50%; left: 50%; top: 12px; transform: translateX(-50%); }
.th-corner { width: 100%; height: 20px; left: 0; top: 0; border-radius: 0 0 100% 0; background: #2563eb; box-shadow: none; }
/* 背面缩略骨架 */
.th-back-solid { inset: 5px; background: rgba(37,99,235,.55); }
.th-back-white { width: 22px; height: 22px; left: 8px; top: 12px; }
.th-back-split { width: 18px; height: 100%; left: 0; top: 0; background: #2563eb; box-shadow: none; }
.th-back-frame { inset: 5px; background: transparent; border: 2px solid #94a3b8; box-shadow: none; }
</style>
