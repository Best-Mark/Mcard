<template>
  <div class="page">
    <header class="topbar">
      <button class="back" @click="done" aria-label="返回">‹</button>
      <span class="title">名片集市</span>
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
        <div class="edit-sheet" :class="{ show: sheetOpen }" role="dialog" aria-label="名片集市设置">
          <div class="sheet-grab" @click="sheetOpen = false"><span></span></div>
          <div class="control-tabs" role="tablist">
            <button v-for="s in SECTIONS" :key="s.k" class="control-tab" :class="{ on: openSection === s.k }" role="tab" :aria-selected="openSection === s.k" @click="openSection = s.k">
              <span class="tab-ico" :class="'ico-' + s.k"></span><span class="tab-txt">{{ s.label }}</span>
              <span class="tab-dot" v-if="openSection === s.k"></span>
            </button>
          </div>

          <div class="card card-pad control-panel">
            <template v-if="openSection === 'status'">
              <div class="section-title" style="margin-top:0">上架开关</div>
              <div class="market-value">
                <b>🚀 上架 = 多一个 7×24 小时的获客入口</b>
                <p>附近及同行业的人可按「距离 / 行业 / 关键词」搜到你，点开名片即可保存。只展示姓名、职位、公司、行业、城市与简介，联系方式不会公开；随时可关闭下架。</p>
              </div>
              <div class="field"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" v-model="card.market_opt_in" /> 加入名片集市（主动上架）</label></div>
              <p v-if="card.market_opt_in" class="small" style="color:var(--primary);margin:-4px 0 12px">保存后即可在集市被搜索到，<router-link to="/market">去看看集市 →</router-link></p>
              <div class="market-checks">
                <span :class="{ ok: !!card.industry }">{{ card.industry ? '✓' : '○' }} 填行业</span>
                <span :class="{ ok: !!regionText }">{{ regionText ? '✓' : '○' }} 填地区</span>
                <span :class="{ ok: card.latitude != null }">{{ card.latitude != null ? '✓' : '○' }} 有坐标</span>
              </div>
            </template>

            <template v-else-if="openSection === 'industry'">
              <div class="section-title" style="margin-top:0">所属行业</div>
              <p class="small muted">被同行按行业精确搜到。</p>
              <div class="field"><label>行业</label>
                <select v-model="card.industry" class="input">
                  <option value="">未选择</option>
                  <option v-for="ind in meta.industries" :key="ind.key" :value="ind.key">{{ ind.label }}</option>
                </select>
              </div>
            </template>

            <template v-else-if="openSection === 'region'">
              <div class="section-title" style="margin-top:0">地区与坐标</div>
              <p class="small muted">上架展示的「地区 / 坐标」来自「名片信息 → 联系方式」里填写的地址与定位，这里只读展示，不重复设置。</p>
              <div class="cp-market-row"><span>地区</span><b>{{ regionText || '未填写（去联系方式里填）' }}</b></div>
              <div class="cp-market-row"><span>坐标</span><b>{{ card.latitude != null ? `${Number(card.latitude).toFixed(4)}, ${Number(card.longitude).toFixed(4)}` : '未定位（去联系方式里定位）' }}</b></div>
              <router-link to="/me/card" class="btn btn-sm btn-ghost" style="margin-top:10px">去填写联系方式 →</router-link>
            </template>

            <template v-else-if="openSection === 'tune'">
              <div class="section-title" style="margin-top:0">排序优化</div>
              <p class="small muted">集市默认按距离优先曝光，坐标越准越靠前；行业对口、关键词命中也会提升曝光。完善名片资料（简介、相册）能提升对方点开后的留存。</p>
              <router-link to="/market" class="btn btn-sm btn-primary">去集市看看 →</router-link>
            </template>
          </div>
        </div>

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
import CardPreview from '../components/CardPreview.vue'

const router = useRouter()
const card = ref(null)
const tags = ref([])
const meta = ref({ industries: [], cities: [] })
const saving = ref(false)
const busyLoad = ref(false)
const loading = ref(false)
const loadError = ref('')
const sheetOpen = ref(false)
const openSection = ref('status')
// 弹层打开锁页面滚动，避免上拖时带动背后的页
let bodyOverflowBefore = ''
watch(sheetOpen, on => {
  if (on) { bodyOverflowBefore = document.body.style.overflow; document.body.style.overflow = 'hidden' }
  else document.body.style.overflow = bodyOverflowBefore
})
onBeforeUnmount(() => { document.body.style.overflow = bodyOverflowBefore })

const SECTIONS = [
  { k: 'status', label: '上架' },
  { k: 'industry', label: '行业' },
  { k: 'region', label: '地区' },
  { k: 'tune', label: '曝光' }
]
const regionText = computed(() => {
  const c = card.value
  return c ? [c.province, c.city, c.district].filter(Boolean).join(' · ') : ''
})
const previewQr = computed(() => {
  const c = card.value
  if (!c?.slug) return ''
  const st = encodeURIComponent(JSON.stringify(c.qr_style || {}))
  return `/api/cards/public/${c.slug}/qr.svg?size=320&brand=M&fg=${encodeURIComponent(c.qr_fg || '#0f172a')}&bg=${encodeURIComponent(c.qr_bg || '#ffffff')}&logo=${c.qr_logo ? 1 : 0}&style=${st}`
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
  saving.value = true
  const c = card.value
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
.topbar { height: 50px; display: flex; align-items: center; gap: 10px; padding: 0 12px; background: #fff; border-bottom: 1px solid var(--line); }
.topbar .back { font-size: 30px; line-height: 1; color: var(--text); }
.topbar .title { font-weight: 700; font-size: 15px; }
.topbar .spacer { flex: 1; }
.badge.on { background: color-mix(in srgb, var(--primary) 12%, transparent); color: var(--primary); }
.preview-panel { margin-top: 12px; }
.preview-card { padding: 12px; }
.preview-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }

/* 层级与实体名片设计一致：tabbar=110，launcher=105，遮罩=120，弹层=121；
   低于 tabbar 会让弹层底部字段点不到，visibility 隐藏避免拦截背后滚动。 */
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
.ico-status { border-radius: 50%; }
.ico-industry { border-radius: 3px; }
.ico-region { border-radius: 2px; }
.ico-tune { border-radius: 50% 50% 3px 3px; }
.tab-dot { position: absolute; bottom: 0; left: 50%; width: 4px; height: 4px; border-radius: 50%; background: var(--primary); }
.control-panel { margin: 0; border-radius: 0; border: 0; flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
/* tabbar 在本页已隐藏，功能条贴底 */
.bottom-launcher { position: fixed; left: 0; right: 0; bottom: 0; z-index: 105; display: flex; gap: 6px; padding: 8px 12px calc(10px + env(safe-area-inset-bottom)); background: #fff; border-top: 1px solid var(--line); box-shadow: 0 -4px 16px rgba(0,0,0,.06); }
.bottom-launcher button { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 0; border-radius: 8px; color: var(--muted); font-size: 12px; }
.bottom-launcher button.on { color: var(--primary); background: color-mix(in srgb, var(--primary) 10%, transparent); }
.market-value { background: var(--bg-page); border-radius: 10px; padding: 12px; margin-bottom: 12px; }
.market-value p { margin: 4px 0 0; }
.market-checks { display: flex; flex-wrap: wrap; gap: 8px; font-size: 12px; color: var(--muted); }
.market-checks .ok { color: var(--primary); }
.cp-market-row { display: flex; justify-content: space-between; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--line); font-size: 13px; }
.cp-market-row span { color: var(--muted); }
</style>
