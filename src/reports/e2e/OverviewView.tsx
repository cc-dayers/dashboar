import { useState, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { E2eAggregateReport, E2eRunEntry, E2eRunStatus } from './types'
import PanelTopBar from '../../components/PanelTopBar'
import { S } from '../../lib/designTokens'
import FlakyTests from './FlakyTests'

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

export function browserName(label: string | undefined): string {
  if (!label) return 'Unknown'
  return label.includes('·') ? label.split('·')[0].trim() : label.trim()
}

// ── Formatting ────────────────────────────────────────────────────────────────

function fmtDur(msVal: number) {
  const h = Math.floor(msVal / 3_600_000)
  const m = Math.floor((msVal % 3_600_000) / 60_000)
  const s = Math.floor((msVal % 60_000) / 1000)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function fmtWhen(iso: string | undefined) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function pct(n: number, total: number) {
  return total > 0 ? Math.round((n / total) * 100) : 0
}

function pct1(n: number, total: number) {
  return total > 0 ? Math.round((n / total) * 1000) / 10 : 0
}

function timeOf(iso: string | undefined): number {
  return iso ? new Date(iso).getTime() : NaN
}

const STATUS_LABEL: Record<string, string> = {
  passed: 'Passed', succeeded: 'Passed', failed: 'Failed', timedout: 'Timed out',
  flaky: 'Flaky', succeeded_with_issues: 'Issues', interrupted: 'Interrupted',
  inProgress: 'Running', notStarted: 'Queued', cancelling: 'Cancelling',
}

function isFailedStatus(eff: string): boolean {
  return eff === 'failed' || eff === 'timedout' || eff === 'succeeded_with_issues'
}

const C = { pass: '#22c55e', fail: '#ef4444', flaky: '#f59e0b', skip: '#64748b' }

function rateColor(rate: number): string {
  if (rate >= 95) return C.pass
  if (rate >= 85) return C.flaky
  return C.fail
}

// ── Time range ────────────────────────────────────────────────────────────────

const RANGES = ['24H', '7D', '30D', 'ALL'] as const
type Range = typeof RANGES[number]

const RANGE_WINDOW_MS: Record<Exclude<Range, 'ALL'>, number> = {
  '24H': 24 * 3_600_000, '7D': 7 * 24 * 3_600_000, '30D': 30 * 24 * 3_600_000,
}

// Window is anchored to the newest run, not wall-clock, so historical reports still render.
function filterByRange(runs: E2eRunEntry[], range: Range): E2eRunEntry[] {
  if (range === 'ALL') return runs
  let anchor = -Infinity
  for (const r of runs) {
    const t = timeOf(r.generatedAt)
    if (t > anchor) anchor = t
  }
  if (!Number.isFinite(anchor)) return runs
  const cutoff = anchor - RANGE_WINDOW_MS[range]
  return runs.filter(r => timeOf(r.generatedAt) >= cutoff)
}

// ── Aggregation ───────────────────────────────────────────────────────────────

interface Bucket {
  passed: number; failed: number; flaky: number; skipped: number; total: number
  runs: number; redRuns: number; cleanRuns: number
  durMs: number; durCount: number
}

function emptyBucket(): Bucket {
  return { passed: 0, failed: 0, flaky: 0, skipped: 0, total: 0, runs: 0, redRuns: 0, cleanRuns: 0, durMs: 0, durCount: 0 }
}

function addRun(b: Bucket, r: E2eRunEntry): Bucket {
  const s   = r.summary
  const bad = isFailedStatus(runEffectiveStatus(r))
  const total   = s?.total ?? 0
  const passed  = s?.passed ?? 0
  const failed  = s?.failed ?? 0
  const flaky   = s?.flaky ?? 0
  const skipped = s?.skipped ?? Math.max(0, total - passed - failed - flaky)
  const d = r.executionTimeMs ?? r.durationMs ?? 0
  return {
    passed: b.passed + passed, failed: b.failed + failed, flaky: b.flaky + flaky,
    skipped: b.skipped + skipped, total: b.total + total,
    runs: b.runs + 1,
    redRuns:   b.redRuns   + (bad ? 1 : 0),
    cleanRuns: b.cleanRuns + (!bad && flaky === 0 ? 1 : 0),
    durMs: b.durMs + d, durCount: b.durCount + (d > 0 ? 1 : 0),
  }
}

function bucketOf(runs: E2eRunEntry[]): Bucket {
  return runs.reduce(addRun, emptyBucket())
}

function avgOf(b: Bucket): number | null {
  return b.durCount > 0 ? Math.round(b.durMs / b.durCount) : null
}

function byTime(runs: E2eRunEntry[]): E2eRunEntry[] {
  return [...runs]
    .filter(r => Number.isFinite(timeOf(r.generatedAt)))
    .sort((a, b) => timeOf(a.generatedAt) - timeOf(b.generatedAt))
}

function latestOf(runs: E2eRunEntry[]): E2eRunEntry | null {
  const s = byTime(runs)
  return s.length > 0 ? s[s.length - 1] : null
}

// Trailing consecutive failed runs — the "is it broken right now" signal.
function failureStreak(runs: E2eRunEntry[]): number {
  const s = byTime(runs)
  let n = 0
  for (let i = s.length - 1; i >= 0; i--) {
    if (!isFailedStatus(runEffectiveStatus(s[i]))) break
    n++
  }
  return n
}

function groupRuns<K extends string>(runs: E2eRunEntry[], key: (r: E2eRunEntry) => K): Map<K, E2eRunEntry[]> {
  const m = new Map<K, E2eRunEntry[]>()
  for (const r of runs) {
    const k = key(r)
    if (!m.has(k)) m.set(k, [])
    m.get(k)!.push(r)
  }
  return m
}

function suiteKey(r: E2eRunEntry): string {
  return r.suiteName ?? r.suite ?? r.jobName ?? 'Unknown'
}

const BROWSER_ORDER = ['chromium', 'edge', 'firefox', 'webkit']
function browserRank(name: string): number {
  const i = BROWSER_ORDER.indexOf(name.toLowerCase())
  return i === -1 ? BROWSER_ORDER.length : i
}

// ── Primitives ────────────────────────────────────────────────────────────────

function Panel({ title, right, children, flex, minHeight, pad }: {
  title: string; right?: ReactNode; children: ReactNode; flex?: number; minHeight?: number; pad?: string
}) {
  return (
    <section style={{
      background: S.surface, border: `1px solid ${S.border}`, borderRadius: '10px',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      flex, minHeight: minHeight ? `${minHeight}px` : undefined,
    }}>
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
        padding: '10px 14px', borderBottom: `1px solid ${S.divider}`, flexShrink: 0,
      }}>
        <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: S.fgMuted }}>
          {title}
        </span>
        {right}
      </header>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: pad ?? '0' }}>
        {children}
      </div>
    </section>
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

