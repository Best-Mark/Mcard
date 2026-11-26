<template>
  <view class="page">
    <view class="head">
      <view class="title">我的名片夹</view>
      <view class="sub">收藏或交换过的名片，点开即可查看完整资料</view>
    </view>

    <view v-if="needLogin" class="state">
      <view class="empty">▦</view>
      <view class="b">登录后可查看我的名片夹</view>
      <view class="hint">收藏和交换过的名片会存到这里</view>
      <button class="btn primary" style="margin-top:24rpx" @tap="goLogin">去登录</button>
    </view>
    <view v-else-if="loading" class="state">加载中…</view>
    <view v-else-if="error" class="state">
      <view>加载失败：{{ error }}</view>
      <button class="btn tiny primary" style="margin-top:20rpx" @tap="load">重新加载</button>
    </view>
    <view v-else-if="!list.length" class="state">
      <view class="empty">☆</view>
      <view class="b">还没有收藏的名片</view>
      <view class="hint">去集市看到喜欢的名片，点底部「收藏」即可存到这里</view>
      <button class="btn primary" style="margin-top:24rpx" @tap="goMarket">去逛逛名片集市</button>
    </view>
    <block v-else>
      <view class="filters">
        <text class="f" :class="{ on: filter === 'all' }" @tap="filter = 'all'">全部 {{ list.length }}</text>
        <text class="f" :class="{ on: filter === 'favorite' }" @tap="filter = 'favorite'">收藏 {{ favCount }}</text>
        <text class="f" :class="{ on: filter === 'exchange' }" @tap="filter = 'exchange'">交换 {{ exCount }}</text>
      </view>
      <view class="list">
        <view v-for="c in filtered" :key="c.slug" class="item" @tap="openCard(c.slug)">
          <view class="avatar">
            <image v-if="c.avatar || c.logo" :src="c.avatar || c.logo" mode="aspectFill" />
            <text v-else>{{ (c.name || '名').slice(0, 1) }}</text>
          </view>
          <view class="body">
            <view class="name">{{ c.name || '未填写姓名' }}</view>
            <view class="sub">{{ [c.title, c.company].filter(Boolean).join(' · ') || '暂无职位信息' }}</view>
            <view v-if="c.mobile" class="mobile">{{ c.mobile }}</view>
            <view v-if="c.tags && c.tags.length" class="tags">
              <text v-for="tag in c.tags" :key="tag">{{ tag }}</text>
            </view>
            <view v-if="c.note" class="note">备注：{{ c.note }}</view>
          </view>
          <view class="side">
            <text class="src" :class="c.source">{{ c.source === 'favorite' ? '收藏' : '交换' }}</text>
            <text v-if="c.mobile" class="call" @tap.stop="call(c.mobile)">拨号</text>
            <text v-if="c.source === 'favorite'" class="mark" @tap.stop="edit(c)">标注</text>
          </view>
        </view>
      </view>
    </block>

    <!-- 标注弹层：收藏名片的标签与备注（与 H5 Contacts.vue 同口径） -->
    <view v-if="editOpen" class="mask" @tap.self="editOpen = false">
      <view class="sheet">
        <view class="sheet-head"><text>标注名片</text><text class="x" @tap="editOpen = false">✕</text></view>
        <view class="field"><text class="label">标签（逗号分隔）</text><input v-model="editTags" class="input" placeholder="如 客户,潜在合作" /></view>
        <view class="field"><text class="label">备注</text><input v-model="editNote" class="input" maxlength="200" placeholder="在哪里认识、跟进事项…" /></view>
        <button class="btn primary block" :disabled="saving" @tap="save">{{ saving ? '保存中…' : '保存' }}</button>
      </view>
    </view>

    <TabBar active="contacts" />
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api, toast, callPhone, isLogged, ensureLogin } from '../../utils/request'
import TabBar from '../../components/TabBar/TabBar.vue'

const list = ref([])
const loading = ref(true)
const needLogin = ref(false)
const error = ref('')
const filter = ref('all')
const editOpen = ref(false)
const editSlug = ref('')
const editTags = ref('')
const editNote = ref('')
const saving = ref(false)
const favCount = computed(() => list.value.filter(c => c.source === 'favorite').length)
const exCount = computed(() => list.value.filter(c => c.source === 'exchange').length)
const filtered = computed(() => filter.value === 'all' ? list.value : list.value.filter(c => c.source === filter.value))

async function load() {
  needLogin.value = !isLogged()
  if (needLogin.value) { loading.value = false; return }
  loading.value = true; error.value = ''
  try { list.value = (await api.get('/api/cards/mine/contacts', true))?.contacts || [] }
  catch (e) { error.value = e.message || '网络异常' }
  finally { loading.value = false }
}
function goLogin() { ensureLogin('/pages/contacts/contacts') }
onShow(load)

