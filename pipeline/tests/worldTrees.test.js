// pipeline/tests/worldTrees.test.js — the built world has no tree whose canopy overlaps a building footprint (user fix,
// project-wide). Checks every tree in every shipped tile against the OSM footprints from the build cache; skipped when
// the cache or the built world is absent (a fresh clone).
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { osmToBuilding } from '../lib/osm.js'
import { buildGridIndex } from '../lib/enrich.js'
import { sortCacheFiles } from '../lib/manifest.js'
import { canopyOverFootprint, canopyRadius } from '../lib/trees.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = join(ROOT, 'cache', 'world'), TILES = join(ROOT, '..', 'app', 'public', 'world', 'tiles')
const ready = existsSync(CACHE) && existsSync(TILES)
const SKIP_TYPES = new Set(['roof', 'no', 'ruins', 'collapsed', 'bridge']) // as build-world.js

describe.skipIf(!ready)('trees in the built world', () => {
  it('no tree canopy overlaps any building footprint (every tile, every tree)', () => {
    const load = (p) => JSON.parse(readFileSync(p, 'utf8'))
    const els = sortCacheFiles(readdirSync(CACHE), 'osm-allbuildings-').flatMap((f) => load(join(CACHE, f)).data.elements)
    const seen = new Set(), buildings = []
    for (const e of els) {
      const k = `${e.type}${e.id}`
      if (seen.has(k) || SKIP_TYPES.has(e.tags?.building)) continue
      seen.add(k)
      const b = osmToBuilding(e)
      if (b && b.area > 30) buildings.push(b)
    }
    const idx = buildGridIndex(buildings, 200, (b) => b.centroid)
    let trees = 0
    const bad = []
    for (const f of readdirSync(TILES).filter((n) => n.endsWith('.json'))) {
      for (const [x, z] of load(join(TILES, f)).trees ?? []) {
        trees++
        const p = [x, z], r = canopyRadius(p)
        const hit = idx.query(p, 400).find((b) => canopyOverFootprint(p, b, r))
        if (hit) bad.push(`${x},${z} in ${f} over ${hit.id}`)
      }
    }
    expect(trees).toBeGreaterThan(10000)
    expect(bad.slice(0, 10)).toEqual([])
  }, 120000)
})
