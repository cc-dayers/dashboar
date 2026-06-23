import { config } from 'dotenv'
import * as fs from 'node:fs'
import * as http from 'node:http'
import * as nodeUrl from 'node:url'
import * as path from 'node:path'

config({ path: '.env.local' })
config()

const PORT = 3001

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

function buildBlobUrl(baseUrl: string, id: string, sasToken: string | undefined): string {
  const url = new URL(baseUrl)
  url.pathname = `${url.pathname.replace(/\/$/, '')}/${encodeURIComponent(id)}.json`
  if (sasToken) {
    const token = sasToken.startsWith('?') ? sasToken.slice(1) : sasToken
    new URLSearchParams(token).forEach((v, k) => url.searchParams.set(k, v))
  }
  return url.toString()
}

function buildTraceUrl(baseUrl: string, id: string, sasToken: string | undefined): string {
  const url = new URL(baseUrl)
  url.pathname = `${url.pathname.replace(/\/$/, '')}/${id}`
  if (sasToken) {
    const token = sasToken.startsWith('?') ? sasToken.slice(1) : sasToken
    new URLSearchParams(token).forEach((v, k) => url.searchParams.set(k, v))
  }
  return url.toString()
}

function tryServeFixture(
  reportType: string,
  id: string,
  res: http.ServerResponse,
): boolean {
  const candidates = [
    path.resolve('fixtures', reportType, `${id}.json`),
    path.resolve('fixtures', `${id}.json`),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      console.log(`[api] fixture  → ${p}`)
      const data = fs.readFileSync(p, 'utf-8')
      res.writeHead(200)
      res.end(data)
      return true
    }
  }
  res.writeHead(404)
  res.end(JSON.stringify({ error: `Fixture '${id}' not found in fixtures/${reportType}/ or fixtures/` }))
  return true
}

async function handleGetBlob(
  query: NodeJS.Dict<string | string[]>,
  res: http.ServerResponse,
) {
  res.setHeader('Content-Type', 'application/json')

  const rawId = query['id'] ?? query['reportId']
  const id = Array.isArray(rawId) ? rawId[0] : rawId

  if (!id) {
    res.writeHead(400)
    return res.end(JSON.stringify({ error: 'Missing required query parameter: id or reportId' }))
  }

  const rawReport = query['report']
  const reportType = (Array.isArray(rawReport) ? rawReport[0] : rawReport) ?? ''

  const rawFixture = query['_fixture']
  const fixtureParam = Array.isArray(rawFixture) ? rawFixture[0] : rawFixture
  if (fixtureParam) {
    return tryServeFixture(reportType, id, res)
  }

  const baseUrl = resolveBaseUrl(reportType)
  if (!baseUrl) {
    res.writeHead(500)
    return res.end(JSON.stringify({ error: 'Server misconfiguration: no AZURE_BLOB_BASE_URL configured' }))
  }

  try {
    const blobUrl = buildBlobUrl(baseUrl, id, resolveSasToken(reportType))

    console.log(`[api] fetching → ${blobUrl}`)
    const upstream = await fetch(blobUrl)
    console.log(`[api] azure response: HTTP ${upstream.status}`)

    if (upstream.status === 404) {
      res.writeHead(404)
      return res.end(JSON.stringify({ error: `Report '${id}' not found` }))
    }
    if (!upstream.ok) {
      res.writeHead(502)
      return res.end(JSON.stringify({ error: `Upstream storage error: HTTP ${upstream.status}` }))
    }

    const data: unknown = await upstream.json()
    res.writeHead(200)
    return res.end(JSON.stringify(data))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    res.writeHead(500)
    return res.end(JSON.stringify({ error: `Failed to fetch report: ${message}` }))
  }
}

