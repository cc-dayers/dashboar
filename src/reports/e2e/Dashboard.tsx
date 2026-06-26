import { useState, useEffect } from 'react'
import type { E2eAggregateReport, E2eRunEntry } from './types'
import type { ReportProps } from '../index'
import OverviewView, { runLabel, runStatusColor } from './OverviewView'
import RunDetailView from './RunDetailView'
import ReportSidebar from '../../components/ReportSidebar'
import SidebarBoarHeader from '../../components/SidebarBoarHeader'
import MobileTopBar from '../../components/MobileTopBar'

// ── Helpers ───────────────────────────────────────────────────────────────────

// Stable key for a run entry: prefer reportBlobPath (unique per run), else positional
function runKey(r: E2eRunEntry, idx: number): string {
  return r.reportBlobPath ?? `run-${idx}`
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function OverviewLink({ active, onClick }: { active: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '8px 10px', borderRadius: '6px', cursor: 'pointer',
        marginBottom: '2px', userSelect: 'none',
        background: active ? 'var(--color-accent-surface)' : hovered ? 'var(--color-sidebar-raised)' : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ color: 'var(--color-sidebar-muted)' }}>
        <rect x="1" y="1" width="5.5" height="5.5" rx="1.2" fill="currentColor"/>
        <rect x="7.5" y="1" width="5.5" height="5.5" rx="1.2" fill="currentColor"/>
        <rect x="1" y="7.5" width="5.5" height="5.5" rx="1.2" fill="currentColor"/>
        <rect x="7.5" y="7.5" width="5.5" height="5.5" rx="1.2" fill="currentColor"/>
      </svg>
      <span style={{ color: 'var(--color-sidebar-foreground)', fontSize: '12.5px', fontWeight: 500 }}>Overview</span>
    </div>
  )
}

function RunRow({ run, selected, onClick }: { run: E2eRunEntry; selected: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  const label      = runLabel(run)
  const failCount  = run.summary?.failed ?? 0
  const total      = run.summary?.total ?? run.testCount ?? 0

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '8px 10px', borderRadius: '6px', cursor: 'pointer',
        marginBottom: '1px', userSelect: 'none',
        background: selected ? 'var(--color-accent-surface)' : hovered ? 'var(--color-sidebar-raised)' : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: runStatusColor(run.result ?? run.status), flexShrink: 0 }} />
        {run.matrixLabel && (
          <span style={{ color: 'var(--color-sidebar-muted)', fontSize: '10px', fontFamily: 'ui-monospace,monospace' }}>
            {run.matrixLabel}
          </span>
        )}
        {failCount > 0 && (
          <span style={{ fontSize: '10px', color: '#f87171', marginLeft: 'auto' }}>{failCount} failed</span>
        )}
        {failCount === 0 && total > 0 && (
          <span style={{ fontSize: '10px', color: 'var(--color-sidebar-secondary)', marginLeft: 'auto' }}>{total} tests</span>
        )}
      </div>
      <div style={{
        color: 'var(--color-sidebar-secondary)', fontSize: '11px', lineHeight: 1.4,
        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
      }}>
        {label}
      </div>
      {run.branch && (
        <div style={{ color: 'var(--color-sidebar-muted)', fontSize: '10px', fontFamily: 'ui-monospace,monospace', marginTop: '2px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {run.branch}
        </div>
      )}
    </div>
  )
}

interface SidebarProps {
  report:        E2eAggregateReport
  selKey:        string | null
  isMobile:      boolean
  sidebarOpen:   boolean
  search:        string
  statusFilter:  'failed' | 'passed' | null
  onClose:       () => void
  onSearch:      (q: string) => void
  onStatusFilter: (f: 'failed' | 'passed' | null) => void
  onOverview:    () => void
  onSelect:      (key: string) => void
}

