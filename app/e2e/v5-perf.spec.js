// app/e2e/v5-perf.spec.js — V5 perf check (B.1.6, D15). Run: V5_PERF=1 npx playwright test e2e/v5-perf.spec.js
import { test, expect } from '@playwright/test'

test.skip(!process.env.V5_PERF, 'set V5_PERF=1 to run the V5 perf check')
test.describe.configure({ mode: 'serial' })

const POSES = {
  streeterville: '1900,320,-1500,150,60,-350', loop: '-1100,520,900,150,40,-500', wabash: '150,55,-80,140,6,-440',
  'wrigley-bowl': '-2297,25,-7347,-2332,12,-7312', 'soldier-bowl': '850,60,2187,960,5,2187', 'rate-aerial': '-660,140,5623,-494,5,5786',
}
async function measure(page, { pose, time = 'night', sports = 'idle', quality = 'HIGH' }) {
  await page.clock.setFixedTime(new Date('2026-09-28T12:00:00-05:00'))
  await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
  await page.goto(`/?pose=${POSES[pose]}&time=${time}&sports=${sports}&stats=1`)
  await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 90_000 })
  await page.evaluate((q) => window.__store.getState().setQuality(q), quality)
  await page.waitForTimeout(6000)
  const r = await page.evaluate(() => new Promise((resolve) => {
    // Sum every render() of every pass (main, shadow, post) by hooking info.reset, whatever autoReset is.
    const info = window.__gl.info, orig = info.reset.bind(info), acc = { calls: 0, triangles: 0 }
    orig()
    info.reset = () => { acc.calls += info.render.calls; acc.triangles += info.render.triangles; orig() }
    let frames = 0
    const t0 = performance.now()
    const step = () => {
      if (++frames < 120) { requestAnimationFrame(step); return }
      info.reset = orig
      resolve({ calls: Math.round((acc.calls + info.render.calls) / frames), triangles: Math.round((acc.triangles + info.render.triangles) / frames), fps: +(frames / ((performance.now() - t0) / 1000)).toFixed(1) })
    }
    requestAnimationFrame(step)
  }))
  console.log(`PERF ${pose} ${quality} ${sports}: ${r.calls} calls, ${r.triangles} tris, ${r.fps} fps`)
  return r
}

test('wide poses stay within budget with every venue live', async ({ page }) => {
  for (const pose of ['streeterville', 'loop', 'wabash']) {
    for (const sports of ['idle', 'live']) {
      const r = await measure(page, { pose, sports })
      expect(r.calls, `${pose} ${sports}`).toBeLessThanOrEqual(900)
      expect(r.triangles, `${pose} ${sports}`).toBeLessThanOrEqual(4_000_000)
    }
  }
})

test('a live game adds at most 3 calls per venue (crowd, players, ball); none at LOW', async ({ page }) => {
  for (const pose of ['wrigley-bowl', 'soldier-bowl']) {
    const idle = await measure(page, { pose, sports: 'idle' }), live = await measure(page, { pose, sports: 'live' })
    expect(live.calls - idle.calls, pose).toBeLessThanOrEqual(3)
    const idleLow = await measure(page, { pose, sports: 'idle', quality: 'LOW' }), liveLow = await measure(page, { pose, sports: 'live', quality: 'LOW' })
    expect(liveLow.calls - idleLow.calls, `${pose} LOW`).toBe(0)
  }
})

test('crowds and players are culled beyond 1.5 km', async ({ page }) => {
  const idle = await measure(page, { pose: 'rate-aerial', sports: 'idle' }) // ~230 m from Rate Field
  const far = await measure(page, { pose: 'loop', sports: 'live' }), farIdle = await measure(page, { pose: 'loop', sports: 'idle' })
  expect(far.calls - farIdle.calls).toBeLessThanOrEqual(1) // at most one scoreboard within 3 km of the Loop pose
  expect(idle.calls).toBeGreaterThan(0)
})
