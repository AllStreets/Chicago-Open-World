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
import { parapetPiece, PARAPET_FACADE } from '../lib/roofs.js'
import { roofProps } from '../lib/props.js'
import { minimapSvg } from '../lib/minimap.js'
import { RING0_BBOX } from '../lib/sources.js'
import sharp from 'sharp'
import { bufferPolyline } from '../lib/ribbon.js'
import { roadHalfWidth, isElevatedRail, scatterInPolygon } from '../lib/ground.js'

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
  const allProps = []
  for (const [key, list] of groupByTile(buildings)) {
    const pos = [], nor = [], uv = [], col = [], fac = [], hgt = [], idx = [], seed = []
    const meta = []
    list.forEach((b, i) => {
      const top = Math.max(b.height, ...(b.parts || []).map((p) => p.top))
      const family = classifyFacade({ height: top, year: b.year ?? 0, area: b.area })
      const s = hashSeed(b.id)
      const pieces = shapePieces(b)
      allProps.push(...roofProps(b, pieces))
      const parapets = pieces.map(parapetPiece).filter(Boolean).map((p) => ({ ...p, parapet: true }))
      for (const piece of [...pieces, ...parapets]) {
        const m = extrudeBuilding(piece)
        const n = m.positions.length / 3
        const f = piece.parapet ? PARAPET_FACADE : family
        for (const v of m.positions) pos.push(v)
        for (const v of m.normals) nor.push(v)
        for (const v of m.uvs) uv.push(v)
        for (let v = 0; v < n; v++) { col.push(...FACADE_COLORS[family]); fac.push(f); hgt.push(top); idx.push(i); seed.push(s) }
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
  writeFileSync(join(OUT, 'props.json'), JSON.stringify({ props: allProps }))
  console.log(`roof props: ${allProps.length}`)

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

  // Parks & beaches
  const greens = osmPolys(load('osm-parks.json').data.elements)
  const beaches = greens.filter((p) => p.tags.natural === 'beach')
  const parks = greens.filter((p) => p.tags.natural !== 'beach')
  await writeMeshGlb(join(OUT, 'ground', 'parks.glb'), flatMesh(parks, 0.08))
  await writeMeshGlb(join(OUT, 'ground', 'beaches.glb'), flatMesh(beaches, 0.07))

  // Roads + sidewalks (sidewalk = road + 3 m each side, drawn below)
  const merge = (ms) => {
    const out = { positions: [], normals: [], uvs: [] }
    for (const m of ms) for (const k of ['positions', 'normals', 'uvs']) for (const v of m[k]) out[k].push(v)
    return out
  }
  const roadWays = load('osm-roads.json').data.elements.filter((e) => e.geometry)
  const roadMeshes = [], walkMeshes = []
  for (const e of roadWays) {
    const hw = roadHalfWidth(e.tags || {})
    if (!hw) continue
    const pts = e.geometry.map((p) => project(p.lon, p.lat))
    roadMeshes.push(bufferPolyline(pts, hw, 0.12))
    if (!['motorway', 'motorway_link', 'service'].includes(e.tags.highway)) walkMeshes.push(bufferPolyline(pts, hw + 3, 0.1))
  }
  await writeMeshGlb(join(OUT, 'ground', 'roads.glb'), merge(roadMeshes))
  await writeMeshGlb(join(OUT, 'ground', 'sidewalks.glb'), merge(walkMeshes))

  // Rail: elevated L structure deck + columns; at-grade rail ballast
  const railWays = load('osm-rail.json').data.elements.filter((e) => e.geometry)
  const deck = [], grade = [], columns = []
  for (const e of railWays) {
    const pts = e.geometry.map((p) => project(p.lon, p.lat))
    const t = e.tags || {}
    if (isElevatedRail(t)) {
      deck.push(bufferPolyline(pts, 3.6, 7.6))
      let acc = 0
      for (let i = 1; i < pts.length; i++) {
        const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
        const rot = Math.atan2(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
        for (let d = (18 - acc) % 18; d < seg; d += 18) {
          const k = d / seg
          columns.push([+(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k).toFixed(1), +(pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k).toFixed(1), +rot.toFixed(3)])
        }
        acc = (acc + seg) % 18
      }
    } else if (!(t.tunnel && t.tunnel !== 'no') && parseInt(t.layer ?? '0', 10) >= 0) grade.push(bufferPolyline(pts, t.railway === 'rail' ? 2.4 : 1.8, 0.09))
  }
  await writeMeshGlb(join(OUT, 'ground', 'elevated.glb'), merge(deck))
  await writeMeshGlb(join(OUT, 'ground', 'rail.glb'), merge(grade))
  writeFileSync(join(OUT, 'columns.json'), JSON.stringify({ columns }))

  // Trees: mapped street trees + scatter inside parks (not pitches/playgrounds)
  const trees = load('osm-trees.json').data.elements.map((n) => project(n.lon, n.lat))
  for (const p of parks) if (['park', 'garden'].includes(p.tags.leisure)) trees.push(...scatterInPolygon(p.outer, 22, p.outer.length))
  writeFileSync(join(OUT, 'trees.json'), JSON.stringify({ trees: trees.map(([x, z]) => {
    const h = hashSeed(`${Math.round(x)}:${Math.round(z)}`)
    return [+x.toFixed(1), +z.toFixed(1), +(0.8 + h * 0.6).toFixed(2), Math.floor(h * 4)]
  }) }))
  console.log(`parks ${parks.length}, beaches ${beaches.length}, roads ${roadMeshes.length}, elevated segments ${deck.length}, columns ${columns.length}, trees ${trees.length}`)

  // Minimap raster (CHI palette), square bounds = Ring 0 ± 400 m
  const [x0, z0] = project(RING0_BBOX.w, RING0_BBOX.n), [x1, z1] = project(RING0_BBOX.e, RING0_BBOX.s)
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, half = Math.max(x1 - x0, z1 - z0) / 2 + 400
  const mmBounds = { minX: +(cx - half).toFixed(1), minZ: +(cz - half).toFixed(1), maxX: +(cx + half).toFixed(1), maxZ: +(cz + half).toFixed(1) }
  const svg = minimapSvg({
    land: land.map((p) => p.outer),
    water: water.map((p) => p.outer),
    parks: parks.map((p) => p.outer),
    roads: roadWays.filter((e) => roadHalfWidth(e.tags || {})).map((e) => e.geometry.map((p) => project(p.lon, p.lat))),
    buildings: buildings.flatMap((b) => b.polygons.map((p) => p.outer)),
  }, mmBounds, 1024)
  await sharp(Buffer.from(svg)).png().toFile(join(OUT, 'minimap.png'))
  console.log('minimap written')

  const src = (name, id, file) => ({ name, id, fetchedAt: load(file).fetchedAt })
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({
    version: 2, generatedAt: new Date().toISOString(), origin: ORIGIN, tileSize: TILE_SIZE,
    sources: [
      src('City of Chicago Building Footprints', 'syp8-uezg', 'footprints.json'),
      src('City of Chicago Boundary', 'qqq8-j68g', 'city-boundary.json'),
      src('OpenStreetMap (ODbL) heights, parts, water', 'overpass', 'osm-parts.json'),
    ],
    tiles,
    ground: { land: 'ground/land.glb', river: 'ground/river.glb', parks: 'ground/parks.glb', beaches: 'ground/beaches.glb', roads: 'ground/roads.glb', sidewalks: 'ground/sidewalks.glb', rail: 'ground/rail.glb', elevated: 'ground/elevated.glb' },
    trees: 'trees.json', columns: 'columns.json', props: 'props.json',
    minimap: { file: 'minimap.png', bounds: mmBounds },
  }, null, 2))
  console.log('manifest written')
}

await main()
