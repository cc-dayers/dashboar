import { useEffect, useState } from 'react'
import BoarMark from './BoarMark'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import type { RefreshStatus } from '../reports'

// Icon-only toggle sized for the dark sidebar — uses hardcoded sidebar colors
// so it always looks right regardless of the active theme.
function SidebarThemeButton() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  const icon = isDark ? (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  ) : (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"/>
      <line x1="12" y1="2"  x2="12" y2="4"/>
      <line x1="12" y1="20" x2="12" y2="22"/>
      <line x1="4.22" y1="4.22"   x2="5.64"  y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="2"  y1="12" x2="4"  y2="12"/>
      <line x1="20" y1="12" x2="22" y2="12"/>
      <line x1="4.22"  y1="19.78" x2="5.64"  y2="18.36"/>
      <line x1="18.36" y1="5.64"  x2="19.78" y2="4.22"/>
    </svg>
  )

  return (
    <button
      onClick={toggleTheme}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        width:           '28px',
        height:          '28px',
        borderRadius:    '6px',
        border:          '1px solid var(--color-sidebar-border)',
        background:      'transparent',
        color:           'var(--color-sidebar-muted)',
        cursor:          'pointer',
        transition:      'border-color 0.15s, color 0.15s, background 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--color-sidebar-secondary)'
        e.currentTarget.style.color = 'var(--color-sidebar-foreground)'
        e.currentTarget.style.background = 'var(--color-sidebar-raised)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--color-sidebar-border)'
        e.currentTarget.style.color = 'var(--color-sidebar-muted)'
        e.currentTarget.style.background = 'transparent'
      }}
    >
      {icon}
    </button>
  )
}

// Icon-only refresh button — refetches the current report's blob data in
// place (Dashboard stays mounted; see App.tsx's `refresh()`).
function SidebarRefreshButton({ onRefresh, refreshing }: { onRefresh: () => void; refreshing?: boolean }) {
  return (
    <button
      onClick={onRefresh}
      disabled={refreshing}
      title={refreshing ? 'Refreshing…' : 'Refresh report data'}
      style={{
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        width:           '28px',
        height:          '28px',
        borderRadius:    '6px',
        border:          '1px solid var(--color-sidebar-border)',
        background:      'transparent',
        color:           'var(--color-sidebar-muted)',
        cursor:          refreshing ? 'default' : 'pointer',
        opacity:         refreshing ? 0.6 : 1,
        transition:      'border-color 0.15s, color 0.15s, background 0.15s',
      }}
      onMouseEnter={e => {
        if (refreshing) return
        e.currentTarget.style.borderColor = 'var(--color-sidebar-secondary)'
        e.currentTarget.style.color = 'var(--color-sidebar-foreground)'
        e.currentTarget.style.background = 'var(--color-sidebar-raised)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--color-sidebar-border)'
        e.currentTarget.style.color = 'var(--color-sidebar-muted)'
        e.currentTarget.style.background = 'transparent'
      }}
    >
      <svg
        width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className={refreshing ? 'animate-spin' : undefined}
      >
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <polyline points="21 3 21 9 15 9" />
      </svg>
    </button>
  )
}

// Brief status bubble under the refresh button — shows the *final* state only
// ("Updated"/"No Updates"), not an intermediate "Checking…", since the fetch
// resolves too fast for that to be readable. Absolutely positioned so it
// never shifts the sidebar layout as it fades in/out.
function RefreshStatusBubble({ status }: { status: RefreshStatus | undefined }) {
  const [show, setShow] = useState(false)
  const [label, setLabel] = useState<string | null>(null)

  useEffect(() => {
    if (!status) return
    setLabel(status.kind === 'updated' ? 'Updated' : 'No Updates')
    const raf = requestAnimationFrame(() => setShow(true))
    const hideTimer  = setTimeout(() => setShow(false), 1800)
    const clearTimer = setTimeout(() => setLabel(null), 2100)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(hideTimer)
      clearTimeout(clearTimer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.nonce])

  if (!label) return null

  return (
    <div
      role="status"
      style={{
        position:   'absolute',
        top:        'calc(100% + 6px)',
        left:       '50%',
        transform:  `translateX(-50%) translateY(${show ? '0' : '-3px'})`,
        whiteSpace: 'nowrap',
        fontSize:   '10.5px',
        fontWeight: 600,
        padding:    '4px 9px',
        borderRadius: '999px',
        background: 'var(--color-sidebar-raised)',
        border:     '1px solid var(--color-sidebar-border)',
        color:      status?.kind === 'updated' ? 'var(--color-sidebar-success)' : 'var(--color-sidebar-secondary)',
        boxShadow:  '0 2px 8px rgba(0,0,0,.18)',
        opacity:    show ? 1 : 0,
        transition: 'opacity 0.2s ease, transform 0.2s ease',
        pointerEvents: 'none',
        zIndex:     20,
      }}
    >
      {label}
    </div>
  )
}

interface Props {
  onRefresh?: () => void
  refreshing?: boolean
  refreshStatus?: RefreshStatus
}

export default function SidebarBoarHeader({ onRefresh, refreshing, refreshStatus }: Props) {
  const user = useAuth()

  return (
    <div style={{
      padding:        '12px 12px',
      borderBottom:   '1px solid var(--color-sidebar-border)',
      flexShrink:     0,
      position:       'relative',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      minHeight:      '62px',
    }}>
      <a
        href="/"
        style={{ display: 'flex', opacity: 0.85, transition: 'opacity 0.15s', textDecoration: 'none' }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '0.85')}
      >
        <BoarMark size={38} variant="alt" />
      </a>
      {user && (
        <div style={{
          position:      'absolute',
          left:          '10px',
          top:           '50%',
          transform:     'translateY(-50%)',
          fontSize:      '10px',
          fontWeight:    600,
          letterSpacing: '0.04em',
          color:         'var(--color-sidebar-muted)',
          background:    'var(--color-sidebar-raised)',
          border:        '1px solid var(--color-sidebar-border)',
          borderRadius:  '99px',
          padding:       '2px 8px',
          userSelect:    'none',
          maxWidth:      '80px',
          overflow:      'hidden',
          textOverflow:  'ellipsis',
          whiteSpace:    'nowrap',
        }}>
          {user}
        </div>
      )}
      <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '6px' }}>
        {onRefresh && (
          <div style={{ position: 'relative' }}>
            <SidebarRefreshButton onRefresh={onRefresh} refreshing={refreshing} />
            <RefreshStatusBubble status={refreshStatus} />
          </div>
        )}
        <SidebarThemeButton />
      </div>
    </div>
  )
}
