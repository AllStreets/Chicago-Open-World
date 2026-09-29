// pipeline/fetch/skyline.js — Wikipedia "List of tallest buildings in Chicago" → data/skyline.json (top 50).
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { USER_AGENT } from '../lib/sources.js'
import { parseTallestWikitext } from '../lib/skyline.js'

const url = 'https://en.wikipedia.org/w/api.php?action=parse&page=List_of_tallest_buildings_in_Chicago&prop=wikitext&format=json&formatversion=2'
const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
if (!res.ok) throw new Error(`wikipedia HTTP ${res.status}`)
const { parse } = await res.json()
const rows = parseTallestWikitext(parse.wikitext).sort((a, b) => a.rank - b.rank).slice(0, 50)
const out = { source: 'https://en.wikipedia.org/wiki/List_of_tallest_buildings_in_Chicago', fetchedAt: new Date().toISOString(), buildings: rows }
writeFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'skyline.json'), JSON.stringify(out, null, 2) + '\n')
console.log(`skyline: ${rows.length} buildings`)
