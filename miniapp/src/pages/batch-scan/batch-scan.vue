<template>
  <view class="page">
    <view class="bar">
      <text class="back" @tap="back">‹</text>
      <text class="title">展会连扫收名片</text>
    </view>

    <view class="intro card">
      <text class="b">一次参会，批量收名片</text>
      <text class="muted small">连续扫描对方名片二维码或粘贴链接，统一打标签写备注，一次存进名片夹。</text>
      <button class="btn primary block" style="margin-top:24rpx" :disabled="scanning" @tap="wxScan">{{ scanning ? '扫码中…' : '📷 扫一扫，添加名片' }}</button>
      <view class="manual">
        <input v-model.trim="manual" class="input" placeholder="或粘贴名片链接/短码，点添加" />
        <button class="btn" :disabled="!manual" @tap="addManual">添加</button>
      </view>
    </view>

    <view class="card">
      <view class="lhead"><text class="b">本次已收集 {{ collected.length }} 张</text><text v-if="collected.length" class="clear" @tap="collected = []">清空</text></view>
      <view v-if="!collected.length" class="muted small" style="padding:20rpx 0">还没有扫描到名片。</view>
      <view v-for="(s, i) in collected" :key="s + i" class="chip"><text class="mono">{{ s }}</text><text @tap="collected.splice(i, 1)">✕</text></view>

      <view class="field"><text class="lbl">统一标签（逗号分隔）</text><input v-model="tagsText" class="input" placeholder="如 展会,潜在客户" /></view>
      <view class="field"><text class="lbl">统一备注</text><input v-model="note" class="input" maxlength="200" placeholder="如：2026 上海展会认识" /></view>
      <button class="btn primary block" style="margin-top:16rpx" :disabled="saving || !collected.length" @tap="submit">{{ saving ? '保存中…' : '保存到名片夹（' + collected.length + ' 张）' }}</button>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { parseSlug, batchSaveContacts, toast, ensureLogin } from '../../utils/request'

// 展会连扫保存进名片夹需要登录：进页面就拦，不让用户扫一堆再在保存时 401 全丢
onLoad(() => { ensureLogin('/pages/batch-scan/batch-scan') })

const collected = ref([])
const manual = ref('')
const tagsText = ref('')
const note = ref('')
const scanning = ref(false)
const saving = ref(false)

function addSlug(slug) {
  if (!slug) return toast('没识别到名片短码')
  if (collected.value.includes(slug)) return toast('这张已在列表里')
  collected.value.push(slug)
}
function addManual() { addSlug(parseSlug(manual.value)); manual.value = '' }
function wxScan() {
  if (scanning.value) return
  scanning.value = true
  uni.scanCode({
    success: res => {
      const slug = parseSlug(res.result || '')
      if (slug) { addSlug(slug); toast('已收集，可继续扫下一张', 'success') }
      else toast('二维码不是本系统的名片')
    },
    fail: err => { if (!/cancel/i.test(err.errMsg || '')) toast('扫码失败') },
    complete: () => { scanning.value = false }
  })
}
async function submit() {
  if (saving.value) return
  saving.value = true
  try {
    const tags = tagsText.value.split(/[,，]/).map(s => s.trim()).filter(Boolean).slice(0, 8)
    const d = await batchSaveContacts(collected.value, tags, note.value.trim())
    toast(`已存 ${d.added || 0} 张${d.updated ? '，更新 ' + d.updated + ' 张' : ''}`, 'success')
    collected.value = []
    setTimeout(() => uni.navigateBack(), 600)
  } catch (e) { toast(e.message || '保存失败') } finally { saving.value = false }
}
function back() { uni.navigateBack() }
</script>

<style scoped>
.page { min-height: 100vh; background: #f5f7fb; padding-bottom: 60rpx; }
.bar { height: 88rpx; display: flex; align-items: center; gap: 20rpx; padding: 0 28rpx; background: #fff; border-bottom: 1rpx solid #e8edf4; }
.back { font-size: 48rpx; color: #2563eb; }
.title { font-size: 30rpx; font-weight: 700; }
.card { background: #fff; border-radius: 16rpx; padding: 24rpx; margin: 20rpx 24rpx; }
.b { font-size: 28rpx; font-weight: 600; }
.intro .muted { display: block; margin-top: 10rpx; line-height: 1.5; }
.muted { color: #94a3b8; }
.small { font-size: 24rpx; }
.btn { font-size: 26rpx; padding: 14rpx 0; border-radius: 10rpx; background: #f1f5f9; color: #334155; text-align: center; }
.btn.primary { background: #2563eb; color: #fff; }
.btn.block { width: 100%; }
.manual { display: flex; gap: 12rpx; margin-top: 20rpx; }
.input { flex: 1; height: 76rpx; line-height: 76rpx; border: 1rpx solid #e2e8f0; border-radius: 10rpx; padding: 0 16rpx; font-size: 26rpx; background: #fff; box-sizing: border-box; }
.lhead { display: flex; justify-content: space-between; margin-bottom: 12rpx; }
.clear { color: #2563eb; font-size: 24rpx; }
.chip { display: flex; justify-content: space-between; padding: 14rpx 18rpx; background: #f4f6fb; border-radius: 10rpx; margin-bottom: 10rpx; font-size: 26rpx; }
.mono { font-family: monospace; }
.field { margin-top: 18rpx; }
.lbl { display: block; font-size: 24rpx; margin-bottom: 8rpx; color: #64748b; }
.field .input { width: 100%; box-sizing: border-box; }
</style>
