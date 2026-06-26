import type { E2eRunReport, E2eTest, E2eArtifact, E2eTestStatus } from './types'
import { traceViewerUrl, artifactProxyUrl } from '../../lib/blobFetch'
import PanelTopBar from '../../components/PanelTopBar'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMs(ms: number) {
  const m = Math.floor(ms / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
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

// ── Status helpers ────────────────────────────────────────────────────────────

function testStatusColor(s: E2eTestStatus | string): { dot: string; text: string } {
  if (s === 'passed')   return { dot: '#22c55e', text: '#16a34a' }
  if (s === 'failed')   return { dot: '#ef4444', text: '#dc2626' }
  if (s === 'flaky')    return { dot: '#f59e0b', text: '#d97706' }
  if (s === 'timedout') return { dot: '#f97316', text: '#ea580c' }
  return { dot: '#94a3b8', text: '#64748b' }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: '10px', padding: '14px 16px' }}>
      <div style={{ fontSize: '10px', color: S.fgMuted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: 700, color: accent ?? S.fg, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: S.fgSubtle, marginTop: '4px' }}>{sub}</div>}
    </div>
  )
}

function ArtifactLinks({ artifacts, reportType }: { artifacts: Record<string, E2eArtifact>; reportType: string }) {
  const entries = Object.entries(artifacts).filter(([, a]) => a.blobPath || a.url || a.proxyPath)
  if (entries.length === 0) return null

  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
      {entries.map(([key, artifact]) => {
        const isTrace      = artifact.contentType?.includes('zip') || key === 'trace'
        const isScreenshot = artifact.contentType?.startsWith('image/') || key === 'screenshot'
        const isVideo      = artifact.contentType?.startsWith('video/') || key === 'video'

        let href: string | null = null
        let label = artifact.name ?? key
        let title: string | undefined

        if (isTrace && artifact.blobPath) {
          href  = traceViewerUrl(artifact.blobPath, reportType)
          label = 'Trace'
          title = 'Open in Playwright Trace Viewer'
        } else if (artifact.blobPath) {
          href  = artifactProxyUrl(artifact.blobPath, reportType)
          label = isScreenshot ? 'Screenshot' : isVideo ? 'Video' : (artifact.name ?? key)
        } else if (artifact.url) {
          href  = artifact.url
          label = artifact.name ?? key
        } else if (artifact.proxyPath) {
          href  = artifact.proxyPath
        }

        if (!href) return null

        const btnColor = isTrace ? '#7c3aed' : isScreenshot ? '#0e7490' : '#475569'
        const btnBg    = isTrace ? '#f5f3ff' : isScreenshot ? '#ecfeff' : S.sunken

        return (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={title}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              fontSize: '11px', fontWeight: 500, color: btnColor,
              background: btnBg, border: `1px solid ${btnColor}30`,
              borderRadius: '5px', padding: '3px 8px',
              textDecoration: 'none',
            }}
          >
            {isTrace && (
              <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 3a1 1 0 011-1h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3zm2 1v8h8V4H4zm3 2l3 2-3 2V6z"/>
              </svg>
            )}
            {isScreenshot && (
              <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                <path d="M6 3a1 1 0 00-.894.553L4.382 5H3a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-1.382l-.724-1.447A1 1 0 0010 3H6zm4 5a2 2 0 11-4 0 2 2 0 014 0z"/>
              </svg>
            )}
            {label}
          </a>
        )
      })}
    </div>
  )
}

