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
    await page.waitForFunction(() => window.__perf?.frames >= 60, null, { timeout: 30_000 })
    const s = await page.evaluate(() => window.__perf)
    const census = await page.evaluate(() => window.__census?.())
    console.log(`PERF ${name} calls=${s.calls} max=${s.maxCalls} tris=${s.triangles} maxTris=${s.maxTriangles} fps=${s.fps} census=${JSON.stringify(census)}`)
    expect(s.maxCalls).toBeLessThanOrEqual(900)
    expect(s.maxTriangles).toBeLessThanOrEqual(4_000_000)
  })
}
