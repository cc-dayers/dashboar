import { useEffect } from 'react'
import { registry } from '../reports'

/**
 * Centered dialog for the landing page's Reports panel — lets the user pick
 * which registered report types appear there. Changes apply immediately
 * (no separate save step) and are persisted by the caller via onChange.
 */

interface Props {
  visible:  Set<string>
  onChange: (next: Set<string>) => void
  onClose:  () => void
}

export default function ReportVisibilityModal({ visible, onChange, onClose }: Props) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  function toggle(key: string) {
    const next = new Set(visible)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onChange(next)
  }

  const entries = Object.entries(registry)

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 250,
        background: 'color-mix(in srgb, black 45%, transparent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Configure visible reports"
        onClick={e => e.stopPropagation()}
        className="bg-surface rounded-2xl shadow-sm border border-border"
        style={{ width: '100%', maxWidth: '420px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <div className="px-5 py-3 border-b border-border-subtle flex items-center justify-between flex-shrink-0">
          <h2 className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">Configure Reports</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-foreground-muted hover:text-accent cursor-pointer"
            style={{ fontSize: '18px', lineHeight: 1, background: 'none', border: 'none', padding: 0 }}
          >
            ×
          </button>
        </div>

        <div style={{ overflowY: 'auto' }}>
          {entries.map(([key, entry], i) => {
            const checked = visible.has(key)
            return (
              <label
                key={key}
                className={`flex items-start gap-3 px-5 py-3 cursor-pointer hover:bg-surface-sunken transition-colors${i > 0 ? ' border-t border-border-subtle' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(key)}
                  style={{ marginTop: '3px', width: '14px', height: '14px', accentColor: 'var(--color-accent)', cursor: 'pointer', flexShrink: 0 }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-xs font-mono text-accent-foreground bg-accent-surface px-1.5 py-0.5 rounded">{key}</code>
                    <span className="text-sm font-semibold text-foreground">{entry.label}</span>
                  </div>
                  <p className="text-xs text-foreground-muted mt-1 leading-snug">{entry.description}</p>
                </div>
              </label>
            )
          })}
        </div>

        <div className="px-5 py-3 border-t border-border-subtle flex items-center justify-between flex-shrink-0">
          <span className="text-xs text-foreground-muted">{visible.size} of {entries.length} shown</span>
          <button
            onClick={onClose}
            className="text-sm font-medium text-white cursor-pointer transition-opacity hover:opacity-90"
            style={{ background: 'var(--color-accent, #7c3aed)', padding: '6px 14px', borderRadius: '6px', border: 'none' }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
