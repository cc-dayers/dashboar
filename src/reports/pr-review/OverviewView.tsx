import { useState } from 'react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { PrReview, PrReviewReport, LlmProvider } from './types'
import PanelTopBar from '../../components/PanelTopBar'

// ── Helpers ───────────────────────────────────────────────────────────────────

function mean(xs: number[]) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0 }

function fmtMs(ms: number) {
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}
function fmtTokensK(n: number) { return `${(n / 1000).toFixed(1)}k` }

function isoWeekKey(iso: string) {
  const d = new Date(iso)
  const day = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - ((day + 6) % 7))
  return monday.toISOString().slice(0, 10)
}

function shortDate(isoDate: string) {
  return new Date(isoDate + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function timeBucket(ms: number) {
  if (ms < 30000)  return '0–30s'
  if (ms < 60000)  return '30–60s'
  if (ms < 120000) return '1–2m'
  if (ms < 300000) return '2–5m'
  if (ms < 600000) return '5–10m'
  return '10m+'
}

const TIME_BUCKETS = ['0–30s','30–60s','1–2m','2–5m','5–10m','10m+']

// ── Provider colors ───────────────────────────────────────────────────────────

const PROVIDER_COLOR: Record<LlmProvider, string> = {
  azure:   '#0078d4',
  copilot: '#238636',
  codex:   '#7c3aed',
}

// ── Hat style map ─────────────────────────────────────────────────────────────

const HAT_STYLE: Record<string, { bg: string; color: string }> = {
  'e2e-playwright':       { bg: '#f5f3ff', color: '#7c3aed' },
  'portals-react':        { bg: '#ecfeff', color: '#0e7490' },
  'dotnet-service':       { bg: '#eff6ff', color: '#1d4ed8' },
  'ci-automation':        { bg: '#fffbeb', color: '#b45309' },
  'data-persistence':     { bg: '#f0fdf4', color: '#15803d' },
  'dotnet-best-practices':{ bg: '#f8fafc', color: '#475569' },
  'design-review':        { bg: '#fdf4ff', color: '#a21caf' },
  'interfacing':          { bg: '#fff7ed', color: '#c2410c' },
  'agentic-development':  { bg: '#f7fee7', color: '#4d7c0f' },
}

function hatStyle(name: string) {
  return HAT_STYLE[name] ?? { bg: '#f1f5f9', color: '#475569' }
}

// ── Chart tooltip ─────────────────────────────────────────────────────────────

function ChartTip({ active, payload, label, fmt }: {
  active?: boolean
  payload?: ReadonlyArray<{ value?: number; color?: string; name?: string }>
  label?: string | number
  fmt?: (v: number) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,.08)' }}>
      {label && <div style={{ color: '#64748b', marginBottom: '4px' }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontWeight: 600 }}>
          {p.name ? `${p.name}: ` : ''}{fmt ? fmt(Number(p.value) ?? 0) : p.value}
        </div>
      ))}
    </div>
  )
}

// ── Shared card ───────────────────────────────────────────────────────────────

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{title}</div>
        {sub && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{sub}</div>}
      </div>
      {children}
    </div>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px' }}>
      <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: '26px', fontWeight: 700, color: accent ?? '#0f172a', lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '5px' }}>{sub}</div>}
    </div>
  )
}

// ── Horizontal bar ────────────────────────────────────────────────────────────

