/** REPORT_NAMES stores <type>:<container>/<prefix>[:filename], while artifact
 * paths inside run JSON are usually relative to the container root. */
export function resolveBlobPath(blobPath: string, reportType: string, reportNames: string): string {
  const entry = reportNames.split(',').map(s => s.trim()).find(s => s.startsWith(`${reportType}:`))
  if (!entry) return blobPath
  const storagePath = entry.slice(reportType.length + 1).split(':')[0]
  const container = storagePath.split('/')[0]
  return container && blobPath !== container && !blobPath.startsWith(`${container}/`)
    ? `${container}/${blobPath}`
    : blobPath
}