function Sidebar({ report, selKey, isMobile, sidebarOpen, search, statusFilter, onClose, onSearch, onStatusFilter, onOverview, onSelect }: SidebarProps) {
  const runs = report.reviews ?? report.runs ?? []
  const trimQ = search.trim().toLowerCase()

  const eff = (r: typeof runs[0]) => r.result ?? r.status
  const isUnhealthy = (r: typeof runs[0]) => { const e = eff(r); return e === 'failed' || e === 'succeeded_with_issues' || e === 'timedout' }
  const isHealthy   = (r: typeof runs[0]) => { const e = eff(r); return e === 'passed' || e === 'succeeded' }

  const failed = runs.filter(isUnhealthy).length
  const passed = runs.filter(isHealthy).length

  const filtered = runs.filter(r => {
    if (statusFilter === 'failed' && !isUnhealthy(r)) return false
    if (statusFilter === 'passed' && !isHealthy(r))   return false
    if (!trimQ) return true
    return (
      runLabel(r).toLowerCase().includes(trimQ) ||
      r.branch?.toLowerCase().includes(trimQ) ||
      r.commit?.toLowerCase().includes(trimQ) ||
      r.matrixLabel?.toLowerCase().includes(trimQ) ||
      r.buildNumber?.toLowerCase().includes(trimQ)
    )
  })

  return (
    <ReportSidebar
      isMobile={isMobile}
      open={sidebarOpen}
      onClose={onClose}
      header={<SidebarBoarHeader />}
    >
      <div style={{ padding: '8px 8px 0', flexShrink: 0 }}>
        <OverviewLink active={!selKey} onClick={onOverview} />

        {/* Status pills — clickable to filter */}
        {(failed > 0 || passed > 0) && (
          <div style={{ padding: '4px 10px 2px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {failed > 0 && (
              <button
                onClick={() => onStatusFilter(statusFilter === 'failed' ? null : 'failed')}
                style={{
                  fontSize: '10px', fontWeight: 600, cursor: 'pointer', border: 'none',
                  color: '#f87171', borderRadius: '4px', padding: '2px 7px',
                  background: statusFilter === 'failed' ? '#f8717140' : '#f8717118',
                  outline: statusFilter === 'failed' ? '1.5px solid #f87171' : 'none',
                  transition: 'background 0.1s',
                }}
              >
                ✗ {failed} failed
              </button>
            )}
            {passed > 0 && (
              <button
                onClick={() => onStatusFilter(statusFilter === 'passed' ? null : 'passed')}
                style={{
                  fontSize: '10px', fontWeight: 600, cursor: 'pointer', border: 'none',
                  color: '#4ade80', borderRadius: '4px', padding: '2px 7px',
                  background: statusFilter === 'passed' ? '#4ade8040' : '#4ade8018',
                  outline: statusFilter === 'passed' ? '1.5px solid #4ade80' : 'none',
                  transition: 'background 0.1s',
                }}
              >
                ✓ {passed} passed
              </button>
            )}
          </div>
        )}

        {/* Search */}
        <div style={{ padding: '6px 2px 2px' }}>
          <div style={{ position: 'relative' }}>
            <svg style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--color-sidebar-muted)' }}
              width="12" height="12" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M9.5 9.5l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              placeholder="Filter runs…"
              value={search}
              onChange={e => onSearch(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '6px 26px 6px 26px',
                background: 'var(--color-sidebar-raised)', border: '1px solid var(--color-sidebar-border)',
                borderRadius: '6px', color: 'var(--color-sidebar-foreground)', fontSize: '11.5px',
                outline: 'none', caretColor: 'var(--color-accent)',
              }}
            />
            {search && (
              <button
                onClick={() => onSearch('')}
                style={{ position: 'absolute', right: '7px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-sidebar-muted)', display: 'flex', alignItems: 'center', padding: 0 }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        <div style={{ padding: '10px 10px 5px', color: 'var(--color-sidebar-secondary)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase' }}>
          {(trimQ || statusFilter) ? `${filtered.length} of ${runs.length}` : `${runs.length} Run${runs.length !== 1 ? 's' : ''}`}
        </div>
      </div>

      <div style={{ overflowY: 'auto', flex: 1, padding: '0 8px 8px' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '16px', fontSize: '12px', color: 'var(--color-sidebar-muted)', textAlign: 'center' }}>
            No runs match your filter.
          </div>
        ) : (
          filtered.map((r, i) => {
            const key = runKey(r, i)
            return (
              <RunRow
                key={key}
                run={r}
                selected={key === selKey}
                onClick={() => onSelect(key)}
              />
            )
          })
        )}
      </div>
    </ReportSidebar>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Dashboard({ data }: ReportProps) {
  const report = data as E2eAggregateReport
  const allRuns = report.reviews ?? report.runs ?? []
  const reportType = new URLSearchParams(window.location.search).get('report') ?? 'e2e-aggregate'

  const [selKey,        setSelKey]        = useState<string | null>(null)
  const [isMobile,      setIsMobile]      = useState(() => window.innerWidth < 768)
  const [sidebarOpen,   setSidebarOpen]   = useState(() => window.innerWidth >= 768)
  const [search,        setSearch]        = useState('')
  const [statusFilter,  setStatusFilter]  = useState<'failed' | 'passed' | null>(null)

  useEffect(() => {
    const onResize = () => {
      const m = window.innerWidth < 768
      setIsMobile(m)
      if (m) setSidebarOpen(false)
      else   setSidebarOpen(true)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const handleSelect = (key: string) => {
    setSelKey(key)
    if (isMobile) setSidebarOpen(false)
  }

  const handleOverview = () => {
    setSelKey(null)
    if (isMobile) setSidebarOpen(false)
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: 'var(--color-background)' }}>
      <Sidebar
        report={report}
        selKey={selKey}
        isMobile={isMobile}
        sidebarOpen={sidebarOpen}
        search={search}
        statusFilter={statusFilter}
        onClose={() => setSidebarOpen(false)}
        onSearch={setSearch}
        onStatusFilter={setStatusFilter}
        onOverview={handleOverview}
        onSelect={handleSelect}
      />

      <main style={{ flex: 1, overflow: 'hidden', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {isMobile && (
          <MobileTopBar
            title={allRuns.length ? `E2E · ${allRuns.length} runs` : 'E2E Tests'}
            onToggle={() => setSidebarOpen(s => !s)}
          />
        )}

        {selKey ? (
          <RunDetailView
            run={allRuns.find((r, i) => runKey(r, i) === selKey)!}
            reportType={reportType}
            onBack={handleOverview}
          />
        ) : (
          <OverviewView
            report={report}
            onSelect={handleSelect}
            runKeys={runKey}
          />
        )}
      </main>
    </div>
  )
}
