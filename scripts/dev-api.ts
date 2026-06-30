import { config } from 'dotenv'
import * as fs from 'node:fs'
import * as http from 'node:http'
import * as nodeUrl from 'node:url'
import * as path from 'node:path'

config({ path: '.env.local' })
config()

const PORT = 3001

// ── Shared helpers ─────────────────────────────────────────────────────────────

interface ReportEntry {
  type:        string
  storagePath: string
  defaultId:   string | null
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

function resolveEntry(reportType: string): ReportEntry {
  const entries = parseReportNames()
  const found = entries.find(e => e.type === reportType)
  return found ?? { type: reportType, storagePath: reportType, defaultId: null }
}

// Check AZURE_SAS_TOKENS ("type:token,type:token") first, fall back to AZURE_SAS_TOKEN.
// Split on first ':' only — SAS tokens contain ':' inside timestamps.
// Commas are safe delimiters because SAS tokens encode commas as %2C.
function resolveToken(reportType: string): string | undefined {
  const perType = process.env['AZURE_SAS_TOKENS'] ?? ''
  for (const entry of perType.split(',').map(s => s.trim()).filter(Boolean)) {
    const colon = entry.indexOf(':')
    if (colon === -1) continue
    if (entry.slice(0, colon) === reportType) return entry.slice(colon + 1) || undefined
  }
  // Also check per-type env var: AZURE_SAS_PR_REVIEW_TOKEN etc.
  if (reportType) {
    const envKey = `AZURE_SAS_${reportType.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_TOKEN`
    const perTypeEnv = process.env[envKey]
    if (perTypeEnv) return perTypeEnv
  }
  return process.env['AZURE_SAS_TOKEN']
}

function buildBlobUrl(baseUrl: string, storagePath: string, id: string, sasToken: string | undefined): string {
  const url = new URL(baseUrl)
  const segs = storagePath.split('/').filter(Boolean).map(s => encodeURIComponent(s))
  url.pathname = [url.pathname.replace(/\/$/, ''), ...segs, `${encodeURIComponent(id)}.json`].join('/')
  if (sasToken) {
    const token = sasToken.startsWith('?') ? sasToken.slice(1) : sasToken
    new URLSearchParams(token).forEach((v, k) => url.searchParams.set(k, v))
  }
  return url.toString()
}

function buildTraceUrl(baseUrl: string, storagePath: string, id: string, sasToken: string | undefined): string {
  const url = new URL(baseUrl)
  const segs = storagePath.split('/').filter(Boolean).map(s => encodeURIComponent(s))
  url.pathname = [url.pathname.replace(/\/$/, ''), ...segs, id].join('/')
  if (sasToken) {
    const token = sasToken.startsWith('?') ? sasToken.slice(1) : sasToken
    new URLSearchParams(token).forEach((v, k) => url.searchParams.set(k, v))
  }
  return url.toString()
}

function tryServeFixture(reportType: string, id: string, res: http.ServerResponse): boolean {
  const fixturesRoot = path.resolve('fixtures')
  const candidates = [
    path.resolve(fixturesRoot, reportType, `${id}.json`),
    path.resolve(fixturesRoot, `${id}.json`),
  ]
  for (const p of candidates) {
    if (!p.startsWith(fixturesRoot + path.sep)) continue
    if (fs.existsSync(p)) {
      console.log(`[api] fixture  → ${p}`)
      const data = fs.readFileSync(p, 'utf-8')
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(data)
      return true
    }
  }
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: `Fixture '${id}' not found in fixtures/${reportType}/ or fixtures/` }))
  return true
}

// ── Auth ───────────────────────────────────────────────────────────────────────

function isAuthenticated(cookieHeader: string | undefined): boolean {
  const authHash = process.env['AUTH_HASH']
  if (!authHash) return true
  const token = parseCookie(cookieHeader, 'dashboar_session')
  if (!token) return false
  return validateToken(token).valid
}

function parseCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=')
    if (eq !== -1 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim() || null
  }
  return null
}

