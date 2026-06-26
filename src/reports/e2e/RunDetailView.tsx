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

// Build a URL pointing to our self-hosted trace viewer with the trace routed
// through our /api/blob proxy (same-origin → no CORS required).
// Falls back to passing the pre-signed Azure URL directly (still needs Azure CORS,
// but works if the user has configured it).
function traceViewerUrl(
  traceUrl:  string | null | undefined,
  proxyPath: string | null | undefined,
  blobPath:  string | null | undefined,
  reportType: string,
): string | null {
  let src: string | null = null

  if (proxyPath) {
    // proxyPath is e.g. "/api/blob?path=..." — append report type then use as-is
    const full = proxyPath.includes('report=')
      ? proxyPath
      : `${proxyPath}&report=${encodeURIComponent(reportType)}`
    src = `${window.location.origin}${full}`
  } else if (blobPath) {
    src = `${window.location.origin}/api/blob?path=${encodeURIComponent(blobPath)}&report=${encodeURIComponent(reportType)}`
  } else if (traceUrl) {
    // Pre-signed Azure URL — viewer can still load it if Azure CORS allows our origin
    src = traceUrl
  }

  return src ? `/trace-viewer/index.html?trace=${encodeURIComponent(src)}` : null
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
  const viewerUrl     = trace
    ? traceViewerUrl(trace.url, trace.proxyPath, trace.blobPath, reportType)
    : null

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
          viewerUrl ? (
            <a
              href={viewerUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '5px 12px', borderRadius: '6px',
                background: '#7c3aed', color: '#fff',
                textDecoration: 'none', fontSize: '11.5px', fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 3a1 1 0 011-1h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3zm2 1v8h8V4H4zm3 2l3 2-3 2V6z"/>
              </svg>
              View Trace
            </a>
          ) : undefined
        }
      />

      {htmlReportUrl ? (
        <>
          <SummaryStrip run={run} />
          <iframe
            src={htmlReportUrl}
            style={{ flex: 1, width: '100%', border: 'none', display: 'block' }}
            title="Playwright HTML Report"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          />
        </>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.fgMuted, fontSize: '13px' }}>
          {viewerUrl
            ? 'No HTML report available — use the View Trace button above.'
            : 'No report or trace available for this run.'}
        </div>
      )}
    </div>
  )
}
