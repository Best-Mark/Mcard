// 二维码美化样式的唯一真相源（2026-11-26 用户定稿）：
// 码点/码眼取值与中文标签、一键预设全部只在这里定义一次。
// 服务端用 DOT_VALUES / EYE_VALUES 做写入白名单与渲染分支；
// 通过 GET /api/cards/public/meta 下发两端（client 与 miniapp 都不再硬编码），
// 新增形状只需改本文件 + services/qrcode.js 的渲染分支，两端自动同步。
//
// ⚠️ 易扫收敛（2026-11-26 用户定稿）：真机实测过于花哨的码点/码眼导致微信「扫一扫」识别率极低、
// 需要严格角度。只保留扫码友好的形状——码点覆盖率高、边缘规整；码眼保持「回」字定位特征。
// 被剔除的旧值（如 smallDots/diamond/star/stripe/liquid/circle/bubble...）由 normalizeStyle
// 白名单自动回落到 square，存量名片无需迁移即可自愈；两端清单从 meta 拉取自动同步。

// 码点：只用「实心/接近实心」的规则形状，保证模块边界清晰。
const DOT_STYLES = [
  { value: 'square', label: '普通方点' },
  { value: 'rounded', label: '圆角方点' },
  { value: 'dots', label: '大圆点' }
]

// 码眼：必须保留「回」字定位特征（微信/相机靠三个角定位），只用方正与圆角回字。
const EYE_STYLES = [
  { value: 'square', label: '方正' },
  { value: 'rounded', label: '圆角' }
]

// 一键预设（组合值仍取自上面的清单，不另立取值）；只留易扫组合，不带渐变。
const QR_PRESETS = [
  { key: 'classic', label: '经典方点', swatch: '#0f172a', dot: 'square', eye: 'square', gradTo: '' },
  { key: 'rounded', label: '圆润', swatch: '#2563eb', dot: 'rounded', eye: 'rounded', gradTo: '' },
  { key: 'dots', label: '圆点', swatch: '#0f766e', dot: 'dots', eye: 'square', gradTo: '' }
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
