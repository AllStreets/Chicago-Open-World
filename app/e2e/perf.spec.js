// app/e2e/perf.spec.js — the HIGH budget: ≤ 900 draw calls, ≤ 4 M triangles per frame at the wide and dense poses (H11).
import { test, expect } from '@playwright/test'
import { PERF_POSES } from '../src/lib/perfPoses.js'

test.use({ viewport: { width: 1440, height: 900 } })
for (const [name, pose] of Object.entries(PERF_POSES)) {
  test(`budget at ${name}`, async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
    await page.goto(`/?pose=${[...pose.position, ...pose.target].join(',')}&time=dusk&perf&stats`)
    await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 90_000 })
    await page.waitForTimeout(8000) // tiles stream in for the far poses
    await page.waitForFunction(() => window.__perf?.frames >= 60, null, { timeout: 30_000 })
    const s = await page.evaluate(() => window.__perf)
    const census = await page.evaluate(() => window.__census?.())
    console.log(`PERF ${name} calls=${s.calls} max=${s.maxCalls} tris=${s.triangles} fps=${s.fps} census=${JSON.stringify(census)}`)
    expect(s.maxCalls).toBeLessThanOrEqual(900)
    expect(s.triangles).toBeLessThanOrEqual(4_000_000)
  })
}
