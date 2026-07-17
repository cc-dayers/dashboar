/** Landing-page report visibility, persisted client-side so it survives reloads. */

const STORAGE_KEY = 'dashboar:visibleReportTypes'

/** No stored preference (or a corrupt one) means "show everything" — first-run default. */
export function loadVisibleReportTypes(allKeys: string[]): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return new Set(allKeys)
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set(allKeys)
    return new Set(parsed.filter((k): k is string => typeof k === 'string' && allKeys.includes(k)))
  } catch {
    return new Set(allKeys)
  }
}

export function saveVisibleReportTypes(keys: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...keys]))
  } catch {
    // localStorage unavailable (private browsing, quota) — visibility just won't persist
  }
}
