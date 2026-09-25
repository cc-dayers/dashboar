import { useEffect, useMemo, useState } from 'react'
import type { E2eRunEntry, E2eRunReport } from './types'
import { S } from '../../lib/designTokens'

interface FlakyTestRow {
  title: string
  file?: string
  count: number
  latest: E2eRunEntry
  latestTime: number
}

interface Props {
  runs: E2eRunEntry[]
  onSelectRun: (run: E2eRunEntry) => void
}

const AMBER = '#f59e0b'

export default function FlakyTests({ runs, onSelectRun }: Props) {
  const flakyRuns = useMemo(() => runs.filter(r => (r.summary?.flaky ?? 0) > 0), [runs])
  const [details, setDetails] = useState<Array<{ run: E2eRunEntry; report: E2eRunReport }> | null>(null)
  const [failed, setFailed] = useState(0)

  useEffect(() => {
    if (flakyRuns.length === 0) return
    const controller = new AbortController()
    let next = 0
    let errors = flakyRuns.filter(r => !r.reportBlobPath).length
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
          if (!controller.signal.aborted) errors++
        }
      }
    }

    Promise.all(Array.from({ length: Math.min(4, available.length) }, () => worker()))
      .then(() => {
        if (!controller.signal.aborted) {
          setDetails(found)
          setFailed(errors)
        }
      })
    return () => controller.abort()
  }, [flakyRuns])

  const rows = useMemo(() => {
    const grouped = new Map<string, FlakyTestRow>()
    for (const { run, report } of details ?? []) {
      const seen = new Set<string>()
      for (const test of report.tests ?? []) {
        if (test.status !== 'flaky' || !test.title) continue
        const key = JSON.stringify([test.file ?? '', test.title])
        if (seen.has(key)) continue // One occurrence per test per run.
        seen.add(key)
        const time = run.generatedAt ? new Date(run.generatedAt).getTime() : 0
        const row = grouped.get(key)
        if (row) {
          row.count++
          if (time > row.latestTime) { row.latest = run; row.latestTime = time }
        } else {
          grouped.set(key, { title: test.title, file: test.file, count: 1, latest: run, latestTime: time })
        }
      }
    }
    return [...grouped.values()].sort((a, b) => b.count - a.count || b.latestTime - a.latestTime || a.title.localeCompare(b.title)).slice(0, 10)
  }, [details])

  const loading = flakyRuns.length > 0 && details === null
  const max = rows[0]?.count ?? 1

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 16px', fontSize: '11px', color: S.fgSubtle, borderBottom: `1px solid ${S.divider}` }}>
        Ranked by flaky occurrences in the selected range · up to 10 tests
      </div>
      {loading || rows.length === 0 ? (
        <div role="status" style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '24px', textAlign: 'center', fontSize: '12px', color: S.fgMuted }}>
          {loading ? 'Loading flaky test details…' : flakyRuns.length === 0 ? 'No flaky tests in this range.' : failed > 0 ? 'Flaky test details are unavailable for these runs.' : 'No named flaky tests found in the run details.'}
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
                <span style={{ display: 'block', marginTop: '4px', fontSize: '10.5px', color: S.fgSubtle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.file ?? 'File unknown'} · {row.latest.suiteName ?? row.latest.suite ?? 'Run'}
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
      {!loading && failed > 0 && (
        <div role="status" style={{ padding: '8px 16px', fontSize: '11px', color: S.fgMuted, borderTop: `1px solid ${S.divider}` }}>
          Partial results · details unavailable for {failed} {failed === 1 ? 'run' : 'runs'}.
        </div>
      )}
    </div>
  )
}