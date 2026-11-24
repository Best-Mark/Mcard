// 名片布局模板清单 —— 模板 key 的唯一真相源。
// 注意：这是「布局形态」，与配色主题 theme（ocean/ink/...）是两个独立维度，
// 一张名片 = 一个 template + 一个 theme，可自由组合。
// 前端编辑器通过 GET /api/cards/public/templates 拉取本清单渲染选择器，不各自硬编码 key。
//
// 7 套模板对应 7 种主流设计范式，骨架（封面形态/头像位置/信息排布/底栏）彼此不同，
// 而不是只换颜色——换主题配色请选 theme，不要在这里堆相似模板。
const CARD_TEMPLATES = [
  {
    key: 'classic',
    label: '经典商务',
    desc: '渐变封面 + 头像信息卡，最通用稳重的商务范式',
    cover: 'linear-gradient(135deg,#1e3a8a 0%,#2563eb 55%,#3b82f6 100%)'
  },
  {
    key: 'minimal',
    label: '极简白',
    desc: '大留白 + 超大姓名 + 细线分隔，瑞士极简现代感',
    cover: 'linear-gradient(135deg,#f8fafc 0%,#e2e8f0 100%)'
  },
  {
    key: 'elite',
    label: '尊享黑金',
    desc: '深色沉浸封面 + 居中金环头像 + 衬线署名，高管气场',
    cover: 'linear-gradient(135deg,#18181b 0%,#3f3f46 55%,#a16207 100%)'
  },
  {
    key: 'vivid',
    label: '活力渐变',
    desc: '大圆角渐变封面 + 悬浮头像 + 胶囊标签，年轻创业风',
    cover: 'linear-gradient(135deg,#7c3aed 0%,#db2777 55%,#f59e0b 100%)'
  },
  {
    key: 'seal',
    label: '杂志方格',
    desc: '黑白高对比 + 超大首字 + 直角细框，设计媒体风',
    cover: 'linear-gradient(135deg,#0f172a 0%,#334155 55%,#64748b 100%)'
  },
  {
    key: 'contact',
    label: '简洁联络',
    desc: '深蓝渐变底 + 单张圆角白卡内聚，卡内拨号/复制/金色存档，简洁大气（默认）',
    cover: 'radial-gradient(1200px 500px at 50% -10%,#1d3a55 0%,#132a3d 45%,#0c1a26 100%)'
  },
  {
    key: 'navygold',
    label: '深蓝鎏金',
    desc: '深蓝底 + 沙金描边，金线水印与表格化信息的高端名片',
    cover: 'linear-gradient(135deg,#1d3a55 0%,#2f5a7d 40%,#d8bb85 78%,#b99355 100%)'
  }
]

const TEMPLATE_KEYS = CARD_TEMPLATES.map(t => t.key)
// 默认模板：简洁大气联络卡（单张白卡内聚信息 + 卡内核号/存档，扫码即联系）
const DEFAULT_TEMPLATE = 'contact'
const isTemplate = key => TEMPLATE_KEYS.includes(key)
const normalizeTemplate = key => (isTemplate(key) ? key : DEFAULT_TEMPLATE)

module.exports = { CARD_TEMPLATES, TEMPLATE_KEYS, DEFAULT_TEMPLATE, isTemplate, normalizeTemplate }
