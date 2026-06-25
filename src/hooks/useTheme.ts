import { useState, useEffect } from 'react'

export type Theme = 'system' | 'light' | 'dark'

const KEY = 'dashboar_theme'

function applyTheme(t: Theme) {
  const root = document.documentElement
  if (t === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', t)
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem(KEY) as Theme | null) ?? 'system'
  })

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem(KEY, theme)
  }, [theme])

  const cycleTheme = () => {
    setThemeState(t => t === 'system' ? 'dark' : t === 'dark' ? 'light' : 'system')
  }

  return { theme, setTheme: setThemeState, cycleTheme }
}
