// app/e2e/a8shots.mjs — A-8/A-9 captures: the river icons' river-level bases and the bridge houses, seen from the
// Riverwalk (eye ≈ RIVERWALK_Y + 1.7 = −3.6) and from a tour boat's upper deck (≈ −2.5), day and dusk.
// node e2e/a8shots.mjs <outDir> [names…]   BASE (default http://localhost:5175) picks the dev server; TIME=DUSK.
// Uses the test-only ?eye= pose (AtlasRig: held without the orbit clamp, only with ?stats).
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const [outDir = 'test-results/a8', ...only] = process.argv.slice(2)
mkdirSync(outDir, { recursive: true })
const base = process.env.BASE ?? 'http://localhost:5175'
const BOAT = -2.5, WALK = -3.6
export const A8_SHOTS = [
  // A-9: the DuSable Bridge's four bridgehouses and their reliefs; the McCormick Bridgehouse (SW)
  { name: 'dusable-boat-west', eye: [345, BOAT, -770, 250, 2, -768] },
  { name: 'dusable-riverwalk-sw', eye: [230, WALK, -722, 282, 4, -748] },
  { name: 'dusable-street-nw', eye: [292, 1.7, -860, 280, 6, -805] },
  { name: 'dusable-relief-nw', eye: [278, 1.7, -828, 277.6, 7.5, -806] },
  { name: 'dusable-relief-se', eye: [296, 1.7, -690, 297, 7.5, -712] },
  { name: 'dusable-street-se', eye: [300, 1.7, -655, 305, 6, -712] },
  // A-8: the north bank at Michigan — Apple's steps, the Wrigley plaza, Trump's terraces
  { name: 'apple-boat', eye: [380, BOAT, -760, 355, 0, -815] },
  { name: 'wrigley-trump-boat', eye: [240, BOAT, -748, 110, 4, -745] },
  { name: 'trump-riverwalk', eye: [125, WALK, -662, 120, 6, -725] },
  { name: 'marina-boat', eye: [-40, BOAT, -605, -95, 2, -660] },
  { name: 'marina-riverwalk', eye: [-75, WALK, -575, -85, 4, -660] },
  { name: 'lasalle300-boat', eye: [-410, BOAT, -600, -445, 3, -670] },
  { name: 'mart-boat', eye: [-580, BOAT, -605, -650, 4, -680] },
  { name: 'wolfpoint-boat', eye: [-690, BOAT, -598, -745, 3, -640] },
  { name: 'riverpoint-boat', eye: [-835, BOAT, -470, -950, 4, -455] },
  { name: 'riverside150-boat', eye: [-815, BOAT, -330, -885, 4, -360] },
  { name: 'opera-boat', eye: [-870, BOAT, -10, -800, 4, -70] },
  { name: 'riversideplaza-boat', eye: [-845, BOAT, -110, -935, 4, -50] },
  { name: 'rivercity-boat', eye: [-625, BOAT, 1150, -555, 3, 1190] },
  // A41: the Heald Square Monument and the Wacker Drive balustrade with its pylons, from the street and the Riverwalk
  { name: 'heald-street', eye: [124, 1.7, -590, 143, 3.2, -567] },
  { name: 'wacker-balustrade-riverwalk', eye: [44, WALK, -584, 14, 0.4, -556] },
  // A-9: other bridge houses on the main stem (Wabash deco, Clark, Wells, Franklin-Orleans)
  { name: 'wabash-house-boat', eye: [80, BOAT, -640, 140, 3, -690] },
  { name: 'franklin-house-boat', eye: [-600, BOAT, -600, -540, 3, -640] },
  { name: 'lasalle-house-boat', eye: [-330, BOAT, -605, -395, 3, -640] },
]
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const time = process.env.TIME ?? 'DAY'
for (const s of A8_SHOTS.filter((x) => !only.length || only.includes(x.name))) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  page.on('pageerror', (e) => console.error('pageerror', e.message))
  await page.clock.setFixedTime(new Date(time === 'DAY' ? '2026-09-28T12:00:00-05:00' : '2026-09-28T19:05:00-05:00'))
  await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
  await page.goto(`${base}/?eye=${s.eye.join(',')}&time=${time}&sports=idle&traffic=idle&stats`)
  await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 120_000 })
  await page.waitForFunction(() => window.__tilesIdle === true && window.__hudReady === true, null, { timeout: 90_000 }).catch(() => console.error('not idle'))
  await page.waitForTimeout(2500)
  const file = `${outDir}/${s.name}-${time.toLowerCase()}.png`
  await page.screenshot({ path: file })
  console.log(file)
  await page.close()
}
await browser.close()
