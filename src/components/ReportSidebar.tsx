import { useCallback, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { SIDEBAR_DEFAULT_WIDTH, SIDEBAR_MIN_WIDTH } from '../hooks/useSidebarWidth'

interface Props {
  isMobile: boolean
  open:     boolean
  onClose:  () => void
  header?:  ReactNode
  footer?:  ReactNode
  children: ReactNode
  /** Desktop-only resizable width, in px. Omit to use the fixed default (no drag handle). */
  width?:         number
  onWidthChange?: (width: number) => void
}

export default function ReportSidebar({
  isMobile, open, onClose, header, footer, children,
  width = SIDEBAR_DEFAULT_WIDTH, onWidthChange,
}: Props) {
  const closed = isMobile && !open
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef<{ x: number; width: number } | null>(null)

  const handlePointerDown = useCallback((e: PointerEvent) => {
    if (isMobile || !onWidthChange) return
    e.preventDefault()
    dragStart.current = { x: e.clientX, width }
    setDragging(true)
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'

    const handleMove = (ev: globalThis.PointerEvent) => {
      if (!dragStart.current) return
      onWidthChange(dragStart.current.width + (ev.clientX - dragStart.current.x))
    }
    const handleUp = () => {
      dragStart.current = null
      setDragging(false)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }, [isMobile, onWidthChange, width])

  return (
    <>
      {isMobile && open && (
        <div
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 99, cursor: 'pointer' }}
        />
      )}
      <aside style={{
        background:    'var(--color-sidebar)',
        display:       'flex',
        flexDirection: 'column',
        width:         isMobile ? `${SIDEBAR_DEFAULT_WIDTH}px` : `${width}px`,
        minWidth:      isMobile ? undefined : `${SIDEBAR_MIN_WIDTH}px`,
        borderRight:   '1px solid var(--color-sidebar-border)',
        flexShrink:    0,
        height:        '100%',
        overflow:      'hidden',
        position:      isMobile ? 'fixed' : 'relative',
        top:           isMobile ? 0 : 'auto',
        bottom:        isMobile ? 0 : 'auto',
        left:          isMobile ? 0 : 'auto',
        zIndex:        isMobile ? 100 : 1,
        transform:     closed ? 'translateX(-100%)' : 'translateX(0)',
        transition:    dragging ? 'none' : 'transform 0.22s ease',
      }}>
        {header}
        {children}
        {footer}

        {!isMobile && onWidthChange && (
          <div
            onPointerDown={handlePointerDown}
            title="Drag to resize sidebar"
            style={{
              // Flush with the right edge (not straddling it) — the aside
              // has overflow:hidden, which clips pointer events for anything
              // positioned outside its own bounds.
              position: 'absolute', top: 0, bottom: 0, right: 0, width: '6px',
              cursor: 'col-resize', zIndex: 5,
              background: dragging ? 'var(--color-accent)' : 'transparent',
              opacity: dragging ? 0.5 : 1,
              transition: dragging ? 'none' : 'background 0.15s',
            }}
            onMouseEnter={e => { if (!dragging) e.currentTarget.style.background = 'var(--color-sidebar-border)' }}
            onMouseLeave={e => { if (!dragging) e.currentTarget.style.background = 'transparent' }}
          />
        )}
      </aside>
    </>
  )
}
