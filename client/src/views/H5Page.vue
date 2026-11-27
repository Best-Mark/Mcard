<template>
  <!-- H5 宣传页公开访问（免登录）：/h5/:slug。渲染全权交给 H5Render（与编辑器预览同一真相源）；
       本壳只负责拉数据、微信分享卡、访问错误态。加载态/错误态用深底避免白屏闪。 -->
  <div class="h5p">
    <div v-if="loading" class="h5p-state">加载中…</div>
    <div v-else-if="error" class="h5p-state">
      <b>{{ error }}</b>
      <p class="small">链接可能已失效，或该宣传页尚未发布。</p>
    </div>
    <H5Render v-else-if="data" :data="data" class="h5p-render" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '../api'
import H5Render from '../components/H5Render.vue'
import { setupWechatShare } from '../utils/wx-share'

const route = useRoute()
const loading = ref(true)
const error = ref('')
const data = ref(null)

onMounted(async () => {
  try {
    const { data: body } = await api.get(`/api/h5/public/${encodeURIComponent(route.params.slug)}`)
    data.value = body.data
    if (typeof document !== 'undefined') document.title = data.value?.page?.title || '宣传页'
    // 分享卡：标题=宣传页标题；封面优先宣传页里的第一张实图（封面/首图），回落名片头像；链接=本页干净地址
    const s = data.value?.page?.schema || {}
    const firstImg = (s.pages || []).flatMap(p => p.blocks || [])
      .map(b => b.cover || b.image || (Array.isArray(b.images) ? b.images[0] : ''))
      .find(u => u && /^https?:|^\/uploads\//.test(u))
    setupWechatShare(api, {
      title: data.value?.page?.title || '宣传页',
      desc: data.value?.card?.company || '',
      link: `${window.location.origin}/h5/${route.params.slug}`,
      imgCandidates: [firstImg, data.value?.card?.avatar]
    })
  } catch (e) {
    error.value = e?.message || '加载失败'
  } finally { loading.value = false }
})
</script>

<style scoped>
.h5p { height: 100svh; background: #0f1115; overflow: hidden; }
.h5p-render { height: 100%; }
.h5p-state { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: #d1d5db; padding: 24px; text-align: center; }
.h5p-state b { font-size: 17px; }
.h5p-state .small { color: #6b7280; }
</style>
