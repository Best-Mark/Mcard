<template>
  <view class="page">
    <view class="notice">🔒 改资料不会改变二维码，已印刷的名片无需重做。链接固定为 /c/{{ form.slug }}</view>

    <view class="body">
      <view class="card">
        <view class="section">基本信息</view>
        <view class="muted small" style="margin-bottom:16rpx">名片头像与账号头像相互独立：这里设置的是名片上展示的照片；账号头像在「我的 → 账号资料」中更换。</view>
        <view class="field">
          <text class="label">名片头像</text>
          <view v-if="form.avatar" class="logo-current"><image :src="form.avatar" mode="aspectFill" /><text class="muted small">当前名片头像 · 重新上传可替换</text></view>
          <button class="btn tiny" :disabled="avatarBusy" @tap="chooseAvatar">{{ avatarBusy ? '上传中…' : '上传名片头像' }}</button>
        </view>
        <view class="field">
          <text class="label">公司 LOGO（自动去透明底）</text>
          <view v-if="form.logo" class="logo-current">
            <image :src="form.logo" mode="aspectFit" />
            <text class="muted small">当前 LOGO · 重新上传可替换</text>
          </view>
          <button class="btn tiny" :disabled="logoBusy" @tap="chooseLogo">{{ logoBusy ? '处理中…' : '上传 LOGO 并自动去底' }}</button>
          <block v-if="logoProcessed">
            <picker :range="logoModeLabels" :value="logoModeIdx" @change="onLogoMode">
              <view class="picker">去底方式：{{ logoModeLabels[logoModeIdx] }}（点击切换）</view>
            </picker>
            <view v-if="logoMode !== 'none'" class="slider-label">去底强度 {{ logoTolerance }}</view>
            <slider v-if="logoMode !== 'none'" :value="logoTolerance" min="0" max="90" activeColor="#a62b2b" @change="onLogoTolerance" />
            <image class="logo-preview" :src="logoProcessed" mode="aspectFit" />
            <view class="muted small">透明底已在服务端生成，可切换到「保留原图」对比</view>
            <button class="btn tiny primary" style="margin-top:12rpx" @tap="applyLogo">应用这张 LOGO</button>
          </block>
        </view>
        <view class="field"><text class="label">姓名 *</text><input v-model="form.name" class="input" placeholder="姓名" /></view>
        <view class="field"><text class="label">英文名</text><input v-model="form.name_en" class="input" /></view>
        <view class="field"><text class="label">职位</text><input v-model="form.title" class="input" /></view>
        <view class="field"><text class="label">公司</text><input v-model="form.company" class="input" /></view>
        <view class="field"><text class="label">部门</text><input v-model="form.department" class="input" /></view>
        <view class="field"><text class="label">公司主页 URL</text><input v-model="form.website" class="input" placeholder="https://" /></view>
        <view class="field"><text class="label">店铺 URL</text><input v-model="form.shop_url" class="input" placeholder="https:// 淘宝 / 抖音 / 微店等" /></view>
        <!-- 简介只留一个字段 bio（与 H5 名片/打印/分享同口径）；存量 company_intro 在 loadCard 归一回 bio -->
        <view class="field"><text class="label">简介</text><textarea v-model="form.bio" class="textarea" maxlength="1000" placeholder="一句话介绍自己或公司业务，展示在名片「简介」区块" /></view>
        <view class="field"><text class="label">标签（逗号分隔）</text><input v-model="tagsText" class="input" placeholder="设计, 品牌" /></view>
      </view>

      <view class="card">
        <view class="section">联系方式</view>
        <view class="field"><text class="label">手机号</text><input v-model="form.mobile" class="input" inputmode="tel" /></view>
        <view class="field"><text class="label">座机</text><input v-model="form.phone" class="input" /></view>
        <view class="field"><text class="label">邮箱</text><input v-model="form.email" class="input" /></view>
        <view class="field"><text class="label">微信号</text><input v-model="form.wechat" class="input" /></view>
        <view class="field"><text class="label">支付宝账号</text><input v-model="form.alipay" class="input" /></view>
        <view class="field"><text class="label">WhatsApp</text><input v-model="form.whatsapp" class="input" /></view>
        <view class="field">
          <text class="label">所在地区（省 / 市 / 区，可选）</text>
          <view class="region-pickers">
            <picker :range="provinceNames" :value="provinceIdx" @change="onProvince">
              <view class="picker">{{ form.province || '省份' }} ▾</view>
            </picker>
            <picker :range="cityNames" :value="cityIdx" @change="onCity">
              <view class="picker">{{ form.city || '城市' }} ▾</view>
            </picker>
            <picker :range="districtNames" :value="districtIdx" @change="onDistrict">
              <view class="picker">{{ form.district || '区县' }} ▾</view>
            </picker>
          </view>
          <view class="region-auto">
            <text class="small muted">{{ [form.province, form.city, form.district, form.street].filter(Boolean).join(' ') || '未选择地区' }}</text>
            <button class="btn tiny" :disabled="geoBusy" @tap="autoLocateAddress">{{ geoBusy ? '定位中…' : '◎ 自动定位' }}</button>
          </view>
        </view>
        <view class="field"><text class="label">地址</text><input v-model="form.address" class="input" placeholder="街道门牌，越详细越好导航" /></view>
        <view class="field"><text class="label">门牌补充</text><input v-model="form.address_detail" class="input" /></view>
        <view class="field"><text class="label">位置定位 <text class="muted small">（用于精准导航；集市按距离排序）</text></text>
          <view class="locate-row">
            <button class="btn tiny" @tap="openMapPicker">🗺 地图选点</button>
            <button class="btn tiny" :disabled="locating" @tap="locateMe">{{ locating ? '定位中…' : '⌖ 精确定位' }}</button>
          </view>
        </view>
      </view>

      <!-- 公司相册：与 H5 CardEdit「公司相册」分节同口径（多图上传、缩略图网格、随保存提交 /mine/materials） -->
      <view class="card">
        <view class="section">公司相册</view>
        <view class="muted small" style="margin-bottom:16rpx">直接上传图片，访客点开名片即可浏览。最多 {{ GALLERY_MAX }} 张，上传后点底部「保存资料」生效。</view>
        <view class="gal-grid">
          <view v-for="(m, i) in materials" :key="i" class="gal-cell">
            <image :src="m.url" mode="aspectFill" />
            <text class="gal-del" @tap="materials.splice(i, 1)">×</text>
          </view>
          <view v-if="materials.length < GALLERY_MAX" class="gal-add" @tap="chooseGallery">
            <text>{{ galBusy ? '上传中…' : '＋ 上传' }}</text>
          </view>
        </view>
        <view class="muted small" style="margin-top:12rpx">已上传 {{ materials.length }} / {{ GALLERY_MAX }} 张</view>
      </view>

      <view class="card" id="market-card">
        <view class="section">名片集市 <text class="muted small"> · 让客户主动找到你，获取更多业务流量</text></view>
        <view v-if="!planActive" class="gate-tip" @tap="goPlans">上架集市需要开通套餐 · 点此去开通 / 续期 ›</view>
        <view class="muted small" style="margin-bottom:16rpx">开启后名片会出现在集市，附近及同行业的人可按距离/行业/关键词找到你，点开即可存入通讯录——相当于一个 7×24 小时的获客入口。仅展示姓名、职位、公司、行业、城市与简介，联系方式不公开；可随时关闭下架。</view>
        <view class="field"><text class="label">加入名片集市（主动上架）</text><switch :checked="form.market_opt_in" @change="e => form.market_opt_in = e.detail.value" /></view>
        <view class="field"><text class="label">所属行业</text>
          <picker :range="industryLabels" :value="industryIdx" @change="onIndustry">
            <view class="picker">{{ form.industry ? industryLabels[industryIdx] : '未选择' }} ▾</view>
          </picker>
        </view>
        <view class="muted small" style="margin-top:8rpx">上架展示的「地区 / 坐标」来自上方联系方式里填写的地址与定位，这里无需重复设置。</view>
      </view>

      <view class="card">
        <view class="section">更多链接</view>
        <view v-for="(l, i) in form.links" :key="i" class="link-row">
          <input v-model="l.label" class="input" placeholder="标题" />
          <input v-model="l.url" class="input" placeholder="https://" />
          <text class="del" @tap="form.links.splice(i, 1)">删</text>
        </view>
        <button class="btn tiny" @tap="form.links.push({ label: '', url: '' })">+ 添加链接</button>
      </view>

      <view class="card">
        <view class="section">展示模板</view>
        <view v-if="!planActive" class="gate-tip" @tap="goPlans">配色方案需要开通套餐 · 点此去开通 / 续期 ›</view>
        <view class="muted small" style="margin-bottom:16rpx">选模板即应用整套配色（含二维码色），无需逐项调；想微调可在下方「高级配色」里改。</view>
        <view class="tpl-list">
          <view v-for="tpl in templates" :key="tpl.key" class="tpl-item" :class="{ on: form.template === tpl.key }" @tap="chooseTemplate(tpl.key)">
            <view class="tpl-thumb" :class="'thumb-' + tpl.key">
              <view class="tpl-ava"></view>
            </view>
            <text class="tpl-name">{{ tpl.label }}</text>
            <text class="tpl-desc">{{ tpl.desc }}</text>
            <text v-if="form.template === tpl.key" class="tpl-check">✓ 使用中</text>
          </view>
        </view>
      </view>

      <view class="card" id="theme-card">
        <view class="adv-toggle" @tap="showAdvanced = !showAdvanced">
          <text>⚙️ 高级配色（选模板已自动配好，一般无需修改）</text>
          <text>{{ showAdvanced ? '▴' : '▾' }}</text>
        </view>
        <view v-if="showAdvanced">
        <view class="muted small" style="margin:8rpx 0 16rpx">当前配色来自模板「{{ currentTplLabel }}」，下面可单独微调。二维码请保持深码浅底，否则可能扫不出来。</view>
        <view class="field"><text class="label">强调色</text><input v-model="form.accent" class="input" placeholder="#a62b2b" /></view>
        <view class="field"><text class="label">二维码前景色</text><input v-model="form.qr_fg" class="input" placeholder="#2b2118" /></view>
        <view class="field"><text class="label">二维码背景色</text><input v-model="form.qr_bg" class="input" placeholder="#ffffff" /></view>
        <view class="muted small" style="margin:8rpx 0 16rpx">码点/码眼已固定为标准方点、中心 Logo 已移除（识别率优先），保证微信扫一扫与长按识别；可自定义的只剩码色（请保持深码浅底）。</view>
        </view>
      </view>

      <button class="btn primary block big" :disabled="saving" @tap="save">{{ saving ? '保存中…' : '保存资料' }}</button>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { api, toast, uploadImage, uploadLogo, processLogo, geoLocate, reverseGeocode, geocodeAddress, getRegions, ensurePrivacy } from '../../utils/request'

