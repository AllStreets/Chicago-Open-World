// app/e2e/v5-capture.spec.js — evaluate-and-revert shots for V5. Runs only with V5_CAPTURE=1.
// V5_TAG=before|after picks the folder; V5_ONLY=name,name limits the shots.
import { test } from '@playwright/test'
import { readFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SHOTS = JSON.parse(readFileSync(join(HERE, 'v5-shots.json'), 'utf8'))
const TAG = process.env.V5_TAG ?? 'before'
const ONLY = process.env.V5_ONLY ? process.env.V5_ONLY.split(',') : null
const OUT = join(HERE, '..', '..', 'docs', 'superpowers', 'ledgers', 'v5-shots', TAG)

test.skip(!process.env.V5_CAPTURE, 'set V5_CAPTURE=1 to take V5 evaluation shots')

for (const s of SHOTS.filter((x) => !ONLY || ONLY.includes(x.name))) {
  for (const time of s.times) {
    test(`${s.name} @ ${time}`, async ({ page }) => {
      await page.clock.setFixedTime(new Date('2026-09-28T12:00:00-05:00'))
      await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
      const q = new URLSearchParams({ pose: s.pose.join(','), time, stats: '1', sports: s.sports ?? 'idle' })
      await page.goto(`/?${q}`)
      await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 90_000 })
      if (s.quality) await page.evaluate((qq) => window.__store.getState().setQuality(qq), s.quality)
      await page.waitForTimeout(5000) // textures, sky tween, field painting, loading fade
      mkdirSync(OUT, { recursive: true })
      await page.screenshot({ path: join(OUT, `${s.name}-${time}.png`) })
    })
  }
}
