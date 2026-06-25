import type { ReactElement } from 'react'
import { useTheme, type Theme } from '../hooks/useTheme'

const LABELS: Record<Theme, string> = {
  system: 'Auto (system)',
  light:  'Light mode',
  dark:   'Dark mode',
}

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"/>
      <line x1="12" y1="2"  x2="12" y2="4"/>
      <line x1="12" y1="20" x2="12" y2="22"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="2"  y1="12" x2="4"  y2="12"/>
      <line x1="20" y1="12" x2="22" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  )
}

function SystemIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <line x1="8" y1="21" x2="16" y2="21"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  )
}

const ICONS: Record<Theme, () => ReactElement> = {
  system: SystemIcon,
  light:  SunIcon,
  dark:   MoonIcon,
}

export default function ThemeToggle() {
  const { theme, cycleTheme } = useTheme()
  const Icon = ICONS[theme]

  return (
    <button
      onClick={cycleTheme}
      title={LABELS[theme]}
      style={{
        display:        'flex',
        alignItems:     'center',
        gap:            '5px',
        padding:        '5px 10px',
        borderRadius:   '8px',
        border:         '1px solid var(--color-border)',
        background:     'var(--color-surface-raised)',
        color:          'var(--color-foreground-muted)',
        cursor:         'pointer',
        fontSize:       '11px',
        fontWeight:     500,
        transition:     'border-color 0.15s, background 0.15s',
        whiteSpace:     'nowrap',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget
        el.style.borderColor = 'var(--color-accent-muted)'
        el.style.color = 'var(--color-accent)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget
        el.style.borderColor = 'var(--color-border)'
        el.style.color = 'var(--color-foreground-muted)'
      }}
    >
      <Icon />
      <span>{theme === 'system' ? 'Auto' : theme === 'light' ? 'Light' : 'Dark'}</span>
    </button>
  )
}
