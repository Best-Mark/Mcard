<template>
  <div class="portal">
    <header class="pt-nav">
      <div class="pt-nav-in">
        <div class="pt-brand" @click="go('/')">
          <span class="pt-logo">M</span>
          <span class="pt-brand-txt"><b>MCard</b><small>电子名片 · 连接商务伙伴</small></span>
        </div>
        <nav class="pt-links">
          <button :class="{ on: route.path === '/' || route.path === '/market' }" @click="go('/market')">名片集市</button>
          <button @click="go('/market#features')">发现 partner</button>
          <button v-if="logged" @click="go('/me')">我的名片</button>
        </nav>
        <div class="pt-actions">
          <template v-if="logged">
            <button class="pt-chip" @click="go('/me')">{{ (auth.user?.phone || '我').slice(0, 1) }} 的名片</button>
            <button class="pt-ghost" @click="go('/me/card')">编辑名片</button>
          </template>
          <template v-else>
            <button class="pt-ghost" @click="go('/login')">登录</button>
            <button class="pt-primary" @click="go('/login?redirect=/me/card')">免费创建名片</button>
          </template>
        </div>
      </div>
    </header>

    <section class="pt-hero">
      <div class="pt-hero-in">
        <div class="pt-badge">✦ 一张名片，连接无限商机</div>
        <h1>找到对的人<br /><em>从一张名片开始</em></h1>
        <p class="pt-lead">按城市、按行业、按距离，发现业务对口的商务伙伴。<br />永久有效的电子名片，扫码即存，改资料不换码。</p>
        <form class="pt-search" @submit.prevent="doSearch">
          <span class="pt-search-ico">⌕</span>
          <input v-model.trim="keyword" class="pt-search-input" placeholder="搜索姓名 / 公司 / 行业，如「设计」「财税」「科技」" aria-label="搜索名片" />
          <button class="pt-search-btn" type="submit" :disabled="searching">{{ searching ? '搜索中…' : '搜索名片' }}</button>
        </form>
        <div class="pt-hot">
          <span>热门搜索</span>
          <button v-for="k in HOT_WORDS" :key="k" @click="searchWord(k)">{{ k }}</button>
        </div>
      </div>
      <div class="pt-hero-art" aria-hidden="true">
        <div class="pt-orb pt-orb-1"></div>
        <div class="pt-orb pt-orb-2"></div>
        <div class="pt-preview">
          <div class="pt-pv-top"><span class="pt-pv-ava">名</span><span><b>商务名片</b><small>扫一扫，存入通讯录</small></span></div>
          <div class="pt-pv-line w80"></div><div class="pt-pv-line w60"></div>
          <div class="pt-pv-tags"><i>产品设计</i><i>企业服务</i><i>可合作</i></div>
          <div class="pt-pv-qr"></div>
        </div>
      </div>
    </section>

    <section class="pt-section pt-cities">
      <div class="pt-sec-head">
        <div><h2>选择城市</h2><p>以城市为中心，按距离发现身边伙伴</p></div>
        <button class="pt-more" @click="go('/market')">探索全部 ›</button>
      </div>
      <div class="pt-city-grid">
        <button class="pt-city" :class="{ on: currentCity && currentCity === c.name }" v-for="c in cityChips" :key="c.name" @click="searchCity(c.name)">
          <span class="pt-city-dot" v-if="c.isCurrent"></span>
          <b>{{ c.name }}</b>
          <small>{{ c.isCurrent ? '当前位置' : '发现伙伴' }}</small>
        </button>
      </div>
    </section>

    <section class="pt-section pt-ind">
      <div class="pt-sec-head">
        <div><h2>按行业发现</h2><p>找到业务对口的人，合作从这里开始</p></div>
      </div>
      <div class="pt-ind-grid">
        <button v-for="ind in industries" :key="ind.key" class="pt-ind-card" @click="searchIndustry(ind.key)">
          <i>{{ ind.icon }}</i>
          <b>{{ ind.label }}</b>
        </button>
      </div>
    </section>

    <section class="pt-section pt-featured" id="features">
      <div class="pt-sec-head">
        <div><h2>精选名片</h2><p>看看大家都在用的电子名片</p></div>
        <button class="pt-more" @click="go('/market')">去集市逛逛 ›</button>
      </div>
      <div v-if="featured.length" class="pt-cards">
        <router-link v-for="c in featured" :key="c.slug" :to="'/c/' + c.slug + '?src=portal'" class="pt-card">
          <div class="pt-card-head">
            <span class="pt-card-ava">{{ (c.name || '名').slice(0, 1) }}</span>
            <span class="pt-card-id"><b>{{ c.name || c.name_en || '商务伙伴' }}</b><small>{{ [c.title, c.company].filter(Boolean).join(' · ') || '电子名片' }}</small></span>
          </div>
          <p class="pt-card-bio">{{ c.bio || '点击查看完整名片，一键存入通讯录' }}</p>
          <div class="pt-card-foot">
            <span>{{ c.industryLabel || '商务' }}<template v-if="c.city"> · {{ c.city }}</template></span>
            <b>查看 ›</b>
          </div>
        </router-link>
      </div>
      <div v-else class="pt-empty">还没有上架的名片，<router-link to="/me/card">创建第一张</router-link>，让更多伙伴找到你。</div>
    </section>

    <section class="pt-cta">
      <div><h2>你的下一张名片，可能就是下一个机会</h2><p>永久二维码 · 随时改资料 · 上架集市被看见</p></div>
      <button class="pt-primary" @click="logged ? go('/me/card') : go('/login?redirect=/me/card')">{{ logged ? '完善我的名片' : '免费创建名片' }}</button>
    </section>

    <footer class="pt-foot">
      <span>MCard 电子名片 · 一扫即存，永久有效</span>
      <span>让每张名片都值得保存</span>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../../api'
