// app/e2e/d1shots.mjs — D1 (the river at its real depth) captures for the README and the stage review.
// node e2e/d1shots.mjs <outDir> [names…]   BASE (default http://localhost:5177) picks the dev server.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const [outDir = 'test-results/d1', ...only] = process.argv.slice(2)
mkdirSync(outDir, { recursive: true })
const base = process.env.BASE ?? 'http://localhost:5177'
const SHOTS = [
  // the river from the Michigan Avenue (DuSable) bridge, looking west down the Main Branch
  { name: 'river-michigan-day', q: 'pose=300,34,-735,-260,-6,-600&time=DAY' },
  { name: 'river-michigan-dusk', q: 'pose=300,34,-735,-260,-6,-600&time=DUSK' },
  // the Riverwalk rooms from the walk ride, day and dusk
  { name: 'riverwalk-east-day', q: 'view=river&ride=walk:riverwalk&rideAt=700&time=DAY' },
  { name: 'riverwalk-marina-day', q: 'view=river&ride=walk:riverwalk&rideAt=1250&time=DAY' },
  { name: 'riverwalk-theater-day', q: 'view=river&ride=walk:riverwalk&rideAt=1550&time=DAY' },
  { name: 'riverwalk-jetty-day', q: 'view=river&ride=walk:riverwalk&rideAt=1800&time=DAY' },
  { name: 'riverwalk-theater-dusk', q: 'view=river&ride=walk:riverwalk&rideAt=1550&time=DUSK' },
  { name: 'riverwalk-marina-dusk', q: 'view=river&ride=walk:riverwalk&rideAt=1250&time=DUSK' },
  // README cohesion: the gallery frames that show the river, re-taken at their own poses
  { name: 'phase2-river-day', q: 'view=river&time=DAY' },
  { name: 'v8-riverwalk-night', q: 'pose=-30,32,-596,260,-4,-690&time=NIGHT' },
  { name: 'p7-riverwalk-dusk', q: 'view=river&ride=walk:riverwalk&rideAt=1690&time=DUSK' },
  // a bascule raised: the leaf's tail down in its pit (the B lift), seen from over the south bank
  { name: 'bridge-raised-pit', q: 'pose=-232,31,-596,-266,-9,-566&time=DAY', lift: true, wait: 20000 },
  // a Red Line ride through the State Street tube under the Main Branch (follow cam, side view)
  // following a Red Line train as it passes the State Street tube's low point under the Main Branch (rail ≈ −20 m)
  { name: 'subway-under-river', q: 'time=DAY', red: 'side' },
  { name: 'subway-under-river-chase', q: 'time=DAY', red: 'chase' },
]
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
for (const s of SHOTS.filter((x) => !only.length || only.includes(x.name))) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  page.on('pageerror', (e) => console.error('pageerror', e.message))
  if (s.red) await page.clock.install({ time: new Date('2026-09-30T08:15:00-05:00') }) // a weekday rush: trains every few minutes
  else if (!s.lift && !s.q.includes('ride=')) await page.clock.setFixedTime(new Date('2026-09-28T12:00:00-05:00')) // the lift runs on the real clock
  await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
  await page.goto(`${base}/?${s.q}&sports=idle&traffic=idle&stats`)
  await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 120_000 })
  await page.waitForFunction(() => window.__tilesIdle === true && window.__hudReady === true, null, { timeout: 90_000 }).catch(() => console.error('not idle'))
  if (s.lift) {
    await page.evaluate(() => window.__store.getState().startBridgeLift())
    await page.waitForTimeout(s.wait)
  }
  if (s.red) {
    // the next Red Line train to pass under the river (x ≈ 0, z ≈ −640): follow it, fast-forward to that moment
    const pick = await page.evaluate(() => {
      const sim = window.__getSim(), now = Date.now()
      let best = null
      for (const t of sim.trainsAt(now)) {
        if (t.line !== 'red') continue
        for (let k = 0; k <= 600; k += 2) { const f = sim.trainById(t.id, now + k * 1000); if (!f) break; if (Math.hypot(f.head.p[0] + 3, f.head.p[2] + 645) < 25 && (!best || k < best.k)) { best = { id: t.id, k }; break } }
      }
      if (best) { window.__store.getState().setTransitOn(true); window.__store.getState().startFollow(best.id, 'chase') }
      return best
    })
    if (pick) {
      await page.clock.fastForward(pick.k * 1000)
      await page.waitForTimeout(2500)
      await page.evaluate((v) => window.__store.getState().setFollowView(v), s.red)
      await page.clock.pauseAt(Date.now() + 1)
    } else console.error('no Red Line train passes under the river in 10 min')
  }
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `${outDir}/${s.name}.png` })
  console.log(`${outDir}/${s.name}.png`, JSON.stringify(await page.evaluate(() => ({ y: window.__camera?.position.y }))))
  await page.close()
}
await browser.close()
