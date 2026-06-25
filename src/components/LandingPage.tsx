import { useState, useEffect } from 'react'
import { registry } from '../reports'
import BoarMark from './BoarMark'
import ThemeToggle from './ThemeToggle'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DiscoveredReport {
  id:            string
  reportType:    string
  storagePath:   string
  lastModified?: string
  sizeBytes?:    number
}

interface FetchError {
  reportType: string
  error:      string
  hint?:      string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtSize(bytes: number) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  if (bytes >= 1_000)     return `${Math.round(bytes / 1_000)} KB`
  return `${bytes} B`
}

function reportHref(reportType: string, storagePath: string, id: string): string {
  const base = `/?report=${encodeURIComponent(reportType)}&path=${encodeURIComponent(storagePath)}`
  return id !== 'report' ? `${base}&id=${encodeURIComponent(id)}` : base
}

function fixtureHref(id: string, reportType: string): string {
  return `/?id=${encodeURIComponent(id)}&report=${encodeURIComponent(reportType)}&_fixture=dev`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TypeCard({ reportType, entry }: { reportType: string; entry: typeof registry[string] }) {
  return (
    <div className="flex items-start gap-4 px-5 py-4 border-b border-border-subtle last:border-0">
      <div className="flex-shrink-0 w-9 h-9 bg-accent-surface rounded-lg flex items-center justify-center mt-0.5">
        <svg className="w-4.5 h-4.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <code className="text-xs font-mono text-accent-foreground bg-accent-surface px-1.5 py-0.5 rounded">{reportType}</code>
          <span className="text-sm font-semibold text-foreground">{entry.label}</span>
        </div>
        <p className="text-xs text-foreground-subtle mt-1 leading-snug">{entry.description}</p>
        {entry.fixtures && entry.fixtures.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className="text-xs text-foreground-subtle">Examples:</span>
            {entry.fixtures.map(id => (
              <a
                key={id}
                href={fixtureHref(id, reportType)}
                className="text-xs text-accent-foreground bg-accent-surface hover:opacity-80 px-2 py-0.5 rounded font-mono transition-opacity"
              >
                {id}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StorageReportRow({ r }: { r: DiscoveredReport }) {
  return (
    <a
      href={reportHref(r.reportType, r.storagePath, r.id)}
      className="group flex items-center gap-3 px-5 py-3 hover:bg-surface-sunken transition-colors border-b border-border-subtle last:border-0"
      style={{ textDecoration: 'none' }}
    >
      <code className="text-xs font-mono text-accent-foreground bg-accent-surface px-1.5 py-0.5 rounded flex-shrink-0">
        {r.reportType}
      </code>
      <span className="text-sm text-foreground-secondary font-medium flex-1 truncate">{r.id}</span>
      <span className="text-xs text-foreground-subtle flex-shrink-0 tabular-nums">
        {r.lastModified ? fmtDate(r.lastModified) : ''}
        {r.sizeBytes != null ? ` · ${fmtSize(r.sizeBytes)}` : ''}
      </span>
      <svg className="w-3.5 h-3.5 text-foreground-subtle group-hover:text-accent flex-shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </a>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

type BrowseState = 'idle' | 'loading' | 'done'

export default function LandingPage() {
  const types = Object.entries(registry)
  const [browseState, setBrowseState] = useState<BrowseState>('loading')
  const [reports,     setReports]     = useState<DiscoveredReport[]>([])
  const [errors,      setErrors]      = useState<FetchError[]>([])

  useEffect(() => { void loadFromStorage() }, [])

  async function loadFromStorage() {
    setBrowseState('loading')
    try {
      const res  = await fetch('/api/list-blobs')
      const json = await res.json() as {
        blobs?: Array<{ id: string; reportType: string; storagePath: string; lastModified?: string; sizeBytes?: number }>
        error?: string
      }
      const all = (json.blobs ?? []).filter(b => b.reportType in registry)
      all.sort((a, b) => {
        if (!a.lastModified || !b.lastModified) return 0
        return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
      })
      setReports(all)
      setErrors(json.error ? [{ reportType: '', error: json.error }] : [])
    } catch (e) {
      setErrors([{ reportType: '', error: e instanceof Error ? e.message : 'Network error' }])
    }
    setBrowseState('done')
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6" style={{ position: 'relative' }}>
      <div style={{ position: 'fixed', top: '16px', left: '16px', zIndex: 10 }}>
        <ThemeToggle />
      </div>
      <div className="max-w-lg w-full space-y-4">

        {/* Hero */}
        <div className="flex flex-col items-center mb-2" style={{ gap: '10px' }}>
          <div style={{ animation: 'boarFloat 3.5s ease-in-out infinite' }}>
            <BoarMark size={120} />
          </div>
          <h1 style={{
            fontFamily: "'Russo One', sans-serif",
            fontSize: '2rem',
            color: 'var(--color-foreground)',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            margin: 0,
          }}>
            Dashboar
          </h1>
          <p className="text-foreground-subtle text-sm">Report viewer · Azure Blob Storage</p>
        </div>

        {/* Report types */}
        <div className="bg-surface rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="px-5 py-3 border-b border-border-subtle">
            <h2 className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">Report types</h2>
          </div>
          {types.map(([key, entry]) => (
            <TypeCard key={key} reportType={key} entry={entry} />
          ))}
        </div>

        {browseState === 'loading' && (
          <div className="bg-surface rounded-2xl border border-border px-5 py-8 flex flex-col items-center gap-3 text-foreground-subtle">
            <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Scanning storage…</span>
          </div>
        )}

        {browseState === 'done' && (
          <div className="bg-surface rounded-2xl shadow-sm border border-border overflow-hidden">
            <div className="px-5 py-3 border-b border-border-subtle flex items-center justify-between">
              <h2 className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">Storage</h2>
              <div className="flex items-center gap-3">
                {reports.length > 0 && (
                  <span className="text-xs text-foreground-subtle">{reports.length} report{reports.length !== 1 ? 's' : ''}</span>
                )}
                <button
                  onClick={() => { void loadFromStorage() }}
                  className="text-xs text-accent hover:opacity-70 cursor-pointer transition-opacity"
                  title="Refresh"
                >
                  ↻
                </button>
              </div>
            </div>

            {reports.length > 0 && reports.map(r => (
              <StorageReportRow key={`${r.reportType}/${r.id}`} r={r} />
            ))}

            {errors.length > 0 && (
              <div className="px-5 py-3 space-y-2 border-t border-border-subtle">
                {errors.map(e => (
                  <div key={e.reportType} className="text-xs text-red-500">
                    <code className="font-mono">{e.reportType}</code>: {e.error}
                    {e.hint && <span className="text-red-400"> — {e.hint}</span>}
                  </div>
                ))}
              </div>
            )}

            {reports.length === 0 && errors.length === 0 && (
              <p className="px-5 py-6 text-sm text-foreground-subtle text-center">No reports found in storage.</p>
            )}
          </div>
        )}

        {/* Direct link hint */}
        <p className="text-center text-xs text-foreground-subtle">
          Or open directly:{' '}
          <code className="font-mono bg-surface border border-border px-1.5 py-0.5 rounded text-foreground-muted">
            ?id=my-report&amp;report=pr-review
          </code>
        </p>

      </div>

      <style>{`
        @keyframes boarFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-7px); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="boarFloat"] { animation: none !important; }
        }
      `}</style>
    </div>
  )
}
