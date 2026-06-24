import { Suspense, useEffect, useState, type ReactNode } from 'react'
import { registry, DEFAULT_TYPE } from './reports'
import LandingPage from './components/LandingPage'
import AuthGate from './components/AuthGate'
import { validateAgainstSchema, type ValidationResult } from './lib/validateSchema'
import { resolveSchemaVersion, isSupportedVersion } from './lib/schemaVersion'

// ── Loading / error screens ───────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm text-slate-500">Loading report…</p>
      </div>
    </div>
  )
}

function ErrorScreen({ id, message }: { id: string; message: string }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-8 max-w-md w-full text-center">
        <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Failed to load report</h2>
        <p className="text-slate-500 text-sm mb-3">
          ID: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-mono text-xs">{id}</code>
        </p>
        <p className="text-sm text-red-500">{message}</p>
      </div>
    </div>
  )
}

function UnknownTypeScreen({ type }: { type: string }) {
  const available = Object.keys(registry)
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-8 max-w-md w-full text-center">
        <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Unknown report type</h2>
        <p className="text-slate-500 text-sm mb-3">
          <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-mono text-xs">
            ?report={type}
          </code>
        </p>
        <p className="text-sm text-slate-400">
          Available: {available.map(t => (
            <code key={t} className="mx-0.5 bg-slate-100 px-1 py-0.5 rounded font-mono text-xs text-slate-600">{t}</code>
          ))}
        </p>
      </div>
    </div>
  )
}

// ── Schema version banner ─────────────────────────────────────────────────────

