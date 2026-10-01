// pipeline/build/build-world.js — world build v3: 110 km², OSM-primary, validated skyline, streamed tiles.
import { readFileSync, writeFileSync, rmSync, mkdirSync, readdirSync, existsSync, statSync, copyFileSync } from 'node:fs'
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
import { tileKeyFor, tileBounds, TILE_SIZE, tileKeysForBBox } from '../lib/tiles.js'
import { writeMeshGlb } from '../lib/glb.js'
import { shapePieces } from '../lib/shapes.js'
import { applyHero, findByOsm, matchesOsm, expandHeroGroups } from '../lib/heroes.js'
import { VENUE_FACADES, STYLE, convexHull } from '../lib/venue.js'
import { venueRecord, encodeAnchors, plazaAnchors } from '../lib/sportsSites.js'
import { collectRuntime, validateLandmarkRegistry, landmarkEntry } from '../lib/landmarkRuntime.js'
import { detectBridges, buildBridge, makeRibbonCutter, bridgeSidecar } from '../lib/bridges.js'
import { shapeSacred } from '../lib/sacred.js'
import { horizonBoxes } from '../lib/horizon.js'
import { venueZones, filterTrees, assertNoVenueTrees, outsideZones, cutZones, cutWater } from '../lib/trees.js'
import { createBlock, addTileToBlock, blockLayers, blockSidecar } from '../lib/blocks.js'
import { bAcc, appendBuilding, appendLayer, asLayer } from '../lib/layers.js'
import { preloadStatue } from '../lib/statues.js'
import { mergeSites } from '../lib/poiSites.js'
import { poiRecord, dedupePois, anchorPoi, buildingPoi, capByTile, POI_CATEGORIES, POI_CAT_IDS } from '../lib/pois.js'
import { buildNeighborhoods } from '../lib/zones.js'
import { clearTracks } from '../lib/trackClearance.js'
import { buildRoadGraph, encodeRoadGraph } from '../lib/traffic.js'
import { isPavingArea, pavingKind, pathHalfWidth, synthPlazas, pathSurface, clipOutside } from '../lib/paving.js'
import { buildWalkGraph, encodeWalkGraph } from '../lib/walkGraph.js'
import { loadBlenderMesh } from '../lib/blenderMesh.js'
import { setSeahorseMesh } from '../lib/landmarks.js'
import { setSiteLookup } from '../lib/parkkit.js'
import { createStyleRegistry, assignHeroStyles, meshStyle, writeStylePalettePng, addMaterialStyles, styleIndex, partStyle } from '../lib/styles.js'
import { applyOsmLooks, applyTagOverrides } from '../lib/osmLook.js'
import { applyRooftops, rooftopLots } from '../lib/rooftops.js'
import { lakePolygons, landMinusWater, joinLines, lakeSide } from '../lib/lake.js'
import { lakefrontBeaches, isSandPitch } from '../lib/beaches.js'
import { bakeShore, SHORE } from '../lib/shore.js'
import { bakeHeightfield, meshPoints, boundsUnion, HEIGHTFIELD } from '../lib/heightfield.js'
import { encodeHeights } from '../lib/raster.js'
import { MANIFEST_VERSION, manifestStamp, sortCacheFiles } from '../lib/manifest.js'
import { parapetPiece, PARAPET_FACADE } from '../lib/roofs.js'
import { roofProps } from '../lib/props.js'
import { minimapSvg, encodeMinimap, MINIMAP_FILE } from '../lib/minimap.js'
import { bufferPolyline } from '../lib/ribbon.js'
import { roadHalfWidth, scatterInPolygon, GROUND_Y, flatMesh } from '../lib/ground.js'
import { buildTransit, loadTransitCache } from './build-transit.js'
import { writeTrainsGlb } from './build-trains.js'
import { loadCatalog } from '../lib/transit/lines.js'
import { assertTransit } from '../lib/transit/validate.js'
import { waterLayer, keepWater, breakwaterBuildings, CALM } from '../lib/water.js'
import { WORLD_BBOX, RING0_BBOX } from '../lib/sources.js'
import { validateSkyline, assertSkyline } from '../lib/skyline.js'
import { clipPolysToTile, splitLineByTiles, splitLineWithContext, writeTileGlb, quantizationError, mergeGroundLayers, blockKeyFor, BLOCK_TILES, concatLayers } from '../lib/tilepack.js'
import { encodeTileMeta } from '../../shared/tileMeta.js'
import { BUDGET, worldLedger, ledgerReport, checkBudget, sweepStale } from '../lib/budget.js'
import { riverLevels, sunkWater, wallRuns, wallMesh, runsByTile, cutMeshOutside, soffitOver, corridorMask, polyIndex, applySkirts, tubeDipTarget, wallTone } from '../lib/riverLevel.js'
import { buildRiverwalk, meshByTile } from '../lib/riverwalk.js'
import { pierRing } from '../lib/bridges.js'
import { setRiverwalkAtRiverLevel } from '../lib/civic.js'
import { buildLowerLevels, lowerLevelsOn, lowerManifestEntry, LOWER_LEVELS_FILE, MAX_BYTES as LOWER_MAX_BYTES } from '../lib/lowerLevels.js'

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
    if (el.type === 'way' && el.geometry) out.push({ id: el.id, outer: openRing(el.geometry.map((p) => project(p.lon, p.lat))), holes: [], tags: el.tags || {} })
    else if (el.type === 'relation' && el.members) {
      const ways = (role) => el.members.filter((m) => m.role === role && m.geometry).map((m) => m.geometry.map((p) => project(p.lon, p.lat)))
      const inners = assembleRings(ways('inner'))
      for (const o of assembleRings(ways('outer'))) out.push({ id: el.id, outer: o, holes: inners.filter((h) => pointInRing(h[0], o)), tags: el.tags || {} })
    }
  }
  return out.filter((p) => p.outer.length >= 3).map((p) => ({ ...p, bbox: ringBBox(p.outer) }))
}

// X-0f / V2: QUANT_REPORT=<file.json> measures every tile and block glb's quantisation error against its unquantised
// source (max position / normal / UV error per LOD and layer) and writes the report there.
const quantReport = process.env.QUANT_REPORT ? {} : null
async function writeWorldGlb(path, layers, opts) {
  await writeTileGlb(path, layers)
  if (!quantReport) return
  const per = (quantReport[opts.lod] ??= { files: 0, layers: {} })
  per.files++
  for (const [name, r] of Object.entries(await quantizationError(layers))) {
    const m = (per.layers[name] ??= { verts: 0, positionM: 0, normalDeg: 0, uvM: 0, customExact: true, fracErr: 0, bits: r.bits, floatMeshes: 0, worst: null })
    if (r.bits === 32) m.floatMeshes++; else m.bits = r.bits
    if (r.positionM > m.positionM) m.worst = path.split('/').slice(-2).join('/')
    m.verts += r.verts; m.customExact &&= r.customExact
    for (const k of ['positionM', 'normalDeg', 'uvM', 'fracErr']) m[k] = Math.max(m[k], r[k])
  }
}

