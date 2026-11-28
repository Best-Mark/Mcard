<template>
  <div class="page">
    <header class="topbar">
      <button class="back" @click="done" aria-label="返回">‹</button>
      <span class="title">名片集市</span>
      <span class="spacer"></span>
    </header>

    <div class="container wide">
      <div v-if="loadError" class="card card-pad">
        <b style="color:#b91c1c">名片加载失败</b><p class="small muted">{{ loadError }}</p>
        <button class="btn btn-sm btn-primary" style="margin-top:10px" @click="load">重新加载</button>
      </div>
      <div v-else-if="loading" class="card card-pad">加载中…</div>
      <div v-else-if="!card" class="card card-pad">请先创建名片 <router-link to="/me" style="color:var(--primary)">去创建</router-link></div>

      <template v-else>
        <!-- 顶部常显预览：集市里访客看到的名片信息，上架状态即时反映 -->
        <div class="preview-panel">
          <div class="card card-pad preview-card">
            <div class="preview-head">
              <div class="section-title" style="margin:0">集市展示预览 <small>只展示非隐私字段</small></div>
              <span class="badge small" :class="card.market_opt_in ? 'on' : ''">{{ card.market_opt_in ? '✓ 已上架' : '○ 未上架' }}</span>
            </div>
            <CardPreview :card="card" :tags="tags" :qr-url="previewQr" section="market" :industries="meta.industries" />
          </div>
        </div>

        <div class="sheet-mask" :class="{ show: sheetOpen }" @click="sheetOpen = false"></div>
        <div class="edit-sheet" :class="{ show: sheetOpen }" role="dialog" aria-label="名片集市上架设置">
          <div class="sheet-grab" @click="sheetOpen = false"><span></span></div>
          <div class="card card-pad control-panel">
            <div class="section-title" style="margin-top:0">上架设置</div>
            <div class="market-value">
              <b>🚀 上架 = 多一个 7×24 小时的获客入口</b>
              <p>附近及同行业的人可按「距离 / 行业 / 关键词」搜到你，点开名片即可保存。只展示姓名、职位、公司、行业、城市与简介，联系方式不会公开；随时可关闭下架。</p>
            </div>
            <!-- 套餐闸门：上架集市需有效套餐；未开通/过期只允许下架，不允许上架 -->
            <div v-if="!planActive" class="plan-gate-tip">
              <b>上架集市需要开通套餐</b>
              <span>{{ card.market_opt_in ? '当前套餐已到期，名片已从集市隐藏；可先关闭下架。' : '开通后即可让附近客户在集市找到你。' }}</span>
              <router-link to="/me/plans" class="btn btn-sm btn-primary">去开通 / 续期</router-link>
            </div>
            <div class="field"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" v-model="card.market_opt_in" :disabled="!planActive && !card.market_opt_in" /> 加入名片集市（主动上架）</label></div>
            <div class="field">
              <label>所属行业（同行按行业精确搜到你）</label>
              <BottomSelect v-model="card.industry" :options="industryOptions" title="选择行业" placeholder="未选择行业" />
            </div>
            <div class="market-checks">
              <span :class="{ ok: !!card.industry }">{{ card.industry ? '✓' : '○' }} 填行业</span>
              <span :class="{ ok: !!regionText }">{{ regionText ? '✓' : '○' }} 填地区</span>
              <span :class="{ ok: card.latitude != null }">{{ card.latitude != null ? '✓' : '○' }} 有坐标</span>
            </div>
            <div class="region-line small muted">地区：{{ regionText || '未填写（去名片资料里填）' }}</div>
            <div class="sheet-actions">
              <router-link to="/market" class="btn btn-sm btn-ghost">去集市看看</router-link>
              <button class="btn btn-ghost" @click="sheetOpen = false">收起</button>
            </div>
          </div>
        </div>

        <div class="bottom-launcher">
          <button :class="{ on: sheetOpen }" @click="sheetOpen = true">
            <span class="tab-ico ico-status"></span><span>上架设置</span>
          </button>
        </div>

        <!-- 唯一保存入口：上架设置弹层只负责编辑与收起 -->
        <div class="design-done-bar">
          <span class="small muted">上架设置改完后点完成保存</span>
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
import CardPreview from '../components/CardPreview.vue'
import BottomSelect from '../components/BottomSelect.vue'

const router = useRouter()
const card = ref(null)
const tags = ref([])
const meta = ref({ industries: [], cities: [] })
const saving = ref(false)
const busyLoad = ref(false)
const loading = ref(false)
const loadError = ref('')
const sheetOpen = ref(false)
// 套餐是否有效（与后端 publicView.active 同口径：status active 且未过期）
const planActive = computed(() => !!card.value?.active)
// 弹层打开锁页面滚动，避免上拖时带动背后的页
let bodyOverflowBefore = ''
watch(sheetOpen, on => {
  if (on) { bodyOverflowBefore = document.body.style.overflow; document.body.style.overflow = 'hidden' }
  else document.body.style.overflow = bodyOverflowBefore
})
onBeforeUnmount(() => { document.body.style.overflow = bodyOverflowBefore })

const industryOptions = computed(() => (meta.value.industries || []).map(i => ({ value: i.key, label: i.label })))
const regionText = computed(() => {
  const c = card.value
  return c ? [c.province, c.city, c.district].filter(Boolean).join(' · ') : ''
})
const previewQr = computed(() => {
  const c = card.value
  if (!c?.slug) return ''
  const st = encodeURIComponent(JSON.stringify(c.qr_style || {}))
  // 中心 LOGO 已整体移除（2026-11-27 识别率定稿），预览恒 logo=0
  return `/api/cards/public/${c.slug}/qr.svg?size=320&brand=M&fg=${encodeURIComponent(c.qr_fg || '#0f172a')}&bg=${encodeURIComponent(c.qr_bg || '#ffffff')}&logo=0&style=${st}`
})

