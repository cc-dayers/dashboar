import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

export interface ReportProps {
  data: unknown
  reportId: string
}

export interface RegistryEntry {
  component: LazyExoticComponent<ComponentType<ReportProps>>
  label: string
  description: string
  /**
   * Maps resolved schema version strings to public URLs for the JSON Schema
   * used to validate reports of that version. 'legacy' is the sentinel for
   * pre-versioned reports. Add a new entry when a new report.v{N}.schema.json
   * is introduced in the review-agent.
   */
  schemaVersions?: Record<string, string>
  fixtures?: string[]
}

export const registry: Record<string, RegistryEntry> = {
  infrastructure: {
    component: lazy(() => import('./infrastructure/Dashboard')),
    label: 'Infrastructure',
    description: 'System health: compute, storage, networking, and deployments.',
    fixtures: ['example'],
  },
  simple: {
    component: lazy(() => import('./simple/Dashboard')),
    label: 'Simple',
    description: 'Generic JSON viewer. Use as a starting point for new report types.',
    fixtures: ['example'],
  },
  'pr-review': {
    component: lazy(() => import('./pr-review/Dashboard')),
    label: 'PR Review',
    description: 'AI PR review agent: accuracy trends, review time, cost, hats, and per-PR findings.',
    schemaVersions: {
      '2':      '/schemas/pr-review.v2.schema.json',
      '1':      '/schemas/pr-review.v1.schema.json',
      'legacy': '/schemas/pr-review.v1.schema.json',
    },
    fixtures: ['example', 'report', 'legacy', 'v1', 'future'],
  },
  'playwright-trace': {
    component: lazy(() => import('./playwright-trace/Dashboard')),
    label: 'Playwright Traces',
    description: 'Automated test run trace viewer — opens Playwright traces directly in the browser.',
    fixtures: ['example'],
  },
  'review-audit': {
    component: lazy(() => import('./review-audit/Dashboard')),
    label: 'Review Audit',
    description: 'PR review audit: per-review feedback, improvement signals, downstream impact, and summary stats.',
  },
}

export const DEFAULT_TYPE = 'infrastructure'
