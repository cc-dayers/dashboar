import { test, expect } from './test'

test.describe('Landing page', () => {
  test('loads with the Dashboar heading', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Dashboar' })).toBeVisible()
  })

  test('shows all registered report types', async ({ page }) => {
    await page.goto('/')
    // Use exact: true to match only the label spans, not parent containers
    await expect(page.getByText('PR Review', { exact: true })).toBeVisible()
    await expect(page.getByText('Review Audit', { exact: true })).toBeVisible()
    await expect(page.getByText('E2E Aggregate', { exact: true })).toBeVisible()
    await expect(page.getByText('Playwright Traces', { exact: true })).toBeVisible()
  })

  test('shows fixture example links for report types that have them', async ({ page }) => {
    await page.goto('/')
    // pr-review has 'example' fixture
    const exampleLinks = page.getByRole('link', { name: 'example' })
    await expect(exampleLinks.first()).toBeVisible()
  })

  test('fixture links navigate to the correct report', async ({ page }) => {
    await page.goto('/')
    // Click the first 'example' fixture link (pr-review)
    await page.getByRole('link', { name: 'example' }).first().click()
    // Should navigate away from landing (URL now has ?report=)
    await expect(page).toHaveURL(/[?&]report=/)
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
