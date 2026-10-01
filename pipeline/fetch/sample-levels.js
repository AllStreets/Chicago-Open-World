// pipeline/fetch/sample-levels.js — Workstream D0-2. Samples the USGS 3DEP 1 m bare-earth DEM (in Chicago this is
// the Cook County 2017 LiDAR, acquired 2017-06-03, via the USGS Elevation Point Query Service) at every point in
// data/levels.json.samples, stores the reading (ft NAVD88) and recomputes data/levels.json.sampleSummary.
// Usage: node fetch/sample-levels.js [--offline]   (--offline only recomputes the summary from stored readings)
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sampleChecks } from '../lib/levels.js'

const FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'levels.json')
const EPQS = (lon, lat) => `https://epqs.nationalmap.gov/v1/json?x=${lon}&y=${lat}&units=Feet&wkid=4326&includeDate=true`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function query(lon, lat) {
  for (let i = 0; i < 5; i++) {
    try {
      const j = await (await fetch(EPQS(lon, lat))).json()
      const v = Number(j.value)
      if (Number.isFinite(v) && v > -1000) return { ftNavd88: Math.round(v * 100) / 100, date: j.attributes?.AcquisitionDate ?? null, resolutionM: j.resolution ?? null }
    } catch { /* retry */ }
    await sleep(1000 * (i + 1))
  }
  throw new Error(`EPQS failed at ${lat},${lon}`)
}

const data = JSON.parse(readFileSync(FILE, 'utf8'))
if (!process.argv.includes('--offline')) {
  for (const s of data.samples) {
    Object.assign(s, await query(s.lon, s.lat))
    console.log(s.id.padEnd(28), s.kind.padEnd(15), s.ftNavd88, s.date)
    await sleep(80)
  }
}
const { summary, failures } = sampleChecks(data)
data.sampleSummary = Object.fromEntries(Object.entries(summary).map(([k, v]) => [k, Math.round(v * 100) / 100]))
writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n')
console.log(data.sampleSummary)
if (failures.length) { console.error('D0-2 tolerance failures:\n  ' + failures.join('\n  ')); process.exitCode = 1 }
