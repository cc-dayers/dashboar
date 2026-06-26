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
    await expect(page.getByText('E2E Tests', { exact: true })).toBeVisible()
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
})
