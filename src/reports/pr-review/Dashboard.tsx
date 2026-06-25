import { useState, useEffect } from 'react'
import type { PrReview, PrReviewReport } from './types'
import OverviewView from './OverviewView'
import DetailView from './DetailView'
import ReportSidebar from '../../components/ReportSidebar'
import SidebarBoarHeader from '../../components/SidebarBoarHeader'
import MobileTopBar from '../../components/MobileTopBar'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function sColor(r: string) {
  return r === 'approved' ? '#16a34a' : r === 'changes-requested' ? '#dc2626' : '#d97706'
}

function initials(n: string) {
  const p = (n || '').trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '?'
}

function authorBg(n: string) {
  const palette = ['#3b82f6','#8b5cf6','#ec4899','#06b6d4','#10b981','#f59e0b','#ef4444','#14b8a6','#f97316','#84cc16']
  if (!n) return palette[0]
  return palette[n.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % palette.length]
}

function scoreReview(r: PrReview, q: string): number {
  const lq = q.toLowerCase()
  let score = 0
  if (r.prTitle.toLowerCase().includes(lq))      score += 10
  if (String(r.prNumber) === lq)                 score += 8
  if (String(r.prNumber).startsWith(lq))         score += 5
  if (r.repository.toLowerCase().includes(lq))   score += 3
  if (r.author?.toLowerCase().includes(lq))      score += 3
  if (r.branch?.toLowerCase().includes(lq))      score += 2
  if (r.notes?.toLowerCase().includes(lq))       score += 1
  return score
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

interface SidebarProps {
  report:       PrReviewReport
  selId:        string | null
  loaded:       number
  isMobile:     boolean
  sidebarOpen:  boolean
  search:       string
  onClose:      () => void
  onSearch:     (q: string) => void
  onOverview:   () => void
  onSelectPr:   (id: string) => void
  onLoadMore:   () => void
}

function Sidebar({ report, selId, loaded, isMobile, sidebarOpen, search, onClose, onSearch, onOverview, onSelectPr, onLoadMore }: SidebarProps) {
  const allReviews = report.reviews

  const trimQ = search.trim()
  const reviews = trimQ
    ? allReviews
        .map(r => ({ r, score: scoreReview(r, trimQ) }))
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(x => x.r)
    : allReviews.slice(0, loaded)

  const showLoadMore = !trimQ && loaded < allReviews.length

  return (
    <ReportSidebar
      isMobile={isMobile}
      open={sidebarOpen}
      onClose={onClose}
      header={<SidebarBoarHeader />}
      footer={
        <div style={{ padding: '11px 16px', borderTop: '1px solid #1e293b', flexShrink: 0 }}>
          {report.generatedAt && (
            <div style={{ color: '#334155', fontSize: '11px' }}>
              Generated {new Date(report.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          )}
        </div>
      }
    >
      <div style={{ overflowY: 'auto', flex: 1, padding: '8px' }}>
        {/* Overview link */}
        <SidebarLink active={!selId} onClick={onOverview}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="1" width="5.5" height="5.5" rx="1.2" fill="#64748b"/>
            <rect x="7.5" y="1" width="5.5" height="5.5" rx="1.2" fill="#64748b"/>
            <rect x="1" y="7.5" width="5.5" height="5.5" rx="1.2" fill="#64748b"/>
            <rect x="7.5" y="7.5" width="5.5" height="5.5" rx="1.2" fill="#64748b"/>
          </svg>
          <span style={{ color: '#cbd5e1', fontSize: '12.5px', fontWeight: 500 }}>Overview</span>
        </SidebarLink>

        {/* Search */}
        <div style={{ padding: '6px 2px 2px' }}>
          <div style={{ position: 'relative' }}>
            <svg style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              width="12" height="12" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="#475569" strokeWidth="1.4"/>
              <path d="M9.5 9.5l2.5 2.5" stroke="#475569" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              placeholder="Search reviews…"
              value={search}
              onChange={e => onSearch(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '6px 26px 6px 26px',
                background: '#1e293b', border: '1px solid #334155',
                borderRadius: '6px', color: '#cbd5e1', fontSize: '11.5px',
                outline: 'none', caretColor: '#60a5fa',
              }}
            />
            {search && (
              <button
                onClick={() => onSearch('')}
                style={{ position: 'absolute', right: '7px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center', padding: 0 }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        <div style={{ padding: '10px 10px 5px', color: '#334155', fontSize: '10px', fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase' }}>
          {trimQ ? `${reviews.length} result${reviews.length !== 1 ? 's' : ''}` : 'Reviews'}
        </div>

        {reviews.map(r => (
          <SidebarPrItem
            key={r.id}
            r={r}
            active={r.id === selId}
            onClick={() => onSelectPr(r.id)}
          />
        ))}

        {showLoadMore && (
          <SidebarLoadMore onClick={onLoadMore} />
        )}
      </div>
    </ReportSidebar>
  )
}

function SidebarLink({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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
        background: active ? '#1e3a5f' : hovered ? '#1e293b' : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      {children}
    </div>
  )
}

function SidebarPrItem({ r, active, onClick }: { r: PrReview; active: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '8px 10px', borderRadius: '6px', cursor: 'pointer',
        marginBottom: '1px', userSelect: 'none',
        background: active ? '#1e3a5f' : hovered ? '#1e293b' : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: sColor(r.result), flexShrink: 0 }} />
        <span style={{ color: '#64748b', fontSize: '10px', fontFamily: 'ui-monospace,monospace' }}>#{r.prNumber}</span>
        <span style={{ color: '#334155', fontSize: '10px', marginLeft: 'auto' }}>{fmtShort(r.reviewedAt)}</span>
      </div>
      <div style={{ color: '#94a3b8', fontSize: '11px', lineHeight: 1.4, overflow: 'hidden', maxHeight: '2.8em' }}>
        {r.prTitle.length > 55 ? r.prTitle.slice(0, 53) + '…' : r.prTitle}
      </div>
    </div>
  )
}

function SidebarLoadMore({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '9px', textAlign: 'center', color: '#3b82f6',
        fontSize: '11.5px', fontWeight: 500, cursor: 'pointer',
        borderRadius: '6px', marginTop: '4px', userSelect: 'none',
        background: hovered ? '#1e293b' : 'transparent', transition: 'background 0.1s',
      }}
    >
      Load more reviews
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  data:     unknown
  reportId: string
}

export default function Dashboard({ data, reportId }: Props) {
  const report = data as PrReviewReport

  const [selId,       setSelId]       = useState<string | null>(null)
  const [loaded,      setLoaded]      = useState(10)
  const [isMobile,    setIsMobile]    = useState(window.innerWidth < 768)
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768)
  const [search,      setSearch]      = useState('')

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

  const selectedPr = selId ? (report.reviews.find(r => r.id === selId) ?? null) : null

  const handleSelectPr = (id: string) => {
    setSelId(id)
    if (isMobile) setSidebarOpen(false)
  }

  const handleBack = () => {
    setSelId(null)
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: '#f8fafc' }}>
      <Sidebar
        report={report}
        selId={selId}
        loaded={loaded}
        isMobile={isMobile}
        sidebarOpen={sidebarOpen}
        search={search}
        onClose={() => setSidebarOpen(false)}
        onSearch={setSearch}
        onOverview={() => { setSelId(null); if (isMobile) setSidebarOpen(false) }}
        onSelectPr={handleSelectPr}
        onLoadMore={() => setLoaded(l => l + 10)}
      />

      <main style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
        {isMobile && <MobileTopBar title="PR Review Agent" onToggle={() => setSidebarOpen(s => !s)} />}

        {selectedPr ? (
          <DetailView pr={selectedPr} onBack={handleBack} />
        ) : (
          <OverviewView
            report={report}
            reportId={reportId}
            authorBg={authorBg}
            initials={initials}
            onSelectPr={pr => handleSelectPr(pr.id)}
          />
        )}
      </main>
    </div>
  )
}
