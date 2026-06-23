import { useState, useEffect } from 'react'
import type { PlaywrightTraceReport, TestRun, RunStatus } from './types'
import type { ReportProps } from '../index'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMs(ms: number) {
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

// ── Status config ─────────────────────────────────────────────────────────────

function statusCfg(s: RunStatus) {
  if (s === 'passed') return { color: '#4ade80', label: 'passed',  dot: '#22c55e' }
  if (s === 'failed') return { color: '#f87171', label: 'failed',  dot: '#ef4444' }
  return                     { color: '#fbbf24', label: 'flaky',   dot: '#f59e0b' }
}

// ── Run row ───────────────────────────────────────────────────────────────────

function RunRow({ run, selected, onClick }: { run: TestRun; selected: boolean; onClick: () => void }) {
  const st = statusCfg(run.status)
  const passRate = (run.totalTests && run.totalTests > 0)
    ? `${run.passedTests ?? 0}/${run.totalTests}`
    : null

  return (
    <button
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '11px 16px', border: 'none', cursor: 'pointer',
        background: selected ? '#1e3a5f' : 'transparent',
        borderLeft: `3px solid ${selected ? '#3b82f6' : 'transparent'}`,
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = '#1e293b' }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        {/* Status dot */}
        <div style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: st.dot, flexShrink: 0, marginTop: '5px',
        }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Suite name */}
          <div style={{
            fontSize: '13px', fontWeight: 600, lineHeight: 1.35,
            color: selected ? '#f1f5f9' : '#cbd5e1',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {run.suiteName}
          </div>

          {/* Meta row */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              {fmtDate(run.timestamp)} {fmtTime(run.timestamp)}
            </span>
            {run.duration != null && (
              <span style={{ fontSize: '11px', color: '#475569' }}>· {fmtMs(run.duration)}</span>
            )}
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
            {passRate && (
              <span style={{
                fontSize: '10px', fontWeight: 600, color: st.color,
                background: st.color + '20', borderRadius: '4px', padding: '1px 5px',
              }}>
                {passRate}
              </span>
            )}
            {run.browser && (
              <span style={{ fontSize: '10px', color: '#475569', fontFamily: 'ui-monospace,monospace' }}>
                {run.browser}
              </span>
            )}
            {run.project && (
              <span style={{ fontSize: '10px', color: '#334155', background: '#1e293b', borderRadius: '4px', padding: '1px 5px', fontFamily: 'ui-monospace,monospace' }}>
                {run.project}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

interface SidebarProps {
  report:      PlaywrightTraceReport
  reportId:    string
  selId:       string | null
  isMobile:    boolean
  sidebarOpen: boolean
  onSelect:    (id: string) => void
}

function Sidebar({ report, reportId, selId, isMobile, sidebarOpen, onSelect }: SidebarProps) {
  const [search, setSearch] = useState('')

  const filtered = search.trim()
    ? report.runs.filter(r => r.suiteName.toLowerCase().includes(search.toLowerCase()) ||
        r.project?.toLowerCase().includes(search.toLowerCase()) ||
        r.browser?.toLowerCase().includes(search.toLowerCase()))
    : report.runs

  const passed = report.runs.filter(r => r.status === 'passed').length
  const failed = report.runs.filter(r => r.status === 'failed').length
  const flaky  = report.runs.filter(r => r.status === 'flaky').length

  if (isMobile && !sidebarOpen) return null

  return (
    <aside style={{
      width: '280px', flexShrink: 0,
      background: '#0f172a',
      borderRight: '1px solid #1e293b',
      display: 'flex', flexDirection: 'column',
      height: '100vh',
      position: isMobile ? 'fixed' : 'relative',
      top: 0, left: 0, bottom: 0,
      zIndex: isMobile ? 50 : 'auto',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
        <div style={{ fontSize: '10px', color: '#475569', fontFamily: 'ui-monospace,monospace', marginBottom: '4px' }}>
          {reportId}
        </div>
        <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9', marginBottom: '10px' }}>
          {report.title ?? 'Playwright Test Runs'}
        </div>

        {/* Status summary pills */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {passed > 0 && (
            <span style={{ fontSize: '10px', fontWeight: 600, color: '#4ade80', background: '#4ade8018', borderRadius: '4px', padding: '2px 7px' }}>
              ✓ {passed} passed
            </span>
          )}
          {failed > 0 && (
            <span style={{ fontSize: '10px', fontWeight: 600, color: '#f87171', background: '#f8717118', borderRadius: '4px', padding: '2px 7px' }}>
              ✗ {failed} failed
            </span>
          )}
          {flaky > 0 && (
            <span style={{ fontSize: '10px', fontWeight: 600, color: '#fbbf24', background: '#fbbf2418', borderRadius: '4px', padding: '2px 7px' }}>
              ~ {flaky} flaky
            </span>
          )}
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <svg
            style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: '#475569', pointerEvents: 'none' }}
            width="13" height="13" viewBox="0 0 20 20" fill="currentColor"
          >
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
          <input
            type="search"
            placeholder="Filter runs…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: '#1e293b', border: '1px solid #334155',
              borderRadius: '7px', padding: '6px 10px 6px 28px',
              fontSize: '12px', color: '#e2e8f0',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Run list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '20px 16px', fontSize: '12px', color: '#475569', textAlign: 'center' }}>
            No runs match your filter.
          </div>
        ) : (
          filtered.map(run => (
            <RunRow
              key={run.id}
              run={run}
              selected={run.id === selId}
              onClick={() => onSelect(run.id)}
            />
          ))
        )}
      </div>
    </aside>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ runCount }: { runCount: number }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#f8fafc', color: '#94a3b8', textAlign: 'center', padding: '40px',
    }}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" style={{ marginBottom: '16px', opacity: 0.4 }}>
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"/>
        <rect x="9" y="3" width="6" height="4" rx="1" stroke="#64748b" strokeWidth="1.5"/>
        <path d="M9 12h6M9 16h4" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      <div style={{ fontSize: '15px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
        Select a test run
      </div>
      <div style={{ fontSize: '13px', color: '#94a3b8', maxWidth: '280px', lineHeight: 1.5 }}>
        Choose one of the {runCount} run{runCount !== 1 ? 's' : ''} in the sidebar to open its Playwright trace in the viewer.
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Dashboard({ data, reportId }: ReportProps) {
  const report = data as PlaywrightTraceReport

  const [selId,       setSelId]       = useState<string | null>(null)
  const [isMobile,    setIsMobile]    = useState(() => window.innerWidth < 768)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handle)
    return () => window.removeEventListener('resize', handle)
  }, [])

  const selRun = report.runs.find(r => r.id === selId) ?? null

  const traceViewerUrl = selRun
    ? `https://trace.playwright.dev/?trace=${encodeURIComponent(
        `${window.location.origin}/api/get-trace?id=${encodeURIComponent(selRun.traceId)}&report=playwright-trace`
      )}`
    : null

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        report={report}
        reportId={reportId}
        selId={selId}
        isMobile={isMobile}
        sidebarOpen={sidebarOpen}
        onSelect={id => { setSelId(id); if (isMobile) setSidebarOpen(false) }}
      />

      {/* Main panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        {/* Mobile hamburger */}
        {isMobile && !sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            style={{
              position: 'absolute', top: '12px', left: '12px', zIndex: 30,
              width: '36px', height: '36px', borderRadius: '8px',
              background: '#0f172a', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="#94a3b8">
              <path fillRule="evenodd" d="M3 5h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2z" clipRule="evenodd"/>
            </svg>
          </button>
        )}

        {traceViewerUrl ? (
          <iframe
            key={selId}
            src={traceViewerUrl}
            style={{ flex: 1, width: '100%', height: '100%', border: 'none', display: 'block' }}
            allow="clipboard-read; clipboard-write"
            allowFullScreen
            title={selRun!.suiteName}
          />
        ) : (
          <EmptyState runCount={report.runs.length} />
        )}
      </div>
    </div>
  )
}
