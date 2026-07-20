import { useState, useEffect, useCallback } from 'react'
import type { E2eRunEntry, E2eRunStatus } from './types'
import PanelTopBar from '../../components/PanelTopBar'
import { browserName } from './OverviewView'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMs(ms: number) {
  const m = Math.floor(ms / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function runStatusColor(status: E2eRunStatus | string): string {
  if (status === 'passed' || status === 'succeeded')       return '#22c55e'
  if (status === 'failed')                                 return '#ef4444'
  if (status === 'succeeded_with_issues')                  return '#f97316'
  if (status === 'inProgress')                             return '#3b82f6'
  if (status === 'cancelling')                             return '#f97316'
  if (status === 'notStarted')                             return '#94a3b8'
  return '#94a3b8'
}

function isInProgressStatus(status: string): boolean {
  return status === 'inProgress' || status === 'notStarted' || status === 'cancelling'
}

// Build the proxy URL for the trace. Prefers proxyPath from the JSON (set by
// the generation pipeline), falls back to constructing from blobPath.
// The proxy URL routes through /api/blob (our own origin), so the trace viewer's
// service worker fetches same-origin — no CORS needed.
function traceProxyUrl(
  proxyPath: string | null | undefined,
  blobPath:  string | null | undefined,
  reportType: string,
): string | null {
  if (proxyPath) {
    const full = proxyPath.includes('report=')
      ? proxyPath
      : `${proxyPath}&report=${encodeURIComponent(reportType)}`
    return `${window.location.origin}${full}`
  }
  if (blobPath) {
    return `${window.location.origin}/api/blob?path=${encodeURIComponent(blobPath)}&report=${encodeURIComponent(reportType)}`
  }
  return null
}

// ── Theme sync ────────────────────────────────────────────────────────────────

function useAppTheme(): 'light' | 'dark' {
  const read = useCallback((): 'light' | 'dark' => {
    const attr = document.documentElement.getAttribute('data-theme')
    if (attr === 'dark' || attr === 'light') return attr
    const stored = localStorage.getItem('dashboar_theme')
    if (stored === 'dark' || stored === 'light') return stored
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }, [])

  const [theme, setTheme] = useState<'light' | 'dark'>(read)

  useEffect(() => {
    const obs = new MutationObserver(() => setTheme(read()))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [read])

  return theme
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const S = {
  surface:  'var(--color-surface)',
  border:   'var(--color-border)',
  fg:       'var(--color-foreground)',
  fgMuted:  'var(--color-foreground-muted)',
  fgSubtle: 'var(--color-foreground-subtle)',
  sunken:   'var(--color-surface-sunken)',
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

function TabBar({ active, hasReport, hasTrace, onChange }: {
  active:    'report' | 'trace'
  hasReport: boolean
  hasTrace:  boolean
  onChange:  (t: 'report' | 'trace') => void
}) {
  if (!hasReport && !hasTrace) return null
  const tab = (id: 'report' | 'trace', label: string) => (
    <button
      onClick={() => onChange(id)}
      style={{
        fontSize: '11.5px', fontWeight: 600, padding: '4px 12px', border: 'none',
        borderRadius: '5px', cursor: 'pointer',
        background: active === id ? 'var(--color-accent)' : 'transparent',
        color: active === id ? '#fff' : S.fgMuted,
        transition: 'background 0.15s, color 0.15s',
      }}
    >
      {label}
    </button>
  )
  return (
    <div style={{ display: 'flex', gap: '2px', background: S.sunken, borderRadius: '7px', padding: '2px' }}>
      {hasReport && tab('report', 'Report')}
      {hasTrace  && tab('trace',  'Trace')}
    </div>
  )
}

// ── Browser target bar ────────────────────────────────────────────────────────
//
// One CI build fans out into a separate report per browser target. `siblings`
// holds every target for the same (build, suite) as `run` — render nothing
// when there's only one (the common case for single-browser suites).

function BrowserTargetBar({ siblings, run, onSelect }: {
  siblings: E2eRunEntry[]
  run:      E2eRunEntry
  onSelect: (run: E2eRunEntry) => void
}) {
  if (siblings.length <= 1) return null
  return (
    <div style={{
      display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center',
      padding: '8px 16px', borderBottom: `1px solid ${S.border}`, background: S.surface, flexShrink: 0,
    }}>
      <span style={{ fontSize: '10px', fontWeight: 600, color: S.fgMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Targets
      </span>
      {siblings.map((s, i) => {
        const active = s === run
        const eff    = s.result ?? s.status
        const color  = runStatusColor(eff)
        const label  = browserName(s.matrixLabel)
        return (
          <button
            key={s.reportBlobPath ?? s.id ?? i}
            onClick={() => onSelect(s)}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              fontSize: '11.5px', fontWeight: 600, padding: '4px 10px', borderRadius: '999px',
              border: `1px solid ${active ? color : S.border}`,
              background: active ? `color-mix(in srgb, ${color} 14%, transparent)` : 'transparent',
              color: active ? color : S.fgMuted,
              cursor: 'pointer',
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, flexShrink: 0 }} />
            {label}
          </button>
        )
      })}
    </div>
  )
}

// ── Summary strip ─────────────────────────────────────────────────────────────

function SummaryStrip({ run }: { run: E2eRunEntry }) {
  const summary     = run.summary
  const durationMs  = run.durationMs ?? run.executionTimeMs
  const eff         = run.result ?? run.status
  const statusColor = runStatusColor(eff)
  const inProgress  = isInProgressStatus(eff)

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
      padding: '8px 16px', borderBottom: `1px solid ${S.border}`,
      background: S.surface, fontSize: '11.5px', color: S.fgMuted, flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{
          width: '7px', height: '7px', borderRadius: '50%', background: statusColor,
          animation: inProgress ? 'dashboar-pulse 1.5s ease-in-out infinite' : undefined,
        }} />
        <span style={{ color: S.fg, fontWeight: 600 }}>{eff}</span>
        {inProgress && (
          <span style={{
            fontSize: '10px', fontWeight: 600, color: '#3b82f6',
            background: '#3b82f620', border: '1px solid #3b82f640',
            borderRadius: '4px', padding: '1px 6px', letterSpacing: '0.03em',
          }}>
            In Progress
          </span>
        )}
      </div>
      {run.branch      && <span style={{ fontFamily: 'ui-monospace,monospace', fontSize: '10.5px' }}>{run.branch}</span>}
      {run.commit      && <span style={{ fontFamily: 'ui-monospace,monospace', fontSize: '10.5px', color: S.fgSubtle }}>{run.commit.slice(0, 7)}</span>}
      {run.buildNumber && <span>#{run.buildNumber}</span>}
      {durationMs != null && <span>{fmtMs(durationMs)}</span>}
      {summary && (
        <span>
          <span style={{ color: '#22c55e', fontWeight: 600 }}>{summary.passed}</span>
          {' / '}
          <span style={{ fontWeight: 600 }}>{summary.total}</span>
          {' passed'}
          {summary.failed > 0 && <span style={{ color: '#ef4444', marginLeft: '8px', fontWeight: 600 }}>{summary.failed} failed</span>}
          {summary.flaky  > 0 && <span style={{ color: '#f59e0b', marginLeft: '8px' }}>{summary.flaky} flaky</span>}
        </span>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginLeft: 'auto' }}>
        {run.links?.playwrightWorkspaceReportUrl && (
          <a href={run.links.playwrightWorkspaceReportUrl} target="_blank" rel="noopener noreferrer"
            style={{ color: S.fgSubtle, textDecoration: 'none' }}>
            Workspace ↗
          </a>
        )}
        {run.links?.adoArtifactsUrl && (
          <a href={run.links.adoArtifactsUrl} target="_blank" rel="noopener noreferrer"
            style={{ color: S.fgSubtle, textDecoration: 'none' }}>
            ADO ↗
          </a>
        )}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface Props {
  run:            E2eRunEntry
  siblings:       E2eRunEntry[]
  reportType:     string
  onBack:         () => void
  onSelectRun:    (run: E2eRunEntry) => void
}

export default function RunDetailView({ run, siblings, reportType, onBack, onSelectRun }: Props) {
  const colorScheme   = useAppTheme()
  const htmlReportUrl = run.links?.htmlReportUrl ?? null
  const trace         = run.trace
  const proxyUrl      = trace ? traceProxyUrl(trace.proxyPath, trace.blobPath, reportType) : null
  // Self-hosted trace viewer — same origin, service worker registers fine, no CORS needed
  const viewerUrl     = proxyUrl
    ? `/trace-viewer/index.html?trace=${encodeURIComponent(proxyUrl)}`
    : null

  const hasReport = !!htmlReportUrl
  const hasTrace  = !!viewerUrl

  // Track tab and whether the trace iframe has ever been activated.
  // Trace iframe only gets its src on first activation — lazy load to save bandwidth.
  const [activeTab,      setActiveTab]      = useState<'report' | 'trace'>(hasReport ? 'report' : 'trace')
  const [traceActivated, setTraceActivated] = useState(false)

  // Reset when switching to a different run
  const runKey = run.reportBlobPath ?? run.id ?? run.buildNumber
  useEffect(() => {
    setActiveTab(hasReport ? 'report' : 'trace')
    setTraceActivated(false)
  }, [runKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = (tab: 'report' | 'trace') => {
    setActiveTab(tab)
    if (tab === 'trace') setTraceActivated(true)
  }

  const suiteName = run.suiteName ?? run.suite ?? run.jobName ?? 'Run'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PanelTopBar
        left={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={onBack}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: S.fgMuted, fontSize: '13px', padding: 0 }}
              title="Back to overview"
            >
              ←
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: runStatusColor(run.result ?? run.status) }} />
              <div style={{ fontSize: '14px', fontWeight: 700, color: S.fg }}>{suiteName}</div>
              {run.matrixLabel && (
                <span style={{ fontSize: '11px', color: S.fgMuted, fontFamily: 'ui-monospace,monospace', background: S.sunken, padding: '2px 6px', borderRadius: '4px' }}>
                  {run.matrixLabel}
                </span>
              )}
            </div>
          </div>
        }
        right={
          <TabBar
            active={activeTab}
            hasReport={hasReport}
            hasTrace={hasTrace}
            onChange={handleTabChange}
          />
        }
      />

      <BrowserTargetBar siblings={siblings} run={run} onSelect={onSelectRun} />

      {/* Content area — both tabs live in the DOM once activated; visibility swap avoids iframe reloads */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

        {/* Report tab */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          visibility: activeTab === 'report' ? 'visible' : 'hidden',
          pointerEvents: activeTab === 'report' ? 'auto' : 'none',
        }}>
          {htmlReportUrl ? (
            <>
              <SummaryStrip run={run} />
              <iframe
                src={htmlReportUrl}
                style={{ flex: 1, width: '100%', border: 'none', colorScheme }}
                title="Playwright HTML Report"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
              />
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.fgMuted, fontSize: '13px' }}>
              No HTML report available for this run.
            </div>
          )}
        </div>

        {/* Trace tab — iframe only gets its src on first activation (lazy bandwidth) */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          visibility: activeTab === 'trace' ? 'visible' : 'hidden',
          pointerEvents: activeTab === 'trace' ? 'auto' : 'none',
        }}>
          {traceActivated && viewerUrl ? (
            <>
              {(trace?.testTitle || trace?.file) && (
                <div style={{
                  padding: '6px 16px', borderBottom: `1px solid ${S.border}`,
                  background: S.surface, fontSize: '11.5px', color: S.fgMuted, flexShrink: 0,
                }}>
                  {trace.testTitle && <span style={{ color: S.fg, fontWeight: 600 }}>{trace.testTitle}</span>}
                  {trace.file && (
                    <span style={{ fontFamily: 'ui-monospace,monospace', marginLeft: trace.testTitle ? '8px' : 0, color: S.fgSubtle }}>
                      {trace.file}{trace.line != null ? `:${trace.line}` : ''}
                    </span>
                  )}
                </div>
              )}
              {/* No sandbox: same-origin iframe, service worker must be allowed to register */}
              <iframe
                src={viewerUrl}
                style={{ flex: 1, width: '100%', border: 'none', display: 'block', colorScheme }}
                title="Playwright Trace Viewer"
                allow="clipboard-read; clipboard-write"
              />
            </>
          ) : !hasTrace ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: S.fgMuted, fontSize: '13px' }}>
              No trace available for this run.
            </div>
          ) : null}
        </div>

      </div>
    </div>
  )
}
