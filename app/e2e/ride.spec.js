// app/e2e/ride.spec.js — Ride the city (P7): an L ride from the dock, a bus from ⌘K, a street-level walk at 60 fps,
// and the glide — each started the way a person would, each left with Esc. Screenshots go to test-results/ride-*.png.
import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 1600, height: 1000 } })
const ready = async (page, q) => {
  await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
  await page.goto(`/?${q}&sports=idle&stats`)
  await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 90_000 })
  await page.waitForFunction(() => window.__hudReady === true && !!window.__store.getState().transit, null, { timeout: 60_000 })
}
const st = (page) => page.evaluate(() => { const s = window.__store.getState(); return { ride: s.ride, hud: s.rideHud, flight: !!s.flight, y: window.__camera.position.y } })
const fps = (page, ms = 3000) => page.evaluate((ms) => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < ms) requestAnimationFrame(f); else r((n * 1000) / (performance.now() - t0)) }; requestAnimationFrame(f) }), ms)

test('an L ride from the dock: front window, skip a stop, pause, Esc gets off', async ({ page }) => {
  await ready(page, 'view=loop&time=DAY')
  await page.getByRole('button', { name: 'Ride (L)' }).click()
  await page.getByRole('dialog', { name: 'Ride the city' }).getByRole('button', { name: /^Brown Line/ }).first().click()
  await page.waitForFunction(() => window.__store.getState().rideHud?.kind === 'L', null, { timeout: 20_000 })
  await page.waitForTimeout(1500)
  let s = await st(page)
  expect(s.ride.view).toBe('cab'); expect(s.y).toBeLessThan(40) // on the train, not above the city
  const before = s.hud.next?.name
  await page.keyboard.press('Period')
  await page.waitForTimeout(600)
  s = await st(page)
  expect(s.hud.next?.name).not.toBe(before)
  // F-7 + C-fix: M turns the sound on and the ride goes on — and the ride train is heard in the front window
  await page.keyboard.press('KeyM')
  await expect(page.locator('.sound-toast[data-state="on"]')).toBeVisible()
  await page.keyboard.press('>'); await page.keyboard.press('>') // > > : ×4, out of the station sooner
  await page.waitForFunction(() => window.__audio?.train > 0, null, { timeout: 40_000 })
  s = await st(page)
  expect(s.ride?.kind).toBe('L')
  console.log(`RIDE L train level=${await page.evaluate(() => window.__audio.train)}`)
  await page.keyboard.press('KeyX') // fireworks: no flight while riding
  await page.waitForTimeout(600)
  s = await st(page)
  expect(s.ride?.kind).toBe('L'); expect(s.flight).toBe(false)
  await page.keyboard.press('Space')
  expect((await st(page)).ride.paused).toBe(true)
  await page.screenshot({ path: 'test-results/ride-l-cab.png' })
  await page.keyboard.press('Escape')
  s = await st(page)
  expect(s.ride).toBeNull(); expect(s.flight).toBe(true) // flies up to a clear view
})

test('a bus from ⌘K rides up Michigan Avenue', async ({ page }) => {
  await ready(page, 'view=streeterville&time=DAY')
  await page.keyboard.press('Meta+k')
  await page.waitForFunction(() => document.activeElement?.tagName === 'INPUT')
  await page.keyboard.type('bus 146')
  await page.waitForTimeout(300)
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => window.__store.getState().rideHud?.kind === 'bus', null, { timeout: 20_000 })
  await page.waitForTimeout(2000)
  const s = await st(page)
  expect(s.ride.name).toMatch(/^#146/); expect(s.y).toBeLessThan(10)
  await page.screenshot({ path: 'test-results/ride-bus.png' })
  await page.keyboard.press('ArrowUp') // a movement key takes back the camera
  expect((await st(page)).ride).toBeNull()
})

test('the Riverwalk at street level holds 55+ fps and names what is near', async ({ page }) => {
  await ready(page, 'view=river&time=DAY&ride=walk:riverwalk')
  await page.waitForFunction(() => window.__store.getState().rideHud?.kind === 'walk', null, { timeout: 20_000 })
  await page.waitForFunction(() => window.__tilesIdle === true, null, { timeout: 60_000 }).catch(() => {})
  await page.waitForTimeout(2000)
  const s = await st(page)
  expect(s.y).toBeGreaterThan(1); expect(s.y).toBeLessThan(4) // eye height
  const f = await fps(page)
  console.log(`RIDE walk fps=${f.toFixed(1)}`)
  expect(f).toBeGreaterThanOrEqual(55)
  expect((await st(page)).hud.nearby.length).toBeGreaterThan(0)
  await page.screenshot({ path: 'test-results/ride-walk.png' })
})

test('the glide: dive gains speed, the arrows steer and do not end it, Esc lands', async ({ page }) => {
  await ready(page, 'view=loop&time=DAY')
  await page.keyboard.press('KeyL')
  await page.getByRole('dialog', { name: 'Ride the city' }).getByRole('button', { name: /Glide over the city/ }).click()
  await page.waitForFunction(() => window.__store.getState().rideHud?.kind === 'glide', null, { timeout: 20_000 })
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(3000); await page.keyboard.up('ArrowUp')
  const s = await st(page)
  expect(s.ride.kind).toBe('glide'); expect(s.hud.speedKmh).toBeGreaterThan(130)
  await page.screenshot({ path: 'test-results/ride-glide.png' })
  await page.keyboard.press('Escape')
  expect((await st(page)).ride).toBeNull()
})
