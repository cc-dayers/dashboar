import type { E2eAggregateReport, E2eRunEntry, E2eRunStatus } from './types'
import PanelTopBar from '../../components/PanelTopBar'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtMs(ms: number) {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function runLabel(r: E2eRunEntry): string {
  return r.suiteName ?? r.suite ?? r.jobName ?? 'Run'
}

export function runStatusColor(status: E2eRunStatus | string): string {
  if (status === 'passed')      return '#22c55e'
  if (status === 'failed')      return '#ef4444'
  if (status === 'flaky')       return '#f59e0b'
  if (status === 'timedout')    return '#f97316'
  if (status === 'interrupted') return '#8b5cf6'
  return '#94a3b8'
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

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: '10px', padding: '16px 18px' }}>
      <div style={{ fontSize: '11px', color: S.fgMuted, fontWeight: 500, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: '26px', fontWeight: 700, color: accent ?? S.fg, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: '12px', color: S.fgSubtle, marginTop: '5px' }}>{sub}</div>}
    </div>
  )
}

function StatusBar({ runs }: { runs: E2eRunEntry[] }) {
  const passed   = runs.filter(r => r.status === 'passed').length
  const failed   = runs.filter(r => r.status === 'failed').length
  const flaky    = runs.filter(r => r.status === 'flaky').length
  const other    = runs.length - passed - failed - flaky
  const total    = runs.length
  if (total === 0) return null
  const pct = (n: number) => `${((n / total) * 100).toFixed(0)}%`

  return (
    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: '10px', padding: '16px 18px' }}>
      <div style={{ fontSize: '11px', color: S.fgMuted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>Run Results</div>
      <div style={{ display: 'flex', gap: '3px', borderRadius: '6px', overflow: 'hidden', height: '8px', marginBottom: '12px' }}>
        {passed > 0 && <div style={{ flex: passed, background: '#22c55e' }} title={`Passed: ${passed}`} />}
        {failed > 0 && <div style={{ flex: failed, background: '#ef4444' }} title={`Failed: ${failed}`} />}
        {flaky  > 0 && <div style={{ flex: flaky,  background: '#f59e0b' }} title={`Flaky: ${flaky}`} />}
        {other  > 0 && <div style={{ flex: other,  background: '#94a3b8' }} title={`Other: ${other}`} />}
      </div>
      <div style={{ display: 'flex', gap: '16px', fontSize: '12px', flexWrap: 'wrap' }}>
        <span style={{ color: '#22c55e' }}><strong>{passed}</strong> passed {passed > 0 && <span style={{ color: S.fgSubtle }}>({pct(passed)})</span>}</span>
        <span style={{ color: '#ef4444' }}><strong>{failed}</strong> failed {failed > 0 && <span style={{ color: S.fgSubtle }}>({pct(failed)})</span>}</span>
        {flaky > 0 && <span style={{ color: '#f59e0b' }}><strong>{flaky}</strong> flaky <span style={{ color: S.fgSubtle }}>({pct(flaky)})</span></span>}
        {other > 0 && <span style={{ color: '#94a3b8' }}><strong>{other}</strong> other</span>}
      </div>
    </div>
  )
}

