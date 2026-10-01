// app/e2e/gallery.spec.js — fixed-pose captures for the README gallery and the evaluate-and-revert ledger.
// Runs only when GALLERY is set, e.g. GALLERY="river:bridges-before@day,river:bridges-before@night".
import { test } from '@playwright/test'
import { existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { galleryFile, parseGallery, refuseOverwrite, RIVER_GALLERY, riverShotQuery, RIVER_LEVEL_GALLERY, riverLevelShotQuery } from '../src/lib/galleryShots.js'

const items = process.env.GALLERY ? parseGallery(process.env.GALLERY) : []
const milestone = process.env.GALLERY_MILESTONE ?? 'v6'
const dir = process.env.GALLERY_DIR ? resolve(process.env.GALLERY_DIR) : resolve(process.cwd(), '..', 'docs', 'screenshots')
const clock = process.env.GALLERY_CLOCK ?? '2026-09-28T12:05:00-05:00' // Monday, in season, during the 12:00 fountain show

test.skip(items.length === 0, 'set GALLERY=view:subject@time,… to capture')
for (const it of items) {
  test(`gallery ${it.view} ${it.subject} @ ${it.time}`, async ({ page }) => {
    mkdirSync(dir, { recursive: true })
    const out = refuseOverwrite(galleryFile({ dir, milestone, subject: it.subject, time: it.time }), existsSync)
    await page.clock.setFixedTime(new Date(clock))
    await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
    await page.goto(RIVER_LEVEL_GALLERY[it.view] ? `/?${riverLevelShotQuery(RIVER_LEVEL_GALLERY[it.view], it.time)}` : RIVER_GALLERY[it.view] ? `/?${riverShotQuery(RIVER_GALLERY[it.view], it.time)}` : `/?view=${it.view}&time=${it.time}`)
    await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 90_000 })
    await page.waitForFunction(() => window.__camRest === true && window.__skyRest === true && window.__tilesIdle === true && window.__hudReady === true, null, { timeout: 60_000 })
    await page.waitForTimeout(1000) // the loading veil's last fade
    await page.screenshot({ path: out })
  })
}