import { auth } from '../../store'
import { getCurrentPosition } from '../../utils/geo'
import { CITIES as FALLBACK_CITIES, HOT_CITIES as FALLBACK_HOT } from '../../utils/city-data'

const route = useRoute()
const router = useRouter()
const logged = computed(() => !!auth.token)
const keyword = ref('')
const searching = ref(false)
const meta = ref({ industries: [], cities: [], hotCities: [] })
const currentCity = ref('')
const featured = ref([])
const HOT_WORDS = ['设计', '财税', '科技', '制造', '教育', '咨询']

const industries = computed(() => meta.value.industries || [])
const cityChips = computed(() => {
  const hot = (meta.value.hotCities?.length ? meta.value.hotCities : FALLBACK_HOT).slice()
  const cur = currentCity.value
  const out = []
  const push = (name, isCurrent) => {
    if (!name || out.some(x => x.name === name)) return
    out.push({ name, isCurrent })
  }
  push(cur, true)
  hot.forEach(n => push(n, false))
  return out.slice(0, 12)
})

function go(path) {
  if (route.fullPath === path) return
  router.push(path)
}

function doSearch() {
  if (searching.value) return
  const q = keyword.value.trim()
  if (!q) return router.push('/market')
  searching.value = true
  router.push({ path: '/market', query: { q } }).finally(() => { searching.value = false })
}
function searchWord(k) { keyword.value = k; doSearch() }
function searchCity(name) {
  const all = (meta.value.cities?.length ? meta.value.cities : FALLBACK_CITIES)
  const hit = all.find(c => c.name === name)
  const query = { city: name }
  if (hit) { query.lat = hit.lat; query.lng = hit.lng; query.sort = 'distance' }
  router.push({ path: '/market', query })
}
function searchIndustry(key) { router.push({ path: '/market', query: { industry: key } }) }

async function load() {
  try {
    const { data } = await api.get('/api/cards/public/market/meta')
    meta.value = data?.data || meta.value
  } catch { /* 兜底用本地清单，不影响首屏 */ }
  try {
    const { data } = await api.get('/api/cards/public/market', { params: { limit: 8, sort: 'views' } })
    featured.value = data?.data?.list || []
  } catch { /* 精选为空时显示引导，不留假数据 */ }
  try {
    const pos = await getCurrentPosition({ timeout: 6000 })
    if (pos.city) currentCity.value = pos.city
  } catch { /* 定位失败仅影响「当前城市」标签 */ }
}
onMounted(load)
</script>

