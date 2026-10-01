// app/e2e/tour.spec.js — a guided tour from the VISIT panel: it flies in, advances stop by stop, pauses and ends
// (user fixes 2026-09-29: "the tours don't work").
import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 1440, height: 900 } })
test('Architecture on the River plays from the VISIT panel', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
  await page.goto('/?view=home&time=day&sports=idle&stats')
  await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 90_000 })
  await page.waitForFunction(() => window.__camRest === true && window.__hudReady === true, null, { timeout: 60_000 })
  const cam = () => page.evaluate(() => window.__camera.position.toArray())
  const start = await cam()
  await page.getByRole('button', { name: /visit/i }).first().click()
  await page.getByRole('button', { name: /Architecture on the River/ }).click()
  await expect(page.locator('.tour-bar')).toBeVisible()
  await expect(page.locator('.tour-bar .tb-title')).toHaveText('The Wrigley Building')
  await page.waitForTimeout(2500)
  const flying = await cam()
  expect(Math.hypot(flying[0] - start[0], flying[2] - start[2])).toBeGreaterThan(50) // it flies in from where we were
  // Next stop (the "." key) moves the card and the camera on
  await page.keyboard.press('Period')
  await expect(page.locator('.tour-bar .tb-title')).toHaveText('Tribune Tower', { timeout: 5000 })
  // Space pauses: the tour's clock holds still
  await page.keyboard.press('Space')
  const t0 = await page.evaluate(() => window.__store.getState().tour.t)
  await page.waitForTimeout(1200)
  expect(await page.evaluate(() => window.__store.getState().tour.t)).toBeCloseTo(t0, 0)
  expect(await page.evaluate(() => window.__store.getState().tour.playing)).toBe(false)
  // C-fix: M (sound) and X (fireworks) keep the tour — no flight takes the camera away
  await page.keyboard.press('KeyM')
  await expect(page.locator('.sound-toast[data-state="on"]')).toBeVisible()
  await page.keyboard.press('KeyX')
  await page.waitForTimeout(600)
  const kept = await page.evaluate(() => { const s = window.__store.getState(); return { tour: Boolean(s.tour), flight: Boolean(s.flight) } })
  expect(kept).toEqual({ tour: true, flight: false })
  await expect(page.locator('.tour-bar')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.tour-bar')).toHaveCount(0)
})
