// pipeline/fetch/fetch-world.js — chunked download of the whole world bbox into pipeline/cache/world/.
// Re-runnable: finished chunk files are skipped.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WORLD_BBOX, USER_AGENT, chunkBBox, footprintsUrl, cityBoundaryUrl, overpassQuery, FETCH_KINDS } from '../lib/sources.js'

const CACHE = join(dirname(fileURLToPath(import.meta.url)), '..', 'cache', 'world')
mkdirSync(CACHE, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const save = (name, data) => writeFileSync(join(CACHE, name), JSON.stringify({ fetchedAt: new Date().toISOString(), data }))

async function getJson(url, init = {}) {
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      // Overpass: main endpoint first, mirror on later attempts
      const u = Array.isArray(url) ? url[attempt <= 3 ? 0 : 1] : url
      const res = await fetch(u, { ...init, headers: { 'User-Agent': USER_AGENT, ...(init.headers || {}) }, signal: AbortSignal.timeout(240_000) })
      if (res.ok) return await res.json()
      console.warn(`  ! HTTP ${res.status} (attempt ${attempt})`)
    } catch (e) { console.warn(`  ! ${e.message} (attempt ${attempt})`) }
    await sleep(8000 * attempt)
  }
  throw new Error(`failed: ${String(url).slice(0, 100)}`)
}

const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']

for (const [kind, [nx, ny]] of Object.entries(FETCH_KINDS)) {
  const chunks = chunkBBox(WORLD_BBOX, nx, ny)
  for (const [i, bb] of chunks.entries()) {
    const name = `osm-${kind}-${i}.json`
    if (existsSync(join(CACHE, name))) continue
    const body = new URLSearchParams({ data: overpassQuery(kind, bb) })
    const data = await getJson(ENDPOINTS, { method: 'POST', body })
    save(name, data)
    console.log(`  ✓ ${name} (${data.elements?.length ?? 0})`)
    await sleep(3000)
  }
}

for (let page = 0, offset = 0; ; page++, offset += 5000) {
  const name = `footprints-${page}.json`
  let rows
  if (existsSync(join(CACHE, name))) { rows = null } else {
    rows = await getJson(footprintsUrl(WORLD_BBOX, offset, 5000))
    save(name, rows)
    console.log(`  ✓ ${name} (${rows.length})`)
    if (rows.length < 5000) break
    continue
  }
  // cached page: stop when the cached page was short
  const { readFileSync } = await import('node:fs')
  if (JSON.parse(readFileSync(join(CACHE, name))).data.length < 5000) break
}
if (!existsSync(join(CACHE, 'city-boundary.json'))) save('city-boundary.json', await getJson(cityBoundaryUrl()))
// neighbourhood boundaries for the LIVE lens (P4): City of Chicago y6yq-dbs2, kept as plain GeoJSON
const HOODS = join(CACHE, '..', 'neighborhoods-y6yq.geojson')
if (!existsSync(HOODS)) writeFileSync(HOODS, JSON.stringify(await getJson('https://data.cityofchicago.org/resource/y6yq-dbs2.geojson?$limit=500')))
console.log('world fetch done')
