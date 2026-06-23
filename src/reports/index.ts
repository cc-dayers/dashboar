import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

export interface ReportProps {
  data: unknown
  reportId: string
}

export interface RegistryEntry {
  component: LazyExoticComponent<ComponentType<ReportProps>>
  label: string
  description: string
  schemaFile?: string
  fixtures?: string[]
}

export const registry: Record<string, RegistryEntry> = {
  infrastructure: {
    component: lazy(() => import('./infrastructure/Dashboard')),
    label: 'Infrastructure',
    description: 'System health: compute, storage, networking, and deployments.',
    schemaFile: 'infrastructure.schema.json',
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
    schemaFile: 'pr-review.schema.json',
    fixtures: ['example', 'report'],
  },
  'playwright-trace': {
    component: lazy(() => import('./playwright-trace/Dashboard')),
    label: 'Playwright Traces',
    description: 'Automated test run trace viewer — opens Playwright traces directly in the browser.',
    fixtures: ['example'],
  },
}

export const DEFAULT_TYPE = 'infrastructure'
