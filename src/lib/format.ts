/** Formatting helpers shared by report views. */

export const AI_CREDIT_USD_RATE = 0.01

export function fmtMs(ms: number) {
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export function fmtTokens(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

export function fmtTokensK(n: number) {
  return `${(n / 1000).toFixed(1)}k`
}

export function fmtCompactNumber(n: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: n >= 100_000 ? 0 : 1,
  }).format(n)
}

export function fmtAiCredits(value: number) {
  return Math.round(value).toLocaleString('en-US')
}

export function fmtAiCreditsWithUsd(value: number) {
  return `${fmtAiCredits(value)} AIC · ≈${(value * AI_CREDIT_USD_RATE).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function shortDate(isoDate: string) {
  return new Date(isoDate + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export function isoWeekKey(iso: string) {
  const d = new Date(iso)
  const day = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - ((day + 6) % 7))
  return monday.toISOString().slice(0, 10)
}

export const TIME_BUCKETS = ['0–30s', '30–60s', '1–2m', '2–5m', '5–10m', '10m+']

export function timeBucket(ms: number) {
  if (ms < 30000)  return '0–30s'
  if (ms < 60000)  return '30–60s'
  if (ms < 120000) return '1–2m'
  if (ms < 300000) return '2–5m'
  if (ms < 600000) return '5–10m'
  return '10m+'
}