// ⚠️ 与 client/src/utils/themes.js 保持同步（小程序独立渲染，无 web-view）
const themes = {
  tang: { label: '唐红鎏金', accent: '#a62b2b' },
  ocean: { label: '经典蓝', accent: '#2563eb' },
  ink: { label: '曜石黑金', accent: '#b99355' },
  sunset: { label: '活力橙', accent: '#ea580c' },
  mint: { label: '翡翠绿', accent: '#0f766e' },
  royal: { label: '皇家紫', accent: '#7c3aed' },
  vanna: { label: '瓦纳蓝', accent: '#155a96' },
  phantom: { label: '幻影绿', accent: '#0f6b3f' },
  lava: { label: '熔岩灰', accent: '#c2410c' },
  star: { label: '星钻黑', accent: '#8a8aa0' },
  alas: { label: '阿拉斯红', accent: '#a01722' }
}
// ⚠️ 与 client/src/utils/themes.js 的 TEMPLATE_PALETTES 保持同步
const TEMPLATE_PALETTES = {
  tang: { theme: 'tang', qrFg: '#7a1e15', qrBg: '#f7ecd9' },
  vanna: { theme: 'vanna', qrFg: '#0c2a4d', qrBg: '#eaf2f9' },
  phantom: { theme: 'phantom', qrFg: '#052e1c', qrBg: '#e8f5ee' },
  lava: { theme: 'lava', qrFg: '#1a1a1e', qrBg: '#f1f1f2' },
  star: { theme: 'star', qrFg: '#12121a', qrBg: '#ececf2' },
  alas: { theme: 'alas', qrFg: '#4a0d14', qrBg: '#f9eaea' },
  classic: { theme: 'ocean', qrFg: '#12306b', qrBg: '#f2f7ff' },
  minimal: { theme: 'ocean', qrFg: '#2b2118', qrBg: '#ffffff' },
  elite: { theme: 'ink', qrFg: '#2b2417', qrBg: '#f2ead9' },
  vivid: { theme: 'royal', qrFg: '#7c3aed', qrBg: '#fff7ed' },
  seal: { theme: 'ocean', qrFg: '#2b2118', qrBg: '#ffffff' },
  contact: { theme: 'ink', qrFg: '#12202e', qrBg: '#ffffff' },
  navygold: { theme: 'ink', qrFg: '#1d3a55', qrBg: '#f7f1e3' },
  paper: { theme: 'ocean', qrFg: '#3f4a5a', qrBg: '#f7f6f3' },
  glass: { theme: 'mint', qrFg: '#0b2e2a', qrBg: '#eaf8f4' },
  wood: { theme: 'sunset', qrFg: '#5b3a1f', qrBg: '#f6eee1' },
  neon: { theme: 'royal', qrFg: '#3d1a72', qrBg: '#f3e9ff' },
  acid: { theme: 'mint', qrFg: '#0a0a0a', qrBg: '#dfff5e' },
  pop: { theme: 'sunset', qrFg: '#1a1a1a', qrBg: '#fff4e8' },
  magazine: { theme: 'sunset', qrFg: '#b91c1c', qrBg: '#f7f3ec' },
  poster: { theme: 'ink', qrFg: '#1d3a55', qrBg: '#ffffff' },
  ticket: { theme: 'ocean', qrFg: '#1f2937', qrBg: '#f7f5ee' },
  horizontal: { theme: 'ocean', qrFg: '#1d3a55', qrBg: '#eef1f4' },
  sidebar: { theme: 'sunset', qrFg: '#44291a', qrBg: '#f7f3ec' }
}
const paletteOf = key => TEMPLATE_PALETTES[key] || { theme: 'ocean', qrFg: '#2b2118', qrBg: '#ffffff' }
const DEFAULT_PAL = paletteOf('tang')
// 2026-11-27 识别率定稿：码点/码眼/预设/中心 Logo 的设置项已全部移除（渲染层收敛为标准方点、无 LOGO），
// 可自定义的只剩码色（qr_fg/qr_bg，深码浅底）。

