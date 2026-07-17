import { useCallback, useEffect, useState } from 'react'

export const SIDEBAR_MIN_WIDTH = 220
export const SIDEBAR_DEFAULT_WIDTH = 280

function keyFor(reportType: string) {
  return `dashboar_sidebar_width:${reportType}`
}

function clamp(width: number) {
  const max = Math.round(window.innerWidth * 0.7)
  return Math.min(max, Math.max(SIDEBAR_MIN_WIDTH, width))
}

/** Persists the sidebar's drag-resized width per report type, remembered across sessions. */
export function useSidebarWidth(reportType: string) {
  const [width, setWidth] = useState<number>(() => {
    const stored = Number(localStorage.getItem(keyFor(reportType)))
    return Number.isFinite(stored) && stored > 0 ? clamp(stored) : SIDEBAR_DEFAULT_WIDTH
  })

  useEffect(() => {
    localStorage.setItem(keyFor(reportType), String(width))
  }, [reportType, width])

  const setClampedWidth = useCallback((next: number) => setWidth(clamp(next)), [])

  return [width, setClampedWidth] as const
}
