import BoarMark from './BoarMark'
import { useTheme } from '../hooks/useTheme'

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

export default function SidebarBoarHeader() {
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
      <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}>
        <SidebarThemeButton />
      </div>
    </div>
  )
}
