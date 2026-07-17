/** Shared styling maps for PR/review-agent domain concepts (hats, providers, outcomes). */

export const PROVIDER_COLOR: Record<string, string> = {
  azure:   '#0078d4',
  copilot: '#238636',
  codex:   '#7c3aed',
}

const HAT_STYLE: Record<string, { bg: string; color: string }> = {
  'e2e-playwright':        { bg: '#f5f3ff', color: '#7c3aed' },
  'portals-react':         { bg: '#ecfeff', color: '#0e7490' },
  'dotnet-service':        { bg: '#eff6ff', color: '#1d4ed8' },
  'ci-automation':         { bg: '#fffbeb', color: '#b45309' },
  'data-persistence':      { bg: '#f0fdf4', color: '#15803d' },
  'dotnet-best-practices': { bg: '#f8fafc', color: '#475569' },
  'design-review':         { bg: '#fdf4ff', color: '#a21caf' },
  'interfacing':           { bg: '#fff7ed', color: '#c2410c' },
  'agentic-development':   { bg: '#f7fee7', color: '#4d7c0f' },
}

export function hatStyle(name: string) {
  return HAT_STYLE[name] ?? { bg: '#f1f5f9', color: '#475569' }
}

export function resultPill(r: string) {
  if (r === 'approved')          return { bg: '#f0fdf4', color: '#16a34a', label: 'Approved' }
  if (r === 'changes-requested') return { bg: '#fef2f2', color: '#dc2626', label: 'Changes Requested' }
  return                                { bg: '#fffbeb', color: '#d97706', label: 'Commented' }
}
