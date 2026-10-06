// app/e2e/teamlights.spec.js — Team lights: a win night lights the skyline (through the façade shader's fade); I turns
// it off and the choice survives a reload; a ⌘K preview shows a team's colours even with the lights off, then reverts;
// I never ends a ride-along. ?sports=win:<team> stands in for a real win; /api/schedule answers 503.
import { test, expect } from '@playwright/test'

async function boot(page, query) {
  await page.route('**/api/schedule', (r) => r.fulfill({ status: 503, headers: { 'Cache-Control': 'no-store' }, body: '{}' }))
  await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
  await page.goto(`/?view=willis&time=night&traffic=idle&stats${query}`)
  await page.waitForFunction(() => window.__worldReady === true && window.__teamLights != null, null, { timeout: 90_000 })
}
const lights = (page) => page.evaluate(() => { const t = window.__teamLights; const s = t.store.getState(); return { on: s.on, lit: s.lit, fade: t.fade(), a: t.colours()[0] } })

test('a win night lights the skyline; I turns it off and the choice is remembered; a preview shows anyway', async ({ page }) => {
  await boot(page, '&sports=win:bears')
  await expect.poll(async () => (await lights(page)).fade, { timeout: 8_000 }).toBeGreaterThan(0.6)
  const on = await lights(page)
  expect(on).toMatchObject({ on: true, lit: { team: 'bears', why: 'win' } })
  expect(on.a[2]).toBeGreaterThan(on.a[0]) // Bears blue first
  await page.keyboard.press('i')
  await expect(page.locator('.toast')).toContainText('Team lights off')
  await expect.poll(async () => (await lights(page)).fade, { timeout: 5_000 }).toBeLessThan(0.02)
  expect(await page.evaluate(() => localStorage.getItem('chi-ow-team-lights'))).toBe('off')
  await page.reload()
  await page.waitForFunction(() => window.__worldReady === true && window.__teamLights != null, null, { timeout: 90_000 })
  await page.waitForTimeout(1500)
  expect(await lights(page)).toMatchObject({ on: false, lit: null, fade: 0 })
  // ⌘K "Preview Cubs lights" — a minute of Cubs colours, lights off or not
  await page.keyboard.press('Meta+k')
  await page.locator('.cmdk-input').fill('Preview Cubs lights')
  await page.keyboard.press('Enter')
  await expect.poll(async () => (await lights(page)).lit?.team, { timeout: 3_000 }).toBe('cubs')
  await expect.poll(async () => (await lights(page)).fade, { timeout: 8_000 }).toBeGreaterThan(0.6)
  expect((await lights(page)).lit.why).toBe('preview')
  // the preview ends by itself after a minute (fast-forwarded here) and the lights stay off
  await page.evaluate(() => { const s = window.__teamLights.store; s.setState({ preview: { ...s.getState().preview, until: Date.now() - 1 } }) })
  await expect.poll(async () => (await lights(page)).fade, { timeout: 5_000 }).toBeLessThan(0.02)
  expect((await lights(page)).lit).toBeNull()
  // and I turns them back on (the win is still tonight's)
  await page.keyboard.press('i')
  await expect.poll(async () => (await lights(page)).fade, { timeout: 8_000 }).toBeGreaterThan(0.6)
})

test('Play a game: the home win lights the skyline only while its celebration runs', async ({ page }) => {
  await boot(page, '&sports=idle')
  await page.waitForFunction(() => window.__sports?.getState().venues.length > 0, null, { timeout: 30_000 })
  await page.evaluate(() => window.__sports.getState().startShowcase('wrigleyfield', 'cubs', Date.now() - 40_000)) // mid-game
  await page.waitForTimeout(1500)
  expect((await lights(page)).lit).toBeNull()
  await page.evaluate(() => window.__sports.getState().startShowcase('wrigleyfield', 'cubs', Date.now() - 78_000)) // the final
  await expect.poll(async () => (await lights(page)).lit, { timeout: 4_000 }).toMatchObject({ team: 'cubs', why: 'showcase' })
  await expect.poll(async () => (await lights(page)).lit, { timeout: 16_000 }).toBeNull() // the showcase ends at 90 s
})

test('an idle night stays dark, and I does not end a train ride-along', async ({ page }) => {
  await boot(page, '&sports=idle&follow=red')
  await page.waitForTimeout(1500)
  expect((await lights(page)).fade).toBe(0)
  await expect.poll(() => page.evaluate(() => window.__store.getState().follow?.trainId ?? null), { timeout: 20_000 }).not.toBeNull()
  await page.keyboard.press('i')
  await page.waitForTimeout(300)
  expect(await page.evaluate(() => window.__store.getState().follow)).not.toBeNull()
  expect((await lights(page)).on).toBe(false)
})
