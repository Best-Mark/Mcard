// 名片配色主题 —— 主流商业色板。
// 每套都是「浅底 + 深字 + 一个主色」的克制组合，保证任何行业都专业耐看；
// 主题只定义颜色变量（--t-*），排版骨架由 template 决定，两者正交。
// ⚠️ 改这里必须同步 miniapp/src/pages/edit/edit.vue 的 themes 常量（小程序无 web-view，独立渲染）。
export const THEMES = {
  tang: {
    label: '唐红鎏金', accent: '#a62b2b', surface: '#fffdf8', bg: '#f7f2e7',
    text: '#2b2118', muted: '#8a7355',
    cover: 'linear-gradient(135deg,#7a1e15 0%,#a62b2b 55%,#c9a227 100%)'
  },
  ocean: {
    label: '经典蓝', accent: '#2563eb', surface: '#ffffff', bg: '#f2f7ff',
    text: '#0f172a', muted: '#64748b',
    cover: 'linear-gradient(135deg,#1e3a8a 0%,#2563eb 55%,#3b82f6 100%)'
  },
  ink: {
    label: '曜石黑金', accent: '#b99355', surface: '#15171c', bg: '#0d0f13',
    text: '#f5f5f4', muted: '#a1a1aa',
    cover: 'linear-gradient(135deg,#18181b 0%,#27272a 55%,#7c6226 100%)'
  },
  sunset: {
    label: '活力橙', accent: '#ea580c', surface: '#fffaf6', bg: '#fff5ee',
    text: '#431407', muted: '#9a5b32',
    cover: 'linear-gradient(135deg,#9a3412 0%,#ea580c 55%,#f59e0b 100%)'
  },
  mint: {
    label: '翡翠绿', accent: '#0f766e', surface: '#f7fefc', bg: '#effaf7',
    text: '#042f2e', muted: '#5b8d85',
    cover: 'linear-gradient(135deg,#115e59 0%,#0f766e 55%,#14b8a6 100%)'
  },
  royal: {
    label: '皇家紫', accent: '#7c3aed', surface: '#fbfaff', bg: '#f6f3ff',
    text: '#2e1065', muted: '#7c6a9c',
    cover: 'linear-gradient(135deg,#5b21b6 0%,#7c3aed 55%,#a78bfa 100%)'
  }
}

// 模板自带推荐配色：选模板即应用一整套（主题/强调色/二维码色），用户无需逐项调色。
// key = cardTemplates.js 的模板 key；二维码色遵循「深码 + 浅底」保证可扫。
// ⚠️ 新增模板或调整模板配色时，需同步 miniapp/src/pages/edit/edit.vue 的 TEMPLATE_PALETTES。
export const TEMPLATE_PALETTES = {
  tang: { theme: 'tang', qrFg: '#7a1e15', qrBg: '#f7ecd9' },
  classic: { theme: 'ocean', qrFg: '#12306b', qrBg: '#f2f7ff' },
  minimal: { theme: 'ocean', qrFg: '#0f172a', qrBg: '#ffffff' },
  elite: { theme: 'ink', qrFg: '#b99355', qrBg: '#15171c' },
  vivid: { theme: 'royal', qrFg: '#7c3aed', qrBg: '#fff7ed' },
  seal: { theme: 'ocean', qrFg: '#0f172a', qrBg: '#ffffff' },
  contact: { theme: 'ink', qrFg: '#12202e', qrBg: '#ffffff' },
  navygold: { theme: 'ink', qrFg: '#1d3a55', qrBg: '#f7f1e3' },
  paper: { theme: 'ocean', qrFg: '#3f4a5a', qrBg: '#f7f6f3' },
  glass: { theme: 'mint', qrFg: '#0b2e2a', qrBg: '#eaf8f4' },
  wood: { theme: 'sunset', qrFg: '#5b3a1f', qrBg: '#f6eee1' },
  neon: { theme: 'royal', qrFg: '#3d1a72', qrBg: '#f3e9ff' },
  acid: { theme: 'mint', qrFg: '#0a0a0a', qrBg: '#dfff5e' },
  pop: { theme: 'sunset', qrFg: '#1a1a1a', qrBg: '#fff4e8' },
  magazine: { theme: 'sunset', qrFg: '#b91c1c', qrBg: '#f7f3ec' },
  poster: { theme: 'ink', qrFg: '#1d3a55', qrBg: '#ffffff' },
  ticket: { theme: 'ocean', qrFg: '#1f2937', qrBg: '#f7f5ee' },
  horizontal: { theme: 'ocean', qrFg: '#1d3a55', qrBg: '#eef1f4' },
  sidebar: { theme: 'sunset', qrFg: '#44291a', qrBg: '#f7f3ec' }
}

// 取某模板的推荐配色；未登记的模板（新加但未同步映射）回落默认，保证不崩
export function paletteOf(template) {
  return TEMPLATE_PALETTES[template] || { theme: 'ocean', qrFg: '#0f172a', qrBg: '#ffffff' }
}

export function themeOf(card) {
  const base = THEMES[card?.theme] || THEMES.ocean
  const accent = /^#[0-9a-f]{6}$/i.test(card?.accent || '') ? card.accent : base.accent
  return { ...base, accent }
}

export function themeVars(t) {
  return {
    '--t-accent': t.accent,
    '--t-surface': t.surface,
    '--t-bg': t.bg,
    '--t-text': t.text,
    '--t-muted': t.muted,
    '--t-cover': t.cover
  }
}
