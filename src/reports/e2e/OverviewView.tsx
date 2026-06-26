import type { E2eAggregateReport, E2eRunEntry, E2eRunStatus } from './types'
import PanelTopBar from '../../components/PanelTopBar'

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
  return '#94a3b8'
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

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function pct(n: number, total: number) {
  return total > 0 ? Math.round((n / total) * 100) : 0
}

function browserName(label: string | undefined): string {
  if (!label) return 'Unknown'
  return label.includes('·') ? label.split('·')[0].trim() : label.trim()
}

// ── Data derivation ───────────────────────────────────────────────────────────

interface BucketData {
  passed: number; failed: number; flaky: number; skipped: number; total: number
  runs: number; failedRuns: number
}

function emptyBucket(): BucketData {
  return { passed: 0, failed: 0, flaky: 0, skipped: 0, total: 0, runs: 0, failedRuns: 0 }
}

function addRun(b: BucketData, r: E2eRunEntry): BucketData {
  const s = r.summary
  const eff = runEffectiveStatus(r)
  const isBad = eff === 'failed' || eff === 'succeeded_with_issues' || eff === 'timedout'
  const skipped = Math.max(0, (s?.total ?? 0) - (s?.passed ?? 0) - (s?.failed ?? 0) - (s?.flaky ?? 0))
  return {
    passed:     b.passed     + (s?.passed ?? 0),
    failed:     b.failed     + (s?.failed ?? 0),
    flaky:      b.flaky      + (s?.flaky  ?? 0),
    skipped:    b.skipped    + skipped,
    total:      b.total      + (s?.total  ?? 0),
    runs:       b.runs       + 1,
    failedRuns: b.failedRuns + (isBad ? 1 : 0),
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

// ── Design tokens ─────────────────────────────────────────────────────────────

const S = {
  surface:  'var(--color-surface)',
  border:   'var(--color-border)',
  fg:       'var(--color-foreground)',
  fgSec:    'var(--color-foreground-secondary)',
  fgMuted:  'var(--color-foreground-muted)',
  fgSubtle: 'var(--color-foreground-subtle)',
  sunken:   'var(--color-surface-sunken)',
}

const C = {
  pass:   '#22c55e',
  fail:   '#ef4444',
  flaky:  '#f59e0b',
  skip:   '#94a3b8',
  passBg: '#22c55e18',
  failBg: '#ef444418',
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: '10px', padding: '14px 18px', minWidth: 0 }}>
      <div style={{ fontSize: '10px', color: S.fgMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '5px' }}>{label}</div>
      <div style={{ fontSize: '24px', fontWeight: 700, color: accent ?? S.fg, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: S.fgSubtle, marginTop: '4px' }}>{sub}</div>}
    </div>
  )
}

function StackedBar({ passed, failed, flaky, skipped, total, height = 8 }: { passed: number; failed: number; flaky: number; skipped: number; total: number; height?: number }) {
  if (total === 0) return <div style={{ height, background: S.sunken, borderRadius: '4px' }} />
  return (
    <div style={{ display: 'flex', height, borderRadius: '4px', overflow: 'hidden', background: S.sunken }}>
      {passed  > 0 && <div style={{ flex: passed,  background: C.pass  }} title={`Passed: ${passed}`} />}
      {failed  > 0 && <div style={{ flex: failed,  background: C.fail  }} title={`Failed: ${failed}`} />}
      {flaky   > 0 && <div style={{ flex: flaky,   background: C.flaky }} title={`Flaky: ${flaky}`} />}
      {skipped > 0 && <div style={{ flex: skipped, background: C.skip  }} title={`Skipped: ${skipped}`} />}
    </div>
  )
}

// ── Section: KPI row ─────────────────────────────────────────────────────────

function KpiRow({ report, runs }: { report: E2eAggregateReport; runs: E2eRunEntry[] }) {
  const s = report.summary
  const totalRuns     = s?.totalRuns    ?? runs.length
  const failedRuns    = s?.failedRuns   ?? runs.filter(r => runEffectiveStatus(r) === 'failed' || runEffectiveStatus(r) === 'succeeded_with_issues').length
  const totalTests    = s?.totalTests   ?? runs.reduce((n, r) => n + (r.summary?.total ?? 0), 0)
  const failedTests   = s?.failedTests  ?? runs.reduce((n, r) => n + (r.summary?.failed ?? 0), 0)
  const flakyTests    = s?.flakyTests   ?? runs.reduce((n, r) => n + (r.summary?.flaky ?? 0), 0)
  const passedTests   = s?.passedTests  ?? runs.reduce((n, r) => n + (r.summary?.passed ?? 0), 0)
  const totalMs       = s?.totalDurationMs ?? runs.reduce((n, r) => n + (r.executionTimeMs ?? r.durationMs ?? 0), 0)
  const passRate      = pct(passedTests, totalTests)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px', marginBottom: '16px' }}>
      <KpiCard label="Runs"         value={String(totalRuns)} sub={failedRuns > 0 ? `${failedRuns} failed` : 'all healthy'} accent={failedRuns > 0 ? C.fail : C.pass} />
      <KpiCard label="Pass Rate"    value={`${passRate}%`}    accent={passRate >= 90 ? C.pass : passRate >= 70 ? C.flaky : C.fail} />
      <KpiCard label="Tests"        value={String(totalTests)} sub={failedTests > 0 ? `${failedTests} failed` : undefined} />
      <KpiCard label="Flaky"        value={String(flakyTests)} accent={flakyTests > 0 ? C.flaky : undefined} />
      {/* Duration intentionally omitted — averaging smoke + core runs produces a meaningless number */}
    </div>
  )
}

