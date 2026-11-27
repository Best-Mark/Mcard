<template>
  <!-- 宣传页列表（/me/h5）：新建（选官方模板）+ 管理（编辑/发布/预览/复制链接/删除）。
       套餐权益分层口径与服务端一致：免费 1 个/≤3 页/带水印，付费 10 个/≤12 页。 -->
  <div class="h5l">
    <header class="h5l-top">
      <button class="h5l-back" @click="router.push('/me')">‹</button>
      <span class="h5l-title">宣传页制作</span>
      <button class="h5l-new" @click="newOpen = true">＋ 新建</button>
    </header>

    <div class="container">
      <div class="h5l-quota card card-pad small muted">
        {{ paid ? `已开通套餐：可创建 ${maxH5} 个宣传页、每个最多 ${maxPages} 页，发布无水印。` : `免费版：1 个宣传页、最多 ${maxPages} 页，尾页带品牌水印。开通套餐解锁更多。` }}
        <router-link v-if="!paid" to="/me/plans" class="h5l-up">去开通 ›</router-link>
      </div>

      <div v-if="loading" class="card card-pad">加载中…</div>
      <div v-else-if="!list.length" class="card card-pad center" style="padding:44px 20px">
        <div style="font-size:44px;opacity:.28">◈</div>
        <h3 style="margin:10px 0 4px">还没有宣传页</h3>
        <p class="small muted">从官方模板一键创建，改改文字就能发布，访客看完直接跳你的名片。</p>
        <button class="btn btn-primary" style="margin-top:14px" @click="newOpen = true">从模板创建 →</button>
      </div>
      <div v-else class="h5l-list">
        <div v-for="p in list" :key="p.id" class="card card-pad h5l-item">
          <div class="h5l-head">
            <b class="h5l-name">{{ p.title }}</b>
            <button type="button" class="badge small h5l-link" :class="{ on: p.card_linked }" :disabled="busy === p.id" @click="toggleLink(p)">{{ p.card_linked ? '✓ 已关联名片' : '＋ 关联名片' }}</button>
            <span class="badge small" :class="{ on: p.status === 'published' }">{{ p.status === 'published' ? '已发布' : '草稿' }}</span>
          </div>
          <div class="small muted h5l-meta">{{ p.pages }} 页 · {{ p.view_count }} 次浏览{{ p.leads ? ` · ${p.leads} 条线索` : '' }} · 更新于 {{ fmt(p.updated_at) }}</div>
          <div class="h5l-ops">
            <button class="btn btn-sm btn-primary" @click="router.push(`/me/h5/${p.id}`)">编辑</button>
            <button v-if="p.status === 'published'" class="btn btn-sm btn-ghost" @click="preview(p)">预览</button>
            <button v-else class="btn btn-sm btn-ghost" @click="router.push(`/me/h5/${p.id}`)">预览</button>
            <button v-if="p.status === 'draft'" class="btn btn-sm btn-ghost" :disabled="busy === p.id" @click="toggle(p, 'publish')">{{ busy === p.id ? '…' : '发布' }}</button>
            <button v-else class="btn btn-sm btn-ghost" :disabled="busy === p.id" @click="toggle(p, 'unpublish')">下架</button>
            <button v-if="p.status === 'published'" class="btn btn-sm btn-ghost" @click="copyLink(p)">复制链接</button>
            <button class="btn btn-sm btn-ghost" @click="openLeads(p)">统计</button>
            <button class="btn btn-sm btn-ghost h5l-del" @click="remove(p)">删除</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 新建：官方模板选择弹层 -->
    <div v-if="newOpen" class="modal-mask" @click.self="newOpen = false">
      <div class="modal h5l-modal">
        <h3>选择模板</h3>
        <p class="small muted" style="margin-top:-4px">套用后所有文字图片都能改</p>
        <div class="h5l-tpl-grid">
          <button v-for="t in templates" :key="t.key" class="h5l-tpl" :disabled="creating" @click="create(t)">
            <span class="h5l-tpl-dot" :style="{ background: t.accent }"></span>
            <b>{{ t.name }}</b>
            <span class="small muted">{{ t.industry }} · {{ t.desc }}</span>
          </button>
          <button class="h5l-tpl" :disabled="creating" @click="create(null)"><b>空白页</b><span class="small muted">从零开始搭</span></button>
        </div>
        <button class="btn btn-ghost" style="margin-top:14px" @click="newOpen = false">取消</button>
      </div>
    </div>
    <!-- 统计弹层（2026-11-27 表单留资并入统计）：概览（浏览/线索）+ 线索明细，电话可一键拨打/复制回访 -->
    <BottomSheet :show="leadsOpen" @update:show="leadsOpen = $event">
      <div class="h5l-leads">
        <div class="h5l-leads-head"><b>统计</b><button type="button" @click="leadsOpen = false">×</button></div>
        <div class="h5l-stats-row">
          <div class="h5l-stat"><b>{{ statsView }}</b><span>次浏览</span></div>
          <div class="h5l-stat"><b>{{ leadsTotal }}</b><span>条线索</span></div>
        </div>
        <div class="h5l-stats-sub">线索明细</div>
        <p v-if="leadsLoading" class="small muted" style="padding:14px 2px">加载中…</p>
        <p v-else-if="!leads.length" class="small muted" style="padding:14px 2px">还没有线索。给宣传页加一个「表单留资」模块，访客填写后会出现在这里。</p>
        <div v-else class="h5l-lead-list">
          <div v-for="l in leads" :key="l.id" class="h5l-lead">
            <div class="h5l-lead-main">
              <b>{{ l.name || '（未填姓名）' }}</b>
              <a v-if="l.phone" class="h5l-lead-phone" :href="'tel:' + l.phone">{{ l.phone }}</a>
              <span v-else class="small muted">未填电话</span>
              <p v-if="l.message" class="h5l-lead-msg">{{ l.message }}</p>
              <span class="small muted">{{ fmt(l.created_at) }}</span>
            </div>
            <div class="h5l-lead-ops">
              <button v-if="l.phone" class="btn btn-sm btn-ghost" @click="copyLeadPhone(l)">复制电话</button>
              <button class="btn btn-sm btn-ghost h5l-del" :disabled="leadBusy === l.id" @click="removeLead(l)">{{ leadBusy === l.id ? '…' : '删除' }}</button>
            </div>
          </div>
        </div>
      </div>
    </BottomSheet>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api'