async function handleListBlobs(
  query: NodeJS.Dict<string | string[]>,
  res: http.ServerResponse,
) {
  res.setHeader('Content-Type', 'application/json')

  const rawReport = query['report']
  const reportType = (Array.isArray(rawReport) ? rawReport[0] : rawReport) ?? ''

  const baseUrl = resolveBaseUrl(reportType)
  if (!baseUrl) {
    res.writeHead(200)
    return res.end(JSON.stringify({ blobs: [] }))
  }

  const sasToken = resolveSasToken(reportType)

  try {
    const origin = new URL(baseUrl)
    const pathParts = origin.pathname.replace(/\/$/, '').split('/').filter(Boolean)
    const container = pathParts[0] ?? ''
    const prefix    = pathParts.length > 1 ? pathParts.slice(1).join('/') + '/' : ''

    const listUrl = new URL(`https://${origin.host}/${container}`)
    listUrl.searchParams.set('restype', 'container')
    listUrl.searchParams.set('comp',    'list')
    if (prefix) listUrl.searchParams.set('prefix', prefix)

    if (sasToken) {
      const token = sasToken.startsWith('?') ? sasToken.slice(1) : sasToken
      new URLSearchParams(token).forEach((v, k) => listUrl.searchParams.set(k, v))
    }

    console.log(`[api/list-blobs] listing → ${listUrl.toString().replace(/sig=[^&]+/, 'sig=***')}`)

    const upstream = await fetch(listUrl.toString())
    const body = await upstream.text()

    if (!upstream.ok) {
      const azureMsg = body.match(/<Message>([^<]+)<\/Message>/)?.[1]?.trim()
      const hint = upstream.status === 403
        ? 'SAS token may be missing the List (l) permission on the container.'
        : upstream.status === 404
        ? 'Container not found — check AZURE_BLOB_BASE_URL.'
        : undefined
      console.error(`[api/list-blobs] azure HTTP ${upstream.status}: ${azureMsg ?? body.slice(0, 200)}`)
      res.writeHead(200)
      return res.end(JSON.stringify({
        blobs: [],
        error: `Azure returned HTTP ${upstream.status}${azureMsg ? `: ${azureMsg}` : ''}`,
        hint,
      }))
    }

    const blobs: Array<{ id: string; lastModified?: string; sizeBytes?: number }> = []
    for (const block of body.match(/<Blob>([\s\S]*?)<\/Blob>/g) ?? []) {
      const name = block.match(/<Name>([^<]+)<\/Name>/)?.[1]
      if (!name || !name.endsWith('.json') || name.endsWith('.schema.json')) continue

      const withoutPrefix = prefix && name.startsWith(prefix) ? name.slice(prefix.length) : name
      const id = withoutPrefix.replace(/\.json$/, '')
      if (!id) continue

      const lastModified = block.match(/<Last-Modified>([^<]+)<\/Last-Modified>/)?.[1]
      const sizeStr      = block.match(/<Content-Length>([^<]+)<\/Content-Length>/)?.[1]
      blobs.push({ id, lastModified, sizeBytes: sizeStr ? parseInt(sizeStr, 10) : undefined })
    }

    blobs.sort((a, b) => {
      if (!a.lastModified || !b.lastModified) return 0
      return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    })

    res.writeHead(200)
    return res.end(JSON.stringify({ blobs }))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[api/list-blobs]', err)
    res.writeHead(200)
    return res.end(JSON.stringify({ blobs: [], error: message }))
  }
}

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
  const id = (Array.isArray(rawId) ? rawId[0] : rawId) ?? ''

  if (!id) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: 'Missing id parameter' }))
  }

  const rawReport = query['report']
  const reportType = (Array.isArray(rawReport) ? rawReport[0] : rawReport) ?? ''

  const baseUrl = resolveBaseUrl(reportType)
  if (!baseUrl) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: 'Server misconfiguration: no AZURE_BLOB_BASE_URL configured' }))
  }

  try {
    const traceUrl = buildTraceUrl(baseUrl, id, resolveSasToken(reportType))
    console.log(`[api/get-trace] fetching → ${traceUrl.replace(/sig=[^&]+/, 'sig=***')}`)

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

const server = http.createServer(async (req, res) => {
  const parsed = nodeUrl.parse(req.url ?? '', true)

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', 'https://trace.playwright.dev')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept')
    res.writeHead(204)
    return res.end()
  }

  if (parsed.pathname === '/api/get-blob') {
    await handleGetBlob(parsed.query, res)
  } else if (parsed.pathname === '/api/list-blobs') {
    await handleListBlobs(parsed.query, res)
  } else if (parsed.pathname === '/api/get-trace') {
    await handleGetTrace(parsed.query, res)
  } else {
    res.setHeader('Content-Type', 'application/json')
    res.writeHead(404)
    res.end(JSON.stringify({ error: 'Not found' }))
  }
})

server.listen(PORT, () => {
  console.log(`  API server  →  http://localhost:${PORT}/api/get-blob`)
})
