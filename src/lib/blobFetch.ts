/**
 * Client-side utilities for fetching report and artifact blobs through the
 * server-side proxy endpoints. SAS tokens are never exposed to the browser —
 * they live only in server environment variables and are attached by the API
 * handlers before forwarding to Azure Blob Storage.
 */

export interface BlobFetchError {
  status: number
  message: string
}

/**
 * Fetch an arbitrary blob by its storage path via /api/get-artifact.
 * The blobPath must be relative to AZURE_BLOB_BASE_URL (no https:// prefix).
 * reportType is used server-side to select the correct SAS token.
 */
export async function fetchArtifactJson(blobPath: string, reportType: string): Promise<unknown> {
  const url = `/api/get-artifact?blobPath=${encodeURIComponent(blobPath)}&report=${encodeURIComponent(reportType)}`
  const res = await fetch(url)
  const json = await res.json()
  if (!res.ok) {
    const msg = (json as { error?: string }).error ?? `HTTP ${res.status}`
    const err: BlobFetchError = { status: res.status, message: msg }
    throw err
  }
  return json
}

/**
 * Build the URL for a binary artifact (trace zip, screenshot, etc.) that
 * can be used in an <a href> or passed to the Playwright trace viewer.
 * The proxy URL keeps SAS tokens server-side.
 */
export function artifactProxyUrl(blobPath: string, reportType: string): string {
  return `/api/get-artifact?blobPath=${encodeURIComponent(blobPath)}&report=${encodeURIComponent(reportType)}`
}

/**
 * Build the Playwright trace viewer URL for a trace zip artifact.
 * Opens trace.playwright.dev with the trace fetched through the CORS-enabled proxy.
 */
export function traceViewerUrl(blobPath: string, reportType: string): string {
  const proxyUrl = `${window.location.origin}${artifactProxyUrl(blobPath, reportType)}`
  return `https://trace.playwright.dev/?trace=${encodeURIComponent(proxyUrl)}`
}
