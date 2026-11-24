<template>
  <div class="page">
    <header class="topbar">
      <button class="back-btn" @click="finish">‹ 返回</button>
      <div class="spacer"></div>
      <button class="nav-menu-btn" aria-label="打开菜单" @click="openDrawer">☰</button>
      <span class="small muted">编辑资料 · 可随时离开，下次继续</span>
    </header>

    <div class="container wide" style="margin-top:18px">
      <div v-if="loadError" class="card card-pad" style="margin-bottom:14px;border-color:#fecaca;background:#fef2f2">
        <b style="color:#b91c1c">名片资料加载失败</b>
        <p class="small muted" style="margin:6px 0 12px">{{ loadError }}。为避免覆盖已有资料，保存已临时禁用。</p>
        <button class="btn btn-sm btn-primary" :disabled="loading" @click="loadCard">重新加载</button>
      </div>
      <div class="hint" style="margin-bottom:14px">
        🔒 <b>二维码永久不变</b>：以下任何资料修改都只影响展示内容，链接 <span class="mono">/c/{{ form.slug }}</span> 与二维码图案始终保持一致，印好的实体名片无需重做。
      </div>

      <div class="edit-layout">
        <!-- 分类导航：一次只显示一类，避免长表单吓跑用户 -->
        <nav class="edit-nav">
          <button v-for="s in sections" :key="s.key" :class="{ on: active === s.key, dirty: dirtySections[s.key] }" @click="active = s.key">
            <span class="nav-ico">{{ s.icon }}</span>
            <span class="nav-label">{{ s.label }}</span>
            <span v-if="dirtySections[s.key]" class="nav-dirty" title="有未保存修改"></span>
            <span v-else-if="s.done" class="nav-done">✓</span>
          </button>
        </nav>

        <div class="edit-content">
          <!-- ① 身份信息 -->
          <div v-show="active === 'identity'" class="card card-pad" id="focus-identity">
            <div class="section-title" style="margin-top:0">基本信息</div>
            <div class="avatar-row">
              <div class="avatar-preview">
                <img v-if="form.avatar" :src="form.avatar" alt="头像" />
                <span v-else>{{ (form.name || 'M').slice(0, 1) }}</span>
              </div>
              <div>
                <label class="btn btn-sm btn-ghost upload-btn">上传头像
                  <input type="file" accept="image/*" @change="e => upload(e, 'avatar')" />
                </label>
                <p class="small muted" style="margin-top:6px">建议正方形，jpg/png/webp，≤5MB</p>
              </div>
            </div>
            <div class="field">
              <label>公司 / 个人 LOGO <span class="muted small">（自动去底成透明 PNG）</span></label>
              <div v-if="form.logo" class="logo-current"><img :src="form.logo" alt="当前 LOGO" /><span>当前 LOGO · 重新上传可替换</span></div>
              <LogoUploader v-model="form.logo" />
            </div>
            <div class="grid2">
              <div class="field"><label>姓名 *</label><input v-model="form.name" class="input" maxlength="30" /></div>
              <div class="field"><label>英文名（选填）</label><input v-model="form.name_en" class="input" maxlength="40" /></div>
              <div class="field"><label>职位</label><input v-model="form.title" class="input" maxlength="60" /></div>
              <div class="field"><label>公司</label><input v-model="form.company" class="input" maxlength="60" /></div>
              <div class="field"><label>部门</label><input v-model="form.department" class="input" maxlength="40" /></div>
            </div>
            <div class="section-foot">
              <span class="save-state" :class="{ saved: savedSections.identity }">{{ savedSections.identity ? '✓ 已保存' : '未保存' }}</span>
              <button class="btn btn-sm btn-primary" :disabled="saving" @click="saveSection('identity')">{{ saving ? '保存中…' : '保存本节' }}</button>
            </div>
          </div>

          <!-- ② 简介与标签 -->
          <div v-show="active === 'bio'" class="card card-pad" id="focus-bio">
            <div class="section-title" style="margin-top:0">简介与标签</div>
            <p class="small muted" style="margin-bottom:12px">一句话介绍，让对方快速知道你是谁、做什么。</p>
            <div class="field"><label>个人简介</label><textarea v-model="form.bio" class="textarea" maxlength="600" placeholder="一句话介绍自己，展示在名片首页"></textarea></div>
            <div class="field"><label>公司简介</label><textarea v-model="form.company_intro" class="textarea" maxlength="1000" placeholder="介绍公司业务、优势与服务，展示在名片「公司简介」区块，并写入通讯录备注"></textarea></div>
            <div class="field"><label>标签（逗号分隔，最多 8 个）</label><input v-model="tagsText" class="input" placeholder="品牌顾问, 设计, 马拉松" /></div>
            <div class="section-foot">
              <span class="save-state" :class="{ saved: savedSections.bio }">{{ savedSections.bio ? '✓ 已保存' : '未保存' }}</span>
              <button class="btn btn-sm btn-primary" :disabled="saving" @click="saveSection('bio')">{{ saving ? '保存中…' : '保存本节' }}</button>
            </div>
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
              <label>所在地区 <span class="muted small">（省 / 市 / 区 / 街道，可选到任意一级）</span></label>
              <div class="locate-row">
                <span class="small region-path">{{ regionPath || '未选择' }}</span>
                <button class="btn btn-sm btn-ghost" :disabled="loading" @click="regionOpen = true">⌖ 选择地区</button>
                <button class="btn btn-sm btn-ghost" :disabled="geoBusy || loading" @click="autoLocateAddress">{{ geoBusy ? '定位中…' : '◎ 自动定位' }}</button>
              </div>
            </div>
            <div class="field"><label>地址（用于一键导航）</label><input v-model="form.address" class="input" placeholder="街道门牌，越详细导航越准" /></div>
            <div class="field"><label>门牌 / 楼层补充</label><input v-model="form.address_detail" class="input" /></div>
            <div class="section-foot">
              <span class="save-state" :class="{ saved: savedSections.contact }">{{ savedSections.contact ? '✓ 已保存' : '未保存' }}</span>
              <button class="btn btn-sm btn-primary" :disabled="saving" @click="saveSection('contact')">{{ saving ? '保存中…' : '保存本节' }}</button>
            </div>
          </div>

          <!-- ⑥ 名片集市 -->
          <div v-show="active === 'market'" class="card card-pad">
            <div class="section-title" style="margin-top:0">名片集市 <span class="small muted">· 按距离发现业务对口</span></div>
            <p class="small muted" style="margin-bottom:12px">开启后，你的名片会出现在名片集市，附近及同行业的人可按距离找到你。仅展示姓名、职位、公司、行业、城市与简介，联系方式不会公开；可随时关闭下架。</p>
            <div class="field"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" v-model="form.market_opt_in" /> 加入名片集市（主动上架）</label></div>
            <div class="grid2">
              <div class="field"><label>所属行业</label>
                <select v-model="form.industry" class="input">
                  <option value="">未选择</option>
                  <option v-for="ind in marketMeta.industries" :key="ind.key" :value="ind.key">{{ ind.label }}</option>
                </select>
              </div>
              <div class="field"><label>所在城市</label>
                <select :value="form.city" class="input" @change="e => pickCity(e.target.value)">
                  <option value="">未选择</option>
                  <option v-for="c in marketMeta.cities" :key="c.name" :value="c.name">{{ c.name }}</option>
                </select>
              </div>
            </div>
            <div class="field">
              <label>定位坐标 <span class="muted small">（四级定位：微信/GPS → IP → 城市兜底；用于按距离排序）</span></label>
              <div class="locate-row">
                <span class="small mono">{{ form.latitude != null ? form.latitude.toFixed(4) : '—' }}, {{ form.longitude != null ? form.longitude.toFixed(4) : '—' }}</span>
                <span v-if="positionSource" class="badge small" :class="qualityClass">{{ sourceLabel }}</span>
                <button class="btn btn-sm btn-ghost" @click="mapOpen = true">🗺 地图选点</button>
                <button class="btn btn-sm btn-ghost" :disabled="locating" @click="locateMe">{{ locating ? '定位中…' : '⌖ 重新定位' }}</button>
              </div>
            </div>
            <p v-if="form.market_opt_in && form.latitude == null" class="small" style="color:#b45309">已开启上架但尚无坐标，请选地区或精确定位，否则在集市中会排在末尾。</p>
            <div class="section-foot">
              <span class="save-state" :class="{ saved: savedSections.market }">{{ savedSections.market ? '✓ 已保存' : '未保存' }}</span>
              <button class="btn btn-sm btn-primary" :disabled="saving" @click="saveSection('market')">{{ saving ? '保存中…' : '保存本节' }}</button>
            </div>
          </div>

          <!-- ④ 二维码 -->
          <div v-show="active === 'qr'" class="card card-pad" id="focus-qr">
            <div class="section-title" style="margin-top:0">加好友 / 收付款二维码</div>
            <p class="small muted" style="margin-bottom:12px">上传微信 / 支付宝的「加好友码」或「收款码」原图，访客在自己常用的 App 环境里可长按识别或保存后扫码。请只上传自己本人的二维码。</p>
            <div v-for="q in qrFields" :key="q.key" class="qr-upload-row">
              <div v-if="form[q.key]" class="qr-thumb"><img :src="form[q.key]" :alt="q.label" /></div>
              <div class="qr-upload-info">
                <b>{{ q.label }}</b>
                <label class="btn btn-sm btn-ghost upload-btn">{{ form[q.key] ? '更换' : '上传' }}
                  <input type="file" accept="image/*" @change="e => upload(e, q.key)" />
                </label>
              </div>
            </div>
            <div class="section-foot">
              <span class="save-state" :class="{ saved: savedSections.qr }">{{ savedSections.qr ? '✓ 已保存' : '未保存' }}</span>
              <button class="btn btn-sm btn-primary" :disabled="saving" @click="saveSection('qr')">{{ saving ? '保存中…' : '保存本节' }}</button>
            </div>
          </div>

          <!-- ⑤ 更多链接 -->
          <div v-show="active === 'links'" class="card card-pad" id="focus-links">
            <div class="section-title" style="margin-top:0">更多链接</div>
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
            <div class="section-foot">
              <span class="save-state" :class="{ saved: savedSections.links }">{{ savedSections.links ? '✓ 已保存' : '未保存' }}</span>
              <button class="btn btn-sm btn-primary" :disabled="saving" @click="saveSection('links')">{{ saving ? '保存中…' : '保存本节' }}</button>
            </div>
          </div>

          <!-- ⑦ 外观（模板 + 主题） -->
          <div v-show="active === 'appearance'" class="card card-pad">
            <div class="section-title" style="margin-top:0">展示模板</div>
            <p class="small muted" style="margin-bottom:10px">模板决定名片排版结构，主题风格决定配色，两者可自由搭配。</p>
            <div class="tpl-list">
              <button v-for="tpl in templates" :key="tpl.key" class="tpl-item" :class="{ on: form.template === tpl.key }" @click="form.template = tpl.key">
                <span class="tpl-thumb" :style="{ background: tpl.cover }">
                  <i class="tpl-ava" :class="'ava-' + tpl.key"></i>
                </span>
                <b>{{ tpl.label }}</b>
                <span class="tpl-desc">{{ tpl.desc }}</span>
                <span v-if="form.template === tpl.key" class="tpl-check">✓ 使用中</span>
              </button>
            </div>
            <div v-if="!templates.length" class="small muted">模板列表加载中，请稍候…</div>
          </div>

          <div v-show="active === 'appearance'" class="card card-pad" style="margin-top:14px">
            <div class="section-title" style="margin-top:0">主题风格与二维码</div>
            <div class="field"><label>主题风格</label>
              <div class="theme-list">
                <button v-for="(v, k) in THEMES" :key="k" class="theme-item" :class="{ on: form.theme === k }" @click="chooseTheme(k)">
                  <i :style="{ background: v.cover }"></i><span>{{ v.label }}</span>
                </button>
              </div>
            </div>
            <div class="grid2">
              <div class="field"><label>强调色</label><input v-model="form.accent" type="color" class="color-input" /></div>
              <div class="field"><label>二维码颜色</label><input v-model="form.qr_fg" type="color" class="color-input" /></div>
              <div class="field"><label>二维码背景</label><input v-model="form.qr_bg" type="color" class="color-input" /></div>
              <div class="field"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" v-model="form.qr_logo" /> 二维码中心 Logo</label></div>
            </div>
            <p class="small muted">提示：二维码颜色请保持足够对比度（深色码 + 浅色底），否则可能扫不出来。</p>
            <div class="section-foot">
              <span class="save-state" :class="{ saved: savedSections.appearance }">{{ savedSections.appearance ? '✓ 已保存' : '未保存' }}</span>
              <button class="btn btn-sm btn-primary" :disabled="saving" @click="saveSection('appearance')">{{ saving ? '保存中…' : '保存本节' }}</button>
            </div>
          </div>

          <div class="done-bar">
            <span class="small muted">资料可以慢慢完善，每次只保存当前分类即可。</span>
            <button class="btn btn-primary" :disabled="saving || loadError || !loaded" @click="finish">完成，返回名片</button>
          </div>
        </div>

        <aside class="preview-panel">
          <div class="card card-pad">
            <div class="section-title" style="margin-top:0">实时预览</div>
            <div class="preview-card" :class="'pv-' + form.template">
              <div class="preview-head" :style="{ background: THEMES[form.theme]?.cover }">
                <div class="preview-avatar">{{ (form.name || 'M').slice(0, 1) }}</div>
              </div>
              <div class="preview-body">
                <b>{{ form.name || '你的姓名' }}</b>
                <span class="small muted">{{ [form.title, form.company].filter(Boolean).join(' · ') || '职位 · 公司' }}</span>
                <div class="preview-tags"><i v-for="t in tagList.slice(0,3)" :key="t">{{ t }}</i></div>
              </div>
            </div>
            <img :src="previewQr" class="preview-qr" alt="二维码预览" />
            <p class="small muted center">扫码地址固定为 <span class="mono">/c/{{ form.slug }}</span></p>
          </div>
        </aside>
      </div>
    </div>

    <!-- 省市区街道级联选择 -->
    <div v-if="regionOpen" class="map-mask" @click.self="regionOpen = false">
      <div class="map-modal">
        <div class="map-modal-head">
          <b>选择所在地区</b>
          <button class="btn btn-sm btn-ghost" @click="regionOpen = false">关闭</button>
        </div>
        <RegionPicker
          :province="form.province" :city="form.city" :district="form.district" :street="form.street"
          @confirm="onRegionPicked"
        />
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
          :lat="form.latitude || 39.9042"
          :lng="form.longitude || 116.4074"
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
import { showToast, openDrawer } from '../store'
import { THEMES } from '../utils/themes'
import { refreshPosition, setManualPosition, reverseGeocode, geocode } from '../utils/geo'
import LogoUploader from '../components/LogoUploader.vue'

