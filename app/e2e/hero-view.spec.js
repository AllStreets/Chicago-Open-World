import { test, expect } from '@playwright/test'

const VIEWS = [['streeterville', 'dusk'], ['loop', 'day'], ['river', 'dusk'], ['museum', 'day'], ['streeterville', 'night'], ['hancock', 'dusk'], ['willis', 'day'], ['wrigleyville', 'day'], ['westloop', 'dusk'], ['navypier', 'night']]

for (const [view, time] of VIEWS) {
  test(`${view} @ ${time}`, async ({ page }) => {
    // pin the calendar: presets derive from that day's sunrise/sunset and trees from its month
    await page.clock.setFixedTime(new Date('2026-09-28T12:00:00-05:00'))
    // a returning visitor: the first-visit help card would cover the view
    await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
    await page.goto(`/?view=${view}&time=${time}`)
    await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 90_000 })
    // settled, not a fixed sleep: camera and sun at rest, every planned tile drawn, loading screen gone (G5)
    await page.waitForFunction(() => window.__camRest === true && window.__skyRest === true && window.__tilesIdle === true && window.__hudReady === true, null, { timeout: 60_000 })
    // single capture: water keeps animating, so the stable-frame loop of toHaveScreenshot never settles.
    // clock and the LIVE pill label follow real Chicago time → masked
    const shot = await page.screenshot({ mask: [page.locator('.wm-clock'), page.locator('.hud-controls')] })
    expect(shot).toMatchSnapshot(`${view}-${time}.png`, { maxDiffPixelRatio: 0.03 })
  })
}
