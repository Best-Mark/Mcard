// 名片布局模板清单 —— 模板 key 的唯一真相源。
// 注意：这是「布局形态」，与配色主题 theme（ocean/ink/...）是两个独立维度，
// 一张名片 = 一个 template + 一个 theme，可自由组合。
// 前端编辑器通过 GET /api/cards/public/templates 拉取本清单渲染选择器，不各自硬编码 key。
const CARD_TEMPLATES = [
  {
    key: 'classic',
    label: '经典商务',
    desc: '渐变封面 + 头像信息，稳重通用，任何行业都合适',
    cover: 'linear-gradient(135deg,#17357c 0%,#2563eb 55%,#38bdf8 100%)'
  },
  {
    key: 'minimal',
    label: '极简素雅',
    desc: '大留白、细分割线、无封面，克制的现代高级感',
    cover: 'linear-gradient(135deg,#f8fafc 0%,#e2e8f0 100%)'
  },
  {
    key: 'elite',
    label: '尊享黑金',
    desc: '深色沉浸封面 + 金色描边，商务高端气场',
    cover: 'linear-gradient(135deg,#1c1917 0%,#3f3f46 50%,#b48b20 100%)'
  },
  {
    key: 'vivid',
    label: '活力格调',
    desc: '大圆角封面 + 悬浮头像，年轻、有记忆点',
    cover: 'linear-gradient(135deg,#7c3aed 0%,#db2777 55%,#f59e0b 100%)'
  },
  {
    key: 'seal',
    label: '印章方格',
    desc: '深蓝方块印章风，几何对称、稳重有辨识度',
    cover: 'linear-gradient(135deg,#0f172a 0%,#1e3a8a 55%,#3b82f6 100%)'
  },
  {
    key: 'contact',
    label: '联络卡',
    desc: '简洁商务联络卡，身份+业务标签+拨号/复制/存档，扫码即联系',
    cover: 'linear-gradient(135deg,#0b1a3a 0%,#1e40af 55%,#3b82f6 100%)'
  },
  {
    key: 'navygold',
    label: '深蓝鎏金',
    desc: '深蓝底 + 沙金描边参考名片，顶部金线、淡水印、业务标签与表格化联系方式',
    cover: 'linear-gradient(135deg,#1d3a55 0%,#2f5a7d 40%,#d8bb85 78%,#b99355 100%)'
  }
]

const TEMPLATE_KEYS = CARD_TEMPLATES.map(t => t.key)
const DEFAULT_TEMPLATE = 'classic'
const isTemplate = key => TEMPLATE_KEYS.includes(key)
const normalizeTemplate = key => (isTemplate(key) ? key : DEFAULT_TEMPLATE)

module.exports = { CARD_TEMPLATES, TEMPLATE_KEYS, DEFAULT_TEMPLATE, isTemplate, normalizeTemplate }
