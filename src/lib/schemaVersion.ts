export type VersionSource = 'explicit' | 'inferred' | 'legacy'

export interface ResolvedVersion {
  version: string
  source: VersionSource
}

// Matches the basename pattern used by the report generator: report.v{N}.schema.json
const SCHEMA_FILE_RE = /\breport\.v(\d+)\.schema\.json$/

/**
 * Determine the schema version of a loaded report payload.
 *
 * Priority:
 *   1. report.schemaVersion (canonical — set by the report generator)
 *   2. numeric N from report.$schema matching report.v{N}.schema.json
 *   3. 'legacy' — pre-versioned report; render with the latest known contract
 */
export function resolveSchemaVersion(report: unknown): ResolvedVersion {
  if (typeof report !== 'object' || report === null) {
    return { version: 'legacy', source: 'legacy' }
  }
  const r = report as Record<string, unknown>

  if (typeof r['schemaVersion'] === 'string' && r['schemaVersion'].length > 0) {
    return { version: r['schemaVersion'], source: 'explicit' }
  }

  if (typeof r['$schema'] === 'string') {
    const m = r['$schema'].match(SCHEMA_FILE_RE)
    if (m) {
      return { version: m[1]!, source: 'inferred' }
    }
  }

  return { version: 'legacy', source: 'legacy' }
}

// All schema versions this dashboard can fully render.
// 'legacy' = pre-versioned reports (no schemaVersion field).
// Add new versions here as they are introduced in the report generator.
export const SUPPORTED_VERSIONS = new Set<string>(['1', 'legacy'])

export function isSupportedVersion(version: string): boolean {
  return SUPPORTED_VERSIONS.has(version)
}