const blank = {
  slug: '', name: '', name_en: '', title: '', company: '', company_intro: '', department: '',
  website: '', shop_url: '',
  bio: '', tags: [], links: [], avatar: '', logo: '', mobile: '', phone: '', email: '', wechat: '', alipay: '', whatsapp: '',
  address: '', address_detail: '', province: '', city: '', district: '', street: '',
  template: 'tang', theme: DEFAULT_PAL.theme, accent: themes[DEFAULT_PAL.theme].accent, qr_fg: DEFAULT_PAL.qrFg, qr_bg: DEFAULT_PAL.qrBg, qr_logo: false,
  qr_style: { dot: 'square', eye: 'square', gradTo: '', logoShape: 'rounded', bgImage: '' },
  industry: '', latitude: null, longitude: null, market_opt_in: false
}
const form = ref({ ...blank })
const tagsText = ref('')
const saving = ref(false)
// 公司相册：图片 URL 列表（内部映射成 card_materials 的 {type:'file',title,url}，保持 /mine/materials 契约）。
// 上限唯一真相源 = GALLERY_MAX，与 H5 CardEdit 同值（2026-11-26 用户口径：相册自己带上限）。
const GALLERY_MAX = 20
const materials = ref([])
const galBusy = ref(false)
// 套餐闸门：配色方案 + 上架集市需要有效套餐；加载时记录原值，保存时只在「改了」时拦截。
const planActive = ref(true)
const PLAN_GATED_KEYS = ['template', 'theme', 'accent', 'qr_fg', 'qr_bg', 'qr_logo', 'qr_style', 'market_opt_in']
const gatedOriginal = ref({})
const norm = v => typeof v === 'object' ? JSON.stringify(v || {}) : String(v ?? '')
const avatarBusy = ref(false)
// 模板清单是静态数据：模块级缓存让二次进入瞬时渲染，随后静默刷新
let templatesCache = []
const templates = ref(templatesCache)
const showAdvanced = ref(false)
const currentTplLabel = computed(() => templates.value.find(t => t.key === form.value?.template)?.label || form.value?.template || '默认')
const marketMeta = ref({ industries: [], cities: [] })
const locating = ref(false)
const geoBusy = ref(false)
const regions = ref([])
// 已有地区若不在下拉数据里（历史数据/地区改名），补进 range 紧跟「未选择」，避免 indexOf 落到 0 显示成未选择
const withCurrent = (names, current) => {
  if (current && !names.includes(current)) names.splice(1, 0, current)
  return names
}
const provinceNames = computed(() => withCurrent(['未选择', ...regions.value.filter(r => r.level === 1).map(r => r.name)], form.value.province))
const provinceIdx = computed(() => Math.max(0, provinceNames.value.indexOf(form.value.province || '未选择')))
const cityRegions = computed(() => {
  const p = regions.value.find(r => r.level === 1 && r.name === form.value.province)
  return p ? regions.value.filter(r => r.level === 2 && r.parent_code === p.code) : []
})
const cityNames = computed(() => withCurrent(
  cityRegions.value.length ? ['未选择', ...cityRegions.value.map(r => r.name)] : ['未选择', ...(marketMeta.value.cities || []).map(c => c.name)],
  form.value.city
))
const cityIdx = computed(() => Math.max(0, cityNames.value.indexOf(form.value.city || '未选择')))
const districtRegions = computed(() => {
  const c = regions.value.find(r => r.level === 2 && r.name === form.value.city && cityRegions.value.some(x => x.code === r.code))
  return c ? regions.value.filter(r => r.level === 3 && r.parent_code === c.code) : []
})
const districtNames = computed(() => withCurrent(['未选择', ...districtRegions.value.map(r => r.name)], form.value.district))
const districtIdx = computed(() => Math.max(0, districtNames.value.indexOf(form.value.district || '未选择')))
const industryLabels = computed(() => ['未选择', ...(marketMeta.value.industries || []).map(i => i.label)])
const industryIdx = computed(() => {
  const idx = (marketMeta.value.industries || []).findIndex(i => i.key === form.value.industry)
  return idx < 0 ? 0 : idx + 1
})

