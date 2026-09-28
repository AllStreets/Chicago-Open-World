import { test, expect } from '@playwright/test'

for (const [view, time] of [['streeterville', 'dusk'], ['loop', 'day'], ['river', 'dusk'], ['museum', 'day']]) {
  test(`${view} @ ${time}`, async ({ page }) => {
    await page.goto(`/?view=${view}&time=${time}`)
    await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 90_000 })
    await page.waitForTimeout(2500) // camera smoothing + loading fade
    await expect(page).toHaveScreenshot(`${view}-${time}.png`, { mask: [page.locator('.wm-clock')] })
  })
}
