import type { ReactNode } from 'react'

interface Props {
  isMobile: boolean
  open:     boolean
  onClose:  () => void
  header?:  ReactNode
  footer?:  ReactNode
  children: ReactNode
}

export default function ReportSidebar({ isMobile, open, onClose, header, footer, children }: Props) {
  const closed = isMobile && !open

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
        width:         '280px',
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
        transition:    'transform 0.22s ease',
      }}>
        {header}
        {children}
        {footer}
      </aside>
    </>
  )
}
