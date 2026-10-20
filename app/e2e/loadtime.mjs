// app/e2e/loadtime.mjs — how long a first visit takes, on a throttled connection, against a built app.
// Usage: npx vite preview --port 4180 &  then  node e2e/loadtime.mjs http://localhost:4180 [runs]
// Reports, per run: JavaScript bytes on the wire before the city is ready, time until the first script has
// run (the loading screen is up), and time until the loading screen has gone (window.__hudReady). Uses a
// fresh browser profile each run, so nothing is cached, and throttles to roughly a 20 Mbps home connection.
import { chromium } from '@playwright/test'

const url = process.argv[2] ?? 'http://localhost:4180'
const runs = Number(process.argv[3] ?? 3)
const THROTTLE = process.env.NO_THROTTLE ? { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 } : { offline: false, latency: 40, downloadThroughput: (20 * 1024 * 1024) / 8, uploadThroughput: (5 * 1024 * 1024) / 8 }

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
const results = []
for (let i = 0; i < runs; i++) {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', THROTTLE)
  let jsBytes = 0, allBytes = 0
  const byType = {}
  cdp.on('Network.loadingFinished', (e) => { allBytes += e.encodedDataLength; const t = types.get(e.requestId) ?? 'other'; byType[t] = (byType[t] ?? 0) + e.encodedDataLength; if (jsIds.has(e.requestId)) jsBytes += e.encodedDataLength })
  const types = new Map()
  const jsIds = new Set()
  cdp.on('Network.responseReceived', (e) => { types.set(e.requestId, e.type); if (e.type === 'Script') jsIds.add(e.requestId) })
  await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
  const t0 = Date.now()
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.hud-loading', { timeout: 120_000 })
  const shell = Date.now() - t0
  await page.waitForFunction(() => window.__hudReady === true, null, { timeout: 180_000 })
  const ready = Date.now() - t0
  const jsAtReady = jsBytes
  const allAtReady = allBytes
  results.push({ shell, ready, js: jsAtReady, all: allAtReady })
  console.log(`run ${i + 1}: loading screen ${shell} ms · city ready ${ready} ms · JS on the wire ${(jsAtReady / 1024).toFixed(0)} KB · everything ${(allAtReady / 1048576).toFixed(1)} MB`)
  if (process.env.BYTYPE) console.log(Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, `${(v / 1048576).toFixed(1)} MB`])))
  await browser.close()
}
console.log(`median: loading screen ${median(results.map((r) => r.shell))} ms · city ready ${median(results.map((r) => r.ready))} ms · JS ${(median(results.map((r) => r.js)) / 1024).toFixed(0)} KB`)
