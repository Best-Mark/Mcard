<template>
  <div class="page">
    <header class="topbar">
      <router-link to="/me" class="brand">M<em>Card</em></router-link>
      <div class="spacer"></div>
      <span class="small muted">编辑资料</span>
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
        <div>
          <div class="card card-pad">
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
              <div class="field"><label>公司主页 URL</label><input v-model="form.website" class="input" placeholder="https://" /></div>
              <div class="field"><label>店铺 URL</label><input v-model="form.shop_url" class="input" placeholder="https:// 淘宝 / 抖音 / 微店等" /></div>
            </div>
            <div class="field"><label>个人简介</label><textarea v-model="form.bio" class="textarea" maxlength="600" placeholder="一句话介绍自己，展示在名片首页"></textarea></div>
            <div class="field"><label>公司简介</label><textarea v-model="form.company_intro" class="textarea" maxlength="1000" placeholder="介绍公司业务、优势与服务，展示在名片「公司简介」区块，并写入通讯录备注"></textarea></div>
            <div class="field"><label>标签（逗号分隔，最多 8 个）</label><input v-model="tagsText" class="input" placeholder="品牌顾问, 设计, 马拉松" /></div>
          </div>

          <div class="card card-pad" style="margin-top:14px">
            <div class="section-title" style="margin-top:0">联系方式</div>
            <div class="grid2">
              <div class="field"><label>手机号</label><input v-model="form.mobile" class="input" inputmode="tel" /></div>
              <div class="field"><label>座机</label><input v-model="form.phone" class="input" /></div>
              <div class="field"><label>邮箱</label><input v-model="form.email" class="input" type="email" /></div>
              <div class="field"><label>微信号</label><input v-model="form.wechat" class="input" /></div>
              <div class="field"><label>支付宝账号</label><input v-model="form.alipay" class="input" /></div>
              <div class="field"><label>WhatsApp</label><input v-model="form.whatsapp" class="input" /></div>
            </div>
            <div class="field"><label>地址（用于一键导航）</label><input v-model="form.address" class="input" placeholder="省市区 + 街道门牌，越详细导航越准" /></div>
            <div class="field"><label>门牌 / 楼层补充</label><input v-model="form.address_detail" class="input" /></div>
          </div>

          <div class="card card-pad" style="margin-top:14px">
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
              <label>定位坐标 <span class="muted small">（用于按距离排序；选城市会自动填入，也可精确定位）</span></label>
              <div class="locate-row">
                <span class="small mono">{{ form.latitude != null ? form.latitude.toFixed(4) : '—' }}, {{ form.longitude != null ? form.longitude.toFixed(4) : '—' }}</span>
                <button class="btn btn-sm btn-ghost" @click="mapOpen = true">🗺 地图选点</button>
                <button class="btn btn-sm btn-ghost" :disabled="locating" @click="locateMe">{{ locating ? '定位中…' : '⌖ 精确定位' }}</button>
              </div>
            </div>
            <p v-if="form.market_opt_in && form.latitude == null" class="small" style="color:#b45309">已开启上架但尚无坐标，请选城市或精确定位，否则在集市中会排在末尾。</p>
          </div>

          <div class="card card-pad" style="margin-top:14px">
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
          </div>

          <div class="card card-pad" style="margin-top:14px">
            <div class="section-title" style="margin-top:0">更多链接</div>
            <div v-for="(l, i) in form.links" :key="i" class="link-row">
              <input v-model="l.label" class="input" placeholder="标题，如 我的作品集" />
              <input v-model="l.url" class="input" placeholder="https://" />
              <button class="btn btn-sm btn-danger" @click="form.links.splice(i, 1)">删</button>
            </div>
            <button class="btn btn-sm btn-ghost" @click="form.links.push({ label: '', url: '' })">+ 添加链接</button>
          </div>

          <div class="card card-pad" style="margin-top:14px">
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

          <div class="card card-pad" style="margin-top:14px">
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
          </div>

          <button class="btn btn-primary btn-lg btn-block" style="margin-top:16px" :disabled="saving || loadError || !loaded" @click="save">
            {{ saving ? '保存中…' : (loadError ? '加载失败，暂不可保存' : '保存资料') }}
          </button>
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
          @confirm="p => { form.latitude = p.lat; form.longitude = p.lng; mapOpen = false; showToast('坐标已填入，记得点保存', 'success') }"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, defineAsyncComponent } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api'
import { showToast } from '../store'
import { THEMES } from '../utils/themes'
import LogoUploader from '../components/LogoUploader.vue'

const MapPicker = defineAsyncComponent(() => import('../components/MapPicker.vue'))

const router = useRouter()
const blank = {
  slug: '', name: '', name_en: '', title: '', company: '', company_intro: '', department: '', website: '', shop_url: '',
  mobile: '', phone: '', email: '', wechat: '', alipay: '', whatsapp: '',
  wechat_qr: '', alipay_qr: '', wechat_pay_qr: '', alipay_pay_qr: '',
  address: '', address_detail: '',
  avatar: '', logo: '', bio: '', tags: [], links: [], template: 'classic', theme: 'ocean', accent: THEMES.ocean.accent,
  industry: '', city: '', latitude: null, longitude: null, market_opt_in: false,
  qr_fg: '#0f172a', qr_bg: '#ffffff', qr_logo: true
}
const form = ref({ ...blank })
const templates = ref([])
const marketMeta = ref({ industries: [], cities: [] })
const locating = ref(false)
const mapOpen = ref(false)
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
  } catch (e) {
    loadError.value = e.message || '网络异常'
  } finally { loading.value = false }
}

onMounted(async () => {
  loadTemplates()
  loadMarketMeta()
  await loadCard()
})

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

function locateMe() {
  if (!navigator.geolocation) return showToast('当前浏览器不支持定位，请改用城市选择', 'error')
  locating.value = true
  navigator.geolocation.getCurrentPosition(
    pos => {
      form.value.latitude = pos.coords.latitude
      form.value.longitude = pos.coords.longitude
      if (!form.value.city) form.value.city = ''
      locating.value = false
      showToast('已获取坐标，记得点保存', 'success')
    },
    () => { locating.value = false; showToast('未获取到定位，请改用城市选择', 'error') },
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
  )
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

async function save() {
  if (saving.value || loadError.value || !loaded.value) return
  if (!form.value.name) return showToast('请填写姓名', 'error')
  saving.value = true
  try {
    const payload = { ...form.value, tags: tagList.value, links: form.value.links.filter(l => l.label || l.url) }
    delete payload.slug; delete payload.id; delete payload.url; delete payload.active
    delete payload.expiresAt; delete payload.views; delete payload.status; delete payload.createdAt
    await api.put('/api/cards/mine', payload)
    showToast('资料已保存，二维码保持不变', 'success')
    router.push('/me')
  } catch (e) { showToast(e.message, 'error') } finally { saving.value = false }
}
</script>

<style scoped>
.edit-layout { display: grid; grid-template-columns: 1fr 280px; gap: 18px; align-items: start; }
@media (max-width: 900px) { .edit-layout { grid-template-columns: 1fr; } .preview-panel { display: none; } }
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
@media (max-width: 520px) { .tpl-list { grid-template-columns: 1fr; } }
</style>
