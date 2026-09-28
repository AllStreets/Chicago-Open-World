// pipeline/fetch/fetch-all.js — download raw sources into pipeline/cache/.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { RING0_BBOX, USER_AGENT, footprintsUrl, cityBoundaryUrl, overpassQuery } from '../lib/sources.js'

const CACHE = join(dirname(fileURLToPath(import.meta.url)), '..', 'cache')
mkdirSync(CACHE, { recursive: true })
const save = (name, data) => {
  writeFileSync(join(CACHE, name), JSON.stringify({ fetchedAt: new Date().toISOString(), data }))
  console.log(`  ✓ ${name}`)
}

async function getJson(url, init = {}) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { ...init, headers: { 'User-Agent': USER_AGENT, ...(init.headers || {}) } })
    if (res.ok) return res.json()
    console.warn(`  ! ${res.status} on attempt ${attempt}`)
    await new Promise((r) => setTimeout(r, 4000 * attempt))
  }
  throw new Error(`failed: ${url.slice(0, 120)}`)
}

async function footprints() {
  const rows = []
  for (let offset = 0; ; offset += 1000) {
    const page = await getJson(footprintsUrl(RING0_BBOX, offset, 1000))
    rows.push(...page)
    if (page.length < 1000) break
  }
  save('footprints.json', rows)
}

async function overpass(kind) {
  const body = new URLSearchParams({ data: overpassQuery(kind, RING0_BBOX) })
  save(`osm-${kind}.json`, await getJson('https://overpass-api.de/api/interpreter', { method: 'POST', body }))
}

console.log('Fetching Ring 0 sources…')
await footprints()
save('city-boundary.json', await getJson(cityBoundaryUrl()))
for (const k of ['buildings', 'parts', 'water']) await overpass(k)
console.log('Done.')
