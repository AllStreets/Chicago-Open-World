// pipeline/build/check-boats.js — F-9: lay data/riverboats.json against the river as build-world.js does (without the
// full build) and print where each boat lands. node build/check-boats.js
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { project } from '../../shared/project.js'
import { openRing, pointInRing } from '../lib/geom.js'
import { assembleRings } from '../lib/multipolygon.js'
import { sortCacheFiles } from '../lib/manifest.js'
import { keepWater } from '../lib/water.js'
import { sunkWater, polyIndex } from '../lib/riverLevel.js'
import { riverBoats } from '../lib/boats.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = join(ROOT, 'cache', 'world')
const loadJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const els = sortCacheFiles(readdirSync(CACHE), 'osm-water-').flatMap((f) => loadJson(join(CACHE, f)).data.elements)
const uniq = [...new Map(els.map((e) => [`${e.type}${e.id}`, e])).values()]
const polys = []
for (const el of uniq) {
  if (el.type === 'way' && el.geometry) polys.push({ id: el.id, outer: openRing(el.geometry.map((p) => project(p.lon, p.lat))), holes: [], tags: el.tags || {} })
  else if (el.type === 'relation' && el.members) {
    const ways = (role) => el.members.filter((m) => m.role === role && m.geometry).map((m) => m.geometry.map((p) => project(p.lon, p.lat)))
    const inners = assembleRings(ways('inner'))
    for (const o of assembleRings(ways('outer'))) polys.push({ id: el.id, outer: o, holes: inners.filter((h) => pointInRing(h[0], o)), tags: el.tags || {} })
  }
}
const sunk = sunkWater(polys.filter((p) => p.outer.length >= 3 && keepWater(p.tags)))
const idx = polyIndex(sunk)
const isWater = (p) => Boolean(idx.find(p))
const spec = loadJson(join(ROOT, 'data', 'riverboats.json'))
const r = riverBoats(spec, { isWater, y: -6.3 })
console.log(r.report.join('\n'))
for (const b of r.boats) console.log(JSON.stringify(b))
