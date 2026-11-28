<template>
  <!-- 素材库选择器（2026-11-28 用户拍板恢复素材库并要求自定义分组）：
       按项目强制约定整体走底部弹窗（BottomSheet），分组切换 / 上传 / 新建分组 / 移动分组 / 删除
       全部在弹窗内分层完成——不弹居中选择器、不套二层弹窗（层级与锁滚动的坑已固化进规则）。
       图片点一下即选用并关闭；上传成功自动选用（延续「点图即换」的快路径）。 -->
  <BottomSheet :show="show" wide @update:show="$emit('update:show', $event)" @close="$emit('close')">
    <div class="al" @touchmove.stop>
      <div class="al-head">
        <b class="al-title">素材库</b>
        <button type="button" class="al-done" @click="close">完成</button>
      </div>

      <!-- 分组行：全部 / 未分组 / 自定义分组（点选即过滤）＋ 新建分组 -->
      <div v-if="!moveView" class="al-chips">
        <button type="button" class="al-chip" :class="{ on: cur === 'all' }" @click="switchGroup('all')">全部</button>
        <button type="button" class="al-chip" :class="{ on: cur === 'none' }" @click="switchGroup('none')">未分组</button>
        <button v-for="g in groups" :key="g.id" type="button" class="al-chip" :class="{ on: cur === g.id }" @click="switchGroup(g.id)">{{ g.name }}</button>
        <button type="button" class="al-chip al-chip-add" @click="ngOpen = !ngOpen">＋ 分组</button>
      </div>
      <div v-if="ngOpen && !moveView" class="al-ng">
        <input v-model="ngName" class="al-ng-input" maxlength="12" placeholder="分组名称" @keyup.enter="createGroup" />
        <button type="button" class="al-ng-ok" :disabled="ngBusy || !ngName.trim()" @click="createGroup">确定</button>
      </div>

      <!-- 移动分组视图：列表即选，选完回网格 -->
      <div v-if="moveView" class="al-move">
        <p class="al-move-tip">把这张图片移到</p>
        <button v-for="t in moveTargets" :key="String(t.v)" type="button" class="al-move-opt" :class="{ on: t.v === menuFor?.group_id }" @click="doMove(t.v)">{{ t.l }}</button>
        <button type="button" class="al-move-back" @click="moveView = false">返回</button>
      </div>

      <div v-else class="al-grid">
        <div class="al-cell al-upload" @click="pickFile">
          <span class="al-up">
            <i class="al-plus">＋</i>
            <span>{{ uploading ? '上传中…' : '上传图片' }}</span>
          </span>
        </div>
        <div v-for="it in items" :key="it.id" class="al-cell">
          <img :src="it.url" alt="素材图片" @click="choose(it)" />
          <button type="button" class="al-more" aria-label="图片操作" @click.stop="openMenu(it)">⋯</button>
        </div>
      </div>
      <p v-if="!loading && !moveView && !items.length" class="al-empty">
        {{ cur === 'all' ? '素材库还是空的，点「上传图片」添加第一张' : '这个分组还没有图片' }}
      </p>

      <!-- 图片操作条（弹窗内步骤条，不套二层弹窗） -->
      <div v-if="menuFor && !moveView" class="al-bar">
        <template v-if="!delConfirm">
          <button type="button" class="al-bar-btn" @click="moveView = true">移动到分组</button>
          <button type="button" class="al-bar-btn al-danger" @click="delConfirm = true">删除图片</button>
          <button type="button" class="al-bar-btn al-plain" @click="menuFor = null">取消</button>
        </template>
        <template v-else>
          <span class="al-del-tip">仅从素材库移除，页面里已使用的图片不受影响</span>
          <button type="button" class="al-bar-btn al-danger-solid" @click="doDelete">确认删除</button>
          <button type="button" class="al-bar-btn al-plain" @click="menuFor = null; delConfirm = false">取消</button>
        </template>
      </div>

      <input ref="fileEl" type="file" accept="image/png,image/jpeg,image/webp,image/gif" style="display:none" @change="onFile" />
    </div>
  </BottomSheet>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import BottomSheet from './BottomSheet.vue'
