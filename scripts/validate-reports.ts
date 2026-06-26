#!/usr/bin/env npx tsx
/**
 * scripts/validate-reports.ts
 *
 * Validates Azure Blob Storage report configuration, live blob content, and local fixtures.
 *
 * Usage:
 *   npm run validate:reports                    # env check + live blobs + fixtures
 *   npm run validate:reports -- --fixtures-only # skip live blob checks (no Azure creds needed)
 *
 * Exit codes:
 *   0 = all clear (warnings are OK)
 *   1 = one or more errors
 *   2 = validator crashed
 */

import { config } from 'dotenv'
import * as fs   from 'node:fs'
import * as path from 'node:path'

config({ path: '.env.local' })
config()

// ── Terminal colours ───────────────────────────────────────────────────────────

const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
}

const ok   = (s: string) => `${C.green}✓${C.reset} ${s}`
const fail = (s: string) => `${C.red}✗${C.reset} ${s}`
const warn = (s: string) => `${C.yellow}⚠${C.reset} ${s}`
const note = (s: string) => `${C.dim}  ${s}${C.reset}`
const hd   = (s: string) => `\n${C.bold}${C.cyan}${s}${C.reset}\n`

// ── Schema constants (mirrors src/lib/schemaVersion.ts) ───────────────────────

const SUPPORTED_VERSIONS = new Set(['1', '2', 'legacy'])
const SCHEMA_FILE_RE = /\breport\.v(\d+)\.schema\.json$/

function resolveSchemaVersion(r: Record<string, unknown>): { version: string; source: string } {
  const sv = r['schemaVersion']
  if (typeof sv === 'string' && sv.length > 0) return { version: sv, source: 'explicit' }
  const s = r['$schema']
  if (typeof s === 'string') {
    const m = s.match(SCHEMA_FILE_RE)
    if (m) return { version: m[1]!, source: '$schema' }
  }
  return { version: 'legacy', source: 'legacy' }
}

// ── Per-type structural rules ──────────────────────────────────────────────────

interface Findings {
  lines:    string[]   // formatted display lines
  errors:   string[]   // blockers
  warnings: string[]   // non-fatal
  topKeys:  string[]   // top-level JSON keys (for drift detection)
}

