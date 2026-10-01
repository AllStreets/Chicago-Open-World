// app/e2e/parity.spec.js — X-0f visual-parity captures (plan §6.1 V1). Runs only with PARITY_TAG set:
//   PARITY_TAG=before PARITY_WORLD=/path/to/old/world npx playwright test parity --workers=1
//   PARITY_TAG=after  npx playwright test parity --workers=1          (PARITY_WORLD defaults to public/world)
// Every /world/* request is answered from PARITY_WORLD, so the same app code renders both worlds. Shots go to
// PARITY_OUT/<tag>/ (default: the system temp dir — raw captures are large; compare-shots writes the pairs to docs).
// PARITY_ONLY=name,name limits the shots; PARITY_DPR=1,2 picks the device pixel ratios.
import { test } from '@playwright/test'
import { mkdirSync, existsSync, statSync } from 'node:fs'
import { join, resolve, extname } from 'node:path'
import { tmpdir } from 'node:os'
import { PARITY_SHOTS } from './parity-shots.js'

const TAG = process.env.PARITY_TAG
const WORLD = resolve(process.env.PARITY_WORLD ?? join(process.cwd(), 'public', 'world'))
const OUT = resolve(process.env.PARITY_OUT ?? join(tmpdir(), 'chi-parity'), TAG ?? 'none')
const ONLY = process.env.PARITY_ONLY ? process.env.PARITY_ONLY.split(',') : null
const DPRS = (process.env.PARITY_DPR ?? '1,2').split(',').map(Number)
const TYPES = { '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.webp': 'image/webp', '.bin': 'application/octet-stream' }

test.skip(!TAG, 'set PARITY_TAG=before|after to take visual-parity captures')
test.describe.configure({ mode: 'serial' })

for (const s of PARITY_SHOTS.filter((x) => !ONLY || ONLY.includes(x.name))) {
  for (const dpr of DPRS.filter((d) => (s.dpr ?? [1, 2]).includes(d))) {
    test(`parity ${s.name} @${dpr}x`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: dpr })
      const page = await ctx.newPage()
      await page.route((url) => url.pathname.startsWith('/world/'), async (route) => { // not /src/world/* modules
        const rel = decodeURIComponent(new URL(route.request().url()).pathname.replace(/^\/world\//, ''))
        const file = join(WORLD, rel)
        if (!file.startsWith(WORLD) || !existsSync(file) || !statSync(file).isFile()) return route.fulfill({ status: 404, body: '' })
        return route.fulfill({ path: file, headers: { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' } })
      })
      await page.clock.setFixedTime(new Date('2026-09-28T12:00:00-05:00'))
      await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
      const q = new URLSearchParams({ time: s.time, sports: 'idle', traffic: 'idle', ...(s.view ? { view: s.view } : { pose: s.pose.join(',') }) })
      await page.goto(`/?${q}`)
      await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 90_000 })
      await page.waitForFunction(() => window.__camRest === true && window.__skyRest === true && window.__tilesIdle === true && window.__hudReady === true, null, { timeout: 90_000 })
      await page.waitForTimeout(1500) // the loading veil's last fade, textures settling
      mkdirSync(OUT, { recursive: true })
      await page.screenshot({ path: join(OUT, `${s.name}@${dpr}x.png`), mask: [page.locator('.wm-clock'), page.locator('.hud-controls')] })
      if (s.minimap) await page.locator('.mm-map').screenshot({ path: join(OUT, `${s.name}-minimap@${dpr}x.png`) })
      await ctx.close()
    })
  }
}
