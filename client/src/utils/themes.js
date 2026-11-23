export const THEMES = {
  ocean: {
    label: '深海蓝', accent: '#2563eb', surface: '#ffffff', bg: '#f2f7ff',
    text: '#0f172a', muted: '#64748b',
    cover: 'linear-gradient(135deg,#17357c 0%,#2563eb 52%,#38bdf8 100%)'
  },
  ink: {
    label: '墨黑金', accent: '#c9a227', surface: '#12151c', bg: '#0b0d12',
    text: '#f8fafc', muted: '#a1a1aa',
    cover: 'linear-gradient(135deg,#1c1917 0%,#3f3f46 55%,#b48b20 100%)'
  },
  sunset: {
    label: '暖阳橘', accent: '#ea580c', surface: '#fffaf5', bg: '#fff5ec',
    text: '#431407', muted: '#9a5b32',
    cover: 'linear-gradient(135deg,#7c2d12 0%,#ea580c 55%,#fbbf24 100%)'
  },
  mint: {
    label: '青竹绿', accent: '#0d9488', surface: '#f6fffd', bg: '#effdf9',
    text: '#052e2b', muted: '#5c8a84',
    cover: 'linear-gradient(135deg,#134e4a 0%,#0d9488 55%,#5eead4 100%)'
  },
  royal: {
    label: '典雅紫', accent: '#7c3aed', surface: '#fbf9ff', bg: '#f6f2ff',
    text: '#2e1065', muted: '#7c6a9c',
    cover: 'linear-gradient(135deg,#4c1d95 0%,#7c3aed 55%,#c084fc 100%)'
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
