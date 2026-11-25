<template>
  <div class="page">
    <header class="topbar">
      <button class="back-btn" @click="finish">‹ 返回</button>
      <div class="spacer"></div>
      <button class="nav-menu-btn" aria-label="菜单" @click="toggleDrawer"><i class="menu-glyph"></i></button>
      <button class="btn btn-sm btn-ghost preview-toggle" @click="showPreview = true">预览</button>
      <span class="small muted">编辑资料 · 可随时离开，下次继续</span>
    </header>

    <div class="container wide" style="margin-top:18px">
      <div v-if="loadError" class="card card-pad" style="margin-bottom:14px;border-color:#fecaca;background:#fef2f2">
        <b style="color:#b91c1c">名片资料加载失败</b>
        <p class="small muted" style="margin:6px 0 12px">{{ loadError }}。为避免覆盖已有资料，保存已临时禁用。</p>
        <button class="btn btn-sm btn-primary" :disabled="loading" @click="loadCard">重新加载</button>
      </div>
      <div class="hint" style="margin-bottom:14px">
        👀 <b>所见即所得</b>：每改一项，右侧预览立即更新，你当场就能看到名片变成什么样；保存只是把它持久化。链接 <span class="mono">/c/{{ form.slug }}</span> 与二维码图案始终不变，印好的实体名片无需重做。
      </div>

      <div class="edit-layout">
        <!-- 分类导航：一次只显示一类，避免长表单吓跑用户 -->
        <nav class="edit-nav">
          <button v-for="(s, i) in sections" :key="s.key" :class="{ on: active === s.key, dirty: dirtySections[s.key] }" @click="goSection(i)">
            <span class="nav-ico">{{ s.icon }}</span>
            <span class="nav-label">{{ s.label }}</span>
            <span v-if="dirtySections[s.key]" class="nav-dirty" title="有未保存修改"></span>
            <span v-else-if="s.done" class="nav-done">✓</span>
          </button>
        </nav>

        <div class="edit-content">
          <!-- 名片信息 -->
          <div v-show="active === 'identity'" class="card card-pad" id="focus-identity">
            <div class="section-title" style="margin-top:0">名片信息</div>

            <div class="identity-block">
              <div class="block-title">🏢 公司 / 品牌 LOGO <span class="muted small">代表企业或品牌 · 名片的视觉主体（自动去底成透明 PNG）</span></div>
              <div class="field">
                <div v-if="form.logo" class="logo-current"><img :src="form.logo" alt="当前 LOGO" /><span>当前 LOGO · 重新上传可替换</span></div>
                <LogoUploader v-model="form.logo" />
                <AssetPicker v-model="form.logo" label="从素材库选" />
              </div>
            </div>

            <div class="identity-block divided">
              <div class="block-title">✎ 姓名与职位</div>
            <div class="grid2">
              <div class="field"><label>姓名 *</label><input v-model="form.name" class="input" maxlength="30" /></div>
              <div class="field"><label>英文名（选填）</label><input v-model="form.name_en" class="input" maxlength="40" /></div>
              <div class="field"><label>职位</label><input v-model="form.title" class="input" maxlength="60" /></div>
              <div class="field"><label>公司</label><input v-model="form.company" class="input" maxlength="60" /></div>
              <div class="field"><label>部门</label><input v-model="form.department" class="input" maxlength="40" /></div>
            </div>
            </div>
            <div class="section-foot"><span class="save-state">修改即时反映到右侧预览 · 自动保存仅用于持久化</span></div>
          </div>

          <!-- 标签简介：标签放在上面（用户 2026-11-25 定稿） -->
          <div v-show="active === 'bio'" class="card card-pad" id="focus-bio">
            <div class="section-title" style="margin-top:0">标签简介</div>
            <p class="small muted" style="margin-bottom:12px">先用几个标签让人一眼记住你，再用简介补充说明。</p>
            <div class="field"><label>标签（逗号分隔，最多 8 个）</label><input v-model="tagsText" class="input" placeholder="品牌顾问, 设计, 马拉松" /></div>
            <div class="field"><label>个人简介</label><textarea v-model="form.bio" class="textarea" maxlength="600" placeholder="一句话介绍自己，展示在名片首页"></textarea></div>
            <div class="field"><label>公司简介</label><textarea v-model="form.company_intro" class="textarea" maxlength="1000" placeholder="介绍公司业务、优势与服务，展示在名片「公司简介」区块，并写入通讯录备注"></textarea></div>
            <div class="section-foot"><span class="save-state">修改即时反映到右侧预览 · 自动保存仅用于持久化</span></div>
          </div>

          <!-- ③ 联系方式 -->
          <div v-show="active === 'contact'" class="card card-pad" id="focus-contact">
            <div class="section-title" style="margin-top:0">联系方式</div>
            <div class="grid2">
              <div class="field"><label>手机号</label><input v-model="form.mobile" class="input" inputmode="tel" /></div>
              <div class="field"><label>座机</label><input v-model="form.phone" class="input" /></div>
              <div class="field"><label>邮箱</label><input v-model="form.email" class="input" type="email" /></div>
              <div class="field"><label>微信号</label><input v-model="form.wechat" class="input" /></div>
              <div class="field"><label>支付宝账号</label><input v-model="form.alipay" class="input" /></div>
              <div class="field"><label>WhatsApp</label><input v-model="form.whatsapp" class="input" /></div>
            </div>
            <div class="field">
              <label>所在地区 <span class="muted small">（省 / 市 / 区 / 街道，可选到任意一级；定位用于导航与集市距离）</span></label>
              <div class="locate-row">
                <span class="small region-path">{{ regionPath || '未选择' }}</span>
                <span v-if="positionSource" class="badge small" :class="qualityClass">{{ sourceLabel }}</span>
                <button class="btn btn-sm btn-ghost" :disabled="loading" @click="regionOpen = true">⌖ 选择地区</button>
                <button class="btn btn-sm btn-ghost" :disabled="geoBusy || loading" @click="autoLocateAddress">{{ geoBusy ? '定位中…' : '◎ 自动定位' }}</button>
                <button class="btn btn-sm btn-ghost" @click="mapOpen = true">🗺 地图选点</button>
              </div>
            </div>
            <div class="field"><label>地址（用于一键导航）</label><input v-model="form.address" class="input" placeholder="街道门牌，越详细导航越准" /></div>
            <div class="field"><label>门牌 / 楼层补充</label><input v-model="form.address_detail" class="input" /></div>
            <div class="section-foot"><span class="save-state">修改即时反映到右侧预览 · 自动保存仅用于持久化</span></div>
          </div>

          <!-- 名片集市已独立为 /me/card/market 设计页（2026-11-25 用户定稿），不再放资料表单 -->

          <!-- 更多信息 -->
          <div v-show="active === 'links'" class="card card-pad" id="focus-links">
            <div class="section-title" style="margin-top:0">更多信息</div>
            <p class="small muted" style="margin-bottom:10px">公司主页、店铺、作品集等，同时写入通讯录备注。</p>
            <div class="grid2">
              <div class="field"><label>公司主页 URL</label><input v-model="form.website" class="input" placeholder="https://" /></div>
              <div class="field"><label>店铺 URL</label><input v-model="form.shop_url" class="input" placeholder="https:// 淘宝 / 抖音 / 微店等" /></div>
            </div>
            <div v-for="(l, i) in form.links" :key="i" class="link-row">
              <input v-model="l.label" class="input" placeholder="标题，如 我的作品集" />
              <input v-model="l.url" class="input" placeholder="https://" />
              <button class="btn btn-sm btn-danger" @click="form.links.splice(i, 1)">删</button>
            </div>
            <button class="btn btn-sm btn-ghost" @click="form.links.push({ label: '', url: '' })">+ 添加链接</button>
            <div class="section-foot"><span class="save-state">修改即时反映到右侧预览 · 自动保存仅用于持久化</span></div>
          </div>

          <!-- 公司相册（内部字段名仍为 materials） -->
          <div v-show="active === 'materials'" class="card card-pad" id="focus-materials">
            <div class="section-title" style="margin-top:0">公司相册</div>
            <p class="small muted" style="margin-bottom:12px">图片、产品册、作品集或链接，访客在名片上点开即看，无需跳转。</p>
            <div v-if="!materials.length" class="small muted" style="padding:12px 0">还没有内容，添加第一项吧。</div>
            <div v-for="(m, i) in materials" :key="m.id || m._k || i" class="material-row">
              <div class="mr-head">
                <BottomSelect v-model="m.type" :options="materialTypeOptions" title="选择资料类型" trigger-class="input mr-type" />
                <input v-model="m.title" class="input" placeholder="标题，如 2026 产品手册" maxlength="60" />
                <button class="btn btn-sm btn-danger" @click="materials.splice(i, 1)">删</button>
              </div>
              <div class="mr-url">
                <input v-model="m.url" class="input" :placeholder="m.type === 'link' ? 'https://…' : '上传图片/文件或粘贴链接'" />
                <label v-if="m.type === 'file'" class="btn btn-sm btn-ghost upload-btn">上传图片/文件
                  <input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" @change="e => uploadMaterial(e, m)" />
                </label>
              </div>
            </div>
            <button class="btn btn-sm btn-ghost" @click="addMaterial">+ 添加一项</button>
            <div class="section-foot"><span class="save-state">修改即时反映到右侧预览 · 自动保存仅用于持久化</span></div>
          </div>


          <div class="done-bar">
            <span class="small muted">{{ autoSaveText }}</span>
            <div class="done-actions">
              <!-- 外观/集市从导航移出、由 /me 直达（sectionIndex=-1），此时不显示上下项 -->
              <template v-if="sectionIndex >= 0">
                <button v-if="sectionIndex > 0" class="btn btn-sm btn-ghost" @click="goSection(sectionIndex - 1)">‹ 上一项</button>
                <button v-if="sectionIndex < sections.length - 1" class="btn btn-sm btn-ghost" @click="goSection(sectionIndex + 1)">下一项 ›</button>
              </template>
              <button class="btn btn-sm btn-primary" :disabled="saving || loadError || !loaded" @click="finish">{{ sectionIndex === sections.length - 1 || sectionIndex < 0 ? '完成，返回名片' : '返回名片' }}</button>
            </div>
          </div>
        </div>

        <aside class="preview-panel">
          <div class="card card-pad">
            <div class="section-title" style="margin-top:0">实时预览 <span class="small muted">· 改一项看一项</span></div>
            <CardPreview :card="form" :tags="tagList" :materials="materials" :qr-url="previewQr" :section="active" :industries="marketMeta.industries" />
            <p class="small muted center" style="margin-top:10px">扫码地址固定为 <span class="mono">/c/{{ form.slug }}</span></p>
          </div>
        </aside>
      </div>
    </div>

    <!-- 省市区选择：底部弹层 + van-picker 标准滚轮（工具栏取消/确定由滚轮自带） -->
    <BottomSheet :show="regionOpen" @update:show="regionOpen = $event">
      <RegionPicker
        :province="form.province" :city="form.city" :district="form.district" :street="form.street"
        @confirm="onRegionPicked"
        @close="regionOpen = false"
      />
    </BottomSheet>

    <!-- 窄屏预览：手机上点顶部「预览」全屏看实时名片，与 PC 右侧预览共用组件 -->
    <div v-if="showPreview" class="mobile-preview-mask" @click.self="showPreview = false">
      <div class="mobile-preview-panel">
        <div class="map-modal-head">
          <b>实时预览 · 改一项看一项</b>
          <button class="btn btn-sm btn-ghost" @click="showPreview = false">关闭</button>
        </div>
        <CardPreview :card="form" :tags="tagList" :materials="materials" :qr-url="previewQr" :section="active" />
      </div>
    </div>

    <!-- 地图拖拽选点（懒加载，打开才下载地图组件） -->
    <div v-if="mapOpen" class="map-mask" @click.self="mapOpen = false">
      <div class="map-modal">
        <div class="map-modal-head">
          <b>地图选点</b>
          <button class="btn btn-sm btn-ghost" @click="mapOpen = false">关闭</button>
        </div>
        <MapPicker
          :lat="form.latitude"
          :lng="form.longitude"
          :region="regionPath"
          @confirm="onMapPicked"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, defineAsyncComponent } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import api from '../api'
