// app/e2e/p3shots.mjs — Phase 3 evaluate-and-revert shots at fixed test-only poses (not a spec; run with node).
// node e2e/p3shots.mjs <outDir> [time] [name,…]   ·   GALLERY=1: 1600×1000, p3-<name>-<time>.png, never overwrites
import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'
const GALLERY = Boolean(process.env.GALLERY)
const POSES = {
  aqua: [[779, 130, -355], [659, 150, -475]],
  aquawide: [[905, 175, -300], [659, 140, -475]],
  marina: [[-50, 45, -560], [-108, 90, -658]],
  '900michigan': [[367, 262, -1773], [187, 245, -1953]],
  tribune: [[486, 150, -846], [376, 128, -946]],
  cbot: [[-334, 150, 353], [-334, 168, 513]],
  carbide: [[325, 150, -409], [235, 142, -499]],
  lincoln: [[-252, 9, -3243], [-271, 4, -3261]],
  grant: [[-300, 16, -3730], [-324, 9, -3754]],
  goethe: [[-700, 12, -5095], [-721, 7, -5113]],
  lighthouse: [[2900, 70, -680], [3049, 9, -823]],
  pingtom: [[-541, 25, 2742], [-581, 8, 2772]],
  gate: [[-347, 12, 3223], [-347, 7, 3268]],
  beachhouse: [[363, 30, -3444], [303, 5, -3494]],
  maggiedaley: [[845, 90, -72], [725, 0, -152]],
  boardwalk: [[-469, 15, -3931], [-499, 4, -3956]],
  northerly: [[1536, 50, 2027], [1626, 10, 2097]],
  pilsen: [[-2395, 6, 2708], [-2402, 4, 2697]],
  pilsen2: [[-2100, 7, 2700], [-2080, 4, 2709]],
  seahorses: [[745, 14, 662], [720, 4, 682]],
  colonnade: [[1080, 14, 2120], [960, 12, 2194]],
}
const [out, time = 'day', only] = process.argv.slice(2)
const names = only ? only.split(',') : Object.keys(POSES)
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: GALLERY ? { width: 1600, height: 1000 } : { width: 1280, height: 800 } })
await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
for (const n of names) {
  const [p, t] = POSES[n]
  await page.goto(`http://localhost:5173/?pose=${[...p, ...t].join(',')}&time=${time}&sports=idle`)
  await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 90000 })
  await page.waitForFunction(() => window.__camRest === true && window.__tilesIdle === true && window.__hudReady === true, null, { timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(1500)
  const file = GALLERY ? `${out}/p3-${n}-${time}.png` : `${out}/${n}-${time}.png`
  if (GALLERY && existsSync(file)) { console.log(`skip ${file} (exists — the gallery only appends)`); continue }
  await page.screenshot({ path: file })
  console.log(n)
}
await browser.close()
