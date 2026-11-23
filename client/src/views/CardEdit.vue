<template>
  <div class="page">
    <header class="topbar">
      <router-link to="/me" class="brand">M<em>Card</em></router-link>
      <div class="spacer"></div>
      <span class="small muted">编辑资料</span>
    </header>

    <div class="container wide" style="margin-top:18px">
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
              <div class="field"><label>个人网站</label><input v-model="form.website" class="input" placeholder="https://" /></div>
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
              <div class="field"><label>WhatsApp</label><input v-model="form.whatsapp" class="input" /></div>
            </div>
            <div class="field"><label>地址（用于一键导航）</label><input v-model="form.address" class="input" placeholder="省市区 + 街道门牌，越详细导航越准" /></div>
            <div class="field"><label>门牌 / 楼层补充</label><input v-model="form.address_detail" class="input" /></div>
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
            <div class="section-title" style="margin-top:0">外观与二维码</div>
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

          <button class="btn btn-primary btn-lg btn-block" style="margin-top:16px" :disabled="saving" @click="save">
            {{ saving ? '保存中…' : '保存资料' }}
          </button>
        </div>

        <aside class="preview-panel">
          <div class="card card-pad">
            <div class="section-title" style="margin-top:0">实时预览</div>
            <div class="preview-card">
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api'
import { showToast } from '../store'
import { THEMES } from '../utils/themes'
import LogoUploader from '../components/LogoUploader.vue'

const router = useRouter()
const blank = {
  slug: '', name: '', name_en: '', title: '', company: '', company_intro: '', department: '', website: '',
  mobile: '', phone: '', email: '', wechat: '', whatsapp: '', address: '', address_detail: '',
  avatar: '', logo: '', bio: '', tags: [], links: [], theme: 'ocean', accent: THEMES.ocean.accent,
  qr_fg: '#0f172a', qr_bg: '#ffffff', qr_logo: true
}
const form = ref({ ...blank })
const tagsText = ref('')
const saving = ref(false)
const tagList = computed(() => tagsText.value.split(/[,，]/).map(s => s.trim()).filter(Boolean).slice(0, 8))
const previewQr = computed(() => `/api/cards/public/${form.value.slug}/qr.svg?size=320&brand=M`)

onMounted(async () => {
  try {
    const { data } = await api.get('/api/cards/mine')
    if (!data.data) { showToast('请先创建名片', 'error'); return router.push('/me') }
    form.value = { ...blank, ...data.data, qr_logo: !!data.data.qr_logo }
    tagsText.value = (data.data.tags || []).join(', ')
  } catch (e) { showToast(e.message, 'error') }
})

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
</style>