function openCard(slug) { uni.navigateTo({ url: '/pages/card/card?slug=' + slug }) }
function goMarket() { uni.reLaunch({ url: '/pages/market/market' }) }
function call(phone) { callPhone(phone) }
function edit(c) {
  editSlug.value = c.slug
  editTags.value = (c.tags || []).join(', ')
  editNote.value = c.note || ''
  editOpen.value = true
}
async function save() {
  if (saving.value) return
  saving.value = true
  try {
    const tags = editTags.value.split(/[,，]/).map(s => s.trim()).filter(Boolean).slice(0, 8)
    const note = editNote.value.trim()
    await api.put('/api/cards/mine/contacts/' + editSlug.value, { tags, note }, true)
    const c = list.value.find(x => x.slug === editSlug.value)
    if (c) { c.tags = tags; c.note = note }
    editOpen.value = false
    toast('标注已保存', 'success')
  } catch (e) { toast(e.message || '保存失败') }
  finally { saving.value = false }
}
</script>

<style scoped>
.page { min-height: 100vh; background: #f5f7fb; padding-bottom: 160rpx; }
.head { padding: 30rpx 28rpx 24rpx; background: linear-gradient(135deg,#17357c,#2563eb); color: #fff; }
.title { font-size: 38rpx; font-weight: 800; }
.sub { font-size: 23rpx; opacity: .85; margin-top: 8rpx; }
.state { text-align: center; padding: 120rpx 40rpx; color: #6b7688; font-size: 26rpx; }
.state .b { display: block; font-size: 32rpx; font-weight: 700; color: #0f172a; margin: 20rpx 0 8rpx; }
.state .hint { display: block; font-size: 24rpx; line-height: 1.6; }
.state .empty { font-size: 100rpx; color: #cbd5e1; }
.filters { display: flex; gap: 14rpx; padding: 20rpx 24rpx 8rpx; }
.f { font-size: 24rpx; padding: 10rpx 22rpx; border-radius: 999rpx; background: #fff; color: #6b7688; border: 2rpx solid #e8edf4; }
.f.on { background: #2563eb; border-color: #2563eb; color: #fff; font-weight: 700; }
.list { padding: 12rpx 24rpx 30rpx; }
.item { display: flex; gap: 18rpx; align-items: flex-start; background: #fff; border: 2rpx solid #e8edf4; border-radius: 20rpx; padding: 24rpx; margin-bottom: 16rpx; }
.avatar { width: 88rpx; height: 88rpx; border-radius: 18rpx; background: #2563eb; color: #fff; font-size: 38rpx; font-weight: 800; overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
.avatar image { width: 100%; height: 100%; }
.body { flex: 1; min-width: 0; }
.name { font-size: 30rpx; font-weight: 800; }
.body .sub { font-size: 23rpx; color: #6b7688; margin-top: 4rpx; }
.mobile { font-size: 23rpx; color: #6b7688; margin-top: 6rpx; font-family: monospace; }
.tags { display: flex; gap: 8rpx; flex-wrap: wrap; margin-top: 10rpx; }
.tags text { font-size: 20rpx; padding: 4rpx 12rpx; border-radius: 8rpx; background: #eff6ff; color: #2563eb; }
.note { font-size: 22rpx; color: #94a3b8; margin-top: 8rpx; }
.side { flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 12rpx; }
.src { font-size: 20rpx; padding: 4rpx 12rpx; border-radius: 999rpx; }
.src.favorite { background: #fef3c7; color: #b45309; }
.src.exchange { background: #dcfce7; color: #047857; }
.call, .mark { font-size: 22rpx; color: #2563eb; }
.mask { position: fixed; left: 0; right: 0; top: 0; bottom: 0; z-index: 120; background: rgba(15,23,42,.5); display: flex; align-items: flex-end; }
.sheet { width: 100%; background: #fff; border-radius: 28rpx 28rpx 0 0; padding: 28rpx 28rpx calc(28rpx + env(safe-area-inset-bottom, 0px)); }
.sheet-head { display: flex; justify-content: space-between; align-items: center; font-size: 32rpx; font-weight: 800; margin-bottom: 24rpx; }
.sheet-head .x { font-size: 28rpx; color: #94a3b8; }
.field { margin-bottom: 22rpx; }
.label { display: block; font-size: 24rpx; color: #6b7688; margin-bottom: 10rpx; font-weight: 600; }
.input { width: 100%; height: 84rpx; line-height: 84rpx; box-sizing: border-box; border: 2rpx solid #e8edf4; border-radius: 12rpx; padding: 0 20rpx; font-size: 26rpx; }
.btn { font-size: 26rpx; padding: 18rpx 0; border-radius: 14rpx; background: #eef2f7; }
.btn::after { border: 0; }
.btn.primary { background: #2563eb; color: #fff; }
.btn.tiny { padding: 12rpx 28rpx; }
.btn.block { width: 100%; }
</style>
