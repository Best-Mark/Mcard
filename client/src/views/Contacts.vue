<template>
  <div class="page">
    <header class="topbar">
      <router-link to="/me" class="brand">M<em>Card</em></router-link>
      <div class="spacer"></div>
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
            </div>
          </router-link>
          <div class="cc-side">
            <span class="src-badge" :class="c.source">{{ c.source === 'favorite' ? '收藏' : '交换' }}</span>
            <a v-if="c.mobile" :href="`tel:${c.mobile}`" class="btn btn-sm btn-ghost">拨号</a>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api'

const contacts = ref([])
const loading = ref(true)
const error = ref('')
const filter = ref('all')
let loadStarted = false
const filtered = computed(() => filter.value === 'all' ? contacts.value : contacts.value.filter(c => c.source === filter.value))

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
</style>
