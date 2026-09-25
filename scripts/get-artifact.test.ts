import assert from 'node:assert/strict'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import handler from '../api/get-artifact'
import { resolveBlobPath } from '../src/lib/resolveBlobPath'

const names = 'pr-review:cc-review-agent/reports,playwright-trace:playwright/reports:report'
assert.equal(resolveBlobPath('reports/suite/build/report.json', 'playwright-trace', names), 'playwright/reports/suite/build/report.json')
assert.equal(resolveBlobPath('playwright/reports/suite/build/report.json', 'playwright-trace', names), 'playwright/reports/suite/build/report.json')
assert.equal(resolveBlobPath('reports/run.json', 'pr-review', names), 'cc-review-agent/reports/run.json')
assert.equal(resolveBlobPath('reports/run.json', 'unknown', names), 'reports/run.json')

const originalFetch = globalThis.fetch
const originalBase = process.env['AZURE_BLOB_BASE_URL']
const originalNames = process.env['REPORT_NAMES']
const originalAuth = process.env['AUTH_HASH']
const originalToken = process.env['AZURE_SAS_TOKEN']
const originalTokens = process.env['AZURE_SAS_TOKENS']
let requestedUrl = ''

try {
  process.env['AZURE_BLOB_BASE_URL'] = 'https://example.blob.core.windows.net'
  process.env['REPORT_NAMES'] = names
  delete process.env['AUTH_HASH']
  delete process.env['AZURE_SAS_TOKEN']
  delete process.env['AZURE_SAS_TOKENS']
  globalThis.fetch = async (url) => {
    requestedUrl = String(url)
    return new Response('{"tests":[]}', { status: 200, headers: { 'content-type': 'application/json' } })
  }

  for (const [blobPath, expectedPath] of [
    ['reports/suite/build/report.json', '/playwright/reports/suite/build/report.json'],
    ['playwright/reports/suite/build/report.json', '/playwright/reports/suite/build/report.json'],
  ]) {
    let status = 0
    let body: unknown
    const res = {
      setHeader: () => res,
      status: (code: number) => { status = code; return res },
      send: (value: unknown) => { body = value; return res },
    } as unknown as VercelResponse
    const req = { method: 'GET', headers: {}, query: { report: 'playwright-trace', blobPath } } as unknown as VercelRequest
    await handler(req, res)
    assert.equal(new URL(requestedUrl).pathname, expectedPath)
    assert.equal(status, 200)
    assert.deepEqual(JSON.parse((body as Buffer).toString()), { tests: [] })
  }
  console.log('get-artifact container resolution: passed')
} finally {
  globalThis.fetch = originalFetch
  for (const [key, value] of Object.entries({
    AZURE_BLOB_BASE_URL: originalBase,
    REPORT_NAMES: originalNames,
    AUTH_HASH: originalAuth,
    AZURE_SAS_TOKEN: originalToken,
    AZURE_SAS_TOKENS: originalTokens,
  })) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}
