import { test, expect } from './test'

test.describe('Error and edge-case states', () => {
  test('unknown report type shows an error screen', async ({ page }) => {
    await page.goto('/?report=nonexistent-report-type')
    await expect(page.getByText('Unknown report type')).toBeVisible()
    await expect(page.getByText('nonexistent-report-type')).toBeVisible()
  })

  test('unknown type screen lists the available types', async ({ page }) => {
    await page.goto('/?report=nonexistent-report-type')
    await expect(page.getByText('pr-review')).toBeVisible()
    await expect(page.getByText('e2e-aggregate')).toBeVisible()
  })

  test('404 blob response shows the failed-to-load screen', async ({ page }) => {
    await page.route('**/api/get-blob**', async route => {
      await route.fulfill({ status: 404, json: { error: 'Report not found at path' } })
    })
    await page.goto('/?report=pr-review')
    await expect(page.getByText('Failed to load report')).toBeVisible()
    await expect(page.getByText('Report not found at path')).toBeVisible()
  })

  test('500 server error shows the failed-to-load screen', async ({ page }) => {
    await page.route('**/api/get-blob**', async route => {
      await route.fulfill({ status: 500, json: { error: 'Server misconfiguration: no AZURE_BLOB_BASE_URL configured' } })
    })
    await page.goto('/?report=pr-review')
    await expect(page.getByText('Failed to load report')).toBeVisible()
  })

  test('no ?report param shows the landing page', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Dashboar' })).toBeVisible()
  })
})
