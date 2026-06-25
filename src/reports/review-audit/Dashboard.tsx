import { useState, useEffect } from 'react'
import type { AuditReview, ReviewAuditReport } from './types'
import OverviewView from './OverviewView'
import DetailView from './DetailView'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtShort(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function sColor(r: string) {
  return r === 'approved' ? '#16a34a' : r === 'changes-requested' ? '#dc2626' : '#d97706'
}

function scoreReview(r: AuditReview, q: string): number {
  const lq = q.toLowerCase()
  let score = 0
  if (r.prTitle.toLowerCase().includes(lq))    score += 10
  if (String(r.prNumber) === lq)               score += 8
  if (String(r.prNumber).startsWith(lq))       score += 5
  if (r.repository.toLowerCase().includes(lq)) score += 3
  if (r.repoSlug?.toLowerCase().includes(lq))  score += 2
  if (r.branch?.toLowerCase().includes(lq))    score += 2
  return score
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function SidebarItem({ r, active, onClick }: { r: AuditReview; active: boolean; onClick: () => void }) {
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
        {r.findingCount > 0 && (
          <span style={{ marginLeft: '2px', fontSize: '10px', color: '#94a3b8' }}>·{r.findingCount}f</span>
        )}
        <span style={{ color: '#334155', fontSize: '10px', marginLeft: 'auto' }}>{fmtShort(r.reviewedAt)}</span>
      </div>
      <div style={{ color: '#94a3b8', fontSize: '11px', lineHeight: 1.4, overflow: 'hidden', maxHeight: '2.8em' }}>
        {r.prTitle.length > 55 ? r.prTitle.slice(0, 53) + '…' : r.prTitle}
      </div>
    </div>
  )
}

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
        background: active ? '#1e3a5f' : hovered ? '#1e293b' : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
        <rect x="1" y="1" width="5.5" height="5.5" rx="1.2" fill="#64748b"/>
        <rect x="7.5" y="1" width="5.5" height="5.5" rx="1.2" fill="#64748b"/>
        <rect x="1" y="7.5" width="5.5" height="5.5" rx="1.2" fill="#64748b"/>
        <rect x="7.5" y="7.5" width="5.5" height="5.5" rx="1.2" fill="#64748b"/>
      </svg>
      <span style={{ color: '#cbd5e1', fontSize: '12.5px', fontWeight: 500 }}>Overview</span>
    </div>
  )
}

interface SidebarProps {
  report:      ReviewAuditReport
  selId:       string | null
  loaded:      number
  isMobile:    boolean
  sidebarOpen: boolean
  search:      string
  onSearch:    (q: string) => void
  onOverview:  () => void
  onSelect:    (id: string) => void
  onLoadMore:  () => void
}