const acc = () => ({ positions: [], normals: [], uvs: [] })
function append(dst, m) { for (const k of ['positions', 'normals', 'uvs']) for (const v of m[k]) dst[k].push(v) }

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
  // the Wrigley rooftop lots OSM leaves empty (3627 and 3633 N Sheffield) — dressed with the other clubs below
  buildings.push(...rooftopLots(loadJson(join(ROOT, "data", "rooftops.json")).clubs))
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

  const greens = osmPolys(uniq(chunks('parks')))
  // the Lincoln Park sculpts read their neighbours (a conservatory's glass houses, a formal garden's beds) — B-2
  const greenById = new Map(greens.map((g) => [g.id, g]))
  let waterById = null
  const waterOf = (id) => { waterById ??= Map.groupBy(osmPolys(uniq(chunks('water'))), (w) => w.id); return waterById.get(id) ?? [] }
  setSiteLookup({ building: (ref) => findByOsm(buildings, ref), green: (id) => greenById.get(id) ?? null, water: waterOf })
  // ── Levels (D1): the river at its real depth and the Riverwalk at river level; LEVELS_RIVER=0 builds the flat world ──
  const levelsData = loadJson(join(ROOT, 'data', 'levels.json'))
  const lv = riverLevels(levelsData, process.env)
  setRiverwalkAtRiverLevel(Boolean(lv))
  log(`levels: ${lv ? `the river at ${lv.river} m and the Riverwalk at ${lv.riverwalk} m under the street (D1)` : 'flat world (LEVELS_RIVER=0)'}`)
  // ── Heroes + pieces ────────────────────────────────────────────────────────
  const heroes = existsSync(join(ROOT, 'data', 'heroes.json')) ? expandHeroGroups(loadJson(join(ROOT, 'data', 'heroes.json')).heroes) : []
  validateLandmarkRegistry(heroes)
  const heroFor = new Map()
  const seahorse = await loadBlenderMesh(join(ROOT, 'heroes', 'out', 'seahorse.glb'), { at: [0, 0], maxTris: 6000 })
  setSeahorseMesh(seahorse); log(`seahorse unit: ${seahorse ? 'Blender export (used if it fits the slot)' : 'procedural'}`)
  for (const s of heroes.flatMap((h) => [h.statue, ...(h.landmark?.type === 'statues' ? h.landmark.items : [])]).filter(Boolean)) { s.preloaded = await preloadStatue(s); log(`statue ${s.kind}: ${s.preloaded ? 'Blender export' : 'procedural stand-in'}`) }
  // monuments that OSM maps as fountains/artworks rather than buildings get a stand-in footprint
  for (const h of heroes.filter((x) => x.match.synthetic)) {
    const c = project(h.match.lon, h.match.lat), r = h.match.radius ?? 20
    const outer = Array.from({ length: 24 }, (_, i) => [c[0] + r * Math.cos((i / 24) * Math.PI * 2), c[1] + r * Math.sin((i / 24) * Math.PI * 2)])
    const b = { id: `m-${h.key}`, osmId: null, source: 'monument', tags: {}, name: h.name, address: null, stories: null, year: null, polygons: [{ outer, holes: [] }], area: Math.PI * r * r, centroid: c, bbox: ringBBox(outer), height: 0, heightSource: 'default', parts: null }
    buildings.push(b); heroFor.set(b, h)
  }
  // landmarks OSM maps as parks (the Riverwalk) get their park polygon as a footprint
  for (const h of heroes.filter((x) => x.match.parkOsmId)) {
    const p = greens.find((g) => g.id === h.match.parkOsmId)
    if (!p) throw new Error(`hero park not found in OSM data: ${h.name} (${h.match.parkOsmId})`)
    const b = { id: `p-${h.key}`, osmId: null, source: 'park', tags: {}, name: h.name, address: null, stories: null, year: null, polygons: [{ outer: p.outer, holes: p.holes }], area: Math.abs(signedArea(p.outer)), centroid: ringCentroid(p.outer), bbox: p.bbox, height: 0, heightSource: 'default', parts: null }
    buildings.push(b); heroFor.set(b, h)
  }
  // landmarks that are a mapped pond (the Lily Pool) get the water's outline as their footprint; the water itself
  // still draws as water
  const ponds = heroes.some((x) => x.match.waterOsmId) ? osmPolys(uniq(chunks('water'))) : []
  for (const h of heroes.filter((x) => x.match.waterOsmId)) {
    const p = ponds.find((g) => g.id === h.match.waterOsmId)
    if (!p) throw new Error(`hero pond not found in OSM data: ${h.name} (${h.match.waterOsmId})`)
    const b = { id: `w-${h.key}`, osmId: null, source: 'pond', tags: {}, name: h.name, address: null, stories: null, year: null, polygons: [{ outer: p.outer, holes: p.holes }], area: Math.abs(signedArea(p.outer)), centroid: ringCentroid(p.outer), bbox: p.bbox, height: 0, heightSource: 'default', parts: null }
    buildings.push(b); heroFor.set(b, h)
  }
  for (const h of heroes.filter((x) => !x.match.synthetic && !x.match.parkOsmId && !x.match.waterOsmId)) {
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
    if (h) { const r = applyHero(b, h); b.pieces = r.pieces; b.extraMeshes = r.extraMeshes; b.venueMeshes = r.venueMeshes; b.clearPolys = r.clear; b.sculptReplaces = r.sculptReplaces; b.detached = r.detached; b.runtime = r.runtime; b.venueTop = (r.venueMeshes || []).reduce((t, v) => { for (let k = 1; k < v.mesh.positions.length; k += 3) t = Math.max(t, v.mesh.positions[k]); return t }, 0); b.venueTop = Math.max(b.venueTop, ...(r.detached ?? []).flatMap((d) => d.mesh.positions.filter((_, k) => k % 3 === 1))); b.hero = h.quiet ? null : h.key; b.heroSacred = Boolean(h.sacred); b.crownTop = Math.max(0, ...r.extraMeshes.map((m) => m.positions.reduce((t, y, i) => (i % 3 === 1 && y > t ? y : t), 0)), ...(h.spireCounts ? r.pieces.map((q) => q.top) : [])) }
    else b.pieces = shapePieces(b)
    if (h && (h.sculpt || h.bodyTopM)) { const tw = b.pieces.reduce((a, p) => (p.top > a.top ? p : a), { top: 0 }), bb = tw.outer ? ringBBox(tw.outer) : null; log(`hero ${h.key}: ${b.pieces.length} pieces, tower top ${tw.top.toFixed(1)} m, ${bb ? `${(bb.maxX - bb.minX).toFixed(1)} × ${(bb.maxZ - bb.minZ).toFixed(1)} m` : 'no ring'}, crown top ${b.crownTop.toFixed(1)} m, detail ${(b.extraMeshes.reduce((n, m) => n + m.positions.length / 9, 0) / 1000).toFixed(1)} k tris; pieces ${b.pieces.map((q) => { const bb = ringBBox(q.outer); return `${q.base ?? 0}–${q.top.toFixed(0)}:${(bb.maxX - bb.minX).toFixed(0)}×${(bb.maxZ - bb.minZ).toFixed(0)}` }).join(' ')}`) }
  }
  log(`heroes applied: ${heroFor.size}`)
  // ── Wrigley rooftop clubs (user item 13): bleachers on the Waveland and Sheffield roofs, facing home plate ──
  const roofData = loadJson(join(ROOT, 'data', 'rooftops.json'))
  const roofVenue = buildings.find((b) => b.hero === roofData.homePlateFrom)?.venueMeshes?.find((v) => v.venue)?.venue
  const rooftops = roofVenue?.frame ? applyRooftops(buildings, roofData.clubs, roofVenue.frame.origin) : { places: [], seats: [], matched: 0 }
  log(`rooftop clubs: ${rooftops.matched} grandstands, ${rooftops.places.length} places, ${rooftops.seats.length} seats`)
  const landmarkRuntime = collectRuntime(buildings.filter((b) => b.hero && (b.runtime || b.detached)).map((b) => ({ key: b.hero, runtime: b.runtime, detached: b.detached })))
  rmSync(join(OUT, 'landmarks'), { recursive: true, force: true })
  for (const b of buildings) for (const d of b.detached ?? []) await writeMeshGlb(join(OUT, 'landmarks', `${d.key}.glb`), d.mesh)
  writeFileSync(join(OUT, 'landmarks.json'), JSON.stringify(landmarkRuntime))
  log(`landmark runtime: ${Object.keys(landmarkRuntime).join(', ')}; plazas ${landmarkRuntime.plazas.length}`)

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
  const parks = greens.filter((p) => p.tags.natural !== 'beach' && p.tags.leisure !== 'pitch'), beaches = greens.filter((p) => p.tags.natural === 'beach' || (p.tags.leisure === 'pitch' && isSandPitch(p.tags)))
  const pitches = greens.filter((p) => p.tags.leisure === 'pitch' && !isSandPitch(p.tags))
  // the lake side of the shore (also cuts the land below), and Lincoln Park's unmapped beaches: sand from the
  // Lakefront Trail to the water (data/beaches.json)
  const coastEls = uniq(chunks('coast'))
  const lakeRel = coastEls.find((e) => e.type === 'relation')
  const outerIds = new Set((lakeRel?.members || []).filter((m) => m.role === 'outer').map((m) => m.ref))
  const shoreLines = coastEls.filter((e) => e.type === 'way' && e.geometry && (!lakeRel || outerIds.has(e.id))).map((e) => e.geometry.map((p) => project(p.lon, p.lat)))
  const lakeSideP = lakeSide(joinLines(shoreLines, 5), 60000)
  const trailLines = uniq(chunks('trails')).filter((e) => e.geometry && e.tags?.name === 'Lakefront Trail').map((e) => e.geometry.map((p) => project(p.lon, p.lat)))
  const sand = lakefrontBeaches(loadJson(join(ROOT, 'data', 'beaches.json')).beaches, { trail: trailLines, lake: lakeSideP })
  for (const b of sand) beaches.push(b)
  log(`beaches: ${beaches.length} (${sand.length} lakefront bands from data/beaches.json, ${beaches.filter((b) => b.tags.leisure === 'pitch').length} volleyball courts as sand)`)
  const water = osmPolys(uniq(chunks('water'))).filter((p) => keepWater(p.tags))
  // the river system (the river, its canal, slips, basins and the Harbor Lock) sinks to RIVER_Y; the rest stays
  const sunk = lv ? sunkWater(water) : []
  for (const p of sunk) p.tags = { ...p.tags, _sunk: true }
  if (lv) log(`river system at ${lv.river} m: ${sunk.length} water polygons (${sunk.map((p) => p.tags.name ?? p.tags.water).join(', ')})`)
  const roads = uniq(chunks('roads')).filter((e) => e.geometry && roadHalfWidth(e.tags || {}))
  const rail = uniq(chunks('rail')).filter((e) => e.geometry)
  // ── Bridges: OSM movable ways → named Chicago bascules; their ribbons give way to one leaf deck ──
  const bridgeData = loadJson(join(ROOT, 'data', 'bridges.json'))
  const skipWays = new Set(bridgeData.skipWays ?? [])
  const wayRecs = [...roads, ...rail].filter((e) => !skipWays.has(e.id)).map((e) => ({ id: e.id, tags: e.tags || {}, points: e.geometry.map((p) => project(p.lon, p.lat)) }))
  const bridges = detectBridges(wayRecs, bridgeData.bridges)
  const deckY = GROUND_Y.roads + 0.02
  const bridgeLevels = lv ? { river: lv.river, lower: lv.lower } : null
  const builtBridges = bridges.map((b) => buildBridge(b, { deckY, levels: bridgeLevels }))
  const bridgeSide = bridgeSidecar(bridges, builtBridges, bridgeData.liftOrder)
  const cutRibbon = makeRibbonCutter(bridges)
  const sIdx = (k) => (k ? styleIndex(k) : 0)
  log(`bridges: ${bridges.length} (${bridges.filter((b) => !b.generic).length} named), leaves ${bridgeSide.leaves.length}`)
  // ── The Riverwalk at river level (D1-2) and everything the street-level ground must give way to ──
  let rw = null
  if (lv) {
    const rwSpec = loadJson(join(ROOT, 'data', 'riverwalk.json'))
    const rwPark = greens.find((g) => g.id === rwSpec.parkOsmId)
    if (!rwPark) throw new Error(`Riverwalk polygon ${rwSpec.parkOsmId} not in the OSM parks`)
    rw = buildRiverwalk({ ring: rwPark.outer, water: sunk, bridges, greens, spec: rwSpec, deckY, levels: { river: lv.river, riverwalk: lv.riverwalk, lower: lv.lower } })
    log(`Riverwalk at ${lv.riverwalk} m: ${rw.zones.length} floor polygons (${rw.zones.reduce((t, z) => t + Math.abs(signedArea(z.outer)), 0).toFixed(0)} m²), ${rw.piers.length} piers passed, ${rw.rooms.map((r) => r.name).join(' · ')}`)
  }
  const floors = rw ? rw.zones : []
  const pitOpenings = builtBridges.flatMap((bb) => bb.piers.map((p) => ({ outer: pierRing(p, 'inner'), holes: [] })))
  const groundCuts = [...floors, ...pitOpenings].map((z) => ({ ...z, bbox: ringBBox(z.outer) }))
  const cutsBox = groundCuts.length ? groundCuts.reduce((a, z) => ({ minX: Math.min(a.minX, z.bbox.minX), minZ: Math.min(a.minZ, z.bbox.minZ), maxX: Math.max(a.maxX, z.bbox.maxX), maxZ: Math.max(a.maxZ, z.bbox.maxZ) }), { minX: Infinity, minZ: Infinity, maxX: -Infinity, maxZ: -Infinity }) : null
  const meshBox = (m) => { let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity; for (let i = 0; i < m.positions.length; i += 3) { const x = m.positions[i], z = m.positions[i + 2]; if (x < minX) minX = x; if (x > maxX) maxX = x; if (z < minZ) minZ = z; if (z > maxZ) maxZ = z } return { minX, minZ, maxX, maxZ } }
  const cutBoxes = groundCuts.map((z) => z.bbox)
  const touchesCuts = (m) => {
    if (!cutsBox || !m.positions.length) return false
    const b = meshBox(m)
    return b.maxX >= cutsBox.minX && b.minX <= cutsBox.maxX && b.maxZ >= cutsBox.minZ && b.minZ <= cutsBox.maxZ && cutBoxes.some((c) => b.maxX >= c.minX && b.minX <= c.maxX && b.maxZ >= c.minZ && b.minZ <= c.maxZ)
  }
  // street-level ground never covers a sunken floor or an open pit (a bridge's own ribbon keeps its deck, with a soffit under it)
  const cutGround = (m) => (touchesCuts(m) ? cutMeshOutside(m, groundCuts) : m)
  const isRaisedWay = (t) => (t.bridge && t.bridge !== 'no') || parseInt(t.layer ?? '0', 10) > 0
  const SOFFIT_Y = -0.9
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
  // Trees: never in a venue (Soldier Field sits inside Burnham Park), a landmark clearing, or through a roof —
  // courtyards are open ground. Filtered on the rounded coordinates the sidecars store.
  const zones = venueZones(buildings, (b) => heroFor.get(b))
  const pitchesKept = outsideZones(pitches, zones.map((z) => z.ring))
  log(`pitches inside venues dropped: ${pitches.length - pitchesKept.length}`)
  pitches.length = 0
  for (const p of pitchesKept) pitches.push(p)
  // parks never run under a venue: the ground's polygon offset would draw the grass over the field at oblique angles
  const parksCut = cutZones(parks, zones.map((z) => z.ring))
  log(`parks cut around venues: ${parks.length} → ${parksCut.length} polygons`)
  parks.length = 0
  for (const p of parksCut) parks.push(p)
  // the park grass never covers a pond, lagoon, harbour or beach (Lincoln Park's water and North Avenue Beach's sand
  // were all hidden under it)
  const parksDry = cutWater(parks, [...water, ...beaches])
  log(`parks cut around water: ${parks.length} → ${parksDry.length} polygons`)
  parks.length = 0
  for (const p of parksDry) parks.push(p)
  // no tree stands in a pond or on a beach
  const wetCells = new Map(), WC = 200, wck = (i, j) => `${i}:${j}`
  for (const w of [...water, ...beaches]) for (let i = Math.floor(w.bbox.minX / WC); i <= Math.floor(w.bbox.maxX / WC); i++) for (let j = Math.floor(w.bbox.minZ / WC); j <= Math.floor(w.bbox.maxZ / WC); j++) { if (!wetCells.has(wck(i, j))) wetCells.set(wck(i, j), []); wetCells.get(wck(i, j)).push(w) }
  const wetNear = (p) => wetCells.get(wck(Math.floor(p[0] / WC), Math.floor(p[1] / WC))) ?? []
  // a hero's built form can spill past its OSM outline (a podium drawn on the oriented box): its hull keeps trees off
  for (const b of buildings) {
    if (!b.hero || zones.some((z) => z.key === b.hero)) continue
    const xz = b.polygons.flatMap((p) => p.outer).concat((b.pieces ?? []).flatMap((p) => p.outer))
    for (const m of [...(b.venueMeshes ?? []).map((v) => v.mesh), ...(b.extraMeshes ?? [])]) for (let i = 0; i < m.positions.length; i += 9) xz.push([m.positions[i], m.positions[i + 2]])
    const hull = convexHull(xz)
    // a sprawling landmark (a riverwalk, a park's trellis) would sweep whole blocks: only a compact built form counts
    if (Math.abs(signedArea(hull)) <= 2.5 * b.area + 2000) b.treeHull = hull
  }
  const footIdx = buildGridIndex(buildings.filter((b) => b.area > 30 || b.treeHull), 200, (b) => b.centroid)
  const clearings = buildings.flatMap((b) => b.clearPolys ?? [])
  // railways at grade and elevated (not in tunnels), cut into ≤ 80 m pieces for the grid index
  const railSegs = []
  for (const e of rail) {
    if (e.tags?.tunnel === 'yes' || e.tags?.railway === 'subway') continue
    const pts = e.geometry.map((p) => project(p.lon, p.lat))
    for (let i = 0; i + 1 < pts.length; i++) {
      const [a, b] = [pts[i], pts[i + 1]], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 80))
      for (let k = 0; k < n; k++) { const p0 = [a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n], p1 = [a[0] + ((b[0] - a[0]) * (k + 1)) / n, a[1] + ((b[1] - a[1]) * (k + 1)) / n]; railSegs.push({ line: [p0, p1], c: [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2] }) }
    }
  }
  const railIdx = buildGridIndex(railSegs, 100, (s) => s.c)
  // paved squares and plazas (the same areas the paving layer draws): no trunk stands on the paving
  const pavedAreas = osmPolys(uniq([...chunks('paving'), ...chunks('trails')]).filter((e) => isPavingArea(e.tags || {}))).filter((p) => pavingKind(p.tags))
  const pavedIdx = buildGridIndex(pavedAreas, 200, (p) => [(p.bbox.minX + p.bbox.maxX) / 2, (p.bbox.minZ + p.bbox.maxZ) / 2])
  const pavedNear = (p) => pavedIdx.query(p, 600).filter((q) => p[0] >= q.bbox.minX && p[0] <= q.bbox.maxX && p[1] >= q.bbox.minZ && p[1] <= q.bbox.maxZ).map((q) => q.outer)
  const { kept: keptTrees, removed } = filterTrees(treeNodes, { zones: zones.map((z) => z.ring), clearings, nearBuildings: (p) => footIdx.query(p, 400), plazas: landmarkRuntime.plazas, rails: (p) => railIdx.query(p, 100).map((s) => s.line), paved: pavedNear, wet: wetNear })
  log(`trees removed (canopy test) — venues ${removed.venue}, clearings ${removed.clearing}, plazas ${removed.plaza}, railways ${removed.rail}, footprints ${removed.building}, paving ${removed.paved}, water ${removed.water}; kept ${keptTrees.length}; venue zones: ${zones.map((z) => z.key).join(', ')}`)
  treeNodes.length = 0
  for (const p of keptTrees) treeNodes.push(p)
  log(`parks ${parks.length}, water ${water.length}, roads ${roads.length}, rail ${rail.length}, trees ${treeNodes.length}`)
  // a point inside any building footprint (arena plaza fans stand on open ground only)
  const inBuilding = (p) => footIdx.query(p, 400).some((b) => b.polygons.some((poly) => pointInRing(p, poly.outer)))
  // ── Sports venues sidecar (V5): field frames, boards, seat and plaza anchors ─
  rmSync(join(OUT, 'venues'), { recursive: true, force: true })
  mkdirSync(join(OUT, 'venues'), { recursive: true })
  const venueList = []
  for (const b of buildings) {
    const h = b.hero && heroes.find((x) => x.key === b.hero)
    if (!h?.sports) continue
    const hull = convexHull(b.polygons.flatMap((p) => p.outer))
    const info = b.venueMeshes?.find((v) => v.venue)?.venue
    const rec = venueRecord(h, hull, info)
    if (info) {
      if (info.seats.length < 10000) throw new Error(`venue ${h.key}: only ${info.seats.length} seat anchors`)
      writeFileSync(join(OUT, rec.seats), encodeAnchors(info.seats, rec.center))
    }
    if (h.sports.kind === 'arena') {
      const plaza = plazaAnchors(hull, { seed: h.sports.slot + 11 }, (p) => !inBuilding(p))
      rec.plaza = `venues/${h.key}.plaza.bin`; rec.plazaCount = plaza.length
      writeFileSync(join(OUT, rec.plaza), encodeAnchors(plaza, rec.center))
    }
    if (h.key === roofData.homePlateFrom && rooftops.seats.length) {
      rec.rooftops = `venues/${h.key}.rooftops.bin`; rec.rooftopCount = rooftops.seats.length
      writeFileSync(join(OUT, rec.rooftops), encodeAnchors(rooftops.seats, rec.center))
    }
    venueList.push(rec)
  }
  if (venueList.length !== heroes.filter((x) => x.sports).length) throw new Error(`venue sidecar: ${venueList.length} venues for ${heroes.filter((x) => x.sports).length} sports heroes`)
  writeFileSync(join(OUT, 'venues.json'), JSON.stringify({ version: 1, venues: venueList }))
  const schedSrc = join(ROOT, 'data', 'schedules.json')
  if (existsSync(schedSrc)) copyFileSync(schedSrc, join(OUT, 'schedules.json'))
  log(`venues sidecar: ${venueList.map((v) => `${v.key} ${v.seatCount} seats${v.plaza ? ` ${v.plazaCount} plaza` : ''}`).join(', ')}`)


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
    if (b.hero && !b.heroSacred) continue // a church registered as a landmark (P2) keeps its sacred shaping (H5)
    const r = shapeSacred(b, { front: nearestRoad(b.centroid), override: sacredOverrides[b.id] ?? sacredOverrides[String(b.osmId)] })
    if (!r) continue
    b.facadeOverride = r.facade; b.seedOverride = r.seed; b.noParapet = true
    if (r.keepPieces) { sacredTinted++; continue }
    b.pieces = r.pieces; b.venueMeshes = r.meshes; b.sacred = true
    b.venueTop = r.meshes.reduce((t, v) => { for (let k = 1; k < v.mesh.positions.length; k += 3) t = Math.max(t, v.mesh.positions[k]); return t }, 0)
    sacredShaped++
  }
  log(`sacred buildings shaped: ${sacredShaped}, material only: ${sacredTinted}`)
  // ── Breakwaters: low concrete lines that shape the harbours (B7) ──────────
  const breakwaters = breakwaterBuildings(uniq(chunks('shore')).filter((e) => e.geometry).map((e) => ({ id: e.id, points: e.geometry.map((p) => project(p.lon, p.lat)), tags: e.tags || {} })))
  for (const b of breakwaters) buildings.push(b)
  log(`breakwaters: ${breakwaters.length}`)

  // ── Sourced looks (V2): hero rows first; OSM-tagged looks are added in Task 9 ──
  const styles = createStyleRegistry()
  assignHeroStyles(buildings, heroes, styles)
  addMaterialStyles(styles) // V6 materials: after the heroes, before the OSM looks — styleIndex() relies on this order
  log(`OSM tag overrides: ${applyTagOverrides(buildings, loadJson(join(ROOT, 'data', 'osm-tag-overrides.json')).buildings)} buildings`)
  const osmLooks = applyOsmLooks(buildings, styles, loadJson(join(ROOT, 'data', 'osm-looks.json')))
  log(`OSM-tagged looks: ${osmLooks.styled} buildings, ${osmLooks.skipped} over the palette cap`)
  // ── Transit (V3): CTA + Metra tracks, stations and glow ────────────────────
  // D1-5: the subway tubes dive under the sunken river in the same build (their ceilings would show in the channel)
  const dipTarget = lv ? tubeDipTarget({ water: sunk, riverY: lv.river, crossings: levelsData.tubeDips.crossings.map((c) => { const [x, z] = project(c.at.lon, c.at.lat); return { ...c, x, z } }) }) : null
  const transit = buildTransit({ ...loadTransitCache(CACHE), catalog: loadCatalog(), styles, dipTarget })
  assertTransit(transit.validation)
  log(`transit: lines ${transit.json.lines.length} · routes ${transit.json.routes.length} · stations ${transit.json.stations.length} · tiles ${transit.tiles.size}`)
  // no building stands in a track's right-of-way (user, 2026-09-30): footprints are cut back to the structure's
  // corridor edge, or removed when mostly inside it
  const cleared = clearTracks(buildings, transit.json.routes)
  if (cleared.removed.size) { const kept = buildings.filter((b) => !cleared.removed.has(b)); buildings.length = 0; for (const b of kept) buildings.push(b) }
  log(`track clearance: ${cleared.removed.size} buildings removed, ${cleared.clipped} cut back; e.g. ${[...cleared.removed].slice(0, 4).map((b) => `${b.id}@${b.centroid.map(Math.round).join(',')}`).join(' ')}`)

  log(`styles: ${styles.size - 1} rows`)
  // D1-3: river-front buildings run down to the water (or to the Riverwalk's floor beside them)
  const floorIdx = floors.length ? polyIndex(floors) : null
  if (lv) log(`river-front skirts: ${applySkirts(buildings, { waterIdx: polyIndex(sunk), zoneIdx: floorIdx, riverY: lv.river })} buildings reach the water`)

  // ── Per-tile assembly ──────────────────────────────────────────────────────
  rmSync(join(OUT, 'tiles'), { recursive: true, force: true })
  mkdirSync(join(OUT, 'tiles'), { recursive: true })
  const T = new Map()
  const tile = (k) => { if (!T.has(k)) T.set(k, { b: [], roads: acc(), walks: acc(), paving: acc(), roadsLod1: acc(), rail: acc(), soffit: acc(), trees: [], props: [], bridges: [] }); return T.get(k) }
  // D1: the river's walls and the Riverwalk's built parts, tile by tile
  const wallsByTile = lv ? runsByTile(wallRuns({ water: sunk, zones: floors, riverY: lv.river }).map((r) => ({ ...r, tone: wallTone(r) })), tileKeyFor) : new Map()
  const rwByTile = new Map()
  for (const m of rw?.meshes ?? []) for (const [k, part] of meshByTile(m.mesh, tileKeyFor)) { if (!rwByTile.has(k)) rwByTile.set(k, []); rwByTile.get(k).push({ ...m, mesh: part }) }
  for (const k of [...wallsByTile.keys(), ...rwByTile.keys()]) tile(k)
  if (lv) log(`river walls: ${[...wallsByTile.values()].reduce((t, rs) => t + rs.length, 0)} runs in ${wallsByTile.size} tiles; Riverwalk parts in ${rwByTile.size} tiles`)
  for (const b of buildings) tile(tileKeyFor(b.centroid)).b.push(b)
  bridges.forEach((br, i) => tile(tileKeyFor(br.centre)).bridges.push({ br, built: builtBridges[i], leafIds: bridgeSide.bridges[i].leaves }))
  // tiles that hold only water or park (the middle of Monroe Harbor) must exist too, or the lake shows a hole
  const [wx0, wz0] = project(WORLD_BBOX.w, WORLD_BBOX.n), [wx1, wz1] = project(WORLD_BBOX.e, WORLD_BBOX.s)
  for (const p of [...water, ...parks, ...beaches, ...pitches]) {
    const bb = { minX: Math.max(p.bbox.minX, wx0), maxX: Math.min(p.bbox.maxX, wx1), minZ: Math.max(p.bbox.minZ, wz0), maxZ: Math.min(p.bbox.maxZ, wz1) }
    if (bb.minX < bb.maxX && bb.minZ < bb.maxZ) for (const k of tileKeysForBBox(bb)) tile(k)
  }
  for (const e of roads) {
    const hw = roadHalfWidth(e.tags)
    // V6: a ribbon never runs over a bascule span — the leaf deck is the one deck there
    for (const pts of cutRibbon({ id: e.id, points: e.geometry.map((p) => project(p.lon, p.lat)) })) for (const [k, pieces] of splitLineWithContext(pts)) for (const { line: l, before, after } of pieces) {
      const t = tile(k), ends = { before, after }, raised = isRaisedWay(e.tags)
      const road = bufferPolyline(l, hw, GROUND_Y.roads, ends), walkR = ['motorway', 'motorway_link', 'service'].includes(e.tags.highway) ? null : bufferPolyline(l, hw + 3, GROUND_Y.sidewalks, ends)
      if (raised && floors.length && touchesCuts(walkR ?? road)) append(t.soffit, soffitOver(walkR ?? road, floors, SOFFIT_Y)) // a deck over the Riverwalk: its underside
      const roadC = raised ? road : cutGround(road)
      append(t.roads, roadC); append(t.roadsLod1, roadC)
      if (walkR) append(t.walks, raised ? walkR : cutGround(walkR))
    }
  }
  for (const e of rail) {
    if (transit.wayIds.has(e.id)) continue // CTA and Metra tracks are drawn by the transit layers
    const t = e.tags || {}
    if ((t.tunnel && t.tunnel !== 'no') || parseInt(t.layer ?? '0', 10) < 0) continue
    for (const pts of cutRibbon({ id: e.id, points: e.geometry.map((p) => project(p.lon, p.lat)) })) for (const [k, pieces] of splitLineWithContext(pts)) for (const { line: l, before, after } of pieces) {
      append(tile(k).rail, cutGround(bufferPolyline(l, t.railway === 'rail' ? 2.4 : 1.8, GROUND_Y.rail, { before, after })))
    }
  }
  // ── Plazas and park paths (user, 2026-09-30): Grant Park's brick, the promenades, every pedestrian plaza ──
  const pavingEls = uniq([...chunks('paving'), ...chunks('trails')])
  const plazas = [
    ...osmPolys(pavingEls.filter((e) => isPavingArea(e.tags || {}))).map((p) => ({ ...p, kind: pavingKind(p.tags) })).filter((p) => p.kind),
    ...synthPlazas(existsSync(join(ROOT, 'data', 'plazas.json')) ? loadJson(join(ROOT, 'data', 'plazas.json')).plazas : [], project), // OSM leaves these unmapped
  ]
  // every path in the material it's made of (walking paths pass, 2026-09-30): brick, blacktop trail, crushed gravel or
  // concrete — each on its ground layer, so the GROUND_Y order settles overlaps — and cut out of building footprints
  const BC = 100, bGrid = new Map(), bKey = (i, j) => `${i},${j}`
  for (const b of buildings) {
    if (!b.polygons?.length) continue
    const bb = ringBBox(b.polygons.flatMap((p) => p.outer))
    for (let i = Math.floor(bb.minX / BC); i <= Math.floor(bb.maxX / BC); i++) for (let j = Math.floor(bb.minZ / BC); j <= Math.floor(bb.maxZ / BC); j++) {
      const k = bKey(i, j); if (!bGrid.has(k)) bGrid.set(k, []); bGrid.get(k).push({ b, bb })
    }
  }
  const insideBuilding = ([x, z]) => (bGrid.get(bKey(Math.floor(x / BC), Math.floor(z / BC))) ?? []).some(({ b, bb }) =>
    x > bb.minX && x < bb.maxX && z > bb.minZ && z < bb.maxZ && b.polygons.some((p) => pointInRing([x, z], p.outer) && !(p.holes ?? []).some((h) => pointInRing([x, z], h))))
  const PATH_LAYER = { brick: ['paving', GROUND_Y.paving], asphalt: ['roads', GROUND_Y.roads], gravel: ['rail', GROUND_Y.rail], concrete: ['walks', GROUND_Y.sidewalks] }
  const pathCount = { brick: 0, asphalt: 0, gravel: 0, concrete: 0 }
  let pathsLaid = 0, pathsCut = 0
  for (const e of pavingEls) {
    const tg = e.tags || {}, surf = pathSurface(tg)
    if (e.type !== 'way' || !e.geometry || !surf) continue
    const hw = pathHalfWidth(tg), [layer, y] = PATH_LAYER[surf], runs = clipOutside(e.geometry.map((p) => project(p.lon, p.lat)), insideBuilding)
    if (runs.length !== 1) pathsCut++
    for (const run of runs) for (const [k, pieces] of splitLineWithContext(run)) for (const { line: l, before, after } of pieces) append(tile(k)[layer], cutGround(bufferPolyline(l, hw, y, { before, after })))
    pathsLaid++; pathCount[surf]++
  }
  log(`walking paths: ${pathsLaid} laid (${Object.entries(pathCount).map(([k, n]) => `${n} ${k}`).join(', ')}), ${pathsCut} cut at building footprints`)
  const walk = encodeWalkGraph(buildWalkGraph(pavingEls, project))
  writeFileSync(join(OUT, 'walk-graph.json'), JSON.stringify(walk))
  log(`walk graph: ${walk.nodes.length / 2} nodes, ${(statSync(join(OUT, 'walk-graph.json')).size / 1e3).toFixed(0)} kB`)
  log(`paving: ${plazas.length} plazas (${plazas.filter((p) => p.kind === 'brick').length} brick)`)
  for (const k of transit.tiles.keys()) tile(k) // a tile that holds only track still gets written
  for (const [x, z] of treeNodes) {
    const t = tile(tileKeyFor([x, z]))
    if (t.trees.length >= TREE_CAP) continue
    const h = hashSeed(`${Math.round(x)}:${Math.round(z)}`)
    t.trees.push([+x.toFixed(1), +z.toFixed(1), +(0.8 + h * 0.6).toFixed(2), Math.floor(h * 4)])
  }
  const polyIdx = (polys) => buildGridIndex(polys.map((p) => ({ p, c: [(p.bbox.minX + p.bbox.maxX) / 2, (p.bbox.minZ + p.bbox.maxZ) / 2] })), TILE_SIZE, (i) => i.c)
  const polyIndexes = { parks: polyIdx(parks), pitches: polyIdx(pitches), beaches: polyIdx(beaches), water: polyIdx(water),
    brickPlazas: polyIdx(plazas.filter((p) => p.kind === 'brick')), concretePlazas: polyIdx(plazas.filter((p) => p.kind === 'concrete')) }
  const polysFor = (name, bounds) => polyIndexes[name].rect({ minX: bounds.minX - 6000, maxX: bounds.maxX + 6000, minZ: bounds.minZ - 6000, maxZ: bounds.maxZ + 6000 })
    .map((i) => i.p).filter((p) => p.bbox.maxX > bounds.minX && p.bbox.minX < bounds.maxX && p.bbox.maxZ > bounds.minZ && p.bbox.minZ < bounds.maxZ)

  // ── Places (P4 · I-4.1): named OSM amenities, one per venue, pinned on the roof they belong to ──────────
  const inWorld = (r) => r.lat >= WORLD_BBOX.s && r.lat <= WORLD_BBOX.n && r.lon >= WORLD_BBOX.w && r.lon <= WORLD_BBOX.e
  const amenityRecs = uniq(chunks('pois')).map(poiRecord).filter((r) => r && inWorld(r)).map((r) => { const [x, z] = project(r.lon, r.lat); return { ...r, x, z } })
  // named apartment and office buildings join as places, at most a dozen of each per tile (the tallest)
  const buildingRecs = capByTile(buildings.map(buildingPoi).filter(Boolean).map((r) => ({ ...r, tile: tileKeyFor([r.x, r.z]) })), { apartments: 12, offices: 12 })
  // websites: OSM tags, then the cached Wikidata official sites (fetch/fetch-wikidata-sites.js)
  const wdFile = join(ROOT, 'cache', 'wikidata-sites.json'), wd = existsSync(wdFile) ? loadJson(wdFile) : {}
  const poiRecs = mergeSites(dedupePois([...amenityRecs, ...buildingRecs, ...rooftops.places]), wd)
  const withSite = (list) => list.filter((r) => r.tags?.website).length
  log(`places with a website: ${withSite(dedupePois([...amenityRecs, ...buildingRecs]))} from OSM tags → ${withSite(poiRecs)} with Wikidata`)
  const poisByTile = new Map()
  for (const r of poiRecs) { const k = tileKeyFor([r.x, r.z]); if (!poisByTile.has(k)) poisByTile.set(k, []); poisByTile.get(k).push(r) }
  const poiIndex = []
  log(`places: ${poiRecs.length} (${POI_CATEGORIES.map((c) => `${c.id} ${poiRecs.filter((r) => r.cat === c.id).length}`).join(', ')})`)
  const r1 = (v) => Math.round(v * 10) / 10
  const addrOf = (t) => [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ') || null

  const tiles = []
  const blocks = new Map()
  const blockGlow = new Map()
  let n = 0
  for (const [key, t] of T) {
    const bounds = tileBounds(key)
    const L0 = bAcc(), L1 = bAcc(), meta = [], tops = []
    t.b.forEach((b, i) => {
      const top = Math.max(0, ...b.pieces.map((p) => p.top), b.venueTop ?? 0)
      tops[i] = top
      const family = b.facadeOverride ? (VENUE_FACADES[b.facadeOverride] ?? FACADE_FAMILIES.indexOf(b.facadeOverride)) : classifyFacade({ height: top, year: b.year ?? 0, area: b.area, type: b.tags?.building })
      const seed = b.seedOverride ?? hashSeed(b.id)
      const shown = b.pieces.filter((p) => !p.hidden) // a hidden piece counts for height, trees and clearance; its sculpt draws it
      const parapets = b.noParapet || b.sculptReplaces ? [] : shown.map(parapetPiece).filter(Boolean)
      const st = meshStyle(b)
      if (!b.sculptReplaces) for (const pc of shown) appendBuilding(L0, extrudeBuilding(pc), family, seed, i, st) // a sculpted hero draws its own close-range body
      for (const pc of parapets) appendBuilding(L0, extrudeBuilding(pc), PARAPET_FACADE, seed, i, st)
      const crownStyle = (m) => (m.style ? styleIndex(m.style) : m.facade != null ? meshStyle(b, 'crown') : st) // own-surface crowns skip the wall recolour; sculpted detail names its material row
      for (const m of b.extraMeshes || []) appendBuilding(L0, m, m.facade ?? family, m.seed ?? seed, i, crownStyle(m))
      for (const v of b.venueMeshes || []) { const vs = partStyle(b, v); appendBuilding(L0, v.mesh, v.facade, v.seed, i, vs); if (!v.lod0Only) appendBuilding(L1, v.mesh, v.facade, v.seed, i, vs) } // fine landmark detail (merlons, ledges, carving) is close-range only
      // LOD1: heroes and part-buildings keep their shape (they are the skyline); plain footprints simplify
      if (keepsShapeAtDistance(b)) { for (const pc of shown) appendBuilding(L1, extrudeBuilding(pc), family, seed, i, st); for (const m of b.extraMeshes || []) if (!m.lod0Only) appendBuilding(L1, m, m.facade ?? family, m.seed ?? seed, i, crownStyle(m)) }
      else if (b.area >= 80) for (const pc of lod1Pieces(b)) appendBuilding(L1, extrudeBuilding(pc), family, seed, i, st)
      if (top > 15) for (const pr of roofProps(b, shown)) t.props.push(pr)
      meta.push({ id: b.id, name: b.name, address: b.address, stories: b.stories, year: b.year, height: Math.round(top * 10) / 10, hero: b.hero ?? null })
    })
    const LV = { ...bAcc(), leaf: [] }
    for (const { br, built, leafIds } of t.bridges) {
      const idx = meta.length
      meta.push({ id: `bridge:${br.key}`, name: br.name, address: null, stories: null, year: br.year ?? null, height: 0, hero: null, bridge: br.key })
      for (const m of built.fixed) { appendBuilding(L0, m.mesh, m.facade, m.seed, idx, sIdx(m.style)); appendBuilding(L1, m.mesh, m.facade, m.seed, idx, sIdx(m.style)) }
      built.leaves.forEach((lf, j) => {
        for (const m of lf.meshes) {
          appendBuilding(LV, m.mesh, m.facade, m.seed, idx, sIdx(m.style))
          for (let q = 0; q < m.mesh.positions.length / 3; q++) LV.leaf.push(leafIds[j] + 1)
          appendBuilding(L1, m.mesh, m.facade, m.seed, idx, sIdx(m.style)) // far tiles show the leaves closed
        }
      })
    }
    // the Riverwalk's built parts in this tile: one more "building" entry, picked as the Riverwalk landmark
    const rwParts = rwByTile.get(key)
    if (rwParts) {
      const idx = meta.length
      meta.push({ id: 'p-riverwalk', name: 'Chicago Riverwalk', address: null, stories: null, year: 2016, height: 0, hero: 'riverwalk' })
      for (const m of rwParts) { appendBuilding(L0, m.mesh, m.facade, m.seed, idx, sIdx(m.style)); if (!m.lod0Only) appendBuilding(L1, m.mesh, m.facade, m.seed, idx, sIdx(m.style)) }
    }
    const parksM = cutGround(flatMesh(clipPolysToTile(polysFor('parks', bounds), bounds), GROUND_Y.parks))
    const beachesM = cutGround(flatMesh(clipPolysToTile(polysFor('beaches', bounds), bounds), GROUND_Y.beaches))
    const pitchesM = cutGround(flatMesh(clipPolysToTile(polysFor('pitches', bounds), bounds), GROUND_Y.pitches))
    const waterM = waterLayer(clipPolysToTile(polysFor('water', bounds), bounds), (p) => (p.tags?._sunk ? lv.river : GROUND_Y.water))
    // D1: the river's walls (concrete downtown, rubble-faced upriver), deck soffits, and the Riverwalk's floor
    const runsHere = wallsByTile.get(key) ?? []
    const dockM = wallMesh(runsHere.filter((r) => r.tone !== 'riprap')), riprapM = wallMesh(runsHere.filter((r) => r.tone === 'riprap'))
    append(dockM, t.soffit)
    const floorM = floors.length ? flatMesh(clipPolysToTile(floors, bounds), lv.riverwalk) : acc()
    const hasContent = L0.positions.length || LV.positions.length || t.roads.positions.length || parksM.positions.length || waterM.positions.length || transit.tiles.has(key) || dockM.positions.length || riprapM.positions.length
    if (!hasContent) continue
    // plazas: brick ones on the paving layer, concrete ones join the walks; LOD1 keeps the plazas (not the thin paths)
    const brickM = cutGround(flatMesh(clipPolysToTile(polysFor('brickPlazas', bounds), bounds), GROUND_Y.paving))
    const walksAll = acc(), pavingAll = acc()
    append(walksAll, t.walks); append(walksAll, cutGround(flatMesh(clipPolysToTile(polysFor('concretePlazas', bounds), bounds), GROUND_Y.sidewalks))); append(walksAll, floorM)
    append(pavingAll, t.paving); append(pavingAll, brickM)
    const ground0 = mergeGroundLayers({ roads: t.roads, sidewalks: walksAll, parks: parksM, pitches: pitchesM, beaches: beachesM, rail: t.rail, paving: pavingAll, dockwall: dockM, riprap: riprapM })
    const ground1 = mergeGroundLayers({ roads: t.roadsLod1, sidewalks: floorM, parks: parksM, pitches: pitchesM, beaches: beachesM, paving: brickM, dockwall: dockM, riprap: riprapM })
    const tr = transit.tiles.get(key) ?? {}
    const asLeafLayer = (a) => { const l = asLayer(a); l.extra.LEAF = new Float32Array(a.leaf); return l }
    await writeWorldGlb(join(OUT, 'tiles', `${key}.glb`), { buildings: asLayer(L0), leaves: LV.positions.length ? asLeafLayer(LV) : null, ground: ground0, water: waterM, transit: tr.transit, ties: tr.ties, stations: tr.stations, glow: tr.glow }, { lod: 'lod0' })
    await writeWorldGlb(join(OUT, 'tiles', `${key}.lod1.glb`), { buildings: asLayer(L1), ground: ground1, water: waterM, glow: tr.glowLod }, { lod: 'lod1' })
    // accumulate the tile's far-detail content into its 2 km block
    const bk = blockKeyFor(key)
    if (!blocks.has(bk)) blocks.set(bk, createBlock())
    if (tr.glowLod?.positions.length) { if (!blockGlow.has(bk)) blockGlow.set(bk, []); blockGlow.get(bk).push(tr.glowLod) }
    addTileToBlock(blocks.get(bk), key, { buildings: L1, ground: ground1, water: waterM, count: meta.length })
    // the tile's places, anchored against its own buildings (a 3 m margin catches entrance nodes)
    const cand = t.b.map((b, i) => ({ polygons: b.polygons, top: tops[i], bldg: i, bb: b.bbox }))
    const index = { query: (x, z) => cand.filter((c) => !c.bb || (x >= c.bb.minX - 3 && x <= c.bb.maxX + 3 && z >= c.bb.minZ - 3 && z <= c.bb.maxZ + 3)) }
    const pois = (poisByTile.get(key) ?? []).map((r) => {
      let a = anchorPoi(r, index)
      const c = POI_CAT_IDS.indexOf(r.cat), addr = addrOf(r.tags)
      if (floorIdx?.find([a.x, a.z]) && (a.bldg < 0 || !(tops[a.bldg] > 0.5))) a = { ...a, y: lv.riverwalk + a.y } // a place on the Riverwalk is pinned at river level
      const tg = Object.fromEntries(['cuisine', 'opening_hours', 'website'].filter((k) => r.tags[k]).map((k) => [k, r.tags[k]]))
      poiIndex.push([r.id, r.name, c, Math.round(a.x), Math.round(a.z), key])
      return { id: r.id, n: r.name, c, x: r1(a.x), y: r1(a.y), z: r1(a.z), b: a.bldg, ...(addr ? { a: addr } : {}), ...(Object.keys(tg).length ? { t: tg } : {}) }
    })
    writeFileSync(join(OUT, 'tiles', `${key}.json`), JSON.stringify(encodeTileMeta({ buildings: meta, trees: t.trees, props: t.props, ...(pois.length ? { pois } : {}) }))) // compact v2 (X-0a)
    tiles.push({ key, block: bk, bounds, lod0: `tiles/${key}.glb`, lod1: `tiles/${key}.lod1.glb`, meta: `tiles/${key}.json`, buildings: t.b.length, maxHeight: Math.max(0, ...meta.map((m) => m.height)) })
    if (++n % 50 === 0) log(`tiles written: ${n}`)
  }
  log(`tiles: ${tiles.length}`)
  writeFileSync(join(OUT, 'bridges.json'), JSON.stringify(bridgeSide))
  assertNoVenueTrees([...T].map(([k, t]) => [k, t.trees]), zones)
  log('venue tree check: 0 trees inside any venue')
  rmSync(join(OUT, 'blocks'), { recursive: true, force: true })
  const blockList = []
  for (const [bk, B] of blocks) {
    const [bx, bz] = bk.split('_').map(Number), size = TILE_SIZE * BLOCK_TILES
    const gl = blockGlow.get(bk)
    await writeWorldGlb(join(OUT, 'blocks', `${bk}.glb`), { ...blockLayers(B), glow: gl?.length ? concatLayers(gl) : undefined }, { lod: 'block' })
    writeFileSync(join(OUT, 'blocks', `${bk}.json`), JSON.stringify(blockSidecar(B)))
    blockList.push({ key: bk, file: `blocks/${bk}.glb`, meta: `blocks/${bk}.json`, bounds: { minX: bx * size, maxX: (bx + 1) * size, minZ: bz * size, maxZ: (bz + 1) * size } })
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
  // Land is solid: enclave holes in the city boundary (other municipalities) are still land, never lake.
  const landLimits = [...landPolys, ...region].map((p) => ({ outer: p.outer, holes: [] }))
  // The city limits run out into the lake; the real shore is Lake Michigan's own outline (its outer member ways).
  const landSolid = lakeSideP.length ? landMinusWater({ land: landLimits, water: lakeSideP }) : landLimits
  log(`shoreline: ${shoreLines.length} ways, lake side ${lakeSideP.length ? 'cut' : 'MISSING — using city limits'}`)
  rmSync(join(OUT, 'ground'), { recursive: true, force: true }) // X-0b: drops the unused Phase-2 ground layers (roads, parks, …: 8 MB nothing loads)
  mkdirSync(join(OUT, 'ground'), { recursive: true })
  await writeMeshGlb(join(OUT, 'ground', 'land.glb'), flatMesh(landMinusWater({ land: landSolid, water: [...water, ...groundCuts] }), 0)) // D1: open over the Riverwalk and the bridge pits
  writeFileSync(join(OUT, 'land.json'), JSON.stringify({ rings: [...landPolys, ...region].map((p) => simplifyRing(p.outer, 20).map(([x, z]) => [Math.round(x), Math.round(z)])) }))
  const [x0, z0] = project(WORLD_BBOX.w, WORLD_BBOX.n), [x1, z1] = project(WORLD_BBOX.e, WORLD_BBOX.s)
  // ── Horizon: simple blocks on Chicago's grid beyond the detailed world, streamed like far blocks ──
  const isLand = (p) => landPolys.some((q) => pointInRing(p, q.outer) && !q.holes.some((h) => pointInRing(p, h)))
  const hBoxes = horizonBoxes({ inner: { minX: x0, maxX: x1, minZ: z0, maxZ: z1 }, band: 3000, isLand, seed: 7 })
  const hChunks = new Map()
  const HSIZE = TILE_SIZE * BLOCK_TILES
  hBoxes.forEach((hb) => {
    const k = `h-${Math.floor(hb.outer[0][0] / HSIZE)}_${Math.floor(hb.outer[0][1] / HSIZE)}`
    if (!hChunks.has(k)) hChunks.set(k, { ...bAcc(), n: 0 })
    const H = hChunks.get(k)
    appendBuilding(H, extrudeBuilding({ outer: hb.outer, holes: [], base: 0, top: hb.top }), FACADE_FAMILIES.indexOf(hb.family), hb.seed, H.n++)
  })
  for (const [k, acc0] of hChunks) {
    const [bx, bz] = k.slice(2).split('_').map(Number)
    await writeWorldGlb(join(OUT, 'blocks', `${k}.glb`), { buildings: asLayer(acc0) }, { lod: 'block' })
    blockList.push({ key: k, file: `blocks/${k}.glb`, horizon: true, bounds: { minX: bx * HSIZE, maxX: (bx + 1) * HSIZE, minZ: bz * HSIZE, maxZ: (bz + 1) * HSIZE } })
  }
  log(`horizon: ${hBoxes.length} buildings in ${hChunks.size} chunks`)

  // ── Lake Michigan, the shoreline texture, the camera heightfield ────────────
  const lakePolys = lakePolygons({ center: [shoreX(0), 0], land: landSolid, water })
  const lakeM = flatMesh(lakePolys, GROUND_Y.lake)
  await writeMeshGlb(join(OUT, 'ground', 'lake.glb'), { ...lakeM, extra: { CALM: new Float32Array(lakeM.positions.length / 3).fill(CALM.lake) } })
  log(`lake: ${lakePolys.length} polygons, ${lakeM.positions.length / 9} triangles`)
  const shoreXs = []
  for (let z = z0; z <= z1; z += 250) shoreXs.push(shoreX(z))
  const shoreBounds = { minX: Math.min(...shoreXs) - 600, maxX: Math.max(...shoreXs) + 1600, minZ: z0 - 2000, maxZ: z1 + 2000 }
  const shore = bakeShore({ bounds: shoreBounds, land: [...landSolid, ...breakwaters.map((b) => b.polygons[0])], water })
  mkdirSync(join(OUT, 'water'), { recursive: true })
  await sharp(Buffer.from(shore.pixels), { raw: { width: shore.grid.width, height: shore.grid.height, channels: 1 } }).png({ compressionLevel: 9 }).toFile(join(OUT, 'water', 'shore.png'))
  const hf = bakeHeightfield({ pieces: [...buildings.flatMap((b) => b.pieces), ...hBoxes], points: meshPoints(buildings) }, boundsUnion([...tiles.map((t) => t.bounds), ...blockList.map((b) => b.bounds)]))
  await sharp(Buffer.from(encodeHeights(hf.heights, HEIGHTFIELD.scale)), { raw: { width: hf.grid.width, height: hf.grid.height, channels: 3 } }).png({ compressionLevel: 9 }).toFile(join(OUT, 'heightfield.png'))
  log(`shore ${shore.grid.width}×${shore.grid.height} px, heightfield ${hf.grid.width}×${hf.grid.height} px`)

  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, half = Math.max(x1 - x0, z1 - z0) / 2 + 300
  const mmBounds = { minX: +(cx - half).toFixed(1), minZ: +(cz - half).toFixed(1), maxX: +(cx + half).toFixed(1), maxZ: +(cz + half).toFixed(1) }
  const svg = minimapSvg({
    land: landPolys.map((p) => p.outer), water: water.map((p) => p.outer), parks: parks.map((p) => p.outer),
    roads: roads.map((e) => e.geometry.map((p) => project(p.lon, p.lat))),
    buildings: buildings.filter((b) => b.area > 60).flatMap((b) => b.polygons.map((p) => p.outer)),
  }, mmBounds, 2048)
  writeFileSync(join(OUT, MINIMAP_FILE), await encodeMinimap(svg)) // lossless WebP (X-0c)
  log('minimap written')
  writeFileSync(join(OUT, 'styles.json'), JSON.stringify(styles.toJSON()))
  await writeStylePalettePng(join(OUT, 'style-palette.png'), styles.toJSON())
  log(`style palette written: ${styles.size} rows`)

  const [r0x, r0z] = project(RING0_BBOX.w, RING0_BBOX.n), [r1x, r1z] = project(RING0_BBOX.e, RING0_BBOX.s)
  writeFileSync(join(OUT, 'transit.json'), JSON.stringify(transit.json))
  // ── The river's levels for the app (D1-6/7/8): the mirror's river corridor, the sunken water and the Riverwalk floor ──
  const RIVER_LEVELS_FILE = 'river-levels.json'
  rmSync(join(OUT, RIVER_LEVELS_FILE), { force: true })
  if (lv) {
    const rr = (r) => simplifyRing(r, 1.5).map(([x, z]) => [r1(x), r1(z)])
    writeFileSync(join(OUT, RIVER_LEVELS_FILE), JSON.stringify({
      version: 1, y: lv.river, riverwalk: lv.riverwalk,
      corridor: corridorMask(sunk, boundsUnion(tiles.map((t) => t.bounds))),
      water: sunk.map((p) => rr(p.outer)),
      floors: floors.map((z) => ({ outer: rr(z.outer), holes: (z.holes ?? []).map(rr), y: z.y })),
      obstacles: (rw?.obstacles ?? []).map((o) => o.map(([x, z]) => [r1(x), r1(z)])),
    }))
    log(`${RIVER_LEVELS_FILE}: ${(statSync(join(OUT, RIVER_LEVELS_FILE)).size / 1e3).toFixed(0)} kB`)
  }
  // ── The multi-level streets (D2-1): Lower Wacker, Lower Michigan, Lower Columbus … as centrelines the app builds ──
  rmSync(join(OUT, LOWER_LEVELS_FILE), { force: true })
  let lowerEntry = null
  if (lowerLevelsOn(levelsData, process.env)) {
    const rr = (r) => simplifyRing(r, 1.5).map(([x, z]) => [r1(x), r1(z)]) // the river-levels.json rings, so build-lower-levels.js agrees
    const lowerJson = buildLowerLevels({ roads: uniq(chunks('roads')), levels: levelsData.levels, water: sunk.map((p) => rr(p.outer)), tracks: transit.json.routes.map((r) => r.path), tubeClear: levelsData.tubeDips.tunnelClearM })
    const raw = JSON.stringify(lowerJson)
    if (raw.length > LOWER_MAX_BYTES) throw new Error(`${LOWER_LEVELS_FILE}: ${raw.length} B over its ${LOWER_MAX_BYTES} B budget`)
    writeFileSync(join(OUT, LOWER_LEVELS_FILE), raw)
    lowerEntry = lowerManifestEntry(lowerJson)
    log(`${LOWER_LEVELS_FILE}: ${lowerJson.ways.length} lower-street pieces, ${(raw.length / 1e3).toFixed(1)} kB (D2)`)
  } else log('lower levels: off (LEVELS_LOWER=0) — nothing under the street')
  // ── Neighbourhoods (P4 · I-4.3): official boundaries + curated profiles, measured for their feel ─────────
  const hoodFile = join(ROOT, 'cache', 'neighborhoods-y6yq.geojson')
  let hoods = null
  if (existsSync(hoodFile)) {
    const major = /^(motorway|trunk|primary|secondary)(_link)?$/
    hoods = buildNeighborhoods({
      features: loadJson(hoodFile).features, curated: loadJson(join(ROOT, 'data', 'neighborhoods.curated.json')), project,
      pois: poiRecs, stations: transit.json.stations, parks: greens.map((g) => g.outer),
      roads: roads.filter((e) => major.test(e.tags?.highway ?? '')).map((e) => e.geometry.map((p) => project(p.lon, p.lat))),
    })
    writeFileSync(join(OUT, 'neighborhoods.json'), JSON.stringify(hoods))
    log(`neighborhoods: ${hoods.zones.length} zones`)
  } else log('neighborhoods: no boundary cache (run fetch:world) — LIVE lens has no zones')
  await writeTrainsGlb(join(OUT, 'trains.glb'), loadCatalog())
  // ── Traffic (user, 2026-09-30): the drivable road graph, int16 metres ─────────
  const roadGraph = buildRoadGraph(roads, project), roadEnc = encodeRoadGraph(roadGraph)
  if (roadEnc.some((v) => v < -32768 || v > 32767)) throw new Error('traffic graph: a value outside int16')
  writeFileSync(join(OUT, 'traffic.bin'), Buffer.from(new Int16Array(roadEnc).buffer))
  log(`traffic graph: ${roadGraph.nodes.length} nodes, ${roadGraph.edges.length} edges, ${((roadEnc.length * 2) / 1e3).toFixed(0)} kB`)
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({
    version: MANIFEST_VERSION, ...manifestStamp(), origin: ORIGIN, tileSize: TILE_SIZE, bbox: WORLD_BBOX,
    core: { minX: r0x, maxX: r1x, minZ: r0z, maxZ: r1z },
    sources: [
      { name: 'OpenStreetMap (ODbL) — buildings, parts, water, parks, roads, rail, trees', id: 'overpass' },
      { name: 'City of Chicago Building Footprints (enrichment)', id: 'syp8-uezg' },
      { name: 'City of Chicago Boundary', id: 'qqq8-j68g' },
      { name: 'Wikipedia — List of tallest buildings in Chicago', id: 'skyline.json' },
      { name: 'Landmark colours and materials — sourced per look in heroes.json', id: 'heroes.json#look' },
      { name: 'OpenStreetMap (ODbL) — CTA and Metra route relations, stations, platforms', id: 'overpass-transit' },
      { name: 'CTA GTFS route colours', id: 'cta-gtfs' },
    ],
    skyline: { missing: sky.missing, wrongHeight: sky.wrongHeight },
    landmarks: [
      ...buildings.filter((b) => b.hero).map((b) => landmarkEntry(b, heroes.find((h) => h.key === b.hero))),
      ...bridges.filter((b) => !b.generic).map((b) => ({ key: `bridge-${b.key}`, name: b.name, aliases: b.aliases, x: Math.round(b.centre[0]), z: Math.round(b.centre[1]), top: 8, beacon: [Math.round(b.centre[0]), 14, Math.round(b.centre[1])] })),
    ],
    tallest: buildings.filter((b) => !b.hero && b.name && b.pieces.length && Math.max(...b.pieces.map((p) => p.top)) > 150).map((b) => ({ key: b.id, name: b.name, x: Math.round(b.centroid[0]), z: Math.round(b.centroid[1]), top: Math.round(Math.max(...b.pieces.map((p) => p.top))) })),
    tiles, blocks: blockList, land: 'ground/land.glb', lake: 'ground/lake.glb', landMask: 'land.json', transit: 'transit.json', trains: 'trains.glb', traffic: 'traffic.bin', walkGraph: 'walk-graph.json', styles: 'styles.json', stylePalette: 'style-palette.png',
    shore: { file: 'water/shore.png', ...shore.grid, maxDist: SHORE.maxDist },
    heightfield: { file: 'heightfield.png', ...hf.grid, scale: HEIGHTFIELD.scale }, minimap: { file: MINIMAP_FILE, bounds: mmBounds, size: 2048 },
    neighborhoods: hoods ? 'neighborhoods.json' : null,
    pois: poiIndex.length ? { index: 'pois-index.json', count: poiIndex.length, categories: POI_CATEGORIES } : null,
    venues: 'venues.json', bridges: 'bridges.json', landmarkRuntime: 'landmarks.json', schedules: existsSync(join(ROOT, 'data', 'schedules.json')) ? 'schedules.json' : null,
    ...(lv || lowerEntry ? { levels: { ...(lv ? { river: { y: lv.river, riverwalk: lv.riverwalk, file: RIVER_LEVELS_FILE } } : {}), ...(lowerEntry ? { lower: lowerEntry } : {}) } } : {}), // D1-8 / D2: absent = the flat world
  })) // minified (X-0d)
  if (poiIndex.length) { writeFileSync(join(OUT, 'pois-index.json'), JSON.stringify(poiIndex)); log(`pois-index.json: ${(statSync(join(OUT, 'pois-index.json')).size / 1e6).toFixed(2)} MB`) }
  log('manifest written')
  const swept = sweepStale(OUT)
  if (swept.length) log(`stale outputs removed (nothing loads them): ${swept.join(', ')}`)
  // ── Budget ledger (X-0e): MB per folder, the delta against the last build, the 197 MB content cap ──────────
  const ledgerFile = join(ROOT, 'world-ledger.json'), prevLedger = existsSync(ledgerFile) ? loadJson(ledgerFile) : null
  const ledger = worldLedger(OUT)
  log(`world budget ledger (vs the previous build):\n${ledgerReport(ledger, prevLedger).join('\n')}`)
  writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 1)}\n`)
  log(`public/world: ${(ledger.total / 1e6).toFixed(1)} MB (content cap ${BUDGET.contentMB} MB, hard cap ${BUDGET.hardMB} MB)`)
  if (quantReport) { writeFileSync(process.env.QUANT_REPORT, `${JSON.stringify(quantReport, null, 1)}\n`); log(`quantisation report → ${process.env.QUANT_REPORT}`) }
  checkBudget(ledger.total)
}

await main()
