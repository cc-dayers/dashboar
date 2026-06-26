/**
 * Proxy for arbitrary blob paths. Used by the generation pipeline via
 * proxyPath: "/api/blob?path=<relative-path>" on trace and artifact refs.
 * Adds CORS headers for trace.playwright.dev so the trace viewer can load
 * trace zip files directly from here.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

// Allow any origin — the blob is gated by a SAS token, and the self-hosted trace
// viewer's service worker must be able to fetch from here same-site without restriction.
const CORS_ORIGIN = '*'

function isAuthenticated(cookieHeader: string | string[] | undefined): boolean {
  const authHash = process.env['AUTH_HASH']
  if (!authHash) return true
  const header = Array.isArray(cookieHeader) ? cookieHeader.join('; ') : cookieHeader
  if (!header) return false
  let token: string | null = null
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq !== -1 && part.slice(0, eq).trim() === 'dashboar_session') { token = part.slice(eq + 1).trim() || null; break }
  }
  if (!token) return false
  try {
    const decoded  = Buffer.from(token, 'base64').toString('utf-8')
    const colonIdx = decoded.indexOf(':')
    if (colonIdx < 1) return false
    const allowed = (process.env['AUTHORIZED_USERS'] ?? '').split(',').map(s => s.trim()).filter(Boolean)
    return allowed.includes(decoded.slice(0, colonIdx)) && decoded.slice(colonIdx + 1) === authHash
  } catch { return false }
}

function resolveToken(reportType: string): string | undefined {
  const perType = process.env['AZURE_SAS_TOKENS'] ?? ''
  for (const entry of perType.split(',').map(s => s.trim()).filter(Boolean)) {
    const colon = entry.indexOf(':')
    if (colon === -1) continue
    if (entry.slice(0, colon) === reportType) return entry.slice(colon + 1) || undefined
  }
  return process.env['AZURE_SAS_TOKEN']
}

// blobPaths stored in report JSON are relative to the Azure container root (e.g. "reports/...").
// REPORT_NAMES encodes the full storage path as "<container>/<prefix>" (e.g. "playwright/reports").
// We extract just the container name and prepend it so the final URL is:
//   AZURE_BLOB_BASE_URL / <container> / <blobPath>
function resolveContainer(reportType: string): string {
  const reportNames = process.env['REPORT_NAMES'] ?? ''
  for (const entry of reportNames.split(',').map(s => s.trim()).filter(Boolean)) {
    const colon = entry.indexOf(':')
    if (colon === -1) continue
    if (entry.slice(0, colon) !== reportType) continue
    const storagePath = entry.slice(colon + 1)
    const slash = storagePath.indexOf('/')
    return slash !== -1 ? storagePath.slice(0, slash) : storagePath
  }
  return ''
}

function buildUrl(baseUrl: string, blobPath: string, sasToken: string | undefined): string {
  const url = new URL(baseUrl)
  const segments = blobPath.split('/').filter(Boolean).map(s => encodeURIComponent(s))
  url.pathname = [url.pathname.replace(/\/$/, ''), ...segments].join('/')
  if (sasToken) {
    const token = sasToken.startsWith('?') ? sasToken.slice(1) : sasToken
    new URLSearchParams(token).forEach((v, k) => url.searchParams.set(k, v))
  }
  return url.toString()
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN)
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept')
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Content-Type, Accept-Ranges')

  if (req.method === 'OPTIONS') return res.status(204).end()

  if (!isAuthenticated(req.headers['cookie'])) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const rawPath   = req.query['path']
  const blobPath  = (Array.isArray(rawPath) ? rawPath[0] : rawPath) ?? ''
  const rawReport = req.query['report']
  const reportType = (Array.isArray(rawReport) ? rawReport[0] : rawReport) ?? 'playwright-trace'

  if (!blobPath) return res.status(400).json({ error: 'Missing required query parameter: path' })

  if (/^https?:\/\//i.test(blobPath) || blobPath.startsWith('//') || blobPath.includes('..')) {
    return res.status(400).json({ error: 'Invalid path: must be a relative storage path' })
  }

  const baseUrl = process.env['AZURE_BLOB_BASE_URL']
  if (!baseUrl) return res.status(500).json({ error: 'Server misconfiguration: no AZURE_BLOB_BASE_URL' })

  const sasToken  = resolveToken(reportType)
  const container = resolveContainer(reportType)
  // Prepend container if not already present (blobPaths from JSON lack the container segment)
  const fullPath  = container && !blobPath.startsWith(`${container}/`)
    ? `${container}/${blobPath}`
    : blobPath

  let artifactUrl: string
  try {
    artifactUrl = buildUrl(baseUrl, fullPath, sasToken)
  } catch {
    return res.status(500).json({ error: 'Server misconfiguration: AZURE_BLOB_BASE_URL is not a valid URL' })
  }

  console.log(`[api/blob] fetching (container=${container || 'none'}) → ${artifactUrl.replace(/sig=[^&]+/, 'sig=***')}`)

  let upstream: Response
  try {
    upstream = await fetch(artifactUrl, {
      headers: req.headers['range'] ? { Range: req.headers['range'] as string } : {},
    })
  } catch (err) {
    return res.status(500).json({ error: `Failed to fetch: ${err instanceof Error ? err.message : 'Unknown error'}` })
  }

  if (upstream.status === 404) return res.status(404).json({ error: `Not found: ${blobPath}` })
  if (!upstream.ok)            return res.status(502).json({ error: `Upstream error: HTTP ${upstream.status}` })

  const contentType   = upstream.headers.get('content-type')   ?? 'application/octet-stream'
  const contentLength = upstream.headers.get('content-length')
  const acceptRanges  = upstream.headers.get('accept-ranges')
  const contentRange  = upstream.headers.get('content-range')

  res.setHeader('Content-Type', contentType)
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=300')
  if (contentLength) res.setHeader('Content-Length', contentLength)
  if (acceptRanges)  res.setHeader('Accept-Ranges',  acceptRanges)
  if (contentRange)  res.setHeader('Content-Range',  contentRange)

  const buffer = await upstream.arrayBuffer()
  return res.status(upstream.status === 206 ? 206 : 200).send(Buffer.from(buffer))
}
