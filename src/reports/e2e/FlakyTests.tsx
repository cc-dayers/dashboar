import { useEffect, useMemo, useState } from 'react'
import type { E2eRunEntry, E2eRunReport } from './types'
import { S } from '../../lib/designTokens'

interface FlakyTestRow {
  title: string
  file?: string
  count: number
  latest: E2eRunEntry
  latestTime: number
  suites: string[]
}

interface Props {
  runs: E2eRunEntry[]
  onSelectRun: (run: E2eRunEntry) => void
  selectedSuite: string | null
}

const AMBER = '#f59e0b'
const KNOWN_SUITES = ['Core', 'Regression', 'Smoke']

function suiteOf(run: E2eRunEntry): string {
  const name = run.suiteName ?? run.suite ?? run.jobName ?? ''
  const knownIn = (source: string) => KNOWN_SUITES.find(suite => new RegExp(`(?:^|[^a-z])${suite}(?:$|[^a-z])`, 'i').test(source))
  const known = knownIn(name) ?? knownIn(run.suiteSlug ?? '') ?? knownIn(run.playwrightCommand ?? '')
  return known ?? (name.replace(/^E2E(?:\s*·)?\s*/i, '').trim() || 'Other')
}

function sortedSuites(suites: Iterable<string>): string[] {
  return [...suites].sort((a, b) => {
    const aRank = KNOWN_SUITES.indexOf(a)
    const bRank = KNOWN_SUITES.indexOf(b)
    return (aRank < 0 ? KNOWN_SUITES.length : aRank) - (bRank < 0 ? KNOWN_SUITES.length : bRank) || a.localeCompare(b)
  })
}

export function FlakySuiteFilter({ runs, selectedSuite, onChange }: {
  runs: E2eRunEntry[]
  selectedSuite: string | null
  onChange: (suite: string | null) => void
}) {
  const suites = sortedSuites(new Set(runs.filter(r => (r.summary?.flaky ?? 0) > 0).map(suiteOf)))
  if (suites.length === 0) return null

  return (
    <div role="group" aria-label="Filter flaky tests by suite" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', maxWidth: '100%' }}>
      <span style={{ fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase', color: S.fgMuted, marginRight: '3px' }}>Suite</span>
      {[null, ...suites].map(suite => {
        const active = selectedSuite === suite
        return (
          <button key={suite ?? 'all'} type="button" aria-pressed={active} onClick={() => onChange(suite)}
            style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: active ? 700 : 500, cursor: 'pointer', whiteSpace: 'nowrap', border: `1px solid ${active ? 'var(--color-accent)' : S.border}`, background: active ? 'var(--color-accent-surface)' : S.sunken, color: active ? 'var(--color-accent-foreground)' : S.fgSec }}>
            {suite === null ? 'All suites' : KNOWN_SUITES.includes(suite) ? `@${suite.toLowerCase()}` : suite}
          </button>
        )
      })}
    </div>
  )
}