async function load() {
  if (busyLoad.value) return
  busyLoad.value = true
  loading.value = true
  loadError.value = ''
  try {
    const { data } = await api.get('/api/cards/mine')
    if (!data.data) return router.replace('/me')
    card.value = { ...data.data }
    tags.value = data.data.tags || []
  } catch (e) { loadError.value = e.message || '网络异常' } finally { loading.value = false; busyLoad.value = false }
}
async function loadMeta() {
  try { const { data } = await api.get('/api/cards/public/market/meta'); meta.value = data.data || meta.value } catch {}
}
onMounted(async () => { await load(); loadMeta() })

async function done() {
  if (saving.value || !card.value) return
  const c = card.value
  // 套餐闸门前端兜底：未开通却要上架时不发请求，避免生硬 403
  if (c.market_opt_in && !planActive.value) {
    showToast('上架集市需要先开通套餐', 'error')
    return
  }
  saving.value = true
  try {
    await api.put('/api/cards/mine', {
      market_opt_in: !!c.market_opt_in, industry: c.industry || '',
      latitude: c.latitude, longitude: c.longitude
    })
    showToast(c.market_opt_in ? '已上架名片集市' : '已下架名片集市', 'success')
    router.push('/me')
  } catch (e) { showToast(e.message || '保存失败', 'error') } finally { saving.value = false }
}
</script>

<style scoped>
.page { padding-bottom: calc(100px + env(safe-area-inset-bottom)); }
/* 顶栏统一用 global.css 的沉浸式 .topbar（含 safe-area 贴顶、34px 返回按钮、左右 16px 对齐） */
.badge.on { background: #eef4ff; background: color-mix(in srgb, var(--primary) 12%, transparent); color: var(--primary); }
.preview-panel { margin-top: 12px; }
.preview-card { padding: 12px; }
.preview-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }

/* 层级与实体名片设计一致：tabbar=110，launcher=105，遮罩=120，弹层=121；
   低于 tabbar 会让弹层底部字段点不到，visibility 隐藏避免拦截背后滚动。 */
/* 四边定位兼容老 WebView */
.sheet-mask { position: fixed; top: 0; right: 0; bottom: 0; left: 0; background: rgba(15,23,42,.45); z-index: 120; opacity: 0; pointer-events: none; transition: opacity .2s; }
.sheet-mask.show { opacity: 1; pointer-events: auto; }
.edit-sheet { position: fixed; left: 0; right: 0; bottom: 0; z-index: 121; background: #fff; border-radius: 16px 16px 0 0; transform: translateY(105%); transition: transform .24s ease; visibility: hidden; max-height: 78vh; overflow-y: auto; overscroll-behavior: contain; display: flex; flex-direction: column; padding-bottom: calc(18px + env(safe-area-inset-bottom)); }
.edit-sheet.show { transform: translateY(0); visibility: visible; }
@media (min-width: 900px) { .edit-sheet { left: 50%; right: auto; width: 560px; margin-left: -280px; border-radius: 16px 16px 0 0; } }
.sheet-grab { height: 18px; display: grid; place-items: center; flex: 0 0 18px; }
.sheet-grab span { width: 36px; height: 4px; border-radius: 2px; background: var(--line); }
.tab-ico { width: 14px; height: 14px; border-radius: 50%; background: currentColor; opacity: .75; flex: 0 0 14px; }
.control-panel { margin: 0; border-radius: 0; border: 0; flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
/* tabbar 在本页已隐藏，功能条贴底：现在只有一个「上架设置」入口。
   背景与名片页返回签同质感：暖调磨砂玻璃（2026-11-28 全站底栏统一） */
.bottom-launcher { position: fixed; left: 0; right: 0; bottom: 0; z-index: 105; display: flex; padding: 8px 12px calc(10px + env(safe-area-inset-bottom)); background: rgba(243,239,232,.65); -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px); border-top: 1px solid rgba(255,255,255,.45); box-shadow: 0 -10px 34px -16px rgba(31,27,22,.22), inset -1px 1px 0 rgba(255,255,255,.50); }
.bottom-launcher button { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; padding: 8px 0; border-radius: 8px; color: var(--muted); font-size: 13px; }
.bottom-launcher button.on { color: var(--primary); background: #eef4ff; background: color-mix(in srgb, var(--primary) 10%, transparent); }
@media (min-width: 900px) { .bottom-launcher { max-width: 560px; left: 50%; right: auto; transform: translateX(-50%); border-radius: 14px 14px 0 0; } }
.market-value { background: var(--bg-page); border-radius: 10px; padding: 12px; margin-bottom: 12px; }
.market-value p { margin: 4px 0 0; line-height: 1.6; }
.plan-gate-tip { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; background: #fff7ed; background: color-mix(in srgb, #f59e0b 10%, transparent); border: 1px solid #fde68a; border-radius: 10px; padding: 12px; margin-bottom: 12px; }
.plan-gate-tip b { color: #b45309; font-size: 13px; }
.plan-gate-tip span { font-size: 12px; line-height: 1.5; color: var(--muted); }
.plan-gate-tip .btn { margin-top: 2px; }
.market-checks { display: flex; flex-wrap: wrap; gap: 8px; font-size: 12px; color: var(--muted); margin-top: 10px; }
.market-checks .ok { color: var(--primary); }
.region-line { margin-top: 10px; }
.sheet-actions { display: flex; gap: 10px; margin-top: 16px; }
.sheet-actions .btn { flex: 1; }
</style>