const logoOriginal = ref(''); const logoProcessed = ref('')
const logoMode = ref('auto'); const logoTolerance = ref(32); const logoBusy = ref(false)
const logoModes = ['auto', 'white', 'none']
const logoModeLabels = ['智能识别背景', '只去白底', '保留原图']
const logoModeIdx = ref(0)

onLoad(async options => {
  loadTemplates()
  loadMarketMeta()
  try {
    const c = await api.get('/api/cards/mine')
    if (!c) return uni.redirectTo({ url: '/pages/me/me' })
    form.value = { ...blank, ...c, qr_logo: !!c.qr_logo, qr_style: { ...blank.qr_style, ...(c.qr_style || {}) } }
    planActive.value = !!c.active
    gatedOriginal.value = Object.fromEntries(PLAN_GATED_KEYS.map(k => [k, norm(form.value[k])]))
    // 存量兼容（与 H5 CardEdit 同口径）：只填过 company_intro 的老名片归一到 bio，保存时写回 bio
    if (!form.value.bio && c.company_intro) form.value.bio = c.company_intro
    form.value.company_intro = ''
    tagsText.value = (c.tags || []).join(', ')
  } catch (e) { toast(e.message) }
  // 相册与资料互相独立：拉取失败不影响资料编辑，保存时一并提供
  try {
    const { data } = await api.get('/api/cards/mine/materials')
    materials.value = (data.data?.list || []).map(m => ({ type: m.type || 'file', title: m.title || '', url: m.url }))
  } catch { /* 相册拉取失败静默，保存时仍会以当前列表为准 */ }
  // 从「上架集市」入口进来：渲染后滚到集市卡片，直接看到上架开关
  if (options?.focus === 'market') {
    setTimeout(() => uni.createSelectorQuery().select('#market-card').boundingClientRect(rect => {
      if (rect) uni.pageScrollTo({ scrollTop: (rect.top || 0) - 20, duration: 300 })
    }).exec(), 120)
  }
  // 从名片页「配色风格」入口进来：展开高级区并滚到配色卡片
  if (options?.focus === 'theme') {
    showAdvanced.value = true
    setTimeout(() => uni.createSelectorQuery().select('#theme-card').boundingClientRect(rect => {
      if (rect) uni.pageScrollTo({ scrollTop: (rect.top || 0) - 20, duration: 300 })
    }).exec(), 150)
  }
  uni.$on('map-picked', onMapPicked)
})
// 二维码背景图上传已下线（渐变/背景图降低识别率，2026-11-26 收敛）
onUnmounted(() => { uni.$off('map-picked', onMapPicked) })

async function loadTemplates() {
  if (templatesCache.length) templates.value = templatesCache
  try {
    const r = await api.get('/api/cards/public/templates?t=' + Date.now(), false)
    if (r?.templates?.length) {
      templatesCache = r.templates
      templates.value = r.templates
    }
  } catch { /* 清单拉取失败时使用缓存，不影响保存 */ }
}

async function loadMarketMeta() {
  try { marketMeta.value = await api.get('/api/cards/public/market/meta', false) } catch {}
  try { regions.value = await getRegions() } catch {}
}

function onIndustry(e) {
  const idx = Number(e.detail.value)
  const ind = (marketMeta.value.industries || [])[idx - 1]
  form.value.industry = ind ? ind.key : ''
}
function onProvince(e) {
  const name = provinceNames.value[Number(e.detail.value)]
  form.value.province = (name && name !== '未选择') ? name : ''
  form.value.city = ''; form.value.district = ''; form.value.street = ''
  autoGeocodeRegion()
}
function onCity(e) {
  const name = cityNames.value[Number(e.detail.value)]
  form.value.city = (name && name !== '未选择') ? name : ''
  form.value.district = ''; form.value.street = ''
  const hit = (marketMeta.value.cities || []).find(c => c.name === form.value.city)
  if (hit) { form.value.latitude = hit.lat; form.value.longitude = hit.lng }
  else autoGeocodeRegion()
}
function onDistrict(e) {
  const name = districtNames.value[Number(e.detail.value)]
  form.value.district = (name && name !== '未选择') ? name : ''
  form.value.street = ''
  autoGeocodeRegion()
}
function autoGeocodeRegion() {
  const text = [form.value.province, form.value.city, form.value.district].filter(Boolean).join('')
  if (!text) return
  geocodeAddress(text, form.value.city).then(g => {
    if (g) { form.value.latitude = g.lat; form.value.longitude = g.lng }
  }).catch(() => {})
}
async function locateMe() {
  if (locating.value) return
  locating.value = true
  try {
    const pos = await geoLocate(form.value.city || '上海')
    form.value.latitude = pos.lat; form.value.longitude = pos.lng
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
    toast(pos.source === 'default' ? '已用城市中心坐标，可再精确选点' : '定位成功，记得保存', pos.source === 'default' ? 'none' : 'success')
  } catch (e) { toast(e.message || '定位失败，请改用地区选择', 'error') }
  finally { locating.value = false }
}
// 联系方式区自动定位回填省市区街道
async function autoLocateAddress() {
  if (geoBusy.value) return
  geoBusy.value = true
  try {
    const pos = await geoLocate(form.value.city || '上海')
    const addr = await reverseGeocode(pos.lat, pos.lng)
    if (!addr) return toast('坐标已获取，但地址解析失败，请用地图选点', 'none')
    form.value.province = addr.province || form.value.province
    form.value.city = addr.city || form.value.city
    form.value.district = addr.district || form.value.district
    form.value.street = addr.street || form.value.street
    if (!form.value.address) form.value.address = [addr.street, addr.district].filter(Boolean).join('')
    form.value.latitude = pos.lat; form.value.longitude = pos.lng
    toast('已填入所在地区，记得保存', 'success')
  } catch (e) { toast(e.message || '自动定位失败', 'error') }
  finally { geoBusy.value = false }
}
function openMapPicker() {
  uni.navigateTo({ url: `/pages/map-picker/map-picker?lat=${form.value.latitude || 39.9042}&lng=${form.value.longitude || 116.4074}` })
}
async function onMapPicked(p) {
  form.value.latitude = p.lat; form.value.longitude = p.lng
  const addr = await reverseGeocode(p.lat, p.lng)
  if (addr) {
    form.value.province = addr.province || form.value.province
    form.value.city = addr.city || form.value.city
    form.value.district = addr.district || form.value.district
    form.value.street = addr.street || form.value.street
  }
  toast('坐标已填入，记得保存', 'success')
}

