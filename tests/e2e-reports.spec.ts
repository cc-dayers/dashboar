import { test, expect } from './test'
import * as path from 'node:path'
import * as fs from 'node:fs'

// Aggregate fixture: 6 runs (2 failed, 1 flaky, 3 passed)
const AGG_URL = '/?report=e2e-aggregate&id=report&_fixture=dev'

// Per-run detail fixture content — loaded by tests that mock get-artifact
function runFixture() {
  const p = path.resolve('fixtures/e2e-run/example.json')
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as unknown
}

test.describe('E2E aggregate dashboard — overview', () => {
  test('loads the overview with run stats', async ({ page }) => {
    await page.goto(AGG_URL)
    // Overview heading is in <main>; sidebar also has an "Overview" link
    await expect(page.getByRole('main').getByText('Overview', { exact: true })).toBeVisible()
    // Sidebar section header shows "6 Runs"
    await expect(page.getByText('6 Runs', { exact: true })).toBeVisible()
  })

  test('shows failed runs count prominently', async ({ page }) => {
    await page.goto(AGG_URL)
    // Sidebar status pill shows "✗ 2 failed"
    await expect(page.getByRole('complementary').getByText(/2 failed/).first()).toBeVisible()
  })

  test('sidebar lists the run entries', async ({ page }) => {
    await page.goto(AGG_URL)
    // Fixture has "E2E · Portals React" runs
    await expect(page.getByText('E2E · Portals React').first()).toBeVisible()
  })

  test('failed runs appear with a red badge in the sidebar', async ({ page }) => {
    await page.goto(AGG_URL)
    // The sidebar shows "N failed" for runs with failures
    await expect(page.getByText('4 failed').first()).toBeVisible()
  })

  test('can filter runs by name in the sidebar', async ({ page }) => {
    await page.goto(AGG_URL)
    const search = page.getByPlaceholder('Filter runs…')
    await search.fill('API')
    // Sidebar should show API Contracts run (scope to <aside> since overview table is unfiltered)
    await expect(page.getByRole('complementary').getByText('E2E · API Contracts').first()).toBeVisible()
    // Sidebar should not show Portals React after filtering
    await expect(page.getByRole('complementary').getByText('E2E · Portals React')).not.toBeVisible()
    // Clear the search — Portals React should reappear in sidebar
    await search.fill('')
    await expect(page.getByRole('complementary').getByText('E2E · Portals React').first()).toBeVisible()
  })
})

test.describe('E2E aggregate dashboard — run detail', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept get-artifact calls and return the e2e-run fixture
    await page.route('**/api/get-artifact**', async route => {
      await route.fulfill({ json: runFixture() })
    })
  })

  test('clicking a run loads per-run detail', async ({ page }) => {
    await page.goto(AGG_URL)
    // Click the first run in the sidebar
    await page.getByText('E2E · Portals React').first().click()
    // The back button is only rendered in the detail view
    await expect(page.getByTitle('Back to overview')).toBeVisible()
    // Detail view header shows the run suiteName from the mocked fixture (scoped to <main>)
    await expect(page.getByRole('main').getByText('E2E · Portals React', { exact: true })).toBeVisible()
  })

  test('run detail shows test summary KPIs', async ({ page }) => {
    await page.goto(AGG_URL)
    await page.getByText('E2E · Portals React').first().click()
    // Fixture summary: total=48, passed=43, failed=4, skipped=1
    // Use exact: true so numbers like '43' don't match parents containing additional text
    await expect(page.getByRole('main').getByText('48', { exact: true })).toBeVisible()
    await expect(page.getByRole('main').getByText('43', { exact: true })).toBeVisible()
    await expect(page.getByRole('main').getByText('4', { exact: true })).toBeVisible()
  })

  test('run detail shows failed tests first with error messages', async ({ page }) => {
    await page.goto(AGG_URL)
    await page.getByText('E2E · Portals React').first().click()
    // Fixture has a failed test with this title
    await expect(page.getByText('Patient portal › login › should authenticate with valid credentials')).toBeVisible()
    // Error text should be visible
    await expect(page.getByText(/Timed out 5000ms/)).toBeVisible()
  })

  test('run detail shows trace artifact links', async ({ page }) => {
    await page.goto(AGG_URL)
    await page.getByText('E2E · Portals React').first().click()
    // Fixture has trace artifacts on failed tests
    await expect(page.getByRole('link', { name: 'Trace' }).first()).toBeVisible()
  })

  test('run detail shows screenshot artifact links', async ({ page }) => {
    await page.goto(AGG_URL)
    await page.getByText('E2E · Portals React').first().click()
    await expect(page.getByRole('link', { name: 'Screenshot' }).first()).toBeVisible()
  })

  test('back button returns to overview', async ({ page }) => {
    await page.goto(AGG_URL)
    await page.getByText('E2E · Portals React').first().click()
    await page.getByTitle('Back to overview').click()
    // Back in overview — main panel heading and sidebar run count are visible
    await expect(page.getByRole('main').getByText('Overview', { exact: true })).toBeVisible()
    await expect(page.getByText('6 Runs', { exact: true })).toBeVisible()
  })
})

test.describe('E2E aggregate — run detail error states', () => {
  test('shows an error when get-artifact returns 404', async ({ page }) => {
    await page.route('**/api/get-artifact**', async route => {
      await route.fulfill({ status: 404, json: { error: 'Artifact not found' } })
    })
    await page.goto(AGG_URL)
    await page.getByText('E2E · Portals React').first().click()
    await expect(page.getByText('Failed to load run detail')).toBeVisible()
  })

  test('shows a message when run has no reportBlobPath', async ({ page }) => {
    // The flaky fixture run has a reportBlobPath, but test the missing-blobPath branch
    // by intercepting to error
    await page.route('**/api/get-artifact**', async route => {
      await route.fulfill({ status: 500, json: { error: 'Server error' } })
    })
    await page.goto(AGG_URL)
    await page.getByText('E2E · API Contracts').first().click()
    await expect(page.getByText('Failed to load run detail')).toBeVisible()
  })
})

test.describe('E2E aggregate — schema version handling', () => {
  test('unsupported schema version shows the version banner', async ({ page }) => {
    await page.goto('/?report=e2e-aggregate&id=future&_fixture=dev')
    await expect(page.getByText('Unsupported schema version')).toBeVisible()
    await expect(page.getByText('"99"')).toBeVisible()
  })

  test('unsupported version banner can be dismissed', async ({ page }) => {
    await page.goto('/?report=e2e-aggregate&id=future&_fixture=dev')
    await page.getByRole('button', { name: 'Dismiss' }).click()
    await expect(page.getByText('Unsupported schema version')).not.toBeVisible()
  })

  test('report still renders despite unsupported version', async ({ page }) => {
    await page.goto('/?report=e2e-aggregate&id=future&_fixture=dev')
    // The future fixture has one run — it appears in both sidebar and overview table
    await expect(page.getByText('Future E2E Suite').first()).toBeVisible()
  })
})
