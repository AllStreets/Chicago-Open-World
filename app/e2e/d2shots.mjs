// app/e2e/d2shots.mjs — D2 (the multi-level streets and the U cut-away) captures for the README and the stage review.
// node e2e/d2shots.mjs <outDir> [names…]   BASE (default http://localhost:5174) picks the dev server.
// `u: true` presses U the way a person does once the world is ready (the view's own flight is skipped: ?view/pose).
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const [outDir = 'test-results/d2', ...only] = process.argv.slice(2)
mkdirSync(outDir, { recursive: true })
const base = process.env.BASE ?? 'http://localhost:5174'
export const D2_SHOTS = [
  // the U view over the Loop: Lower Wacker, Lower Michigan and Illinois Center's lower streets from the southeast
  { name: 'u-loop-day', q: 'view=lowerlevels&time=DAY', u: true },
  { name: 'u-loop-night', q: 'view=lowerlevels&time=NIGHT', u: true },
  { name: 'loop-street-unchanged', q: 'view=lowerlevels&time=DAY' },
  // down into Lower Wacker between Michigan and Columbus from over the river: columns, lanes, lamps (day and night)
  { name: 'lower-wacker-day', q: 'pose=430,75,-770,400,-5,-640&time=DAY', u: true },
  { name: 'lower-wacker-night', q: 'pose=430,75,-770,400,-5,-640&time=NIGHT', u: true },
  // Lower Wacker along the river behind the Riverwalk, east of Columbus
  { name: 'lower-wacker-riverwalk-day', q: 'pose=520,160,-860,350,-5,-610&time=DAY', u: true },
  // Lower Michigan at the river: the DuSable bridge's lower deck carrying it across, the cut-away south of it
  { name: 'lower-michigan-river-day', q: 'pose=330,46,-800,276,-5,-600&time=DAY', u: true },
  { name: 'lower-michigan-river-dusk', q: 'pose=330,46,-800,276,-5,-600&time=DUSK', u: true },
  // West Lower Wacker along the South Branch
  { name: 'lower-wacker-west-day', q: 'pose=-640,60,-240,-750,-5,-60&time=DAY', u: true },
]
if (process.argv[1]?.endsWith('d2shots.mjs')) {
  const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
  for (const s of D2_SHOTS.filter((x) => !only.length || only.includes(x.name))) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
    page.on('pageerror', (e) => console.error('pageerror', e.message))
    await page.clock.setFixedTime(new Date('2026-09-28T12:00:00-05:00'))
    await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
    await page.goto(`${base}/?${s.q}&sports=idle&traffic=idle&stats`)
    await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 120_000 })
    await page.waitForFunction(() => window.__tilesIdle === true && window.__hudReady === true, null, { timeout: 90_000 }).catch(() => console.error('not idle'))
    if (s.u) {
      await page.waitForFunction(() => Boolean(window.__lowerLevels), null, { timeout: 30_000 }).catch(() => console.error('no lower levels'))
      await page.mouse.move(800, 500)
      await page.keyboard.press('u')
      await page.waitForTimeout(1500)
      await page.waitForFunction(() => window.__camRest === true && window.__tilesIdle === true, null, { timeout: 60_000 }).catch(() => console.error('not at rest'))
    }
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `${outDir}/${s.name}.png` })
    console.log(`${outDir}/${s.name}.png`, s.u ? JSON.stringify(await page.evaluate(() => window.__lowerLevels)) : '')
    await page.close()
  }
  await browser.close()
}
