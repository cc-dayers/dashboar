import { useState, useEffect } from 'react'

export type Theme = 'light' | 'dark'

const KEY = 'dashboar_theme'

function resolveInitial(): Theme {
  const stored = localStorage.getItem(KEY)
  if (stored === 'dark' || stored === 'light') return stored
  // No stored preference — inherit from OS and save immediately
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(resolveInitial)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(KEY, theme)
  }, [theme])

  const toggleTheme = () => setThemeState(t => t === 'dark' ? 'light' : 'dark')

  return { theme, setTheme: setThemeState, toggleTheme }
}
