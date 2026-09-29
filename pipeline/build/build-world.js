// pipeline/build/build-world.js — world build v3: 110 km², OSM-primary, validated skyline, streamed tiles.
import { readFileSync, writeFileSync, rmSync, mkdirSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import earcut from 'earcut'
import sharp from 'sharp'
import { project, ORIGIN } from '../../shared/project.js'
import { openRing, ringCentroid, ringBBox, simplifyRing, signedArea, pointInRing } from '../lib/geom.js'
import { assembleRings } from '../lib/multipolygon.js'
import { normalizeFootprint, applyBuildingParts, hashSeed, keepsShapeAtDistance, lod1Pieces } from '../lib/buildings.js'
import { osmToBuilding } from '../lib/osm.js'
import { enrichFromCity, buildGridIndex } from '../lib/enrich.js'
import { classifyFacade, FACADE_FAMILIES } from '../lib/classify.js'
import { extrudeBuilding } from '../lib/extrude.js'
import { tileKeyFor, tileBounds, TILE_SIZE } from '../lib/tiles.js'
import { writeMeshGlb } from '../lib/glb.js'
import { shapePieces } from '../lib/shapes.js'
import { applyHero, findByOsm, matchesOsm } from '../lib/heroes.js'
import { VENUE_FACADES, STYLE, convexHull } from '../lib/venue.js'
import { shapeSacred } from '../lib/sacred.js'
import { horizonBoxes } from '../lib/horizon.js'
import { MANIFEST_VERSION, manifestStamp, sortCacheFiles } from '../lib/manifest.js'
import { parapetPiece, PARAPET_FACADE } from '../lib/roofs.js'
import { roofProps } from '../lib/props.js'
import { minimapSvg } from '../lib/minimap.js'
import { bufferPolyline } from '../lib/ribbon.js'
import { roadHalfWidth, isElevatedRail, scatterInPolygon, GROUND_Y } from '../lib/ground.js'
import { WORLD_BBOX, RING0_BBOX } from '../lib/sources.js'
import { validateSkyline, assertSkyline } from '../lib/skyline.js'
import { clipPolysToTile, splitLineByTiles, writeTileGlb, mergeGroundLayers, blockKeyFor, BLOCK_TILES } from '../lib/tilepack.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = join(ROOT, 'cache', 'world')
const OUT = join(ROOT, '..', 'app', 'public', 'world')
const loadJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const chunks = (kind) => sortCacheFiles(readdirSync(CACHE), `osm-${kind}-`).flatMap((f) => loadJson(join(CACHE, f)).data.elements)
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
  const cityRows = sortCacheFiles(readdirSync(CACHE), 'footprints-').flatMap((f) => loadJson(join(CACHE, f)).data)
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
  // monuments that OSM maps as fountains/artworks rather than buildings get a stand-in footprint
  for (const h of heroes.filter((x) => x.match.synthetic)) {
    const c = project(h.match.lon, h.match.lat), r = h.match.radius ?? 20
    const outer = Array.from({ length: 24 }, (_, i) => [c[0] + r * Math.cos((i / 24) * Math.PI * 2), c[1] + r * Math.sin((i / 24) * Math.PI * 2)])
    const b = { id: `m-${h.key}`, osmId: null, source: 'monument', tags: {}, name: h.name, address: null, stories: null, year: null, polygons: [{ outer, holes: [] }], area: Math.PI * r * r, centroid: c, bbox: ringBBox(outer), height: 0, heightSource: 'default', parts: null }
    buildings.push(b); heroFor.set(b, h)
  }
  for (const h of heroes.filter((x) => !x.match.synthetic)) {
    let b = h.match.osmId ? findByOsm(buildings, h.match.osmId) : null
    if (!b && h.match.lat) { const p = project(h.match.lon, h.match.lat); b = bIdx.query(p, 200).find((x) => x.polygons.some((q) => pointInRing(p, q.outer))) }
    if (!b) throw new Error(`hero not found in OSM data: ${h.name} (${JSON.stringify(h.match)})`)
    heroFor.set(b, h)
  }
  // Venue heroes rebuild the whole site: drop superseded OSM shells and the synthesized non-landmark stadium shells
  const suppressed = heroes.flatMap((h) => h.suppress || [])
  const kept = buildings.filter((b) => !suppressed.some((r) => b.osmId != null && matchesOsm(b, r)) && (b.source !== 'osm-stadium' || heroFor.has(b)))
  log(`venue shells dropped: ${buildings.length - kept.length}`)
  buildings.length = 0
  for (const b of kept) buildings.push(b)
  // Video boards mapped as buildings read as screens, not windowed boxes
  for (const b of buildings) if (!heroFor.has(b) && /\b(screen|scoreboard)\b/i.test(b.name ?? '')) { b.facadeOverride = 'screen'; b.seedOverride = STYLE.screen.video }
  for (const b of buildings) {
    const h = heroFor.get(b)
    if (h) { const r = applyHero(b, h); b.pieces = r.pieces; b.extraMeshes = r.extraMeshes; b.venueMeshes = r.venueMeshes; b.clearPolys = r.clear; b.venueTop = (r.venueMeshes || []).reduce((t, v) => { for (let k = 1; k < v.mesh.positions.length; k += 3) t = Math.max(t, v.mesh.positions[k]); return t }, 0); b.hero = h.key; b.crownTop = Math.max(0, ...r.extraMeshes.flatMap((m) => m.positions.filter((_, i) => i % 3 === 1)), ...(h.spireCounts ? r.pieces.map((q) => q.top) : [])) }
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
  assertSkyline(sky)

  // ── Ground sources ─────────────────────────────────────────────────────────
  const greens = osmPolys(uniq(chunks('parks')))
  const parks = greens.filter((p) => p.tags.natural !== 'beach' && p.tags.leisure !== 'pitch'), beaches = greens.filter((p) => p.tags.natural === 'beach')
  const pitches = greens.filter((p) => p.tags.leisure === 'pitch')
  const water = osmPolys(uniq(chunks('water')))
  const roads = uniq(chunks('roads')).filter((e) => e.geometry && roadHalfWidth(e.tags || {}))
  const rail = uniq(chunks('rail')).filter((e) => e.geometry)
  const treeNodes = uniq(chunks('trees')).map((n) => project(n.lon, n.lat))
  // Synthetic trees only where OSM hasn't mapped the park's real trees (Millennium Park is mapped tree by tree)
  const realTreeIdx = buildGridIndex(treeNodes, 100, (p) => p)
  let scattered = 0
  for (const p of parks) {
    if (!['park', 'garden'].includes(p.tags.leisure)) continue
    const bb = p.bbox, real = realTreeIdx.rect({ minX: bb.minX, maxX: bb.maxX, minZ: bb.minZ, maxZ: bb.maxZ }).filter((t) => pointInRing(t, p.outer)).length
    if (real >= 0.5 * Math.abs(signedArea(p.outer)) / (22 * 22)) continue // already densely mapped
    const pts = scatterInPolygon(p.outer, 22, p.outer.length)
    scattered += pts.length
    treeNodes.push(...pts)
  }
  log(`synthetic park trees: ${scattered}`)
  // no park trees inside rebuilt venues (Soldier Field sits inside Burnham Park)
  const venueHulls = buildings.filter((b) => b.venueMeshes?.some((v) => v.fieldRing) || b.hero === 'buckingham').map((b) => convexHull(b.polygons.flatMap((p) => p.outer)))
  // …nor trees growing through rooftops: drop any tree inside a building footprint
  const footIdx = buildGridIndex(buildings.filter((b) => b.area > 30), 200, (b) => b.centroid)
  const inBuilding = (p) => footIdx.query(p, 400).some((b) => p[0] >= b.bbox.minX && p[0] <= b.bbox.maxX && p[1] >= b.bbox.minZ && p[1] <= b.bbox.maxZ && b.polygons.some((q) => pointInRing(p, q.outer)))
  const clearings = buildings.flatMap((b) => b.clearPolys ?? [])
  const keptTrees = treeNodes.filter((p) => !venueHulls.some((h) => pointInRing(p, h)) && !clearings.some((c) => pointInRing(p, c)) && !inBuilding(p))
  log(`trees removed from venues and rooftops: ${treeNodes.length - keptTrees.length}`)
  treeNodes.length = 0
  for (const p of keptTrees) treeNodes.push(p)
  log(`parks ${parks.length}, water ${water.length}, roads ${roads.length}, rail ${rail.length}, trees ${treeNodes.length}`)

  // ── Churches, cathedrals, mosques, synagogues, temples ─────────────────────
  const roadPts = []
  for (const e of roads) {
    const pts = e.geometry.map((p) => project(p.lon, p.lat))
    for (let i = 1; i < pts.length; i++) {
      const [a, c] = [pts[i - 1], pts[i]], n = Math.max(1, Math.ceil(Math.hypot(c[0] - a[0], c[1] - a[1]) / 15))
      for (let k = 0; k < n; k++) roadPts.push([a[0] + ((c[0] - a[0]) * k) / n, a[1] + ((c[1] - a[1]) * k) / n])
    }
  }
  const roadIdx = buildGridIndex(roadPts, 100, (p) => p)
  const nearestRoad = (c) => roadIdx.query(c, 120).reduce((best, p) => (!best || Math.hypot(p[0] - c[0], p[1] - c[1]) < Math.hypot(best[0] - c[0], best[1] - c[1]) ? p : best), null)
  const sacredOverrides = loadJson(join(ROOT, 'data', 'sacred.json')).overrides
  let sacredShaped = 0, sacredTinted = 0
  for (const b of buildings) {
    if (b.hero) continue
    const r = shapeSacred(b, { front: nearestRoad(b.centroid), override: sacredOverrides[b.id] ?? sacredOverrides[String(b.osmId)] })
    if (!r) continue
    b.facadeOverride = r.facade; b.seedOverride = r.seed; b.noParapet = true
    if (r.keepPieces) { sacredTinted++; continue }
    b.pieces = r.pieces; b.venueMeshes = r.meshes; b.sacred = true
    b.venueTop = r.meshes.reduce((t, v) => { for (let k = 1; k < v.mesh.positions.length; k += 3) t = Math.max(t, v.mesh.positions[k]); return t }, 0)
    sacredShaped++
  }
  log(`sacred buildings shaped: ${sacredShaped}, material only: ${sacredTinted}`)

  // ── Per-tile assembly ──────────────────────────────────────────────────────
  rmSync(join(OUT, 'tiles'), { recursive: true, force: true })
  mkdirSync(join(OUT, 'tiles'), { recursive: true })
  const T = new Map()
  const tile = (k) => { if (!T.has(k)) T.set(k, { b: [], roads: acc(), walks: acc(), roadsLod1: acc(), rail: acc(), elevated: acc(), trees: [], props: [], columns: [] }); return T.get(k) }
  for (const b of buildings) tile(tileKeyFor(b.centroid)).b.push(b)
  for (const e of roads) {
    const pts = e.geometry.map((p) => project(p.lon, p.lat)), hw = roadHalfWidth(e.tags)
    for (const [k, lines] of splitLineByTiles(pts)) for (const l of lines) {
      const t = tile(k); append(t.roads, bufferPolyline(l, hw, GROUND_Y.roads)); append(t.roadsLod1, bufferPolyline(l, hw, GROUND_Y.roads))
      if (!['motorway', 'motorway_link', 'service'].includes(e.tags.highway)) append(t.walks, bufferPolyline(l, hw + 3, GROUND_Y.sidewalks))
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
      } else append(tile(k).rail, bufferPolyline(l, t.railway === 'rail' ? 2.4 : 1.8, GROUND_Y.rail))
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
  const blocks = new Map()
  let n = 0
  for (const [key, t] of T) {
    const bounds = tileBounds(key)
    const L0 = bAcc(), L1 = bAcc(), meta = []
    t.b.forEach((b, i) => {
      const top = Math.max(0, ...b.pieces.map((p) => p.top), b.venueTop ?? 0)
      const family = b.facadeOverride ? (VENUE_FACADES[b.facadeOverride] ?? FACADE_FAMILIES.indexOf(b.facadeOverride)) : classifyFacade({ height: top, year: b.year ?? 0, area: b.area, type: b.tags?.building })
      const seed = b.seedOverride ?? hashSeed(b.id)
      const parapets = b.noParapet ? [] : b.pieces.map(parapetPiece).filter(Boolean)
      for (const pc of b.pieces) appendBuilding(L0, extrudeBuilding(pc), family, seed, i)
      for (const pc of parapets) appendBuilding(L0, extrudeBuilding(pc), PARAPET_FACADE, seed, i)
      for (const m of b.extraMeshes || []) appendBuilding(L0, m, family, seed, i)
      for (const v of b.venueMeshes || []) { appendBuilding(L0, v.mesh, v.facade, v.seed, i); appendBuilding(L1, v.mesh, v.facade, v.seed, i) }
      // LOD1: heroes and part-buildings keep their shape (they are the skyline); plain footprints simplify
      if (keepsShapeAtDistance(b)) { for (const pc of b.pieces) appendBuilding(L1, extrudeBuilding(pc), family, seed, i); for (const m of b.extraMeshes || []) appendBuilding(L1, m, family, seed, i) }
      else if (b.area >= 80) for (const pc of lod1Pieces(b)) appendBuilding(L1, extrudeBuilding(pc), family, seed, i)
      if (top > 15) for (const pr of roofProps(b, b.pieces)) t.props.push(pr)
      meta.push({ id: b.id, name: b.name, address: b.address, stories: b.stories, year: b.year, height: Math.round(top * 10) / 10, hero: b.hero ?? null })
    })
    const parksM = flatMesh(clipPolysToTile(polysFor('parks', bounds), bounds), GROUND_Y.parks)
    const beachesM = flatMesh(clipPolysToTile(polysFor('beaches', bounds), bounds), GROUND_Y.beaches)
    const pitchesM = flatMesh(clipPolysToTile(polysFor('pitches', bounds), bounds), GROUND_Y.pitches)
    const waterM = flatMesh(clipPolysToTile(polysFor('water', bounds), bounds), GROUND_Y.water)
    const hasContent = L0.positions.length || t.roads.positions.length || parksM.positions.length || waterM.positions.length
    if (!hasContent) continue
    const ground0 = mergeGroundLayers({ roads: t.roads, sidewalks: t.walks, parks: parksM, pitches: pitchesM, beaches: beachesM, rail: t.rail })
    const ground1 = mergeGroundLayers({ roads: t.roadsLod1, parks: parksM, pitches: pitchesM, beaches: beachesM })
    await writeTileGlb(join(OUT, 'tiles', `${key}.glb`), { buildings: asLayer(L0), ground: ground0, water: waterM, elevated: t.elevated })
    await writeTileGlb(join(OUT, 'tiles', `${key}.lod1.glb`), { buildings: asLayer(L1), ground: ground1, water: waterM })
    // accumulate the tile's far-detail content into its 2 km block
    const bk = blockKeyFor(key)
    if (!blocks.has(bk)) blocks.set(bk, { b: bAcc(), g: { ...acc(), extra: { LAYER: [] } }, w: acc() })
    const B = blocks.get(bk)
    for (const k of ['positions', 'normals', 'uvs']) { for (const v of L1[k]) B.b[k].push(v); for (const v of ground1[k]) B.g[k].push(v); for (const v of waterM[k]) B.w[k].push(v) }
    for (const v of L1.fac) B.b.fac.push(v); for (const v of L1.seed) B.b.seed.push(v); for (const v of L1.bldg) B.b.bldg.push(v)
    for (const v of ground1.extra.LAYER) B.g.extra.LAYER.push(v)
    writeFileSync(join(OUT, 'tiles', `${key}.json`), JSON.stringify({ buildings: meta, trees: t.trees, props: t.props, columns: t.columns }))
    tiles.push({ key, block: bk, bounds, lod0: `tiles/${key}.glb`, lod1: `tiles/${key}.lod1.glb`, meta: `tiles/${key}.json`, buildings: t.b.length, maxHeight: Math.max(0, ...meta.map((m) => m.height)) })
    if (++n % 50 === 0) log(`tiles written: ${n}`)
  }
  log(`tiles: ${tiles.length}`)
  rmSync(join(OUT, 'blocks'), { recursive: true, force: true })
  const blockList = []
  for (const [bk, B] of blocks) {
    const [bx, bz] = bk.split('_').map(Number), size = TILE_SIZE * BLOCK_TILES
    await writeTileGlb(join(OUT, 'blocks', `${bk}.glb`), { buildings: asLayer(B.b), ground: { ...B.g, extra: { LAYER: new Float32Array(B.g.extra.LAYER) } }, water: B.w })
    blockList.push({ key: bk, file: `blocks/${bk}.glb`, bounds: { minX: bx * size, maxX: (bx + 1) * size, minZ: bz * size, maxZ: (bz + 1) * size } })
  }
  log(`blocks: ${blockList.length}`)

  // ── Land, land mask, minimap ───────────────────────────────────────────────
  const cityB = loadJson(join(CACHE, 'city-boundary.json')).data
  const landPolys = cityB.features.flatMap((f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates))
    .map(([outer, ...holes]) => ({ outer: simplifyRing(openRing(outer.map(([lon, lat]) => project(lon, lat))), 2), holes: holes.map((h) => simplifyRing(openRing(h.map(([lon, lat]) => project(lon, lat))), 2)) }))
  // The suburbs are land too: without them the lake plane shows west of Harlem Ave like an ocean.
  const cityPts = landPolys.flatMap((p) => p.outer)
  const cMinX = Math.min(...cityPts.map((p) => p[0])), cMinZ = Math.min(...cityPts.map((p) => p[1])), cMaxZ = Math.max(...cityPts.map((p) => p[1]))
  const shoreX = (near) => Math.max(...cityPts.filter((p) => Math.abs(p[1] - near) < 800).map((p) => p[0]))
  const FAR = 60000, box = (a, b, c, d) => ({ outer: [[a, b], [c, b], [c, d], [a, d]], holes: [] })
  const region = [box(-FAR, -FAR, cMinX + 300, FAR), box(-FAR, -FAR, shoreX(cMinZ), cMinZ + 300), box(-FAR, cMaxZ - 300, shoreX(cMaxZ), FAR)]
  mkdirSync(join(OUT, 'ground'), { recursive: true })
  await writeMeshGlb(join(OUT, 'ground', 'land.glb'), flatMesh([...landPolys, ...region], 0))
  writeFileSync(join(OUT, 'land.json'), JSON.stringify({ rings: [...landPolys, ...region].map((p) => simplifyRing(p.outer, 20).map(([x, z]) => [Math.round(x), Math.round(z)])) }))
  const [x0, z0] = project(WORLD_BBOX.w, WORLD_BBOX.n), [x1, z1] = project(WORLD_BBOX.e, WORLD_BBOX.s)
  // ── Horizon: simple blocks on Chicago's grid beyond the detailed world, streamed like far blocks ──
  const isLand = (p) => landPolys.some((q) => pointInRing(p, q.outer) && !q.holes.some((h) => pointInRing(p, h)))
  const hBoxes = horizonBoxes({ inner: { minX: x0, maxX: x1, minZ: z0, maxZ: z1 }, band: 3000, isLand, seed: 7 })
  const hChunks = new Map()
  const HSIZE = TILE_SIZE * BLOCK_TILES
  hBoxes.forEach((hb, i) => {
    const k = `h-${Math.floor(hb.outer[0][0] / HSIZE)}_${Math.floor(hb.outer[0][1] / HSIZE)}`
    if (!hChunks.has(k)) hChunks.set(k, bAcc())
    appendBuilding(hChunks.get(k), extrudeBuilding({ outer: hb.outer, holes: [], base: 0, top: hb.top }), FACADE_FAMILIES.indexOf(hb.family), hb.seed, i)
  })
  for (const [k, acc0] of hChunks) {
    const [bx, bz] = k.slice(2).split('_').map(Number)
    await writeTileGlb(join(OUT, 'blocks', `${k}.glb`), { buildings: asLayer(acc0) })
    blockList.push({ key: k, file: `blocks/${k}.glb`, horizon: true, bounds: { minX: bx * HSIZE, maxX: (bx + 1) * HSIZE, minZ: bz * HSIZE, maxZ: (bz + 1) * HSIZE } })
  }
  log(`horizon: ${hBoxes.length} buildings in ${hChunks.size} chunks`)

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
    version: MANIFEST_VERSION, ...manifestStamp(), origin: ORIGIN, tileSize: TILE_SIZE, bbox: WORLD_BBOX,
    core: { minX: r0x, maxX: r1x, minZ: r0z, maxZ: r1z },
    sources: [
      { name: 'OpenStreetMap (ODbL) — buildings, parts, water, parks, roads, rail, trees', id: 'overpass' },
      { name: 'City of Chicago Building Footprints (enrichment)', id: 'syp8-uezg' },
      { name: 'City of Chicago Boundary', id: 'qqq8-j68g' },
      { name: 'Wikipedia — List of tallest buildings in Chicago', id: 'skyline.json' },
    ],
    skyline: { missing: sky.missing, wrongHeight: sky.wrongHeight },
    landmarks: buildings.filter((b) => b.hero).map((b) => ({ key: b.hero, name: heroes.find((h) => h.key === b.hero)?.name ?? b.name, aliases: heroes.find((h) => h.key === b.hero)?.aliases ?? [], x: Math.round(b.centroid[0]), z: Math.round(b.centroid[1]), top: Math.round(Math.max(b.venueTop ?? 0, ...b.pieces.map((p) => p.top), ...(b.extraMeshes || []).flatMap((m) => m.positions.filter((_, i) => i % 3 === 1)))) })),
    tallest: buildings.filter((b) => !b.hero && b.name && b.pieces.length && Math.max(...b.pieces.map((p) => p.top)) > 150).map((b) => ({ key: b.id, name: b.name, x: Math.round(b.centroid[0]), z: Math.round(b.centroid[1]), top: Math.round(Math.max(...b.pieces.map((p) => p.top))) })),
    tiles, blocks: blockList, land: 'ground/land.glb', landMask: 'land.json', minimap: { file: 'minimap.png', bounds: mmBounds, size: 2048 },
  }, null, 1))
  log('manifest written')
}

await main()