import { showToast } from '../store'
import BottomSheet from '../components/BottomSheet.vue'

const router = useRouter()
const list = ref([])
const templates = ref([])
const loading = ref(true)
const busy = ref(0)
const creating = ref(false)
const newOpen = ref(false)
// 闸门口径展示值（与服务端一致）；paid 以服务端实测为准：创建失败时会带提示回传
const paid = ref(false)
const maxH5 = 10, maxPages = 12

onMounted(async () => {
  try { templates.value = (await api.get('/api/h5/templates')).data.data.list } catch { /* 模板失败不阻断列表 */ }
  await load()
})
async function load() {
  loading.value = true
  try {
    const { data } = await api.get('/api/h5/mine')
    list.value = data.data.list
    paid.value = !!data.data.limits?.paid
  } catch (e) { showToast(e.message || '加载失败', 'error') } finally { loading.value = false }
}
async function create(tpl) {
  if (creating.value) return
  creating.value = true
  try {
    const { data } = await api.post('/api/h5', tpl ? { template_key: tpl.key, title: tpl.name } : {})
    newOpen.value = false
    router.push(`/me/h5/${data.data.page.id}`)
  } catch (e) { showToast(e.message || '创建失败', 'error') } finally { creating.value = false }
}
async function toggle(p, action) {
  busy.value = p.id
  try { await api.post(`/api/h5/${p.id}/${action}`); await load(); showToast(action === 'publish' ? '已发布，链接已生效' : '已下架', 'success') }
  catch (e) { showToast(e.message, 'error') } finally { busy.value = 0 }
}
// 关联名片开关（2026-11-27 一对多定稿）：宣传页侧显式状态（不在名片侧指定，防乱）；
// 开=已发布时名片公开页出现本页入口，多条可并存；草稿也可先关联，发布后生效。
async function toggleLink(p) {
  if (busy.value) return
  busy.value = p.id
  try {
    await api.post(`/api/h5/${p.id}/card-link`, { linked: !p.card_linked })
    p.card_linked = !p.card_linked
    if (p.card_linked) showToast(p.status === 'published' ? '已关联：访客看你的名片可直达这个宣传页' : '已关联（发布后名片页显示入口）', 'success')
    else showToast('已取消关联，名片页入口已移除', 'success')
  } catch (e) { showToast(e.message || '操作失败', 'error') } finally { busy.value = 0 }
}
async function remove(p) {
  if (!confirm(`删除「${p.title}」？发布中的链接也会失效，不可恢复。`)) return
  busy.value = p.id
  try { await api.delete(`/api/h5/${p.id}`); await load() } catch (e) { showToast(e.message, 'error') } finally { busy.value = 0 }
}
function preview(p) { window.open(`/h5/${p.slug}`, '_blank') }
async function copyLink(p) {
  const link = `${window.location.origin}/h5/${p.slug}`
  try { await navigator.clipboard.writeText(link); showToast('链接已复制', 'success') } catch { showToast(link) }
}
function fmt(s) { return String(s || '').replace('T', ' ').slice(5, 16) }

