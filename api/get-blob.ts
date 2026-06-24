import * as fs from 'node:fs'
import * as path from 'node:path'
import type { VercelRequest, VercelResponse } from '@vercel/node'

function buildBlobUrl(baseUrl: string, storagePath: string, id: string, sasToken: string | undefined): string {
  const url = new URL(baseUrl)
  const segments = storagePath.split('/').filter(Boolean).map(s => encodeURIComponent(s))
  url.pathname = [url.pathname.replace(/\/$/, ''), ...segments, `${encodeURIComponent(id)}.json`].join('/')
  if (sasToken) {
    const token = sasToken.startsWith('?') ? sasToken.slice(1) : sasToken
    new URLSearchParams(token).forEach((v, k) => url.searchParams.set(k, v))
  }
  return url.toString()
}

// Resolves the SAS token for a report type.
// AZURE_SAS_TOKENS format: "type:token,type:token"
// Split on first ':' only — SAS tokens contain ':' inside timestamps (e.g. st=2026-04-25T00:19:11Z).
// Commas are safe delimiters because SAS tokens encode commas as %2C.
// Falls back to AZURE_SAS_TOKEN if no per-type entry is found.
function resolveToken(reportType: string): string | undefined {
  const perType = process.env['AZURE_SAS_TOKENS'] ?? ''
  for (const entry of perType.split(',').map(s => s.trim()).filter(Boolean)) {
    const colon = entry.indexOf(':')
    if (colon === -1) continue
    if (entry.slice(0, colon) === reportType) return entry.slice(colon + 1) || undefined
  }
  return process.env['AZURE_SAS_TOKEN']
}

interface ResolvedEntry { storagePath: string; defaultId: string | null }

function resolveEntry(reportType: string): ResolvedEntry {
  const raw = process.env['REPORT_NAMES'] ?? ''
  for (const entry of raw.split(',').map(s => s.trim()).filter(Boolean)) {
    const firstColon = entry.indexOf(':')
    if (firstColon === -1) {
      if (entry === reportType) return { storagePath: entry, defaultId: null }
      continue
    }
    const type = entry.slice(0, firstColon)
    if (type !== reportType) continue
    const rest = entry.slice(firstColon + 1)
    const lastColon = rest.lastIndexOf(':')
    if (lastColon === -1) return { storagePath: rest, defaultId: null }
    return { storagePath: rest.slice(0, lastColon), defaultId: rest.slice(lastColon + 1) || null }
  }
  return { storagePath: reportType, defaultId: null }
}

function tryServeFixture(reportType: string, id: string, res: VercelResponse): boolean {
  const fixtureSecret = process.env['FIXTURE_SECRET']
  if (!fixtureSecret) return false

  const candidates = [
    path.resolve('fixtures', reportType, `${id}.json`),
    path.resolve('fixtures', `${id}.json`),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      console.log(`[api] fixture  → ${p}`)
      const data = JSON.parse(fs.readFileSync(p, 'utf-8')) as unknown
      res.status(200).json(data)
      return true
    }
  }
  res.status(404).json({ error: `Fixture '${id}' not found` })
  return true
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const rawReport  = req.query['report']
  const reportType = (Array.isArray(rawReport) ? rawReport[0] : rawReport) ?? ''

  if (!reportType) {
    return res.status(400).json({ error: 'Missing required query parameter: report' })
  }

  // rawId is only set when the caller explicitly passed ?id=
  const rawId    = req.query['id'] ?? req.query['reportId']
  const rawIdStr = (Array.isArray(rawId) ? rawId[0] : rawId) ?? null  // null = not provided

  const rawFixture    = req.query['_fixture']
  const fixtureParam  = Array.isArray(rawFixture) ? rawFixture[0] : rawFixture
  const fixtureSecret = process.env['FIXTURE_SECRET']
  if (fixtureParam && fixtureSecret && fixtureParam === fixtureSecret) {
    const fixtureId = rawIdStr ?? 'report'
    return tryServeFixture(reportType, fixtureId, res)
  }

  const baseUrl = process.env['AZURE_BLOB_BASE_URL']
  if (!baseUrl) {
    return res.status(500).json({ error: 'Server misconfiguration: no AZURE_BLOB_BASE_URL configured' })
  }

  // Explicit ?path= override takes precedence over REPORT_NAMES lookup
  const rawPath    = req.query['path']
  const { storagePath: resolvedPath, defaultId } = resolveEntry(reportType)
  const storagePath = (Array.isArray(rawPath) ? rawPath[0] : rawPath) || resolvedPath

  const sasToken = resolveToken(reportType)

  // Determine which filename(s) to try:
  //   explicit ?id=  →  that one only
  //   REPORT_NAMES 3rd segment →  that one only
  //   otherwise  →  'report' first, then {reportType} as fallback
  const candidates: string[] = rawIdStr
    ? [rawIdStr]
    : defaultId
    ? [defaultId]
    : ['report', reportType]

  for (const id of candidates) {
    let blobUrl: string
    try {
      blobUrl = buildBlobUrl(baseUrl, storagePath, id, sasToken)
    } catch {
      return res.status(500).json({ error: 'Server misconfiguration: AZURE_BLOB_BASE_URL is not a valid URL' })
    }

    console.log(`[api] fetching → ${blobUrl}`)
    let upstream: Response
    try {
      upstream = await fetch(blobUrl)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return res.status(500).json({ error: `Failed to fetch report: ${message}` })
    }

    console.log(`[api] azure response: HTTP ${upstream.status} (candidate: ${id})`)

    if (upstream.status === 404) {
      // Try next candidate; if this was the last one, fall through to final 404
      continue
    }
    if (!upstream.ok) {
      return res.status(502).json({ error: `Upstream storage error: HTTP ${upstream.status}` })
    }

    const data: unknown = await upstream.json()
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    return res.status(200).json(data)
  }

  // All candidates 404'd
  const triedNames = candidates.map(c => `${c}.json`).join(', ')
  return res.status(404).json({ error: `Report not found at path '${storagePath}' (tried: ${triedNames})` })
}
