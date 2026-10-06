// app/e2e/helpshots.mjs — the help card (?) at the common viewports, for review and the README.
// node e2e/helpshots.mjs <outDir> [WxH ...]   (BASE picks the dev server)
import { chromium } from '@playwright/test'

const [out = '.', ...sizes] = process.argv.slice(2)
const base = process.env.BASE ?? 'http://localhost:5174'
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
for (const s of sizes.length ? sizes : ['1280x720', '1440x900', '1920x1080', '390x844']) {
  const [width, height] = s.split('x').map(Number)
  const page = await browser.newPage({ viewport: { width, height } })
  await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
  await page.goto(`${base}/?view=streeterville&time=dusk&sports=idle&traffic=idle`)
  await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 120_000 })
  await page.waitForTimeout(1500)
  await page.keyboard.press('Shift+Slash')
  await page.waitForSelector('[role=dialog][aria-label=Controls]')
  await page.waitForTimeout(400)
  const file = `${out}/help-${s}.png`
  await page.screenshot({ path: file })
  const m = await page.evaluate(() => { const d = document.querySelector('.help'); const r = d.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), scroll: d.scrollHeight - d.clientHeight } })
  console.log(file, JSON.stringify(m))
  await page.close()
}
await browser.close()
