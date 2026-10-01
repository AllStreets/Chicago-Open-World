// pipeline/build/levels-survey.js — Workstream D0-3 / D0-4 dry run. Reads the OSM world cache (never writes
// app/public/world) and reports:
//   • every place a subway tube crosses a river polygon or a lower-level street (feeds levels.json.tubeDips)
//   • the layer<0 highway census (all, and inside the downtown multi-level zone)
//   • a bytes ledger per stage, measured by encoding prototype geometry the way the build does (meshopt tiles,
//     JSON sidecars, Int16 traffic.bin) into a scratch directory.
// Usage: node build/levels-survey.js <scratch-out-dir> [--cache <dir>]
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { project } from '../../shared/project.js'
import { openRing } from '../lib/geom.js'
import { assembleRings } from '../lib/multipolygon.js'
import { writeTileGlb } from '../lib/tilepack.js'
import { buildRoadGraph, encodeRoadGraph } from '../lib/traffic.js'
import { WORLD_BBOX } from '../lib/sources.js'
import { tubeCrossings, lowerLevelZone, compactLowerWays } from '../lib/levels.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const OUT = args[0] && !args[0].startsWith('--') ? resolve(args[0]) : null
const ci = args.indexOf('--cache')
const CACHE = ci >= 0 ? resolve(args[ci + 1]) : join(ROOT, 'cache', 'world')
const PUBLIC_WORLD = resolve(ROOT, '..', 'app', 'public', 'world')
const LV = JSON.parse(readFileSync(join(ROOT, 'data', 'levels.json'), 'utf8')).levels
if (!OUT) { console.error('usage: node build/levels-survey.js <scratch-out-dir> [--cache <dir>]'); process.exit(1) }
if (OUT.startsWith(PUBLIC_WORLD)) { console.error('refusing to write into app/public/world'); process.exit(1) }
mkdirSync(OUT, { recursive: true })

const chunks = (k) => readdirSync(CACHE).filter((f) => f.startsWith(`osm-${k}-`)).flatMap((f) => JSON.parse(readFileSync(join(CACHE, f), 'utf8')).data.elements)
const uniq = (els) => [...new Map(els.map((e) => [`${e.type}${e.id}`, e])).values()]
const P = (g) => g.map((p) => project(p.lon, p.lat))
const inWorld = (p) => p.lat >= WORLD_BBOX.s && p.lat <= WORLD_BBOX.n && p.lon >= WORLD_BBOX.w && p.lon <= WORLD_BBOX.e

function polys(elements) {
  const out = []
  for (const el of elements) {
    if (el.type === 'way' && el.geometry) out.push({ id: el.id, outer: openRing(P(el.geometry)), holes: [], tags: el.tags || {} })
    else if (el.type === 'relation' && el.members) {
      const ways = (role) => el.members.filter((m) => m.role === role && m.geometry).map((m) => P(m.geometry))
      const inners = assembleRings(ways('inner'))
      for (const o of assembleRings(ways('outer'))) out.push({ id: el.id, outer: o, holes: inners, tags: el.tags || {} })
    }
  }
  return out.filter((p) => p.outer.length >= 3)
}

// ── census ───────────────────────────────────────────────────────────────────────────────────────────────────────
const roads = uniq(chunks('roads'))
const lowAll = roads.filter((e) => e.tags?.highway && Number(e.tags.layer) < 0)
const lowZone = roads.filter(lowerLevelZone)
const byLayer = (els) => els.reduce((m, e) => ({ ...m, [e.tags.layer]: (m[e.tags.layer] ?? 0) + 1 }), {})

// ── D0-3 tube crossings ──────────────────────────────────────────────────────────────────────────────────────────
const isTube = (t = {}) => t.railway === 'subway' && ((t.tunnel && t.tunnel !== 'no') || Number(t.layer) < 0 || t.location === 'underground')
const tubes = uniq(chunks('rail')).filter((e) => isTube(e.tags) && e.geometry).map((e) => ({ id: e.id, name: e.tags.name || `way ${e.id}`, points: P(e.geometry) }))
const rivers = polys(uniq(chunks('water')).filter((e) => ['river', 'canal'].includes(e.tags?.water) || e.tags?.waterway === 'riverbank'))
const lowers = lowZone.map((e) => ({ id: e.id, name: e.tags.name || `${e.tags.highway} ${e.id}`, layer: Number(e.tags.layer), points: P(e.geometry) }))
const crossings = tubeCrossings({ tubes, rivers, lowers })
const grouped = new Map()
for (const c of crossings) {
  const cell = c.at.map((v) => Math.round(v / 250)).join(',') // twin tubes of one crossing share a cell
  const k = c.kind === 'river' ? `${c.tube} × river ${c.river} @${cell}` : `${c.tube} × ${c.road} @${cell}`
  const g = grouped.get(k) ?? { ...c, ways: 0 }
  g.ways++; grouped.set(k, g)
}

