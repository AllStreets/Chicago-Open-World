// app/e2e/gapshots.mjs — open-storey (blow-through / stilts) checks: each gap building from several sides, at HIGH and
// ULTRA, with its tile at LOD0 (look target on the building), LOD1 (look target ~1.7 km past it) and as a 2 km block
// (target ~4 km past it). node e2e/gapshots.mjs <outDir> [filter]   BASE (default http://localhost:5174).
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const [outDir = 'test-results/gaps', only = ''] = process.argv.slice(2)
mkdirSync(outDir, { recursive: true })
const base = process.env.BASE ?? 'http://localhost:5174'
// target: [x, z] of the building, y: the height to frame, sides: compass bearings the camera stands at (deg, 0 = north)
const SITES = JSON.parse(process.env.GAP_SITES ?? 'null') ?? [
  // the St. Regis blow-through (300–307.2 m) on the tallest stack: four sides close, and from W/SW close and far
  { key: 'stregis', at: [839, -582], y: 304, dist: 150, sides: [0, 90, 180, 270, 225] },
  { key: 'stregis', tag: 'far', at: [839, -582], y: 304, dist: 700, sides: [225, 270], lods: ['lod0', 'lod1', 'block'] },
  // every other open storey the build closes (pipeline/world-gaps.json)
  { key: 'marina', at: [-81, -672], y: 50, dist: 120, sides: [180, 0], quality: ['HIGH'] },
  { key: 'sel', at: [-1728, 1287], y: 10, camY: 3, dist: 70, sides: [180, 0], quality: ['HIGH'] },
  { key: 'opera', at: [-773, -60], y: 7, dist: 70, sides: [270], quality: ['HIGH'] },
  { key: 'wacker110', at: [-810, -176], y: 9, dist: 70, sides: [270], quality: ['HIGH'] },
  { key: 'postoffice', at: [-890, 715], y: 5, dist: 90, sides: [90, 270], quality: ['HIGH'] },
  { key: 'riverside150', at: [-881, -361], y: 40, camY: 12, dist: 140, sides: [300, 210], quality: ['HIGH'] },
  { key: 'wabash330', at: [20, -736], y: 5, dist: 70, sides: [180], quality: ['HIGH'] },
  { key: 'onechicago', at: [-56, -1583], y: 18, dist: 90, sides: [180], quality: ['HIGH'] },
  { key: 'lasalle300', at: [-438, -714], y: 120, dist: 160, sides: [270], quality: ['HIGH'] },
  { key: 'mccormick', at: [1293, 3214], y: 20, dist: 260, sides: [270], quality: ['HIGH'] },
]
const shots = []
for (const s of SITES) for (const side of s.sides) for (const q of s.quality ?? ['HIGH', 'ULTRA']) for (const lod of s.lods ?? ['lod0', 'lod1']) {
  const a = (side * Math.PI) / 180, ux = Math.sin(a), uz = -Math.cos(a) // from the building toward the camera
  const cam = [s.at[0] + ux * s.dist, s.camY ?? s.y + (s.dy ?? 4), s.at[1] + uz * s.dist]
  const past = lod === 'lod0' ? 0 : lod === 'lod1' ? 1750 : 4200
  const look = [s.at[0] - ux * past, s.y - (lod === 'lod0' ? 0 : (s.y * past) / (s.dist + past)), s.at[1] - uz * past]
  shots.push({ name: `${s.key}${s.tag ? `-${s.tag}` : ''}-${side}-${q.toLowerCase()}-${lod}`, pose: [...cam, ...look].map((v) => Math.round(v)).join(','), q })
}
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
for (const s of shots.filter((x) => !only || x.name.includes(only))) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  page.on('pageerror', (e) => console.error('pageerror', e.message))
  await page.clock.setFixedTime(new Date('2026-09-28T12:00:00-05:00'))
  await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
  await page.goto(`${base}/?pose=${s.pose}&time=DAY&sports=idle&traffic=idle&stats`)
  await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 120_000 })
  await page.evaluate((q) => window.__store.getState().setQuality(q), s.q)
  await page.waitForFunction(() => window.__tilesIdle === true && window.__hudReady === true, null, { timeout: 90_000 }).catch(() => console.error('not idle'))
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `${outDir}/${s.name}.png` })
  console.log(`${outDir}/${s.name}.png  pose=${s.pose}`)
  await page.close()
}
await browser.close()
