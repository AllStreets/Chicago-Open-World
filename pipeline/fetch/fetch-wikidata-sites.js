// pipeline/fetch/fetch-wikidata-sites.js — official websites (Wikidata P856) for places whose OSM tags have none but
// name a brand or own Wikidata item. Batched (50 ids a request), ≤ 1 request a second, cached in
// cache/wikidata-sites.json (re-runs fetch only new ids). The world build reads the cache and never the network.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { USER_AGENT } from '../lib/sources.js'
import { siteFromTags, wikidataId, sitesFromEntities } from '../lib/poiSites.js'

const CACHE = join(dirname(fileURLToPath(import.meta.url)), '..', 'cache')
const OUT = join(CACHE, 'wikidata-sites.json')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const els = readdirSync(join(CACHE, 'world')).filter((f) => f.startsWith('osm-pois-')).flatMap((f) => JSON.parse(readFileSync(join(CACHE, 'world', f), 'utf8')).data?.elements ?? [])
const want = [...new Set(els.filter((e) => e.tags?.name && !siteFromTags(e.tags)).map((e) => wikidataId(e.tags)).filter(Boolean))]
const cache = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {}
const todo = want.filter((q) => !(q in cache))
console.log(`wikidata: ${want.length} ids wanted, ${todo.length} not yet cached`)
for (let i = 0; i < todo.length; i += 50) {
  const ids = todo.slice(i, i + 50).join('|')
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids}&props=claims&format=json`
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
      if (r.ok) { Object.assign(cache, sitesFromEntities(await r.json())); break }
      console.warn(`  ! HTTP ${r.status}`)
    } catch (e) { console.warn(`  ! ${e.message}`) }
    await sleep(3000 * attempt)
  }
  writeFileSync(OUT, JSON.stringify(cache))
  await sleep(1000)
}
console.log(`wikidata: ${Object.values(cache).filter(Boolean).length} of ${Object.keys(cache).length} ids have an official website`)
