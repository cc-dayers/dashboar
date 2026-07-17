import { useState, useEffect } from 'react'
import { registry } from '../reports'
import BoarMark from './BoarMark'
import ThemeToggle from './ThemeToggle'
import DocsButton from './DocsButton'
import DocsModal from './DocsModal'
import ReportVisibilityModal from './ReportVisibilityModal'
import { loadVisibleReportTypes, saveVisibleReportTypes } from '../lib/reportVisibility'

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

function reportsEqual(current: DiscoveredReport[], next: DiscoveredReport[]) {
  return current.length === next.length && current.every((report, index) => {
    const candidate = next[index]
    return report.id === candidate.id
      && report.reportType === candidate.reportType
      && report.storagePath === candidate.storagePath
      && report.lastModified === candidate.lastModified
      && report.sizeBytes === candidate.sizeBytes
  })
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FileIcon() {
  return (
    <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function TypeEntry({
  reportType,
  entry,
  storageReports,
  isLoading,
  isLast,
}: {
  reportType:     string
  entry:          typeof registry[string]
  storageReports: DiscoveredReport[]
  isLoading:      boolean
  isLast:         boolean
}) {
  const [fixturesOpen, setFixturesOpen] = useState(false)
  const hasFixtures = entry.fixtures && entry.fixtures.length > 0
  const hasStorage  = storageReports.length > 0

  return (
    <div className={`px-5 py-4${isLast ? '' : ' border-b border-border-subtle'}`}>
      {/* Type header */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 bg-accent-surface rounded-lg flex items-center justify-center mt-0.5">
          <FileIcon />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-xs font-mono text-accent-foreground bg-accent-surface px-1.5 py-0.5 rounded">{reportType}</code>
            <span className="text-sm font-semibold text-foreground">{entry.label}</span>
          </div>
          <p className="text-xs text-foreground-muted mt-1 leading-snug">{entry.description}</p>
        </div>
      </div>

      {/* Fixtures — collapsed by default to avoid overwhelming the primary view */}
      {hasFixtures && (
        <div className="mt-2.5 ml-11">
          <button
            onClick={() => setFixturesOpen(o => !o)}
            className="inline-flex items-center gap-1 text-xs text-foreground-muted hover:text-accent transition-colors cursor-pointer"
            aria-expanded={fixturesOpen}
          >
            <svg
              className={`w-3 h-3 transition-transform${fixturesOpen ? ' rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Fixtures ({entry.fixtures!.length})
          </button>
          {fixturesOpen && (
            <div className="mt-1.5">
              {entry.fixtures!.map(id => (
                <a
                  key={id}
                  href={fixtureHref(id, reportType)}
                  className="inline-block text-xs font-mono text-accent-foreground bg-accent-surface hover:opacity-75 px-1.5 py-0.5 rounded mr-1.5 mb-1 transition-opacity"
                >
                  {id}
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Storage reports for this type */}
      {(hasStorage || isLoading) && (
        <div className="mt-2.5 ml-11">
          {isLoading ? (
            <div className="h-5 flex items-center gap-2 text-xs text-foreground-muted">
              <div className="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin" />
              Checking storage…
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              {storageReports.map((r, i) => (
                <a
                  key={r.id}
                  href={reportHref(r.reportType, r.storagePath, r.id)}
                  className={`group flex items-center gap-3 px-3 py-2 hover:bg-surface-sunken transition-colors${i > 0 ? ' border-t border-border-subtle' : ''}`}
                  style={{ textDecoration: 'none' }}
                >
                  <span className="text-xs text-foreground-secondary font-medium flex-1 truncate">{r.id}</span>
                  <span className="text-xs text-foreground-muted flex-shrink-0 tabular-nums">
                    {r.lastModified ? fmtDate(r.lastModified) : ''}
                    {r.sizeBytes != null ? ` · ${fmtSize(r.sizeBytes)}` : ''}
                  </span>
                  <svg className="w-3 h-3 text-foreground-muted group-hover:text-accent flex-shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

type BrowseState = 'initial-loading' | 'refreshing' | 'done'

export default function LandingPage() {
  const allTypes = Object.entries(registry)
  const [browseState,   setBrowseState]   = useState<BrowseState>('initial-loading')
  const [reports,       setReports]       = useState<DiscoveredReport[]>([])
  const [errors,        setErrors]        = useState<FetchError[]>([])
  const [showDocs,      setShowDocs]      = useState(false)
  const [showConfig,    setShowConfig]    = useState(false)
  const [visibleTypes,  setVisibleTypes]  = useState(() => loadVisibleReportTypes(Object.keys(registry)))

  const types = allTypes.filter(([key]) => visibleTypes.has(key))

  function updateVisibleTypes(next: Set<string>) {
    setVisibleTypes(next)
    saveVisibleReportTypes(next)
  }

  useEffect(() => { void loadFromStorage(false) }, [])

  async function loadFromStorage(isRefresh: boolean) {
    setBrowseState(isRefresh ? 'refreshing' : 'initial-loading')
    try {
      const res  = await fetch('/api/list-blobs')
      const json = await res.json() as {
        blobs?: Array<{ id: string; reportType: string; storagePath: string; lastModified?: string; sizeBytes?: number }>
        error?: string
      }
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      const all = (json.blobs ?? []).filter(b => b.reportType in registry)
      all.sort((a, b) => {
        if (!a.lastModified || !b.lastModified) return 0
        return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
      })
      setReports(current => reportsEqual(current, all) ? current : all)
      setErrors(json.error ? [{ reportType: '', error: json.error }] : [])
    } catch (e) {
      setErrors([{ reportType: '', error: e instanceof Error ? e.message : 'Network error' }])
    }
    setBrowseState('done')
  }

  // Group storage reports by reportType for O(1) lookup per type
  const reportsByType = reports.reduce<Record<string, DiscoveredReport[]>>((acc, r) => {
    ;(acc[r.reportType] ??= []).push(r)
    return acc
  }, {})

  const totalInStorage = reports.filter(r => visibleTypes.has(r.reportType)).length
  const isInitialLoading = browseState === 'initial-loading'
  const isRefreshing = browseState === 'refreshing'
  const isLoading = isInitialLoading || isRefreshing

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
          <p className="text-foreground-muted text-sm">JSON Report viewer</p>
        </div>

        {/* Unified reports panel */}
        <div className="bg-surface rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="px-5 py-3 border-b border-border-subtle flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <h2 className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">Reports</h2>
              <button
                onClick={() => setShowConfig(true)}
                className="text-foreground-muted hover:text-accent cursor-pointer transition-colors leading-none"
                title="Configure visible reports"
                aria-label="Configure visible reports"
                style={{ padding: '2px' }}
              >
                <GearIcon />
              </button>
            </div>
            <div className="flex items-center gap-3">
              {isLoading && (
                <div className="w-3.5 h-3.5 border border-accent border-t-transparent rounded-full animate-spin" />
              )}
              {!isLoading && totalInStorage > 0 && (
                <span className="text-xs text-foreground-muted">
                  {totalInStorage} in storage
                </span>
              )}
              <button
                onClick={() => { void loadFromStorage(true) }}
                className="text-sm text-foreground-muted hover:text-accent cursor-pointer transition-colors leading-none"
                title="Refresh storage"
                aria-label="Refresh storage"
                disabled={isLoading}
              >
                ↻
              </button>
            </div>
          </div>

          {types.length === 0 && (
            <div className="px-5 py-8 text-center">
              <p className="text-xs text-foreground-muted">
                No report types selected.{' '}
                <button
                  onClick={() => setShowConfig(true)}
                  className="text-accent hover:underline cursor-pointer"
                >
                  Choose reports to show
                </button>
              </p>
            </div>
          )}

          <div style={{ position: 'relative' }} aria-busy={isLoading}>
            {types.map(([key, entry], i) => (
              <TypeEntry
                key={key}
                reportType={key}
                entry={entry}
                storageReports={reportsByType[key] ?? []}
                isLoading={isInitialLoading}
                isLast={i === types.length - 1}
              />
            ))}

            {isRefreshing && (
              <div
                role="status"
                aria-label="Refreshing reports"
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'color-mix(in srgb, var(--color-surface) 76%, transparent)',
                  backdropFilter: 'blur(1px)',
                }}
              >
                <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 shadow-sm text-xs text-foreground-muted">
                  <div className="w-3.5 h-3.5 border border-accent border-t-transparent rounded-full animate-spin" />
                  Refreshing reports…
                </div>
              </div>
            )}
          </div>

          {errors.length > 0 && (
            <div className="px-5 py-3 border-t border-border-subtle space-y-1">
              {errors.map(e => (
                <p key={e.reportType} className="text-xs text-red-500">
                  {e.reportType && <code className="font-mono">{e.reportType}: </code>}
                  {e.error}
                  {e.hint && <span className="text-red-400"> — {e.hint}</span>}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Direct link hint */}
        <p className="text-center text-xs text-foreground-muted">
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

      <DocsButton active={showDocs} onClick={() => setShowDocs(true)} />
      {showDocs && <DocsModal onClose={() => setShowDocs(false)} />}
      {showConfig && (
        <ReportVisibilityModal
          visible={visibleTypes}
          onChange={updateVisibleTypes}
          onClose={() => setShowConfig(false)}
        />
      )}
    </div>
  )
}
