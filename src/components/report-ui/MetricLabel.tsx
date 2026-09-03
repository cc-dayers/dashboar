import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { S } from '../../lib/designTokens'

interface Props {
  children: ReactNode
  explanation?: string
}

/** Metric label with a keyboard- and pointer-accessible calculation disclosure. */
export default function MetricLabel({ children, explanation }: Props) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      document.removeEventListener('mousedown', closeOnOutsideClick)
    }
  }, [open])

  if (!explanation) return <>{children}</>

  const label = typeof children === 'string' ? children : 'this metric'
  return (
    <div ref={rootRef} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', position: 'relative' }}>
      <span>{children}</span>
      <button
        type="button"
        aria-label={`How ${label} is calculated`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen(value => !value)}
        style={{
          width: '15px', height: '15px', padding: 0, borderRadius: '50%',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          border: `1px solid ${S.border}`, background: S.sunken, color: S.fgMuted,
          fontSize: '10px', fontFamily: 'Georgia, serif', fontWeight: 700,
          lineHeight: 1, cursor: 'help', flexShrink: 0,
        }}
      >
        i
      </button>
      {open && (
        <div
          id={id}
          role="tooltip"
          style={{
            position: 'absolute', zIndex: 20, top: 'calc(100% + 7px)', left: 0,
            width: '280px', padding: '10px 12px', borderRadius: '8px',
            background: S.fg, color: 'var(--color-background)',
            boxShadow: '0 10px 30px rgba(0,0,0,.22)', fontSize: '11px',
            fontWeight: 400, lineHeight: 1.5, letterSpacing: 0,
            textTransform: 'none',
          }}
        >
          {explanation}
        </div>
      )}
    </div>
  )
}