// ── Section: Health breakdown row ─────────────────────────────────────────────

function HealthRow({ label, data, showBrowser = false }: {
  label: string
  data: { key: string; bucket: BucketData }[]
  showBrowser?: boolean
}) {
  if (data.length === 0) return null
  return (
    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: '10px', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px 8px', fontSize: '11px', fontWeight: 600, color: S.fgMuted, textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: `1px solid ${S.border}` }}>
        {label}
      </div>
      <div style={{ padding: '8px 14px 10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {data.map(({ key, bucket: b }) => {
          const rate = pct(b.passed, b.total)
          const rateColor = rate >= 90 ? C.pass : rate >= 70 ? C.flaky : C.fail
          return (
            <div key={key}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {showBrowser && (
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: rateColor, flexShrink: 0 }} />
                  )}
                  <span style={{ fontSize: '12px', fontWeight: 600, color: S.fg }}>{key}</span>
                  <span style={{ fontSize: '10.5px', color: S.fgSubtle }}>{b.runs} run{b.runs !== 1 ? 's' : ''}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {b.failed > 0  && <span style={{ fontSize: '10.5px', color: C.fail,  fontWeight: 600 }}>{b.failed} failed</span>}
                  {b.flaky  > 0  && <span style={{ fontSize: '10.5px', color: C.flaky, fontWeight: 600 }}>{b.flaky} flaky</span>}
                  <span style={{ fontSize: '12px', fontWeight: 700, color: rateColor, fontVariantNumeric: 'tabular-nums', minWidth: '36px', textAlign: 'right' }}>{rate}%</span>
                </div>
              </div>
              <StackedBar {...b} height={6} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Section: Daily trend ──────────────────────────────────────────────────────

function DailyTrend({ dateMap }: { dateMap: Map<string, BucketData> }) {
  const dates = [...dateMap.entries()].sort(([a], [b]) => a < b ? -1 : 1)
  if (dates.length < 1) return null

  const maxRuns = Math.max(...dates.map(([, b]) => b.runs))

  return (
    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: '10px', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px 8px', fontSize: '11px', fontWeight: 600, color: S.fgMuted, textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: `1px solid ${S.border}` }}>
        Daily Trend
      </div>
      <div style={{ padding: '12px 14px', display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        {dates.map(([date, b]) => {
          const rate = pct(b.passed, b.total)
          const barH = maxRuns > 0 ? Math.max(24, Math.round((b.runs / maxRuns) * 72)) : 40
          const rateColor = rate >= 90 ? C.pass : rate >= 70 ? C.flaky : C.fail
          return (
            <div key={date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', minWidth: '64px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: rateColor }}>{rate}%</span>
              <div style={{ width: '100%', height: barH, borderRadius: '5px', overflow: 'hidden', display: 'flex', flexDirection: 'column-reverse' }}>
                <div style={{ flex: b.passed, background: C.pass, minHeight: b.passed > 0 ? 2 : 0 }} />
                <div style={{ flex: b.failed, background: C.fail, minHeight: b.failed > 0 ? 2 : 0 }} />
                <div style={{ flex: b.flaky,  background: C.flaky, minHeight: b.flaky > 0 ? 2 : 0 }} />
                <div style={{ flex: Math.max(0, b.total - b.passed - b.failed - b.flaky), background: C.skip, minHeight: 0 }} />
              </div>
              <span style={{ fontSize: '10px', color: S.fgMuted }}>{fmtDate(date)}</span>
              <span style={{ fontSize: '10px', color: S.fgSubtle }}>{b.runs} runs</span>
            </div>
          )
        })}

        {/* Legend */}
        <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'center', paddingBottom: '26px' }}>
          {([['Passed', C.pass], ['Failed', C.fail], ['Flaky', C.flaky], ['Skipped', C.skip]] as const).map(([l, c]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: c }} />
              <span style={{ fontSize: '10px', color: S.fgSubtle }}>{l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Section: Run tiles ────────────────────────────────────────────────────────

function RunTile({ run, onClick }: { run: E2eRunEntry; onClick: () => void }) {
  const eff      = runEffectiveStatus(run)
  const isPass   = eff === 'passed' || eff === 'succeeded'
  const isFail   = eff === 'failed' || eff === 'succeeded_with_issues' || eff === 'timedout'
  const dotColor = isPass ? C.pass : isFail ? C.fail : C.flaky
  const s        = run.summary
  const browser  = browserName(run.matrixLabel)
  const suite    = (run.suiteName ?? run.suite ?? 'Run').replace('E2E ', '')
  const skipped  = Math.max(0, (s?.total ?? 0) - (s?.passed ?? 0) - (s?.failed ?? 0) - (s?.flaky ?? 0))

  return (
    <button
      onClick={onClick}
      style={{
        width: '130px', padding: '9px 10px', borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
        border: `1.5px solid ${dotColor}25`, background: `${dotColor}08`,
        transition: 'border-color 0.1s, background 0.1s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = `${dotColor}60`
        e.currentTarget.style.background  = `${dotColor}14`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = `${dotColor}25`
        e.currentTarget.style.background  = `${dotColor}08`
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
        <span style={{ fontSize: '11.5px', fontWeight: 700, color: S.fg, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{suite}</span>
      </div>
      {browser && browser !== 'Unknown' && (
        <div style={{ fontSize: '10px', color: S.fgMuted, fontFamily: 'ui-monospace,monospace', marginBottom: '6px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {browser}
        </div>
      )}
      {s && s.total > 0 && (
        <>
          <StackedBar passed={s.passed} failed={s.failed} flaky={s.flaky} skipped={skipped} total={s.total} height={5} />
          <div style={{ marginTop: '4px', fontSize: '10px', color: S.fgMuted, fontVariantNumeric: 'tabular-nums' }}>
            <span style={{ color: isPass ? C.pass : C.fail, fontWeight: 600 }}>{s.passed}</span>
            <span style={{ color: S.fgSubtle }}>/{s.total}</span>
            {s.failed > 0 && <span style={{ color: C.fail, marginLeft: '4px' }}> · {s.failed}✗</span>}
            {s.flaky  > 0 && <span style={{ color: C.flaky, marginLeft: '4px' }}> · {s.flaky}~</span>}
          </div>
        </>
      )}
    </button>
  )
}

function RunGrid({ runs, onSelect, runKeys }: { runs: E2eRunEntry[]; onSelect: (key: string) => void; runKeys: (r: E2eRunEntry, i: number) => string }) {
  // Preserve original indices for stable keys, then sort by generatedAt
  const indexed = runs.map((r, i) => ({ run: r, key: runKeys(r, i) }))
  const sorted  = [...indexed].sort((a, b) => (a.run.generatedAt ?? '') < (b.run.generatedAt ?? '') ? -1 : 1)
  const byDate  = new Map<string, { run: E2eRunEntry; key: string }[]>()
  sorted.forEach(({ run: r, key }) => {
    const date = (r.generatedAt ?? '').slice(0, 10) || 'unknown'
    const arr  = byDate.get(date) ?? []
    arr.push({ run: r, key })
    byDate.set(date, arr)
  })

  const dates = [...byDate.entries()].sort(([a], [b]) => a < b ? -1 : 1)

  return (
    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: '10px', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px 8px', fontSize: '11px', fontWeight: 600, color: S.fgMuted, textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: `1px solid ${S.border}` }}>
        Runs — click to open
      </div>
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {dates.map(([date, entries]) => (
          <div key={date}>
            <div style={{ fontSize: '10.5px', fontWeight: 600, color: S.fgSubtle, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
              {date !== 'unknown' ? fmtDate(date) : 'Unknown date'} · {entries.length} run{entries.length !== 1 ? 's' : ''}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {entries.map(({ run, key }) => (
                <RunTile key={key} run={run} onClick={() => onSelect(key)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface Props {
  report:   E2eAggregateReport
  onSelect: (key: string) => void
  runKeys:  (r: E2eRunEntry, i: number) => string
}

export default function OverviewView({ report, onSelect, runKeys }: Props) {
  const runs = report.reviews ?? report.runs ?? []

  const suiteMap   = groupBy(runs, r => r.suiteName ?? r.suite ?? 'Unknown')
  const browserMap = groupBy(runs, r => browserName(r.matrixLabel))
  const dateMap    = groupBy(runs, r => (r.generatedAt ?? '').slice(0, 10) || 'unknown')

  const suiteData   = [...suiteMap.entries()]
    .map(([k, b]) => ({ key: k, bucket: b }))
    .sort((a, b) => b.bucket.total - a.bucket.total)

  const browserData = [...browserMap.entries()]
    .filter(([k]) => k !== 'Unknown')
    .map(([k, b]) => ({ key: k, bucket: b }))
    .sort((a, b) => b.bucket.total - a.bucket.total)

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
          report.schemaVersion
            ? <div style={{ fontSize: '11px', color: S.fgSubtle }}>v{report.schemaVersion}</div>
            : undefined
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--color-background)', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {runs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: S.fgMuted }}>No runs in this report.</div>
        ) : (
          <>
            <KpiRow report={report} runs={runs} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <HealthRow label="Suite Health"   data={suiteData} />
              <HealthRow label="Browser Matrix" data={browserData} showBrowser />
            </div>

            <DailyTrend dateMap={dateMap} />

            <RunGrid runs={runs} onSelect={onSelect} runKeys={runKeys} />
          </>
        )}
      </div>
    </div>
  )
}