// ── D0-4 ledger ──────────────────────────────────────────────────────────────────────────────────────────────────
const ledger = {}
// D1 dockwalls: one vertical quad per river-polygon edge, street (0) → RIVER_Y − 0.5, encoded like a tile layer.
// (Polygon rings are closed; the coastline below is open, so its last→first edge is a long chord: an over-estimate.)
const wallMesh = (rings, y0, y1) => {
  const m = { positions: [], normals: [], uvs: [] }
  for (const ring of rings) for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], L = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (L < 0.05) continue
    const n = [(b[1] - a[1]) / L, 0, -(b[0] - a[0]) / L]
    const q = [[a[0], y0, a[1], 0, y0], [b[0], y0, b[1], L, y0], [b[0], y1, b[1], L, y1], [a[0], y1, a[1], 0, y1]]
    for (const k of [0, 1, 2, 0, 2, 3]) { m.positions.push(q[k][0], q[k][1], q[k][2]); m.normals.push(...n); m.uvs.push(q[k][3], q[k][4]) }
  }
  return m
}
const worldRivers = rivers.filter((r) => r.outer.some(([x, z]) => Math.abs(x) < 9000 && Math.abs(z) < 15000))
const riverRings = worldRivers.flatMap((r) => [r.outer, ...r.holes])
const riverPerimM = riverRings.reduce((s, r) => s + r.reduce((t, p, i) => t + Math.hypot(r[(i + 1) % r.length][0] - p[0], r[(i + 1) % r.length][1] - p[1]), 0), 0)
await writeTileGlb(join(OUT, 'd1-dockwalls.glb'), { ground: wallMesh(riverRings, 0, LV.RIVER_Y - 0.5) })
ledger.D1_dockwalls = { perimeterM: Math.round(riverPerimM), bytes: statSync(join(OUT, 'd1-dockwalls.glb')).size }

// D2 lower-level centrelines JSON (what D2-1 would write)
const zoneJson = JSON.stringify({ v: 1, ways: compactLowerWays(lowZone) })
const allJson = JSON.stringify({ v: 1, ways: compactLowerWays(lowAll.filter((e) => e.geometry?.length > 1)) })
writeFileSync(join(OUT, 'lower-levels.json'), zoneJson)
ledger.D2_lowerLevelsJson = { ways: lowZone.length, bytes: zoneJson.length, bytesIfAll529: allJson.length }

// D3 traffic.bin v2: the zone's lower ways as graph edges (Int16) + one level value per node
const strip = (e) => ({ ...e, tags: { ...e.tags, layer: undefined, tunnel: undefined } })
const lowGraph = encodeRoadGraph(buildRoadGraph(lowZone.map(strip), project))
const tb = join(PUBLIC_WORLD, 'traffic.bin')
let nodes = null
if (existsSync(tb)) { const b = readFileSync(tb); nodes = new Int16Array(b.buffer, b.byteOffset, b.length / 2)[1] }
ledger.D3_traffic = { lowerEdgesBytes: lowGraph.length * 2, existingNodes: nodes, levelBytes: nodes == null ? null : (nodes + (lowGraph[1] ?? 0)) * 2 }

// D5 lake: shore walls/aprons along the OSM coastline inside the world (two stepped faces ≈ 2 quads per edge)
const coast = uniq(chunks('coast')).filter((e) => e.geometry?.some(inWorld)).map((e) => P(e.geometry.filter(inWorld))).filter((l) => l.length > 1)
const coastM = coast.reduce((s, l) => s + l.slice(1).reduce((t, p, i) => t + Math.hypot(p[0] - l[i][0], p[1] - l[i][1]), 0), 0)
const apron = wallMesh(coast, 0, LV.LAKE_Y)
await writeTileGlb(join(OUT, 'd5-shore.glb'), { ground: apron })
ledger.D5_shore = { coastM: Math.round(coastM), bytesOneFace: statSync(join(OUT, 'd5-shore.glb')).size, bytesTwoSteps: 2 * statSync(join(OUT, 'd5-shore.glb')).size }

const report = {
  census: { layerLt0All: lowAll.length, byLayerAll: byLayer(lowAll), zone: lowZone.length, byLayerZone: byLayer(lowZone) },
  tubes: tubes.length, rivers: rivers.length,
  crossings: [...grouped.entries()].map(([k, c]) => {
    const [lon, lat] = [c.at[0], c.at[1]]
    return { key: k, kind: c.kind, tube: c.tube, road: c.road ?? null, layer: c.layer ?? null, lengthM: c.lengthM ? Math.round(c.lengthM) : null, x: Math.round(lon), z: Math.round(lat), ways: c.ways }
  }),
  ledger,
}
writeFileSync(join(OUT, 'levels-survey.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
