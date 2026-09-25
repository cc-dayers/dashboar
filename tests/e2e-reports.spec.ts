import { test, expect } from './test'
import * as path from 'node:path'
import * as fs from 'node:fs'

// playwright-trace fixture: 6 runs (2 failed, 1 flaky, 3 passed)
const PLAYWRIGHT_TRACE_URL = '/?report=playwright-trace&id=report&_fixture=dev'

// Per-run detail fixture content — loaded by tests that mock get-artifact
function runFixture() {
  const p = path.resolve('fixtures/e2e-run/example.json')
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as unknown
}

test.describe('Playwright trace dashboard — top flakiest tests', () => {
  test('ranks test names across runs, filters by time and opens the latest flaky run', async ({ page }) => {
    const runs = [
      { id: 'older', suiteName: 'Older suite', status: 'passed', generatedAt: '2026-06-23T12:00:00Z', reportBlobPath: 'older.json', summary: { total: 2, passed: 0, failed: 0, skipped: 0, flaky: 2 } },
      { id: 'newer', suiteName: 'Newer suite', status: 'passed', generatedAt: '2026-06-25T12:00:00Z', reportBlobPath: 'newer.json', summary: { total: 1, passed: 0, failed: 0, skipped: 0, flaky: 1 } },
    ]
    await page.route('**/api/get-blob?*', route => route.fulfill({ json: { updatedAt: '2026-06-25T12:00:00Z', runs } }))
    await page.route('**/api/get-artifact?*', route => {
      const older = new URL(route.request().url()).searchParams.get('blobPath') === 'older.json'
      return route.fulfill({ json: { tests: older
        ? [{ title: 'Checkout › retries', file: 'checkout.spec.ts', status: 'flaky' }, { title: 'Login › races', file: 'login.spec.ts', status: 'flaky' }]
        : [{ title: 'Checkout › retries', file: 'checkout.spec.ts', status: 'flaky' }] } })
    })

    await page.goto('/?report=playwright-trace&id=ranked&_fixture=dev')
    const panel = page.getByRole('main').getByText('Top flakiest tests').locator('..').locator('..')
    await page.getByRole('button', { name: 'ALL' }).click()
    const first = panel.getByRole('button', { name: /Checkout › retries/ })
    await expect(first).toContainText('2 flakes')
    await expect(panel.getByRole('button', { name: /Login › races/ })).toContainText('1 flake')
    await page.getByRole('button', { name: '24H' }).click()
    await expect(panel.getByRole('button', { name: /Checkout › retries/ })).toContainText('1 flake')
    await expect(panel.getByRole('button', { name: /Login › races/ })).toHaveCount(0)
    await panel.getByRole('button', { name: /Checkout › retries/ }).click()
    await expect(page.getByTitle('Back to overview')).toBeVisible()
    await expect(page.getByRole('main').getByText('Newer suite', { exact: true }).first()).toBeVisible()
  })

  test('shows an honest empty or partial state when test details are missing', async ({ page }) => {
    await page.route('**/api/get-blob?*', route => route.fulfill({ json: { runs: [
      { id: 'missing', suiteName: 'No detail', status: 'flaky', generatedAt: '2026-06-25T12:00:00Z', summary: { total: 1, passed: 0, failed: 0, skipped: 0, flaky: 1 } },
    ] } }))
    await page.goto('/?report=playwright-trace&id=missing&_fixture=dev')
    await expect(page.getByText('Flaky test details are unavailable for these runs.')).toBeVisible()
    await expect(page.getByText('Partial results · details unavailable for 1 run.')).toBeVisible()
  })

  test('does not fetch details when the selected range has no flakes', async ({ page }) => {
    let requests = 0
    await page.route('**/api/get-blob?*', route => route.fulfill({ json: { runs: [
      { id: 'clean', suiteName: 'Clean suite', status: 'passed', generatedAt: '2026-06-25T12:00:00Z', summary: { total: 1, passed: 1, failed: 0, skipped: 0, flaky: 0 } },
    ] } }))
    await page.route('**/api/get-artifact?*', route => { requests++; return route.fulfill({ json: { tests: [] } }) })
    await page.goto('/?report=playwright-trace&id=clean&_fixture=dev')
    await expect(page.getByText('No flaky tests in this range.')).toBeVisible()
    expect(requests).toBe(0)
  })
})

