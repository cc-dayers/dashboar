import { test, expect } from './test'

test.describe('Landing page', () => {
  test('loads with the Dashboar heading', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Dashboar' })).toBeVisible()
  })

  test('shows all registered report types', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'PR Review' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Playwright Traces' })).toBeVisible()
  })

  test('shows fixture example links for report types that have them', async ({ page }) => {
    await page.goto('/')
    // Fixtures are collapsed behind a toggle by default — expand pr-review's
    await page.getByRole('button', { name: /Fixtures/ }).first().click()
    const exampleLinks = page.getByRole('link', { name: 'example' })
    await expect(exampleLinks.first()).toBeVisible()
  })

  test('fixture links navigate to the correct report', async ({ page }) => {
    await page.goto('/')
    // Expand the fixtures toggle, then click the first 'example' fixture link (pr-review)
    await page.getByRole('button', { name: /Fixtures/ }).first().click()
    await page.getByRole('link', { name: 'example' }).first().click()
    // Should navigate away from landing (URL now has ?report=)
    await expect(page).toHaveURL(/[?&]report=/)
  })

  test('report label opens an example when local storage is not configured', async ({ page }) => {
    await page.route('**/api/list-blobs', route => route.fulfill({ json: {
      blobs: [], error: 'Storage is not configured. Set AZURE_BLOB_BASE_URL and REPORT_NAMES to browse live reports.',
    } }))
    await page.route('**/api/get-blob?*', route => route.fulfill({ json: { runs: [] } }))
    await page.goto('/')
    await expect(page.getByText(/Storage is not configured/)).toBeVisible()
    await page.getByRole('link', { name: 'Playwright Traces' }).click()
    await expect(page).toHaveURL(/report=playwright-trace.*_fixture=dev/)
    await expect(page.getByRole('main').getByText('Overview', { exact: true })).toBeVisible()
  })

  test('report label opens the discovered live report when storage is configured', async ({ page }) => {
    await page.route('**/api/list-blobs', route => route.fulfill({ json: { blobs: [
      { id: 'report', reportType: 'playwright-trace', storagePath: 'playwright/reports' },
    ] } }))
    await page.route('**/api/get-blob?*', route => route.fulfill({ json: { runs: [] } }))
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'report' })).toBeVisible()
    await page.getByRole('link', { name: 'Playwright Traces' }).click()
    await expect(page).toHaveURL(/report=playwright-trace.*path=playwright%2Freports/)
    await expect(page.getByRole('main').getByText('No runs in this report.')).toBeVisible()
  })

  test('shows the direct link hint', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('?id=my-report')).toBeVisible()
  })

  test('keeps existing reports in place behind a loader while refreshing', async ({ page }) => {
    let holdRefresh = false
    let releaseRefresh!: () => void
    const refreshPending = new Promise<void>(resolve => { releaseRefresh = resolve })

    await page.route('**/api/list-blobs', async route => {
      if (holdRefresh) await refreshPending
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          blobs: [{
            id: holdRefresh ? 'new-report' : 'latest-report',
            reportType: 'pr-review',
            storagePath: 'reports/pr-review',
            lastModified: '2026-07-15T20:00:00.000Z',
            sizeBytes: 2048,
          }],
        }),
      })
    })

    await page.goto('/')
    await expect(page.getByRole('link', { name: /latest-report/ })).toBeVisible()
  const reportItems = page.locator('[aria-busy]')
  const beforeRefresh = await reportItems.boundingBox()

    holdRefresh = true
    await page.getByRole('button', { name: 'Refresh storage' }).click()
    await expect(page.getByRole('status', { name: 'Refreshing reports' })).toBeVisible()
    await expect(page.getByRole('link', { name: /latest-report/ })).toBeVisible()
  expect(await reportItems.boundingBox()).toEqual(beforeRefresh)

    releaseRefresh()
    await expect(page.getByRole('status', { name: 'Refreshing reports' })).not.toBeVisible()
    await expect(page.getByRole('link', { name: /new-report/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /latest-report/ })).not.toBeVisible()
  })
})
