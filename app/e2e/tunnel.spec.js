// app/e2e/tunnel.spec.js — follow a Red Line train down the portal into the State Street subway (user, 2026-09-30):
// chase and side views inside the tube and at an underground station; the camera is below ground and the frame is a
// lit tunnel, not black and not sky. SHOTS_DIR=/abs/dir also saves the frames.
import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 1440, height: 900 } })
test.setTimeout(240_000)

// what the canvas shows, reduced to a 96 × 60 thumbnail: mean luminance, spread, and the share of sky-blue pixels
const frameStats = () => {
  const src = window.__gl.domElement, c = document.createElement('canvas')
  c.width = 96; c.height = 60
  const ctx = c.getContext('2d')
  ctx.drawImage(src, 0, 0, 96, 60)
  const d = ctx.getImageData(0, 0, 96, 60).data
  let sum = 0, sum2 = 0, sky = 0
  const n = d.length / 4
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255, l = 0.2126 * r + 0.7152 * g + 0.0722 * b
    sum += l; sum2 += l * l
    if (b > r + 0.08 && b > 0.45) sky++
  }
  const mean = sum / n
  return { mean, std: Math.sqrt(Math.max(0, sum2 / n - mean * mean)), sky: sky / n }
}

test('follows a Red Line train into the State Street subway: chase, side, and an underground station', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-30T08:15:00-05:00') }) // a weekday rush: Red Line trains every few minutes
  await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
  await page.goto('/?stats&time=day')
  await page.waitForFunction(() => window.__worldReady === true && window.__getSim?.() && window.__store?.getState().introDone, null, { timeout: 120_000 })
  await page.waitForTimeout(1500)

  // a Red Line train still on the surface that reaches the subway soonest
  const pick = await page.evaluate(() => {
    const sim = window.__getSim(), now = Date.now()
    let best = null
    for (const t of sim.trainsAt(now)) {
      if (t.line !== 'red' || t.head.p[1] < -1) continue
      for (let k = 5; k <= 240; k += 5) {
        const f = sim.trainById(t.id, now + k * 1000)
        if (!f) break
        if (f.head.p[1] < -8.5) { if (!best || k < best.k) best = { id: t.id, k }; break }
      }
    }
    if (best) { window.__store.getState().setTransitOn(true); window.__store.getState().startFollow(best.id, 'chase') }
    return best
  })
  expect(pick, 'a Red Line train heading underground').not.toBeNull()
  await page.waitForTimeout(2500)
  const shot = async (name) => {
    const s = await page.evaluate(frameStats)
    if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/tunnel-${name}.png` })
    else await test.info().attach(`tunnel-${name}`, { body: await page.screenshot(), contentType: 'image/png' })
    return s
  }
  await shot('portal-approach')

  // down the ramp and into the tube
  await page.clock.fastForward(pick.k * 1000 + 12_000)
  await page.waitForTimeout(3000)
  const camY = () => page.evaluate(() => window.__camera.position.y)
  const assertTube = (s, where) => {
    expect(s.mean, `${where}: not black`).toBeGreaterThan(0.06)
    expect(s.sky, `${where}: not sky`).toBeLessThan(0.15)
    expect(s.std, `${where}: a scene, not a flat fill`).toBeGreaterThan(0.04)
  }
  expect(await page.evaluate(() => window.__store.getState().follow?.trainId)).toBe(pick.id)
  expect(await camY()).toBeLessThan(0)
  assertTube(await shot('chase'), 'tunnel chase')

  await page.evaluate(() => window.__store.getState().setFollowView('side'))
  await page.waitForTimeout(2500)
  expect(await camY()).toBeLessThan(0)
  assertTube(await shot('side'), 'tunnel side')

  // on to its next stop in the subway: the train dwells at an underground platform
  const dwell = await page.evaluate((id) => {
    const sim = window.__getSim(), now = Date.now()
    for (let k = 1; k < 600; k++) { const t = sim.trainById(id, now + k * 1000); if (t && t.speed < 0.05 && t.head.p[1] < -6) return { ms: k * 1000 + 5000, stop: t.nextStop?.name ?? null } }
    return null
  }, pick.id)
  expect(dwell, 'an underground stop').not.toBeNull()
  await page.clock.fastForward(dwell.ms)
  await page.waitForTimeout(3000)
  expect(await camY()).toBeLessThan(0)
  assertTube(await shot('station-side'), 'station side')
  await page.evaluate(() => window.__store.getState().setFollowView('chase'))
  await page.waitForTimeout(2500)
  expect(await camY()).toBeLessThan(0)
  assertTube(await shot('station-chase'), 'station chase')

  // and back up: stopping the follow returns the camera to the surface
  await page.evaluate(() => window.__store.getState().stopFollow())
  await page.waitForFunction(() => window.__camera.position.y > 0, null, { timeout: 10_000 })
})

// C-fix (2026-10-01): "when I press M to switch the sound on/off while following a train it makes me stop following it"
test('M, X and K keep a train follow; W takes the camera back', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
  await page.goto('/?view=loop&time=day&sports=idle&stats')
  await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 90_000 })
  await page.waitForFunction(() => window.__hudReady === true && !!window.__store.getState().transit, null, { timeout: 60_000 })
  // the simulator can still be empty right after the HUD is ready — wait for a train to follow. Overnight only the
  // Red and Blue owl services run (both in the subway here), so prefer an elevated train but take any.
  await page.waitForFunction(() => window.__live?.trains().some((x) => x.cars?.[0]), null, { timeout: 30_000 })
  const id = await page.evaluate(() => {
    const all = window.__live.trains().filter((x) => x.cars?.[0])
    const t = all.find((x) => x.head.p[1] > 0) ?? all[0]
    window.__store.getState().startFollow(t.id, 'chase')
    return t.id
  })
  const follow = () => page.evaluate(() => { const s = window.__store.getState(); return { follow: s.follow, flight: Boolean(s.flight) } })
  await page.waitForTimeout(1500)
  await page.keyboard.press('KeyM')
  await expect(page.locator('.sound-toast[data-state="on"]')).toBeVisible()
  await page.waitForTimeout(1000)
  expect((await follow()).follow?.trainId).toBe(id)
  await expect(page.locator('.follow-chip')).toBeVisible()
  await page.keyboard.press('KeyX') // fireworks: no flight while following, a toast says where the show is
  await page.waitForTimeout(600)
  let s = await follow()
  expect(s.follow?.trainId).toBe(id); expect(s.flight).toBe(false)
  await expect(page.locator('.toast')).toContainText('Navy Pier')
  await page.keyboard.press('KeyK') // K changes the follow view, like in a ride
  expect((await follow()).follow?.view).toBe('side')
  await page.keyboard.press('KeyM') // and sound back off: still following
  await expect(page.locator('.sound-toast[data-state="off"]')).toBeVisible()
  expect((await follow()).follow?.trainId).toBe(id)
  await page.keyboard.press('KeyW')
  s = await follow()
  expect(s.follow).toBeNull()
})