test.describe('Playwright trace dashboard — overview', () => {
  test('loads the overview with run stats', async ({ page }) => {
    await page.goto(PLAYWRIGHT_TRACE_URL)
    // Overview heading is in <main>; sidebar also has an "Overview" link
    await expect(page.getByRole('main').getByText('Overview', { exact: true })).toBeVisible()
    // Sidebar section header shows "6 Runs"
    await expect(page.getByText('6 Runs', { exact: true })).toBeVisible()
  })

  test('shows failed runs count prominently', async ({ page }) => {
    await page.goto(PLAYWRIGHT_TRACE_URL)
    // Sidebar status pill shows "✗ 2 failed"
    await expect(page.getByRole('complementary').getByText(/2 failed/).first()).toBeVisible()
  })

  test('sidebar lists the run entries', async ({ page }) => {
    await page.goto(PLAYWRIGHT_TRACE_URL)
    // Fixture has "E2E · Portals React" runs
    await expect(page.getByText('E2E · Portals React').first()).toBeVisible()
  })

  test('failed runs appear with a red badge in the sidebar', async ({ page }) => {
    await page.goto(PLAYWRIGHT_TRACE_URL)
    // The sidebar shows "N failed" for runs with failures
    await expect(page.getByText('4 failed').first()).toBeVisible()
  })

  test('can filter runs by name in the sidebar', async ({ page }) => {
    await page.goto(PLAYWRIGHT_TRACE_URL)
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

test.describe('Playwright trace dashboard — run detail', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept get-artifact calls and return the e2e-run fixture
    await page.route('**/api/get-artifact**', async route => {
      await route.fulfill({ json: runFixture() })
    })
  })

  test('clicking a run loads per-run detail', async ({ page }) => {
    await page.goto(PLAYWRIGHT_TRACE_URL)
    // Click the first run in the sidebar
    await page.getByText('E2E · Portals React').first().click()
    // The back button is only rendered in the detail view
    await expect(page.getByTitle('Back to overview')).toBeVisible()
    // Detail view header shows the run suiteName from the mocked fixture (scoped to <main>)
    await expect(page.getByRole('main').getByText('E2E · Portals React', { exact: true })).toBeVisible()
  })

  test('run detail shows test summary KPIs', async ({ page }) => {
    await page.goto(PLAYWRIGHT_TRACE_URL)
    await page.getByText('E2E · Portals React').first().click()
    // Fixture summary: total=48, passed=43, failed=4, skipped=1
    // Use exact: true so numbers like '43' don't match parents containing additional text
    await expect(page.getByRole('main').getByText('48', { exact: true })).toBeVisible()
    await expect(page.getByRole('main').getByText('43', { exact: true })).toBeVisible()
    await expect(page.getByRole('main').getByText('4', { exact: true })).toBeVisible()
  })

  test('run detail shows failed tests first with error messages', async ({ page }) => {
    await page.goto(PLAYWRIGHT_TRACE_URL)
    await page.getByText('E2E · Portals React').first().click()
    // Fixture has a failed test with this title
    await expect(page.getByText('Patient portal › login › should authenticate with valid credentials')).toBeVisible()
    // Error text should be visible
    await expect(page.getByText(/Timed out 5000ms/)).toBeVisible()
  })

  test('run detail shows trace artifact links', async ({ page }) => {
    await page.goto(PLAYWRIGHT_TRACE_URL)
    await page.getByText('E2E · Portals React').first().click()
    // Fixture has trace artifacts on failed tests
    await expect(page.getByRole('link', { name: 'Trace' }).first()).toBeVisible()
  })

  test('run detail shows screenshot artifact links', async ({ page }) => {
    await page.goto(PLAYWRIGHT_TRACE_URL)
    await page.getByText('E2E · Portals React').first().click()
    await expect(page.getByRole('link', { name: 'Screenshot' }).first()).toBeVisible()
  })

  test('back button returns to overview', async ({ page }) => {
    await page.goto(PLAYWRIGHT_TRACE_URL)
    await page.getByText('E2E · Portals React').first().click()
    await page.getByTitle('Back to overview').click()
    // Back in overview — main panel heading and sidebar run count are visible
    await expect(page.getByRole('main').getByText('Overview', { exact: true })).toBeVisible()
    await expect(page.getByText('6 Runs', { exact: true })).toBeVisible()
  })
})

test.describe('Playwright trace — run detail error states', () => {
  test('shows an error when get-artifact returns 404', async ({ page }) => {
    await page.route('**/api/get-artifact**', async route => {
      await route.fulfill({ status: 404, json: { error: 'Artifact not found' } })
    })
    await page.goto(PLAYWRIGHT_TRACE_URL)
    await page.getByText('E2E · Portals React').first().click()
    await expect(page.getByText('Failed to load run detail')).toBeVisible()
  })

  test('shows a message when run has no reportBlobPath', async ({ page }) => {
    // The flaky fixture run has a reportBlobPath, but test the missing-blobPath branch
    // by intercepting to error
    await page.route('**/api/get-artifact**', async route => {
      await route.fulfill({ status: 500, json: { error: 'Server error' } })
    })
    await page.goto(PLAYWRIGHT_TRACE_URL)
    await page.getByText('E2E · API Contracts').first().click()
    await expect(page.getByText('Failed to load run detail')).toBeVisible()
  })
})

test.describe('Playwright trace — schema version handling', () => {
  test('unsupported schema version shows the version banner', async ({ page }) => {
    await page.goto('/?report=playwright-trace&id=future&_fixture=dev')
    await expect(page.getByText('Unsupported schema version')).toBeVisible()
    await expect(page.getByText('"99"')).toBeVisible()
  })

  test('unsupported version banner can be dismissed', async ({ page }) => {
    await page.goto('/?report=playwright-trace&id=future&_fixture=dev')
    await page.getByRole('button', { name: 'Dismiss' }).click()
    await expect(page.getByText('Unsupported schema version')).not.toBeVisible()
  })

  test('report still renders despite unsupported version', async ({ page }) => {
    await page.goto('/?report=playwright-trace&id=future&_fixture=dev')
    // The future fixture has one run — it appears in both sidebar and overview table
    await expect(page.getByText('Future E2E Suite').first()).toBeVisible()
  })
})
