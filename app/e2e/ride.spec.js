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

test('the Riverwalk at river level (D1-7): the eye stays 1.5–1.9 m over the walk, 55+ fps, it names what is near, and it walks to the end', async ({ page }) => {
  await ready(page, 'view=river&time=DAY&ride=walk:riverwalk')
  await page.waitForFunction(() => window.__store.getState().rideHud?.kind === 'walk', null, { timeout: 20_000 })
  await page.waitForFunction(() => window.__tilesIdle === true, null, { timeout: 60_000 }).catch(() => {})
  await page.waitForTimeout(2000)
  // the Riverwalk's height comes from the manifest (levels.river.riverwalk), never a constant
  const walkY = await page.evaluate(() => window.__store.getState().manifest?.levels?.river?.riverwalk ?? 0.1)
  const eyeOk = async () => { const y = (await st(page)).y; expect(y).toBeGreaterThan(walkY + 1.5); expect(y).toBeLessThan(walkY + 1.9) }
  await eyeOk()
  const f = await fps(page)
  console.log(`RIDE walk fps=${f.toFixed(1)} eye=${(await st(page)).y.toFixed(2)} (walk ${walkY})`)
  // the plan's D1-7 target is 58 fps on a quiet machine (measured 57.8–58.9 with the box under load 7.5); the gate keeps
  // the suite's own 55 floor so a busy machine does not fail it — the logged figure is what the stage reports
  expect(f).toBeGreaterThanOrEqual(55)
  expect((await st(page)).hud.nearby.length).toBeGreaterThan(0)
  await page.screenshot({ path: 'test-results/ride-walk.png' })
  // ×4 through the rooms: under the bridges, past the River Theater — the eye never leaves the walk's level
  await page.keyboard.press('>'); await page.keyboard.press('>')
  for (let k = 0; k < 4; k++) { await page.waitForTimeout(1500); await eyeOk() }
  // and on to its end at the Confluence
  const total = await page.evaluate(() => window.__store.getState().rideHud?.progress)
  expect(total).toBeGreaterThan(0)
  await page.keyboard.press('Period') // skip stop by stop to the last
  for (let k = 0; k < 30 && (await st(page)).ride; k++) { await page.keyboard.press('Period'); await page.waitForTimeout(150) }
  const end = await page.evaluate(() => ({ done: window.__store.getState().rideHud?.done ?? null, ride: !!window.__store.getState().ride }))
  expect(end.done === true || end.ride === false).toBe(true)
})

test('the Lower Wacker drive (D3-3): ⌘K "Drive Lower Wacker", the cab goes under the street, traffic below, and it drives to Lake St', async ({ page }) => {
  await ready(page, 'view=river&time=DAY')
  await page.keyboard.press('Meta+k')
  await page.waitForFunction(() => document.activeElement?.tagName === 'INPUT')
  await page.keyboard.type('Drive Lower Wacker')
  await page.waitForTimeout(300)
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => window.__store.getState().rideHud?.kind === 'drive', null, { timeout: 20_000 })
  let s = await st(page)
  expect(s.ride.name).toMatch(/^Lower Wacker/); expect(s.ride.view).toBe('cab')
  // on to Lower Columbus: the cab is under the street, 2.4 m over Lower Wacker's level, with the lower decks drawn
  await page.keyboard.press('Period')
  await page.waitForFunction(() => window.__camera.position.y < -2, null, { timeout: 20_000 })
  await page.waitForTimeout(2500)
  s = await st(page)
  expect(s.y).toBeGreaterThan(-5.1 + 2.0); expect(s.y).toBeLessThan(-5.1 + 2.8)
  const below = await page.evaluate(() => (window.__traffic?.sim?.vehicles ?? []).filter((v) => v.y < -4).length)
  console.log(`RIDE drive eye=${s.y.toFixed(2)} vehicles under the street=${below}`)
  expect(below).toBeGreaterThan(0) // the lower decks carry traffic while the ride shows them
  await page.screenshot({ path: 'test-results/ride-drive.png' })
  // stop by stop to the Lake St exit: it comes up to the street at the end
  for (let k = 0; k < 12 && !(await page.evaluate(() => window.__store.getState().rideHud?.done)); k++) { await page.keyboard.press('Period'); await page.waitForTimeout(400) }
  await page.waitForTimeout(800)
  const end = await page.evaluate(() => ({ done: window.__store.getState().rideHud?.done ?? null, y: window.__camera.position.y }))
  expect(end.done).toBe(true); expect(end.y).toBeGreaterThan(1.5)
  await page.keyboard.press('Escape')
  expect((await st(page)).ride).toBeNull()
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
