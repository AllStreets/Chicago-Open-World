// app/e2e/perf.spec.js — the HIGH budget: ≤ 900 draw calls, ≤ 4 M triangles per frame at the wide and dense poses (H11).
import { test, expect } from '@playwright/test'
import { PERF_POSES } from '../src/lib/perfPoses.js'

test.use({ viewport: { width: 1440, height: 900 } })
for (const [name, pose] of Object.entries(PERF_POSES)) {
  test(`budget at ${name}`, async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-09-28T19:00:00-05:00')) // a pinned dusk: the same trains and lights every run
    await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
    await page.goto(`/?pose=${[...pose.position, ...pose.target].join(',')}&time=dusk&perf&stats`)
    await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 90_000 })
    await page.waitForFunction(() => window.__camRest === true && window.__tilesIdle === true, null, { timeout: 90_000 }) // far poses stream tiles in
    if (pose.lowerLevels) { // D2: the U cut-away, pressed the way a person does, fully open before measuring
      await page.waitForFunction(() => Boolean(window.__lowerLevels), null, { timeout: 30_000 })
      await page.keyboard.press('u')
      await page.waitForFunction(() => window.__store?.getState().lowerLevelsOn === true, null, { timeout: 5_000 })
      await page.waitForTimeout(2500) // the 0.6 s dissolve, then the probe's window holds only cut-away frames
    }
    if (pose.showcase) { // E4: mid-game (the clock is pinned, so the showcase holds still at msIn)
      await page.waitForFunction(() => window.__sports?.getState().venues.length > 0, null, { timeout: 30_000 })
      await page.evaluate(([k, t, ms]) => window.__sports.getState().startShowcase(k, t, Date.now() - ms), pose.showcase)
      await page.waitForFunction((k) => window.__sports.getState().states[k]?.game?.showcase === true, pose.showcase[0], { timeout: 10_000 })
      await page.waitForTimeout(2500) // the probe's 60-frame window now holds only showcase frames
    }
    await page.waitForFunction(() => window.__perf?.frames >= 60, null, { timeout: 30_000 })
    const s = await page.evaluate(() => window.__perf)
    const census = await page.evaluate(() => window.__census?.())
    console.log(`PERF ${name} calls=${s.calls} max=${s.maxCalls} tris=${s.triangles} maxTris=${s.maxTriangles} fps=${s.fps} census=${JSON.stringify(census)}`)
    expect(s.maxCalls).toBeLessThanOrEqual(900)
    expect(s.maxTriangles).toBeLessThanOrEqual(4_000_000)
  })
}
