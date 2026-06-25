interface Props {
  title:    string
  onToggle: () => void
}

export default function MobileTopBar({ title, onToggle }: Props) {
  return (
    <div style={{
      padding: '12px 16px', background: '#fff', borderBottom: '1px solid #e2e8f0',
      display: 'flex', alignItems: 'center', gap: '12px',
      position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 3px rgba(0,0,0,.06)',
      flexShrink: 0,
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
      <span style={{ fontWeight: 600, fontSize: '14px', color: '#0f172a' }}>{title}</span>
    </div>
  )
}
