import { useState, useEffect } from 'react'
import type { E2eRunEntry, E2eRunStatus } from './types'
import PanelTopBar from '../../components/PanelTopBar'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMs(ms: number) {
  const m = Math.floor(ms / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function runStatusColor(status: E2eRunStatus | string): string {
  if (status === 'passed' || status === 'succeeded') return '#22c55e'
  if (status === 'failed')                           return '#ef4444'
  if (status === 'succeeded_with_issues')            return '#f97316'
  return '#94a3b8'
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

// ── Summary strip ─────────────────────────────────────────────────────────────

function SummaryStrip({ run }: { run: E2eRunEntry }) {
  const summary     = run.summary
  const durationMs  = run.durationMs ?? run.executionTimeMs
  const statusColor = runStatusColor(run.result ?? run.status)

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
      padding: '8px 16px', borderBottom: `1px solid ${S.border}`,
      background: S.surface, fontSize: '11.5px', color: S.fgMuted, flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: statusColor }} />
        <span style={{ color: S.fg, fontWeight: 600 }}>{run.result ?? run.status}</span>
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
      {run.links?.adoArtifactsUrl && (
        <a href={run.links.adoArtifactsUrl} target="_blank" rel="noopener noreferrer"
          style={{ color: S.fgSubtle, textDecoration: 'none', marginLeft: 'auto' }}>
          ADO ↗
        </a>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface Props {
  run:        E2eRunEntry
  reportType: string
  onBack:     () => void
}

export default function RunDetailView({ run, reportType, onBack }: Props) {
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
                style={{ flex: 1, width: '100%', border: 'none' }}
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
          visibility: activeTab === 'trace' ? 'visible' : 'hidden',
          pointerEvents: activeTab === 'trace' ? 'auto' : 'none',
        }}>
          {traceActivated && viewerUrl ? (
            // No sandbox: same-origin iframe, service worker must be allowed to register
            <iframe
              src={viewerUrl}
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              title="Playwright Trace Viewer"
              allow="clipboard-read; clipboard-write"
            />
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