function RunRow({ run, onSelect }: { run: E2eRunEntry; onSelect: () => void }) {
  const label      = runLabel(run)
  const failCount  = run.summary?.failed  ?? 0
  const flakyCount = run.summary?.flaky   ?? 0
  const total      = run.summary?.total   ?? run.testCount ?? 0
  const passed     = run.summary?.passed  ?? 0

  return (
    <button
      onClick={onSelect}
      style={{
        display: 'block', width: '100%', textAlign: 'left', border: 'none',
        background: 'transparent', cursor: 'pointer', padding: '10px 16px',
        borderTop: `1px solid ${S.border}`,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = S.sunken }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <div style={{
          width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
          background: runStatusColor(run.status), marginTop: '5px',
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: S.fg, marginBottom: '3px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            {label}
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {run.matrixLabel && (
              <span style={{ fontSize: '11px', color: S.fgMuted, fontFamily: 'ui-monospace,monospace' }}>{run.matrixLabel}</span>
            )}
            {run.branch && (
              <span style={{ fontSize: '11px', color: S.fgSubtle, fontFamily: 'ui-monospace,monospace' }}>{run.branch}</span>
            )}
            {run.generatedAt && (
              <span style={{ fontSize: '11px', color: S.fgSubtle }}>{fmtDate(run.generatedAt)}</span>
            )}
            {run.executionTimeMs != null && (
              <span style={{ fontSize: '11px', color: S.fgSubtle }}>{fmtMs(run.executionTimeMs)}</span>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {total > 0 && (
            <div style={{ fontSize: '12px', color: S.fgMuted, marginBottom: '2px', fontVariantNumeric: 'tabular-nums' }}>
              {passed}/{total}
            </div>
          )}
          {failCount > 0 && (
            <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600 }}>{failCount} failed</div>
          )}
          {flakyCount > 0 && (
            <div style={{ fontSize: '11px', color: '#f59e0b' }}>{flakyCount} flaky</div>
          )}
        </div>
      </div>
    </button>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface Props {
  report:   E2eAggregateReport
  onSelect: (key: string) => void
  runKeys:  (r: E2eRunEntry, i: number) => string
}

export default function OverviewView({ report, onSelect, runKeys }: Props) {
  const runs    = report.runs ?? []
  const total   = runs.length

  // Aggregate test counts across all run entries
  const totalTests  = runs.reduce((s, r) => s + (r.summary?.total   ?? r.testCount ?? 0), 0)
  const failedTests = runs.reduce((s, r) => s + (r.summary?.failed  ?? 0), 0)
  const flakyTests  = runs.reduce((s, r) => s + (r.summary?.flaky   ?? 0), 0)
  const totalMs     = runs.reduce((s, r) => s + (r.executionTimeMs  ?? 0), 0)

  const failedRuns  = runs.filter(r => r.status === 'failed' || r.status === 'timedout')
  const otherRuns   = runs.filter(r => r.status !== 'failed' && r.status !== 'timedout')
  const sortedRuns  = [...failedRuns, ...otherRuns]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PanelTopBar
        left={
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: S.fg }}>Overview</div>
            {report.generatedAt && (
              <div style={{ fontSize: '11px', color: S.fgMuted, marginTop: '2px' }}>
                Generated {fmtDate(report.generatedAt)}
              </div>
            )}
          </div>
        }
        right={
          report.schemaVersion ? (
            <div style={{ fontSize: '11px', color: S.fgSubtle }}>
              v{report.schemaVersion}
            </div>
          ) : undefined
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--color-background)', padding: '20px 24px' }}>
        {total === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: S.fgMuted }}>
            No runs in this report.
          </div>
        ) : (
          <>
            {/* KPI row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '14px' }}>
              <KpiCard label="Runs" value={String(total)} />
              <KpiCard
                label="Failed Runs"
                value={String(failedRuns.length)}
                accent={failedRuns.length > 0 ? '#ef4444' : undefined}
              />
              {totalTests > 0 && (
                <KpiCard
                  label="Tests"
                  value={String(totalTests)}
                  sub={failedTests > 0 ? `${failedTests} failed` : undefined}
                />
              )}
              {flakyTests > 0 && (
                <KpiCard label="Flaky Tests" value={String(flakyTests)} accent="#f59e0b" />
              )}
              {totalMs > 0 && (
                <KpiCard label="Total Duration" value={fmtMs(totalMs)} />
              )}
            </div>

            {/* Status bar */}
            <div style={{ marginBottom: '14px' }}>
              <StatusBar runs={runs} />
            </div>

            {/* Runs table — failed first */}
            <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${S.border}`, fontSize: '11px', color: S.fgMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Runs {failedRuns.length > 0 && <span style={{ color: '#ef4444', marginLeft: '6px' }}>· {failedRuns.length} failed</span>}
              </div>
              {sortedRuns.map((r, i) => (
                <RunRow key={runKeys(r, i)} run={r} onSelect={() => onSelect(runKeys(r, i))} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
