import { test, expect } from './test'

// The 'example' fixture has reviewCount: 18, findingCount: 47, period: "2026-05-26 – 2026-06-25"
const FIXTURE_URL = '/?report=review-audit&id=example&_fixture=dev'

test.describe('Review Audit dashboard', () => {
  test('loads the overview with summary stats', async ({ page }) => {
    await page.goto(FIXTURE_URL)
    // Overview heading is in the main panel; sidebar also has an "Overview" link
    await expect(page.getByRole('main').getByText('Overview', { exact: true })).toBeVisible()
    // KPI values — use exact to avoid matching parent containers or substrings like $3.47
    await expect(page.getByRole('main').getByText('18', { exact: true })).toBeVisible()   // reviewCount
    await expect(page.getByRole('main').getByText('47', { exact: true })).toBeVisible()   // findingCount
  })

  test('shows the period in the overview header', async ({ page }) => {
    await page.goto(FIXTURE_URL)
    await expect(page.getByText('2026-05-26')).toBeVisible()
  })

  test('shows the feedback collection status', async ({ page }) => {
    await page.goto(FIXTURE_URL)
    // fixture has feedbackCollectionStatus: "partial"
    await expect(page.getByText('Partial')).toBeVisible()
  })

  test('sidebar shows review entries', async ({ page }) => {
    await page.goto(FIXTURE_URL)
    // First review: PR #1247 "feat: add FHIR R4 patient search endpoint"
    await expect(page.getByText('#1247')).toBeVisible()
    await expect(page.getByText(/FHIR R4/)).toBeVisible()
  })

  test('selecting a review shows the detail view', async ({ page }) => {
    await page.goto(FIXTURE_URL)
    await page.getByText(/FHIR R4/).first().click()
    // PR number shows in the detail view header inside <main>
    await expect(page.getByRole('main').getByText('#1247')).toBeVisible()
    await expect(page.getByRole('main').getByText('feat: add FHIR R4 patient search endpoint')).toBeVisible()
  })

  test('back to overview from detail view', async ({ page }) => {
    await page.goto(FIXTURE_URL)
    await page.getByText(/FHIR R4/).first().click()
    // Click "Overview" link in the sidebar (<aside>) to return to overview
    await page.getByRole('complementary').getByText('Overview').click()
    // Back in overview — the reviewCount KPI reappears
    await expect(page.getByRole('main').getByText('18', { exact: true })).toBeVisible()
  })
})
