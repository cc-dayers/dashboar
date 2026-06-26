/**
 * Custom Playwright test fixture that bypasses the auth gate.
 *
 * The dashboar auth gate calls GET /api/auth on mount. If AUTH_HASH is set
 * in the server environment (e.g. from the user's .env.local), the gate
 * shows a login screen. Tests mock that response to always report auth
 * disabled, so the dashboard content renders unconditionally.
 *
 * Import `test` and `expect` from here instead of '@playwright/test'.
 */
import { test as base, expect } from '@playwright/test'

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('**/api/auth', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, authEnabled: false, user: 'test' }),
        })
      } else {
        await route.continue()
      }
    })
    await use(page)
  },
})

export { expect }