function validateToken(token: string): { valid: boolean; user?: string } {
  const authHash = process.env['AUTH_HASH']
  if (!authHash) return { valid: true, user: 'dev' }
  try {
    const decoded  = Buffer.from(token, 'base64').toString('utf-8')
    const colonIdx = decoded.indexOf(':')
    if (colonIdx < 1) return { valid: false }
    const user     = decoded.slice(0, colonIdx)
    const hashPart = decoded.slice(colonIdx + 1)
    const allowed  = (process.env['AUTHORIZED_USERS'] ?? '').split(',').map(s => s.trim()).filter(Boolean)
    if (!allowed.includes(user) || hashPart !== authHash) return { valid: false }
    return { valid: true, user }
  } catch {
    return { valid: false }
  }
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => { data += chunk })
    req.on('end',  ()    => resolve(data))
    req.on('error', reject)
  })
}

async function handleAuth(req: http.IncomingMessage, res: http.ServerResponse) {
  res.setHeader('Content-Type', 'application/json')
  const authEnabled = Boolean(process.env['AUTH_HASH'])

  if (req.method === 'GET') {
    if (!authEnabled) {
      res.writeHead(200)
      return res.end(JSON.stringify({ ok: true, authEnabled: false }))
    }
    const token = parseCookie(req.headers['cookie'], 'dashboar_session')
    if (!token) {
      res.writeHead(200)
      return res.end(JSON.stringify({ ok: false, authEnabled: true }))
    }
    const result = validateToken(token)
    res.writeHead(200)
    return res.end(JSON.stringify({ ok: result.valid, authEnabled: true, user: result.user ?? null }))
  }

  if (req.method === 'POST') {
    let body: { token?: string } = {}
    try {
      const raw = await readBody(req)
      body = JSON.parse(raw) as { token?: string }
    } catch { /* ignore parse errors */ }
    const token = (body.token ?? '').trim()
    if (!token) {
      res.writeHead(400)
      return res.end(JSON.stringify({ ok: false, error: 'Missing token' }))
    }
    const result = validateToken(token)
    if (!result.valid) {
      res.writeHead(401)
      return res.end(JSON.stringify({ ok: false, error: 'Invalid credentials' }))
    }
    const maxAge = 60 * 60 * 24 * 30
    res.setHeader('Set-Cookie', [
      `dashboar_session=${token}; Path=/; Max-Age=${maxAge}; SameSite=Strict; HttpOnly`,
      `dashboar_session_present=1; Path=/; Max-Age=${maxAge}; SameSite=Strict`,
    ])
    res.writeHead(200)
    return res.end(JSON.stringify({ ok: true, user: result.user }))
  }

  res.writeHead(405)
  return res.end(JSON.stringify({ error: 'Method not allowed' }))
}

// ── Get blob ───────────────────────────────────────────────────────────────────

async function handleGetBlob(
  query: NodeJS.Dict<string | string[]>,
  res: http.ServerResponse,
) {
  res.setHeader('Content-Type', 'application/json')

  const rawReport  = query['report']
  const reportType = (Array.isArray(rawReport) ? rawReport[0] : rawReport) ?? ''

  const rawId    = query['id'] ?? query['reportId']
  const rawIdStr = (Array.isArray(rawId) ? rawId[0] : rawId) ?? null

  // Fixture shortcut — any ?_fixture= triggers local fixture serving
  const rawFixture   = query['_fixture']
  const fixtureParam = Array.isArray(rawFixture) ? rawFixture[0] : rawFixture
  if (fixtureParam) {
    return tryServeFixture(reportType, rawIdStr ?? 'report', res)
  }

  const baseUrl = process.env['AZURE_BLOB_BASE_URL']
  if (!baseUrl) {
    res.writeHead(500)
    return res.end(JSON.stringify({ error: 'Server misconfiguration: no AZURE_BLOB_BASE_URL configured' }))
  }

  // Explicit ?path= override
  const rawPath = query['path']
  const { storagePath: resolvedPath, defaultId } = resolveEntry(reportType)
  const storagePath = (Array.isArray(rawPath) ? rawPath[0] : rawPath) || resolvedPath

  const sasToken   = resolveToken(reportType)
  const candidates = rawIdStr ? [rawIdStr] : defaultId ? [defaultId] : ['report', reportType]

  for (const id of candidates) {
    const blobUrl = buildBlobUrl(baseUrl, storagePath, id, sasToken)
    console.log(`[api] fetching → ${blobUrl.replace(/sig=[^&]+/, 'sig=***')}`)

    let upstream: Response
    try {
      upstream = await fetch(blobUrl)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      res.writeHead(500)
      return res.end(JSON.stringify({ error: `Failed to fetch report: ${message}` }))
    }

    console.log(`[api] azure response: HTTP ${upstream.status} (candidate: ${id})`)

    if (upstream.status === 404) continue
    if (!upstream.ok) {
      res.writeHead(502)
      return res.end(JSON.stringify({ error: `Upstream storage error: HTTP ${upstream.status}` }))
    }

    const data: unknown = await upstream.json()
    res.writeHead(200)
    return res.end(JSON.stringify(data))
  }

  const triedNames = candidates.map(c => `${c}.json`).join(', ')
  res.writeHead(404)
  return res.end(JSON.stringify({ error: `Report not found at path '${storagePath}' (tried: ${triedNames})` }))
}