function TestRow({ test, reportType }: { test: E2eTest; reportType: string }) {
  const st = testStatusColor(test.status)
  const hasArtifacts = test.artifacts && Object.keys(test.artifacts).length > 0

  return (
    <div style={{ padding: '12px 16px', borderTop: `1px solid ${S.border}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: st.dot, flexShrink: 0, marginTop: '5px' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '12.5px', fontWeight: 600, color: S.fg, marginBottom: '2px', wordBreak: 'break-word' }}>
            {test.title}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: test.error || hasArtifacts ? '6px' : 0 }}>
            <span style={{ fontSize: '11px', color: st.text, fontWeight: 500 }}>{test.status}</span>
            {test.project && (
              <span style={{ fontSize: '10px', fontFamily: 'ui-monospace,monospace', color: S.fgMuted, background: S.sunken, padding: '1px 5px', borderRadius: '4px' }}>
                {test.project}
              </span>
            )}
            {test.durationMs != null && (
              <span style={{ fontSize: '11px', color: S.fgSubtle }}>{fmtMs(test.durationMs)}</span>
            )}
            {test.file && (
              <span style={{ fontSize: '10px', color: S.fgSubtle, fontFamily: 'ui-monospace,monospace' }}>
                {test.file}{test.line != null ? `:${test.line}` : ''}
              </span>
            )}
          </div>
          {test.error && (
            <pre style={{
              fontSize: '11px', color: '#dc2626', background: '#fef2f2',
              border: '1px solid #fecaca', borderRadius: '5px',
              padding: '8px 10px', overflowX: 'auto', whiteSpace: 'pre-wrap',
              wordBreak: 'break-word', margin: '0 0 6px', maxHeight: '120px',
              overflowY: 'auto', fontFamily: 'ui-monospace,monospace',
            }}>
              {test.error}
            </pre>
          )}
          {hasArtifacts && (
            <ArtifactLinks artifacts={test.artifacts!} reportType={reportType} />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Loading / error states ────────────────────────────────────────────────────

function RunDetailSkeleton() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-background)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '3px solid var(--color-accent)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        <div style={{ fontSize: '13px', color: S.fgMuted }}>Loading run details…</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}

function RunDetailError({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--color-background)', padding: '40px', gap: '12px' }}>
      <div style={{ fontSize: '14px', fontWeight: 600, color: '#dc2626' }}>Failed to load run detail</div>
      <div style={{ fontSize: '12px', color: S.fgMuted, maxWidth: '360px', textAlign: 'center' }}>{message}</div>
      <button
        onClick={onBack}
        style={{ fontSize: '12px', color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
      >
        ← Back to overview
      </button>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface Props {
  run:        E2eRunReport | null
  loading:    boolean
  error:      string | null
  reportType: string
  onBack:     () => void
}

export default function RunDetailView({ run, loading, error, reportType, onBack }: Props) {
  if (loading) return <RunDetailSkeleton />
  if (error)   return <RunDetailError message={error} onBack={onBack} />
  if (!run)    return null

  const suiteName = run.suiteName ?? run.suite ?? run.jobName ?? 'Run'
  const summary   = run.summary
  const tests     = run.tests ?? []

  const failedTests  = tests.filter(t => t.status === 'failed' || t.status === 'timedout')
  const flakyTests   = tests.filter(t => t.status === 'flaky')
  const skippedTests = tests.filter(t => t.status === 'skipped')
  const passedTests  = tests.filter(t => t.status === 'passed')
  const sortedTests  = [...failedTests, ...flakyTests, ...passedTests, ...skippedTests]

  const runStatusColor = run.status === 'passed' ? '#22c55e' : run.status === 'failed' ? '#ef4444' : '#f59e0b'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PanelTopBar
        left={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={onBack}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: S.fgMuted, display: 'flex', alignItems: 'center', padding: 0, fontSize: '13px' }}
              title="Back to overview"
            >
              ←
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: runStatusColor }} />
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
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {run.links?.htmlReportUrl && (
              <a href={run.links.htmlReportUrl} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: '11px', color: 'var(--color-accent)', textDecoration: 'none' }}>
                HTML Report ↗
              </a>
            )}
            {run.links?.adoArtifactsUrl && (
              <a href={run.links.adoArtifactsUrl} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: '11px', color: S.fgMuted, textDecoration: 'none' }}>
                ADO ↗
              </a>
            )}
          </div>
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--color-background)', padding: '20px 24px' }}>
        {/* Metadata row */}
        <div style={{ background: S.sunken, border: `1px solid ${S.border}`, borderRadius: '10px', padding: '14px 18px', marginBottom: '14px', fontSize: '12px', color: S.fgMuted }}>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            {run.branch && (
              <span><span style={{ color: S.fgSubtle }}>Branch </span><code style={{ fontFamily: 'ui-monospace,monospace', color: S.fgSec }}>{run.branch}</code></span>
            )}
            {run.commit && (
              <span><span style={{ color: S.fgSubtle }}>Commit </span><code style={{ fontFamily: 'ui-monospace,monospace', color: S.fgSec }}>{run.commit.slice(0, 7)}</code></span>
            )}
            {run.buildNumber && (
              <span><span style={{ color: S.fgSubtle }}>Build </span><code style={{ fontFamily: 'ui-monospace,monospace', color: S.fgSec }}>#{run.buildNumber}</code></span>
            )}
            {run.durationMs != null && (
              <span><span style={{ color: S.fgSubtle }}>Duration </span>{fmtMs(run.durationMs)}</span>
            )}
            {run.execution?.workers != null && (
              <span><span style={{ color: S.fgSubtle }}>Workers </span>{run.execution.workers}</span>
            )}
          </div>
          {run.execution?.playwrightCommand && (
            <div style={{ marginTop: '8px', fontFamily: 'ui-monospace,monospace', fontSize: '11px', color: S.fgSubtle, wordBreak: 'break-all' }}>
              {run.execution.playwrightCommand}
            </div>
          )}
        </div>

        {/* KPIs */}
        {summary && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px', marginBottom: '14px' }}>
            <KpiCard label="Total" value={String(summary.total)} />
            <KpiCard label="Passed" value={String(summary.passed)} accent={summary.passed > 0 ? '#22c55e' : undefined} />
            <KpiCard label="Failed" value={String(summary.failed)} accent={summary.failed > 0 ? '#ef4444' : undefined} />
            {summary.flaky > 0 && (
              <KpiCard label="Flaky" value={String(summary.flaky)} accent="#f59e0b" />
            )}
            {summary.skipped > 0 && (
              <KpiCard label="Skipped" value={String(summary.skipped)} />
            )}
          </div>
        )}

        {/* Tests list */}
        {tests.length > 0 ? (
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${S.border}`, fontSize: '11px', color: S.fgMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Tests
              {failedTests.length > 0 && <span style={{ color: '#ef4444', marginLeft: '6px' }}>· {failedTests.length} failed</span>}
              {flakyTests.length  > 0 && <span style={{ color: '#f59e0b', marginLeft: '6px' }}>· {flakyTests.length} flaky</span>}
            </div>
            {sortedTests.map((t, i) => (
              <TestRow key={i} test={t} reportType={reportType} />
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: S.fgMuted, fontSize: '13px' }}>
            No test details available in this run report.
          </div>
        )}

        {/* Links section */}
        {run.links && (run.links.playwrightWorkspaceReportUrl || run.links.adoArtifactsUrl) && (
          <div style={{ marginTop: '14px', background: S.sunken, border: `1px solid ${S.border}`, borderRadius: '10px', padding: '14px 18px' }}>
            <div style={{ fontSize: '11px', color: S.fgMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Links</div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {run.links.playwrightWorkspaceReportUrl && (
                <a href={run.links.playwrightWorkspaceReportUrl} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: '12px', color: 'var(--color-accent)', textDecoration: 'none' }}>
                  Playwright Workspace ↗
                </a>
              )}
              {run.links.adoArtifactsUrl && (
                <a href={run.links.adoArtifactsUrl} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: '12px', color: S.fgMuted, textDecoration: 'none' }}>
                  ADO Artifacts ↗
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