const MapPicker = defineAsyncComponent(() => import('../components/MapPicker.vue'))
const RegionPicker = defineAsyncComponent(() => import('../components/RegionPicker.vue'))

const router = useRouter()
const route = useRoute()
const blank = {
  slug: '', name: '', name_en: '', title: '', company: '', company_intro: '', department: '', website: '', shop_url: '',
  mobile: '', phone: '', email: '', wechat: '', alipay: '', whatsapp: '',
  wechat_qr: '', alipay_qr: '', wechat_pay_qr: '', alipay_pay_qr: '',
  address: '', address_detail: '', province: '', city: '', district: '', street: '',
  avatar: '', logo: '', bio: '', tags: [], links: [], template: 'classic', theme: 'ocean', accent: THEMES.ocean.accent,
  industry: '', city: '', latitude: null, longitude: null, market_opt_in: false,
  qr_fg: '#0f172a', qr_bg: '#ffffff', qr_logo: true
}
const form = ref({ ...blank })
const active = ref('identity')
const sections = computed(() => [
  { key: 'identity', label: '身份信息', icon: '👤', done: !!(form.value.name && (form.value.title || form.value.company)) },
  { key: 'bio', label: '简介与标签', icon: '📝', done: !!(form.value.bio || form.value.company_intro || tagList.value.length) },
  { key: 'contact', label: '联系方式', icon: '📞', done: !!(form.value.mobile || form.value.phone || form.value.email || form.value.wechat || form.value.address) },
  { key: 'qr', label: '二维码', icon: '▦', done: !!(form.value.wechat_qr || form.value.alipay_qr || form.value.wechat_pay_qr || form.value.alipay_pay_qr) },
  { key: 'links', label: '更多链接', icon: '🔗', done: !!(form.value.website || form.value.shop_url || form.value.links?.length) },
  { key: 'market', label: '名片集市', icon: '🧭', done: !!form.value.market_opt_in },
  { key: 'appearance', label: '外观风格', icon: '🎨', done: true }
])
const templates = ref([])
const marketMeta = ref({ industries: [], cities: [] })
const locating = ref(false)
const geoBusy = ref(false)
const mapOpen = ref(false)
const regionOpen = ref(false)
const positionSource = ref('')   // wechat/gps/ip/default/manual，来自四级定位
const positionQuality = ref('')  // precise/approximate/coarse
const regionPath = computed(() => [form.value.province, form.value.city, form.value.district, form.value.street].filter(Boolean).join(' / '))
const qualityClass = computed(() => ({ precise: 'ok', approximate: 'warn', coarse: 'off' }[positionQuality.value] || 'off'))
const sourceLabel = computed(() => ({
  wechat: '微信定位', gps: 'GPS 定位', ip: 'IP 定位', default: '城市兜底', manual: '手动选点'
}[positionSource.value] || '已定位'))
const qrFields = [
  { key: 'wechat_qr', label: '微信 · 加好友码' },
  { key: 'alipay_qr', label: '支付宝 · 加好友码' },
  { key: 'wechat_pay_qr', label: '微信 · 收款码' },
  { key: 'alipay_pay_qr', label: '支付宝 · 收款码' }
]
const tagsText = ref('')
const saving = ref(false)
const loading = ref(false)
const loaded = ref(false)
const loadError = ref('')
const tagList = computed(() => tagsText.value.split(/[,，]/).map(s => s.trim()).filter(Boolean).slice(0, 8))
const previewQr = computed(() => `/api/cards/public/${form.value.slug}/qr.svg?size=320&brand=M`)

