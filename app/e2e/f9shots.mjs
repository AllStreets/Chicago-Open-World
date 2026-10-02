// app/e2e/f9shots.mjs — F-9 captures: the scripted Blender boats on the river — Marina City's slips from a tour boat's
// upper deck and from the Riverwalk, a tour boat under way past Marina City, the tour-boat docks at Michigan Avenue.
// node e2e/f9shots.mjs <outDir> [names…]   BASE (default http://localhost:5175) picks the dev server; TIME=DUSK.
// Uses the test-only ?eye= pose (AtlasRig: held without the orbit clamp, only with ?stats), as a8shots.mjs does.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const [outDir = 'test-results/f9', ...only] = process.argv.slice(2)
mkdirSync(outDir, { recursive: true })
const base = process.env.BASE ?? 'http://localhost:5175'
const BOAT = -2.5, WALK = -3.6
export const F9_SHOTS = [
  { name: 'marina-boat', eye: [-40, BOAT, -605, -95, 2, -660] },               // = a8shots marina-boat (the README pair)
  { name: 'marina-slips', eye: [-52, WALK + 0.4, -612, -100, -4.5, -640] },     // the slips close, at the water
  { name: 'tourboat-marina', eye: [-30, BOAT + 1.5, -580, -84, -3.5, -606] },     // a tour boat under way past Marina City
  { name: 'tourboat-michigan', eye: [252, BOAT + 1, -764, 205, -4, -797] },       // the docks below the Wrigley Building
  { name: 'river-east', eye: [560, BOAT + 6, -735, 440, -4, -752] },             // under way toward the lake
]
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const time = process.env.TIME ?? 'DAY'
for (const s of F9_SHOTS.filter((x) => !only.length || only.includes(x.name))) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  page.on('pageerror', (e) => console.error('pageerror', e.message))
  await page.clock.setFixedTime(new Date(time === 'DAY' ? '2026-09-28T12:00:00-05:00' : '2026-09-28T19:05:00-05:00'))
  await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
  await page.goto(`${base}/?eye=${s.eye.join(',')}&time=${time}&sports=idle&traffic=idle&stats`)
  await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 120_000 })
  await page.waitForFunction(() => window.__tilesIdle === true && window.__hudReady === true, null, { timeout: 90_000 }).catch(() => console.error('not idle'))
  await page.waitForFunction(() => Boolean(window.__riverBoats), null, { timeout: 30_000 }).catch(() => console.error('no boats'))
  await page.waitForTimeout(2500)
  const file = `${outDir}/${s.name}-${time.toLowerCase()}.png`
  await page.screenshot({ path: file })
  console.log(file, JSON.stringify(await page.evaluate(() => window.__riverBoats?.())))
  await page.close()
}
await browser.close()
