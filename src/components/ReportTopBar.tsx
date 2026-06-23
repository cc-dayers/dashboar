import BoarMark from './BoarMark'

export default function ReportTopBar() {
  return (
    <div style={{
      height: '44px',
      flexShrink: 0,
      background: '#fff',
      borderBottom: '1px solid #e2e8f0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    }}>
      <a
        href="/"
        style={{
          position: 'absolute',
          left: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          textDecoration: 'none',
          color: '#64748b',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span style={{
          fontFamily: "'Russo One', sans-serif",
          fontSize: '11px',
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          color: '#94a3b8',
        }}>
          Dashboar
        </span>
      </a>

      <BoarMark size={30} />
    </div>
  )
}