function validateContent(data: unknown, reportType: string, _label: string, expectUnsupported = false): Findings {
  const lines: string[] = []
  const errors: string[] = []
  const warnings: string[] = []
  let topKeys: string[] = []

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    errors.push('Root value is not a JSON object')
    lines.push(fail('Root value is not a JSON object'))
    return { lines, errors, warnings, topKeys }
  }

  const r = data as Record<string, unknown>
  topKeys = Object.keys(r)

  // ── Schema version
  const { version, source } = resolveSchemaVersion(r)
  const vLabel = source === 'legacy'
    ? 'legacy (no schemaVersion field)'
    : `"${version}" (from ${source})`

  if (!SUPPORTED_VERSIONS.has(version)) {
    const msg = `schemaVersion ${vLabel} → ${C.yellow}unsupported${C.reset}`
    if (expectUnsupported) {
      warnings.push(`schemaVersion "${version}" is unsupported (OK — this is a future-version test fixture)`)
      lines.push(warn(msg + ' — expected for future fixtures'))
    } else {
      errors.push(`schemaVersion "${version}" is not supported by the dashboard`)
      lines.push(fail(msg))
    }
  } else {
    lines.push(ok(`schemaVersion   ${vLabel}`))
  }

  // ── Type-specific checks
  switch (reportType) {
    case 'pr-review': {
      const reviews = r['reviews']
      if (!Array.isArray(reviews)) {
        errors.push('Missing or non-array "reviews" field')
        lines.push(fail('Missing or non-array "reviews" field'))
      } else {
        lines.push(ok(`reviews         ${reviews.length} entries`))
        const requiredFields = ['prNumber', 'result', 'reviewedAt']
        let badCount = 0
        for (const rv of reviews) {
          if (typeof rv !== 'object' || rv === null) { badCount++; continue }
          const missing = requiredFields.filter(f => !(f in (rv as object)))
          if (missing.length > 0) badCount++
        }
        if (badCount > 0) {
          errors.push(`${badCount} review(s) missing required fields (prNumber, result, reviewedAt)`)
          lines.push(fail(`${badCount} review(s) missing required fields`))
        } else {
          lines.push(ok('Required fields  prNumber, result, reviewedAt present in all reviews'))
        }
      }
      break
    }

    case 'review-audit': {
      const summary = r['summary']
      if (typeof summary !== 'object' || summary === null) {
        errors.push('Missing or non-object "summary" field')
        lines.push(fail('Missing or non-object "summary" field'))
      } else {
        const s = summary as Record<string, unknown>
        const missingKpi = ['reviewCount', 'findingCount'].filter(f => typeof s[f] !== 'number')
        if (missingKpi.length > 0) {
          errors.push(`summary missing number fields: ${missingKpi.join(', ')}`)
          lines.push(fail(`summary missing: ${missingKpi.join(', ')}`))
        } else {
          lines.push(ok(`reviewCount     ${s['reviewCount']}`))
          lines.push(ok(`findingCount    ${s['findingCount']}`))
        }
        if (s['feedbackCollectionStatus']) {
          lines.push(note(`feedbackCollectionStatus: ${s['feedbackCollectionStatus']}`))
        }
      }
      if (!Array.isArray(r['reviews'])) {
        errors.push('Missing or non-array "reviews" field')
        lines.push(fail('Missing or non-array "reviews" field'))
      } else {
        lines.push(ok(`reviews         ${(r['reviews'] as unknown[]).length} entries`))
      }
      break
    }

    case 'e2e-run': {
      // Per-run detail (fetched via get-artifact, not REPORT_NAMES)
      const tests = r['tests']
      if (!Array.isArray(tests)) {
        warnings.push('Missing or non-array "tests" field')
        lines.push(warn('Missing or non-array "tests" field'))
      } else {
        const ts = tests as Array<Record<string, unknown>>
        const failed = ts.filter(t => t['status'] === 'failed').length
        const flaky  = ts.filter(t => t['status'] === 'flaky').length
        lines.push(ok(`tests           ${ts.length} (${failed} failed, ${flaky} flaky)`))
        const noTitle = ts.filter(t => !t['title']).length
        if (noTitle > 0) {
          errors.push(`${noTitle} test(s) missing "title" field`)
          lines.push(fail(`${noTitle} test(s) missing "title"`))
        }
      }
      if (r['summary']) {
        const s = r['summary'] as Record<string, unknown>
        lines.push(note(`summary: total=${s['total']}, passed=${s['passed']}, failed=${s['failed']}`))
      }
      break
    }

    case 'playwright-trace':
    // playwright-trace blobs use the same e2e-aggregate schema — fall through
    case 'e2e-aggregate': {
      const runs = r['runs']
      if (!Array.isArray(runs)) {
        errors.push('Missing or non-array "runs" field')
        lines.push(fail('Missing or non-array "runs" field'))
      } else {
        const rs = runs as Array<Record<string, unknown>>
        const failed    = rs.filter(x => x['status'] === 'failed').length
        const flaky     = rs.filter(x => x['status'] === 'flaky').length
        const noStatus  = rs.filter(x => typeof x['status'] !== 'string').length
        const noName    = rs.filter(x => !x['suiteName'] && !x['suite'] && !x['jobName']).length
        const noBlob    = rs.filter(x => !x['reportBlobPath']).length

        lines.push(ok(`runs            ${rs.length} (${failed} failed, ${flaky} flaky, ${rs.length - failed - flaky} other)`))

        if (noStatus > 0) {
          errors.push(`${noStatus} run(s) missing "status" field`)
          lines.push(fail(`${noStatus} run(s) missing "status"`))
        }
        if (noName > 0) {
          warnings.push(`${noName} run(s) have no name (suiteName/suite/jobName)`)
          lines.push(warn(`${noName} run(s) have no name — labels will show "Run"`))
        }
        if (noBlob > 0) {
          warnings.push(`${noBlob} run(s) have no reportBlobPath — per-run detail drill-down won't work`)
          lines.push(warn(`${noBlob} run(s) missing reportBlobPath → no per-run detail`))
        } else {
          lines.push(ok(`reportBlobPath  all ${rs.length} runs link to per-run detail`))
        }
      }
      break
    }

    default:
      // 'simple' and unknown types — no structural requirements
      lines.push(note(`No structural rules for type "${reportType}"`))
      break
  }

  return { lines, errors, warnings, topKeys }
}

// ── Env / config parsing (mirrors api/list-blobs.ts) ──────────────────────────

interface ReportEntry { type: string; storagePath: string; defaultId: string | null }
interface SasEntry    { type: string; token: string }

function parseReportNames(): ReportEntry[] {
  return (process.env['REPORT_NAMES'] ?? '').split(',').map(s => s.trim()).filter(Boolean).map(entry => {
    const fc = entry.indexOf(':')
    if (fc === -1) return { type: entry, storagePath: entry, defaultId: null }
    const type = entry.slice(0, fc)
    const rest = entry.slice(fc + 1)
    const lc   = rest.lastIndexOf(':')
    if (lc === -1) return { type, storagePath: rest, defaultId: null }
    return { type, storagePath: rest.slice(0, lc), defaultId: rest.slice(lc + 1) || null }
  })
}

