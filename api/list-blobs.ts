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

export interface BlobEntry {
  id:            string
  lastModified?: string
  sizeBytes?:    number
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const rawReport = req.query['report']
  const reportType = (Array.isArray(rawReport) ? rawReport[0] : rawReport) ?? ''

  const baseUrl = resolveBaseUrl(reportType)
  if (!baseUrl) {
    return res.status(200).json({ blobs: [] })
  }

  const sasToken = resolveSasToken(reportType)

  try {
    const origin = new URL(baseUrl)
    // Azure pathname: /<container>[/<prefix...>]
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
      // Extract Azure's error message from the XML response
      const azureMsg = body.match(/<Message>([^<]+)<\/Message>/)?.[1]?.trim()
      const hint = upstream.status === 403
        ? 'SAS token may be missing the List (l) permission on the container.'
        : upstream.status === 404
        ? 'Container not found — check AZURE_BLOB_BASE_URL.'
        : undefined
      console.error(`[api/list-blobs] azure HTTP ${upstream.status}: ${azureMsg ?? body.slice(0, 200)}`)
      return res.status(200).json({
        blobs: [],
        error: `Azure returned HTTP ${upstream.status}${azureMsg ? `: ${azureMsg}` : ''}`,
        hint,
        azureStatus: upstream.status,
      })
    }

    const xml = body
    const blobs: BlobEntry[] = []

    for (const block of xml.match(/<Blob>([\s\S]*?)<\/Blob>/g) ?? []) {
      const name = block.match(/<Name>([^<]+)<\/Name>/)?.[1]
      if (!name || !name.endsWith('.json') || name.endsWith('.schema.json')) continue

      // Strip prefix, strip .json extension
      const withoutPrefix = prefix && name.startsWith(prefix) ? name.slice(prefix.length) : name
      const id = withoutPrefix.replace(/\.json$/, '')
      if (!id) continue

      const lastModified = block.match(/<Last-Modified>([^<]+)<\/Last-Modified>/)?.[1]
      const sizeStr      = block.match(/<Content-Length>([^<]+)<\/Content-Length>/)?.[1]

      blobs.push({
        id,
        lastModified,
        sizeBytes: sizeStr ? parseInt(sizeStr, 10) : undefined,
      })
    }

    // Newest first
    blobs.sort((a, b) => {
      if (!a.lastModified || !b.lastModified) return 0
      return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    })

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60')
    return res.status(200).json({ blobs })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[api/list-blobs]', err)
    return res.status(200).json({ blobs: [], error: message })
  }
}
