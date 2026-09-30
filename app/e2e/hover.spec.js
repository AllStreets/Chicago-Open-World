// app/e2e/hover.spec.js — hovering a building names it; clicking opens its card (P4 Task 3, I-4.6).
import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 1440, height: 900 } })
test('hover a Loop building for its tooltip, click for its card', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-28T12:00:00-05:00'))
  await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
  await page.goto('/?view=loop&time=day&sports=idle')
  await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 90_000 })
  await page.waitForFunction(() => window.__camRest === true && window.__tilesIdle === true && window.__hudReady === true, null, { timeout: 60_000 })
  // sweep a few points near the centre until one lands on a building (the sidecar loads on the first hover)
  let found = false
  for (const [x, y] of [[720, 500], [700, 520], [760, 480], [680, 460], [740, 560], [720, 500]]) {
    await page.mouse.move(x, y, { steps: 3 }); await page.waitForTimeout(400)
    await page.mouse.move(x + 2, y + 1); await page.waitForTimeout(250)
    if (await page.locator('.building-tooltip').count()) { found = true; break }
  }
  expect(found).toBe(true)
  const name = (await page.locator('.building-tooltip .bt-name').textContent()).trim()
  expect(name.length).toBeGreaterThan(0)
  await page.mouse.down(); await page.mouse.up()
  await expect(page.locator('.context-panel')).toBeVisible()
  await expect(page.locator('.context-panel')).toContainText(/Nearest L|No L within/)
})