function parseSasTokens(): SasEntry[] {
  return (process.env['AZURE_SAS_TOKENS'] ?? '').split(',').map(s => s.trim()).filter(Boolean).flatMap(entry => {
    const colon = entry.indexOf(':')
    if (colon === -1) return []
    const type  = entry.slice(0, colon)
    const token = entry.slice(colon + 1)
    return token ? [{ type, token }] : []
  })
}

function resolveToken(reportType: string, sasEntries: SasEntry[]): string | undefined {
  return sasEntries.find(e => e.type === reportType)?.token ?? process.env['AZURE_SAS_TOKEN']
}

// ── URL building (mirrors api/get-blob.ts) ────────────────────────────────────

function buildBlobUrl(baseUrl: string, storagePath: string, id: string, sasToken: string | undefined): string {
  const url  = new URL(baseUrl)
  const segs = storagePath.split('/').filter(Boolean).map(s => encodeURIComponent(s))
  url.pathname = [url.pathname.replace(/\/$/, ''), ...segs, `${encodeURIComponent(id)}.json`].join('/')
  if (sasToken) {
    const t = sasToken.startsWith('?') ? sasToken.slice(1) : sasToken
    new URLSearchParams(t).forEach((v, k) => url.searchParams.set(k, v))
  }
  return url.toString()
}

// ── Network helpers ───────────────────────────────────────────────────────────

async function fetchTimeout(url: string, opts: RequestInit = {}, ms = 12_000): Promise<Response> {
  const ac = new AbortController()
  const id = setTimeout(() => ac.abort(), ms)
  try { return await fetch(url, { ...opts, signal: ac.signal }) }
  finally { clearTimeout(id) }
}