import api from '../api'
import { showToast } from '../store'

const props = defineProps({ show: { type: Boolean, default: false } })
const emit = defineEmits(['select', 'update:show', 'close'])

const groups = ref([])
const items = ref([])
const cur = ref('all') // 'all' | 'none' | 分组id
const loading = ref(false)
const uploading = ref(false)
const ngOpen = ref(false)
const ngName = ref('')
const ngBusy = ref(false)
const menuFor = ref(null) // 当前操作的素材
const moveView = ref(false)
const delConfirm = ref(false)
const fileEl = ref(null)

watch(() => props.show, v => {
  if (v) { cur.value = 'all'; load() }
  else { menuFor.value = null; moveView.value = false; delConfirm.value = false; ngOpen.value = false; ngName.value = '' }
})

async function load() {
  if (loading.value) return
  loading.value = true
  try {
    const { data } = await api.get('/api/assets', { params: { group: cur.value } })
    groups.value = data?.data?.groups || []
    items.value = data?.data?.items || []
  } catch (e) { showToast(e?.message || '素材库加载失败', 'error') } finally { loading.value = false }
}

function switchGroup(g) { if (cur.value === g) return; cur.value = g; load() }
function close() { emit('update:show', false); emit('close') }
function choose(it) { emit('select', it.url); close() }

function pickFile() { if (!uploading.value) fileEl.value?.click() }
async function onFile(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file || uploading.value) return
  uploading.value = true
  try {
    const fd = new FormData()
    fd.append('file', file)
    const { data } = await api.post('/api/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    const up = data?.data
    if (!up?.url) throw new Error('上传失败：未返回地址')
    // 入库：落在当前选中的分组（全部/未分组 → 未分组）
    const gid = typeof cur.value === 'number' ? cur.value : null
    await api.post('/api/assets', { url: up.url, name: up.name || '', width: up.width || 0, height: up.height || 0, group_id: gid })
    emit('select', up.url)
    close()
  } catch (err) { showToast(err?.message || '上传失败', 'error') } finally { uploading.value = false }
}

async function createGroup() {
  const name = ngName.value.trim()
  if (!name || ngBusy.value) return
  ngBusy.value = true
  try {
    await api.post('/api/assets/groups', { name })
    ngOpen.value = false; ngName.value = ''
    await load()
  } catch (e) { showToast(e?.message || '创建失败', 'error') } finally { ngBusy.value = false }
}

function openMenu(it) { menuFor.value = it; delConfirm.value = false; moveView.value = false }
const moveTargets = computed(() => [
  { v: 'none', l: '未分组' },
  ...groups.value.filter(g => g.id !== menuFor.value?.group_id).map(g => ({ v: g.id, l: g.name }))
])
async function doMove(v) {
  if (!menuFor.value) return
  try {
    await api.put(`/api/assets/${menuFor.value.id}`, { group_id: v === 'none' ? null : v })
    menuFor.value = null; moveView.value = false
    await load()
  } catch (e) { showToast(e?.message || '移动失败', 'error') }
}
async function doDelete() {
  if (!menuFor.value) return
  try {
    await api.delete(`/api/assets/${menuFor.value.id}`)
    menuFor.value = null; delConfirm.value = false
    await load()
  } catch (e) { showToast(e?.message || '删除失败', 'error') }
}
</script>

