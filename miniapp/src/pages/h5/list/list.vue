<template>
  <!-- 宣传页列表（与 H5 /me/h5 同构）：新建（官方模板）/ 编辑 / 发布 / 删除；闸门口径服务端下发 -->
  <view class="page">
    <view class="quota muted small">
      {{ paid ? `已开通套餐：可创建 ${limits.maxH5} 个、每个最多 ${limits.maxPages} 页，无水印` : `免费版：1 个宣传页、最多 ${limits.maxPages} 页、尾页带水印。开通套餐解锁更多` }}
      <text v-if="!paid" class="up" @tap="go('/pages/plans/plans')">去开通 ›</text>
    </view>

    <view v-if="loading" class="muted small center" style="padding:40rpx">加载中…</view>
    <view v-else-if="!list.length" class="empty">
      <view class="big">◈</view>
      <view class="b">还没有宣传页</view>
      <view class="hint">从官方模板一键创建，改改文字就能发布，访客看完直接跳你的名片</view>
      <button class="btn primary" @tap="newOpen = true">从模板创建</button>
    </view>
    <view v-else class="body">
      <view v-for="p in list" :key="p.id" class="card item">
        <view class="item-head">
          <text class="item-name">{{ p.title }}</text>
          <text class="badge" :class="{ on: p.status === 'published' }">{{ p.status === 'published' ? '已发布' : '草稿' }}</text>
        </view>
        <view class="muted small">{{ p.pages }} 页 · {{ p.view_count }} 次浏览</view>
        <view class="item-ops">
          <button class="btn tiny primary" @tap="go(`/pages/h5/edit/edit?id=${p.id}`)">编辑</button>
          <button v-if="p.status === 'draft'" class="btn tiny" :disabled="busy === p.id" @tap="toggle(p, 'publish')">发布</button>
          <button v-else class="btn tiny" :disabled="busy === p.id" @tap="toggle(p, 'unpublish')">下架</button>
          <button class="btn tiny danger" @tap="remove(p)">删除</button>
        </view>
      </view>
      <button class="btn primary block" @tap="newOpen = true">＋ 新建宣传页</button>
    </view>

    <!-- 新建：官方模板选择弹层 -->
    <view v-if="newOpen" class="mask" @tap="newOpen = false">
      <view class="sheet" @tap.stop>
        <view class="sheet-title">选择模板</view>
        <view class="tpl-grid">
          <view v-for="t in templates" :key="t.key" class="tpl" @tap="create(t)">
            <view class="tpl-dot" :style="{ background: t.accent }"></view>
            <text class="tpl-name">{{ t.name }}</text>
            <text class="muted small">{{ t.industry }} · {{ t.desc }}</text>
          </view>
        </view>
        <button class="btn ghost block" @tap="newOpen = false">取消</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { api, toast, ensureLogin } from '../../../utils/request'

const list = ref([]); const templates = ref([]); const loading = ref(true)
const busy = ref(0); const newOpen = ref(false); const creating = ref(false)
const paid = ref(false); const limits = ref({ maxH5: 10, maxPages: 12 })
const go = url => uni.navigateTo({ url })

onLoad(() => {
  if (!ensureLogin('/pages/h5/list/list')) return
  load()
})
async function load() {
  loading.value = true
  try {
    const d = await api.get('/api/h5/mine', true)
    list.value = d.list || []
    paid.value = !!d.limits?.paid
    if (d.limits) limits.value = d.limits
  } catch (e) { toast(e.message) } finally { loading.value = false }
}
async function create(tpl) {
  if (creating.value) return
  creating.value = true
  try {
    const d = await api.post('/api/h5', tpl ? { template_key: tpl.key, title: tpl.name } : {}, true)
    newOpen.value = false
    uni.redirectTo({ url: `/pages/h5/edit/edit?id=${d.page.id}` })
  } catch (e) { toast(e.message) } finally { creating.value = false }
}
async function toggle(p, action) {
  busy.value = p.id
  try { await api.post(`/api/h5/${p.id}/${action}`, {}, true); await load(); toast(action === 'publish' ? '已发布，链接已生效' : '已下架', 'success') }
  catch (e) { toast(e.message) } finally { busy.value = 0 }
}
async function remove(p) {
  // 小程序无 confirm 弹层组件，用 modal
  uni.showModal({
    title: '删除宣传页', content: `删除「${p.title}」？发布中的链接也会失效，不可恢复。`,
    success: async m => {
      if (!m.confirm) return
      busy.value = p.id
      try { await api.delete(`/api/h5/${p.id}`, true); await load() } catch (e) { toast(e.message) } finally { busy.value = 0 }
    }
  })
}
</script>

<style scoped>
.page { min-height: 100vh; background: #f7f2e7; padding-bottom: 40rpx; }
.quota { padding: 20rpx 24rpx 0; line-height: 1.6; }
.up { color: #a62b2b; font-weight: 700; margin-left: 8rpx; }
.empty { padding: 120rpx 40rpx; text-align: center; color: #8a7355; display: flex; flex-direction: column; align-items: center; gap: 10rpx; }
.empty .big { font-size: 90rpx; opacity: .3; }
.empty .b { font-size: 30rpx; font-weight: 700; color: #2b2118; }
.empty .hint { font-size: 24rpx; line-height: 1.6; }
.empty .btn { margin-top: 24rpx; width: 60%; }
.body { padding: 20rpx 24rpx; display: flex; flex-direction: column; gap: 16rpx; }
.item { background: #fff; border-radius: 16rpx; padding: 24rpx; }
.item-head { display: flex; align-items: center; gap: 12rpx; margin-bottom: 6rpx; }
.item-name { font-size: 28rpx; font-weight: 700; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.badge { font-size: 20rpx; padding: 4rpx 14rpx; border-radius: 999rpx; background: #fef3c7; color: #92400e; font-weight: 700; }
.badge.on { background: #dcfce7; color: #15803d; }
.item-ops { display: flex; gap: 12rpx; margin-top: 16rpx; }
.mask { position: fixed; inset: 0; background: rgba(15,23,42,.5); z-index: 100; display: flex; align-items: flex-end; }
.sheet { width: 100%; background: #fff; border-radius: 28rpx 28rpx 0 0; padding: 30rpx 24rpx calc(30rpx + env(safe-area-inset-bottom, 0px)); display: flex; flex-direction: column; gap: 16rpx; }
.sheet-title { font-size: 30rpx; font-weight: 700; text-align: center; }
.tpl-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14rpx; }
.tpl { border: 2rpx solid #e8dcc2; border-radius: 16rpx; padding: 20rpx; display: flex; flex-direction: column; gap: 6rpx; background: #fdf8ec; }
.tpl-dot { width: 20rpx; height: 20rpx; border-radius: 50%; }
.tpl-name { font-size: 26rpx; font-weight: 700; }
.center { text-align: center; }
.small { font-size: 22rpx; }
.muted { color: #8a7355; }
</style>