import { showToast, toggleDrawer } from '../store'
import { THEMES, paletteOf } from '../utils/themes'
import { refreshPosition, setManualPosition, reverseGeocode, geocode } from '../utils/geo'
import LogoUploader from '../components/LogoUploader.vue'
import AssetPicker from '../components/AssetPicker.vue'
import BottomSheet from '../components/BottomSheet.vue'
import BottomSelect from '../components/BottomSelect.vue'
import CardPreview from '../components/CardPreview.vue'

const MapPicker = defineAsyncComponent(() => import('../components/MapPicker.vue'))
const RegionPicker = defineAsyncComponent(() => import('../components/RegionPicker.vue'))

const router = useRouter()
const route = useRoute()
const DEFAULT_TPL = 'contact'
const DEFAULT_PAL = paletteOf(DEFAULT_TPL)
const blank = {
  slug: '', name: '', name_en: '', title: '', company: '', company_intro: '', department: '', website: '', shop_url: '',
  mobile: '', phone: '', email: '', wechat: '', alipay: '', whatsapp: '',
  address: '', address_detail: '', province: '', city: '', district: '', street: '',
  avatar: '', logo: '', bio: '', tags: [], links: [], template: DEFAULT_TPL, theme: DEFAULT_PAL.theme, accent: THEMES[DEFAULT_PAL.theme].accent,
  industry: '', city: '', latitude: null, longitude: null, market_opt_in: false,
  qr_fg: DEFAULT_PAL.qrFg, qr_bg: DEFAULT_PAL.qrBg, qr_logo: true,
  qr_style: { dot: 'square', eye: 'square', gradTo: '', logoShape: 'rounded', bgImage: '' }
}
// 外观（模板/强调色/二维码）与集市已独立为 /me/card/style、/me/card/market 设计页，本页只保留字段默认值供预览。
const form = ref({ ...blank })
const active = ref('identity')
const showPreview = ref(false)
// 分类顺序按用户 2026-11-25 定稿：名片信息→联系方式→标签简介→公司相册→更多信息。
// ⚠️ 外观风格不进导航（focus=appearance 仍可直达：由「我的名片→配色风格」按钮进入）；
// 名片集市也不进导航（由「我的名片→名片集市」按钮进入），内容块保留、保存逻辑不变。
const sections = computed(() => [
  { key: 'identity', label: '名片信息', icon: '👤', done: !!(form.value.name && (form.value.title || form.value.company)) },
  { key: 'contact', label: '联系方式', icon: '📞', done: !!(form.value.mobile || form.value.phone || form.value.email || form.value.wechat || form.value.address) },
  { key: 'bio', label: '标签简介', icon: '📝', done: !!(form.value.bio || form.value.company_intro || tagList.value.length) },
  { key: 'materials', label: '公司相册', icon: '📚', done: !!materials.value.length },
  { key: 'links', label: '更多信息', icon: '🔗', done: !!(form.value.website || form.value.shop_url || form.value.links?.length) }
])
const marketMeta = ref({ industries: [], cities: [] })
const materials = ref([])
const materialTypes = ref([])
const materialTypeOptions = computed(() => materialTypes.value.map(t => ({ value: t.key, label: t.label })))
const geoBusy = ref(false)
const mapOpen = ref(false)
const regionOpen = ref(false)
const positionSource = ref('')   // wechat/gps/ip/default/manual，来自四级定位
const positionQuality = ref('')  // precise/approximate/coarse
const regionPath = computed(() => [form.value.province, form.value.city, form.value.district, form.value.street].filter(Boolean).join(' / '))
// 集市地区只读复用「联系方式」的省市区（同一份 cards 列，不重复填）
const qualityClass = computed(() => ({ precise: 'ok', approximate: 'warn', coarse: 'off' }[positionQuality.value] || 'off'))
const sourceLabel = computed(() => ({
  wechat: '微信定位', gps: 'GPS 定位', ip: 'IP 定位', default: '城市兜底', manual: '手动选点'
}[positionSource.value] || '已定位'))
const tagsText = ref('')
const saving = ref(false)
const loading = ref(false)
const loaded = ref(false)
const loadError = ref('')
const tagList = computed(() => tagsText.value.split(/[,，]/).map(s => s.trim()).filter(Boolean).slice(0, 8))
const previewQr = computed(() => {
  if (!form.value.slug) return ''
  const s = form.value.qr_style || {}
  const st = encodeURIComponent(JSON.stringify({ dot: s.dot, eye: s.eye, gradTo: s.gradTo || '', logoShape: s.logoShape, bgImage: s.bgImage || '' }))
  const f = form.value
  return `/api/cards/public/${f.slug}/qr.svg?size=320&brand=M&fg=${encodeURIComponent(f.qr_fg)}&bg=${encodeURIComponent(f.qr_bg)}&logo=${f.qr_logo ? 1 : 0}&style=${st}`
})

