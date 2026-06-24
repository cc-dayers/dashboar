import { useState } from 'react'
import { registry } from '../reports'
import BoarMark from './BoarMark'

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
    <div className="flex items-start gap-4 px-5 py-4 border-b border-slate-100 last:border-0">
      <div className="flex-shrink-0 w-9 h-9 bg-indigo-50 rounded-lg flex items-center justify-center mt-0.5">
        <svg className="w-4.5 h-4.5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <code className="text-xs font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{reportType}</code>
          <span className="text-sm font-semibold text-slate-800">{entry.label}</span>
        </div>
        <p className="text-xs text-slate-400 mt-1 leading-snug">{entry.description}</p>
        {entry.fixtures && entry.fixtures.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className="text-xs text-slate-400">Examples:</span>
            {entry.fixtures.map(id => (
              <a
                key={id}
                href={fixtureHref(id, reportType)}
                className="text-xs text-indigo-500 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded font-mono transition-colors"
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
      className="group flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
      style={{ textDecoration: 'none' }}
    >
      <code className="text-xs font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded flex-shrink-0">
        {r.reportType}
      </code>
      <span className="text-sm text-slate-700 font-medium flex-1 truncate">{r.id}</span>
      <span className="text-xs text-slate-400 flex-shrink-0 tabular-nums">
        {r.lastModified ? fmtDate(r.lastModified) : ''}
        {r.sizeBytes != null ? ` · ${fmtSize(r.sizeBytes)}` : ''}
      </span>
      <svg className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-400 flex-shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </a>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

type BrowseState = 'idle' | 'loading' | 'done'

export default function LandingPage() {
  const types = Object.entries(registry)
  const [browseState, setBrowseState] = useState<BrowseState>('idle')
  const [reports,     setReports]     = useState<DiscoveredReport[]>([])
  const [errors,      setErrors]      = useState<FetchError[]>([])

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-4">

        {/* Hero */}
        <div className="flex flex-col items-center mb-2" style={{ gap: '10px' }}>
          <div style={{ animation: 'boarFloat 3.5s ease-in-out infinite' }}>
            <BoarMark size={120} />
          </div>
          <h1 style={{
            fontFamily: "'Russo One', sans-serif",
            fontSize: '2rem',
            color: '#0f172a',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            margin: 0,
          }}>
            Dashboar
          </h1>
          <p className="text-slate-400 text-sm">Report viewer · Azure Blob Storage</p>
        </div>

        {/* Report types */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Report types</h2>
          </div>
          {types.map(([key, entry]) => (
            <TypeCard key={key} reportType={key} entry={entry} />
          ))}
        </div>

        {/* Browse storage */}
        {browseState === 'idle' && (
          <div className="text-center">
            <button
              onClick={() => { void loadFromStorage() }}
              className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 bg-white border border-indigo-200 hover:border-indigo-400 px-4 py-2 rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              Browse reports in storage
            </button>
          </div>
        )}

        {browseState === 'loading' && (
          <div className="bg-white rounded-2xl border border-slate-200 px-5 py-8 flex flex-col items-center gap-3 text-slate-400">
            <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Scanning storage…</span>
          </div>
        )}

        {browseState === 'done' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Storage</h2>
              {reports.length > 0 && (
                <span className="text-xs text-slate-400">{reports.length} report{reports.length !== 1 ? 's' : ''}</span>
              )}
            </div>

            {reports.length > 0 && reports.map(r => (
              <StorageReportRow key={`${r.reportType}/${r.id}`} r={r} />
            ))}

            {errors.length > 0 && (
              <div className="px-5 py-3 space-y-2 border-t border-slate-100">
                {errors.map(e => (
                  <div key={e.reportType} className="text-xs text-red-500">
                    <code className="font-mono">{e.reportType}</code>: {e.error}
                    {e.hint && <span className="text-red-400"> — {e.hint}</span>}
                  </div>
                ))}
              </div>
            )}

            {reports.length === 0 && errors.length === 0 && (
              <p className="px-5 py-6 text-sm text-slate-400 text-center">No reports found in storage.</p>
            )}
          </div>
        )}

        {/* Direct link hint */}
        <p className="text-center text-xs text-slate-400">
          Or open directly:{' '}
          <code className="font-mono bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-500">
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
