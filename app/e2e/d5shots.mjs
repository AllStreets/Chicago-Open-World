// app/e2e/d5shots.mjs — D5 / B-8 captures: the lake at its real level and how the lakefront meets it (Navy Pier, the
// beaches, the revetments, the harbours and their boats, the Harbor Lock, Northerly Island), day and dusk.
// node e2e/d5shots.mjs <outDir> [names…]   BASE (default http://localhost:5175) picks the dev server; TIME=DUSK.
// Uses the test-only ?eye= pose (AtlasRig: held without the orbit clamp, only with ?stats).
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const [outDir = 'test-results/d5', ...only] = process.argv.slice(2)
mkdirSync(outDir, { recursive: true })
const base = process.env.BASE ?? 'http://localhost:5175'
export const D5_SHOTS = [
  { name: 'navypier-lake', eye: [2350, 14, -640, 1700, 2, -1060] },
  { name: 'navypier-face', eye: [2000, -2.4, -930, 1820, -2.5, -1010] },
  { name: 'lock-mouth', eye: [1990, 4, -640, 1760, -3, -712] },
  { name: 'ohio-beach', eye: [1380, 9, -1180, 1150, -2, -1300] },
  { name: 'oak-revetment', eye: [600, 3, -2240, 360, -2, -2350] },
  { name: 'northave-beach', eye: [560, 11, -3420, 300, -1, -3580] },
  { name: 'fullerton-revetment', eye: [60, 4, -4820, -150, -2, -4960] },
  { name: 'diversey-harbor', eye: [-200, 30, -5180, -440, -3, -5340] },
  { name: 'belmont-harbor', eye: [-520, 40, -6480, -800, -3, -6680] },
  { name: 'belmont-docks', eye: [-700, 6, -6560, -800, -3, -6640] },
  { name: 'monroe-harbor', eye: [1450, 30, 120, 1100, -3, 340] },
  { name: 'northave-high', eye: [700, 160, -3250, 330, 0, -3560] },
  { name: 'navypier-high', eye: [2300, 200, -700, 1700, 0, -1080] },
  { name: 'lock-high', eye: [1960, 110, -540, 1720, 0, -715] },
  { name: 'ohio-high', eye: [1350, 140, -1500, 1150, 0, -1300] },
  { name: 'diversey-high', eye: [-180, 160, -5050, -430, 0, -5330] },
  { name: 'northerly-island', eye: [2150, 25, 2450, 1700, -2, 2680] },
]
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const time = process.env.TIME ?? 'DAY'
for (const s of D5_SHOTS.filter((x) => !only.length || only.includes(x.name))) {
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
