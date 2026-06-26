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
        padding: '8px 10px 8px 7px', borderRadius: '6px', cursor: 'pointer',
        marginBottom: '2px', userSelect: 'none',
        background: active || hovered ? 'var(--color-sidebar-raised)' : 'transparent',
        borderLeft: active ? '3px solid var(--color-accent)' : '3px solid transparent',
        transition: 'background 0.1s, border-color 0.1s',
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
  const label    = runLabel(run)
  const eff      = run.result ?? run.status
  const dotColor = runStatusColor(eff)
  const isPass   = eff === 'passed' || eff === 'succeeded'
  const s        = run.summary
  const skipped  = Math.max(0, (s?.total ?? 0) - (s?.passed ?? 0) - (s?.failed ?? 0) - (s?.flaky ?? 0))
  const browser  = run.matrixLabel
    ? (run.matrixLabel.includes('·') ? run.matrixLabel.split('·')[0].trim() : run.matrixLabel.trim())
    : null
  const active = selected || hovered

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '8px 10px 8px 10px',
        borderRadius: '7px', cursor: 'pointer',
        marginBottom: '3px', userSelect: 'none',
        borderTop:    `1px solid ${active ? `${dotColor}60` : `${dotColor}28`}`,
        borderRight:  `1px solid ${active ? `${dotColor}60` : `${dotColor}28`}`,
        borderBottom: `1px solid ${active ? `${dotColor}60` : `${dotColor}28`}`,
        borderLeft:   `3px solid ${dotColor}`,
        background:   active ? `${dotColor}18` : `${dotColor}09`,
        transition: 'border-color 0.1s, background 0.1s',
      }}
    >
      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-sidebar-foreground)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', marginBottom: '2px' }}>
        {label}
      </div>
      {browser && (
        <div style={{ fontSize: '10px', color: 'var(--color-sidebar-muted)', fontFamily: 'ui-monospace,monospace', marginBottom: s && s.total > 0 ? '5px' : '0', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {browser}
        </div>
      )}
      {s && s.total > 0 && (
        <>
          <div style={{ display: 'flex', height: 4, borderRadius: '3px', overflow: 'hidden', background: 'var(--color-sidebar-raised)', marginBottom: '4px' }}>
            {s.passed  > 0 && <div style={{ flex: s.passed,  background: '#22c55e' }} />}
            {s.failed  > 0 && <div style={{ flex: s.failed,  background: '#ef4444' }} />}
            {s.flaky   > 0 && <div style={{ flex: s.flaky,   background: '#f59e0b' }} />}
            {skipped   > 0 && <div style={{ flex: skipped,   background: '#94a3b8' }} />}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--color-sidebar-secondary)', fontVariantNumeric: 'tabular-nums' }}>
            <span style={{ color: isPass ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{s.passed}</span>
            <span>/{s.total}</span>
            {(s.failed ?? 0) > 0 && <span style={{ color: '#ef4444', marginLeft: '4px' }}> · {s.failed}✗</span>}
            {(s.flaky  ?? 0) > 0 && <span style={{ color: '#f59e0b', marginLeft: '4px' }}> · {s.flaky}~</span>}
          </div>
        </>
      )}
      {run.branch && (
        <div style={{ color: 'var(--color-sidebar-muted)', fontSize: '10px', fontFamily: 'ui-monospace,monospace', marginTop: '3px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
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
                  color: 'var(--color-sidebar-danger)', borderRadius: '4px', padding: '2px 7px',
                  background: statusFilter === 'failed' ? '#ef444430' : '#ef444415',
                  outline: statusFilter === 'failed' ? '1.5px solid var(--color-sidebar-danger)' : 'none',
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
                  color: 'var(--color-sidebar-success)', borderRadius: '4px', padding: '2px 7px',
                  background: statusFilter === 'passed' ? '#22c55e30' : '#22c55e15',
                  outline: statusFilter === 'passed' ? '1.5px solid var(--color-sidebar-success)' : 'none',
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

  const [selKey,       setSelKey]       = useState<string | null>(null)
  // lastSelKey persists the last viewed run so RunDetailView stays mounted
  // (and its iframe stays loaded) when the user navigates back to the overview.
  const [lastSelKey,   setLastSelKey]   = useState<string | null>(null)
  const [isMobile,     setIsMobile]     = useState(() => window.innerWidth < 768)
  const [sidebarOpen,  setSidebarOpen]  = useState(() => window.innerWidth >= 768)
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState<'failed' | 'passed' | null>(null)

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
    setLastSelKey(key)
    if (isMobile) setSidebarOpen(false)
  }

  const handleOverview = () => {
    setSelKey(null)
    // lastSelKey intentionally not cleared — keeps RunDetailView mounted
    if (isMobile) setSidebarOpen(false)
  }

  // The run we keep rendered (may differ from selKey when on overview)
  const viewKey = selKey ?? lastSelKey
  const viewRun = viewKey ? allRuns.find((r, i) => runKey(r, i) === viewKey) ?? null : null

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

        {/* Both panels stay mounted; CSS visibility swaps them without unmounting. */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {/* Detail view — hidden (but alive) when on overview */}
          {viewRun && (
            <div style={{
              position: 'absolute', inset: 0,
              visibility: selKey ? 'visible' : 'hidden',
              pointerEvents: selKey ? 'auto' : 'none',
            }}>
              <RunDetailView
                run={viewRun}
                reportType={reportType}
                onBack={handleOverview}
              />
            </div>
          )}

          {/* Overview — hidden when a run is selected */}
          <div style={{
            position: 'absolute', inset: 0,
            visibility: selKey ? 'hidden' : 'visible',
            pointerEvents: selKey ? 'none' : 'auto',
          }}>
            <OverviewView report={report} />
          </div>
        </div>
      </main>
    </div>
  )
}