function fmtBytes(n: number) {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB`
       : n >= 1_000     ? `${Math.round(n / 1_000)} KB`
       : `${n} B`
}

// ── Live blob probe + validate ────────────────────────────────────────────────

async function validateLiveBlob(
  entry: ReportEntry, baseUrl: string, token: string | undefined,
): Promise<Findings> {
  const lines:    string[] = []
  const errors:   string[] = []
  const warnings: string[] = []
  let   topKeys:  string[] = []

  const candidates = entry.defaultId ? [entry.defaultId] : ['report', entry.type]

  // Probe candidates with HEAD
  let found: { id: string; url: string; size?: number; modified?: string } | null = null
  for (const id of candidates) {
    const url = buildBlobUrl(baseUrl, entry.storagePath, id, token)
    let res: Response
    try {
      res = await fetchTimeout(url, { method: 'HEAD' })
    } catch (e) {
      const msg = e instanceof Error && e.name === 'AbortError' ? 'timed out after 12s' : String(e)
      errors.push(`Network error probing ${id}.json: ${msg}`)
      lines.push(fail(`Network error: ${msg}`))
      return { lines, errors, warnings, topKeys }
    }

    if (res.ok) {
      const cl = res.headers.get('content-length')
      found = {
        id, url,
        size:     cl ? parseInt(cl, 10) : undefined,
        modified: res.headers.get('last-modified') ?? undefined,
      }
      break
    }
    if (res.status !== 404) {
      errors.push(`HTTP ${res.status} probing ${entry.storagePath}/${id}.json`)
      lines.push(fail(`HTTP ${res.status} (${entry.storagePath}/${id}.json)`))
      return { lines, errors, warnings, topKeys }
    }
  }

  if (!found) {
    const tried = candidates.map(c => `${c}.json`).join(', ')
    errors.push(`Blob not found (tried: ${tried})`)
    lines.push(fail(`Not found in ${entry.storagePath}  (tried: ${tried})`))
    return { lines, errors, warnings, topKeys }
  }

  const sizePart = found.size     != null ? `  ${fmtBytes(found.size)}`                            : ''
  const modPart  = found.modified != null ? `  (${new Date(found.modified).toDateString()})`        : ''
  lines.push(ok(`Reachable       ${found.id}.json${sizePart}${modPart}`))

  // Fetch and parse JSON
  let data: unknown
  try {
    const res = await fetchTimeout(found.url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    data = await res.json()
  } catch (e) {
    errors.push(`Failed to fetch/parse JSON: ${e instanceof Error ? e.message : e}`)
    lines.push(fail(`Fetch failed: ${e instanceof Error ? e.message : e}`))
    return { lines, errors, warnings, topKeys }
  }

  lines.push(ok('Valid JSON'))

  const { lines: vl, errors: ve, warnings: vw, topKeys: tk } = validateContent(data, entry.type, found.id)
  lines.push(...vl)
  errors.push(...ve)
  warnings.push(...vw)
  topKeys = tk

  return { lines, errors, warnings, topKeys }
}

// ── Fixture validation ────────────────────────────────────────────────────────

function validateFixture(filePath: string, reportType: string): Findings {
  let raw: string
  try { raw = fs.readFileSync(filePath, 'utf-8') }
  catch {
    return { lines: [fail('Cannot read file')], errors: ['Cannot read file'], warnings: [], topKeys: [] }
  }

  let data: unknown
  try { data = JSON.parse(raw) }
  catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { lines: [fail(`Invalid JSON: ${msg}`)], errors: [`Invalid JSON: ${msg}`], warnings: [], topKeys: [] }
  }

  // future.json is intentionally unsupported — downgrade errors to warnings
  const isFuture = path.basename(filePath, '.json') === 'future'

  const { lines, errors, warnings, topKeys } = validateContent(data, reportType, filePath, isFuture)

  // For future fixtures: demote structural errors to warnings (we expect the banner)
  const finalErrors   = isFuture ? [] : errors
  const finalWarnings = isFuture ? [...warnings, ...errors] : warnings

  return { lines, errors: finalErrors, warnings: finalWarnings, topKeys }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const fixturesOnly = process.argv.includes('--fixtures-only')
  let totalErrors = 0, totalWarnings = 0

  function tally(f: Findings) { totalErrors += f.errors.length; totalWarnings += f.warnings.length }

  // Header
  console.log(`\n${C.bold}${C.cyan}────────────────────────────────────────────────${C.reset}`)
  console.log(`${C.bold}${C.cyan}  Dashboar Report Validator${C.reset}`)
  if (fixturesOnly) console.log(`${C.dim}  fixtures-only mode (skipping live blob checks)${C.reset}`)
  console.log(`${C.bold}${C.cyan}────────────────────────────────────────────────${C.reset}`)

  // ── Env
  console.log(hd('■  Environment'))

  const baseUrl    = process.env['AZURE_BLOB_BASE_URL']
  const sasEntries = parseSasTokens()
  const entries    = parseReportNames()

  if (baseUrl) {
    try   { new URL(baseUrl); console.log('  ' + ok(`AZURE_BLOB_BASE_URL  ${baseUrl}`)) }
    catch { console.log('  ' + fail('AZURE_BLOB_BASE_URL  not a valid URL')); totalErrors++ }
  } else {
    const line = fixturesOnly
      ? warn('AZURE_BLOB_BASE_URL  not set (OK in --fixtures-only mode)')
      : fail('AZURE_BLOB_BASE_URL  not set — live checks unavailable')
    console.log('  ' + line)
    if (!fixturesOnly) totalErrors++
    else               totalWarnings++
  }

  if (sasEntries.length > 0) {
    console.log('  ' + ok(`AZURE_SAS_TOKENS     ${sasEntries.length} token(s): ${sasEntries.map(e => e.type).join(', ')}`))
  } else if (process.env['AZURE_SAS_TOKEN']) {
    console.log('  ' + ok('AZURE_SAS_TOKEN      1 global fallback token (no per-type tokens)'))
  } else if (!fixturesOnly) {
    console.log('  ' + warn('AZURE_SAS_TOKENS     not set — blob fetches will likely get 403'))
    totalWarnings++
  }

  if (entries.length > 0) {
    console.log('  ' + ok(`REPORT_NAMES         ${entries.length} configured: ${entries.map(e => e.type).join(', ')}`))
    // Warn for any type missing a SAS token
    for (const e of entries) {
      if (!resolveToken(e.type, sasEntries)) {
        console.log('    ' + warn(`no SAS token for "${e.type}" — fetches will use global fallback or fail`))
        totalWarnings++
      }
    }
  } else if (!fixturesOnly) {
    console.log('  ' + warn('REPORT_NAMES         not set — no blobs to discover'))
    totalWarnings++
  }

  if (process.env['AUTH_HASH']) {
    console.log('  ' + note('AUTH_HASH set — auth is enabled (validator calls Azure directly, bypasses auth gate)'))
  }

  // ── Live blobs
  const liveKeysByType: Record<string, string[]> = {}

  if (!fixturesOnly) {
    console.log(hd('■  Live Blobs'))

    if (!baseUrl || entries.length === 0) {
      console.log('  ' + warn('Skipped — AZURE_BLOB_BASE_URL and/or REPORT_NAMES not configured'))
      totalWarnings++
    } else {
      for (const entry of entries) {
        const token = resolveToken(entry.type, sasEntries)
        console.log(`\n  ${C.bold}${entry.type}${C.reset}  ${C.dim}→  ${entry.storagePath}${C.reset}`)

        const result = await validateLiveBlob(entry, baseUrl, token)
        tally(result)

        for (const l of result.lines) console.log(`    ${l}`)

        if (result.topKeys.length > 0) liveKeysByType[entry.type] = result.topKeys
      }
    }
  }

  // ── Drift: compare live top-level keys against fixture key union
  if (Object.keys(liveKeysByType).length > 0) {
    console.log(hd('■  Drift  (live blob keys vs fixtures)'))

    const fixtureBase = path.resolve('fixtures')
    for (const [rType, liveKeys] of Object.entries(liveKeysByType)) {
      const fDir = path.join(fixtureBase, rType)
      if (!fs.existsSync(fDir)) {
        console.log(`  ${note(`${rType}: no fixtures directory — cannot compare`)}`)
        continue
      }

      // Union of top-level keys across all non-future fixtures for this type
      const fixtureKeys = new Set<string>()
      for (const f of fs.readdirSync(fDir).filter(f => f.endsWith('.json') && !f.includes(':') && f !== 'future.json')) {
        try {
          const d = JSON.parse(fs.readFileSync(path.join(fDir, f), 'utf-8'))
          if (typeof d === 'object' && d !== null) Object.keys(d).forEach(k => fixtureKeys.add(k))
        } catch {}
      }

      const liveSet    = new Set(liveKeys)
      const liveOnly   = liveKeys.filter(k => !fixtureKeys.has(k))
      const fixOnly    = [...fixtureKeys].filter(k => !liveSet.has(k))

      if (liveOnly.length === 0 && fixOnly.length === 0) {
        console.log('  ' + ok(`${rType}  top-level keys match fixtures`))
      } else {
        if (liveOnly.length > 0) {
          console.log('  ' + warn(`${rType}  live has keys not in any fixture: ${liveOnly.map(k => `"${k}"`).join(', ')}`))
          totalWarnings++
        }
        if (fixOnly.length > 0) {
          console.log('  ' + warn(`${rType}  fixture has keys not in live blob:  ${fixOnly.map(k => `"${k}"`).join(', ')}`))
          totalWarnings++
        }
      }
    }
  }

  // ── Fixtures
  console.log(hd('■  Fixtures'))

  const fixtureBase = path.resolve('fixtures')
  const ftypes = fs.existsSync(fixtureBase)
    ? fs.readdirSync(fixtureBase).filter(d => {
        try { return fs.statSync(path.join(fixtureBase, d)).isDirectory() }
        catch { return false }
      })
    : []

  if (ftypes.length === 0) {
    console.log('  ' + warn('No fixture directories found'))
    totalWarnings++
  }

  for (const rType of ftypes) {
    const fDir  = path.join(fixtureBase, rType)
    const files = fs.readdirSync(fDir).filter(f => f.endsWith('.json') && !f.includes(':'))
    if (files.length === 0) continue

    console.log(`\n  ${C.bold}${rType}/${C.reset}`)

    for (const f of files) {
      const result = validateFixture(path.join(fDir, f), rType)
      tally(result)

      const icon = result.errors.length > 0   ? `${C.red}✗${C.reset}`
                 : result.warnings.length > 0 ? `${C.yellow}⚠${C.reset}`
                 : `${C.green}✓${C.reset}`
      console.log(`    ${icon} ${C.dim}${f}${C.reset}`)
      for (const l of result.lines) console.log(`      ${l}`)
    }
  }

  // ── Summary
  console.log(`\n${C.bold}${C.cyan}────────────────────────────────────────────────${C.reset}`)
  if (totalErrors === 0 && totalWarnings === 0) {
    console.log(`${C.bold}${C.green}  All checks passed.${C.reset}`)
  } else {
    const parts: string[] = []
    if (totalErrors   > 0) parts.push(`${C.bold}${C.red}${totalErrors} error(s)${C.reset}`)
    if (totalWarnings > 0) parts.push(`${C.yellow}${totalWarnings} warning(s)${C.reset}`)
    console.log(`  ${parts.join('   ')}`)
  }
  console.log(`${C.bold}${C.cyan}────────────────────────────────────────────────${C.reset}\n`)

  process.exit(totalErrors > 0 ? 1 : 0)
}

main().catch(e => { console.error('\nValidator crashed:', e); process.exit(2) })