// ── List blobs ─────────────────────────────────────────────────────────────────
// Uses REPORT_NAMES + probe (HEAD request per candidate), matching the Vercel function.

async function handleListBlobs(
  _query: NodeJS.Dict<string | string[]>,
  res: http.ServerResponse,
) {
  res.setHeader('Content-Type', 'application/json')

  const baseUrl = process.env['AZURE_BLOB_BASE_URL']
  const entries = parseReportNames()

  if (!baseUrl || entries.length === 0) {
    res.writeHead(200)
    return res.end(JSON.stringify({ blobs: [] }))
  }

  const settled = await Promise.allSettled(
    entries.map(async ({ type, storagePath, defaultId }) => {
      const sasToken   = resolveToken(type)
      const candidates = defaultId ? [defaultId] : ['report', type]

      for (const id of candidates) {
        const blobUrl = buildBlobUrl(baseUrl, storagePath, id, sasToken)
        console.log(`[api/list-blobs] probing → ${blobUrl.replace(/sig=[^&]+/, 'sig=***')}`)
        try {
          const r = await fetch(blobUrl, { method: 'HEAD' })
          if (r.ok) {
            const lastModified = r.headers.get('last-modified') ?? undefined
            const cl           = r.headers.get('content-length')
            return { id, reportType: type, storagePath, lastModified, sizeBytes: cl ? parseInt(cl, 10) : undefined }
          }
        } catch { /* try next candidate */ }
      }
      return null
    }),
  )

  const blobs = settled.flatMap(r => r.status === 'fulfilled' && r.value ? [r.value] : [])
  res.writeHead(200)
  return res.end(JSON.stringify({ blobs }))
}

// ── Get artifact ──────────────────────────────────────────────────────────────
// Fetches an arbitrary blob by blobPath (a storage-relative path).
// Mirrors api/get-artifact.ts for local dev.

function buildArtifactUrl(baseUrl: string, blobPath: string, sasToken: string | undefined): string {
  const url = new URL(baseUrl)
  const segments = blobPath.split('/').filter(Boolean).map(s => encodeURIComponent(s))
  url.pathname = [url.pathname.replace(/\/$/, ''), ...segments].join('/')
  if (sasToken) {
    const token = sasToken.startsWith('?') ? sasToken.slice(1) : sasToken
    new URLSearchParams(token).forEach((v, k) => url.searchParams.set(k, v))
  }
  return url.toString()
}

