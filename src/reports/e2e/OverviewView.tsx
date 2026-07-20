import { useState } from 'react'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import type { E2eAggregateReport, E2eRunEntry, E2eRunStatus } from './types'
import PanelTopBar from '../../components/PanelTopBar'
import { S } from '../../lib/designTokens'

// ── Exported helpers (used by Dashboard sidebar) ──────────────────────────────

export function runLabel(r: E2eRunEntry): string {
  return r.suiteName ?? r.suite ?? r.jobName ?? 'Run'
}

export function runStatusColor(status: E2eRunStatus | string): string {
  if (status === 'passed'   || status === 'succeeded') return '#22c55e'
  if (status === 'failed')                             return '#ef4444'
  if (status === 'succeeded_with_issues')              return '#f97316'
  if (status === 'flaky')                              return '#f59e0b'
  if (status === 'timedout')                           return '#f97316'
  if (status === 'interrupted')                        return '#8b5cf6'
  if (status === 'inProgress')                         return '#3b82f6'
  if (status === 'cancelling')                         return '#f97316'
  return '#94a3b8'
}

export function isInProgressStatus(status: string): boolean {
  return status === 'inProgress' || status === 'notStarted' || status === 'cancelling'
}

export function runEffectiveStatus(run: { status: string; result?: string }): string {
  return run.result ?? run.status
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMs(ms: number) {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function fmtWhen(iso: string | undefined) {
  if (!iso) return null
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function pct(n: number, total: number) {
  return total > 0 ? Math.round((n / total) * 100) : 0
}

export function browserName(label: string | undefined): string {
  if (!label) return 'Unknown'
  return label.includes('·') ? label.split('·')[0].trim() : label.trim()
}

const STATUS_LABEL: Record<string, string> = {
  passed: 'Passed', succeeded: 'Passed', failed: 'Failed', timedout: 'Timed Out',
  flaky: 'Flaky', succeeded_with_issues: 'Succeeded w/ Issues', interrupted: 'Interrupted',
  inProgress: 'In Progress', notStarted: 'Not Started', cancelling: 'Cancelling',
}

// ── Time range filter ─────────────────────────────────────────────────────────

const RANGES = ['24H', '7D', '30D', 'ALL'] as const
type Range = typeof RANGES[number]

const RANGE_WINDOW_MS: Record<Exclude<Range, 'ALL'>, number> = {
  '24H': 24 * 3_600_000,
  '7D':  7 * 24 * 3_600_000,
  '30D': 30 * 24 * 3_600_000,
}

// Anchors the window to the newest run in the report (not wall-clock now) so
// historical/fixture reports still show data instead of an empty range.
function filterByRange(runs: E2eRunEntry[], range: Range): E2eRunEntry[] {
  if (range === 'ALL') return runs
  let anchor = -Infinity
  for (const r of runs) {
    if (!r.generatedAt) continue
    const ms = new Date(r.generatedAt).getTime()
    if (ms > anchor) anchor = ms
  }
  if (!Number.isFinite(anchor)) return runs
  const cutoff = anchor - RANGE_WINDOW_MS[range]
  return runs.filter(r => r.generatedAt && new Date(r.generatedAt).getTime() >= cutoff)
}

// ── Data derivation ───────────────────────────────────────────────────────────

interface BucketData {
  passed: number; failed: number; flaky: number; skipped: number; total: number
  runs: number; failedRuns: number
  totalDurationMs: number; durationCount: number
}

function emptyBucket(): BucketData {
  return { passed: 0, failed: 0, flaky: 0, skipped: 0, total: 0, runs: 0, failedRuns: 0, totalDurationMs: 0, durationCount: 0 }
}

function addRun(b: BucketData, r: E2eRunEntry): BucketData {
  const s = r.summary
  const eff = runEffectiveStatus(r)
  const isBad = eff === 'failed' || eff === 'succeeded_with_issues' || eff === 'timedout'
  const skipped = Math.max(0, (s?.total ?? 0) - (s?.passed ?? 0) - (s?.failed ?? 0) - (s?.flaky ?? 0))
  const durMs = r.executionTimeMs ?? r.durationMs ?? 0
  return {
    passed:          b.passed          + (s?.passed ?? 0),
    failed:          b.failed          + (s?.failed ?? 0),
    flaky:           b.flaky           + (s?.flaky  ?? 0),
    skipped:         b.skipped         + skipped,
    total:           b.total           + (s?.total  ?? 0),
    runs:            b.runs            + 1,
    failedRuns:      b.failedRuns      + (isBad ? 1 : 0),
    totalDurationMs: b.totalDurationMs + durMs,
    durationCount:   b.durationCount   + (durMs > 0 ? 1 : 0),
  }
}

function groupBy<K extends string>(runs: E2eRunEntry[], key: (r: E2eRunEntry) => K) {
  const map = new Map<K, BucketData>()
  for (const r of runs) {
    const k = key(r)
    map.set(k, addRun(map.get(k) ?? emptyBucket(), r))
  }
  return map
}

// Returns per-key time series: sorted array of { date, rate } points for sparklines
function timeSeries(runs: E2eRunEntry[], getKey: (r: E2eRunEntry) => string) {
  const outer = new Map<string, Map<string, BucketData>>()
  for (const r of runs) {
    const k    = getKey(r)
    const date = (r.generatedAt ?? '').slice(0, 10) || 'unknown'
    if (!outer.has(k)) outer.set(k, new Map())
    const inner = outer.get(k)!
    inner.set(date, addRun(inner.get(date) ?? emptyBucket(), r))
  }
  const result = new Map<string, { date: string; rate: number }[]>()
  for (const [k, dm] of outer) {
    result.set(k, [...dm.entries()]
      .sort(([a], [b]) => a < b ? -1 : 1)
      .map(([date, b]) => ({ date, rate: pct(b.passed, b.total) })))
  }
  return result
}

function latestOf(runs: E2eRunEntry[]): E2eRunEntry | null {
  let best: E2eRunEntry | null = null
  let bestMs = -Infinity
  for (const r of runs) {
    const ms = r.generatedAt ? new Date(r.generatedAt).getTime() : -Infinity
    if (ms >= bestMs) { best = r; bestMs = ms }
  }
  return best
}

// ── Status colors ─────────────────────────────────────────────────────────────

const C = {
  pass:  '#22c55e',
  fail:  '#ef4444',
  flaky: '#f59e0b',
  skip:  '#94a3b8',
}

function rateColor(rate: number): string {
  if (rate >= 90) return C.pass
  if (rate >= 70) return C.flaky
  return C.fail
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function TrendChart({ points, color, height = 48, gradKey }: {
  points: { date: string; rate: number }[]; color: string; height?: number; gradKey: string
}) {
  const gradId = `e2ov-${gradKey.replace(/[^a-zA-Z0-9]/g, '')}-${color.replace('#', '')}`
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={points} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="rate"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${gradId})`}
          dot={false}
          activeDot={{ r: 3, fill: color }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function RangeToggle({ range, onChange }: { range: Range; onChange: (r: Range) => void }) {
  return (
    <div style={{ display: 'flex', border: `1px solid ${S.border}`, borderRadius: '7px', overflow: 'hidden', flexShrink: 0 }}>
      {RANGES.map((label, i) => {
        const active = label === range
        return (
          <button
            key={label}
            onClick={() => onChange(label)}
            style={{
              padding:      '5px 10px',
              fontSize:     '11px',
              fontWeight:   600,
              border:       'none',
              borderLeft:   i > 0 ? `1px solid ${S.border}` : 'none',
              cursor:       'pointer',
              background:   active ? 'color-mix(in srgb, var(--color-accent) 14%, transparent)' : 'transparent',
              color:        active ? 'var(--color-accent)' : S.fgMuted,
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

function SummaryStat({ label, value, sub, subColor }: { label: string; value: string; sub?: string; subColor?: string }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: S.fgMuted }}>{label}</div>
      <div style={{ fontSize: '19px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: S.fg, marginTop: '2px' }}>{value}</div>
      {sub && <div style={{ fontSize: '10.5px', color: subColor ?? S.fgSubtle }}>{sub}</div>}
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div style={{ fontSize: '9.5px', letterSpacing: '0.06em', textTransform: 'uppercase', color: S.fgMuted }}>{label}</div>
      <div style={{ fontSize: '17px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color, marginTop: '1px' }}>{value}</div>
    </div>
  )
}

// ── Section: Suite cards ──────────────────────────────────────────────────────

function SuiteCard({ name, latest, bucket, trend, onOpen }: {
  name: string
  latest: E2eRunEntry
  bucket: BucketData
  trend: { date: string; rate: number }[]
  onOpen: () => void
}) {
  const eff         = runEffectiveStatus(latest)
  const statusColor = runStatusColor(eff)
  const statusLabel = STATUS_LABEL[eff] ?? eff
  const rate        = pct(bucket.passed, bucket.total)
  const rColor      = rateColor(rate)
  const avgMs       = bucket.durationCount > 0 ? Math.round(bucket.totalDurationMs / bucket.durationCount) : null
  const browser     = browserName(latest.matrixLabel)
  const when        = fmtWhen(latest.generatedAt)

  const metaParts = [
    when ? `Last run ${when}` : null,
    browser !== 'Unknown' ? browser : null,
    `${bucket.runs} run${bucket.runs !== 1 ? 's' : ''}`,
    avgMs !== null ? `avg ${fmtMs(avgMs)}` : null,
  ].filter(Boolean)

  return (
    <div
      onClick={onOpen}
      style={{
        cursor:       'pointer',
        background:   S.surface,
        border:       `1px solid ${S.border}`,
        borderLeft:   `3px solid ${statusColor}`,
        borderRadius: '12px',
        padding:      '16px 18px',
        display:      'flex',
        flexDirection: 'column',
        gap:          '8px',
        minWidth:     0,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: S.fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </div>
        <span style={{
          fontSize: '10.5px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', flexShrink: 0, whiteSpace: 'nowrap',
          background: `color-mix(in srgb, ${statusColor} 16%, transparent)`, color: statusColor,
        }}>
          {statusLabel}
        </span>
      </div>

      <div style={{ fontSize: '11px', color: S.fgSubtle }}>{metaParts.join(' · ')}</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '2px' }}>
        <MiniStat label="Pass rate" value={`${rate}%`} color={rColor} />
        <MiniStat label="Failed"    value={String(bucket.failed)} color={bucket.failed > 0 ? C.fail  : S.fgMuted} />
        <MiniStat label="Flaky"     value={String(bucket.flaky)}  color={bucket.flaky  > 0 ? C.flaky : S.fgMuted} />
      </div>

      {trend.length >= 2 && (
        <div style={{ marginTop: '2px' }}>
          <TrendChart points={trend} color={rColor} height={32} gradKey={`suite-${name}`} />
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
        <span style={{ fontSize: '11.5px', color: S.fgSubtle }}>
          {bucket.failed > 0 ? `${bucket.failed} tests failed recently` : 'All tests passing'}
        </span>
        <span style={{ fontSize: '11.5px', color: 'var(--color-accent)', fontWeight: 600 }}>
          Details ▸
        </span>
      </div>
    </div>
  )
}

// ── Section: Browser matrix ───────────────────────────────────────────────────

const MATRIX_COLS = '1.3fr 0.7fr 0.8fr 0.7fr 0.7fr 0.8fr 1.6fr'

function BrowserMatrix({ data }: {
  data: { key: string; bucket: BucketData; trend: { date: string; rate: number }[] }[]
}) {
  if (data.length === 0) return null
  return (
    <div>
      <h6 style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 600, color: S.fgMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        Browser Matrix
      </h6>
      <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: '10px', padding: '0 16px' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: MATRIX_COLS, gap: '10px',
          fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: S.fgSubtle,
          padding: '10px 0', borderBottom: `1px solid ${S.divider}`,
        }}>
          <div>Browser</div>
          <div style={{ textAlign: 'right' }}>Runs</div>
          <div style={{ textAlign: 'right' }}>Avg</div>
          <div style={{ textAlign: 'right' }}>Failed</div>
          <div style={{ textAlign: 'right' }}>Flaky</div>
          <div style={{ textAlign: 'right' }}>Pass rate</div>
          <div />
        </div>
        {data.map(({ key, bucket: b, trend }, i) => {
          const rate   = pct(b.passed, b.total)
          const rColor = rateColor(rate)
          const avgMs  = b.durationCount > 0 ? Math.round(b.totalDurationMs / b.durationCount) : null
          return (
            <div key={key} style={{
              display: 'grid', gridTemplateColumns: MATRIX_COLS, gap: '10px', alignItems: 'center', padding: '10px 0',
              borderBottom: i < data.length - 1 ? `1px solid ${S.divider}` : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', fontWeight: 600, color: S.fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: rColor, flexShrink: 0 }} />
                {key}
              </div>
              <div style={{ textAlign: 'right', fontSize: '12.5px', fontVariantNumeric: 'tabular-nums', color: S.fgSec }}>{b.runs}</div>
              <div style={{ textAlign: 'right', fontSize: '12.5px', fontVariantNumeric: 'tabular-nums', color: S.fgSec }}>{avgMs !== null ? fmtMs(avgMs) : '—'}</div>
              <div style={{ textAlign: 'right', fontSize: '12.5px', fontVariantNumeric: 'tabular-nums', color: b.failed > 0 ? C.fail  : S.fgMuted }}>{b.failed}</div>
              <div style={{ textAlign: 'right', fontSize: '12.5px', fontVariantNumeric: 'tabular-nums', color: b.flaky  > 0 ? C.flaky : S.fgMuted }}>{b.flaky}</div>
              <div style={{ textAlign: 'right', fontSize: '15px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: rColor }}>{rate}%</div>
              <div style={{ height: '22px' }}>
                {trend.length >= 2 && <TrendChart points={trend} color={rColor} height={22} gradKey={`browser-${key}`} />}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface Props {
  report: E2eAggregateReport
  onSelectRun: (run: E2eRunEntry) => void
}

export default function OverviewView({ report, onSelectRun }: Props) {
  const [range, setRange] = useState<Range>('7D')

  const allRuns = report.reviews ?? report.runs ?? []
  const runs    = filterByRange(allRuns, range)

  const suiteRunsMap = new Map<string, E2eRunEntry[]>()
  for (const r of runs) {
    const k = r.suiteName ?? r.suite ?? 'Unknown'
    if (!suiteRunsMap.has(k)) suiteRunsMap.set(k, [])
    suiteRunsMap.get(k)!.push(r)
  }

  const suiteMap      = groupBy(runs, r => r.suiteName ?? r.suite ?? 'Unknown')
  const browserMap    = groupBy(runs, r => browserName(r.matrixLabel))
  const suiteTrends   = timeSeries(runs, r => r.suiteName ?? r.suite ?? 'Unknown')
  const browserTrends = timeSeries(runs, r => browserName(r.matrixLabel))

  const suiteData = [...suiteMap.entries()]
    .map(([k, b]) => ({ key: k, bucket: b, trend: suiteTrends.get(k) ?? [], latest: latestOf(suiteRunsMap.get(k) ?? []) }))
    .filter((d): d is typeof d & { latest: E2eRunEntry } => d.latest !== null)
    .sort((a, b) => b.bucket.total - a.bucket.total)

  const browserData = [...browserMap.entries()]
    .filter(([k]) => k !== 'Unknown')
    .map(([k, b]) => ({ key: k, bucket: b, trend: browserTrends.get(k) ?? [] }))
    .sort((a, b) => b.bucket.total - a.bucket.total)

  const totalRuns   = runs.length
  const failedRuns  = runs.filter(r => {
    const e = runEffectiveStatus(r)
    return e === 'failed' || e === 'succeeded_with_issues' || e === 'timedout'
  }).length
  const totalTests  = runs.reduce((n, r) => n + (r.summary?.total  ?? 0), 0)
  const failedTests = runs.reduce((n, r) => n + (r.summary?.failed ?? 0), 0)
  const flakyTests  = runs.reduce((n, r) => n + (r.summary?.flaky  ?? 0), 0)
  const passedTests = runs.reduce((n, r) => n + (r.summary?.passed ?? 0), 0)
  const passRate    = pct(passedTests, totalTests)

  const updatedAt = report.updatedAt ?? report.generatedAt

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PanelTopBar
        left={
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: S.fg }}>Overview</div>
            {updatedAt && (
              <div style={{ fontSize: '11px', color: S.fgMuted, marginTop: '1px' }}>
                Updated {new Date(updatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </div>
            )}
          </div>
        }
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
            {allRuns.length > 0 && (
              <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
                <SummaryStat label="Runs"      value={String(totalRuns)} sub={failedRuns > 0 ? `${failedRuns} failed` : 'all healthy'} subColor={failedRuns > 0 ? C.fail : C.pass} />
                <SummaryStat label="Pass rate" value={`${passRate}%`}    sub={`${range} range`} />
                <SummaryStat label="Tests"     value={String(totalTests)} sub={failedTests > 0 ? `${failedTests} failed` : undefined} subColor={C.fail} />
                <SummaryStat label="Flaky"     value={String(flakyTests)} sub={flakyTests > 0 ? 'flagged' : undefined} subColor={C.flaky} />
              </div>
            )}
            <RangeToggle range={range} onChange={setRange} />
            {report.schemaVersion && <div style={{ fontSize: '11px', color: S.fgSubtle }}>v{report.schemaVersion}</div>}
          </div>
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--color-background)', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {allRuns.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: S.fgMuted }}>No runs in this report.</div>
        ) : runs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: S.fgMuted }}>No runs in the selected range.</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
              {suiteData.map(({ key, bucket, trend, latest }) => (
                <SuiteCard key={key} name={key} latest={latest} bucket={bucket} trend={trend} onOpen={() => onSelectRun(latest)} />
              ))}
            </div>

            <BrowserMatrix data={browserData} />
          </>
        )}
      </div>
    </div>
  )
}
