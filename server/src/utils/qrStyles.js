// 二维码样式清单唯一真相源。
//
// 【2026-11-27 用户定稿：识别率第一】二维码直接以标准识别码为基底，在此前提下再美化；
// 凡影响微信「扫一扫 / 长按识别」的美化一律去掉：
//   - 码点：只保留普通方点（圆角/圆点的细缝在缩放与截图场景下检测失败）→ rounded/dots 由
//     normalizeStyle 白名单自动回落 square，存量名片无需迁移即可自愈，两端清单从 meta 拉取自动同步
//   - 码眼：只保留方正「回」字（圆角外框同样弱化定位特征）
//   - 中心 LOGO / 品牌文字：渲染层已整体移除（遮挡数据区 + 强制 H 纠错是识别率头号杀手）
//   - 渐变 / 背景图：2026-11-26 已下线（normalizeStyle 归一为空）
// 保留的美化 = 码色（深码 + 浅底成对，亮度对比有硬口径），不影响识别。
// 被剔除的旧值（smallDots/diamond/star/stripe/liquid/circle/bubble...）同样由白名单回落。

// 码点：只保留覆盖率高、模块边界清晰的标准方点。
const DOT_STYLES = [
  { value: 'square', label: '标准方点' }
]

// 码眼：只保留方正「回」字定位特征。
const EYE_STYLES = [
  { value: 'square', label: '方正' }
]

// 一键预设：只剩标准方点一种（组合值仍取自上面的清单，不另立取值）。
const QR_PRESETS = [
  { key: 'classic', label: '标准方点', swatch: '#0f172a', dot: 'square', eye: 'square', gradTo: '' }
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