async function loadCard() {
  if (loading.value) return
  loading.value = true
  loadError.value = ''
  try {
    const { data } = await api.get('/api/cards/mine')
    if (!data.data) { showToast('请先创建名片', 'error'); return router.push('/me') }
    form.value = {
      ...blank, ...data.data, qr_logo: !!data.data.qr_logo,
      qr_style: { ...blank.qr_style, ...(data.data.qr_style || {}) }
    }
    tagsText.value = (data.data.tags || []).join(', ')
    loaded.value = true
    dirtySections.value = {}
    formReady = true
  } catch (e) {
    loadError.value = e.message || '网络异常'
  } finally { loading.value = false }
}

onMounted(async () => {
  loadMarketMeta()
  loadCommonMeta()
  loadMaterials()
  await loadCard()
  applyFocus()
})

// 从抽屉/板块入口带 focus 进来时切到对应分类。
// 用 watch 监听 query：用户已在编辑页时，点「模板与配色」等只改 query、组件不重新挂载，
// 必须在 query 变化时也切换，否则点了没反应。
function applyFocus() {
  const focus = String(route.query.focus || '')
  // 外观/集市已独立成 /me/card/style、/me/card/market 页面，本页不再接受这两个 focus
  if (['identity', 'bio', 'contact', 'links', 'materials'].includes(focus)) active.value = focus
}
watch(() => route.query.focus, () => applyFocus())

async function loadMarketMeta() {
  try {
    const { data } = await api.get('/api/cards/public/market/meta')
    marketMeta.value = data.data
  } catch { /* 集市元数据失败不影响资料编辑 */ }
}

