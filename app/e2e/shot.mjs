// app/e2e/shot.mjs — one-off captures for evaluate-and-revert and the README gallery (P5/P7).
// node e2e/shot.mjs "<query>" <out.png> [settleMs] [clockISO] [js-to-run-after-ready]
// BASE (default http://localhost:5177) picks the dev server. Never overwrites an existing file unless FORCE=1.
import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'

const [query, out, settle = '1500', clock = '', script = ''] = process.argv.slice(2)
if (!query || !out) { console.error('usage: node e2e/shot.mjs "<query>" out.png [settleMs] [clockISO] [js]'); process.exit(2) }
if (existsSync(out) && !process.env.FORCE) { console.error(`refusing to overwrite ${out}`); process.exit(3) }
const base = process.env.BASE ?? 'http://localhost:5177'
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
page.on('pageerror', (e) => console.error('pageerror', e.message))
if (clock) await page.clock.setFixedTime(new Date(clock))
await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
await page.goto(`${base}/?${query}`)
await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 120_000 })
await page.waitForFunction(() => window.__tilesIdle === true && window.__hudReady === true, null, { timeout: 90_000 }).catch(() => console.error('tiles/hud not idle'))
if (script) { const r = await page.evaluate(script); if (r !== undefined) console.log(JSON.stringify(r)) }
await page.waitForTimeout(Number(settle))
await page.screenshot({ path: out })
console.log(out)
await browser.close()