function chooseTemplate(key) {
  const pal = paletteOf(key)
  form.value.template = key
  form.value.theme = pal.theme
  form.value.accent = themes[pal.theme].accent
  form.value.qr_fg = pal.qrFg
  form.value.qr_bg = pal.qrBg
  toast(`已应用「${currentTplLabel.value}」整套配色`, 'success')
}

async function chooseAvatar() {
  if (avatarBusy.value) return
  // 隐私守卫：选图属隐私接口，微信端先弹官方隐私授权（MShop 同款口径）
  if (!(await ensurePrivacy())) return toast('需要同意隐私授权才能选择图片')
  uni.chooseImage({ count: 1, sizeType: ['compressed'], success: async res => {
    avatarBusy.value = true
    try {
      form.value.avatar = await uploadImage(res.tempFilePaths[0])
      toast('名片头像已选，保存资料后生效', 'success')
    } catch (e) { toast(e.message || '上传失败') }
    finally { avatarBusy.value = false }
  } })
}
async function chooseLogo() {
  // 隐私守卫：选图属隐私接口，微信端先弹官方隐私授权（MShop 同款口径）
  if (!(await ensurePrivacy())) return toast('需要同意隐私授权才能选择图片')
  uni.chooseImage({ count: 1, sizeType: ['original'], success: async res => {
    logoBusy.value = true
    try {
      const r = await uploadLogo(res.tempFilePaths[0], logoMode.value, logoTolerance.value)
      logoOriginal.value = r.originalUrl
      logoProcessed.value = r.url
      toast(r.transparent ? '已生成透明底 LOGO' : 'LOGO 已处理', 'success')
    } catch (e) { toast(e.message) } finally { logoBusy.value = false }
  } })
}

async function onLogoMode(e) {
  logoModeIdx.value = Number(e.detail.value)
  logoMode.value = logoModes[logoModeIdx.value]
  if (logoOriginal.value) {
    logoBusy.value = true
    try { const r = await processLogo(logoOriginal.value, logoMode.value, logoTolerance.value); logoProcessed.value = r.url }
    catch (err) { toast(err.message) } finally { logoBusy.value = false }
  }
}

async function onLogoTolerance(e) {
  const v = Number(e.detail.value)
  if (v === logoTolerance.value) return
  logoTolerance.value = v
  if (!logoOriginal.value || logoMode.value === 'none') return
  logoBusy.value = true
  try { const r = await processLogo(logoOriginal.value, logoMode.value, v); logoProcessed.value = r.url }
  catch (err) { toast(err.message) } finally { logoBusy.value = false }
}

function applyLogo() {
  form.value.logo = logoProcessed.value
  toast('LOGO 已应用，保存资料后生效', 'success')
}

function goPlans() { uni.navigateTo({ url: '/pages/plans/plans' }) }

// 公司相册上传：多选、逐张串行上传（严格按选择顺序追加）、成对防重入（busy 守卫）；
// 达上限停止、单张失败提示但不中断整批（与 H5 CardEdit onGalleryUpload 同口径）
async function chooseGallery() {
  if (galBusy.value) return
  const room = GALLERY_MAX - materials.value.length
  if (room <= 0) return toast(`相册最多 ${GALLERY_MAX} 张`)
  // 隐私守卫：选图属隐私接口，微信端先弹官方隐私授权
  if (!(await ensurePrivacy())) return toast('需要同意隐私授权才能选择图片')
  uni.chooseImage({ count: Math.min(9, room), sizeType: ['compressed'], success: async res => {
    galBusy.value = true
    try {
      const paths = (res.tempFilePaths || []).slice(0, room)
      if ((res.tempFilePaths || []).length > room) toast(`最多 ${GALLERY_MAX} 张，本次只上传 ${room} 张`)
      for (const p of paths) {
        const url = await uploadImage(p)
        materials.value.push({ type: 'file', title: `图片 ${materials.value.length + 1}`, url })
      }
      toast('图片已上传，保存资料后生效', 'success')
    } catch (e) { toast(e.message || '上传失败') } finally { galBusy.value = false }
  } })
}

async function save() {
  if (!form.value.name) return toast('请填写姓名')
  // 套餐闸门：未开通/过期时改配色或开启上架，引导续期（关闭下架放行，与后端同口径）
  if (!planActive.value) {
    const gatedChanged = PLAN_GATED_KEYS.some(k => k === 'market_opt_in'
      ? (form.value[k] && norm(form.value[k]) !== gatedOriginal.value[k])
      : norm(form.value[k]) !== gatedOriginal.value[k])
    if (gatedChanged) {
      toast('配色方案与上架集市需要开通套餐')
      setTimeout(() => uni.navigateTo({ url: '/pages/plans/plans' }), 800)
      return
    }
  }
  saving.value = true
  try {
    const payload = {
      ...form.value,
      tags: tagsText.value.split(/[,，]/).map(s => s.trim()).filter(Boolean).slice(0, 8),
      links: form.value.links.filter(l => l.label || l.url)
    }
    delete payload.slug
    // avatar 是名片资料(cards.avatar)，随资料一起保存；账号头像(users.avatar)在「账号资料」页单独管理
    await api.put('/api/cards/mine', payload)
    // 公司相册随保存一并提交（与 H5 CardEdit saveMaterials 同契约：items 带 sort）
    await api.put('/api/cards/mine/materials', { items: materials.value.filter(m => m.url).map((m, i) => ({ ...m, sort: i })) })
    toast('资料已保存，二维码不变', 'success')
    setTimeout(() => uni.navigateBack(), 700)
  } catch (e) { toast(e.message) } finally { saving.value = false }
}
</script>

