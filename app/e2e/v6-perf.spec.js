// app/e2e/v6-perf.spec.js — draw calls, triangles and fps (averaged over 60 frames) at the budget poses.
import { test } from '@playwright/test'
const VIEWS = ['streeterville', 'loop', 'bridges', 'dusable', 'buckingham', 'cloudgate', 'crownfountain']
for (const v of VIEWS) {
  test(`perf ${v}`, async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
    await page.goto(`/?view=${v}&time=dusk&stats`)
    await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 90_000 })
    await page.waitForTimeout(6000)
    const r = await page.evaluate(() => new Promise((res) => {
      const gl = window.__gl; gl.info.autoReset = false; gl.info.reset()
      let n = 0; const t0 = performance.now()
      const tick = () => { if (++n < 60) { requestAnimationFrame(tick); return } const { calls, triangles } = gl.info.render; gl.info.autoReset = true; res({ calls: calls / n, triangles: triangles / n, fps: (n * 1000) / (performance.now() - t0) }) }
      requestAnimationFrame(tick)
    }))
    console.log(`PERF ${v} calls=${r.calls.toFixed(0)} tris=${(r.triangles / 1e6).toFixed(2)}M fps=${r.fps.toFixed(0)}`)
  })
}
