<template>
  <div class="page">
    <header class="topbar">
      <router-link to="/me" class="brand">M<em>Card</em></router-link>
      <div class="spacer"></div>
      <span class="small muted">实体名片版式</span>
    </header>
    <div class="container wide" style="margin-top:18px">
      <div class="hint" style="margin-bottom:14px">
        版式按 <b>90 × 54mm</b> 标准名片设计，四周 <b>3mm 出血</b>、内侧 <b>4.5mm 安全线</b>。可下载 SVG 矢量稿或 300dpi PNG 交印厂；二维码内容就是你的永久名片链接。
      </div>

      <div v-if="!card" class="card card-pad">请先创建名片 <router-link to="/me" style="color:var(--primary)">去创建</router-link></div>

      <template v-else>
        <div class="print-layout">
          <div>
            <div class="card card-pad">
              <div class="section-title" style="margin-top:0">版式设置</div>
              <div class="field"><label>正面模板</label>
                <div class="tpl-list">
                  <button v-for="v in tpls" :key="v.k" :class="{ on: template === v.k }" @click="template = v.k">{{ v.label }}</button>
                </div>
              </div>
              <div class="field"><label>预览面</label>
                <div class="tpl-list">
                  <button :class="{ on: side === 'front' }" @click="side = 'front'">正面</button>
                  <button :class="{ on: side === 'back' }" @click="side = 'back'">背面</button>
                </div>
              </div>
              <label class="check"><input type="checkbox" v-model="guides" /> 显示出血线与安全线（仅预览）</label>
              <div class="field" style="margin-top:12px"><label>卡片上的品牌文字</label><input v-model="brand" class="input" maxlength="16" /></div>
            </div>

            <div class="card card-pad" style="margin-top:14px">
              <div class="section-title" style="margin-top:0">下载印刷文件</div>
              <div class="btn-row">
                <button class="btn btn-primary" :disabled="busy" @click="download('svg')">下载 SVG 矢量稿</button>
                <button class="btn btn-ghost" :disabled="busy" @click="download('png')">下载 300dpi PNG</button>
              </div>
              <p class="small muted" style="margin-top:10px">当前：{{ side === 'front' ? '正面' : '背面' }} · {{ tpls.find(x => x.k === template)?.label }}。切换正/背面后可分别下载。</p>
            </div>

            <div class="card card-pad" style="margin-top:14px">
              <div class="section-title" style="margin-top:0">印刷 & 延展用法</div>
              <ol class="tips small">
                <li>裁切成品 90×54mm，文件含 3mm 出血，总尺寸 96×60mm；请按 1:1 输出，勿缩放。</li>
                <li>SVG 中文字体由印刷方转曲后再制版；PNG 已是 300dpi，可直接用于普通彩印。</li>
                <li>二维码纠错等级为 H（30%），局部磨损/覆膜后仍可识别；印刷时不要拉伸变形。</li>
                <li>可把同一二维码写入 NFC 标签贴在后背或工牌上，手机碰一碰即可打开电子名片。</li>
              </ol>
            </div>
          </div>

          <div class="preview-panel">
            <div class="card card-pad">
              <div class="section-title" style="margin-top:0">预览 <small>1:1 视觉比例</small></div>
              <div class="paper" v-html="svgHtml"></div>
              <p class="small muted center" style="margin-top:10px">{{ side === 'front' ? '正面' : '背面' }} · {{ guides ? '含辅助线' : '成品效果' }}</p>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import api from '../api'
import { showToast, siteConfig } from '../store'
import { themeOf } from '../utils/themes'
import { buildPrintSvg, svgToPngBlob } from '../utils/printCard'
import { saveText, saveBlob } from '../utils/save-image'

const card = ref(null)
const template = ref('classic'); const side = ref('front'); const guides = ref(false)
const brand = ref('MCard'); const svgHtml = ref(''); const busy = ref(false)
const tpls = [
  { k: 'classic', label: '经典商务' }, { k: 'modern', label: '现代色块' }, { k: 'minimal', label: '极简线条' }
]

async function render() {
  if (!card.value) return
  const payload = { ...card.value, printTemplate: template.value }
  svgHtml.value = await buildPrintSvg(payload, themeOf(card.value), {
    side: side.value, guides: guides.value, brand: brand.value, baseUrl: location.origin
  })
}
watch([template, side, guides, brand], render)

onMounted(async () => {
  try {
    const { data } = await api.get('/api/cards/mine')
    card.value = data.data
    brand.value = siteConfig.site_name || 'MCard'
    await render()
  } catch (e) { showToast(e.message, 'error') }
})

async function download(kind) {
  if (!svgHtml.value) return
  busy.value = true
  try {
    const name = `名片-${card.value.name || card.value.slug}-${side.value}`
    if (kind === 'svg') saveText(svgHtml.value, `${name}.svg`, 'image/svg+xml;charset=utf-8')
    else {
      const svg = await buildPrintSvg({ ...card.value, printTemplate: template.value }, themeOf(card.value), {
        side: side.value, guides: false, brand: brand.value, baseUrl: location.origin, raster: true, dpi: 300
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
.print-layout { display: grid; grid-template-columns: 1fr 420px; gap: 18px; align-items: start; }
@media (max-width: 900px) { .print-layout { grid-template-columns: 1fr; } }
.tpl-list { display: flex; gap: 8px; flex-wrap: wrap; }
.tpl-list button { padding: 8px 14px; border: 1px solid var(--line); border-radius: 9px; font-size: 12px; }
.tpl-list button.on { border-color: var(--primary); background: #eff6ff; color: var(--primary); font-weight: 700; }
.check { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.tips { padding-left: 18px; color: var(--muted); line-height: 1.9; }
.paper { width: 100%; aspect-ratio: 96 / 60; background: #fff; box-shadow: 0 12px 40px rgba(0,0,0,.15); border: 1px solid var(--line); }
.paper :deep(svg) { width: 100%; height: 100%; display: block; }
</style>