async function loadCommonMeta() {
  try {
    const { data } = await api.get('/api/cards/public/meta')
    materialTypes.value = data.data?.materialTypes || [{ key: 'link', label: '网页链接' }, { key: 'file', label: '文件资料' }]
  } catch { materialTypes.value = [{ key: 'link', label: '网页链接' }, { key: 'file', label: '文件资料' }] }
}

async function loadMaterials() {
  try {
    const { data } = await api.get('/api/cards/mine/materials')
    materials.value = (data.data?.list || []).map(m => ({ type: m.type, title: m.title, url: m.url }))
    savedSections.value = { ...savedSections.value, materials: Date.now() }
  } catch { /* 资料夹加载失败不阻断其它资料编辑 */ }
}

// 联系方式区「自动定位」：定位后把省市区写进资料
async function autoLocateAddress() {
  if (geoBusy.value) return
  geoBusy.value = true
  try {
    const pos = await refreshPosition(form.value.city || undefined)
    const addr = await reverseGeocode(pos.lat, pos.lng)
    if (!addr) return showToast('获取到坐标，但地址解析失败，请用地图选点', 'error')
    form.value.province = addr.province || form.value.province
    form.value.city = addr.city || form.value.city
    form.value.district = addr.district || form.value.district
    form.value.street = addr.street || form.value.street
    if (!form.value.address) form.value.address = [addr.street, addr.district].filter(Boolean).join('')
    form.value.latitude = pos.lat
    form.value.longitude = pos.lng
    positionSource.value = pos.source || ''
    positionQuality.value = pos.quality || ''
    showToast('已填入所在地区，记得点保存', 'success')
  } catch (e) { showToast(e.message || '自动定位失败', 'error') }
  finally { geoBusy.value = false }
}

function onRegionPicked(r) {
  form.value.province = r.province
  form.value.city = r.city
  form.value.district = r.district
  form.value.street = r.street
  regionOpen.value = false
  // 选中地区后按地址补坐标（不阻塞，失败保留原坐标）
  const text = [r.province, r.city, r.district, r.street].filter(Boolean).join('')
  if (text) geocode(text, r.city).then(g => {
    if (g) {
      form.value.latitude = g.lat
      form.value.longitude = g.lng
      setManualPosition(g.lat, g.lng, r.city)
      positionSource.value = 'manual'
      positionQuality.value = 'precise'
    }
  }).catch(() => {})
  showToast('地区已选择，记得点保存', 'success')
}

async function onMapPicked(p) {
  form.value.latitude = p.lat
  form.value.longitude = p.lng
  mapOpen.value = false
  setManualPosition(p.lat, p.lng, form.value.city)
  positionSource.value = 'manual'
  positionQuality.value = 'precise'
  const addr = await reverseGeocode(p.lat, p.lng)
  if (addr) {
    form.value.province = addr.province || form.value.province
    form.value.city = addr.city || form.value.city
    form.value.district = addr.district || form.value.district
    form.value.street = addr.street || form.value.street
  }
  showToast('坐标已填入，记得点保存', 'success')
}

async function upload(e, field) {
  const file = e.target.files?.[0]
  if (!file) return
  const fd = new FormData()
  fd.append('file', file)
  try {
    const { data } = await api.post('/api/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    form.value[field] = data.data.url
    const d = data.data
    const saved = d.converted && d.originalSize > d.size ? ` · 已压缩 ${Math.round((1 - d.size / d.originalSize) * 100)}%` : ''
    showToast(`上传成功${saved}，记得点保存`, 'success')
  } catch (err) { showToast(err.message, 'error') }
  e.target.value = ''
}

// 每类字段清单：保存时只提交当前分类，真正实现「填一类存一类」的渐进式完善
const SECTION_FIELDS = {
  identity: ['name', 'name_en', 'title', 'company', 'department', 'logo'],
  bio: ['bio', 'company_intro', 'tags'],
  contact: ['mobile', 'phone', 'email', 'wechat', 'alipay', 'whatsapp', 'province', 'city', 'district', 'street', 'address', 'address_detail'],
  links: ['website', 'shop_url', 'links']
  // ⚠️ 外观（template/theme/accent/qr_*）与集市（market_opt_in/industry/latitude/longitude）已独立到
  // /me/card/style、/me/card/market 保存；本页不提交这些字段（参数唯一真相源）。地区字段归联系方式。
}
const savedSections = ref({})
const dirtySections = ref({})

// 保存串行链：切分类自动保存与 finish 收敛可能并发发起，必须排队，后一次才能看到前一次结果，
// 否则「选模板改5个字段」与「切走后 finish 保存当前分类」互相覆盖 → 模板要刷新才生效（2026-11-25 实修）。
let saveChain = Promise.resolve()
function enqueueSave(key, silent = false) {
  const task = saveChain.then(() => saveSection(key, silent))
  saveChain = task.catch(() => {})
  return task
}
async function saveSection(key, silent = false) {
  if (loadError.value || !loaded.value) return
  if (key === 'materials') return saveMaterials(silent)
  const fields = SECTION_FIELDS[key] || []
  if (key === 'identity' && !form.value.name) return (silent ? null : showToast('请填写姓名', 'error'))
  saving.value = true
  autoSaveText.value = '正在保存…'
  try {
    const payload = {}
    for (const f of fields) payload[f] = form.value[f]
    if (fields.includes('tags')) payload.tags = tagList.value
    if (fields.includes('links')) payload.links = form.value.links.filter(l => l.label || l.url)
    await api.put('/api/cards/mine', payload)
    savedSections.value = { ...savedSections.value, [key]: Date.now() }
    dirtySections.value = { ...dirtySections.value, [key]: false }
    if (!silent) showToast('已保存', 'success')
    autoSaveText.value = '✓ 已保存 · 右侧预览始终最新'
  } catch (e) {
    const msg = e.message || '保存失败，请检查网络后重试'
    autoSaveText.value = `⚠ ${msg}`
    if (!silent) showToast(msg, 'error')
  } finally { saving.value = false }
}

// 资料夹独立保存（整份替换接口，与名片资料解耦）
// ⚠️ 不要用返回值整体覆盖 materials：用户可能正在编辑「刚加的空行」或上传中，
// 后端会过滤掉无 url 的行，覆盖会让刚添加的行凭空消失（看起来像页面刷关）。
// 只把后端分配的 id 回填到已保存的行，本地未保存完的行原样保留。
async function saveMaterials(silent = false) {
  if (loadError.value || !loaded.value) return
  if (saving.value) return
  saving.value = true
  autoSaveText.value = '正在保存…'
  try {
    const items = materials.value.filter(m => m.url).map((m, i) => ({ ...m, sort: i }))
    const { data } = await api.put('/api/cards/mine/materials', { items })
    const saved = data.data?.list || []
    // 按 url 匹配回填服务端 id（url 是资料唯一业务标识）。
    // 仅在确实变化时替换数组：否则每次保存都新建数组会再次触发 deep watch → 无限自动保存。
    const byUrl = new Map(saved.map(s => [s.url, s]))
    let backfilled = false
    const merged = materials.value.map(m => {
      const hit = m.url && byUrl.get(m.url)
      if (hit && (m.id !== hit.id || m.views !== hit.views)) {
        backfilled = true
        return { ...m, id: hit.id, views: hit.views }
      }
      return m
    })
    if (backfilled) materials.value = merged
    savedSections.value = { ...savedSections.value, materials: Date.now() }
    dirtySections.value = { ...dirtySections.value, materials: false }
    if (!silent) showToast('资料夹已保存', 'success')
    autoSaveText.value = '✓ 已保存 · 右侧预览始终最新'
  } catch (e) {
    autoSaveText.value = '保存失败，请检查网络后修改任意字段重试'
    if (!silent) showToast(e.message, 'error')
  } finally { saving.value = false }
}
let materialSeq = 0
function addMaterial() { materials.value.push({ _k: `new-${++materialSeq}`, type: 'link', title: '', url: '' }) }
async function uploadMaterial(e, row) {
  const file = e.target?.files?.[0]
  if (!file) return
  const prev = row.url
  const fd = new FormData()
  fd.append('file', file)
  try {
    const { data } = await api.post('/api/upload/doc', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    row.url = data?.data?.url || ''
    showToast('文件已上传，将自动保存', 'success')
  } catch (err) { row.url = prev; showToast(err.message, 'error') }
  e.target.value = ''
}

// 字段变更 debounce 后自动保存当前分类，切换分类时立即保存上一分类；预览由 form 直接驱动，无需等保存。
let formReady = false
let saveTimer = null
const sectionIndex = computed(() => sections.value.findIndex(s => s.key === active.value))
const autoSaveText = ref('修改即时反映到右侧预览 · 自动保存仅用于持久化')

function scheduleAutoSave() {
  if (!formReady) return
  dirtySections.value = { ...dirtySections.value, [active.value]: true }
  autoSaveText.value = '有修改，即将自动保存…'
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    const key = active.value
    if (dirtySections.value[key]) enqueueSave(key, true)
  }, 900)
}
watch(form, scheduleAutoSave, { deep: true })
watch(tagsText, scheduleAutoSave)
watch(materials, scheduleAutoSave, { deep: true })

