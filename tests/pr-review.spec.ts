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
    await expect(page.getByText('PRs Reviewed', { exact: true })).toBeVisible()
    await expect(page.getByText('Median Review Time', { exact: true })).toBeVisible()
    await expect(page.getByText('Evidence Confidence', { exact: true })).toBeVisible()
  })

  test('explains derived metrics with an accessible disclosure', async ({ page }) => {
    await page.goto('/?report=pr-review&id=v8&_fixture=dev')

    await page.getByRole('button', { name: 'How Evidence Confidence is calculated' }).click()
    await expect(page.getByRole('tooltip')).toContainText('deterministic evidence-completeness scores')
    await expect(page.getByRole('tooltip')).toContainText('not agreement with a human reviewer')

    await page.keyboard.press('Escape')
    await expect(page.getByRole('tooltip')).not.toBeVisible()
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
    await expect(page.getByRole('cell', { name: '2 attempts' })).toBeVisible()
  })

  test('schema v4 displays fractional AI-credit usage', async ({ page }) => {
    await page.goto('/?report=pr-review&id=v4&_fixture=dev')
    await expect(page.getByText('Unsupported schema version')).not.toBeVisible()
    await expect(page.getByText('Review-agent AIC', { exact: true })).toBeVisible()
    await expect(page.getByText('Organization Copilot Usage', { exact: true })).toBeVisible()
    await expect(page.getByText('15.75', { exact: true })).toBeVisible()
    await expect(page.getByText(/Jun 17 – Jul 14 · 2 users/)).toBeVisible()
    await expect(page.getByText('Attributed AIC per Review', { exact: true })).toBeVisible()

    await page.getByText('Capture Copilot billing telemetry').first().click()
    await expect(page.getByRole('main').getByText('AI Credits', { exact: true })).toBeVisible()
    await expect(page.getByRole('main').getByText('1.25', { exact: true })).toBeVisible()
  })

  test('schema v7 distinguishes official and attributed AIC and shows grounding health', async ({ page }) => {
    await page.goto('/?report=pr-review&id=v7&_fixture=dev')
    await expect(page.getByText('Unsupported schema version')).not.toBeVisible()
    await expect(page.getByText('Organization Copilot Usage', { exact: true })).toBeVisible()
    await expect(page.getByText('18.63', { exact: true })).toBeVisible()
    await expect(page.getByText('Review-agent AIC', { exact: true })).toBeVisible()
    await expect(page.getByText('1.38', { exact: true })).toBeVisible()
    await expect(page.getByText('1 of 1 PRs · 100% coverage', { exact: true })).toBeVisible()
    const needsAttention = page.getByRole('group', { name: 'Needs Attention' })
    await expect(needsAttention.getByText('1', { exact: true })).toBeVisible()
    await expect(needsAttention.getByText('0 changes · 1 grounding', { exact: true })).toBeVisible()

    await page.getByText('Synthetic telemetry fixture').first().click()
    const main = page.getByRole('main')
    await expect(main.getByText('provenance unavailable', { exact: true })).toBeVisible()
    await expect(main.getByText('Grounding degraded', { exact: true })).toBeVisible()
    await expect(main.getByText('findings reanchored', { exact: true })).toBeVisible()
  })

  test('schema v8 shows provider token coverage and detailed usage anatomy', async ({ page }) => {
    await page.goto('/?report=pr-review&id=v8&_fixture=dev')
    await expect(page.getByText('Unsupported schema version')).not.toBeVisible()
    await expect(page.getByText('Organization Copilot Usage', { exact: true })).not.toBeVisible()
    const reviewAic = page.getByRole('group', { name: 'Review-agent AIC' })
    await expect(reviewAic.getByText('7.06', { exact: true })).toBeVisible()
    await expect(reviewAic.getByText('1 of 1 PRs · 100% coverage', { exact: true })).toBeVisible()
    const measuredCoverage = page.getByRole('group', { name: 'Measured Token Coverage' })
    await expect(measuredCoverage.getByText('100%', { exact: true })).toBeVisible()
    await page.getByText('Synthetic provider usage fixture').first().click()
    const main = page.getByRole('main')
    await expect(main.getByText('Evidence Confidence', { exact: true })).toBeVisible()
    await expect(main.getByText('Model execution', { exact: true })).toBeVisible()
    await expect(main.getByText('1 attempts', { exact: true })).not.toBeVisible()
    await expect(main.getByText('Usage anatomy', { exact: true })).toBeVisible()
    await expect(main.getByText('21.7k in · 4.8k out', { exact: true })).toBeVisible()
    await expect(main.getByText('14.2k', { exact: true })).toBeVisible()
    await expect(main.getByText('Requests / turns:')).toBeVisible()
    await expect(main.getByText('AIC is reported separately because it is a billing unit, not a token count.')).toBeVisible()
  })
})
