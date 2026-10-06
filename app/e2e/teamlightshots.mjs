// app/e2e/teamlightshots.mjs — Team lights captures for the README: one browser, the skyline at night for each team.
// node e2e/teamlightshots.mjs <outDir> [team ...] [--pose=x,y,z,tx,ty,tz] [--tag=name]   (BASE picks the dev server)
import { chromium } from '@playwright/test'

const args = process.argv.slice(2), out = args.find((a) => !a.startsWith('--')) ?? '.'
const teams = args.filter((a) => !a.startsWith('--')).slice(1)
const pose = args.find((a) => a.startsWith('--pose='))?.slice(7) ?? '2600,300,-500,-200,180,-900'
const tag = args.find((a) => a.startsWith('--tag='))?.slice(6) ?? 'skyline'
const base = process.env.BASE ?? 'http://localhost:5174'
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
for (const team of teams.length ? teams : ['cubs', 'bears', 'whitesox', 'bulls']) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  page.on('pageerror', (e) => console.error('pageerror', e.message))
  await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
  await page.goto(`${base}/?pose=${pose}&time=night&sports=win:${team}&traffic=idle`)
  await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 120_000 })
  await page.waitForFunction(() => window.__tilesIdle === true && window.__hudReady === true, null, { timeout: 90_000 }).catch(() => console.error('tiles/hud not idle'))
  await page.waitForTimeout(3500)
  const file = `${out}/teamlights-${tag}-${team}.png`
  await page.screenshot({ path: file })
  console.log(file)
  await page.close()
}
await browser.close()
