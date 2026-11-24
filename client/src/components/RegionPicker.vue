<template>
  <div class="rp-wrap">
    <div class="rp-cols">
      <div class="rp-col" v-for="col in columns" :key="col.level">
        <div class="rp-col-title">{{ col.title }}</div>
        <div class="rp-list">
          <button
            v-for="r in col.list" :key="r.code"
            :class="{ on: selected[r.level] && selected[r.level].code === r.code }"
            @click="pick(col.level, r)"
          >{{ r.name }}</button>
          <div v-if="!col.list.length" class="rp-empty small muted">无数据，可在后台区域管理添加</div>
        </div>
      </div>
    </div>
    <div class="rp-foot">
      <div class="rp-path small muted">{{ pathText || '请选择省 / 市 / 区 / 街道（可少选）' }}</div>
      <button class="btn btn-primary btn-sm" :disabled="!hasSelection" @click="confirm">确定</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api'

const props = defineProps({
  province: { type: String, default: '' },
  city: { type: String, default: '' },
  district: { type: String, default: '' },
  street: { type: String, default: '' }
})
const emit = defineEmits(['confirm', 'close'])

const all = ref([])
const loading = ref(true)
const selected = ref({ 1: null, 2: null, 3: null, 4: null })

const LEVEL_TITLES = { 1: '省 / 直辖市', 2: '城市', 3: '区 / 县', 4: '街道 / 乡镇' }

function childrenOf(level, parentCode) {
  return all.value.filter(r => r.level === level && (level === 1 ? !r.parent_code : r.parent_code === parentCode))
}

const columns = computed(() => {
  const cols = []
  for (let level = 1; level <= 4; level++) {
    const parent = level === 1 ? '' : (selected.value[level - 1]?.code || '')
    // 只有上一级选中了才展示下一级（第 1 级始终展示）
    if (level > 1 && !parent) break
    cols.push({ level, title: LEVEL_TITLES[level], list: childrenOf(level, parent) })
  }
  return cols
})

const pathText = computed(() => [1, 2, 3, 4].map(l => selected.value[l]?.name || '').filter(Boolean).join(' / '))
const hasSelection = computed(() => !!selected.value[1])

// 由传入的文本反查并定位各级选中项（编辑已有地址时回显）
function locateByText() {
  const find = (level, name, parentCode) => {
    if (!name) return null
    const list = childrenOf(level, parentCode)
    return list.find(r => r.name === name || r.name.includes(name) || name.includes(r.name)) || null
  }
  const p = find(1, props.province, '')
  if (p) {
    selected.value[1] = p
    const c = find(2, props.city, p.code)
    if (c) {
      selected.value[2] = c
      const d = find(3, props.district, c.code)
      if (d) {
        selected.value[3] = d
        const s = find(4, props.street, d.code)
        if (s) selected.value[4] = s
      }
    }
  }
}

function pick(level, region) {
  selected.value[level] = region
  // 清除更下级选择
  for (let l = level + 1; l <= 4; l++) selected.value[l] = null
}

function confirm() {
  const s = selected.value
  emit('confirm', {
    province: s[1]?.name || '',
    city: s[2]?.name || '',
    district: s[3]?.name || '',
    street: s[4]?.name || ''
  })
}

onMounted(async () => {
  try {
    const { data } = await api.get('/api/geo/regions')
    all.value = data?.data?.regions || []
  } catch { all.value = [] }
  finally { loading.value = false; locateByText() }
})
</script>

<style scoped>
.rp-wrap { min-height: 260px; }
.rp-cols { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.rp-col { min-width: 0; }
.rp-col-title { font-size: 12px; font-weight: 700; color: var(--primary, #2563eb); padding: 6px 8px; border-bottom: 2px solid var(--primary, #2563eb); margin-bottom: 6px; }
.rp-list { max-height: 240px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
.rp-list button { text-align: left; font-size: 13px; padding: 7px 8px; border-radius: 6px; color: var(--text, #0f172a); }
.rp-list button:hover { background: var(--bg-page, #f4f6fb); }
.rp-list button.on { background: var(--primary, #2563eb); color: #fff; font-weight: 700; }
.rp-empty { padding: 10px 8px; font-size: 11px; }
.rp-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--line, #e8edf4); }
.rp-path { flex: 1; min-width: 0; }
@media (max-width: 640px) {
  .rp-cols { grid-template-columns: repeat(2, 1fr); }
}
</style>
