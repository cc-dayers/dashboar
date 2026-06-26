import type { VercelRequest, VercelResponse } from '@vercel/node'

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(204).end()

  if (!isAuthenticated(req.headers['cookie'])) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const rawUrl = req.query['url']
  const htmlUrl = (Array.isArray(rawUrl) ? rawUrl[0] : rawUrl) ?? ''

  const rawReport  = req.query['report']
  const reportType = (Array.isArray(rawReport) ? rawReport[0] : rawReport) ?? ''

  if (!htmlUrl) return res.status(400).json({ error: 'Missing required query parameter: url' })

  // Validate the URL points to our configured storage account — reject anything else
  const baseUrl = process.env['AZURE_BLOB_BASE_URL']
  if (!baseUrl) return res.status(500).json({ error: 'Server misconfiguration: no AZURE_BLOB_BASE_URL' })

  let parsedBase: URL
  let parsedHtml: URL
  try {
    parsedBase = new URL(baseUrl)
    parsedHtml = new URL(htmlUrl)
  } catch {
    return res.status(400).json({ error: 'Invalid URL' })
  }

  if (parsedHtml.hostname !== parsedBase.hostname) {
    return res.status(400).json({ error: 'URL must point to the configured storage account' })
  }

  // Append SAS token to the incoming URL
  const sasToken = resolveToken(reportType)
  if (sasToken) {
    const token = sasToken.startsWith('?') ? sasToken.slice(1) : sasToken
    new URLSearchParams(token).forEach((v, k) => parsedHtml.searchParams.set(k, v))
  }

  console.log(`[api/get-html-report] fetching → ${parsedHtml.toString().replace(/sig=[^&]+/, 'sig=***')}`)

  let upstream: Response
  try {
    upstream = await fetch(parsedHtml.toString())
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return res.status(500).json({ error: `Failed to fetch report: ${message}` })
  }

  console.log(`[api/get-html-report] azure response: HTTP ${upstream.status}`)

  if (upstream.status === 404) return res.status(404).send('<p>Report not found.</p>')
  if (!upstream.ok)            return res.status(502).send(`<p>Upstream storage error: HTTP ${upstream.status}</p>`)

  const contentType = upstream.headers.get('content-type') ?? 'text/html; charset=utf-8'
  res.setHeader('Content-Type', contentType.includes('html') ? contentType : 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60')
  // Allow the served HTML to load resources from blob storage directly
  res.setHeader('Content-Security-Policy', "default-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data: *.blob.core.windows.net *.msecnd.net")

  const buffer = await upstream.arrayBuffer()
  return res.status(200).send(Buffer.from(buffer))
}
