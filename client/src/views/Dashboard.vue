<template>
  <!-- 我的名片：加载/错误/未创建三态由本页处理；已有名片时整页交给 CardView owner 渲染。
       ⚠️ owner 与公开名片页必须同模板、同内容、同样式，唯一差异是 dock 首按钮「编辑名片」vs「打电话」。
       本页不再画任何名片内容（封面/联系方式/二维码/简介），否则就是两套样式（2026-11-25 用户定稿）。
       顶部 header 属于工作台 chrome（与统计/名片夹等页同款），不属于名片模板，公开页没有是正常的。 -->
  <div>
    <header v-if="card" class="dash-top">
      <span class="dash-brand">M<em>Card</em></span>
      <span class="dash-sub">我的名片</span>
      <span class="spacer"></span>
      <button class="dash-icon" aria-label="分享名片" @click="doShare">↗</button>
      <button class="dash-icon" aria-label="查看二维码" @click="router.push(`/c/${card.slug}?save=1`)">▦</button>
      <button class="dash-menu-btn" aria-label="菜单" @click="toggleDrawer"><i class="menu-glyph"></i><span>菜单</span></button>
    </header>

    <div v-if="loading" class="dash-loading"><div class="card card-pad">加载中…</div></div>
    <div v-else-if="loadError" class="dash-loading">
      <div class="card card-pad center" style="padding:44px 20px">
        <div style="font-size:40px;opacity:.3">⚠️</div>
        <h2 style="margin:10px 0">数据加载失败</h2>
        <p class="muted small">{{ loadError }}</p>
        <button class="btn btn-primary" style="margin-top:16px" :disabled="loading" @click="load">重新加载</button>
      </div>
    </div>
    <div v-else-if="!card" class="dash-loading">
      <div class="card card-pad center" style="padding:44px 20px">
        <div style="font-size:46px;opacity:.25">▤</div>
        <h2 style="margin:10px 0">还没有名片</h2>
        <p class="muted small">创建后即可获得永久二维码，之后换资料不用换码。</p>
        <div style="max-width:320px;margin:20px auto 0">
          <input v-model.trim="newSlug" class="input" placeholder="自定义短码（选填，如 zhangsan）" />
          <button class="btn btn-primary btn-block" style="margin-top:10px" :disabled="busy" @click="createCard">
            {{ busy ? '创建中…' : '立即创建我的名片' }}
          </button>
        </div>
      </div>
    </div>
    <CardView v-else owner :embed-slug="card.slug" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api'
import { showToast, toggleDrawer } from '../store'
import { isWeChat } from '../utils/save-image'
import { shareOrCopy } from '../utils/share'
import { setCardShare } from '../utils/wx-share'
import CardView from './CardView.vue'

const router = useRouter()

const card = ref(null)
const loading = ref(true)
const busy = ref(false)
const newSlug = ref('')
const loadError = ref('')
let loadStarted = false

async function load() {
  if (loadStarted && loading.value) return
  loadStarted = true
  loading.value = true
  loadError.value = ''
  try {
    const { data } = await api.get('/api/cards/mine')
    const c = data?.data
    if (!c || typeof c !== 'object') {
      card.value = null
      return
    }
    card.value = c
    // 工作台自己配微信转发卡片：嵌入的 CardView 是异步组件且要再拉一次公开接口，
    // 只靠它配置会在加载慢时被路由 900ms 兜底抢先（转发成「MCard 电子名片」+灰块）。
    setCardShare(api, c, c.url || '')
  } catch (e) { loadError.value = e.message || '网络异常' } finally { loading.value = false }
}
onMounted(load)

async function createCard() {
  if (busy.value) return
  busy.value = true
  try {
    const { data } = await api.post('/api/cards/mine', { slug: newSlug.value })
    card.value = data.data
    showToast('名片已创建，开始完善资料吧', 'success')
  } catch (e) { showToast(e.message, 'error') } finally { busy.value = false }
}

async function doShare() {
  // 优先用服务端下发的公开 URL（动态域名、干净无 query），绝不带地址栏上的内部参数
  const url = card.value?.url || (card.value?.slug ? `${location.origin}/c/${card.value.slug}` : location.origin)
  if (isWeChat()) return showToast('点右上角「···」→ 发送给朋友 / 分享到朋友圈', 'error')
  const r = await shareOrCopy({ title: '我的电子名片', text: '扫一扫保存我的名片', url })
  if (r === 'copied') showToast('链接已复制，快分享给朋友', 'success')
  else if (r === 'failed') showToast('复制失败，请手动复制地址栏链接', 'error')
}
</script>

<style scoped>
/* 工作台头部：中性品牌蓝，不随名片模板变化（它是工作台 chrome，不属于名片本身） */
/* 沉浸式顶到物理屏幕最上：状态栏区域也绘制品牌蓝，左右统一 16px */
.dash-top { height: calc(50px + var(--safe-top)); display: flex; align-items: center; gap: 8px; padding: var(--safe-top) 16px 0; background: linear-gradient(90deg,#143b8f,#2563eb 60%,#06b6d4); color: #fff; }
.dash-brand { font-weight: 800; font-size: 18px; }
.dash-brand em { font-style: normal; opacity: .75; }
.dash-sub { font-size: 12px; opacity: .8; }
.dash-top .spacer { flex: 1; }
.dash-icon { width: 34px; height: 34px; border-radius: 50%; background: rgba(255,255,255,.16); color: #fff; font-size: 17px; display: grid; place-items: center; }
.dash-menu-btn { display: flex; align-items: center; gap: 6px; height: 34px; padding: 0 11px; border-radius: 17px; background: rgba(255,255,255,.18); color: #fff; font-size: 12px; font-weight: 600; }
.menu-glyph { width: 14px; height: 12px; border-top: 2px solid #fff; border-bottom: 2px solid #fff; position: relative; }
.menu-glyph::after { content: ''; position: absolute; left: 0; right: 0; top: 5px; border-top: 2px solid #fff; }
.dash-loading { padding-top: 20px; }
</style>
