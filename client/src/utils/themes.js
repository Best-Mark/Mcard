// 名片配色主题 —— 主流商业色板。
// 每套都是「浅底 + 深字 + 一个主色」的克制组合，保证任何行业都专业耐看；
// 主题只定义颜色变量（--t-*），排版骨架由 template 决定，两者正交。
// ⚠️ 改这里必须同步 miniapp/src/pages/edit/edit.vue 的 themes 常量（小程序无 web-view，独立渲染）。
export const THEMES = {
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
