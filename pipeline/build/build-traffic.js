// pipeline/build/build-traffic.js — D3-1 on its own: writes public/world/traffic.bin (v2: the street level plus the
// lower levels lower-levels.json draws) from the OSM road cache, without a full world rebuild. build-world.js does the
// same step with the same inputs, so the two agree byte for byte. LEVELS_LOWER=0 writes the street level only.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { project } from '../../shared/project.js'
import { sortCacheFiles } from '../lib/manifest.js'
import { roadHalfWidth } from '../lib/ground.js'
import { lowerProfile, lowerLevelsOn } from '../lib/lowerLevels.js'
import { buildRoadGraph, encodeRoadGraph, trafficRoads } from '../lib/traffic.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = join(ROOT, 'cache', 'world')
const OUT = join(ROOT, '..', 'app', 'public', 'world')
const loadJson = (p) => JSON.parse(readFileSync(p, 'utf8'))

const levelsData = loadJson(join(ROOT, 'data', 'levels.json'))
const manifest = loadJson(join(OUT, 'manifest.json'))
const all = [...new Map(sortCacheFiles(readdirSync(CACHE), 'osm-roads-').flatMap((f) => loadJson(join(CACHE, f)).data.elements).map((e) => [`${e.type}${e.id}`, e])).values()]
const roads = all.filter((e) => e.geometry && roadHalfWidth(e.tags || {}))
let lower = null
if (lowerLevelsOn(levelsData, process.env)) {
  const riverFile = join(OUT, manifest.levels?.river?.file ?? 'river-levels.json')
  const water = manifest.levels?.river && existsSync(riverFile) ? loadJson(riverFile).water : []
  const tracks = loadJson(join(OUT, manifest.transit ?? 'transit.json')).routes.map((r) => r.path)
  lower = lowerProfile({ roads: all, levels: levelsData.levels, water, tracks, tubeClear: levelsData.tubeDips.tunnelClearM })
}
const graph = buildRoadGraph(trafficRoads(roads, all, lower), project, lower), enc = encodeRoadGraph(graph)
if (enc.some((v) => v < -32768 || v > 32767)) throw new Error('traffic graph: a value outside int16')
writeFileSync(join(OUT, manifest.traffic ?? 'traffic.bin'), Buffer.from(new Int16Array(enc).buffer))
const low = graph.edges.filter((e) => e.w != null)
console.log(`traffic.bin: ${graph.nodes.length} nodes, ${graph.edges.length} edges (${low.length} on the lower levels), ${((enc.length * 2) / 1e3).toFixed(0)} kB`)
