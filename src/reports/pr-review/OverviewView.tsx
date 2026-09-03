import { useState } from 'react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { getCopilotBillingUsage, getTokenUsage, type PrReview, type PrReviewReport } from './types'
import PanelTopBar from '../../components/PanelTopBar'
import Card from '../../components/report-ui/Card'
import KpiCard from '../../components/report-ui/KpiCard'
import HBar from '../../components/report-ui/HBar'
import ChartTip from '../../components/report-ui/ChartTip'
import { S } from '../../lib/designTokens'
import { fmtMs, fmtTokensK, shortDate, isoWeekKey } from '../../lib/format'
import { hatStyle } from '../../lib/reviewStyles'
import { METRIC_EXPLANATIONS } from './metricDefinitions'
import MetricLabel from '../../components/report-ui/MetricLabel'

// ── Helpers ───────────────────────────────────────────────────────────────────

function mean(xs: number[]) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0 }
function percentile(xs: number[], value: number) {
  if (xs.length === 0) return 0
  const sorted = [...xs].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(value * sorted.length) - 1)]
}
function fmtCredits(value: number) { return value.toLocaleString('en-US', { maximumFractionDigits: 2 }) }

// ── Main ──────────────────────────────────────────────────────────────────────

interface Props {
  report:    PrReviewReport
  reportId:  string
  authorBg?: (name: string) => string
  initials?: (name: string) => string
  onSelectPr?: (pr: PrReview) => void
}

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

  const activePeriodLabel = filterDays == null
    ? report.period
    : filterDays === 1
    ? 'Today'
    : `Last ${filterDays} days`

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
  const evidenceConfidence = mean(reviews.map(r => r.accuracyRating))
  const medianTimeMs   = percentile(reviews.map(r => r.timeToReviewMs), 0.5)
  const p90TimeMs      = percentile(reviews.map(r => r.timeToReviewMs), 0.9)
  const changesCount   = reviews.filter(r => r.result === 'changes-requested').length
  const groundedReviews = reviews.filter(r => r.diffGrounding)
  const degradedGroundingCount = groundedReviews.filter(r => r.diffGrounding?.degraded || !r.diffGrounding?.enforced).length
  const attentionCount = reviews.filter(r =>
    r.result === 'changes-requested' || r.diffGrounding?.degraded || r.diffGrounding?.enforced === false,
  ).length

  // ── Avg review time trend — current window vs the immediately preceding
  // equal-length window. For "All" there's no natural preceding window of
  // the same length, so fall back to a fixed last-7d-vs-prior-7d comparison.
  const trendWindowDays  = filterDays ?? 7
  const trendCutoffMs    = latestMs - trendWindowDays * 864e5
  const prevCutoffMs     = trendCutoffMs - trendWindowDays * 864e5
  const currTrendReviews = filterDays == null
    ? allReviews.filter(r => latestMs - new Date(r.reviewedAt).getTime() <= trendWindowDays * 864e5)
    : reviews
  const prevTrendReviews = allReviews.filter(r => {
    const t = new Date(r.reviewedAt).getTime()
    return t > prevCutoffMs && t <= trendCutoffMs
  })
  const avgTimeCurrMs = mean(currTrendReviews.map(r => r.timeToReviewMs))
  const avgTimePrevMs = mean(prevTrendReviews.map(r => r.timeToReviewMs))
  const hasTrend  = currTrendReviews.length > 0 && prevTrendReviews.length > 0 && avgTimePrevMs > 0
  const trendPct  = hasTrend ? Math.round(((avgTimeCurrMs - avgTimePrevMs) / avgTimePrevMs) * 100) : null
  const trendFaster = trendPct != null && trendPct <= 0

  const billingReviews = reviews.flatMap(r => {
    const usage = getCopilotBillingUsage(r)
    return usage ? [{ review: r, usage }] : []
  })
  const totalAiCredits = billingReviews
    .reduce((sum, { usage }) => sum + usage.value, 0)
  const billingLabel = 'Attributed AIC'
  const authoritativeUsage = report.copilotUsage
  const billingSub = authoritativeUsage
    ? `GitHub ${authoritativeUsage.scopeType} · ${shortDate(authoritativeUsage.reportStartDay)} – ${shortDate(authoritativeUsage.reportEndDay)} · ${authoritativeUsage.userCount} users`
    : 'official GitHub usage unavailable'
  const attributedCreditsValue = billingReviews.length > 0 ? fmtCredits(totalAiCredits) : '—'
  const attributedCreditsSub = billingReviews.length > 0
    ? `${billingReviews.length} of ${reviews.length} PRs · ${Math.round((billingReviews.length / reviews.length) * 100)}% coverage`
    : 'per-review attribution unavailable'
  const tokenUsages = reviews.flatMap(review => {
    const usage = getTokenUsage(review)
    return usage ? [usage] : []
  })
  const measuredTokenReviews = tokenUsages.filter(usage => usage.source === 'provider' && usage.totalTokens != null)
  const measuredTokenCoverage = reviews.length > 0
    ? Math.round((measuredTokenReviews.length / reviews.length) * 100)
    : null
  const modelExecutions = reviews.flatMap(r => r.modelsUsed ?? (r.provider && r.model ? [{ provider: r.provider, model: r.model }] : []))
  const tieredModelExecutions = modelExecutions.filter(entry => entry.tier)
  const modelPolicyCoverage = modelExecutions.length > 0
    ? Math.round((tieredModelExecutions.length / modelExecutions.length) * 100)
    : null
  const fallbackExecutions = modelExecutions.filter(entry => Math.max(
    entry.attemptedModels?.length ?? 0,
    entry.attemptedReasoningEfforts?.length ?? 0,
    entry.attemptedConfigurations?.length ?? 0,
  ) > 1).length

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

  // ── Avg review time over time — same bucket granularity as periodData
  const avgTimeChartTitle = filterDays === 1 ? 'Avg Review Time by Hour'
    : filterDays != null && filterDays <= 14 ? 'Avg Review Time by Day'
    : 'Avg Review Time by Week'

  type AvgTimePoint = { label: string; avgMs: number }
  let avgTimeSeriesData: AvgTimePoint[]
  if (filterDays === 1) {
    const hourSums = Array.from({ length: 24 }, () => ({ sum: 0, count: 0 }))
    for (const r of reviews) {
      const h = new Date(r.reviewedAt).getHours()
      hourSums[h].sum += r.timeToReviewMs
      hourSums[h].count++
    }
    avgTimeSeriesData = hourSums
      .map((b, h) => ({ h, ...b }))
      .filter(b => b.count > 0)
      .map(b => ({
        label: b.h === 0 ? '12am' : b.h < 12 ? `${b.h}am` : b.h === 12 ? '12pm' : `${b.h - 12}pm`,
        avgMs: b.sum / b.count,
      }))
  } else if (filterDays != null && filterDays <= 14) {
    const dayMap = new Map<string, { sum: number; count: number }>()
    for (const r of reviews) {
      const key = r.reviewedAt.slice(0, 10)
      const b = dayMap.get(key) ?? { sum: 0, count: 0 }
      b.sum += r.timeToReviewMs; b.count++
      dayMap.set(key, b)
    }
    avgTimeSeriesData = Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, b]) => ({ label: shortDate(key), avgMs: b.sum / b.count }))
  } else {
    const weekMap = new Map<string, { sum: number; count: number }>()
    for (const r of reviews) {
      const wk = isoWeekKey(r.reviewedAt)
      const b = weekMap.get(wk) ?? { sum: 0, count: 0 }
      b.sum += r.timeToReviewMs; b.count++
      weekMap.set(wk, b)
    }
    avgTimeSeriesData = Array.from(weekMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, b]) => ({ label: shortDate(key), avgMs: b.sum / b.count }))
  }

  // ── Token + Copilot billing usage per review
  const tokenData = reviews.map(r => {
    const usage = getTokenUsage(r)
    return {
    date:       shortDate(r.reviewedAt.slice(0, 10)),
    tokens:     usage?.totalTokens ?? null,
    input:      usage?.inputTokens ?? null,
    output:     usage?.outputTokens ?? null,
    cacheRead:  usage?.cacheReadTokens ?? null,
    prompt:     usage?.promptTokensEstimated ?? null,
    source:     usage?.source ?? 'unknown',
    cost:       r.estimatedCostUsd,
    pr:         `#${r.prNumber}`,
    title:      r.prTitle,
    result:     r.result,
    }
  })

  const billingData = billingReviews.map(({ review, usage }) => ({
      date:   shortDate(review.reviewedAt.slice(0, 10)),
      usage:  usage.value,
      pr:     `#${review.prNumber}`,
      title:  review.prTitle,
      result: review.result,
    }))
  const hasBillingData = billingData.length > 0
  const billingUnitLabel = 'AI credits'

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

  // ── Model policy execution mix
  const tierMap = new Map<string, number>()
  const modelMap    = new Map<string, number>()
  for (const entry of modelExecutions) {
    if (entry.tier) tierMap.set(entry.tier, (tierMap.get(entry.tier) ?? 0) + 1)
    if (entry.model) modelMap.set(entry.model, (modelMap.get(entry.model) ?? 0) + 1)
  }
  const tierArr     = Array.from(tierMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
  const modelArr    = Array.from(modelMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 6)
  const maxTier     = tierArr[0]?.count ?? 1
  const maxModel    = modelArr[0]?.count ?? 1
  const hasModelData = modelArr.length > 0

  const AXIS = { fontSize: 11, fill: 'var(--color-foreground-subtle)' }
  const GRID = { strokeDasharray: '3 3' as const, stroke: 'var(--color-border)' }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-background)' }}>
      <PanelTopBar
        left={
          <div>
            <div style={{ fontSize: '11px', color: S.fgSubtle, marginBottom: '2px' }}>{reportId}</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: S.fg }}>{report.title ?? 'PR Review Report'}</div>
            {report.subtitle && (
              <div style={{ fontSize: '11px', color: S.fgMuted, marginTop: '1px' }}>{report.subtitle}</div>
            )}
          </div>
        }
        right={
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              {RANGE_OPTIONS.map(opt => {
                const active = filterDays === opt.days
                return (
                  <button
                    key={opt.label}
                    onClick={() => setFilterDays(opt.days)}
                    style={{
                      fontSize: '12px', fontWeight: 500, padding: '4px 12px',
                      borderRadius: '6px', cursor: 'pointer', border: 'none',
                      background: active ? S.fg : S.sunken,
                      color: active ? 'var(--color-background)' : S.fgMuted,
                      transition: 'background 0.12s, color 0.12s',
                    }}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
            {activePeriodLabel && (
              <span style={{ fontSize: '11px', color: S.fgSubtle }}>{activePeriodLabel}</span>
            )}
          </div>
        }
      />

      <div style={{ padding: '20px 24px', maxWidth: '1100px', margin: '0 auto' }}>

        {/* Decision row: the four numbers stakeholders need first. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px', marginBottom: '12px' }}>
          <KpiCard label="PRs Reviewed" value={String(reviews.length)} sub={activePeriodLabel} explanation={METRIC_EXPLANATIONS.prsReviewed} />
          <KpiCard
            label="Median Review Time"
            value={fmtMs(medianTimeMs)}
            explanation={METRIC_EXPLANATIONS.reviewTime}
            sub={<>{`p90 ${fmtMs(p90TimeMs)}`}{trendPct != null && (
              <span style={{ color: trendFaster ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                {' · '}{trendFaster ? '▼' : '▲'} {Math.abs(trendPct)}% avg {trendFaster ? 'faster' : 'slower'}
              </span>
            )}</>}
          />
          <KpiCard label="Needs Attention" value={String(attentionCount)} sub={`${changesCount} changes · ${degradedGroundingCount} grounding`} accent={attentionCount > 0 ? '#dc2626' : '#16a34a'} explanation={METRIC_EXPLANATIONS.needsAttention} />
          <KpiCard label="Review-agent AIC" value={attributedCreditsValue} sub={attributedCreditsSub} accent="#7c3aed" explanation={METRIC_EXPLANATIONS.reviewAic} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '1px', background: S.divider, border: `1px solid ${S.divider}`, borderRadius: '10px', overflow: 'visible', marginBottom: '16px' }}>
          <KpiCard label="Evidence Confidence" value={`${evidenceConfidence.toFixed(1)}%`} sub="deterministic evidence score" accent="#16a34a" explanation={METRIC_EXPLANATIONS.averageEvidenceConfidence} />
          <KpiCard label="Grounding Coverage" value={reviews.length === 0 ? '—' : `${Math.round((groundedReviews.length / reviews.length) * 100)}%`} sub={`${groundedReviews.length} of ${reviews.length} PRs`} explanation={METRIC_EXPLANATIONS.groundingCoverage} />
          <KpiCard label="Measured Token Coverage" value={measuredTokenCoverage == null ? '—' : `${measuredTokenCoverage}%`} sub={`${measuredTokenReviews.length} of ${reviews.length} PRs`} explanation={METRIC_EXPLANATIONS.tokenCoverage} />
          <KpiCard label="Model Policy Metadata" value={modelPolicyCoverage == null ? '—' : `${modelPolicyCoverage}%`} sub={modelPolicyCoverage === 0 ? 'tier telemetry missing · freshness not reported' : `${tieredModelExecutions.length} of ${modelExecutions.length} executions · ${fallbackExecutions} fallbacks`} explanation={METRIC_EXPLANATIONS.modelPolicyCoverage} />
        </div>

        {authoritativeUsage && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', background: S.sunken, border: `1px solid ${S.border}`, borderRadius: '8px', padding: '9px 12px', marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', color: S.fgMuted }}>
              <strong style={{ color: S.fgSec }}><MetricLabel explanation={METRIC_EXPLANATIONS.organizationAic}>Organization Copilot Usage</MetricLabel></strong> · {billingSub}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              <strong style={{ color: '#7c3aed', fontVariantNumeric: 'tabular-nums' }}>{fmtCredits(authoritativeUsage.totalAiCreditsUsed)}</strong>
              <span style={{ color: S.fgMuted, fontSize: '11px' }}>AIC</span>
            </div>
          </div>
        )}

        {/* Avg review time over time */}
        <div style={{ marginBottom: '12px' }}>
          <Card title={avgTimeChartTitle} sub="average time-to-review per bucket">
            {avgTimeSeriesData.length === 0 ? (
              <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.fgSubtle, fontSize: '12px' }}>
                No reviews in this range
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={avgTimeSeriesData} margin={{ top: 6, right: 8, bottom: 0, left: -4 }}>
                  <defs>
                    <linearGradient id="avgTimeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#0ea5e9" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={v => fmtMs(v)} width={48} />
                  <Tooltip content={(p) => <ChartTip {...(p as any)} fmt={fmtMs} />} />
                  <Area
                    type="monotone"
                    dataKey="avgMs"
                    name="Avg time"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    fill="url(#avgTimeGrad)"
                    dot={avgTimeSeriesData.length <= 30 ? { r: 3, fill: '#0ea5e9', strokeWidth: 0 } : false}
                    activeDot={{ r: 5, fill: '#0ea5e9', stroke: S.surface, strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        {/* Reviews by period + token usage */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <Card title={periodChartTitle} sub="stacked by outcome">
            {periodData.length === 0 ? (
              <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.fgSubtle, fontSize: '12px' }}>
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
                    <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: S.fgMuted }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: c, flexShrink: 0 }} />
                      {l}
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>

          <Card title="Token Traffic per Review" sub="provider totals when available; estimates are labeled">
            {tokenData.length === 0 ? (
              <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.fgSubtle, fontSize: '12px' }}>
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
                      <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: '8px', padding: '9px 12px', fontSize: '12px', boxShadow: '0 4px 16px rgba(0,0,0,.12)', maxWidth: '230px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                          <span style={{ fontFamily: 'ui-monospace,monospace', color: S.fgMuted, fontSize: '11px' }}>{d.pr}</span>
                          <span style={{ fontSize: '10px', fontWeight: 600, color: dotColor, background: dotColor + '18', borderRadius: '4px', padding: '1px 5px' }}>
                            {d.result === 'changes-requested' ? 'changes' : d.result}
                          </span>
                        </div>
                        <div style={{ color: S.fgSec, fontWeight: 500, lineHeight: 1.35, marginBottom: '6px' }}>
                          {d.title.length > 52 ? d.title.slice(0, 50) + '…' : d.title}
                        </div>
                        <div style={{ color: '#6366f1', fontWeight: 700 }}>{d.tokens == null ? 'tokens unavailable' : `${fmtTokensK(d.tokens)} tokens`}</div>
                        <div style={{ color: S.fgMuted, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>{d.source}</div>
                        {d.input != null && <div style={{ color: S.fgSubtle, fontSize: '11px', marginTop: '4px' }}>{fmtTokensK(d.input)} input{d.output == null ? '' : ` · ${fmtTokensK(d.output)} output`}</div>}
                        {d.cacheRead != null && <div style={{ color: S.fgSubtle, fontSize: '11px' }}>{fmtTokensK(d.cacheRead)} cache read</div>}
                        {d.prompt != null && <div style={{ color: S.fgSubtle, fontSize: '11px' }}>{fmtTokensK(d.prompt)} prompt packet estimate</div>}
                        <div style={{ color: S.fgSubtle, fontSize: '11px', marginTop: '2px' }}>{d.cost == null ? 'token cost unavailable' : `$${d.cost.toFixed(3)} estimated token cost`}</div>
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
                    activeDot={{ r: 5, fill: '#6366f1', stroke: S.surface, strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        {/* Copilot billing usage line chart */}
        {hasBillingData && (
          <div style={{ marginBottom: '12px' }}>
            <Card title={`${billingLabel} per Review`} sub={`GitHub Copilot ${billingUnitLabel} — each point is one stored PR snapshot`}>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={billingData} margin={{ top: 6, right: 8, bottom: 0, left: -4 }}>
                  <defs>
                    <linearGradient id="aicGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="date" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={value => fmtCredits(value)} width={38} />
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0]?.payload as typeof billingData[0]
                    const dotColor = d.result === 'approved' ? '#16a34a' : d.result === 'changes-requested' ? '#dc2626' : '#d97706'
                    return (
                      <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: '8px', padding: '9px 12px', fontSize: '12px', boxShadow: '0 4px 16px rgba(0,0,0,.12)', maxWidth: '230px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                          <span style={{ fontFamily: 'ui-monospace,monospace', color: S.fgMuted, fontSize: '11px' }}>{d.pr}</span>
                          <span style={{ fontSize: '10px', fontWeight: 600, color: dotColor, background: dotColor + '18', borderRadius: '4px', padding: '1px 5px' }}>
                            {d.result === 'changes-requested' ? 'changes' : d.result}
                          </span>
                        </div>
                        <div style={{ color: S.fgSec, fontWeight: 500, lineHeight: 1.35, marginBottom: '6px' }}>
                          {d.title.length > 52 ? d.title.slice(0, 50) + '…' : d.title}
                        </div>
                        <div style={{ color: '#7c3aed', fontWeight: 700 }}>{fmtCredits(d.usage)} {billingUnitLabel}</div>
                      </div>
                    )
                  }} />
                  <Area
                    type="monotone"
                    dataKey="usage"
                    stroke="#7c3aed"
                    strokeWidth={2}
                    fill="url(#aicGrad)"
                    dot={billingData.length <= 30 ? { r: 3, fill: '#7c3aed', strokeWidth: 0 } : false}
                    activeDot={{ r: 5, fill: '#7c3aed', stroke: S.surface, strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* Review signal + policy execution mix */}
        <div style={{ display: 'grid', gridTemplateColumns: hasModelData ? '1fr 1fr' : '1fr', gap: '12px', marginBottom: '12px' }}>
          <Card title="Findings by Hat" sub="total findings across all reviews">
            {findingsArr.length === 0 ? (
              <div style={{ color: S.fgSubtle, fontSize: '12px', paddingTop: '4px' }}>No finding data available.</div>
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

          {hasModelData && (
            <Card title="Model Execution Mix" sub="track executions; freshness requires policy-audit telemetry">
              <div style={{ paddingTop: '4px' }}>
                {tierArr.length > 0 && (
                  <>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: S.fgSubtle, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Policy tier</div>
                    {tierArr.map(d => (
                      <HBar key={d.name} label={d.name} value={d.count} max={maxTier} color="#0ea5e9" />
                    ))}
                  </>
                )}
                {modelArr.length > 0 && (
                  <>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: S.fgSubtle, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: tierArr.length ? '12px' : '0', marginBottom: '6px' }}>Resolved model</div>
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
