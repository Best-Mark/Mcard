// 二维码美化样式的唯一真相源（2026-11-26 用户定稿）：
// 码点/码眼取值与中文标签、一键预设全部只在这里定义一次。
// 服务端用 DOT_VALUES / EYE_VALUES 做写入白名单与渲染分支；
// 通过 GET /api/cards/public/meta 下发两端（client 与 miniapp 都不再硬编码），
// 新增形状只需改本文件 + services/qrcode.js 的渲染分支，两端自动同步。

const DOT_STYLES = [
  { value: 'square', label: '普通' },
  { value: 'dots', label: '大圆点' },
  { value: 'smallDots', label: '小圆点' },
  { value: 'rounded', label: '圆角' },
  { value: 'smallSquare', label: '小方点' },
  { value: 'diamond', label: '菱形' },
  { value: 'hStripe', label: '横条纹' },
  { value: 'vStripe', label: '竖条纹' },
  { value: 'stripe', label: '双条纹' },
  { value: 'tile', label: '瓷砖' },
  { value: 'grid', label: '网格' },
  { value: 'liquid', label: '液化' },
  { value: 'roundLiquid', label: '圆液化' },
  { value: 'thickStar', label: '粗星形' },
  { value: 'thinStar', label: '细星形' },
  { value: 'hex', label: '六边形' }
]

const EYE_STYLES = [
  { value: 'square', label: '方正' },
  { value: 'rounded', label: '圆角' },
  { value: 'circle', label: '圆形' },
  { value: 'thickRounded', label: '粗圆角' },
  { value: 'mediumRounded', label: '中圆角' },
  { value: 'thinRounded', label: '细圆角' },
  { value: 'thickCircle', label: '粗圆形' },
  { value: 'thinCircle', label: '细圆形' },
  { value: 'diamond', label: '菱形' },
  { value: 'star', label: '星形' },
  { value: 'bubble', label: '气泡' },
  { value: 'eye', label: '眼睛' },
  { value: 'singleRound', label: '单圆角' },
  { value: 'fourRound', label: '四圆眼' }
]

// 一键预设（组合值仍取自上面的清单，不另立取值）；swatch 只是按钮配色，服务端下发前端直接用。
const QR_PRESETS = [
  { key: 'classic', label: '经典', swatch: '#0f172a', dot: 'square', eye: 'square', gradTo: '' },
  { key: 'dots', label: '圆点', swatch: '#2563eb', dot: 'dots', eye: 'rounded', gradTo: '' },
  { key: 'tech', label: '科技渐变', swatch: 'linear-gradient(135deg,#2563eb,#06b6d4)', dot: 'rounded', eye: 'rounded', gradTo: '#06b6d4' },
  { key: 'elegant', label: '典雅', swatch: '#b45309', dot: 'diamond', eye: 'circle', gradTo: '' },
  { key: 'star', label: '星芒', swatch: 'linear-gradient(135deg,#7c3aed,#db2777)', dot: 'thickStar', eye: 'star', gradTo: '#db2777' },
  { key: 'grid', label: '网格', swatch: '#0f766e', dot: 'grid', eye: 'fourRound', gradTo: '' }
]

// 码色（前景色 fg + 底色 bg 成对）：只用「深码 + 浅底」组合，保证任何主题下可扫。
// 复用 cards.qr_fg / cards.qr_bg 两个既有字段，不新建参数；这里只给推荐组合的清单。
// 保证对比度：深码亮度 < 110、浅底亮度 > 200（与 routes/cards.js 的 scanOptions 同口径）。
const QR_COLORS = [
  { key: 'ink', label: '墨黑', fg: '#0f172a', bg: '#ffffff' },
  { key: 'navy', label: '藏青', fg: '#12306b', bg: '#f2f7ff' },
  { key: 'ocean', label: '经典蓝', fg: '#1e3a8a', bg: '#eff6ff' },
  { key: 'tang', label: '唐红', fg: '#7a1e15', bg: '#fdf5f5' },
  { key: 'gold', label: '鎏金', fg: '#6b4a12', bg: '#fdf8e7' },
  { key: 'mint', label: '翡翠', fg: '#0b3d38', bg: '#effaf7' },
  { key: 'purple', label: '皇家紫', fg: '#4c1d95', bg: '#f6f3ff' },
  { key: 'slate', label: '石墨', fg: '#1f2937', bg: '#f1f5f9' },
  { key: 'coffee', label: '咖啡', fg: '#44291a', bg: '#fbf5ef' },
  { key: 'forest', label: '松绿', fg: '#052e1c', bg: '#e8f5ee' }
]

const DOT_VALUES = DOT_STYLES.map(x => x.value)
const EYE_VALUES = EYE_STYLES.map(x => x.value)

module.exports = { DOT_STYLES, EYE_STYLES, DOT_VALUES, EYE_VALUES, QR_PRESETS, QR_COLORS }
