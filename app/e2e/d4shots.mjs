// app/e2e/d4shots.mjs — D4 (the ramp portals, their signs and the U view's labels) captures for the README and review.
// node e2e/d4shots.mjs <outDir> [names…]   BASE (default http://localhost:5174) picks the dev server.
// `u: true` presses U the way a person does once the world is ready; traffic runs live (not idle) for the portals so
// cars are caught on the ramps; `wait` lets them drive a while first.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const [outDir = 'test-results/d4', ...only] = process.argv.slice(2)
mkdirSync(outDir, { recursive: true })
const base = process.env.BASE ?? 'http://localhost:5174'
export const D4_SHOTS = [
  // Columbus Drive at Randolph: the ramps down to Lower Columbus, with traffic driving into them
  { name: 'portal-columbus', q: 'eye=640,45,-185,600,-2,-250&time=DAY', wait: 8000 },
  // Lower Michigan's ramps at Lake Street
  { name: 'portal-michigan', q: 'eye=300,60,-380,276,-2,-455&time=DAY', wait: 8000 },
  // the Stetson ramp off Upper Wacker
  { name: 'portal-stetson', q: 'eye=480,50,-765,485,-2,-674&time=DAY', wait: 8000 },
  // the Lake Street ramp on the Wacker west leg
  { name: 'portal-lake', q: 'eye=-812,45,-455,-751,-2,-400&time=DAY', wait: 8000 },
  // the Franklin ramps off Congress
  { name: 'portal-franklin', q: 'eye=-500,45,830,-560,-2,775&time=DAY', wait: 8000 },
  { name: 'portal-columbus-close', q: 'eye=622,16,-222,600,-3,-250&time=DAY', wait: 6000 },
  { name: 'portal-columbus-night', q: 'eye=622,16,-222,600,-3,-250&time=NIGHT', wait: 8000 },
  // the U view with its labels: the lower streets and the Riverwalk's rooms
  { name: 'u-labels-day', q: 'view=lowerlevels&time=DAY', u: true },
  { name: 'u-labels-night', q: 'view=lowerlevels&time=NIGHT', u: true },
  // low over the river: the Riverwalk's rooms named
  { name: 'riverwalk-rooms', q: 'view=riverwalk&time=DAY' },
]
if (process.argv[1]?.endsWith('d4shots.mjs')) {
  const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
  for (const s of D4_SHOTS.filter((x) => !only.length || only.includes(x.name))) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
    page.on('pageerror', (e) => console.error('pageerror', e.message))
    await page.clock.setFixedTime(new Date('2026-09-28T12:00:00-05:00'))
    await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
    await page.goto(`${base}/?${s.q}&sports=idle&stats`)
    await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 120_000 })
    await page.waitForFunction(() => window.__tilesIdle === true && window.__hudReady === true, null, { timeout: 90_000 }).catch(() => console.error('not idle'))
    if (s.u || process.env.U) {
      await page.waitForFunction(() => Boolean(window.__lowerLevels), null, { timeout: 30_000 }).catch(() => console.error('no lower levels'))
      await page.mouse.move(800, 500)
      await page.keyboard.press('u')
      await page.waitForTimeout(1500)
      await page.waitForFunction(() => window.__camRest === true && window.__tilesIdle === true, null, { timeout: 60_000 }).catch(() => console.error('not at rest'))
    }
    await page.waitForTimeout(s.wait ?? 1500)
    await page.screenshot({ path: `${outDir}/${s.name}.png` })
    console.log(`${outDir}/${s.name}.png`, JSON.stringify(await page.evaluate(() => ({ lower: window.__lowerLevels, portals: window.__portals }))))
    await page.close()
  }
  await browser.close()
}
