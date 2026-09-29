import { test, expect } from '@playwright/test'

const VIEWS = [['streeterville', 'dusk'], ['loop', 'day'], ['river', 'dusk'], ['museum', 'day'], ['streeterville', 'night'], ['hancock', 'dusk'], ['willis', 'day']]

for (const [view, time] of VIEWS) {
  test(`${view} @ ${time}`, async ({ page }) => {
    await page.goto(`/?view=${view}&time=${time}`)
    await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 90_000 })
    await page.waitForTimeout(4000) // textures, sky tween, loading fade
    // single capture: water keeps animating, so the stable-frame loop of toHaveScreenshot never settles.
    // clock and the LIVE pill label follow real Chicago time → masked
    const shot = await page.screenshot({ mask: [page.locator('.wm-clock'), page.locator('.hud-controls')] })
    expect(shot).toMatchSnapshot(`${view}-${time}.png`, { maxDiffPixelRatio: 0.03 })
  })
}