<style scoped>
.notice { background: #f7ecd9; color: #8c2318; font-size: 22rpx; padding: 20rpx 24rpx; line-height: 1.6; }
.qr-beauty { margin-top: 16rpx; padding-top: 16rpx; border-top: 2rpx dashed #e8dcc2; }
.preset-row { display: flex; gap: 12rpx; flex-wrap: wrap; margin-bottom: 12rpx; }
.preset { font-size: 22rpx; padding: 10rpx 22rpx; border-radius: 999rpx; border: 2rpx solid #e8dcc2; background: #f7f2e7; color: #8a7355; }
.preset.on { border-color: #a62b2b; color: #a62b2b; background: #f7ecd9; font-weight: 700; }
.picker { border: 2rpx solid #e8dcc2; border-radius: 12rpx; padding: 16rpx 18rpx; font-size: 26rpx; color: #2b2118; }
.body { padding: 24rpx; }
.card { background: #fff; border-radius: 24rpx; padding: 26rpx; margin-bottom: 18rpx; box-shadow: 0 8rpx 28rpx rgba(15,23,42,.05); }
.section { font-size: 30rpx; font-weight: 700; margin-bottom: 16rpx; }
.gate-tip { background: #fff7ed; border: 2rpx solid #fde68a; color: #b45309; font-size: 23rpx; padding: 14rpx 18rpx; border-radius: 12rpx; margin-bottom: 16rpx; }
.avatar-row { display: flex; align-items: center; gap: 20rpx; margin-bottom: 20rpx; }
.logo-current { display: flex; align-items: center; gap: 14rpx; margin-bottom: 14rpx; }
.logo-current image { width: 80rpx; height: 80rpx; background: #f1f5f9; border-radius: 12rpx; padding: 6rpx; box-sizing: border-box; }
.picker { border: 2rpx solid #e8dcc2; border-radius: 12rpx; padding: 16rpx; font-size: 26rpx; margin-top: 14rpx; }
.region-pickers { display: flex; gap: 10rpx; }
.region-pickers picker { flex: 1; min-width: 0; }
.region-auto { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; margin-top: 10rpx; }
.locate-row { display: flex; align-items: center; gap: 16rpx; flex-wrap: wrap; }
.slider-label { font-size: 24rpx; color: #8a7355; margin-top: 14rpx; }
.logo-preview { width: 220rpx; height: 160rpx; background: #f1f5f9; border-radius: 14rpx; margin: 14rpx auto; display: block; }
.avatar { width: 100rpx; height: 100rpx; border-radius: 22rpx; flex-shrink: 0; }
.ph { background: #a62b2b; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 42rpx; font-weight: 800; }
.field { margin-bottom: 18rpx; }
.label { display: block; font-size: 24rpx; color: #8a7355; margin-bottom: 8rpx; font-weight: 600; }
/* input 显式定高+line-height 防文字半截；textarea 用 padding+固定高即可 */
.input { width: 100%; height: 84rpx; line-height: 84rpx; box-sizing: border-box; border: 2rpx solid #e8dcc2; border-radius: 12rpx; padding: 0 18rpx; font-size: 26rpx; }
.textarea { width: 100%; box-sizing: border-box; border: 2rpx solid #e8dcc2; border-radius: 12rpx; padding: 16rpx 18rpx; font-size: 26rpx; }
.textarea { height: 160rpx; }
.link-row { display: flex; gap: 10rpx; align-items: center; margin-bottom: 10rpx; }
.link-row .input { flex: 1; min-width: 0; }
.del { color: #dc2626; font-size: 24rpx; padding: 0 8rpx; }
.tpl-list { display: flex; flex-direction: column; gap: 14rpx; }
.tpl-item { position: relative; border: 2rpx solid #e8dcc2; border-radius: 16rpx; padding: 14rpx; display: flex; flex-direction: column; gap: 6rpx; }
.tpl-item.on { border-color: #a62b2b; box-shadow: 0 0 0 4rpx rgba(37,99,235,.12); }
/* 微缩版式缩略图：每套不同骨架，一眼区分（与 H5 同口径） */
.tpl-thumb { height: 90rpx; border-radius: 12rpx; position: relative; overflow: hidden; }
.tpl-thumb::before, .tpl-thumb::after { content: ''; position: absolute; }
.tpl-ava { position: absolute; width: 40rpx; height: 40rpx; left: 20rpx; bottom: 14rpx; z-index: 2; }
.tpl-thumb::after { left: 76rpx; bottom: 20rpx; width: 40%; height: 5rpx; border-radius: 3rpx; background: rgba(120,130,145,.35); box-shadow: 0 12rpx 0 rgba(120,130,145,.2); }
.thumb-classic { background: linear-gradient(150deg,#7a1e15,#b03a2e); }
.thumb-classic::before { inset: 0; background: linear-gradient(180deg,transparent 55%,rgba(255,255,255,.95) 55%); }
.thumb-classic .tpl-ava { border-radius: 10rpx; background: #fff; box-shadow: 0 2rpx 8rpx rgba(0,0,0,.25); }
.thumb-minimal { background: #f7f8fa; }
.thumb-minimal::before { inset: 0; border-bottom: 2rpx solid #d8dde5; }
.thumb-minimal .tpl-ava { left: 50%; transform: translateX(-50%); border-radius: 50%; background: #111827; }
.thumb-elite { background: linear-gradient(150deg,#18181b,#3f3f46); }
.thumb-elite::before { inset: 10rpx; border: 2rpx solid rgba(185,147,85,.6); }
.thumb-elite .tpl-ava { left: 50%; transform: translateX(-50%); border-radius: 50%; border: 3rpx solid #b99355; background: #27272a; }
.thumb-vivid { background: linear-gradient(135deg,#7c3aed,#db2777,#f59e0b); }
.thumb-vivid::before { inset: 14rpx 16rpx 10rpx; background: rgba(255,255,255,.92); border-radius: 12rpx; }
.thumb-vivid .tpl-ava { border-radius: 16rpx; background: #fff; box-shadow: 0 2rpx 10rpx rgba(0,0,0,.2); }
.thumb-seal { background: #fff; }
.thumb-seal::before { inset: 0; border: 5rpx solid #111827; }
.thumb-seal .tpl-ava { border-radius: 0; width: 46rpx; height: 46rpx; border: 5rpx solid #111827; }
.thumb-contact { background: radial-gradient(180rpx 90rpx at 50% 0,#1d3a55,#0b1723); }
.thumb-contact::before { left: 0; right: 0; top: 0; height: 8rpx; background: linear-gradient(90deg,#1d3a55,#d8bb85,#1d3a55); }
.thumb-contact .tpl-ava { border-radius: 8rpx; width: 42rpx; height: 42rpx; background: #fff; border: 3rpx solid #b99355; }
.thumb-navygold { background: radial-gradient(180rpx 100rpx at 50% 20%,#244563,#0b1723); }
.thumb-navygold::before { inset: 8rpx; border: 2rpx solid rgba(216,187,133,.7); border-radius: 6rpx; }
.thumb-navygold .tpl-ava { left: 50%; transform: translateX(-50%); border-radius: 12rpx; width: 52rpx; height: 52rpx; background: #fff; border: 3rpx solid #b99355; }
.thumb-paper { background: #faf9f6; }
.thumb-paper::before { left: 20rpx; right: 20rpx; top: 16rpx; height: 2rpx; background: #d8d3c8; }
.thumb-paper .tpl-ava { border-radius: 5rpx; background: #111; }
.thumb-glass { background: linear-gradient(150deg,#0c1c2e,#123a4a); }
.thumb-glass::before { inset: 12rpx 16rpx; background: rgba(127,211,193,.12); border: 2rpx solid rgba(127,211,193,.45); border-radius: 16rpx; }
.thumb-glass .tpl-ava { left: 50%; transform: translateX(-50%); border-radius: 16rpx; background: rgba(127,211,193,.28); border: 2rpx solid rgba(127,211,193,.7); }
.thumb-glass::after { background: rgba(200,235,228,.5); }
.thumb-wood { background: linear-gradient(160deg,#f0e4d0,#d8bfa0); }
.thumb-wood::before { inset: 10rpx; border: 2rpx solid rgba(92,61,36,.35); }
.thumb-wood .tpl-ava { left: 50%; transform: translateX(-50%); border-radius: 50%; background: #8b5e3c; border: 4rpx solid rgba(255,255,255,.5); }
.thumb-neon { background: linear-gradient(150deg,#160b2e,#2d1a4d); }
.thumb-neon::before { inset: 10rpx; border: 2rpx solid #ff4fa3; border-radius: 16rpx; box-shadow: 0 0 12rpx rgba(255,79,163,.6); }
.thumb-neon .tpl-ava { border-radius: 50%; background: linear-gradient(135deg,#ff4fa3,#4fd8ff); box-shadow: 0 0 12rpx rgba(255,79,163,.9); }
.thumb-acid { background-color: #0a0a0a; background-image: linear-gradient(rgba(204,255,0,.14) 2rpx,transparent 2rpx),linear-gradient(90deg,rgba(204,255,0,.14) 2rpx,transparent 2rpx); background-size: 16rpx 16rpx; }
.thumb-acid::before { inset: 0; border: 3rpx solid #ccff00; }
.thumb-acid .tpl-ava { border-radius: 0; background: #ccff00; box-shadow: 6rpx 6rpx 0 rgba(204,255,0,.45); }
.thumb-acid::after { background: #ccff00; }
.thumb-pop { background: linear-gradient(135deg,#ffd93d,#ff6b9d,#6bcbff); }
.thumb-pop::before { left: 0; right: 0; bottom: 0; height: 8rpx; background: #241b3a; }
.thumb-pop .tpl-ava { border-radius: 50%; background: #ff6b6b; border: 5rpx solid #241b3a; }
.thumb-magazine { background: #f7f3ec; }
.thumb-magazine::before { left: 0; right: 0; top: 0; height: 14rpx; background: #c0392b; }
.thumb-magazine .tpl-ava { border-radius: 0; background: #1a1a1a; }
.thumb-poster { background: radial-gradient(180rpx 100rpx at 50% 30%,#244563,#0b1723); }
.thumb-poster::before { inset: 8rpx 30rpx; border: 2rpx solid rgba(216,187,133,.7); }
.thumb-poster .tpl-ava { left: 50%; transform: translateX(-50%); border-radius: 0; width: 30rpx; height: 48rpx; background: transparent; border: 2rpx solid #d8bb85; }
.thumb-poster::after { left: 50%; transform: translateX(-50%); width: 60rpx; }
.thumb-ticket { background-color: #f7f5ee; background-image: repeating-linear-gradient(90deg,#efece4 0 6rpx,transparent 6rpx 10rpx); }
.thumb-ticket::before { inset: 10rpx 16rpx; border: 2rpx dashed #b9b4a8; background: #fffefb; }
.thumb-ticket .tpl-ava { border-radius: 0; background: #fffefb; border: 2rpx solid #e9e6df; }
.thumb-horizontal { background: linear-gradient(90deg,#f4f6f8 0%,#f4f6f8 64%,#17222e 64%); }
.thumb-horizontal::before { inset: 0; }
.thumb-horizontal .tpl-ava { border-radius: 4rpx; width: 50rpx; height: 34rpx; background: #fff; }
.thumb-horizontal::after { left: 82rpx; }
.thumb-sidebar { background: linear-gradient(90deg,#2a2118 0%,#2a2118 30%,#f7f3ec 30%); }
.thumb-sidebar::before { inset: 0; }
.thumb-sidebar .tpl-ava { border-radius: 0; width: 30rpx; height: 44rpx; left: 6rpx; background: rgba(216,187,133,.55); }
.thumb-sidebar::after { left: auto; right: 14rpx; background: rgba(92,61,36,.4); }
/* 新增六套缩略图（tang/vanna/phantom/lava/star/alas）：深底渐变 + 烫边浅卡 + 顶部色条，与正文 .tpl-x 对应 */
.thumb-tang { background: radial-gradient(180rpx 100rpx at 50% -10%, #7a1e15, #a62b2b 45%, #5f160f); }
.thumb-tang::before { inset: 10rpx 14rpx; background: #fffdf8; border: 2rpx solid rgba(201,162,39,.55); border-top: 5rpx solid #c9a227; border-radius: 10rpx; }
.thumb-tang .tpl-ava { border-radius: 8rpx; background: linear-gradient(145deg, #a62b2b, #7a1e15); box-shadow: inset 0 0 0 3rpx rgba(212,175,55,.6); }
.thumb-vanna { background: radial-gradient(180rpx 100rpx at 50% -10%, #0c2a4d, #155a96 45%, #08203a); }
.thumb-vanna::before { inset: 10rpx 14rpx; background: #fff; border: 2rpx solid rgba(42,143,212,.5); border-top: 5rpx solid #2a8fd4; border-radius: 10rpx; }
.thumb-vanna .tpl-ava { border-radius: 8rpx; background: linear-gradient(145deg, #2a8fd4, #0c2a4d); box-shadow: inset 0 0 0 3rpx rgba(91,182,232,.55); }
.thumb-phantom { background: radial-gradient(180rpx 100rpx at 50% -10%, #052e1c, #0f6b3f 45%, #032013); }
.thumb-phantom::before { inset: 10rpx 14rpx; background: #fff; border: 2rpx solid rgba(34,201,122,.5); border-top: 5rpx solid #22c97a; border-radius: 10rpx; }
.thumb-phantom .tpl-ava { border-radius: 8rpx; background: linear-gradient(145deg, #22c97a, #052e1c); box-shadow: inset 0 0 0 3rpx rgba(91,232,160,.55); }
.thumb-lava { background: radial-gradient(180rpx 100rpx at 50% -10%, #1a1a1e, #3a3a42 45%, #15151a); }
.thumb-lava::before { inset: 10rpx 14rpx; background: #fff; border: 2rpx solid rgba(194,65,12,.5); border-top: 5rpx solid #c2410c; border-radius: 10rpx; }
.thumb-lava .tpl-ava { border-radius: 8rpx; background: linear-gradient(145deg, #c2410c, #1a1a1e); box-shadow: inset 0 0 0 3rpx rgba(234,106,44,.5); }
.thumb-star { background: radial-gradient(180rpx 100rpx at 50% -10%, #08080c, #2a2a38 45%, #06060a); }
.thumb-star::before { inset: 10rpx 14rpx; background: #12121a; border: 2rpx solid rgba(200,200,220,.28); border-top: 5rpx solid #8a8aa0; border-radius: 10rpx; }
.thumb-star .tpl-ava { border-radius: 8rpx; background: linear-gradient(145deg, #4a4a5e, #1a1a24); box-shadow: inset 0 0 0 3rpx rgba(200,200,220,.4); }
.thumb-alas { background: radial-gradient(180rpx 100rpx at 50% -10%, #4a0d14, #a01722 45%, #30080e); }
.thumb-alas::before { inset: 10rpx 14rpx; background: #fff; border: 2rpx solid rgba(224,50,60,.5); border-top: 5rpx solid #e0323c; border-radius: 10rpx; }
.thumb-alas .tpl-ava { border-radius: 8rpx; background: linear-gradient(145deg, #e0323c, #4a0d14); box-shadow: inset 0 0 0 3rpx rgba(240,96,104,.55); }
.tpl-name { font-size: 28rpx; font-weight: 700; }
.tpl-desc { font-size: 22rpx; color: #8a7355; }
.tpl-check { font-size: 22rpx; color: #a62b2b; font-weight: 700; }
.adv-toggle { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; padding: 8rpx 0; font-size: 26rpx; color: #8a7355; }
.themes { display: flex; flex-wrap: wrap; gap: 12rpx; margin-bottom: 20rpx; }
.theme { padding: 10rpx 18rpx; border-radius: 12rpx; color: #fff; font-size: 24rpx; opacity: .65; }
.theme.on { opacity: 1; box-shadow: 0 0 0 4rpx rgba(0,0,0,.1); }
.btn { font-size: 26rpx; padding: 16rpx 0; border-radius: 12rpx; background: #f0e7d2; }
.btn::after { border: 0; }
.btn.primary { background: #a62b2b; color: #fff; }
.btn.tiny { padding: 12rpx 24rpx; font-size: 24rpx; }
.btn.big { padding: 22rpx 0; font-size: 30rpx; }
.btn.block { width: 100%; }
.muted { color: #8a7355; }
.small { font-size: 22rpx; }
/* 公司相册：三列缩略图网格 + 删除角标 + 上传格（Grid 多列防 flex 亚像素挤行） */
.gal-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14rpx; }
.gal-cell { position: relative; width: 100%; aspect-ratio: 1; border-radius: 12rpx; overflow: hidden; background: #f0e7d2; }
.gal-cell image { width: 100%; height: 100%; }
.gal-del { position: absolute; right: 6rpx; top: 6rpx; width: 40rpx; height: 40rpx; border-radius: 50%; background: rgba(15,23,42,.6); color: #fff; font-size: 26rpx; display: flex; align-items: center; justify-content: center; }
.gal-add { width: 100%; aspect-ratio: 1; border: 2rpx dashed #c9a227; border-radius: 12rpx; display: flex; align-items: center; justify-content: center; font-size: 24rpx; color: #a62b2b; background: #fdf8ec; box-sizing: border-box; }
</style>