// 切换分类：先保存上一分类，再切过去（预览始终跟随当前 form，无需手动保存）
function goSection(index) {
  const s = sections.value[index]
  if (!s) return
  if (formReady && dirtySections.value[active.value]) {
    clearTimeout(saveTimer)
    enqueueSave(active.value, true)
  }
  active.value = s.key
}

async function finish() {
  clearTimeout(saveTimer)
  // 收敛所有脏分类（不只是当前分类），并等待串行链跑完再跳——保证模板/配色/资料都落库，
  // 否则刚改完展示模板直接返回名片会读到旧数据，必须刷新才生效（2026-11-25 实修）。
  if (formReady) {
    const dirty = Object.keys(dirtySections.value).filter(k => dirtySections.value[k])
    for (const k of dirty) await enqueueSave(k, true)
    await saveChain
  }
  router.push('/me')
}
</script>

<style scoped>
.edit-layout { display: grid; grid-template-columns: 168px minmax(0, 1fr) 260px; gap: 16px; align-items: start; }
.edit-nav { display: flex; flex-direction: column; gap: 4px; position: sticky; top: 72px; background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 8px; }
.edit-nav button { display: flex; align-items: center; gap: 9px; width: 100%; padding: 10px 11px; border-radius: 9px; font-size: 13px; color: var(--text); text-align: left; }
.edit-nav button:hover { background: var(--bg-page); }
.edit-nav button.on { background: #eff6ff; color: var(--primary); font-weight: 700; }
.nav-ico { width: 20px; text-align: center; font-size: 14px; }
.nav-label { flex: 1; }
.nav-done { color: var(--ok); font-size: 11px; }
.nav-dirty { width: 7px; height: 7px; border-radius: 50%; background: #f59e0b; flex: 0 0 7px; }
.edit-nav button.dirty .nav-label { color: #b45309; }
.edit-content { min-width: 0; }
.section-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--line); }
.save-state { font-size: 12px; color: var(--muted); }
.save-state.saved { color: var(--ok); }
.done-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 16px; padding: 14px; background: #eff6ff; border: 1px solid #dbeafe; border-radius: 12px; flex-wrap: wrap; }
.done-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.back-btn { font-size: 16px; color: var(--primary); padding: 4px 8px; margin-left: -8px; }
.preview-toggle { display: none; }
.mobile-preview-mask { position: fixed; inset: 0; background: rgba(15,23,42,.55); z-index: 2100; display: flex; align-items: center; justify-content: center; padding: 16px; }
.mobile-preview-panel { width: 100%; max-width: 380px; max-height: 94vh; overflow-y: auto; background: var(--bg-card, #fff); border-radius: 14px; padding: 14px; box-shadow: 0 20px 60px rgba(0,0,0,.25); }
.mobile-preview-panel :deep(.cp-screen) { height: 68vh; }
@media (max-width: 1080px) { .edit-layout { grid-template-columns: 168px minmax(0, 1fr); } .preview-panel { display: none; } .preview-toggle { display: inline-flex; } }
@media (max-width: 720px) {
  .edit-layout { grid-template-columns: 1fr; }
  .edit-nav { position: static; flex-direction: row; overflow-x: auto; white-space: nowrap; border-radius: 10px; padding: 6px; }
  .edit-nav button { width: auto; flex: 0 0 auto; padding: 8px 12px; }
  .nav-ico { display: none; }
}
.identity-block { margin-bottom: 4px; }
.identity-block.divided { border-top: 1px solid var(--line, #e8edf4); margin-top: 16px; padding-top: 16px; }
.block-title { font-size: 14px; font-weight: 700; color: var(--text, #0f172a); margin-bottom: 12px; }
.block-title .muted { font-weight: 400; margin-left: 6px; }
.avatar-row { display: flex; align-items: center; gap: 14px; margin-bottom: 4px; }
.logo-current { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; font-size: 12px; color: var(--muted); }
.logo-current img { width: 48px; height: 48px; object-fit: contain; border: 1px solid var(--line); border-radius: 10px; background: #fff; padding: 4px; }
.avatar-preview { width: 64px; height: 64px; border-radius: 16px; background: var(--primary); color: #fff; display: grid; place-items: center; font-size: 26px; font-weight: 800; overflow: hidden; }
.avatar-preview img { width: 100%; height: 100%; object-fit: cover; }
.upload-btn { position: relative; overflow: hidden; }
.upload-btn input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.locate-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.locate-row .mono { color: var(--muted); }
.market-value { padding: 12px 14px; margin-bottom: 14px; border-radius: 12px; background: linear-gradient(135deg, #ecfeff, #eff6ff); border: 1px solid #c7d2fe; }
.market-value b { font-size: 13px; color: #0e7490; }
.market-value p { margin: 6px 0 8px; font-size: 12px; line-height: 1.6; color: var(--muted); }
.market-checks { display: flex; gap: 8px 14px; flex-wrap: wrap; }
.market-checks span { font-size: 11px; color: var(--muted); }
.market-checks span.ok { color: #0f766e; font-weight: 700; }
.region-path { color: var(--text); font-weight: 600; min-width: 120px; }
.map-mask { position: fixed; inset: 0; background: rgba(15,23,42,.55); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 16px; }
.map-modal { width: 100%; max-width: 680px; background: var(--bg-card, #fff); border-radius: 14px; padding: 14px; box-shadow: 0 20px 60px rgba(0,0,0,.25); }
.map-modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.region-sheet-head { padding: 16px 18px 6px; }
.region-sheet-body { padding: 0 18px 18px; max-height: 70vh; overflow-y: auto; }
.link-row { display: grid; grid-template-columns: 1fr 1.5fr auto; gap: 8px; margin-bottom: 8px; }
.material-row { padding: 10px; margin-bottom: 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--bg-page, rgba(0,0,0,.02)); }
.material-row .mr-head { display: grid; grid-template-columns: 110px 1fr auto; gap: 8px; align-items: center; margin-bottom: 8px; }
.material-row .mr-url { display: flex; gap: 8px; align-items: center; }
.material-row .mr-url .input { flex: 1; }
.material-row .mr-type { padding: 8px 6px; }
.theme-list { display: flex; flex-wrap: wrap; gap: 8px; }
.theme-item { border: 1px solid var(--line); border-radius: 10px; padding: 6px; display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 11px; }
.theme-item.on { border-color: var(--primary); box-shadow: 0 0 0 2px rgba(37,99,235,.12); }
.theme-item i { width: 44px; height: 26px; border-radius: 6px; display: block; }
.color-input { width: 100%; height: 40px; padding: 3px; border: 1px solid var(--line); border-radius: 10px; background: #fff; }
.adv-toggle { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px; background: none; border: 0; padding: 0; cursor: pointer; color: var(--muted, #6b7688); font-size: 13px; text-align: left; }
.adv-toggle:hover { color: var(--primary, #2563eb); }
.adv-arrow { font-size: 16px; }
.qr-beautify { margin-top: 8px; padding-top: 6px; border-top: 1px dashed var(--line, #e8edf4); }
.qr-presets { display: flex; gap: 8px; flex-wrap: wrap; }
.qr-preset { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; padding: 6px 12px; border: 1px solid var(--line, #e8edf4); border-radius: 999px; background: var(--bg-page, #f4f6fb); color: var(--muted, #6b7688); }
.qr-preset i { width: 14px; height: 14px; border-radius: 4px; display: inline-block; }
.qr-preset.on { border-color: var(--primary, #2563eb); color: var(--primary, #2563eb); font-weight: 700; }
.preview-panel { position: sticky; top: 72px; }
.preview-card { border-radius: 14px; overflow: hidden; border: 1px solid var(--line); }
.preview-head { height: 76px; position: relative; }
.preview-avatar { position: absolute; left: 14px; bottom: -20px; width: 42px; height: 42px; border-radius: 12px; background: #fff; color: var(--primary); display: grid; place-items: center; font-weight: 800; font-size: 18px; }
.preview-body { padding: 26px 14px 14px; display: flex; flex-direction: column; gap: 2px; }
.preview-tags { display: flex; gap: 4px; margin-top: 6px; flex-wrap: wrap; }
.preview-tags i { font-style: normal; font-size: 10px; padding: 2px 7px; border-radius: 999px; background: #eff6ff; color: #2563eb; }
.preview-qr { width: 120px; height: 120px; margin: 14px auto 8px; border: 1px solid var(--line); padding: 6px; border-radius: 10px; }


/* 预览卡跟随模板骨架（与公开名片页同口径） */
.pv-minimal .preview-head { height: 46px; background: #fff !important; border-bottom: 1px solid #e5e7eb; }
.pv-minimal .preview-avatar { border-radius: 50%; background: #111827; width: 34px; height: 34px; left: 50%; transform: translateX(-50%); bottom: -14px; }
.pv-minimal .preview-body { padding-top: 22px; }
.pv-minimal .preview-body b { font-size: 20px; letter-spacing: -1px; }
.pv-minimal .preview-tags i { border-radius: 0; background: transparent; border-bottom: 1px solid var(--primary); color: var(--primary); padding: 1px 0; }
.pv-elite .preview-head { height: 82px; }
.pv-elite .preview-avatar { border-radius: 50%; left: 50%; transform: translateX(-50%); width: 40px; height: 40px; border: 2px solid #b99355; bottom: -18px; }
.pv-elite .preview-body { text-align: center; align-items: center; background: #15171c; color: #f5f5f4; }
.pv-elite .preview-body b { font-family: Georgia,'Songti SC',serif; letter-spacing: 3px; }
.pv-elite .preview-body .muted { color: #a1a1aa; }
.preview-card.pv-vivid, .pv-vivid .preview-head { border-radius: 18px; }
.pv-vivid .preview-avatar { border-radius: 12px; width: 46px; height: 46px; bottom: -20px; box-shadow: 0 6px 14px rgba(0,0,0,.2); }
.pv-vivid .preview-tags i { padding: 3px 10px; }
.preview-card.pv-seal { border-radius: 0; border: 2px solid #111827; box-shadow: 3px 3px 0 rgba(17,24,39,.15); background: #fff; }
.pv-seal .preview-head { background: #111827 !important; border-radius: 0; border-bottom: 4px solid var(--primary, #2563eb); height: 54px; }
.pv-seal .preview-avatar { border-radius: 0; border: 2px solid #111827; background: #fff; color: #111827; width: 38px; height: 38px; bottom: -16px; }
.pv-seal .preview-body { color: #111827; }
.pv-seal .preview-body b { font-size: 22px; font-weight: 900; }
.pv-seal .preview-tags i { border-radius: 0; border: 1px solid #111827; background: #fff; color: #111827; }
/* 简洁联络 contact：深蓝径向底 + 单白卡金顶条（与公开名片页同口径） */
.preview-card.pv-contact { border-radius: 22px; border: 0; box-shadow: 0 12px 28px -14px rgba(0,0,0,.6); overflow: hidden; }
.pv-contact .preview-head { background: var(--ng-page-bg) !important; border-radius: 0; border-bottom: 4px solid var(--ng-gold); }
.pv-contact .preview-avatar { border-radius: 12px; background: linear-gradient(145deg,var(--ng-navy),#0e2233); color: #fff; box-shadow: inset 0 0 0 2px rgba(216,187,133,.5); }
.pv-contact .preview-body { color: var(--ng-ink); }
.pv-contact .preview-tags i { border-radius: 99px; background: var(--ng-paper); color: #6b5a3c; box-shadow: inset 0 0 0 1px rgba(185,147,85,.35); }
/* 深蓝鎏金 navygold：金线封顶 + 深蓝封面 + 纸色标签 */
.preview-card.pv-navygold { border-radius: 22px; border: 2px solid var(--ng-gold); overflow: hidden; }
.pv-navygold .preview-head { background: linear-gradient(135deg, var(--ng-navy) 0%, var(--ng-navy-2) 40%, var(--ng-gold-2) 78%, var(--ng-gold) 100%) !important; }
.pv-navygold .preview-avatar { border-radius: 8px; background: var(--ng-paper); color: var(--ng-navy); box-shadow: inset 0 0 0 2px var(--ng-gold); }
.pv-navygold .preview-body { color: var(--ng-ink); }
.pv-navygold .preview-tags i { border-radius: 99px; background: var(--ng-paper); color: #6b5a3c; box-shadow: inset 0 0 0 1px rgba(185,147,85,.35); }
/* B 极简纸白：6px 小圆角 + 发丝线 + 细体大字 */
.preview-card.pv-paper { border-radius: 6px; border: 1px solid #e7e5df; box-shadow: 0 1px 0 #dcdad4, 0 20px 40px -30px rgba(0,0,0,.3); }
.pv-paper .preview-head { background: #fff !important; height: 46px; border-bottom: 1px solid #111; }
.pv-paper .preview-avatar { border-radius: 50%; background: #111; color: #fff; }
.pv-paper .preview-body { color: #111; }
.pv-paper .preview-body b { font-size: 26px; font-weight: 300; letter-spacing: .14em; }
.pv-paper .preview-tags i { border-radius: 3px; background: #fff; color: #555; box-shadow: inset 0 0 0 1px #ddd; }
/* C 墨夜玻璃：半透玻璃 + 薄荷绿点缀 */
.preview-card.pv-glass { border-radius: 20px; border: 1px solid rgba(255,255,255,.12); background: linear-gradient(160deg,rgba(255,255,255,.09),rgba(255,255,255,.03)); backdrop-filter: blur(14px); box-shadow: 0 20px 50px -30px #000, inset 0 1px 0 rgba(255,255,255,.15); }
.pv-glass .preview-head { background: radial-gradient(900px 600px at 15% 0%,#173049 0%,#0b1622 55%,#060c13 100%) !important; border-radius: 0; }
.pv-glass .preview-avatar { border-radius: 16px; background: rgba(127,211,193,.12); color: #9ee8d5; box-shadow: inset 0 0 0 1px rgba(127,211,193,.4); }
.pv-glass .preview-body { color: #e8eef4; }
.pv-glass .preview-tags i { background: rgba(255,255,255,.07); color: #a8c3d6; box-shadow: inset 0 0 0 1px rgba(255,255,255,.1); }
/* D 暖木衬线：直角双层细框 + 衬线字体 */
.preview-card.pv-wood { border-radius: 4px; border: 1px solid #e4d8c6; background: #fffdf8; box-shadow: inset 0 0 0 5px #fffdf8, inset 0 0 0 6px #efe4d4, 0 20px 40px -30px rgba(90,64,40,.5); }
.pv-wood .preview-head { background: radial-gradient(circle at 20% 0%,#f6eee1 0%,#e8dbc8 60%,#ddcdb6 100%) !important; border-radius: 0; }
.pv-wood .preview-avatar { border-radius: 50%; background: #8b5e3c; color: #fff9ee; box-shadow: inset 0 0 0 3px rgba(255,255,255,.18); }
.pv-wood .preview-body { color: #3b2f24; font-family: "Songti SC","Noto Serif SC",serif; }
.pv-wood .preview-body b { font-size: 25px; font-weight: 600; letter-spacing: .16em; }
.pv-wood .preview-tags i { border-radius: 2px; background: #faf4e9; color: #7b6344; box-shadow: inset 0 0 0 1px #e3d5bf; }
/* E 霓虹夜景：粉紫冰蓝玻璃 + 渐变字 */
.preview-card.pv-neon { border-radius: 26px; border: 1px solid rgba(255,255,255,.16); background: linear-gradient(160deg,rgba(255,79,163,.13),rgba(79,216,255,.09),rgba(255,255,255,.03)); backdrop-filter: blur(16px); box-shadow: 0 0 50px -14px rgba(255,79,163,.55),inset 0 1px 0 rgba(255,255,255,.22); }
.pv-neon .preview-head { background: radial-gradient(760px 540px at 82% 0%,#3d1a72 0%,#190b32 46%,#08040f 100%) !important; border-radius: 0; }
.pv-neon .preview-avatar { border-radius: 50%; background: linear-gradient(135deg,#ff4fa3,#4fd8ff); color: #0a0416; box-shadow: 0 0 18px -4px rgba(255,79,163,.85); }
.pv-neon .preview-body { color: #ece7ff; }
.pv-neon .preview-body b { background: linear-gradient(115deg,#ffd3ea,#ff4fa3 45%,#4fd8ff); -webkit-background-clip: text; background-clip: text; color: transparent; }
.pv-neon .preview-tags i { background: rgba(255,255,255,.07); color: #c3b7ef; box-shadow: inset 0 0 0 1px rgba(255,255,255,.14); }
/* F 酸性荧光：黑底荧光绿直角硬投影 */
.preview-card.pv-acid { border-radius: 0; border: 1px solid #ccff00; background: #0a0a0a; box-shadow: 8px 8px 0 rgba(204,255,0,.9); }
.pv-acid .preview-head { background: #050505 !important; border-radius: 0; }
.pv-acid .preview-avatar { border-radius: 0; background: #ccff00; color: #000; }
.pv-acid .preview-body { color: #ccff00; }
.pv-acid .preview-tags i { background: transparent; color: #ccff00; box-shadow: inset 0 0 0 1px rgba(204,255,0,.5); border-radius: 0; }
/* G 多巴胺：厚描边 + 硬投影 */
.preview-card.pv-pop { border-radius: 26px; border: 3px solid #241b3a; background: #fff; box-shadow: 10px 10px 0 #ffd166; }
.pv-pop .preview-head { background: linear-gradient(165deg,#fff4e8,#ffe4f0 52%,#e8f0ff) !important; }
.pv-pop .preview-avatar { border-radius: 50%; background: #ff6b6b; color: #fff; border: 3px solid #241b3a; }
.pv-pop .preview-body { color: #241b3a; }
.pv-pop .preview-body b { font-weight: 900; }
.pv-pop .preview-tags i { border-radius: 99px; border: 2px solid #241b3a; color: #241b3a; }
/* H 杂志编辑：番茄红顶条 + 衬线大标题 */
.preview-card.pv-magazine { border-radius: 2px; border: 1px solid #ddd7c9; background: #faf8f3; box-shadow: 0 20px 40px -30px rgba(60,50,35,.5); }
.pv-magazine .preview-head { background: #f2efe9 !important; border-radius: 0; border-bottom: 8px solid #d1462f; }
.pv-magazine .preview-avatar { border-radius: 2px; background: #1a1a1a; color: #f2efe9; }
.pv-magazine .preview-body { color: #1a1a1a; font-family: "Songti SC","Noto Serif SC",serif; }
.pv-magazine .preview-body b { font-size: 26px; font-weight: 700; }
.pv-magazine .preview-tags i { border-radius: 0; background: transparent; color: #5c5850; box-shadow: inset 0 0 0 1px #cdc7b8; }
/* L1 竖版海报：无卡通栏巨字 */
.preview-card.pv-poster { background: transparent; border: 0; box-shadow: none; }
.pv-poster .preview-head { background: radial-gradient(900px 600px at 50% -8%,#22384d,#101d29 50%,#070d14) !important; border-radius: 0; }
.pv-poster .preview-avatar { display: none; }
.pv-poster .preview-body { background: transparent; color: #eef3f7; }
.pv-poster .preview-body b { font-size: 30px; font-weight: 900; letter-spacing: .16em; color: #fff; }
.pv-poster .preview-tags i { border-radius: 0; background: rgba(255,255,255,.07); color: #cfe0ee; box-shadow: inset 0 0 0 1px rgba(255,255,255,.12); }
/* L2 票据存根：锯齿边 + 等宽字 */
.preview-card.pv-ticket { border-radius: 0; border: 0; background: #fffefb; box-shadow: 0 20px 44px -26px rgba(0,0,0,.4); }
.pv-ticket .preview-head { background: #fffefb !important; border-radius: 0; border-bottom: 2px solid #232323; }
.pv-ticket .preview-avatar { display: none; }
.pv-ticket .preview-body { color: #232323; }
.pv-ticket .preview-body b { font-size: 22px; font-weight: 900; letter-spacing: .18em; font-family: ui-monospace,Menlo,monospace; }
.pv-ticket .preview-tags i { border-radius: 0; background: #f2f0ea; color: #555; }
/* L3 横版名片：左侧信息右侧色块 */
.preview-card.pv-horizontal { border-radius: 10px; border: 0; background: #fff; }
.pv-horizontal .preview-head { background: linear-gradient(90deg,#fff 0%,#fff 70%,#17222e 70%) !important; border-radius: 10px 10px 0 0; }
.pv-horizontal .preview-avatar { border-radius: 8px; background: rgba(23,34,46,.1); }
.pv-horizontal .preview-body { color: #17222e; }
.pv-horizontal .preview-tags i { border-radius: 2px; background: #f2f4f6; color: #5d6a78; }
/* L4 侧栏竖排：左侧色带 + 右对齐 */
.preview-card.pv-sidebar { border-radius: 2px; border: 0; background: linear-gradient(90deg,#2a2118 0%,#2a2118 26%,#fffdf9 26%); }
.pv-sidebar .preview-head { background: transparent !important; border-radius: 0; }
.pv-sidebar .preview-avatar { border-radius: 50%; background: #6b4a2e; color: #f7f3ec; }
.pv-sidebar .preview-body { color: #2a2118; text-align: right; font-family: "Songti SC",serif; }
.pv-sidebar .preview-body b { font-size: 22px; font-weight: 600; letter-spacing: .18em; }
.pv-sidebar .preview-tags { justify-content: flex-end; }
.pv-sidebar .preview-tags i { border-radius: 0; background: transparent; color: #7d6a52; box-shadow: inset 0 0 0 1px #e0d4c2; }
@media (max-width: 520px) { .tpl-list { grid-template-columns: 1fr; } }
</style>
