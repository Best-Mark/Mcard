// 名片布局模板清单 —— 模板 key 的唯一真相源。
// 注意：这是「布局形态」，与配色主题 theme（ocean/ink/...）是两个独立维度，
// 一张名片 = 一个 template + 一个 theme，可自由组合。
// 前端编辑器通过 GET /api/cards/public/templates 拉取本清单渲染选择器，不各自硬编码 key。
//
// 7 套模板对应 7 种主流设计范式，骨架（封面形态/头像位置/信息排布/底栏）彼此不同，
// 而不是只换颜色——换主题配色请选 theme，不要在这里堆相似模板。
const CARD_TEMPLATES = [
  {
    key: 'tang',
    label: '唐红鎏金',
    desc: '唐红渐变底 + 烫金边象牙白卡 + 鎏金点缀，古美融入现代商务（默认）',
    cover: 'linear-gradient(135deg,#7a1e15 0%,#a62b2b 55%,#c9a227 100%)'
  },
  {
    key: 'vanna',
    label: '瓦纳蓝',
    desc: '深邃海蓝渐变底 + 冷白卡 + 湖蓝描边，沉稳知性商务范',
    cover: 'linear-gradient(135deg,#0c2a4d 0%,#155a96 55%,#2a8fd4 100%)'
  },
  {
    key: 'phantom',
    label: '幻影绿',
    desc: '翡翠墨绿渐变底 + 象牙白卡 + 翠绿描边，沉静内敛的高级感',
    cover: 'linear-gradient(135deg,#052e1c 0%,#0f6b3f 55%,#22c97a 100%)'
  },
  {
    key: 'lava',
    label: '熔岩灰',
    desc: '火山岩灰渐变底 + 暖白卡 + 熔岩橙描边，冷峻中透着张力',
    cover: 'linear-gradient(135deg,#1a1a1e 0%,#3a3a42 55%,#c2410c 100%)'
  },
  {
    key: 'star',
    label: '星钻黑',
    desc: '曜石黑渐变底 + 深空卡 + 碎钻银描边，璀璨内敛的奢华气场',
    cover: 'linear-gradient(135deg,#08080c 0%,#1a1a24 55%,#4a4a5e 100%)'
  },
  {
    key: 'alas',
    label: '阿拉斯红',
    desc: '深绯红渐变底 + 象牙白卡 + 亮红描边，热烈自信的东方红',
    cover: 'linear-gradient(135deg,#4a0d14 0%,#a01722 55%,#e0323c 100%)'
  },
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
    label: '金黑 · 简洁联络',
    desc: '深蓝渐变底 + 22px 圆角白卡 + 金蓝封顶，卡内拨号/复制/金色存档（默认，参考风格 A）',
    cover: 'radial-gradient(1200px 500px at 50% -10%,#1d3a55 0%,#132a3d 45%,#0c1a26 100%)'
  },
  {
    key: 'navygold',
    label: '深蓝鎏金',
    desc: '深蓝底 + 沙金描边，金线水印与表格化信息的高端名片',
    cover: 'linear-gradient(135deg,#1d3a55 0%,#2f5a7d 40%,#d8bb85 78%,#b99355 100%)'
  },
  {
    key: 'paper',
    label: '极简纸白',
    desc: '浅灰底 + 6px 小圆角白卡 + 1px 发丝线 + 细体大字，克制留白（参考风格 B）',
    cover: 'linear-gradient(135deg,#eeede9 0%,#f7f6f3 100%)'
  },
  {
    key: 'glass',
    label: '墨夜玻璃',
    desc: '深蓝渐变底 + 半透玻璃卡 + 薄荷绿点缀，内发光高对比（参考风格 C）',
    cover: 'radial-gradient(900px 600px at 15% 0%,#173049 0%,#0b1622 55%,#060c13 100%)'
  },
  {
    key: 'wood',
    label: '暖木衬线',
    desc: '暖棕渐变底 + 直角双层细框 + 衬线字体，温润书卷气（参考风格 D）',
    cover: 'radial-gradient(circle at 20% 0%,#f6eee1 0%,#e8dbc8 60%,#ddcdb6 100%)'
  },
  {
    key: 'neon',
    label: '霓虹夜景',
    desc: '粉紫→冰蓝渐变玻璃 + 26px 大圆角 + 渐变文字与霓虹光晕（参考风格 E）',
    cover: 'radial-gradient(760px 540px at 82% 0%,#3d1a72 0%,#190b32 46%,#08040f 100%)'
  },
  {
    key: 'acid',
    label: '酸性荧光',
    desc: '黑底荧光绿网格 + 直角硬边 + 8px 硬投影，赛博酸性风（参考风格 F）',
    cover: 'linear-gradient(135deg,#050505 0%,#1a2600 100%)'
  },
  {
    key: 'pop',
    label: '多巴胺',
    desc: '3px 厚黑描边 + 硬投影 + 彩色标签轮换，明亮跳脱（参考风格 G）',
    cover: 'linear-gradient(165deg,#fff4e8 0%,#ffe4f0 52%,#e8f0ff 100%)'
  },
  {
    key: 'magazine',
    label: '杂志编辑',
    desc: '米色 + 番茄红 + 2px 直角 + 衬线大标题，编辑排版感（参考风格 H）',
    cover: 'linear-gradient(135deg,#f2efe9 0%,#e8e2d5 100%)'
  },
  {
    key: 'poster',
    label: '竖版海报',
    desc: '无卡片通栏 + 46px 巨字 + 信息两列，深蓝金海报感（参考 L1）',
    cover: 'radial-gradient(900px 600px at 50% -8%,#22384d 0%,#101d29 50%,#070d14 100%)'
  },
  {
    key: 'ticket',
    label: '票据存根',
    desc: '白纸锯齿边 + 等宽数字 + 虚线分隔，复存根质感（参考 L2）',
    cover: 'linear-gradient(135deg,#e9e6df 0%,#f7f5ee 100%)'
  },
  {
    key: 'horizontal',
    label: '横版名片',
    desc: '左信息 + 右侧深色色块，模拟实体横版卡（参考 L3，竖屏适配）',
    cover: 'linear-gradient(170deg,#eef1f4 0%,#dfe4ea 100%)'
  },
  {
    key: 'sidebar',
    label: '侧栏竖排',
    desc: '左侧竖色带 + 右对齐内容 + 衬线字，书卷气（参考 L4）',
    cover: 'linear-gradient(135deg,#f7f3ec 0%,#ece4d6 100%)'
  }
]

const TEMPLATE_KEYS = CARD_TEMPLATES.map(t => t.key)
// 默认模板：唐红鎏金烫金（古美融入现代商务，用户定为品牌默认风格）
const DEFAULT_TEMPLATE = 'tang'
const isTemplate = key => TEMPLATE_KEYS.includes(key)
const normalizeTemplate = key => (isTemplate(key) ? key : DEFAULT_TEMPLATE)

module.exports = { CARD_TEMPLATES, TEMPLATE_KEYS, DEFAULT_TEMPLATE, isTemplate, normalizeTemplate }