function HBar({ label, value, max, color, badge }: {
  label: string; value: number; max: number; color: string; badge?: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
      <div style={{ fontSize: '11.5px', color: '#475569', width: '130px', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={label}>
        {label}
      </div>
      <div style={{ flex: 1, background: '#f1f5f9', borderRadius: '4px', height: '7px', overflow: 'hidden', minWidth: 0 }}>
        <div style={{ width: `${max > 0 ? (value / max) * 100 : 0}%`, height: '100%', background: color, borderRadius: '4px', transition: 'width 0.3s' }} />
      </div>
      <div style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b', width: '28px', textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
        {badge ?? value}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface Props {
  report:    PrReviewReport
  reportId:  string
  authorBg?: (name: string) => string
  initials?: (name: string) => string
  onSelectPr?: (pr: PrReview) => void
}

const AXIS = { fontSize: 11, fill: '#94a3b8' }
const GRID = { strokeDasharray: '3 3' as const, stroke: '#f1f5f9' }

const RANGE_OPTIONS = [
  { label: 'All',   days: null },
  { label: '30d',   days: 30   },
  { label: '14d',   days: 14   },
  { label: '7d',    days: 7    },
  { label: '3d',    days: 3    },
  { label: 'Today', days: 1    },
] as const

export default function OverviewView({ report, reportId }: Props) {
  const [filterDays, setFilterDays] = useState<number | null>(null)

  const allReviews = [...report.reviews].sort(
    (a, b) => new Date(a.reviewedAt).getTime() - new Date(b.reviewedAt).getTime(),
  )

  const latestMs = allReviews.length > 0
    ? new Date(allReviews[allReviews.length - 1].reviewedAt).getTime()
    : Date.now()

  const reviews = filterDays == null
    ? allReviews
    : allReviews.filter(r => latestMs - new Date(r.reviewedAt).getTime() <= filterDays * 864e5)

  // ── KPIs
  const avgAccuracy    = mean(reviews.map(r => r.accuracyRating))
  const avgTimeMs      = mean(reviews.map(r => r.timeToReviewMs))
  const changesCount   = reviews.filter(r => r.result === 'changes-requested').length
  const changesPct     = reviews.length > 0 ? Math.round((changesCount / reviews.length) * 100) : 0
  const aicReviews     = reviews.filter(r => r.aicCreditsUsed != null)
  const totalAicCredits = aicReviews.reduce((s, r) => s + (r.aicCreditsUsed ?? 0), 0)

  // ── Reviews by period — bucket granularity adapts to filter range
  type PeriodBucket = { label: string; approved: number; 'changes-requested': number; commented: number }

  const periodChartTitle = filterDays === 1 ? 'Reviews by Hour'
    : filterDays != null && filterDays <= 14 ? 'Reviews by Day'
    : 'Reviews by Week'

  let periodData: PeriodBucket[]
  if (filterDays === 1) {
    const hours: PeriodBucket[] = Array.from({ length: 24 }, (_, h) => ({
      label: h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`,
      approved: 0, 'changes-requested': 0, commented: 0,
    }))
    for (const r of reviews) {
      const h = new Date(r.reviewedAt).getHours()
      ;(hours[h] as unknown as Record<string, number>)[r.result]++
    }
    const firstHit = hours.findIndex(h => h.approved + h['changes-requested'] + h.commented > 0)
    const lastHit  = [...hours].reverse().findIndex(h => h.approved + h['changes-requested'] + h.commented > 0)
    periodData = firstHit === -1 ? hours : hours.slice(Math.max(0, firstHit - 1), 24 - Math.max(0, lastHit - 1))
  } else if (filterDays != null && filterDays <= 14) {
    const dayMap = new Map<string, PeriodBucket>()
    for (const r of reviews) {
      const key = r.reviewedAt.slice(0, 10)
      if (!dayMap.has(key)) dayMap.set(key, { label: shortDate(key), approved: 0, 'changes-requested': 0, commented: 0 })
      ;(dayMap.get(key)! as unknown as Record<string, number>)[r.result]++
    }
    periodData = Array.from(dayMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, d]) => d)
  } else {
    const weekMap = new Map<string, PeriodBucket>()
    for (const r of reviews) {
      const wk = isoWeekKey(r.reviewedAt)
      if (!weekMap.has(wk)) weekMap.set(wk, { label: shortDate(wk), approved: 0, 'changes-requested': 0, commented: 0 })
      ;(weekMap.get(wk)! as unknown as Record<string, number>)[r.result]++
    }
    periodData = Array.from(weekMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, d]) => d)
  }

  // ── Token + AIC usage per review — line charts with hover drilldown
  const tokenData = reviews.map(r => ({
    date:       shortDate(r.reviewedAt.slice(0, 10)),
    tokens:     r.tokensUsed,
    cost:       r.estimatedCostUsd,
    pr:         `#${r.prNumber}`,
    title:      r.prTitle,
    result:     r.result,
    aicCredits: r.aicCreditsUsed,
  }))

  const aicData = reviews
    .filter(r => r.aicCreditsUsed != null)
    .map(r => ({
      date:       shortDate(r.reviewedAt.slice(0, 10)),
      aic:        r.aicCreditsUsed as number,
      pr:         `#${r.prNumber}`,
      title:      r.prTitle,
      result:     r.result,
    }))
  const hasAicData = aicData.length > 0

  // ── Findings by hat
  const findingsByHat = new Map<string, number>()
  for (const r of reviews) {
    for (const hd of r.hatDetails ?? []) {
      const n = hd.findings?.length ?? 0
      findingsByHat.set(hd.name, (findingsByHat.get(hd.name) ?? 0) + n)
    }
  }
  const findingsArr = Array.from(findingsByHat.entries())
    .map(([name, count]) => ({ name, count }))
    .filter(d => d.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
  const maxFindings = findingsArr[0]?.count ?? 1

  // ── Author activity
  const authorMap = new Map<string, number>()
  for (const r of reviews) {
    const a = r.author ?? 'Unknown'
    authorMap.set(a, (authorMap.get(a) ?? 0) + 1)
  }
  const authorArr = Array.from(authorMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
  const maxAuthor = authorArr[0]?.count ?? 1

  // ── Time distribution
  const bucketCounts = Object.fromEntries(TIME_BUCKETS.map(b => [b, 0])) as Record<string, number>
  for (const r of reviews) bucketCounts[timeBucket(r.timeToReviewMs)]++
  const timeDistData = TIME_BUCKETS.map(b => ({ bucket: b, count: bucketCounts[b] }))

  // ── Provider & model breakdown
  const providerMap = new Map<string, number>()
  const modelMap    = new Map<string, number>()
  for (const r of reviews) {
    const entries = r.modelsUsed ?? (r.provider && r.model ? [{ provider: r.provider, model: r.model }] : [])
    for (const e of entries) {
      if (e.provider) providerMap.set(e.provider, (providerMap.get(e.provider) ?? 0) + 1)
      if (e.model)    modelMap.set(e.model,        (modelMap.get(e.model)        ?? 0) + 1)
    }
  }
  const providerArr = Array.from(providerMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
  const modelArr    = Array.from(modelMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 6)
  const maxProvider = providerArr[0]?.count ?? 1
  const maxModel    = modelArr[0]?.count ?? 1
  const hasModelData = providerArr.length > 0 || modelArr.length > 0

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <PanelTopBar
        left={
          <div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>{reportId}</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>{report.title ?? 'PR Review Report'}</div>
            {report.subtitle && (
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>{report.subtitle}</div>
            )}
          </div>
        }
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginRight: '6px', gap: '2px' }}>
              {report.period && (
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>{report.period}</span>
              )}
              {report.generatedAt && (
                <span style={{ fontSize: '10px', color: '#cbd5e1' }}>
                  Generated {new Date(report.generatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </span>
              )}
            </div>
            {RANGE_OPTIONS.map(opt => {
              const active = filterDays === opt.days
              return (
                <button
                  key={opt.label}
                  onClick={() => setFilterDays(opt.days)}
                  style={{
                    fontSize: '12px', fontWeight: 500, padding: '4px 12px',
                    borderRadius: '6px', cursor: 'pointer', border: 'none',
                    background: active ? '#0f172a' : '#f1f5f9',
                    color: active ? '#f1f5f9' : '#475569',
                    transition: 'background 0.12s, color 0.12s',
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        }
      />

      <div style={{ padding: '20px 24px', maxWidth: '1100px', margin: '0 auto' }}>

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '16px' }}>
          <KpiCard label="Total Reviews"         value={String(reviews.length)} sub={report.period} />
          <KpiCard label="Avg Review Time"        value={fmtMs(avgTimeMs)} />
          <KpiCard label="Changes Requested"      value={`${changesPct}%`} sub={`${changesCount} of ${reviews.length}`} accent="#dc2626" />
          <KpiCard label="Avg Accuracy Rating"    value={`${avgAccuracy.toFixed(1)}%`} accent="#16a34a" />
          <KpiCard label="AIC Credits Used"       value={totalAicCredits > 0 ? String(totalAicCredits) : '—'} sub={aicReviews.length > 0 ? `${aicReviews.length} of ${reviews.length} reviews` : 'no AIC data'} accent="#7c3aed" />
        </div>

        {/* Reviews by period + token usage + AIC */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <Card title={periodChartTitle} sub="stacked by outcome">
            {periodData.length === 0 ? (
              <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '12px' }}>
                No reviews in this range
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={periodData} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                    <CartesianGrid {...GRID} />
                    <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={(p) => <ChartTip {...(p as any)} />} />
                    <Bar dataKey="approved"          stackId="a" fill="#4ade80" name="Approved" radius={[0,0,0,0]} />
                    <Bar dataKey="changes-requested" stackId="a" fill="#f87171" name="Changes" radius={[0,0,0,0]} />
                    <Bar dataKey="commented"         stackId="a" fill="#fbbf24" name="Commented" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', gap: '14px', marginTop: '10px' }}>
                  {[['#4ade80','Approved'],['#f87171','Changes'],['#fbbf24','Commented']].map(([c,l]) => (
                    <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#64748b' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: c, flexShrink: 0 }} />
                      {l}
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>

          <Card title="Tokens per Review" sub="each point is one PR — hover for details">
            {tokenData.length === 0 ? (
              <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '12px' }}>
                No reviews in this range
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={tokenData} margin={{ top: 6, right: 8, bottom: 0, left: -4 }}>
                  <defs>
                    <linearGradient id="tokenGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="date" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={v => fmtTokensK(v)} width={40} />
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0]?.payload as typeof tokenData[0]
                    const dotColor = d.result === 'approved' ? '#16a34a' : d.result === 'changes-requested' ? '#dc2626' : '#d97706'
                    return (
                      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '9px 12px', fontSize: '12px', boxShadow: '0 4px 16px rgba(0,0,0,.1)', maxWidth: '230px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                          <span style={{ fontFamily: 'ui-monospace,monospace', color: '#475569', fontSize: '11px' }}>{d.pr}</span>
                          <span style={{ fontSize: '10px', fontWeight: 600, color: dotColor, background: dotColor + '18', borderRadius: '4px', padding: '1px 5px' }}>
                            {d.result === 'changes-requested' ? 'changes' : d.result}
                          </span>
                        </div>
                        <div style={{ color: '#1e293b', fontWeight: 500, lineHeight: 1.35, marginBottom: '6px' }}>
                          {d.title.length > 52 ? d.title.slice(0, 50) + '…' : d.title}
                        </div>
                        <div style={{ color: '#6366f1', fontWeight: 700 }}>{fmtTokensK(d.tokens)} tokens</div>
                        <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '2px' }}>${d.cost.toFixed(3)}</div>
                      </div>
                    )
                  }} />
                  <Area
                    type="monotone"
                    dataKey="tokens"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fill="url(#tokenGrad)"
                    dot={tokenData.length <= 30 ? { r: 3, fill: '#6366f1', strokeWidth: 0 } : false}
                    activeDot={{ r: 5, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        {/* AIC Credits line chart — full width, shown only when data exists */}
        {hasAicData && (
          <div style={{ marginBottom: '12px' }}>
            <Card title="AIC Credits per Review" sub="GitHub Copilot AIC consumption — each point is one PR">
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={aicData} margin={{ top: 6, right: 8, bottom: 0, left: -4 }}>
                  <defs>
                    <linearGradient id="aicGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="date" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0]?.payload as typeof aicData[0]
                    const dotColor = d.result === 'approved' ? '#16a34a' : d.result === 'changes-requested' ? '#dc2626' : '#d97706'
                    return (
                      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '9px 12px', fontSize: '12px', boxShadow: '0 4px 16px rgba(0,0,0,.1)', maxWidth: '230px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                          <span style={{ fontFamily: 'ui-monospace,monospace', color: '#475569', fontSize: '11px' }}>{d.pr}</span>
                          <span style={{ fontSize: '10px', fontWeight: 600, color: dotColor, background: dotColor + '18', borderRadius: '4px', padding: '1px 5px' }}>
                            {d.result === 'changes-requested' ? 'changes' : d.result}
                          </span>
                        </div>
                        <div style={{ color: '#1e293b', fontWeight: 500, lineHeight: 1.35, marginBottom: '6px' }}>
                          {d.title.length > 52 ? d.title.slice(0, 50) + '…' : d.title}
                        </div>
                        <div style={{ color: '#7c3aed', fontWeight: 700 }}>{d.aic} AIC credits</div>
                      </div>
                    )
                  }} />
                  <Area
                    type="monotone"
                    dataKey="aic"
                    stroke="#7c3aed"
                    strokeWidth={2}
                    fill="url(#aicGrad)"
                    dot={aicData.length <= 30 ? { r: 3, fill: '#7c3aed', strokeWidth: 0 } : false}
                    activeDot={{ r: 5, fill: '#7c3aed', stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* Findings by hat + author activity */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <Card title="Findings by Hat" sub="total findings across all reviews">
            {findingsArr.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: '12px', paddingTop: '4px' }}>No finding data available.</div>
            ) : (
              <div style={{ paddingTop: '4px' }}>
                {findingsArr.map(d => {
                  const s = hatStyle(d.name)
                  return (
                    <HBar key={d.name} label={d.name} value={d.count} max={maxFindings} color={s.color} />
                  )
                })}
              </div>
            )}
          </Card>

          <Card title="Author Activity" sub="reviews submitted per author">
            <div style={{ paddingTop: '4px' }}>
              {authorArr.map(d => (
                <HBar key={d.name} label={d.name} value={d.count} max={maxAuthor} color="#3b82f6" />
              ))}
            </div>
          </Card>
        </div>

        {/* Time distribution + model/provider */}
        <div style={{ display: 'grid', gridTemplateColumns: hasModelData ? '1fr 1fr' : '1fr', gap: '12px' }}>
          <Card title="Review Time Distribution" sub="number of reviews in each time range">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={timeDistData} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="bucket" tick={AXIS} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={(p) => <ChartTip {...(p as any)} />} />
                <Bar dataKey="count" fill="#8b5cf6" radius={[4,4,0,0]} name="Reviews" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {hasModelData && (
            <Card title="Model & Provider" sub="reviews per provider / top models used">
              <div style={{ paddingTop: '4px' }}>
                {providerArr.length > 0 && (
                  <>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Provider</div>
                    {providerArr.map(d => (
                      <HBar key={d.name} label={d.name} value={d.count} max={maxProvider} color={PROVIDER_COLOR[d.name as LlmProvider] ?? '#475569'} />
                    ))}
                  </>
                )}
                {modelArr.length > 0 && (
                  <>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: providerArr.length ? '12px' : '0', marginBottom: '6px' }}>Models</div>
                    {modelArr.map(d => (
                      <HBar key={d.name} label={d.name} value={d.count} max={maxModel} color="#6366f1" />
                    ))}
                  </>
                )}
              </div>
            </Card>
          )}
        </div>

      </div>
    </div>
  )
}