function fmtSpan(msVal: number): string {
  const d = msVal / 86_400_000
  if (d >= 1.5) return `${Math.round(d)}d`
  const h = msVal / 3_600_000
  return h >= 1 ? `${Math.round(h)}h` : '<1h'
}

// Ranges wider than the report's retained history select the same runs as ALL,
// so they're dimmed to explain why clicking them appears to do nothing.
function RangeToggle({ range, onChange, counts, spanMs }: {
  range: Range; onChange: (r: Range) => void
  counts: Record<Range, number>; spanMs: number
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', flexShrink: 0 }}>
      <div style={{ display: 'flex', border: `1px solid ${S.border}`, borderRadius: '7px', overflow: 'hidden' }}>
        {RANGES.map((label, i) => {
          const active    = label === range
          const redundant = label !== 'ALL' && RANGE_WINDOW_MS[label as Exclude<Range, 'ALL'>] > spanMs
          return (
            <button
              key={label}
              onClick={() => onChange(label)}
              title={redundant
                ? `${counts[label]} runs — report only retains ${fmtSpan(spanMs)} of history, so this matches ALL`
                : `${counts[label]} runs`}
              style={{
                padding: '5px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                border: 'none', borderLeft: i > 0 ? `1px solid ${S.border}` : 'none',
                background: active ? 'color-mix(in srgb, var(--color-accent) 14%, transparent)' : 'transparent',
                color:      active ? 'var(--color-accent)' : S.fgMuted,
                opacity:    !active && redundant ? 0.4 : 1,
              }}
            >{label}</button>
          )
        })}
      </div>
      <span style={{ fontSize: '9.5px', color: S.fgSubtle, whiteSpace: 'nowrap' }}>
        {fmtSpan(spanMs)} of history
      </span>
    </div>
  )
}