async function handleGetArtifact(
  query: NodeJS.Dict<string | string[]>,
  res: http.ServerResponse,
) {
  const CORS_ORIGIN = 'https://trace.playwright.dev'
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN)
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept')
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Content-Type, Accept-Ranges')

  const rawBlobPath = query['blobPath']
  const blobPath    = (Array.isArray(rawBlobPath) ? rawBlobPath[0] : rawBlobPath) ?? ''

  if (!blobPath) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: 'Missing required query parameter: blobPath' }))
  }

  if (/^https?:\/\//i.test(blobPath) || blobPath.startsWith('//') || blobPath.includes('..')) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: 'Invalid blobPath: must be a relative storage path' }))
  }

  const rawReport  = query['report']
  const reportType = (Array.isArray(rawReport) ? rawReport[0] : rawReport) ?? ''

  const baseUrl = process.env['AZURE_BLOB_BASE_URL']
  if (!baseUrl) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: 'Server misconfiguration: no AZURE_BLOB_BASE_URL configured' }))
  }

  const sasToken   = resolveToken(reportType)
  const artifactUrl = buildArtifactUrl(baseUrl, blobPath, sasToken)
  console.log(`[api/get-artifact] fetching → ${artifactUrl.replace(/sig=[^&]+/, 'sig=***')}`)

  try {
    const upstream = await fetch(artifactUrl)
    console.log(`[api/get-artifact] azure response: HTTP ${upstream.status}`)

    if (upstream.status === 404) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ error: `Artifact not found: ${blobPath}` }))
    }
    if (!upstream.ok) {
      res.writeHead(502, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ error: `Upstream storage error: HTTP ${upstream.status}` }))
    }

    const contentType   = upstream.headers.get('content-type')   ?? 'application/octet-stream'
    const contentLength = upstream.headers.get('content-length')
    const acceptRanges  = upstream.headers.get('accept-ranges')

    const headers: Record<string, string> = { 'Content-Type': contentType, 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' }
    if (contentLength) headers['Content-Length'] = contentLength
    if (acceptRanges)  headers['Accept-Ranges']  = acceptRanges

    res.writeHead(200, headers)
    const buffer = await upstream.arrayBuffer()
    return res.end(Buffer.from(buffer))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[api/get-artifact]', err)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: `Failed to fetch artifact: ${message}` }))
  }
}

// ── Blob proxy (/api/blob) ────────────────────────────────────────────────────
// Mirrors api/blob.ts for local dev. Serves arbitrary blob paths with the
// container prefix resolved from REPORT_NAMES.

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

async function handleBlobProxy(
  req: http.IncomingMessage,
  query: NodeJS.Dict<string | string[]>,
  res: http.ServerResponse,
) {
  res.setHeader('Access-Control-Allow-Origin', 'https://trace.playwright.dev')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept')
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Content-Type, Accept-Ranges')

  const rawPath    = query['path']
  const blobPath   = (Array.isArray(rawPath) ? rawPath[0] : rawPath) ?? ''
  const rawReport  = query['report']
  const reportType = (Array.isArray(rawReport) ? rawReport[0] : rawReport) ?? 'playwright-trace'

  if (!blobPath) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: 'Missing required query parameter: path' }))
  }
  if (/^https?:\/\//i.test(blobPath) || blobPath.startsWith('//') || blobPath.includes('..')) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: 'Invalid path: must be a relative storage path' }))
  }

  const baseUrl = process.env['AZURE_BLOB_BASE_URL']
  if (!baseUrl) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: 'Server misconfiguration: no AZURE_BLOB_BASE_URL' }))
  }

  const container = resolveContainer(reportType)
  const fullPath  = container && !blobPath.startsWith(`${container}/`)
    ? `${container}/${blobPath}`
    : blobPath

  const sasToken   = resolveToken(reportType)
  const artifactUrl = buildArtifactUrl(baseUrl, fullPath, sasToken)
  console.log(`[api/blob] fetching (container=${container || 'none'}) → ${artifactUrl.replace(/sig=[^&]+/, 'sig=***')}`)

  try {
    const rangeHeader = req.headers['range']
    const upstream = await fetch(artifactUrl, {
      headers: rangeHeader ? { Range: rangeHeader } : {},
    })
    console.log(`[api/blob] azure response: HTTP ${upstream.status}`)

    if (upstream.status === 404) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ error: `Not found: ${blobPath}` }))
    }
    if (!upstream.ok) {
      res.writeHead(502, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ error: `Upstream error: HTTP ${upstream.status}` }))
    }

    const contentType   = upstream.headers.get('content-type')   ?? 'application/octet-stream'
    const contentLength = upstream.headers.get('content-length')
    const acceptRanges  = upstream.headers.get('accept-ranges')
    const contentRange  = upstream.headers.get('content-range')

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': 's-maxage=3600, stale-while-revalidate=300',
    }
    if (contentLength) headers['Content-Length'] = contentLength
    if (acceptRanges)  headers['Accept-Ranges']  = acceptRanges
    if (contentRange)  headers['Content-Range']  = contentRange

    res.writeHead(upstream.status === 206 ? 206 : 200, headers)
    const buffer = await upstream.arrayBuffer()
    return res.end(Buffer.from(buffer))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[api/blob]', err)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: `Failed to fetch: ${message}` }))
  }
}

