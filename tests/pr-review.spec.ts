import { test, expect } from './test'

// The 'example' fixture has 15 reviews; first PR is "Add patient discharge summary modal" (#342)
const FIXTURE_URL = '/?report=pr-review&id=example&_fixture=dev'

test.describe('PR Review dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/get-blob?*', async route => {
      const reportId = new URL(route.request().url()).searchParams.get('id') ?? 'example'
      await route.fulfill({ path: `fixtures/pr-review/${reportId}.json` })
    })
  })

  test('loads the overview by default', async ({ page }) => {
    await page.goto(FIXTURE_URL)
    await expect(page.getByText('Overview')).toBeVisible()
    // Sidebar should show some review items
    await expect(page.getByText('Add patient discharge summary modal')).toBeVisible()
  })

  test('shows KPI cards in the overview', async ({ page }) => {
    await page.goto(FIXTURE_URL)
    // Use exact match on the label span to avoid matching parent containers
    await expect(page.getByText('Total Reviews', { exact: true })).toBeVisible()
  })

  test('selecting a review shows the detail panel', async ({ page }) => {
    await page.goto(FIXTURE_URL)
    // Click the first PR in the sidebar
    await page.getByText('Add patient discharge summary modal').first().click()
    // Detail view: PR number appears in the <main> panel header (sidebar shows #342 in <aside>)
    await expect(page.getByRole('main').getByText('#342')).toBeVisible()
    await expect(page.getByRole('main').getByText('Add patient discharge summary modal')).toBeVisible()
  })

  test('shows the schema validation banner for legacy reports (no schemaVersion)', async ({ page }) => {
    await page.goto(FIXTURE_URL)
    // The example fixture has no schemaVersion — unsupported version banner should NOT appear
    // (legacy IS a supported version) and the report renders normally
    await expect(page.getByText('Unsupported schema version')).not.toBeVisible()
  })

  test('unsupported future schema version shows the version banner', async ({ page }) => {
    await page.goto('/?report=pr-review&id=future&_fixture=dev')
    await expect(page.getByText('Unsupported schema version')).toBeVisible()
    // Banner can be dismissed
    await page.getByRole('button', { name: 'Dismiss' }).click()
    await expect(page.getByText('Unsupported schema version')).not.toBeVisible()
  })

  test('schema v3 renders model attempt telemetry without an unsupported warning', async ({ page }) => {
    await page.goto('/?report=pr-review&id=v3&_fixture=dev')
    await expect(page.getByText('Unsupported schema version')).not.toBeVisible()
    await page.getByText('Schema v3 model fallback telemetry').click()
    await expect(page.getByText('2 attempts')).toBeVisible()
  })

  test('schema v4 displays legacy Copilot billing usage as premium requests', async ({ page }) => {
    await page.goto('/?report=pr-review&id=v4&_fixture=dev')
    await expect(page.getByText('Unsupported schema version')).not.toBeVisible()
    await expect(page.getByText('Premium Requests Used', { exact: true })).toBeVisible()
    await expect(page.getByText('Premium Requests per Review', { exact: true })).toBeVisible()

    await page.getByText('Capture Copilot billing telemetry').first().click()
    await expect(page.getByRole('main').getByText('Premium Requests', { exact: true })).toBeVisible()
    await expect(page.getByRole('main').getByText('1', { exact: true })).toBeVisible()
  })
})