async function loadCard() {
  if (loading.value) return
  loading.value = true
  loadError.value = ''
  try {
    const { data } = await api.get('/api/cards/mine')
    if (!data.data) { showToast('请先创建名片', 'error'); return router.push('/me') }
    form.value = { ...blank, ...data.data, qr_logo: !!data.data.qr_logo }
    tagsText.value = (data.data.tags || []).join(', ')
    loaded.value = true
    dirtySections.value = {}
    formReady = true
  } catch (e) {
    loadError.value = e.message || '网络异常'
  } finally { loading.value = false }
}

onMounted(async () => {
  loadTemplates()
  loadMarketMeta()
  await loadCard()
  applyFocus()
})

// 从抽屉/板块入口带 focus 进来时切到对应分类。
// 用 watch 监听 query：用户已在编辑页时，点「模板与配色」等只改 query、组件不重新挂载，
// 必须在 query 变化时也切换，否则点了没反应。
function applyFocus() {
  const focus = String(route.query.focus || '')
  if (['identity', 'bio', 'contact', 'qr', 'links', 'market', 'appearance'].includes(focus)) active.value = focus
}
watch(() => route.query.focus, () => applyFocus())

async function loadTemplates() {
  try {
    const { data } = await api.get('/api/cards/public/templates')
    templates.value = data.data?.templates || []
  } catch { /* 模板清单拉取失败时用兜底，保证选择器可用 */ }
}

