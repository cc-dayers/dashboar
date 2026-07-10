/**
 * Floating action button shown in every report Dashboard to toggle the
 * raw JSON overlay (RawJsonModal). Fixed-position so it works regardless
 * of each report's internal scroll/layout structure.
 */

interface Props {
  onClick: () => void
  active:  boolean
}

export default function JsonToggleButton({ onClick, active }: Props) {
  if (active) return null // RawJsonModal's own Close button takes over

  return (
    <button
      onClick={onClick}
      title="View raw JSON"
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
        <path d="M5 2L2 5v0l0 0 3 3M9 2l3 3v0l0 0-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      JSON
    </button>
  )
}