<style scoped>
.portal { min-height: 100vh; background: #fff; color: #162033; }
.pt-nav { position: sticky; top: 0; z-index: 30; background: rgba(255,255,255,.92); backdrop-filter: blur(14px); border-bottom: 1px solid #eef1f6; }
.pt-nav-in { max-width: 1360px; margin: 0 auto; height: 72px; padding: 0 40px; display: flex; align-items: center; gap: 36px; }
.pt-brand { display: flex; align-items: center; gap: 11px; cursor: pointer; }
.pt-logo { width: 40px; height: 40px; border-radius: 12px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: #fff; display: grid; place-items: center; font-size: 21px; font-weight: 800; box-shadow: 0 6px 16px rgba(37,99,235,.25); }
.pt-brand-txt b { display: block; font-size: 18px; letter-spacing: .02em; }
.pt-brand-txt small { display: block; font-size: 11px; color: #8a97ab; }
.pt-links { display: flex; align-items: center; gap: 28px; flex: 1; }
.pt-links button { border: 0; background: transparent; font-size: 14px; color: #4a5568; cursor: pointer; padding: 8px 0; }
.pt-links button:hover, .pt-links button.on { color: #1d4ed8; font-weight: 700; }
.pt-actions { display: flex; align-items: center; gap: 12px; }
.pt-primary { border: 0; border-radius: 10px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: #fff; padding: 11px 20px; font-size: 14px; font-weight: 700; cursor: pointer; box-shadow: 0 6px 16px rgba(37,99,235,.25); }
.pt-primary:hover { filter: brightness(1.06); }
.pt-ghost { border: 1px solid #d7dfeb; border-radius: 10px; background: #fff; color: #334155; padding: 10px 16px; font-size: 14px; cursor: pointer; }
.pt-ghost:hover { border-color: #2563eb; color: #2563eb; }
.pt-chip { border: 1px solid #d7dfeb; border-radius: 999px; background: #fff; color: #334155; padding: 8px 16px; font-size: 13px; cursor: pointer; }

.pt-hero { position: relative; overflow: hidden; background: linear-gradient(120deg, #f5f9ff 0%, #eaf2ff 45%, #eef5ff 100%); }
.pt-hero-in { position: relative; z-index: 2; max-width: 1360px; margin: 0 auto; padding: 76px 40px 84px; display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(300px, .85fr); gap: 50px; align-items: center; }
.pt-badge { display: inline-block; font-size: 12px; color: #1d4ed8; background: rgba(37,99,235,.09); border: 1px solid rgba(37,99,235,.16); border-radius: 999px; padding: 6px 14px; margin-bottom: 20px; }
.pt-hero h1 { font-size: 52px; line-height: 1.18; margin: 0 0 18px; letter-spacing: -.02em; font-weight: 800; }
.pt-hero h1 em { font-style: normal; color: #1d4ed8; }
.pt-lead { font-size: 16px; line-height: 1.9; color: #5b6b83; margin: 0 0 30px; }
.pt-search { display: flex; align-items: center; gap: 10px; max-width: 720px; height: 64px; padding: 6px 6px 6px 20px; background: #fff; border: 1px solid #dbe4f2; border-radius: 16px; box-shadow: 0 18px 44px rgba(30,64,175,.1); }
.pt-search-ico { font-size: 26px; color: #94a3b8; }
.pt-search-input { flex: 1; min-width: 0; height: 100%; border: 0; outline: 0; font-size: 16px; color: #162033; background: transparent; }
.pt-search-btn { height: 100%; padding: 0 26px; border: 0; border-radius: 11px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; }
.pt-search-btn:disabled { opacity: .7; cursor: wait; }
.pt-hot { display: flex; align-items: center; gap: 14px; margin-top: 18px; font-size: 13px; color: #8a97ab; }
.pt-hot button { border: 0; background: transparent; color: #4a5568; font-size: 13px; cursor: pointer; padding: 4px 10px; border-radius: 8px; }
.pt-hot button:hover { color: #1d4ed8; background: rgba(37,99,235,.07); }
.pt-hero-art { position: relative; height: 380px; display: grid; place-items: center; }
.pt-orb { position: absolute; border-radius: 50%; filter: blur(2px); opacity: .7; }
.pt-orb-1 { width: 300px; height: 300px; background: radial-gradient(circle at 30% 30%, #bfdbfe, #93c5fd); top: 10px; right: 20px; }
.pt-orb-2 { width: 180px; height: 180px; background: radial-gradient(circle at 60% 40%, #dbeafe, #bfdbfe); bottom: 20px; left: 10px; }
.pt-preview { position: relative; z-index: 2; width: 300px; background: #fff; border-radius: 20px; padding: 24px; box-shadow: 0 24px 60px rgba(30,64,175,.18); transform: rotate(-3deg); }
.pt-pv-top { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
.pt-pv-ava { width: 48px; height: 48px; border-radius: 14px; background: linear-gradient(135deg, #93c5fd, #2563eb); color: #fff; display: grid; place-items: center; font-size: 20px; font-weight: 800; }
.pt-pv-top b { display: block; font-size: 16px; }
.pt-pv-top small { font-size: 11px; color: #94a3b8; }
.pt-pv-line { height: 9px; border-radius: 5px; background: #e8eef7; margin-bottom: 9px; }
.pt-pv-line.w80 { width: 80%; } .pt-pv-line.w60 { width: 60%; }
.pt-pv-tags { display: flex; gap: 6px; margin: 16px 0; }
.pt-pv-tags i { font-style: normal; font-size: 10px; color: #2563eb; background: #eff6ff; border-radius: 6px; padding: 4px 8px; }
.pt-pv-qr { width: 96px; height: 96px; border-radius: 10px; background: repeating-linear-gradient(45deg, #1e293b 0 6px, #fff 6px 12px); border: 6px solid #fff; box-shadow: 0 0 0 1px #e2e8f0; margin: 0 auto; }

.pt-section { max-width: 1360px; margin: 0 auto; padding: 64px 40px; }
.pt-sec-head { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 26px; }
.pt-sec-head h2 { font-size: 28px; margin: 0 0 8px; font-weight: 800; }
.pt-sec-head p { margin: 0; font-size: 14px; color: #7c8a9e; }
.pt-more { border: 0; background: transparent; color: #2563eb; font-size: 14px; cursor: pointer; }
.pt-cities { padding-bottom: 20px; }
.pt-city-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; }
.pt-city { position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 18px; border: 1px solid #e6ecf5; border-radius: 14px; background: #fff; cursor: pointer; transition: .18s; }
.pt-city:hover, .pt-city.on { border-color: #2563eb; box-shadow: 0 8px 22px rgba(37,99,235,.1); transform: translateY(-2px); }
.pt-city b { font-size: 16px; }
.pt-city small { font-size: 11px; color: #94a3b8; }
.pt-city-dot { position: absolute; top: 14px; right: 14px; width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 0 4px rgba(34,197,94,.15); }
.pt-ind { padding-top: 20px; }
.pt-ind-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; }
.pt-ind-card { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 22px 10px; border: 1px solid #e6ecf5; border-radius: 14px; background: #fff; cursor: pointer; transition: .18s; }
.pt-ind-card:hover { border-color: #2563eb; transform: translateY(-2px); box-shadow: 0 8px 22px rgba(37,99,235,.1); }
.pt-ind-card i { font-style: normal; font-size: 26px; color: #2563eb; }
.pt-ind-card b { font-size: 13px; color: #334155; }
.pt-featured { padding-top: 20px; }
.pt-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.pt-card { display: flex; flex-direction: column; padding: 20px; border: 1px solid #e6ecf5; border-radius: 16px; background: #fff; text-decoration: none; color: inherit; transition: .18s; }
.pt-card:hover { border-color: #93c5fd; box-shadow: 0 12px 30px rgba(30,64,175,.1); transform: translateY(-3px); }
.pt-card-head { display: flex; align-items: center; gap: 12px; }
.pt-card-ava { width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #dbeafe, #93c5fd); color: #1d4ed8; display: grid; place-items: center; font-size: 18px; font-weight: 800; }
.pt-card-id b { display: block; font-size: 15px; }
.pt-card-id small { display: block; font-size: 11px; color: #8a97ab; margin-top: 2px; }
.pt-card-bio { flex: 1; font-size: 13px; line-height: 1.6; color: #5b6b83; margin: 14px 0; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.pt-card-foot { display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f0f3f8; padding-top: 12px; }
.pt-card-foot b { color: #2563eb; }
.pt-empty { padding: 40px; text-align: center; color: #7c8a9e; background: #f8fafc; border-radius: 16px; }
.pt-empty a { color: #2563eb; }

.pt-cta { max-width: 1360px; margin: 0 auto 64px; padding: 44px 48px; border-radius: 22px; background: linear-gradient(120deg, #1e3a8a, #2563eb 60%, #3b82f6); color: #fff; display: flex; align-items: center; justify-content: space-between; }
.pt-cta h2 { font-size: 26px; margin: 0 0 8px; }
.pt-cta p { margin: 0; font-size: 14px; opacity: .85; }
.pt-cta .pt-primary { background: #fff; color: #1d4ed8; box-shadow: none; }
.pt-foot { border-top: 1px solid #eef1f6; padding: 30px 40px; display: flex; justify-content: space-between; max-width: 1360px; margin: 0 auto; font-size: 12px; color: #94a3b8; }

@media (max-width: 1200px) {
  .pt-city-grid, .pt-ind-grid { grid-template-columns: repeat(4, 1fr); }
  .pt-cards { grid-template-columns: repeat(2, 1fr); }
  .pt-hero-in { grid-template-columns: 1fr; }
  .pt-hero-art { display: none; }
}
</style>
