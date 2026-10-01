// pipeline/build/build-rides.js — Ride the city's data (P7) → app/src/data/rides.json (compact, app-side: public/world
// stays under its 200 MB budget). Buses: CTA route=bus relations from OpenStreetMap (fetched once, cached). Walks: the
// curated walks, off-street legs routed over the walk graph (walk-graph.json), street walks on their sidewalk; every
// walk is routed on a 3 m grid of open ground (no building, no water), cheapest along the walk graph's paths or the
// street's sidewalk, then checked again against the footprints: the build fails if one passes through a building.
// node build/build-rides.js [--cache <dir with osm-allbuildings-*.json and osm-roads-*.json>] [--refetch]
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { project } from '../../shared/project.js'
import { WORLD_BBOX, USER_AGENT } from '../lib/sources.js'
import { osmToBuilding } from '../lib/osm.js'
import { busRide, walkRide, walkSamplesClear, polyLength, simplify } from '../lib/rides.js'
import { parseWalkGraph } from '../../app/src/ride/walkGraph.js'
import { makeIsWater } from '../../app/src/lib/landMask.js'
import { gridRoute, distToLine } from '../lib/walkRoute.js'
import { pointInRing } from '../lib/geom.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null }
const CACHE = arg('--cache') ?? join(ROOT, 'cache', 'world')
const OWN_CACHE = join(ROOT, 'cache', 'world')
const OUT = join(ROOT, '..', 'app', 'src', 'data', 'rides.json')
const curated = JSON.parse(readFileSync(join(ROOT, 'data', 'walks.curated.json'), 'utf8'))
const [x0, z1] = project(WORLD_BBOX.w, WORLD_BBOX.s), [x1, z0] = project(WORLD_BBOX.e, WORLD_BBOX.n)
const BOX = { minX: x0, maxX: x1, minZ: z0, maxZ: z1 }

async function busRelations() {
  const file = join(OWN_CACHE, 'osm-bus-routes.json')
  if (existsSync(file) && !process.argv.includes('--refetch')) return JSON.parse(readFileSync(file, 'utf8')).data.elements
  const refs = curated.buses.join('|')
  const { s, w, n, e } = WORLD_BBOX
  // the routes with their geometry, then their stop nodes with their names (out geom gives members no tags)
  const q = `[out:json][timeout:120];relation["route"="bus"]["network"="CTA"]["ref"~"^(${refs})$"](${s},${w},${n},${e})->.r;.r out geom;node(r.r);out;`
  const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'user-agent': USER_AGENT, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ data: q }) })
  if (!r.ok) throw new Error(`Overpass ${r.status}`)
  const data = await r.json()
  mkdirSync(OWN_CACHE, { recursive: true })
  writeFileSync(file, JSON.stringify({ fetchedAt: new Date().toISOString(), data }))
  return data.elements
}
// stop names onto the relation's node members
function withStopNames(els) {
  const tags = new Map(els.filter((e) => e.type === 'node').map((e) => [e.id, e.tags ?? {}]))
  return els.filter((e) => e.type === 'relation').map((r) => ({ ...r, members: r.members.map((m) => (m.type === 'node' ? { ...m, tags: tags.get(m.ref) ?? {} } : m)) }))
}

// one route per ref: the relation with the most of its length in the world
function pickBuses(rels) {
  const best = new Map()
  for (const rel of rels) {
    const r = busRide(rel, project, BOX)
    if (!r) continue
    const L = polyLength(r.path), cur = best.get(r.ref)
    if (!cur || L > cur.L) best.set(r.ref, { r, L })
  }
  return curated.buses.map((ref) => best.get(ref)?.r).filter(Boolean)
}

function footprintIndex() {
  const files = readdirSync(CACHE).filter((f) => f.startsWith('osm-allbuildings-'))
  const cell = 100, grid = new Map(), seen = new Set()
  for (const f of files) for (const el of JSON.parse(readFileSync(join(CACHE, f), 'utf8')).data.elements) {
    if (seen.has(`${el.type}${el.id}`)) continue
    seen.add(`${el.type}${el.id}`)
    const b = osmToBuilding(el)
    if (!b) continue
    const [bx0, bz0, bx1, bz1] = [b.bbox.minX, b.bbox.minZ, b.bbox.maxX, b.bbox.maxZ]
    for (let i = Math.floor(bx0 / cell); i <= Math.floor(bx1 / cell); i++) for (let j = Math.floor(bz0 / cell); j <= Math.floor(bz1 / cell); j++) {
      const k = `${i}:${j}`
      if (!grid.has(k)) grid.set(k, [])
      grid.get(k).push(b)
    }
  }
  return (x, z) => grid.get(`${Math.floor(x / cell)}:${Math.floor(z / cell)}`) ?? []
}

// a polyline offset sideways by d metres (right of travel = +), mitred at the corners
function offset(pts, d) {
  const n = (a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return [-dz / l, dx / l] } // right normal (+X east, −Z north)
  return pts.map((p, i) => {
    const a = i > 0 ? n(pts[i - 1], p) : null, b = i < pts.length - 1 ? n(p, pts[i + 1]) : null
    let m = a && b ? [a[0] + b[0], a[1] + b[1]] : a ?? b
    const l = Math.hypot(...m) || 1; m = [m[0] / l, m[1] / l]
    const k = a && b ? 1 / Math.max(0.5, m[0] * a[0] + m[1] * a[1]) : 1
    return [p[0] + m[0] * d * k, p[1] + m[1] * d * k]
  })
}