async function loadMarketMeta() {
  try {
    const { data } = await api.get('/api/cards/public/market/meta')
    marketMeta.value = data.data
  } catch { /* 集市元数据失败不影响资料编辑 */ }
}

function pickCity(name) {
  form.value.city = name
  const hit = (marketMeta.value.cities || []).find(c => c.name === name)
  if (hit) { form.value.latitude = hit.lat; form.value.longitude = hit.lng }
}

// 四级定位主入口（微信/GPS → IP → 城市兜底），成功后逆地理回填省市区
async function locateMe() {
  if (locating.value) return
  locating.value = true
  try {
    const pos = await refreshPosition(form.value.city || undefined)
    form.value.latitude = pos.lat
    form.value.longitude = pos.lng
    positionSource.value = pos.source || ''
    positionQuality.value = pos.quality || ''
    if (!form.value.city && pos.city) form.value.city = pos.city
    if (pos.source !== 'default' && !form.value.district) {
      const addr = await reverseGeocode(pos.lat, pos.lng)
      if (addr) {
        if (!form.value.province) form.value.province = addr.province || ''
        if (!form.value.city) form.value.city = addr.city || ''
        if (!form.value.district) form.value.district = addr.district || ''
        if (!form.value.street) form.value.street = addr.street || ''
      }
    }
    showToast(pos.source === 'default' ? '已用城市中心坐标兜底，可再精确选点' : '定位成功，记得点保存', pos.source === 'default' ? 'error' : 'success')
  } catch (e) {
    showToast(e.message || '定位失败，请手动选点', 'error')
  } finally { locating.value = false }
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

function chooseTheme(k) {
  form.value.theme = k
  form.value.accent = THEMES[k].accent
}

async function upload(e, field) {
  const file = e.target.files?.[0]
  if (!file) return
  const fd = new FormData()
  fd.append('file', file)
  try {
    const { data } = await api.post('/api/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    form.value[field] = data.data.url
    showToast('上传成功，记得点保存', 'success')
  } catch (err) { showToast(err.message, 'error') }
  e.target.value = ''
}

// 每类字段清单：保存时只提交当前分类，真正实现「填一类存一类」的渐进式完善
const SECTION_FIELDS = {
  identity: ['name', 'name_en', 'title', 'company', 'department', 'avatar', 'logo'],
  bio: ['bio', 'company_intro', 'tags'],
  contact: ['mobile', 'phone', 'email', 'wechat', 'alipay', 'whatsapp', 'province', 'city', 'district', 'street', 'address', 'address_detail'],
  qr: ['wechat_qr', 'alipay_qr', 'wechat_pay_qr', 'alipay_pay_qr'],
  links: ['website', 'shop_url', 'links'],
  market: ['market_opt_in', 'industry', 'province', 'city', 'district', 'latitude', 'longitude'],
  appearance: ['template', 'theme', 'accent', 'qr_fg', 'qr_bg', 'qr_logo']
}
const savedSections = ref({})
const dirtySections = ref({})

async function saveSection(key) {
  if (saving.value || loadError.value || !loaded.value) return
  const fields = SECTION_FIELDS[key] || []
  if (key === 'identity' && !form.value.name) return showToast('请填写姓名', 'error')
  saving.value = true
  try {
    const payload = {}
    for (const f of fields) payload[f] = form.value[f]
    if (fields.includes('tags')) payload.tags = tagList.value
    if (fields.includes('links')) payload.links = form.value.links.filter(l => l.label || l.url)
    await api.put('/api/cards/mine', payload)
    savedSections.value = { ...savedSections.value, [key]: Date.now() }
    dirtySections.value = { ...dirtySections.value, [key]: false }
    showToast('已保存，可继续完善其它资料', 'success')
  } catch (e) { showToast(e.message, 'error') } finally { saving.value = false }
}

// 自动追踪「当前分类有未保存修改」：加载完成前不追踪，避免初始化误标脏
let formReady = false
const markActiveDirty = () => {
  if (!formReady) return
  dirtySections.value = { ...dirtySections.value, [active.value]: true }
}
watch(form, markActiveDirty, { deep: true, flush: 'sync' })
watch(tagsText, markActiveDirty, { flush: 'sync' })

async function finish() {
  const dirty = Object.keys(dirtySections.value).filter(k => dirtySections.value[k])
  if (dirty.length) return showToast('有未保存的修改，请先保存对应分类', 'error')
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
.back-btn { font-size: 16px; color: var(--primary); padding: 4px 8px; margin-left: -8px; }
@media (max-width: 1080px) { .edit-layout { grid-template-columns: 168px minmax(0, 1fr); } .preview-panel { display: none; } }
@media (max-width: 720px) {
  .edit-layout { grid-template-columns: 1fr; }
  .edit-nav { position: static; flex-direction: row; overflow-x: auto; white-space: nowrap; border-radius: 10px; padding: 6px; }
  .edit-nav button { width: auto; flex: 0 0 auto; padding: 8px 12px; }
  .nav-ico { display: none; }
}
.avatar-row { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
.logo-current { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; font-size: 12px; color: var(--muted); }
.logo-current img { width: 48px; height: 48px; object-fit: contain; border: 1px solid var(--line); border-radius: 10px; background: #fff; padding: 4px; }
.avatar-preview { width: 64px; height: 64px; border-radius: 16px; background: var(--primary); color: #fff; display: grid; place-items: center; font-size: 26px; font-weight: 800; overflow: hidden; }
.avatar-preview img { width: 100%; height: 100%; object-fit: cover; }
.upload-btn { position: relative; overflow: hidden; }
.upload-btn input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.qr-upload-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--line); }
.qr-upload-row:last-child { border-bottom: 0; }
.qr-thumb { width: 56px; height: 56px; border: 1px solid var(--line); border-radius: 8px; padding: 3px; background: #fff; flex-shrink: 0; }
.qr-thumb img { width: 100%; height: 100%; object-fit: contain; }
.qr-upload-info { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.qr-upload-info b { font-size: 13px; }
.locate-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.locate-row .mono { color: var(--muted); }
.region-path { color: var(--text); font-weight: 600; min-width: 120px; }
.map-mask { position: fixed; inset: 0; background: rgba(15,23,42,.55); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 16px; }
.map-modal { width: 100%; max-width: 680px; background: var(--bg-card, #fff); border-radius: 14px; padding: 14px; box-shadow: 0 20px 60px rgba(0,0,0,.25); }
.map-modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.link-row { display: grid; grid-template-columns: 1fr 1.5fr auto; gap: 8px; margin-bottom: 8px; }
.theme-list { display: flex; flex-wrap: wrap; gap: 8px; }
.theme-item { border: 1px solid var(--line); border-radius: 10px; padding: 6px; display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 11px; }
.theme-item.on { border-color: var(--primary); box-shadow: 0 0 0 2px rgba(37,99,235,.12); }
.theme-item i { width: 44px; height: 26px; border-radius: 6px; display: block; }
.color-input { width: 100%; height: 40px; padding: 3px; border: 1px solid var(--line); border-radius: 10px; background: #fff; }
.preview-panel { position: sticky; top: 72px; }
.preview-card { border-radius: 14px; overflow: hidden; border: 1px solid var(--line); }
.preview-head { height: 76px; position: relative; }
.preview-avatar { position: absolute; left: 14px; bottom: -20px; width: 42px; height: 42px; border-radius: 12px; background: #fff; color: var(--primary); display: grid; place-items: center; font-weight: 800; font-size: 18px; }
.preview-body { padding: 26px 14px 14px; display: flex; flex-direction: column; gap: 2px; }
.preview-tags { display: flex; gap: 4px; margin-top: 6px; flex-wrap: wrap; }
.preview-tags i { font-style: normal; font-size: 10px; padding: 2px 7px; border-radius: 999px; background: #eff6ff; color: #2563eb; }
.preview-qr { width: 120px; height: 120px; margin: 14px auto 8px; border: 1px solid var(--line); padding: 6px; border-radius: 10px; }

/* 模板选择器 */
.tpl-list { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.tpl-item { position: relative; border: 1px solid var(--line); border-radius: 14px; padding: 10px; text-align: left; display: flex; flex-direction: column; gap: 4px; transition: border-color .18s, box-shadow .18s, transform .18s; }
.tpl-item:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(15,23,42,.08); }
.tpl-item.on { border-color: var(--primary); box-shadow: 0 0 0 2px rgba(37,99,235,.16); }
.tpl-thumb { display: block; height: 54px; border-radius: 9px; position: relative; overflow: hidden; }
.tpl-ava { position: absolute; width: 30px; height: 30px; left: 12px; bottom: -8px; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,.2); }
.ava-classic { border-radius: 8px; }
.ava-minimal { border-radius: 50%; left: 50%; transform: translateX(-50%); background: #e2e8f0; }
.ava-elite { border-radius: 50%; left: 50%; transform: translateX(-50%); width: 34px; height: 34px; border: 2px solid #c9a227; }
.ava-vivid { border-radius: 12px; width: 34px; height: 34px; background: #fff; }
.ava-seal { border-radius: 3px; width: 34px; height: 34px; border: 3px solid #93c5fd; }
.ava-contact { border-radius: 3px; width: 34px; height: 34px; border: 2px solid #1e40af; background: #eff4ff; }
.ava-navygold { border-radius: 8px; width: 34px; height: 34px; border: 2px solid var(--ng-gold); background: var(--ng-paper); }
.tpl-item b { font-size: 13px; }
.tpl-desc { font-size: 11px; color: var(--muted); line-height: 1.45; min-height: 30px; }
.tpl-check { font-size: 11px; color: var(--primary); font-weight: 700; }

/* 预览卡跟随模板形态 */
.pv-minimal .preview-head { height: 44px; background: #eef2f7 !important; }
.pv-minimal .preview-avatar { border-radius: 50%; background: var(--primary); }
.pv-elite .preview-avatar { border-radius: 50%; left: 50%; transform: translateX(-50%); border: 2px solid #c9a227; }
.pv-elite .preview-body { text-align: center; align-items: center; }
.preview-card.pv-vivid, .pv-vivid .preview-head { border-radius: 18px; }
.pv-vivid .preview-avatar { border-radius: 12px; }
.pv-seal .preview-card { border-radius: 3px; border: 2px solid #1e3a8a; }
.pv-seal .preview-head { background: #12213c !important; border-radius: 0; }
.pv-seal .preview-avatar { border-radius: 3px; border: 2px solid #93c5fd; background: #12213c; }
.pv-seal .preview-body { color: #12213c; }
.pv-contact { border-radius: 12px; border: 2px solid #1e40af; }
.pv-contact .preview-head { background: linear-gradient(135deg,#0b1a3a 0%,#1e40af 58%,#3b82f6 100%) !important; }
.pv-contact .preview-avatar { border-radius: 6px; border: 2px solid #fff; background: #eff4ff; color: #1e40af; }
.pv-contact .preview-body { color: #0f2147; }
.pv-contact .preview-tags i { border-radius: 3px; border: 1px solid #1e40af; background: #eff4ff; }
/* 深蓝鎏金 navygold：金线封顶 + 深蓝封面 + 纸色标签 */
.preview-card.pv-navygold { border-radius: 22px; border: 2px solid var(--ng-gold); overflow: hidden; }
.pv-navygold .preview-head { background: linear-gradient(135deg, var(--ng-navy) 0%, var(--ng-navy-2) 40%, var(--ng-gold-2) 78%, var(--ng-gold) 100%) !important; }
.pv-navygold .preview-avatar { border-radius: 8px; background: var(--ng-paper); color: var(--ng-navy); box-shadow: inset 0 0 0 2px var(--ng-gold); }
.pv-navygold .preview-body { color: var(--ng-ink); }
.pv-navygold .preview-tags i { border-radius: 99px; background: var(--ng-paper); color: #6b5a3c; box-shadow: inset 0 0 0 1px rgba(185,147,85,.35); }
@media (max-width: 520px) { .tpl-list { grid-template-columns: 1fr; } }
</style>