<style scoped>
/* 轻奢去线条：分割靠留白与暖中性浅填充（#f5f3f0），不用描边/分割线；内边距 ≥16px 不贴边 */
.al { display: flex; flex-direction: column; }
.al-head { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px 4px; }
.al-title { font-size: 16px; font-weight: 800; color: #1f2937; letter-spacing: 2px; }
.al-done { border: 0; background: none; padding: 6px 4px; font-size: 14px; font-weight: 700; color: var(--primary, #a62b2b); cursor: pointer; -webkit-tap-highlight-color: transparent; }
.al-chips { display: flex; align-items: center; gap: 8px; padding: 10px 20px 0; overflow-x: auto; -webkit-overflow-scrolling: touch; }
.al-chips::-webkit-scrollbar { display: none; }
.al-chip { flex: 0 0 auto; border: 0; padding: 7px 14px; border-radius: 999px; background: #f5f3f0; color: #4b5563; font-size: 13px; font-weight: 600; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.al-chip.on { background: var(--primary, #a62b2b); color: #fff; }
.al-chip-add { color: var(--primary, #a62b2b); }
.al-ng { display: flex; align-items: center; gap: 8px; padding: 10px 20px 0; }
.al-ng-input { flex: 1; height: 38px; border: 0; border-radius: 999px; background: #f5f3f0; padding: 0 14px; font-size: 14px; color: #1f2937; outline: none; }
.al-ng-ok { border: 0; height: 38px; padding: 0 18px; border-radius: 999px; background: var(--primary, #a62b2b); color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; }
.al-ng-ok:disabled { opacity: .5; }
.al-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 12px 20px 6px; max-height: 44vh; overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
/* aspect-ratio 老内核不认：用 padding-bottom 撑方形（兼容口径） */
.al-cell { position: relative; width: 100%; padding-bottom: 100%; border-radius: 12px; overflow: hidden; background: #f5f3f0; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.al-cell img { position: absolute; top: 0; right: 0; bottom: 0; left: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
.al-cell:active { opacity: .85; }
.al-up { position: absolute; top: 0; right: 0; bottom: 0; left: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; color: #8a8f98; font-size: 11px; font-weight: 600; }
.al-plus { font-style: normal; font-size: 22px; line-height: 1; color: #b3b8c0; }
.al-more { position: absolute; top: 4px; right: 4px; width: 20px; height: 20px; border: 0; border-radius: 50%; background: rgba(38,42,51,.55); color: #fff; font-size: 12px; line-height: 1; display: grid; place-items: center; padding: 0; cursor: pointer; }
.al-empty { margin: 6px 20px 14px; font-size: 13px; color: #a9afb9; text-align: center; }
/* 移动分组视图 */
.al-move { padding: 6px 20px 12px; max-height: 44vh; overflow-y: auto; overscroll-behavior: contain; }
.al-move-tip { margin: 4px 0 10px; font-size: 13px; color: #8a8f98; }
.al-move-opt { width: 100%; border: 0; text-align: left; padding: 13px 16px; border-radius: 12px; background: #f5f3f0; color: #1f2937; font-size: 14px; font-weight: 600; margin-bottom: 8px; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.al-move-opt.on { color: var(--primary, #a62b2b); font-weight: 800; }
.al-move-back { width: 100%; border: 0; background: none; padding: 10px; font-size: 13px; font-weight: 700; color: #8a8f98; cursor: pointer; }
/* 图片操作条 */
.al-bar { display: flex; align-items: center; gap: 10px; padding: 6px 20px 14px; }
.al-bar-btn { flex: 0 0 auto; border: 0; height: 40px; padding: 0 16px; border-radius: 999px; background: #f5f3f0; color: #1f2937; font-size: 13px; font-weight: 700; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.al-bar-btn.al-danger { color: #b91c1c; }
.al-bar-btn.al-plain { background: none; color: #8a8f98; }
.al-bar-btn.al-danger-solid { background: #b91c1c; color: #fff; }
.al-del-tip { flex: 1; font-size: 11px; color: #a9afb9; line-height: 1.5; }
/* PC 桌面壳宽屏：网格多列铺满，弹窗仍限宽居中（BottomSheet.wide 720px） */
@media (min-width: 900px) {
  .al-grid { grid-template-columns: repeat(6, 1fr); }
}
</style>