function Sidebar({ report, selId, loaded, isMobile, sidebarOpen, search, onSearch, onOverview, onSelect, onLoadMore }: SidebarProps) {
  const closed = isMobile && !sidebarOpen
  const trimQ  = search.trim()

  const reviews = trimQ
    ? report.reviews
        .map(r => ({ r, score: scoreReview(r, trimQ) }))
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(x => x.r)
    : report.reviews.slice(0, loaded)

  const showLoadMore = !trimQ && loaded < report.reviews.length

  return (
    <aside style={{
      background:    '#0f172a',
      display:       'flex',
      flexDirection: 'column',
      width:         '280px',
      borderRight:   '1px solid #1e293b',
      flexShrink:    0,
      position:      isMobile ? 'fixed' : 'relative',
      top:           isMobile ? 0 : 'auto',
      bottom:        isMobile ? 0 : 'auto',
      left:          isMobile ? 0 : 'auto',
      zIndex:        isMobile ? 100 : 1,
      transform:     closed ? 'translateX(-100%)' : 'translateX(0)',
      transition:    'transform 0.22s ease',
    }}>
      {/* Header */}
      <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px', flexShrink: 0, borderRadius: '8px',
            background: 'linear-gradient(135deg,#4f46e5,#818cf8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 4h10M3 8h7M3 12h9" stroke="rgba(255,255,255,.9)" strokeWidth="1.4" strokeLinecap="round"/>
              <circle cx="12.5" cy="11.5" r="2.5" fill="rgba(255,255,255,.2)" stroke="rgba(255,255,255,.9)" strokeWidth="1.1"/>
              <path d="M11.5 11.5l.7.7 1.3-1.3" stroke="rgba(255,255,255,.9)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '13px', lineHeight: 1.2 }}>Review Audit</div>
            <div style={{ color: '#475569', fontSize: '11px', marginTop: '2px' }}>{report.period ?? report.schemaVersion}</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '8px' }}>
        <OverviewLink active={!selId} onClick={onOverview} />

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
                outline: 'none', caretColor: '#818cf8',
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
          {trimQ ? `${reviews.length} result${reviews.length !== 1 ? 's' : ''}` : `${report.reviews.length} Reviews`}
        </div>

        {reviews.map(r => (
          <SidebarItem key={r.id} r={r} active={r.id === selId} onClick={() => onSelect(r.id)} />
        ))}

        {showLoadMore && (
          <div
            onClick={onLoadMore}
            style={{
              padding: '9px', textAlign: 'center', color: '#818cf8',
              fontSize: '11.5px', fontWeight: 500, cursor: 'pointer',
              borderRadius: '6px', marginTop: '4px', userSelect: 'none',
            }}
          >
            Load more reviews
          </div>
        )}
      </div>

      {/* Footer */}
      {report.generatedAt && (
        <div style={{ padding: '11px 16px', borderTop: '1px solid #1e293b', flexShrink: 0 }}>
          <div style={{ color: '#334155', fontSize: '11px' }}>
            Generated {new Date(report.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
      )}
    </aside>
  )
}

// ── Mobile header ─────────────────────────────────────────────────────────────

function MobileHeader({ onToggle }: { onToggle: () => void }) {
  return (
    <div style={{
      padding: '12px 16px', background: '#fff', borderBottom: '1px solid #e2e8f0',
      display: 'flex', alignItems: 'center', gap: '12px',
      position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 3px rgba(0,0,0,.06)',
    }}>
      <button
        onClick={onToggle}
        style={{ cursor: 'pointer', color: '#64748b', background: 'none', border: 'none', display: 'flex', alignItems: 'center', padding: 0 }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <rect x="2" y="4" width="16" height="2" rx="1"/>
          <rect x="2" y="9" width="16" height="2" rx="1"/>
          <rect x="2" y="14" width="16" height="2" rx="1"/>
        </svg>
      </button>
      <span style={{ fontWeight: 600, fontSize: '14px', color: '#0f172a' }}>Review Audit</span>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  data:     unknown
  reportId: string
}

export default function Dashboard({ data }: Props) {
  const report = data as ReviewAuditReport

  const [selId,       setSelId]       = useState<string | null>(null)
  const [loaded,      setLoaded]      = useState(15)
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

  const selected = selId ? (report.reviews.find(r => r.id === selId) ?? null) : null

  const handleSelect = (id: string) => {
    setSelId(id)
    if (isMobile) setSidebarOpen(false)
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: '#f8fafc' }}>
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 99, cursor: 'pointer' }}
        />
      )}

      <Sidebar
        report={report}
        selId={selId}
        loaded={loaded}
        isMobile={isMobile}
        sidebarOpen={sidebarOpen}
        search={search}
        onSearch={setSearch}
        onOverview={() => { setSelId(null); if (isMobile) setSidebarOpen(false) }}
        onSelect={handleSelect}
        onLoadMore={() => setLoaded(l => l + 15)}
      />

      <main style={{ flex: 1, overflow: 'hidden', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {isMobile && <MobileHeader onToggle={() => setSidebarOpen(s => !s)} />}

        {selected ? (
          <DetailView review={selected} onBack={() => setSelId(null)} />
        ) : (
          <OverviewView report={report} />
        )}
      </main>
    </div>
  )
}
