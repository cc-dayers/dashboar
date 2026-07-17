/**
 * Floating action button shown on the landing page and every report Dashboard
 * to open the Docs overlay (DocsModal). Fixed-position, anchored bottom-right,
 * directly beneath JsonToggleButton.
 */

interface Props {
  onClick: () => void
  active:  boolean
}

export default function DocsButton({ onClick, active }: Props) {
  if (active) return null // DocsModal's own Close button takes over

  return (
    <button
      onClick={onClick}
      title="View docs"
      style={{
        position: 'fixed', bottom: '20px', right: '20px', zIndex: 150,
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '8px 14px', borderRadius: '999px', cursor: 'pointer',
        background: 'var(--color-surface)', color: 'var(--color-foreground-secondary)',
        border: '1px solid var(--color-border)',
        boxShadow: '0 2px 10px rgba(0,0,0,.12)',
        fontSize: '12px', fontWeight: 600,
      }}
    >
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.3" />
        <path d="M5.3 5.3a1.7 1.7 0 113.06 1.02c-.3.42-.86.6-.86 1.28v.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="7" cy="10.1" r="0.15" fill="currentColor" stroke="currentColor" strokeWidth="0.9" />
      </svg>
      Docs
    </button>
  )
}
