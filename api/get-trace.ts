import type { VercelRequest, VercelResponse } from '@vercel/node'

const CORS_ORIGIN = 'https://trace.playwright.dev'

function resolveBaseUrl(reportType: string): string | undefined {
  if (reportType) {
    const envKey = `AZURE_BLOB_${reportType.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_URL`
    const perTypeUrl = process.env[envKey]
    if (perTypeUrl) return perTypeUrl
  }
  return process.env['AZURE_BLOB_BASE_URL']
}

function resolveSasToken(reportType: string): string | undefined {
  if (reportType) {
    const envKey = `AZURE_SAS_${reportType.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_TOKEN`
    const perTypeToken = process.env[envKey]
    if (perTypeToken) return perTypeToken
  }
  return process.env['AZURE_SAS_TOKEN']
}

function buildTraceUrl(baseUrl: string, id: string, sasToken: string | undefined): string {
  const url = new URL(baseUrl)
  // id is the full blob key including extension — no .json appended
  url.pathname = `${url.pathname.replace(/\/$/, '')}/${id}`
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

  const rawId = req.query['id']
  const id = (Array.isArray(rawId) ? rawId[0] : rawId) ?? ''

  if (!id) {
    return res.status(400).json({ error: 'Missing id parameter' })
  }

  const rawReport = req.query['report']
  const reportType = (Array.isArray(rawReport) ? rawReport[0] : rawReport) ?? ''

  const baseUrl = resolveBaseUrl(reportType)
  if (!baseUrl) {
    return res.status(500).json({ error: 'Server misconfiguration: no AZURE_BLOB_BASE_URL configured' })
  }

  const traceUrl = buildTraceUrl(baseUrl, id, resolveSasToken(reportType))

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

    const contentType    = upstream.headers.get('content-type')    ?? 'application/zip'
    const contentLength  = upstream.headers.get('content-length')
    const acceptRanges   = upstream.headers.get('accept-ranges')

    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60')
    if (contentLength)  res.setHeader('Content-Length',  contentLength)
    if (acceptRanges)   res.setHeader('Accept-Ranges',   acceptRanges)

    const buffer = await upstream.arrayBuffer()
    return res.status(200).send(Buffer.from(buffer))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[api/get-trace]', err)
    return res.status(500).json({ error: `Failed to fetch trace: ${message}` })
  }
}
