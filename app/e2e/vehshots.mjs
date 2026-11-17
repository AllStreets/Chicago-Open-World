// app/e2e/vehshots.mjs — land-vehicle captures (the Blender cars, buses, trucks and trains): street level and low
// aerial on Michigan Avenue, a train at Clark/Lake and one on Wells. Same test-only ?eye= pose as f9shots.mjs.
// node e2e/vehshots.mjs <outDir> [names…]   BASE (default http://localhost:5177) picks the dev server; TIME=DAY|DUSK|NIGHT.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const [outDir = 'test-results/veh', ...only] = process.argv.slice(2)
mkdirSync(outDir, { recursive: true })
const base = process.env.BASE ?? 'http://localhost:5177'
export const VEH_SHOTS = [
  { name: 'michigan-street', eye: [289, 1.7, -870, 292, 1.2, -960] },    // at the kerb on Michigan, looking north
  { name: 'michigan-close', eye: [286, 3.2, -885, 296, 0.5, -905] },     // the nearest cars, close
  { name: 'michigan-aerial', eye: [255, 30, -860, 300, 0, -960] },       // a low aerial over the avenue
  { name: 'clarklake-train', eye: [-262, 13, -398, -312, 8.5, -416] },  // the Loop L at Clark/Lake
  { name: 'wells-train', eye: [-478, 12.5, -80, -500, 8.5, -30] },      // Wells Street, south of Lake
]
const CLOCK = { DAY: '2026-09-28T12:00:00-05:00', DUSK: '2026-09-28T19:05:00-05:00', NIGHT: '2026-09-28T22:30:00-05:00' }
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const time = process.env.TIME ?? 'DAY'
for (const s of VEH_SHOTS.filter((x) => !only.length || only.includes(x.name))) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  page.on('pageerror', (e) => console.error('pageerror', e.message))
  await page.clock.setFixedTime(new Date(CLOCK[time]))
  await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
  await page.goto(`${base}/?eye=${s.eye.join(',')}&time=${time}&sports=idle&traffic=idle&stats`)
  await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 120_000 })
  await page.waitForFunction(() => window.__tilesIdle === true && window.__hudReady === true, null, { timeout: 90_000 }).catch(() => console.error('not idle'))
  await page.waitForTimeout(4000)
  const file = `${outDir}/${s.name}-${time.toLowerCase()}.png`
  await page.screenshot({ path: file })
  console.log(file)
  await page.close()
}
await browser.close()
