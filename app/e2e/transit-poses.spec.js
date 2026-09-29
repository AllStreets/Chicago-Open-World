// app/e2e/transit-poses.spec.js — evaluate-and-revert captures (not baselines).
// SHOTS_DIR=/abs/dir [POSES=wellslake,transit150] [EXTRA='&follow=red'] npx playwright test e2e/transit-poses.spec.js
import { test } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const DIR = process.env.SHOTS_DIR
const POSES = (process.env.POSES ?? 'wellslake,transit150,transit1000,northside').split(',')
const TIMES = (process.env.TIMES ?? 'day,dusk,night').split(',')

test.skip(!DIR, 'set SHOTS_DIR to capture evaluate-and-revert shots')
for (const view of POSES) for (const time of TIMES) {
  test(`${view} @ ${time}`, async ({ page }) => {
    mkdirSync(DIR, { recursive: true })
    await page.clock.setFixedTime(new Date('2026-09-30T08:15:00-05:00')) // a weekday rush: V4 trains run
    await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
    await page.goto(`/?view=${view}&time=${time}${process.env.EXTRA ?? ''}`)
    await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 90_000 })
    // V1 settle flags (G5); in follow mode the camera never rests, so FOLLOW=1 skips __camRest
    await page.waitForFunction((follow) => (follow || window.__camRest === true) && window.__skyRest === true && window.__tilesIdle === true && window.__hudReady === true, !!process.env.FOLLOW, { timeout: 90_000 })
    await page.waitForTimeout(1500) // transit pools filled from the last tiles
    await page.screenshot({ path: `${DIR}/${view}-${time}.png` })
  })
}
