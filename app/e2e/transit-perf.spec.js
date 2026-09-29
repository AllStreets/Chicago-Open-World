// app/e2e/transit-perf.spec.js — draw calls, triangles and fps at the budget poses; PERF_LOG=/abs/file.jsonl
import { test } from '@playwright/test'
import { appendFileSync } from 'node:fs'

const POSES = (process.env.POSES ?? 'streeterville,loop,transit1000').split(',')
test.skip(!process.env.PERF_LOG, 'set PERF_LOG to record perf')
for (const view of POSES) {
  test(`perf ${view}`, async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-09-30T08:15:00-05:00'))
    await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
    await page.goto(`/?view=${view}&time=night&stats`)
    await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 90_000 })
    await page.waitForFunction(() => window.__camRest === true && window.__skyRest === true && window.__tilesIdle === true && window.__hudReady === true, null, { timeout: 90_000 })
    await page.waitForTimeout(2000)
    const r = await page.evaluate(async () => {
      const gl = window.__gl
      const frame = () => new Promise((res) => requestAnimationFrame(() => res()))
      const measure = async () => {
        gl.info.autoReset = false
        const s = []
        for (let i = 0; i < 30; i++) { gl.info.reset(); await frame(); s.push([gl.info.render.calls, gl.info.render.triangles]) }
        gl.info.autoReset = true
        return { calls: Math.max(...s.map((x) => x[0])), tris: Math.max(...s.map((x) => x[1])) }
      }
      const all = await measure()
      let transit = null
      const pools = window.__transitPools // exposed by TransitLayer under ?stats (Task 14); absent before V3
      const extra = window.__trainMeshes ?? [] // exposed by Trains under ?stats (V4)
      if (pools) {
        const hide = [pools.structure.mesh, pools.glow.mesh, ...extra]
        const was = hide.map((m) => m.visible)
        hide.forEach((m) => { m.visible = false })
        const off = await measure()
        hide.forEach((m, i) => { m.visible = was[i] })
        transit = { calls: all.calls - off.calls, tris: all.tris - off.tris }
      }
      const t0 = performance.now()
      for (let i = 0; i < 120; i++) await frame()
      return { ...all, transit, fps: Math.round(120000 / (performance.now() - t0)) }
    })
    appendFileSync(process.env.PERF_LOG, JSON.stringify({ view, at: new Date().toISOString(), ...r }) + '\n')
  })
}