// 统计弹层（2026-11-27 表单留资并入统计）：概览 + 线索明细；删除成对防重入；复制电话回访
const leadsOpen = ref(false)
const leads = ref([])
const leadsTotal = ref(0)
const leadsLoading = ref(false)
const leadBusy = ref(0)
const leadsPageId = ref(0)
const statsView = ref(0) // 概览：浏览次数（列表行实测值）
async function openLeads(p) {
  leadsPageId.value = p.id
  statsView.value = p.view_count || 0
  leadsOpen.value = true
  leadsLoading.value = true
  leads.value = []
  try {
    const { data } = await api.get(`/api/h5/${p.id}/leads`)
    leads.value = data.data.list || []
    leadsTotal.value = data.data.total || 0
  } catch (e) { showToast(e.message || '线索加载失败', 'error') } finally { leadsLoading.value = false }
}
async function removeLead(l) {
  if (leadBusy.value) return
  leadBusy.value = l.id
  try {
    await api.delete(`/api/h5/${leadsPageId.value}/leads/${l.id}`)
    leads.value = leads.value.filter(x => x.id !== l.id)
    leadsTotal.value = Math.max(0, leadsTotal.value - 1)
    const p = list.value.find(x => x.id === leadsPageId.value)
    if (p && p.leads) p.leads = Math.max(0, p.leads - 1)
  } catch (e) { showToast(e.message || '删除失败', 'error') } finally { leadBusy.value = 0 }
}
async function copyLeadPhone(l) {
  try { await navigator.clipboard.writeText(l.phone); showToast('电话已复制', 'success') } catch { showToast(l.phone) }
}
</script>

<style scoped>
.h5l { min-height: 100vh; background: var(--bg-page, #f4f6fb); padding-bottom: 80px; }
.h5l-top { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; gap: 10px; padding: calc(10px + var(--safe-top, 0px)) 14px 10px; background: rgba(255,255,255,.94); backdrop-filter: blur(8px); border-bottom: 1px solid var(--line); }
.h5l-back { width: 34px; height: 34px; border: 1px solid var(--line); border-radius: 9px; background: #fff; font-size: 19px; color: #374151; cursor: pointer; }
.h5l-title { font-weight: 800; font-size: 16px; flex: 1; }
.h5l-new { padding: 8px 14px; border: 0; border-radius: 999px; background: var(--primary, #a62b2b); color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; }
.h5l-quota { margin-top: 12px; line-height: 1.6; }
.h5l-up { color: var(--primary, #a62b2b); font-weight: 700; }
.h5l-list { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
.h5l-head { display: flex; align-items: center; gap: 8px; }
.h5l-name { font-size: 15px; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.badge.on { color: #15803d; background: #dcfce7; }
.badge { color: #92400e; background: #fef3c7; padding: 2px 8px; border-radius: 999px; font-weight: 700; }
/* 关联名片开关（2026-11-27 一对多）：状态胶囊点按即切换（类似上架状态） */
.h5l-link { border: 0; cursor: pointer; background: #eef2f7; color: #64748b; -webkit-tap-highlight-color: transparent; }
.h5l-link.on { color: #fff; background: var(--primary, #a62b2b); }
.h5l-link:disabled { opacity: .6; cursor: default; }
.h5l-meta { margin-top: 4px; }
.h5l-ops { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.h5l-del { color: #b91c1c !important; }
.h5l-modal { width: min(92vw, 560px); }
.h5l-tpl-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 12px; }
.h5l-tpl { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 14px; border: 1px solid var(--line); border-radius: 12px; background: #fff; text-align: left; cursor: pointer; }
.h5l-tpl:active { border-color: var(--primary, #a62b2b); }
.h5l-tpl-dot { width: 12px; height: 12px; border-radius: 50%; }
@media (min-width: 720px) { .h5l-tpl-grid { grid-template-columns: repeat(3, 1fr); } }
/* 统计弹层（对齐全站 BottomSheet 口径 18px 边距）：概览卡片 + 线索明细滚动区 */
.h5l-leads { padding: 8px 18px 18px; }
.h5l-leads-head { display: flex; align-items: center; justify-content: space-between; padding: 10px 0 12px; }
.h5l-leads-head b { font-size: 15px; }
.h5l-leads-head button { width: 32px; height: 32px; border: 0; border-radius: 50%; background: #f1f4f9; font-size: 17px; color: #64748b; cursor: pointer; }
.h5l-stats-row { display: flex; gap: 10px; margin-bottom: 14px; }
.h5l-stat { flex: 1; display: flex; flex-direction: column; gap: 2px; padding: 14px; border: 1px solid var(--line, #e8edf4); border-radius: 12px; background: var(--bg-page, #f8fafc); }
.h5l-stat b { font-size: 22px; line-height: 1.2; }
.h5l-stat span { font-size: 12px; color: var(--muted, #64748b); }
.h5l-stats-sub { font-size: 13px; font-weight: 700; padding: 2px 0 6px; }
.h5l-lead-list { max-height: 58vh; overflow-y: auto; overscroll-behavior: contain; }
.h5l-lead { display: flex; align-items: flex-start; gap: 10px; padding: 12px 2px; border-bottom: 1px solid var(--line); }
.h5l-lead:last-child { border-bottom: 0; }
.h5l-lead-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.h5l-lead-main b { font-size: 14px; }
.h5l-lead-phone { font-size: 14px; color: var(--primary, #a62b2b); font-weight: 700; text-decoration: none; }
.h5l-lead-msg { margin: 2px 0 0; font-size: 13px; line-height: 1.6; color: #374151; white-space: pre-line; word-break: break-all; }
.h5l-lead-ops { flex: 0 0 auto; display: flex; flex-direction: column; gap: 6px; }
</style>