function OutcomeBar({ b, height = 7 }: { b: Bucket; height?: number }) {
  if (b.total <= 0) return <div style={{ height: `${height}px`, background: S.border, borderRadius: `${height / 2}px` }} />
  const seg = (n: number, color: string, label: string) =>
    n > 0 ? <div key={label} title={`${label}: ${n.toLocaleString()} (${pct1(n, b.total)}%)`} style={{ width: `${(n / b.total) * 100}%`, background: color }} /> : null
  return (
    <div style={{ display: 'flex', height: `${height}px`, borderRadius: `${height / 2}px`, overflow: 'hidden', background: S.border }}>
      {seg(b.passed, C.pass, 'Passed')}
      {seg(b.flaky, C.flaky, 'Flaky')}
      {seg(b.failed, C.fail, 'Failed')}
      {seg(b.skipped, C.skip, 'Skipped')}
    </div>
  )
}

// ── Suite cards ───────────────────────────────────────────────────────────────
//
// Browser breakdown lives inside the suite card because coverage is sparse in
// practice (smoke runs on 4 browsers, the heavier suites on Chromium only) —
// a suite × browser matrix would be mostly empty cells.

function SuiteCard({ name, runs, onOpen }: {
  name: string; runs: E2eRunEntry[]; onOpen: (r: E2eRunEntry) => void
}) {
  const b       = bucketOf(runs)
  const latest  = latestOf(runs)
  const eff     = latest ? runEffectiveStatus(latest) : 'unknown'
  const color   = runStatusColor(eff)
  const rate    = pct(b.passed, b.total)
  const avg     = avgOf(b)
  const streak  = failureStreak(runs)

  const perBrowser = [...groupRuns(runs, r => browserName(r.matrixLabel)).entries()]
    .filter(([k]) => k !== 'Unknown')
    .map(([k, rs]) => ({ name: k, bucket: bucketOf(rs) }))
    .sort((x, y) => browserRank(x.name) - browserRank(y.name))

  return (
    <div
      onClick={latest ? () => onOpen(latest) : undefined}
      style={{
        cursor: latest ? 'pointer' : 'default', background: S.surface,
        border: `1px solid ${S.border}`, borderTop: `3px solid ${color}`,
        borderRadius: '10px', padding: '12px 14px',
        display: 'flex', flexDirection: 'column', gap: '9px', minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <span style={{ fontSize: '14px', fontWeight: 700, color: S.fg, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {name}
        </span>
        <span style={{
          fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', flexShrink: 0, whiteSpace: 'nowrap',
          background: `color-mix(in srgb, ${color} 18%, transparent)`, color,
        }}>
          {streak >= 2 ? `RED ×${streak}` : (STATUS_LABEL[eff] ?? eff).toUpperCase()}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
        <span style={{ fontSize: '30px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: rateColor(rate), lineHeight: 0.95 }}>
          {rate}%
        </span>
        <div style={{ display: 'flex', gap: '14px', paddingBottom: '2px' }}>
          <Metric n={b.failed} label="failed" color={b.failed > 0 ? C.fail : S.fgMuted} />
          <Metric n={b.flaky}  label="flaky"  color={b.flaky  > 0 ? C.flaky : S.fgMuted} />
          <Metric n={b.redRuns} label="red runs" color={b.redRuns > 0 ? C.fail : S.fgMuted} />
        </div>
      </div>

      <OutcomeBar b={b} height={7} />

      <div style={{ fontSize: '11.5px', color: S.fgSubtle }}>
        {b.runs} runs · {avg !== null ? `${fmtDur(avg)} avg` : 'no timing'}
        {latest ? ` · last ${fmtWhen(latest.generatedAt)}` : ''}
      </div>

      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
        {perBrowser.map(pb => {
          const r = pct(pb.bucket.passed, pb.bucket.total)
          return (
            <span key={pb.name} title={`${pb.name}: ${pb.bucket.runs} runs · ${pb.bucket.failed} failed · ${pb.bucket.flaky} flaky`} style={{
              fontSize: '10.5px', padding: '2px 7px', borderRadius: '4px', whiteSpace: 'nowrap',
              background: `color-mix(in srgb, ${S.border} 60%, transparent)`, color: S.fgSec,
            }}>
              {pb.name} <b style={{ color: rateColor(r), fontVariantNumeric: 'tabular-nums' }}>{r}%</b>
            </span>
          )
        })}
      </div>
    </div>
  )
}

function Metric({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <div>
      <div style={{ fontSize: '15px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color, lineHeight: 1.1 }}>{n}</div>
      <div style={{ fontSize: '9.5px', textTransform: 'uppercase', letterSpacing: '0.05em', color: S.fgMuted }}>{label}</div>
    </div>
  )
}

// ── Needs attention ───────────────────────────────────────────────────────────
//
// A ranked list rather than a suite × browser matrix: coverage is sparse, so a
// matrix would be mostly empty. Only combinations with real problems appear.

function NeedsAttention({ runs, bottomPad, onOpen }: { runs: E2eRunEntry[]; bottomPad: number; onOpen: (r: E2eRunEntry) => void }) {
  const rows = [...groupRuns(runs, r => `${suiteKey(r)}\u0000${browserName(r.matrixLabel)}`).entries()]
    .map(([key, rs]) => {
      const [suite, browser] = key.split('\u0000')
      return { suite, browser, bucket: bucketOf(rs), latest: latestOf(rs), streak: failureStreak(rs) }
    })
    .filter(r => r.bucket.failed > 0 || r.bucket.flaky > 0 || r.bucket.redRuns > 0)
    .sort((a, b) =>
      (b.streak - a.streak) ||
      (b.bucket.failed - a.bucket.failed) ||
      (b.bucket.flaky - a.bucket.flaky))
    .slice(0, 8)

  if (rows.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center' }}>
        <span style={{ fontSize: '12px', color: C.pass }}>✓ Nothing needs attention</span>
      </div>
    )
  }

  const worst = Math.max(...rows.map(r => r.bucket.failed + r.bucket.flaky), 1)

  return (
    <div style={{
      flex: 1, minHeight: 0, overflowY: 'auto',
      // Trailing scroll space so the last rows can clear the floating JSON/Docs buttons.
      padding: `10px 14px ${12 + bottomPad}px`,
      display: 'flex', flexDirection: 'column', gap: '10px',
    }}>
      {rows.map(r => {
        return (
          <div
            key={`${r.suite}-${r.browser}`}
            onClick={r.latest ? () => onOpen(r.latest!) : undefined}
            style={{ cursor: r.latest ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', gap: '4px' }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: S.fg, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>
                {r.suite}
                <span style={{ color: S.fgSubtle, fontWeight: 400 }}> · {r.browser}</span>
              </span>
              {r.streak >= 2 && (
                <span style={{ fontSize: '9.5px', fontWeight: 700, color: C.fail, background: 'color-mix(in srgb, #ef4444 16%, transparent)', padding: '1px 5px', borderRadius: '3px' }}>
                  ×{r.streak}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ flex: 1, height: '5px', background: S.border, borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${(r.bucket.failed / worst) * 100}%`, background: C.fail }} />
                <div style={{ width: `${(r.bucket.flaky / worst) * 100}%`, background: C.flaky }} />
              </div>
              <span style={{ fontSize: '10.5px', fontVariantNumeric: 'tabular-nums', color: S.fgSubtle, whiteSpace: 'nowrap' }}>
                {r.bucket.failed > 0 && <b style={{ color: C.fail }}>{r.bucket.failed} failed</b>}
                {r.bucket.failed > 0 && r.bucket.flaky > 0 && ' · '}
                {r.bucket.flaky > 0 && <b style={{ color: C.flaky }}>{r.bucket.flaky} flaky</b>}
              </span>
            </div>
            <div style={{ fontSize: '10px', color: S.fgSubtle, fontVariantNumeric: 'tabular-nums' }}>
              {r.bucket.runs} runs · {r.bucket.redRuns} red · {pct(r.bucket.passed, r.bucket.total)}% pass
            </div>
          </div>
        )
      })}
    </div>
  )
}

function OutcomeMix({ b }: { b: Bucket }) {
  const rows = [
    { label: 'Passed',  n: b.passed,  color: C.pass },
    { label: 'Flaky',   n: b.flaky,   color: C.flaky },
    { label: 'Failed',  n: b.failed,  color: C.fail },
    { label: 'Skipped', n: b.skipped, color: C.skip },
  ]
  const skipRate = pct(b.skipped, b.total)
  return (
    <div style={{ padding: '10px 14px 12px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
      <OutcomeBar b={b} height={9} />
      {rows.map(r => (
        <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: r.color, flexShrink: 0 }} />
          <span style={{ fontSize: '12px', color: S.fgSec, flex: 1 }}>{r.label}</span>
          <span style={{ fontSize: '12px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: S.fg }}>{r.n.toLocaleString()}</span>
          <span style={{ fontSize: '11px', fontVariantNumeric: 'tabular-nums', color: S.fgSubtle, width: '44px', textAlign: 'right' }}>
            {pct1(r.n, b.total)}%
          </span>
        </div>
      ))}
      {skipRate >= 5 && (
        <div style={{ fontSize: '11px', color: C.flaky, lineHeight: 1.45, marginTop: '2px' }}>
          {skipRate}% skipped — real coverage is lower than the pass rate implies.
        </div>
      )}
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
  const [wide, setWide]   = useState(() => window.innerWidth >= 1100)

  useEffect(() => {
    const update = () => setWide(window.innerWidth >= 1100)
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const allRuns = report.reviews ?? report.runs ?? []
  const runs    = useMemo(() => filterByRange(allRuns, range), [allRuns, range])

  const suiteRuns = groupRuns(runs, suiteKey)
  const suites    = [...suiteRuns.keys()].sort((a, b) => suiteRuns.get(b)!.length - suiteRuns.get(a)!.length)

  const overall = bucketOf(runs)
  const passRate  = pct(overall.passed, overall.total)
  const updatedAt = report.updatedAt ?? report.generatedAt
  const empty     = allRuns.length === 0 || runs.length === 0

  const allTimes = allRuns.map(r => timeOf(r.generatedAt)).filter(Number.isFinite)
  const spanMs   = allTimes.length > 0 ? Math.max(...allTimes) - Math.min(...allTimes) : 0
  const counts   = Object.fromEntries(
    RANGES.map(r => [r, filterByRange(allRuns, r).length]),
  ) as Record<Range, number>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
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
                <SummaryStat label="Runs"      value={String(overall.runs)}    sub={overall.redRuns > 0 ? `${overall.redRuns} red` : 'all green'} subColor={overall.redRuns > 0 ? C.fail : C.pass} />
                <SummaryStat label="Pass rate" value={`${passRate}%`}          sub={`${range} range`} />
                <SummaryStat label="Failed"    value={String(overall.failed)}  sub="tests" subColor={overall.failed > 0 ? C.fail : undefined} />
                <SummaryStat label="Flaky"     value={String(overall.flaky)}   sub="tests" subColor={overall.flaky > 0 ? C.flaky : undefined} />
                {wide && <SummaryStat label="Skipped" value={String(overall.skipped)} sub="tests" />}
              </div>
            )}
            <RangeToggle range={range} onChange={setRange} counts={counts} spanMs={spanMs} />
            {report.schemaVersion && <div style={{ fontSize: '11px', color: S.fgSubtle }}>v{report.schemaVersion}</div>}
          </div>
        }
      />

      {empty ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-background)', color: S.fgMuted, fontSize: '13px' }}>
          {allRuns.length === 0 ? 'No runs in this report.' : 'No runs in the selected range.'}
        </div>
      ) : (
        <div style={{
          flex: 1, minHeight: 0, background: 'var(--color-background)', padding: '14px 16px',
          display: 'flex', flexDirection: 'column', gap: '12px',
          overflowY: wide ? 'hidden' : 'auto',
        }}>
          {/* Suite cards */}
          <div style={{
            display: 'grid', gridTemplateColumns: `repeat(${wide ? Math.min(3, suites.length) : 1}, minmax(0, 1fr))`,
            gap: '12px', flexShrink: 0,
          }}>
            {suites.slice(0, wide ? 3 : suites.length).map(s => (
              <SuiteCard key={s} name={s} runs={suiteRuns.get(s)!} onOpen={onSelectRun} />
            ))}
          </div>

          {/* Flaky tests + rail */}
          <div style={{
            flex: wide ? 1 : undefined, flexShrink: wide ? 1 : 0, minHeight: 0,
            display: 'grid', gridTemplateColumns: wide ? 'minmax(0, 1fr) 320px' : '1fr', gap: '12px',
          }}>
            <Panel
              title="Top flakiest tests"
              flex={wide ? 1 : undefined}
              minHeight={wide ? 260 : 300}
            >
              <FlakyTests key={`${range}:${updatedAt ?? ''}`} runs={runs} onSelectRun={onSelectRun} />
            </Panel>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0 }}>
              <Panel title="Test outcome mix" right={<span style={{ fontSize: '11px', color: S.fgSubtle }}>{overall.total.toLocaleString()} tests</span>}>
                <OutcomeMix b={overall} />
              </Panel>
              <Panel title="Needs attention" flex={wide ? 1 : undefined} minHeight={160}>
                <NeedsAttention runs={runs} bottomPad={wide ? 88 : 0} onOpen={onSelectRun} />
              </Panel>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
