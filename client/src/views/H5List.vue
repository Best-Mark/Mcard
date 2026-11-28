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
        <p class="small muted">从官方模板一键创建，改改文字就能上架，访客看完直接跳你的名片。</p>
        <button class="btn btn-primary" style="margin-top:14px" @click="newOpen = true">从模板创建 →</button>
      </div>
      <div v-else class="h5l-list">
        <div v-for="p in list" :key="p.id" class="card card-pad h5l-item">
          <div class="h5l-head">
            <b class="h5l-name">{{ p.title }}</b>
            <!-- 关联状态只在已上架时显示：下架/草稿入口未挂到名片上，不摆关联徽标（2026-11-28 用户定稿） -->
            <button v-if="p.status === 'published'" type="button" class="badge small h5l-link" :class="{ on: p.card_linked }" :disabled="busy === p.id" @click="toggleLink(p)">{{ p.card_linked ? '✓ 已关联名片' : '＋ 关联名片' }}</button>
            <span class="badge small" :class="{ on: p.status === 'published' }">{{ p.status === 'published' ? '已上架' : '草稿' }}</span>
            <!-- 待同步徽标（2026-11-28 发布≠上架定稿）：已上架但草稿改过、还没更新上架 -->
            <span v-if="p.status === 'published' && p.pending" class="badge small h5l-pending">有改动待同步</span>
          </div>
          <div class="small muted h5l-meta">{{ p.pages }} 页 · 更新于 {{ fmt(p.updated_at) }}</div>
          <div class="h5l-ops">
            <button class="btn btn-sm btn-primary" @click="router.push(`/me/h5/${p.id}`)">编辑</button>
            <button class="btn btn-sm btn-ghost" @click="preview(p)">预览</button>
            <!-- 上架操作收在这里（2026-11-28 定稿：编辑器只发布保存，不承担上架） -->
            <button v-if="p.status === 'draft'" class="btn btn-sm btn-ghost" :disabled="busy === p.id" @click="toggle(p, 'publish')">{{ busy === p.id ? '…' : '上架' }}</button>
            <button v-if="p.status === 'published' && p.pending" class="btn btn-sm btn-primary" :disabled="busy === p.id" @click="toggle(p, 'publish')">{{ busy === p.id ? '…' : '⇪ 更新上架' }}</button>
            <button v-if="p.status === 'published'" class="btn btn-sm btn-ghost" :disabled="busy === p.id" @click="toggle(p, 'unpublish')">下架</button>
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
    <!-- 统计与线索已并入个人中心「浏览统计」页（/me/stats），列表行不再重复承载 -->
    <!-- 删除确认（项目统一弹层，替代浏览器原生 confirm） -->
    <ConfirmDialog :show="!!delTarget" title="删除宣传页" :text="`删除「${delTarget?.title}」？上架中的链接也会失效，不可恢复。`" confirm-text="删除" danger @confirm="confirmRemove" @cancel="delTarget = null" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api'
import { showToast } from '../store'
import ConfirmDialog from '../components/ConfirmDialog.vue'

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
  try { await api.post(`/api/h5/${p.id}/${action}`); await load(); showToast(action === 'publish' ? '已上架，当前内容已生效' : '已下架', 'success') }
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
    else showToast('已取消关联，名片页不再显示这个宣传页入口', 'success')
  } catch (e) { showToast(e.message || '操作失败', 'error') } finally { busy.value = 0 }
}
// 删除确认：项目统一弹层（2026-11-28 用户定稿「所有提示样式一定要与项目搭配」，不用原生 confirm）
const delTarget = ref(null)
function remove(p) { delTarget.value = p }
async function confirmRemove() {
  const p = delTarget.value
  if (!p) return
  delTarget.value = null
  busy.value = p.id
  try { await api.delete(`/api/h5/${p.id}`); await load(); showToast('已删除', 'success') } catch (e) { showToast(e.message, 'error') } finally { busy.value = 0 }
}
// 预览统一只读：已上架看真实公开页；草稿无公开 URL，进编辑器的 ?preview=1 只读模式（全页可滑、无 dock 无手势）
function preview(p) {
  if (p.status === 'published') {
    const url = `/h5/${p.slug}`
    const w = window.open(url, '_blank')
    if (!w) window.location.href = url // 老内核/微信内 window.open 可能被拦，兜底当前页打开
  } else {
    router.push(`/me/h5/${p.id}?preview=1`)
  }
}
function fmt(s) { return String(s || '').replace('T', ' ').slice(5, 16) }
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
/* 待同步徽标：已上架但草稿改过、还没更新上架（琥珀警示，与默认 badge 同色系加重） */
.h5l-pending { color: #92400e; background: #fde68a; }
.h5l-meta { margin-top: 4px; }
.h5l-ops { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.h5l-del { color: #b91c1c !important; }
.h5l-modal { width: min(92vw, 560px); }
.h5l-tpl-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 12px; }
.h5l-tpl { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 14px; border: 1px solid var(--line); border-radius: 12px; background: #fff; text-align: left; cursor: pointer; }
.h5l-tpl:active { border-color: var(--primary, #a62b2b); }
.h5l-tpl-dot { width: 12px; height: 12px; border-radius: 50%; }
@media (min-width: 720px) { .h5l-tpl-grid { grid-template-columns: repeat(3, 1fr); } }
</style>
