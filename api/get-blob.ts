import * as fs from 'node:fs'
import * as path from 'node:path'
import type { VercelRequest, VercelResponse } from '@vercel/node'

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

function tryServeFixture(
  reportType: string,
  id: string,
  res: VercelResponse,
): boolean {
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
  const rawId = req.query['id'] ?? req.query['reportId']
  const id = Array.isArray(rawId) ? rawId[0] : rawId

  if (!id) {
    return res.status(400).json({ error: 'Missing required query parameter: id or reportId' })
  }

  const rawReport = req.query['report']
  const reportType = (Array.isArray(rawReport) ? rawReport[0] : rawReport) ?? ''

  const rawFixture = req.query['_fixture']
  const fixtureParam = Array.isArray(rawFixture) ? rawFixture[0] : rawFixture
  const fixtureSecret = process.env['FIXTURE_SECRET']
  if (fixtureParam && fixtureSecret && fixtureParam === fixtureSecret) {
    return tryServeFixture(reportType, id, res)
  }

  const baseUrl = resolveBaseUrl(reportType)
  if (!baseUrl) {
    return res.status(500).json({ error: 'Server misconfiguration: no AZURE_BLOB_BASE_URL configured' })
  }

  let blobUrl: string
  try {
    blobUrl = buildBlobUrl(baseUrl, id, resolveSasToken(reportType))
  } catch {
    return res.status(500).json({ error: 'Server misconfiguration: AZURE_BLOB_BASE_URL is not a valid URL' })
  }

  try {
    console.log(`[api] fetching → ${blobUrl}`)
    const upstream = await fetch(blobUrl)
    console.log(`[api] azure response: HTTP ${upstream.status}`)

    if (upstream.status === 404) {
      return res.status(404).json({ error: `Report '${id}' not found` })
    }
    if (!upstream.ok) {
      return res.status(502).json({ error: `Upstream storage error: HTTP ${upstream.status}` })
    }

    const data: unknown = await upstream.json()
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    return res.status(200).json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return res.status(500).json({ error: `Failed to fetch report: ${message}` })
  }
}
