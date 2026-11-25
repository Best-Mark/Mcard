<template>
  <div class="page">
    <header class="topbar">
      <router-link to="/me" class="brand">M<em>Card</em></router-link>
      <div class="spacer"></div>
      <button class="nav-menu-btn" aria-label="菜单" @click="toggleDrawer"><i class="menu-glyph"></i></button>
      <span class="small muted">我的名片夹</span>
    </header>
    <div class="container" style="margin-top:18px">
      <div class="card card-pad intro">
        <b>我的名片夹</b>
        <p class="small muted">这里集中管理你收藏的名片，以及和你交换过联系人的名片。点击任一名片即可查看完整资料、拨号或存入通讯录。</p>
      </div>

      <div v-if="loading" class="card card-pad center" style="margin-top:14px">加载中…</div>
      <div v-else-if="error" class="card card-pad center" style="margin-top:14px;padding:36px 16px">
        <b>加载失败</b>
        <p class="small muted">{{ error }}</p>
        <button class="btn btn-primary" style="margin-top:12px" @click="load">重新加载</button>
      </div>
      <div v-else-if="!contacts.length" class="card card-pad center" style="margin-top:14px;padding:44px 16px">
        <div style="font-size:40px;opacity:.25">☆</div>
        <h3 style="margin:10px 0">还没有收藏的名片</h3>
        <p class="small muted">扫到别人的名片后，点底部「收藏」即可存到这里。</p>
        <router-link to="/" class="btn btn-primary" style="margin-top:14px">去逛逛</router-link>
      </div>

      <template v-else>
        <div class="list-head">
          <span>共 {{ contacts.length }} 张名片</span>
          <div class="filter">
            <button :class="{ on: filter === 'all' }" @click="filter = 'all'">全部</button>
            <button :class="{ on: filter === 'favorite' }" @click="filter = 'favorite'">收藏</button>
            <button :class="{ on: filter === 'exchange' }" @click="filter = 'exchange'">交换</button>
          </div>
        </div>
        <div v-for="c in filtered" :key="c.slug" class="card contact-card">
          <router-link :to="`/c/${c.slug}`" class="cc-main">
            <div class="cc-avatar">
              <img v-if="c.avatar" :src="c.avatar" :alt="c.name" />
              <span v-else>{{ (c.name || '名').slice(0, 1) }}</span>
            </div>
            <div class="cc-info">
              <b>{{ c.name || '未填写姓名' }}</b>
              <span class="small muted">{{ [c.title, c.company].filter(Boolean).join(' · ') || '暂无职位信息' }}</span>
              <span v-if="c.mobile" class="small mono">{{ c.mobile }}</span>
              <div v-if="c.tags?.length" class="cc-tags"><i v-for="tag in c.tags" :key="tag">{{ tag }}</i></div>
              <span v-if="c.note" class="small cc-note">备注：{{ c.note }}</span>
            </div>
          </router-link>
          <div class="cc-side">
            <span class="src-badge" :class="c.source">{{ c.source === 'favorite' ? '收藏' : '交换' }}</span>
            <a v-if="c.mobile" :href="`tel:${c.mobile}`" class="btn btn-sm btn-ghost">拨号</a>
            <button v-if="c.source === 'favorite'" class="btn btn-sm btn-ghost" @click="editContact(c)">标注</button>
          </div>
        </div>
      </template>
    </div>

    <div v-if="editOpen" class="modal-mask" @click.self="editOpen = false">
      <div class="modal">
        <h3>标注名片</h3>
        <div class="field" style="margin-top:12px"><label>标签（逗号分隔）</label>
          <input v-model="editTags" class="input" placeholder="如 客户,潜在合作" />
        </div>
        <div class="field"><label>备注</label>
          <input v-model="editNote" class="input" maxlength="200" placeholder="在哪里认识、跟进事项…" />
        </div>
        <div class="btn-row" style="justify-content:flex-end;margin-top:14px">
          <button class="btn btn-ghost" @click="editOpen = false">取消</button>
          <button class="btn btn-primary" :disabled="saving" @click="saveContact">{{ saving ? '保存中…' : '保存' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api'
import { toggleDrawer, showToast } from '../store'

const contacts = ref([])
const loading = ref(true)
const error = ref('')
const filter = ref('all')
const editOpen = ref(false)
const editSlug = ref('')
const editTags = ref('')
const editNote = ref('')
const saving = ref(false)
let loadStarted = false
const filtered = computed(() => filter.value === 'all' ? contacts.value : contacts.value.filter(c => c.source === filter.value))

function editContact(c) {
  editSlug.value = c.slug
  editTags.value = (c.tags || []).join(', ')
  editNote.value = c.note || ''
  editOpen.value = true
}
async function saveContact() {
  if (saving.value) return
  saving.value = true
  try {
    const tags = editTags.value.split(/[,，]/).map(s => s.trim()).filter(Boolean).slice(0, 8)
    await api.put(`/api/cards/mine/contacts/${editSlug.value}`, { tags, note: editNote.value.trim() })
    const c = contacts.value.find(x => x.slug === editSlug.value)
    if (c) { c.tags = tags; c.note = editNote.value.trim() }
    editOpen.value = false
    showToast('标注已保存', 'success')
  } catch (e) { showToast(e.message || '保存失败', 'error') } finally { saving.value = false }
}

async function load() {
  if (loadStarted && loading.value) return
  loadStarted = true
  loading.value = true
  error.value = ''
  try { contacts.value = (await api.get('/api/cards/mine/contacts')).data.data?.contacts || [] }
  catch (e) { error.value = e.message || '网络异常' }
  finally { loading.value = false }
}
onMounted(load)
</script>

<style scoped>
.intro b { font-size: 16px; }
.intro p { margin-top: 6px; line-height: 1.6; }
.list-head { display: flex; align-items: center; justify-content: space-between; margin: 16px 0 10px; font-size: 13px; color: var(--muted); }
.filter { display: flex; gap: 6px; }
.filter button { padding: 5px 12px; border-radius: 999px; border: 1px solid var(--line); font-size: 12px; color: var(--muted); }
.filter button.on { background: var(--primary); color: #fff; border-color: var(--primary); }
.contact-card { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; padding: 14px; }
.cc-main { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }
.cc-avatar { width: 48px; height: 48px; flex: 0 0 48px; border-radius: 12px; overflow: hidden; background: var(--primary); color: #fff; display: grid; place-items: center; font-size: 20px; font-weight: 700; }
.cc-avatar img { width: 100%; height: 100%; object-fit: cover; }
.cc-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.cc-info b { font-size: 15px; }
.cc-side { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; flex: 0 0 auto; }
.src-badge { font-size: 10px; padding: 3px 8px; border-radius: 999px; }
.src-badge.favorite { background: #fffbeb; color: #b45309; }
.src-badge.exchange { background: #eff6ff; color: #1d4ed8; }
.cc-tags { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 3px; }
.cc-tags i { font-style: normal; font-size: 10px; padding: 2px 7px; border-radius: 999px; background: #eef2ff; background: color-mix(in srgb, var(--primary) 12%, transparent); color: var(--primary); }
.cc-note { color: var(--muted); margin-top: 3px; }
.modal-mask { position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,.55); display: grid; place-items: center; padding: 20px; }
.modal { width: 100%; max-width: 360px; background: var(--bg-card, #fff); border-radius: 14px; padding: 20px; }
.modal h3 { margin: 0; font-size: 16px; }
.field { margin-top: 12px; }
.field label { display: block; font-size: 13px; margin-bottom: 5px; }
</style>
