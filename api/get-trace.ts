import type { VercelRequest, VercelResponse } from '@vercel/node'

const CORS_ORIGIN = 'https://trace.playwright.dev'

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

function resolveStoragePath(reportType: string): string {
  const reportNames = process.env['REPORT_NAMES'] ?? ''
  for (const entry of reportNames.split(',').map(s => s.trim()).filter(Boolean)) {
    const colon = entry.indexOf(':')
    if (colon === -1) {
      if (entry === reportType) return entry
    } else {
      if (entry.slice(0, colon) === reportType) return entry.slice(colon + 1)
    }
  }
  return reportType
}

function buildTraceUrl(baseUrl: string, storagePath: string, id: string, sasToken: string | undefined): string {
  const url = new URL(baseUrl)
  const segments = storagePath.split('/').filter(Boolean).map(s => encodeURIComponent(s))
  url.pathname = [url.pathname.replace(/\/$/, ''), ...segments, id].join('/')
  if (sasToken) {
    const token = sasToken.startsWith('?') ? sasToken.slice(1) : sasToken
    new URLSearchParams(token).forEach((v, k) => url.searchParams.set(k, v))
  }
  return url.toString()
}

function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN)
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept')
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Content-Type, Accept-Ranges')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res)

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (!isAuthenticated(req.headers['cookie'])) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const rawId = req.query['id']
  const id = (Array.isArray(rawId) ? rawId[0] : rawId) ?? ''

  if (!id) {
    return res.status(400).json({ error: 'Missing id parameter' })
  }

  const rawReport = req.query['report']
  const reportType = (Array.isArray(rawReport) ? rawReport[0] : rawReport) ?? ''

  const baseUrl = process.env['AZURE_BLOB_BASE_URL']
  if (!baseUrl) {
    return res.status(500).json({ error: 'Server misconfiguration: no AZURE_BLOB_BASE_URL configured' })
  }

  const rawPath = req.query['path']
  const storagePath = (Array.isArray(rawPath) ? rawPath[0] : rawPath) || resolveStoragePath(reportType)

  const sasToken = process.env['AZURE_SAS_TOKEN']
  const traceUrl = buildTraceUrl(baseUrl, storagePath, id, sasToken)

  try {
    console.log(`[api/get-trace] fetching → ${traceUrl.replace(/sig=[^&]+/, 'sig=***')}`)
    const upstream = await fetch(traceUrl)
    console.log(`[api/get-trace] azure response: HTTP ${upstream.status}`)

    if (upstream.status === 404) {
      return res.status(404).json({ error: `Trace '${id}' not found` })
    }
    if (!upstream.ok) {
      return res.status(502).json({ error: `Upstream storage error: HTTP ${upstream.status}` })
    }

    const contentType   = upstream.headers.get('content-type')   ?? 'application/zip'
    const contentLength = upstream.headers.get('content-length')
    const acceptRanges  = upstream.headers.get('accept-ranges')

    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60')
    if (contentLength) res.setHeader('Content-Length', contentLength)
    if (acceptRanges)  res.setHeader('Accept-Ranges',  acceptRanges)

    const buffer = await upstream.arrayBuffer()
    return res.status(200).send(Buffer.from(buffer))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[api/get-trace]', err)
    return res.status(500).json({ error: `Failed to fetch trace: ${message}` })
  }
}
