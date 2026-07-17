/** Deterministic author avatar color + initials, shared across review dashboards. */

const PALETTE = ['#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#14b8a6', '#f97316', '#84cc16']

export function authorBg(n: string) {
  if (!n) return PALETTE[0]
  return PALETTE[n.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length]
}

export function initials(n: string) {
  const p = (n || '').trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '?'
}
