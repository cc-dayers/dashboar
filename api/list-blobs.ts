import type { VercelRequest, VercelResponse } from '@vercel/node'

export interface BlobEntry {
  id:            string
  reportType:    string
  storagePath:   string
  lastModified?: string
  sizeBytes?:    number
}

interface ReportEntry {
  type:        string
  storagePath: string
  defaultId:   string | null  // null → auto-detect: try 'report' then {type}
}

function parseReportNames(): ReportEntry[] {
  const raw = process.env['REPORT_NAMES'] ?? ''
  return raw.split(',').map(s => s.trim()).filter(Boolean).map(entry => {
    const firstColon = entry.indexOf(':')
    if (firstColon === -1) return { type: entry, storagePath: entry, defaultId: null }
    const type = entry.slice(0, firstColon)
    const rest  = entry.slice(firstColon + 1)
    const lastColon = rest.lastIndexOf(':')
    if (lastColon === -1) return { type, storagePath: rest, defaultId: null }
    return { type, storagePath: rest.slice(0, lastColon), defaultId: rest.slice(lastColon + 1) || null }
  })
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

function buildUrl(baseUrl: string, storagePath: string, id: string, sasToken: string | undefined): string {
  const url = new URL(baseUrl)
  const segs = storagePath.split('/').filter(Boolean).map(s => encodeURIComponent(s))
  url.pathname = [url.pathname.replace(/\/$/, ''), ...segs, `${encodeURIComponent(id)}.json`].join('/')
  if (sasToken) {
    const token = sasToken.startsWith('?') ? sasToken.slice(1) : sasToken
    new URLSearchParams(token).forEach((v, k) => url.searchParams.set(k, v))
  }
  return url.toString()
}

async function probe(url: string): Promise<{ ok: boolean; lastModified?: string; sizeBytes?: number }> {
  const r = await fetch(url, { method: 'HEAD' })
  if (!r.ok) return { ok: false }
  const cl = r.headers.get('content-length')
  return {
    ok: true,
    lastModified: r.headers.get('last-modified') ?? undefined,
    sizeBytes:    cl ? parseInt(cl, 10) : undefined,
  }
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const baseUrl = process.env['AZURE_BLOB_BASE_URL']
  const entries = parseReportNames()

  if (!baseUrl || entries.length === 0) {
    return res.status(200).json({ blobs: [] })
  }

  const settled = await Promise.allSettled(
    entries.map(async ({ type, storagePath, defaultId }): Promise<BlobEntry | null> => {
      const sasToken = resolveToken(type)
      const candidates = defaultId ? [defaultId] : ['report', type]

      for (const id of candidates) {
        const url = buildUrl(baseUrl, storagePath, id, sasToken)
        const result = await probe(url)
        if (result.ok) {
          return { id, reportType: type, storagePath, lastModified: result.lastModified, sizeBytes: result.sizeBytes }
        }
      }
      return null
    }),
  )

  const blobs = settled.flatMap(r => r.status === 'fulfilled' && r.value ? [r.value] : [])
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60')
  return res.status(200).json({ blobs })
}
