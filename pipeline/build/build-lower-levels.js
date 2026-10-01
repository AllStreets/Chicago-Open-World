// pipeline/build/build-lower-levels.js — D2-1 on its own: writes public/world/lower-levels.json and the manifest's
// `levels.lower` entry from the OSM road cache, without a full world rebuild (build-world.js does the same step with
// the same inputs, so the two agree byte for byte). LEVELS_LOWER=0 removes both.
import { readFileSync, writeFileSync, rmSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sortCacheFiles } from '../lib/manifest.js'
import { buildLowerLevels, lowerLevelsOn, lowerManifestEntry, LOWER_LEVELS_FILE, MAX_BYTES } from '../lib/lowerLevels.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = join(ROOT, 'cache', 'world')
const OUT = join(ROOT, '..', 'app', 'public', 'world')
const loadJson = (p) => JSON.parse(readFileSync(p, 'utf8'))

const levelsData = loadJson(join(ROOT, 'data', 'levels.json'))
const manifestFile = join(OUT, 'manifest.json'), manifest = loadJson(manifestFile)
const { levels: prev = {}, ...rest } = manifest
const { lower: _old, ...others } = prev
let levels = others
rmSync(join(OUT, LOWER_LEVELS_FILE), { force: true })
if (lowerLevelsOn(levelsData, process.env)) {
  const roads = [...new Map(sortCacheFiles(readdirSync(CACHE), 'osm-roads-').flatMap((f) => loadJson(join(CACHE, f)).data.elements).map((e) => [`${e.type}${e.id}`, e])).values()]
  const riverFile = join(OUT, manifest.levels?.river?.file ?? 'river-levels.json')
  const water = manifest.levels?.river && existsSync(riverFile) ? loadJson(riverFile).water : []
  const tracks = loadJson(join(OUT, manifest.transit ?? 'transit.json')).routes.map((r) => r.path)
  const json = buildLowerLevels({ roads, levels: levelsData.levels, water, tracks, tubeClear: levelsData.tubeDips.tunnelClearM })
  const raw = JSON.stringify(json)
  if (raw.length > MAX_BYTES) throw new Error(`${LOWER_LEVELS_FILE}: ${raw.length} B over its ${MAX_BYTES} B budget`)
  writeFileSync(join(OUT, LOWER_LEVELS_FILE), raw)
  levels = { ...others, lower: lowerManifestEntry(json) }
  console.log(`${LOWER_LEVELS_FILE}: ${json.ways.length} pieces, ${(raw.length / 1e3).toFixed(1)} kB`)
} else console.log('lower levels off (LEVELS_LOWER=0)')
writeFileSync(manifestFile, JSON.stringify(Object.keys(levels).length ? { ...rest, levels } : rest))
