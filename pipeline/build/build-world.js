// pipeline/build/build-world.js — world build v3: 110 km², OSM-primary, validated skyline, streamed tiles.
import { readFileSync, writeFileSync, rmSync, mkdirSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import earcut from 'earcut'
import sharp from 'sharp'
import { project, ORIGIN } from '../../shared/project.js'
import { openRing, ringCentroid, ringBBox, simplifyRing, signedArea, pointInRing } from '../lib/geom.js'
import { assembleRings } from '../lib/multipolygon.js'
import { normalizeFootprint, applyBuildingParts, hashSeed } from '../lib/buildings.js'
import { osmToBuilding } from '../lib/osm.js'
import { enrichFromCity, buildGridIndex } from '../lib/enrich.js'
import { classifyFacade, FACADE_FAMILIES } from '../lib/classify.js'
import { extrudeBuilding } from '../lib/extrude.js'
import { tileKeyFor, tileBounds, TILE_SIZE } from '../lib/tiles.js'
import { writeMeshGlb } from '../lib/glb.js'
import { shapePieces } from '../lib/shapes.js'
import { applyHero } from '../lib/heroes.js'
import { parapetPiece, PARAPET_FACADE } from '../lib/roofs.js'
import { roofProps } from '../lib/props.js'
import { minimapSvg } from '../lib/minimap.js'
import { bufferPolyline } from '../lib/ribbon.js'
import { roadHalfWidth, isElevatedRail, scatterInPolygon } from '../lib/ground.js'
import { WORLD_BBOX, RING0_BBOX } from '../lib/sources.js'
import { validateSkyline } from '../lib/skyline.js'
import { clipPolysToTile, splitLineByTiles, writeTileGlb } from '../lib/tilepack.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = join(ROOT, 'cache', 'world')
const OUT = join(ROOT, '..', 'app', 'public', 'world')
const loadJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const chunks = (kind) => readdirSync(CACHE).filter((f) => f.startsWith(`osm-${kind}-`)).flatMap((f) => loadJson(join(CACHE, f)).data.elements)
const uniq = (els) => [...new Map(els.map((e) => [`${e.type}${e.id}`, e])).values()]
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)
const SKIP_TYPES = new Set(['roof', 'no', 'ruins', 'collapsed', 'bridge'])
const TREE_CAP = 3000