function landmarkSights(path) {
  const man = JSON.parse(readFileSync(join(ROOT, '..', 'app', 'public', 'world', 'manifest.json'), 'utf8'))
  const out = []
  for (const l of man.landmarks ?? []) {
    let best = Infinity
    for (let i = 1; i < path.length; i++) {
      const [ax, az] = path[i - 1], [bx, bz] = path[i], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz
      const f = l2 ? Math.max(0, Math.min(1, ((l.x - ax) * dx + (l.z - az) * dz) / l2)) : 0
      best = Math.min(best, Math.hypot(ax + dx * f - l.x, az + dz * f - l.z))
    }
    if (best < 90) out.push({ name: l.name, x: Math.round(l.x), z: Math.round(l.z) })
  }
  return out
}

const near = footprintIndex()
const insideBuilding = (x, z) => near(x, z).some((b) => (b.polygons ?? []).some((poly) => pointInRing([x, z], poly.outer) && !(poly.holes ?? []).some((h) => pointInRing([x, z], h))))
const land = JSON.parse(readFileSync(join(ROOT, '..', 'app', 'public', 'world', 'land.json'), 'utf8'))
const isWater = makeIsWater(land.rings)
// 1.5 m clear of every wall: the route's straight steps between cells never clip a corner
const blocked = (x, z) => isWater(x, z) || [[0, 0], [1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]].some(([dx, dz]) => insideBuilding(x + dx, z + dz))

const graphFile = join(ROOT, '..', 'app', 'public', 'world', 'walk-graph.json')
const graph = existsSync(graphFile) ? parseWalkGraph(JSON.parse(readFileSync(graphFile, 'utf8'))) : null
console.log(`walk graph: ${graph ? `${graph.n} nodes` : 'absent — off-street walks route over open ground only'}`)
// the walk graph's paths as a set of 3 m cells (one cell either side), for the router's preferred line
const CELL = 3
const ck = (x, z) => `${Math.round(x / CELL)}:${Math.round(z / CELL)}`
const graphCells = new Set()
if (graph) {
  for (let u = 0; u < graph.n; u++) for (const e of graph.adj[u]) {
    if (e.to < u) continue
    const pts = [[graph.nodes[2 * u], graph.nodes[2 * u + 1]], ...e.pts, [graph.nodes[2 * e.to], graph.nodes[2 * e.to + 1]]]
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / CELL))
      for (let k = 0; k <= n; k++) { const x = ax + ((bx - ax) * k) / n, z = az + ((bz - az) * k) / n; for (const dx of [-CELL, 0, CELL]) for (const dz of [-CELL, 0, CELL]) graphCells.add(ck(x + dx, z + dz)) }
    }
  }
}

const walks = [], failures = []
for (const w of curated.walks) {
  const base = walkRide(w, project)
  let way = base.path, preferred
  if (w.street) { way = offset(base.path, (w.side === 'left' ? -1 : 1) * (w.sidewalkM ?? 15)); preferred = (x, z) => distToLine([x, z], way) < 3 }
  else preferred = (x, z) => graphCells.has(ck(x, z))
  let path = [], ok = true
  for (let i = 1; i < way.length; i++) {
    const leg = gridRoute(way[i - 1], way[i], { blocked, preferred, cell: CELL, offPath: 12 }) // off the paths only where it must (a street is no place to walk)
    if (!leg) { failures.push(`${w.id}: no open way for leg ${i}`); ok = false; break }
    path.push(...(i === 1 ? leg : leg.slice(1)))
  }
  if (!ok) continue
  const rounded = (p) => p.map(([x, z]) => [Math.round(x) + 0, Math.round(z) + 0])
  // a lighter line where that stays clear; the full grid route where it doesn't
  let out = rounded(simplify(path, 1.2))
  if (walkSamplesClear(out, near).length) out = rounded(simplify(path, 0.4))
  if (walkSamplesClear(out, near).length) out = rounded(path)
  const bad = walkSamplesClear(out, near)
  if (bad.length) { failures.push(`${w.id}: ${bad.length} samples inside buildings, e.g. ${JSON.stringify(bad.slice(0, 3))}`); continue }
  const onPath = out.length > 1 ? out.slice(1).filter(([x, z]) => preferred(x, z)).length / (out.length - 1) : 0
  const sights = [...base.sights, ...landmarkSights(out)]
  walks.push({ ...base, path: out, sights: sights.filter((s, i) => sights.findIndex((t) => t.name === s.name) === i) })
  console.log(`  ${w.id}: ${(polyLength(out) / 1000).toFixed(2)} km, ${out.length} points, ${Math.round(onPath * 100)} % of corners on the ${w.street ? 'sidewalk' : 'walk graph'}, ${sights.length} sights`)
}
if (failures.length) { console.error('walks that could not be routed clear of buildings:\n  ' + failures.join('\n  ')); process.exit(1) }
const buses = pickBuses(withStopNames(await busRelations()))
for (const b of buses) console.log(`  bus #${b.ref} ${b.name}: ${(polyLength(b.path) / 1000).toFixed(1)} km, ${b.stops.length} stops`)
writeFileSync(OUT, JSON.stringify({ about: 'Ride the city (P7): pipeline/build/build-rides.js. Local metres [x, z]; OSM (ODbL).', buses, walks }))
console.log(`rides.json → ${OUT} (${(readFileSync(OUT).length / 1024).toFixed(0)} KB)`)
