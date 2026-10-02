// app/e2e/f8shots.mjs — F-8 beach polish captures: North Avenue, Oak Street, Ohio Street and Fullerton beaches (warm
// sand, the walks across it, the Lakefront Trail, the volleyball nets), day / dusk / night / snow.
// node e2e/f8shots.mjs <outDir> [names…]   BASE (default http://localhost:5175); TIME=DAY|DUSK|NIGHT|SNOW.
// Uses the test-only ?eye= pose (AtlasRig: held without the orbit clamp, only with ?stats).
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const [outDir = 'test-results/f8', ...only] = process.argv.slice(2)
mkdirSync(outDir, { recursive: true })
const base = process.env.BASE ?? 'http://localhost:5175'
export const F8_SHOTS = [
  { name: 'northave-beach', eye: [560, 11, -3420, 300, -1, -3580] },
  { name: 'northave-high', eye: [700, 160, -3250, 330, 0, -3560] },
  { name: 'northave-courts', eye: [600, 5, -3560, 470, -1, -3450] },
  { name: 'northave-trail', eye: [120, 14, -3500, 220, 0, -3700] },
  { name: 'oak-beach', eye: [560, 18, -2520, 300, -1, -2290] },
  { name: 'ohio-beach', eye: [1330, 7, -1440, 1120, -2, -1270] },
  { name: 'fullerton-beach', eye: [40, 30, -5050, -250, -1, -5200] },
]
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const time = process.env.TIME ?? 'DAY'
const at = { DAY: '2026-09-28T12:00:00-05:00', DUSK: '2026-09-28T19:05:00-05:00', NIGHT: '2026-09-28T22:00:00-05:00', SNOW: '2026-09-28T12:00:00-05:00' }
for (const s of F8_SHOTS.filter((x) => !only.length || only.includes(x.name))) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  page.on('pageerror', (e) => console.error('pageerror', e.message))
  await page.clock.setFixedTime(new Date(at[time]))
  await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
  await page.goto(`${base}/?eye=${s.eye.join(',')}&time=${time}&sports=idle&traffic=idle&stats`)
  await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 120_000 })
  await page.waitForFunction(() => window.__tilesIdle === true && window.__hudReady === true, null, { timeout: 90_000 }).catch(() => console.error('not idle'))
  await page.waitForTimeout(2500)
  const file = `${outDir}/${s.name}-${time.toLowerCase()}.png`
  await page.screenshot({ path: file })
  const tris = await page.evaluate(() => window.__gl?.info.render.triangles)
  console.log(file, 'tris', tris)
  await page.close()
}
await browser.close()