export default function FlakyTests({ runs, onSelectRun, selectedSuite }: Props) {
  const flakyRuns = useMemo(() => runs.filter(r => (r.summary?.flaky ?? 0) > 0), [runs])
  const [details, setDetails] = useState<Array<{ run: E2eRunEntry; report: E2eRunReport }> | null>(null)
  const [failedRuns, setFailedRuns] = useState<E2eRunEntry[]>([])

  useEffect(() => {
    if (flakyRuns.length === 0) return
    const controller = new AbortController()
    let next = 0
    const errors = flakyRuns.filter(r => !r.reportBlobPath)
    const available = flakyRuns.filter(r => r.reportBlobPath)
    const found: Array<{ run: E2eRunEntry; report: E2eRunReport }> = []

    async function worker() {
      while (next < available.length && !controller.signal.aborted) {
        const run = available[next++]
        try {
          const response = await fetch(`/api/get-artifact?blobPath=${encodeURIComponent(run.reportBlobPath!)}&report=playwright-trace`, { signal: controller.signal })
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          const report: E2eRunReport = await response.json()
          if (!Array.isArray(report.tests)) throw new Error('Missing test details')
          found.push({ run, report })
        } catch {
          if (!controller.signal.aborted) errors.push(run)
        }
      }
    }

    Promise.all(Array.from({ length: Math.min(4, available.length) }, () => worker()))
      .then(() => {
        if (!controller.signal.aborted) {
          setDetails(found)
          setFailedRuns(errors)
        }
      })
    return () => controller.abort()
  }, [flakyRuns])

  const rows = useMemo(() => {
    const grouped = new Map<string, FlakyTestRow>()
    const suitesByTest = new Map<string, Set<string>>()
    for (const { run, report } of details ?? []) {
      const seen = new Set<string>()
      const suite = suiteOf(run)
      for (const test of report.tests ?? []) {
        if (test.status !== 'flaky' || !test.title) continue
        const key = JSON.stringify([test.file ?? '', test.title])
        if (seen.has(key)) continue // One occurrence per test per run.
        seen.add(key)
        if (!suitesByTest.has(key)) suitesByTest.set(key, new Set())
        suitesByTest.get(key)!.add(suite)
        if (selectedSuite !== null && suite !== selectedSuite) continue
        const time = run.generatedAt ? new Date(run.generatedAt).getTime() : 0
        const row = grouped.get(key)
        if (row) {
          row.count++
          if (time > row.latestTime) { row.latest = run; row.latestTime = time }
        } else {
          grouped.set(key, { title: test.title, file: test.file, count: 1, latest: run, latestTime: time, suites: [] })
        }
      }
    }
    for (const [key, row] of grouped) row.suites = sortedSuites(suitesByTest.get(key) ?? [])
    return [...grouped.values()].sort((a, b) => b.count - a.count || b.latestTime - a.latestTime || a.title.localeCompare(b.title)).slice(0, 10)
  }, [details, selectedSuite])

  const loading = flakyRuns.length > 0 && details === null
  const selectedFailed = failedRuns.filter(run => selectedSuite === null || suiteOf(run) === selectedSuite).length
  const max = rows[0]?.count ?? 1

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {loading || rows.length === 0 ? (
        <div role="status" aria-label={loading ? 'Loading flaky test details' : undefined} style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '24px', textAlign: 'center', fontSize: '12px', color: S.fgMuted }}>
          {loading ? <span aria-hidden="true" className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" /> : flakyRuns.length === 0 ? 'No flaky tests in this range.' : selectedFailed > 0 ? 'Flaky test details are unavailable for these runs.' : selectedSuite ? `No named flaky tests found in ${selectedSuite}.` : 'No named flaky tests found in the run details.'}
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 16px 16px' }}>
          {rows.map((row, i) => (
            <button key={JSON.stringify([row.file ?? '', row.title])} type="button" onClick={() => onSelectRun(row.latest)}
              title={`Open latest flaky run for ${row.title}`}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', textAlign: 'left', padding: '11px 0', border: 'none', borderBottom: `1px solid ${S.divider}`, background: 'transparent', cursor: 'pointer', color: S.fg }}>
              <span style={{ width: '22px', flexShrink: 0, color: S.fgSubtle, fontSize: '11px', fontVariantNumeric: 'tabular-nums' }}>{String(i + 1).padStart(2, '0')}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.title}>{row.title}</span>
                <span style={{ display: 'block', marginTop: '4px', fontSize: '10.5px', color: S.fgSubtle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.file ?? 'File unknown'}</span>
                <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px', marginTop: '5px' }}>
                  <span style={{ fontSize: '10px', color: S.fgSubtle, marginRight: '2px' }}>Flaky in</span>
                  {row.suites.map(suite => (
                    <span key={suite} style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '4px', color: S.fgSec, background: S.sunken, border: `1px solid ${S.border}` }}>
                      {suite}
                    </span>
                  ))}
                </span>
              </span>
              <span style={{ width: 'min(22%, 120px)', height: '5px', borderRadius: '4px', background: S.border, overflow: 'hidden', flexShrink: 0 }} aria-hidden="true">
                <span style={{ display: 'block', width: `${row.count / max * 100}%`, height: '100%', background: AMBER, borderRadius: '4px' }} />
              </span>
              <span style={{ width: '62px', textAlign: 'right', flexShrink: 0, color: AMBER, fontWeight: 700, fontSize: '11px', fontVariantNumeric: 'tabular-nums' }}>
                {row.count} {row.count === 1 ? 'flake' : 'flakes'}
              </span>
            </button>
          ))}
        </div>
      )}
      {!loading && selectedFailed > 0 && (
        <div role="status" style={{ padding: '8px 16px', fontSize: '11px', color: S.fgMuted, borderTop: `1px solid ${S.divider}` }}>
          Partial results · details unavailable for {selectedFailed} {selectedFailed === 1 ? 'run' : 'runs'}.
        </div>
      )}
    </div>
  )
}