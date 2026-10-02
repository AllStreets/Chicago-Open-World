// app/scripts/capture.mjs — evaluate-and-revert screenshots at fixed poses, perf readouts, bookmark clearance.
// Needs `npm run dev` running. Usage (from app/):
//   node scripts/capture.mjs <outDir> <pose>[@day|dusk|night] ... [--perf] [--bookmarks]
//   CAPTURE_DATE=2027-03-17T12:00:00-05:00  pins the calendar (default 2026-09-28 noon, like the e2e)
//   CAPTURE_QUERY='&reflect=0'               extra test-only URL params
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { BOOKMARKS } from '../src/lib/bookmarks.js'

export const POSES = {
  ...BOOKMARKS,
  'streeterville-438': { position: [1900, 438, -1500], target: [150, 60, -350] },
  harbor: { position: [600, 160, 900], target: [1400, 0, 200] },
  shore: { position: [250, 40, -2200], target: [520, 0, -2420] },
  'lake-east': { position: [-3300, 1200, -500], target: [2500, 0, -500] },
  'lake-north': { position: [1800, 1200, 5400], target: [1800, 0, -400] },
  'lake-south': { position: [1800, 1200, -6200], target: [1800, 0, -400] },
  'soldierfield-bowl': { position: [930, 95, 2335], target: [930, 0, 2197] },
  'willis-base': { position: [-674, 120, 560], target: [-674, 80, 366] },
  // F-8 beach polish: Oak Street Beach from the north end, North Avenue Beach's volleyball courts up close
  oakstreetbeach: { position: [520, 45, -2560], target: [300, 0, -2260] },
  'nab-courts': { position: [380, 22, -3800], target: [250, 0, -3650] },
  'lincoln-lagoon': { position: [-200, 160, -4000], target: [-470, 0, -4273] },
  // V2 building-colour evaluation poses
  wrigley: { position: [430, 170, -640], target: [300, 70, -900] },
  aon: { position: [1050, 260, 150], target: [522, 180, -361] },
  s311: { position: [-150, 360, 1060], target: [-657, 250, 507] },
}

const args = process.argv.slice(2)
const flags = new Set(args.filter((a) => a.startsWith('--')))
const [outDir, ...specs] = args.filter((a) => !a.startsWith('--'))
mkdirSync(outDir, { recursive: true })
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
await page.clock.setFixedTime(new Date(process.env.CAPTURE_DATE ?? '2026-09-28T12:00:00-05:00'))
await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })

const rest = () => page.waitForFunction(() => window.__camRest && window.__skyRest && window.__tilesIdle && window.__hudReady && !window.__store.getState().flight, null, { timeout: 90_000 })
const measure = () => page.evaluate(() => new Promise((res) => {
  const gl = window.__gl
  gl.info.autoReset = false
  requestAnimationFrame(() => {
    gl.info.reset()
    requestAnimationFrame(() => {
      const one = { calls: gl.info.render.calls, triangles: gl.info.render.triangles }
      gl.info.autoReset = true
      let n = 0
      const t0 = performance.now()
      const tick = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(tick); else res({ ...one, fps: Math.round((n * 1000) / (performance.now() - t0)) }) }
      requestAnimationFrame(tick)
    })
  })
}))

for (const spec of specs) {
  const [name, time = 'day'] = spec.split('@')
  const pose = POSES[name]
  if (!pose) throw new Error(`unknown pose ${name}`)
  await page.goto(`http://localhost:${process.env.CAPTURE_PORT ?? 5173}/?stats&view=streeterville&time=${time}${process.env.CAPTURE_QUERY ?? ''}`)
  await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 90_000 })
  await page.evaluate((p) => window.__store.getState().startFlight(p, 'capture'), pose)
  await rest()
  await page.screenshot({ path: `${outDir}/${name}-${time}.png` })
  if (flags.has('--perf')) console.log(`${name}@${time}`, JSON.stringify(await measure()))
}
if (flags.has('--bookmarks')) {
  await page.goto(`http://localhost:${process.env.CAPTURE_PORT ?? 5173}/?stats&view=streeterville&time=day`)
  await page.waitForFunction(() => window.__worldReady === true && typeof window.__clearanceAt === 'function', null, { timeout: 90_000 })
  await page.waitForTimeout(1500) // heightfield decode
  const rows = await page.evaluate((B) => Object.entries(B).map(([k, b]) => [k, b.position[1], Math.round(window.__clearanceAt(b.position[0], b.position[2]))]), BOOKMARKS)
  for (const [k, y, c] of rows) console.log(`${k}: camera y ${y}, clearance ${c}${y < c ? '  ← LIFTED' : ''}`)
}
await browser.close()