// ── Get trace ──────────────────────────────────────────────────────────────────

async function handleGetTrace(
  query: NodeJS.Dict<string | string[]>,
  res: http.ServerResponse,
) {
  const CORS_ORIGIN = 'https://trace.playwright.dev'
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN)
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept')
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Content-Type, Accept-Ranges')

  const rawId = query['id']
  const id    = (Array.isArray(rawId) ? rawId[0] : rawId) ?? ''
  if (!id) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: 'Missing id parameter' }))
  }

  const rawReport  = query['report']
  const reportType = (Array.isArray(rawReport) ? rawReport[0] : rawReport) ?? ''

  const baseUrl = process.env['AZURE_BLOB_BASE_URL']
  if (!baseUrl) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: 'Server misconfiguration: no AZURE_BLOB_BASE_URL configured' }))
  }

  const { storagePath } = resolveEntry(reportType)
  const sasToken = resolveToken(reportType)
  const traceUrl = buildTraceUrl(baseUrl, storagePath, id, sasToken)
  console.log(`[api/get-trace] fetching → ${traceUrl.replace(/sig=[^&]+/, 'sig=***')}`)

  try {
    const upstream = await fetch(traceUrl)
    console.log(`[api/get-trace] azure response: HTTP ${upstream.status}`)

    if (upstream.status === 404) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ error: `Trace '${id}' not found` }))
    }
    if (!upstream.ok) {
      res.writeHead(502, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ error: `Upstream storage error: HTTP ${upstream.status}` }))
    }

    const contentType   = upstream.headers.get('content-type')   ?? 'application/zip'
    const contentLength = upstream.headers.get('content-length')
    const acceptRanges  = upstream.headers.get('accept-ranges')

    const headers: Record<string, string> = { 'Content-Type': contentType }
    if (contentLength) headers['Content-Length'] = contentLength
    if (acceptRanges)  headers['Accept-Ranges']  = acceptRanges

    res.writeHead(200, headers)
    const buffer = await upstream.arrayBuffer()
    return res.end(Buffer.from(buffer))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[api/get-trace]', err)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: `Failed to fetch trace: ${message}` }))
  }
}

// ── Server ─────────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const parsed = nodeUrl.parse(req.url ?? '', true)

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept')
    res.writeHead(204)
    return res.end()
  }

  if (parsed.pathname === '/api/auth') {
    await handleAuth(req, res)
  } else if (!isAuthenticated(req.headers['cookie'])) {
    res.setHeader('Content-Type', 'application/json')
    res.writeHead(401)
    res.end(JSON.stringify({ error: 'Unauthorized' }))
  } else if (parsed.pathname === '/api/get-blob') {
    await handleGetBlob(parsed.query, res)
  } else if (parsed.pathname === '/api/list-blobs') {
    await handleListBlobs(parsed.query, res)
  } else if (parsed.pathname === '/api/get-trace') {
    await handleGetTrace(parsed.query, res)
  } else if (parsed.pathname === '/api/get-artifact') {
    await handleGetArtifact(parsed.query, res)
  } else if (parsed.pathname === '/api/blob') {
    await handleBlobProxy(req, parsed.query, res)
  } else {
    res.setHeader('Content-Type', 'application/json')
    res.writeHead(404)
    res.end(JSON.stringify({ error: 'Not found' }))
  }
})

server.listen(PORT, () => {
  console.log(`  API server  →  http://localhost:${PORT}/api/`)
})