function VersionBanner({ version, onDismiss }: { version: string; onDismiss: () => void }) {
  return (
    <div style={{
      position: 'fixed', top: '16px', right: '16px', zIndex: 9999,
      maxWidth: '420px', width: 'calc(100vw - 32px)',
      background: '#eff6ff', border: '1px solid #bfdbfe',
      borderRadius: '10px', boxShadow: '0 4px 16px rgba(0,0,0,.1)',
      fontSize: '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px' }}>
        <svg style={{ flexShrink: 0, marginTop: '1px', color: '#3b82f6' }} width="15" height="15" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
        <div style={{ flex: 1, minWidth: 0, color: '#1e40af' }}>
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>Unsupported schema version</div>
          <div style={{ color: '#3b82f6', marginBottom: '3px' }}>
            This report uses{' '}
            <code style={{ fontFamily: 'ui-monospace,monospace', fontSize: '11px' }}>schemaVersion: &quot;{version}&quot;</code>,
            which this dashboard does not yet support.
          </div>
          <div style={{ color: '#60a5fa' }}>
            The report will render using the closest known schema. Some fields may be missing or displayed incorrectly.
            Update the dashboard to add support for v{version}.
          </div>
        </div>
        <button
          onClick={onDismiss}
          style={{ flexShrink: 0, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}
          aria-label="Dismiss"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

// ── Schema validation banner ──────────────────────────────────────────────────

function SchemaBanner({ result, onDismiss }: { result: ValidationResult; onDismiss: () => void }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{
      position: 'fixed', bottom: '16px', right: '16px', zIndex: 9999,
      maxWidth: '400px', width: 'calc(100vw - 32px)',
      background: '#fffbeb', border: '1px solid #fcd34d',
      borderRadius: '10px', boxShadow: '0 4px 16px rgba(0,0,0,.12)',
      fontSize: '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px' }}>
        <svg style={{ flexShrink: 0, marginTop: '1px', color: '#d97706' }} width="15" height="15" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: '#92400e', marginBottom: '2px' }}>
            Schema mismatch — {result.errors.length} issue{result.errors.length !== 1 ? 's' : ''}
          </div>
          <div style={{ color: '#b45309' }}>
            Report data doesn't fully match its schema. The view may still work.
          </div>
          {expanded && (
            <ul style={{ marginTop: '8px', paddingLeft: '12px', color: '#78350f', lineHeight: 1.6 }}>
              {result.errors.map((e, i) => <li key={i} style={{ fontFamily: 'ui-monospace,monospace', fontSize: '11px' }}>{e}</li>)}
            </ul>
          )}
          <button
            onClick={() => setExpanded(x => !x)}
            style={{ marginTop: '6px', color: '#d97706', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '11.5px' }}
          >
            {expanded ? 'Hide details' : 'Show details'}
          </button>
        </div>
        <button
          onClick={onDismiss}
          style={{ flexShrink: 0, color: '#d97706', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}
          aria-label="Dismiss"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

// ── Main app ──────────────────────────────────────────────────────────────────

export default function App() {
  const params      = new URLSearchParams(window.location.search)
  const hasReport   = params.has('report')
  const idParam     = params.get('id') ?? params.get('reportId')  // null when not in URL
  const id          = idParam ?? 'report'
  const reportType  = params.get('report') ?? DEFAULT_TYPE
  const storagePath = params.get('path')
  const fixture     = params.get('_fixture')

  const entry = registry[reportType]

  const [data,            setData]           = useState<unknown>(null)
  const [loading,         setLoading]        = useState(false)
  const [error,           setError]          = useState<string | null>(null)
  const [validation,      setValidation]     = useState<ValidationResult | null>(null)
  const [dismissed,       setDismissed]      = useState(false)
  const [unknownVersion,  setUnknownVersion] = useState<string | null>(null)
  const [verDismissed,    setVerDismissed]   = useState(false)

  useEffect(() => {
    if (!id || !entry) return

    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      setValidation(null)
      setDismissed(false)
      setUnknownVersion(null)
      setVerDismissed(false)

      try {
        const blobUrl = `/api/get-blob?report=${encodeURIComponent(reportType)}${storagePath ? `&path=${encodeURIComponent(storagePath)}` : ''}${idParam != null ? `&id=${encodeURIComponent(idParam)}` : ''}${fixture ? `&_fixture=${encodeURIComponent(fixture)}` : ''}`
        const res  = await fetch(blobUrl)
        const json = await res.json()
        if (!res.ok) throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`)
        if (cancelled) return

        setData(json)

        // Resolve schema version from the payload
        const resolved = resolveSchemaVersion(json)
        if (!isSupportedVersion(resolved.version)) {
          setUnknownVersion(resolved.version)
        }

        // Load the versioned schema for validation (served as a static asset from public/)
        // Only validate if we have a schema registered for the resolved version.
        // Skip for unknown future versions — we can't validate against an unknown schema.
        const schemaUrl = isSupportedVersion(resolved.version)
          ? entry.schemaVersions?.[resolved.version]
          : null
        if (schemaUrl) {
          const schemaRes = await fetch(schemaUrl)
          if (!cancelled && schemaRes.ok) {
            const schema = await schemaRes.json()
            const result = validateAgainstSchema(json, schema)
            if (!result.valid) setValidation(result)
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unexpected error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [idParam, reportType, storagePath, fixture, entry])

  let content: ReactNode

  if (!hasReport) {
    content = <LandingPage />
  } else if (!entry) {
    content = <UnknownTypeScreen type={reportType} />
  } else if (loading) {
    content = <LoadingScreen />
  } else if (error) {
    content = <ErrorScreen id={id} message={error} />
  } else if (!data) {
    content = null
  } else {
    const Dashboard = entry.component
    content = (
      <div style={{ height: '100vh', overflow: 'hidden' }}>
        <Suspense fallback={<LoadingScreen />}>
          <Dashboard data={data} reportId={id} />
        </Suspense>
        {unknownVersion && !verDismissed && (
          <VersionBanner version={unknownVersion} onDismiss={() => setVerDismissed(true)} />
        )}
        {validation && !dismissed && (
          <SchemaBanner result={validation} onDismiss={() => setDismissed(true)} />
        )}
      </div>
    )
  }

  return <AuthGate>{content}</AuthGate>
}
