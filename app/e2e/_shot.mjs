// app/e2e/_shot.mjs — a scratch screenshot helper for this worktree's dev server (port 5176). Not a spec.
// node e2e/_shot.mjs <out.png> "<query string>" [waitMs] [extra: keys to press, comma separated]
import { chromium } from '@playwright/test'
const [out, qs, wait = '2500', keys = ''] = process.argv.slice(2)
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
await page.goto(`http://localhost:5176/?${qs}`)
await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 120000 })
await page.waitForFunction(() => window.__camRest === true && window.__tilesIdle === true && window.__hudReady === true, null, { timeout: 60000 }).catch(() => {})
for (const k of keys.split(',').filter(Boolean)) { await page.keyboard.press(k); await page.waitForTimeout(300) }
await page.waitForTimeout(Number(wait))
await page.screenshot({ path: out })
await browser.close()
