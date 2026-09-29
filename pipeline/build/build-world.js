// pipeline/build/build-world.js — cache → app/public/world (tiles, ground, manifest).
import { readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import earcut from 'earcut'
import { project, ORIGIN } from '../../shared/project.js'
import { openRing, ringCentroid, simplifyRing } from '../lib/geom.js'
import { assembleRings } from '../lib/multipolygon.js'
import { normalizeFootprint, attachOsmHeights, applyBuildingParts, hashSeed } from '../lib/buildings.js'
import { classifyFacade, FACADE_COLORS } from '../lib/classify.js'
import { extrudeBuilding } from '../lib/extrude.js'
import { groupByTile, TILE_SIZE } from '../lib/tiles.js'
import { writeMeshGlb } from '../lib/glb.js'
import { shapePieces } from '../lib/shapes.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = join(ROOT, 'cache')
const OUT = join(ROOT, '..', 'app', 'public', 'world')
const load = (n) => JSON.parse(readFileSync(join(CACHE, n), 'utf8'))

const toXZ = (pts) => openRing(pts.map((p) => project(p.lon, p.lat)))

function osmPolys(elements) {
  const out = []
  for (const el of elements) {
    if (el.type === 'way' && el.geometry) {
      out.push({ outer: toXZ(el.geometry), holes: [], tags: el.tags || {} })
    } else if (el.type === 'relation' && el.members) {
      const ways = (role) => el.members.filter((m) => m.role === role && m.geometry)
        .map((m) => m.geometry.map((p) => project(p.lon, p.lat)))
      const outers = assembleRings(ways('outer'))
      const inners = assembleRings(ways('inner'))
      for (const o of outers) out.push({ outer: o, holes: inners, tags: el.tags || {} })
    }
  }
  return out.filter((p) => p.outer.length >= 3)
}

function flatMesh(polys, y) {
  const positions = [], normals = [], uvs = []
  for (const { outer, holes } of polys) {
    const flat = [], hi = []
    for (const [x, z] of outer) flat.push(x, z)
    for (const h of holes) { hi.push(flat.length / 2); for (const [x, z] of h) flat.push(x, z) }
    const t = earcut(flat, hi.length ? hi : undefined, 2)
    for (let i = 0; i < t.length; i += 3) {
      let [a, b, c] = [t[i], t[i + 1], t[i + 2]]
      const cr = (flat[b * 2 + 1] - flat[a * 2 + 1]) * (flat[c * 2] - flat[a * 2]) - (flat[b * 2] - flat[a * 2]) * (flat[c * 2 + 1] - flat[a * 2 + 1])
      if (cr < 0) [b, c] = [c, b]
      for (const k of [a, b, c]) { positions.push(flat[k * 2], y, flat[k * 2 + 1]); normals.push(0, 1, 0); uvs.push(flat[k * 2], flat[k * 2 + 1]) }
    }
  }
  return { positions, normals, uvs }
}

async function main() {
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(join(OUT, 'tiles'), { recursive: true })

  const fp = load('footprints.json')
  const buildings = fp.data.map(normalizeFootprint).filter(Boolean)
  console.log(`buildings: ${buildings.length}`)

  const osmB = load('osm-buildings.json')
  attachOsmHeights(buildings, osmB.data.elements.filter((e) => e.geometry).map((e) => ({
    center: ringCentroid(toXZ(e.geometry)), tags: e.tags || {},
  })))
  const parts = osmPolys(load('osm-parts.json').data.elements).map((p) => ({ ...p, center: ringCentroid(p.outer) }))
  applyBuildingParts(buildings, parts)
  console.log(`osm parts: ${parts.length}, buildings with parts: ${buildings.filter((b) => b.parts).length}`)

  const tiles = []
  for (const [key, list] of groupByTile(buildings)) {
    const pos = [], nor = [], uv = [], col = [], fac = [], hgt = [], idx = [], seed = []
    const meta = []
    list.forEach((b, i) => {
      const top = Math.max(b.height, ...(b.parts || []).map((p) => p.top))
      const family = classifyFacade({ height: top, year: b.year ?? 0, area: b.area })
      const s = hashSeed(b.id)
      const pieces = shapePieces(b)
      for (const piece of pieces) {
        const m = extrudeBuilding(piece)
        const n = m.positions.length / 3
        pos.push(...m.positions); nor.push(...m.normals); uv.push(...m.uvs)
        for (let v = 0; v < n; v++) { col.push(...FACADE_COLORS[family]); fac.push(family); hgt.push(top); idx.push(i); seed.push(s) }
      }
      meta.push({ id: b.id, name: b.name, address: b.address, stories: b.stories, year: b.year, height: Math.round(top * 10) / 10 })
    })
    if (!pos.length) continue
    await writeMeshGlb(join(OUT, 'tiles', `${key}.glb`), {
      positions: pos, normals: nor, uvs: uv, colors: col,
      extra: { FACADE: new Float32Array(fac), HEIGHT: new Float32Array(hgt), BLDG: new Float32Array(idx), SEED: new Float32Array(seed) },
    })
    writeFileSync(join(OUT, 'tiles', `${key}.json`), JSON.stringify({ buildings: meta }))
    tiles.push({ key, ring: 0, file: `tiles/${key}.glb`, meta: `tiles/${key}.json`, buildings: list.length, maxHeight: Math.max(...meta.map((m) => m.height)) })
  }
  console.log(`tiles: ${tiles.length}`)

  // Ground: land = city boundary (simplified 2 m); river/harbour = OSM water.
  const city = load('city-boundary.json').data
  const land = city.features.flatMap((f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates))
    .map(([outer, ...holes]) => ({
      outer: simplifyRing(openRing(outer.map(([lon, lat]) => project(lon, lat))), 2),
      holes: holes.map((h) => simplifyRing(openRing(h.map(([lon, lat]) => project(lon, lat))), 2)),
    }))
  mkdirSync(join(OUT, 'ground'), { recursive: true })
  await writeMeshGlb(join(OUT, 'ground', 'land.glb'), flatMesh(land, 0))
  const water = osmPolys(load('osm-water.json').data.elements)
  await writeMeshGlb(join(OUT, 'ground', 'river.glb'), flatMesh(water, 0.15))
  console.log(`land polys: ${land.length}, water polys: ${water.length}`)

  const src = (name, id, file) => ({ name, id, fetchedAt: load(file).fetchedAt })
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({
    version: 1, generatedAt: new Date().toISOString(), origin: ORIGIN, tileSize: TILE_SIZE,
    sources: [
      src('City of Chicago Building Footprints', 'syp8-uezg', 'footprints.json'),
      src('City of Chicago Boundary', 'qqq8-j68g', 'city-boundary.json'),
      src('OpenStreetMap (ODbL) heights, parts, water', 'overpass', 'osm-parts.json'),
    ],
    tiles, ground: { land: 'ground/land.glb', river: 'ground/river.glb' },
  }, null, 2))
  console.log('manifest written')
}

await main()