function osmPolys(elements) {
  const out = []
  for (const el of elements) {
    if (el.type === 'way' && el.geometry) out.push({ outer: openRing(el.geometry.map((p) => project(p.lon, p.lat))), holes: [], tags: el.tags || {} })
    else if (el.type === 'relation' && el.members) {
      const ways = (role) => el.members.filter((m) => m.role === role && m.geometry).map((m) => m.geometry.map((p) => project(p.lon, p.lat)))
      const inners = assembleRings(ways('inner'))
      for (const o of assembleRings(ways('outer'))) out.push({ outer: o, holes: inners.filter((h) => pointInRing(h[0], o)), tags: el.tags || {} })
    }
  }
  return out.filter((p) => p.outer.length >= 3).map((p) => ({ ...p, bbox: ringBBox(p.outer) }))
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

const acc = () => ({ positions: [], normals: [], uvs: [] })
function append(dst, m) { for (const k of ['positions', 'normals', 'uvs']) for (const v of m[k]) dst[k].push(v) }
function appendBuilding(dst, m, facade, seed, idx) {
  append(dst, m)
  const n = m.positions.length / 3
  for (let v = 0; v < n; v++) { dst.fac.push(facade); dst.seed.push(seed); dst.bldg.push(idx) }
}
const bAcc = () => ({ ...acc(), fac: [], seed: [], bldg: [] })
const asLayer = (b) => ({ positions: b.positions, normals: b.normals, uvs: b.uvs, extra: { FACADE: new Float32Array(b.fac), SEED: new Float32Array(b.seed), BLDG: new Float32Array(b.bldg) } })

async function main() {
  // ── Buildings ──────────────────────────────────────────────────────────────
  const osmEls = uniq(chunks('allbuildings')).filter((e) => !SKIP_TYPES.has(e.tags?.building))
  const buildings = osmEls.map(osmToBuilding).filter(Boolean)
  // Stadiums tagged only as leisure=stadium (e.g. Wrigley Field) become buildings so heroes can shape them
  for (const s of osmPolys(uniq(chunks('stadiums')))) {
    const c = ringCentroid(s.outer)
    if (buildings.some((b) => b.area > 2000 && b.polygons.some((q) => pointInRing(c, q.outer)))) continue
    const area = Math.abs(signedArea(s.outer))
    buildings.push({ id: `s${s.tags.name ?? Math.round(c[0])}`, osmId: null, source: 'osm-stadium', tags: { building: 'stadium', ...s.tags }, name: s.tags.name ?? null, address: null, stories: null, year: null,
      polygons: [{ outer: s.outer, holes: s.holes }], area, centroid: c, bbox: s.bbox, height: 24, heightSource: 'default', parts: null })
  }
  log(`osm buildings: ${buildings.length}`)
  const cityRows = readdirSync(CACHE).filter((f) => f.startsWith('footprints-')).flatMap((f) => loadJson(join(CACHE, f)).data)
  const city = cityRows.map(normalizeFootprint).filter(Boolean).map((c) => ({ id: c.id, centroid: c.centroid, stories: c.stories, year: c.year, address: c.address }))
  enrichFromCity(buildings, city)
  log(`city rows: ${cityRows.length}, enriched: ${buildings.filter((b) => b.cityId).length}`)
  const parts = osmPolys(uniq(chunks('parts'))).map((p) => ({ ...p, center: ringCentroid(p.outer) }))
  const bIdx = buildGridIndex(buildings, 200, (b) => b.centroid)
  const partsByB = new Map()
  for (const p of parts) {
    const b = bIdx.query(p.center, 400).find((x) => x.polygons.some((q) => pointInRing(p.center, q.outer)))
    if (!b) continue
    if (!partsByB.has(b)) partsByB.set(b, [])
    partsByB.get(b).push(p)
  }
  for (const [b, ps] of partsByB) applyBuildingParts([b], ps)
  log(`parts: ${parts.length}, buildings with parts: ${partsByB.size}`)

  // ── Heroes + pieces ────────────────────────────────────────────────────────
  const heroes = existsSync(join(ROOT, 'data', 'heroes.json')) ? loadJson(join(ROOT, 'data', 'heroes.json')).heroes : []
  const heroFor = new Map()
  for (const h of heroes) {
    let b = h.match.osmId ? buildings.find((x) => x.osmId === h.match.osmId) : null
    if (!b && h.match.lat) { const p = project(h.match.lon, h.match.lat); b = bIdx.query(p, 200).find((x) => x.polygons.some((q) => pointInRing(p, q.outer))) }
    if (!b) throw new Error(`hero not found in OSM data: ${h.name} (${JSON.stringify(h.match)})`)
    heroFor.set(b, h)
  }
  for (const b of buildings) {
    const h = heroFor.get(b)
    if (h) { const r = applyHero(b, h); b.pieces = r.pieces; b.extraMeshes = r.extraMeshes; b.hero = h.key; b.crownTop = Math.max(0, ...r.extraMeshes.flatMap((m) => m.positions.filter((_, i) => i % 3 === 1)), ...(h.spireCounts ? r.pieces.map((q) => q.top) : [])) }
    else b.pieces = shapePieces(b)
  }
  log(`heroes applied: ${heroFor.size}`)

  // ── Skyline validation ─────────────────────────────────────────────────────
  const skyline = loadJson(join(ROOT, 'data', 'skyline.json')).buildings
  let sky = validateSkyline(buildings.filter((b) => b.pieces.length), skyline, WORLD_BBOX)
  // The skyline list is the authority for the tallest towers: correct non-landmark heights that OSM gets wrong.
  let fixed = 0
  for (const m of sky.matches) {
    const b = m.building
    if (b.hero || m.via !== 'contains' || Math.abs(m.got - m.expected) / m.expected <= 0.08) continue
    const minArea = 0.03 * b.area
    const body = b.pieces.filter((q) => Math.abs(signedArea(q.outer)) >= minArea)
    const bodyTop = Math.max(...body.map((q) => q.top))
    const isBody = (q) => Math.abs(signedArea(q.outer)) >= minArea
    b.pieces = bodyTop > m.expected
      ? b.pieces.map((q) => (isBody(q) && q.top > m.expected ? { ...q, top: m.expected, base: Math.min(q.base, m.expected - 1) } : q)) // cap every body piece
      : b.pieces.map((q) => (isBody(q) && q.top === bodyTop ? { ...q, top: m.expected } : q))
    b.skylineFixed = true; fixed++
  }
  if (fixed) sky = validateSkyline(buildings.filter((b) => b.pieces.length), skyline, WORLD_BBOX)
  log(`skyline heights corrected from the list: ${fixed}`)
  log(`skyline: missing ${sky.missing.length}, wrong height ${sky.wrongHeight.length}`)
  for (const m of sky.missing) console.log(`   missing: ${m}`)
  for (const w of sky.wrongHeight) console.log(`   height: ${w.name} expected ${w.expected} got ${w.got}`)
  const heroNames = new Set(heroes.map((h) => h.skylineName).filter(Boolean))
  const missingHeroes = sky.missing.filter((n) => heroNames.has(n))
  if (missingHeroes.length) throw new Error(`landmarks missing from the build: ${missingHeroes.join(', ')}`)

  // ── Ground sources ─────────────────────────────────────────────────────────
  const greens = osmPolys(uniq(chunks('parks')))
  const parks = greens.filter((p) => p.tags.natural !== 'beach' && p.tags.leisure !== 'pitch'), beaches = greens.filter((p) => p.tags.natural === 'beach')
  const pitches = greens.filter((p) => p.tags.leisure === 'pitch')
  const water = osmPolys(uniq(chunks('water')))
  const roads = uniq(chunks('roads')).filter((e) => e.geometry && roadHalfWidth(e.tags || {}))
  const rail = uniq(chunks('rail')).filter((e) => e.geometry)
  const treeNodes = uniq(chunks('trees')).map((n) => project(n.lon, n.lat))
  for (const p of parks) if (['park', 'garden'].includes(p.tags.leisure)) treeNodes.push(...scatterInPolygon(p.outer, 22, p.outer.length))
  log(`parks ${parks.length}, water ${water.length}, roads ${roads.length}, rail ${rail.length}, trees ${treeNodes.length}`)

  // ── Per-tile assembly ──────────────────────────────────────────────────────
  rmSync(join(OUT, 'tiles'), { recursive: true, force: true })
  mkdirSync(join(OUT, 'tiles'), { recursive: true })
  const T = new Map()
  const tile = (k) => { if (!T.has(k)) T.set(k, { b: [], roads: acc(), walks: acc(), roadsLod1: acc(), rail: acc(), elevated: acc(), trees: [], props: [], columns: [] }); return T.get(k) }
  for (const b of buildings) tile(tileKeyFor(b.centroid)).b.push(b)
  for (const e of roads) {
    const pts = e.geometry.map((p) => project(p.lon, p.lat)), hw = roadHalfWidth(e.tags)
    for (const [k, lines] of splitLineByTiles(pts)) for (const l of lines) {
      const t = tile(k); append(t.roads, bufferPolyline(l, hw, 0.12)); append(t.roadsLod1, bufferPolyline(l, hw, 0.12))
      if (!['motorway', 'motorway_link', 'service'].includes(e.tags.highway)) append(t.walks, bufferPolyline(l, hw + 3, 0.1))
    }
  }
  for (const e of rail) {
    const t = e.tags || {}, pts = e.geometry.map((p) => project(p.lon, p.lat))
    const elevated = isElevatedRail(t), grade = !(t.tunnel && t.tunnel !== 'no') && parseInt(t.layer ?? '0', 10) >= 0
    if (!elevated && !grade) continue
    for (const [k, lines] of splitLineByTiles(pts)) for (const l of lines) {
      if (elevated) {
        append(tile(k).elevated, bufferPolyline(l, 3.6, 7.6))
        for (let i = 1; i < l.length; i++) {
          const seg = Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]), rot = Math.atan2(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1])
          for (let d = 9; d < seg; d += 18) { const f = d / seg; tile(k).columns.push([+(l[i - 1][0] + (l[i][0] - l[i - 1][0]) * f).toFixed(1), +(l[i - 1][1] + (l[i][1] - l[i - 1][1]) * f).toFixed(1), +rot.toFixed(3)]) }
        }
      } else append(tile(k).rail, bufferPolyline(l, t.railway === 'rail' ? 2.4 : 1.8, 0.09))
    }
  }
  for (const [x, z] of treeNodes) {
    const t = tile(tileKeyFor([x, z]))
    if (t.trees.length >= TREE_CAP) continue
    const h = hashSeed(`${Math.round(x)}:${Math.round(z)}`)
    t.trees.push([+x.toFixed(1), +z.toFixed(1), +(0.8 + h * 0.6).toFixed(2), Math.floor(h * 4)])
  }
  const polyIdx = (polys) => buildGridIndex(polys.map((p) => ({ p, c: [(p.bbox.minX + p.bbox.maxX) / 2, (p.bbox.minZ + p.bbox.maxZ) / 2] })), TILE_SIZE, (i) => i.c)
  const polyIndexes = { parks: polyIdx(parks), pitches: polyIdx(pitches), beaches: polyIdx(beaches), water: polyIdx(water) }
  const polysFor = (name, bounds) => polyIndexes[name].rect({ minX: bounds.minX - 6000, maxX: bounds.maxX + 6000, minZ: bounds.minZ - 6000, maxZ: bounds.maxZ + 6000 })
    .map((i) => i.p).filter((p) => p.bbox.maxX > bounds.minX && p.bbox.minX < bounds.maxX && p.bbox.maxZ > bounds.minZ && p.bbox.minZ < bounds.maxZ)

  const tiles = []
  let n = 0
  for (const [key, t] of T) {
    const bounds = tileBounds(key)
    const L0 = bAcc(), L1 = bAcc(), meta = []
    t.b.forEach((b, i) => {
      const top = Math.max(0, ...b.pieces.map((p) => p.top))
      const family = b.facadeOverride ? FACADE_FAMILIES.indexOf(b.facadeOverride) : classifyFacade({ height: top, year: b.year ?? 0, area: b.area, type: b.tags?.building })
      const seed = b.seedOverride ?? hashSeed(b.id)
      const parapets = b.pieces.map(parapetPiece).filter(Boolean)
      for (const pc of b.pieces) appendBuilding(L0, extrudeBuilding(pc), family, seed, i)
      for (const pc of parapets) appendBuilding(L0, extrudeBuilding(pc), PARAPET_FACADE, seed, i)
      for (const m of b.extraMeshes || []) appendBuilding(L0, m, family, seed, i)
      // LOD1: heroes and part-buildings keep their shape (they are the skyline); plain footprints simplify
      if (b.hero || b.parts) { for (const pc of b.pieces) appendBuilding(L1, extrudeBuilding(pc), family, seed, i); for (const m of b.extraMeshes || []) appendBuilding(L1, m, family, seed, i) }
      else if (b.area >= 80) for (const p of b.polygons) {
        const outer = simplifyRing(p.outer, 2)
        if (outer.length >= 3) appendBuilding(L1, extrudeBuilding({ outer, holes: [], base: 0, top: b.height }), family, seed, i)
      }
      if (top > 15) for (const pr of roofProps(b, b.pieces)) t.props.push(pr)
      meta.push({ id: b.id, name: b.name, address: b.address, stories: b.stories, year: b.year, height: Math.round(top * 10) / 10, hero: b.hero ?? null })
    })
    const parksM = flatMesh(clipPolysToTile(polysFor('parks', bounds), bounds), 0.08)
    const beachesM = flatMesh(clipPolysToTile(polysFor('beaches', bounds), bounds), 0.07)
    const pitchesM = flatMesh(clipPolysToTile(polysFor('pitches', bounds), bounds), 0.09)
    const waterM = flatMesh(clipPolysToTile(polysFor('water', bounds), bounds), 0.15)
    const hasContent = L0.positions.length || t.roads.positions.length || parksM.positions.length || waterM.positions.length
    if (!hasContent) continue
    await writeTileGlb(join(OUT, 'tiles', `${key}.glb`), { buildings: asLayer(L0), roads: t.roads, sidewalks: t.walks, parks: parksM, pitches: pitchesM, beaches: beachesM, water: waterM, rail: t.rail, elevated: t.elevated })
    await writeTileGlb(join(OUT, 'tiles', `${key}.lod1.glb`), { buildings: asLayer(L1), roads: t.roadsLod1, parks: parksM, pitches: pitchesM, beaches: beachesM, water: waterM })
    writeFileSync(join(OUT, 'tiles', `${key}.json`), JSON.stringify({ buildings: meta, trees: t.trees, props: t.props, columns: t.columns }))
    tiles.push({ key, bounds, lod0: `tiles/${key}.glb`, lod1: `tiles/${key}.lod1.glb`, meta: `tiles/${key}.json`, buildings: t.b.length, maxHeight: Math.max(0, ...meta.map((m) => m.height)) })
    if (++n % 50 === 0) log(`tiles written: ${n}`)
  }
  log(`tiles: ${tiles.length}`)

  // ── Land, land mask, minimap ───────────────────────────────────────────────
  const cityB = loadJson(join(CACHE, 'city-boundary.json')).data
  const landPolys = cityB.features.flatMap((f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates))
    .map(([outer, ...holes]) => ({ outer: simplifyRing(openRing(outer.map(([lon, lat]) => project(lon, lat))), 2), holes: holes.map((h) => simplifyRing(openRing(h.map(([lon, lat]) => project(lon, lat))), 2)) }))
  mkdirSync(join(OUT, 'ground'), { recursive: true })
  await writeMeshGlb(join(OUT, 'ground', 'land.glb'), flatMesh(landPolys, 0))
  writeFileSync(join(OUT, 'land.json'), JSON.stringify({ rings: landPolys.map((p) => simplifyRing(p.outer, 20).map(([x, z]) => [Math.round(x), Math.round(z)])) }))
  const [x0, z0] = project(WORLD_BBOX.w, WORLD_BBOX.n), [x1, z1] = project(WORLD_BBOX.e, WORLD_BBOX.s)
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, half = Math.max(x1 - x0, z1 - z0) / 2 + 300
  const mmBounds = { minX: +(cx - half).toFixed(1), minZ: +(cz - half).toFixed(1), maxX: +(cx + half).toFixed(1), maxZ: +(cz + half).toFixed(1) }
  const svg = minimapSvg({
    land: landPolys.map((p) => p.outer), water: water.map((p) => p.outer), parks: parks.map((p) => p.outer),
    roads: roads.map((e) => e.geometry.map((p) => project(p.lon, p.lat))),
    buildings: buildings.filter((b) => b.area > 60).flatMap((b) => b.polygons.map((p) => p.outer)),
  }, mmBounds, 2048)
  await sharp(Buffer.from(svg), { limitInputPixels: false }).png().toFile(join(OUT, 'minimap.png'))
  log('minimap written')

  const [r0x, r0z] = project(RING0_BBOX.w, RING0_BBOX.n), [r1x, r1z] = project(RING0_BBOX.e, RING0_BBOX.s)
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({
    version: 3, generatedAt: new Date().toISOString(), origin: ORIGIN, tileSize: TILE_SIZE, bbox: WORLD_BBOX,
    core: { minX: r0x, maxX: r1x, minZ: r0z, maxZ: r1z },
    sources: [
      { name: 'OpenStreetMap (ODbL) — buildings, parts, water, parks, roads, rail, trees', id: 'overpass' },
      { name: 'City of Chicago Building Footprints (enrichment)', id: 'syp8-uezg' },
      { name: 'City of Chicago Boundary', id: 'qqq8-j68g' },
      { name: 'Wikipedia — List of tallest buildings in Chicago', id: 'skyline.json' },
    ],
    skyline: { missing: sky.missing, wrongHeight: sky.wrongHeight },
    landmarks: buildings.filter((b) => b.hero).map((b) => ({ key: b.hero, name: heroes.find((h) => h.key === b.hero)?.name ?? b.name, x: Math.round(b.centroid[0]), z: Math.round(b.centroid[1]), top: Math.round(Math.max(...b.pieces.map((p) => p.top), ...(b.extraMeshes || []).flatMap((m) => m.positions.filter((_, i) => i % 3 === 1)))) })),
    tallest: buildings.filter((b) => !b.hero && b.name && b.pieces.length && Math.max(...b.pieces.map((p) => p.top)) > 150).map((b) => ({ key: b.id, name: b.name, x: Math.round(b.centroid[0]), z: Math.round(b.centroid[1]), top: Math.round(Math.max(...b.pieces.map((p) => p.top))) })),
    tiles, land: 'ground/land.glb', landMask: 'land.json', minimap: { file: 'minimap.png', bounds: mmBounds, size: 2048 },
  }, null, 1))
  log('manifest written')
}

await main()
