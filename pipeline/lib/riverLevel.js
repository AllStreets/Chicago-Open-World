// pipeline/lib/riverLevel.js — Workstream D1: the Chicago River at its real depth (levels.json RIVER_Y, −6.3 m under
// the street the model flattens to y 0). Which mapped water is the river system (the river and canal polygons and the
// slips, basins and the Harbor Lock that open onto them), the vertical walls that close every edge where that water
// meets land or a sunken floor (dockwalls, the lock's walls, the Riverwalk's retaining wall), the cut that takes the
// street-level ground off a sunken floor, and the river-corridor mask the app's mirror plane follows (D1-6).
// Pure: build-world.js reads levels.json and calls these. The lake and the inland ponds stay where they are (D5).
import polygonClipping from 'polygon-clipping'
import earcut from 'earcut'
import { pointInRing, ringBBox, openRing, signedArea } from './geom.js'
import { project } from '../../shared/project.js'

// levels.json → the river stage's flag and constants. LEVELS_RIVER=0 in the environment builds today's flat world.
export function riverLevels(data, env = {}) {
  if (!data?.levels || env.LEVELS_RIVER === '0') return null
  const L = data.levels
  return { river: L.RIVER_Y, riverwalk: L.RIVERWALK_Y, lower: L.LOWER_Y, lake: L.LAKE_Y }
}

export const RIVER_WATER = new Set(['river', 'canal'])
const CONNECTORS = new Set(['basin', 'harbour', 'lock', 'reservoir', undefined])
export const TOUCH_M = 2 // a slip or basin this close to the river opens onto it

const segDist = (p, a, b) => {
  const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)) : 0
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz)
}
const bboxOf = (p) => p.bbox ?? ringBBox(p.outer)
const bbNear = (a, b, m) => a.minX - m <= b.maxX && b.minX - m <= a.maxX && a.minZ - m <= b.maxZ && b.minZ - m <= a.maxZ
const rings = (p) => [p.outer, ...(p.holes ?? [])]
function polyDist(p, q, cap) {
  let d = Infinity
  for (const A of rings(p)) for (const B of rings(q)) for (const [X, Y] of [[A, B], [B, A]]) {
    for (const pt of X) {
      for (let i = 0; i < Y.length; i++) { d = Math.min(d, segDist(pt, Y[i], Y[(i + 1) % Y.length])); if (d <= cap * 0.01) return d }
    }
  }
  return d
}
export const inPoly = (pt, p) => pointInRing(pt, p.outer) && !(p.holes ?? []).some((h) => pointInRing(pt, h))

// The river system: every river/canal polygon, plus the slips, basins and the lock that touch it (within TOUCH_M).
// Fountains, raised (layer ≥ 1) pools and the lake's own harbours (they touch the lake, not the river) are left out.
export function sunkWater(water, { touchM = TOUCH_M } = {}) {
  const isSeed = (p) => RIVER_WATER.has(p.tags?.water)
  const canJoin = (p) => CONNECTORS.has(p.tags?.water) && !p.tags?.amenity && !(Number(p.tags?.layer) > 0) && p.tags?.natural === 'water'
  const sunk = water.filter(isSeed)
  let grew = true
  while (grew) {
    grew = false
    for (const p of water) {
      if (sunk.includes(p) || !canJoin(p)) continue
      if (sunk.some((q) => bbNear(bboxOf(p), bboxOf(q), touchM) && polyDist(p, q, touchM) <= touchM)) { sunk.push(p); grew = true }
    }
  }
  return sunk
}

// A simple uniform grid over polygons' bboxes for "is this point inside any of them?"
export function polyIndex(polys, cell = 200) {
  const g = new Map(), key = (i, j) => `${i},${j}`
  for (const p of polys) {
    const b = bboxOf(p)
    for (let i = Math.floor(b.minX / cell); i <= Math.floor(b.maxX / cell); i++) for (let j = Math.floor(b.minZ / cell); j <= Math.floor(b.maxZ / cell); j++) {
      const k = key(i, j); if (!g.has(k)) g.set(k, []); g.get(k).push(p)
    }
  }
  const at = ([x, z]) => (g.get(key(Math.floor(x / cell), Math.floor(z / cell))) ?? []).filter((p) => { const b = bboxOf(p); return x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ })
  // every polygon whose bbox comes within r of the point (r ≤ cell)
  const atNear = ([x, z], r) => {
    const seen = new Set()
    for (const dx of [-r, 0, r]) for (const dz of [-r, 0, r]) for (const p of g.get(key(Math.floor((x + dx) / cell), Math.floor((z + dz) / cell))) ?? []) seen.add(p)
    return [...seen].filter((p) => { const b = bboxOf(p); return x >= b.minX - r && x <= b.maxX + r && z >= b.minZ - r && z <= b.maxZ + r })
  }
  // every ring edge in 25 m cells, built on first use: "is any edge of these polygons within r of the point?"
  let eg = null
  const EC = 25
  const nearEdge = ([x, z], r) => {
    if (!eg) {
      eg = new Map()
      for (const p of polys) for (const ring of rings(p)) for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length]
        for (let ci = Math.floor(Math.min(a[0], b[0]) / EC); ci <= Math.floor(Math.max(a[0], b[0]) / EC); ci++) for (let cj = Math.floor(Math.min(a[1], b[1]) / EC); cj <= Math.floor(Math.max(a[1], b[1]) / EC); cj++) {
          const k = key(ci, cj); if (!eg.has(k)) eg.set(k, []); eg.get(k).push([a, b, p])
        }
      }
    }
    const R = Math.ceil(r / EC)
    for (let ci = Math.floor(x / EC) - R; ci <= Math.floor(x / EC) + R; ci++) for (let cj = Math.floor(z / EC) - R; cj <= Math.floor(z / EC) + R; cj++) {
      for (const [a, b, p] of eg.get(key(ci, cj)) ?? []) if (segDist([x, z], a, b) <= r) return p
    }
    return null
  }
  const find = (pt) => at(pt).find((p) => inPoly(pt, p)) ?? null
  return { at, atNear, find, nearEdge, near: (pt, r) => nearEdge(pt, r) ?? find(pt) }
}

// Wall runs: every edge of the sunken water and of each sunken floor (zone) whose outside is not more of the same
// level. Each wall stands from `top` down to `bottom`, facing into the sunken side.
//   water edge → land:            top 0 (street level),          bottom RIVER_Y − 0.5 (into the water)
//   water edge → sunken floor:    top = that floor's y            (the Riverwalk's river face)
//   lock edge (any outside):      top LOCK_TOP (the lock's walls stand above the lake)
//   zone edge → land:             top 0, bottom = zone y          (the retaining wall behind the Riverwalk)
//   zone edge → water / zone:     no wall (the water's own wall, or the same floor)
export const LOCK_TOP = 0.9
export const PROBE_M = 0.6
export function wallRuns({ water, zones = [], riverY, probe = PROBE_M }) {
  const wIdx = polyIndex(water), zIdx = polyIndex(zones), out = []
  // each edge is probed every ≤ 2 m just outside itself; consecutive probes that agree make one run
  const edges = (p, classify) => {
    for (const r of rings(p)) for (let i = 0; i < r.length; i++) {
      const a = r[i], b = r[(i + 1) % r.length], L = Math.hypot(b[0] - a[0], b[1] - a[1])
      if (L < 0.05) continue
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
      let n = [(b[1] - a[1]) / L, -(b[0] - a[0]) / L] // one of the two normals; flipped to point out of p
      if (inPoly([m[0] + n[0] * probe * 0.5, m[1] + n[1] * probe * 0.5], p)) n = [-n[0], -n[1]]
      const k = Math.max(1, Math.ceil(L / 2)), at = (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
      let cur = null, t0 = 0
      const flush = (t1) => { if (cur) out.push({ a: at(t0), b: at(t1), n, ...cur }) }
      for (let j = 0; j < k; j++) {
        const c = at((j + 0.5) / k), w = classify([c[0] + n[0] * probe, c[1] + n[1] * probe])
        if (JSON.stringify(w) === JSON.stringify(cur)) continue
        flush(j / k); cur = w; t0 = j / k
      }
      flush(1)
    }
  }
  for (const p of water) {
    const lock = p.tags?.water === 'lock'
    edges(p, (o) => {
      if (wIdx.find(o)) return null
      const z = zIdx.find(o)
      return { top: lock ? LOCK_TOP : z ? z.y : 0, bottom: riverY - 0.5, kind: lock ? 'lock' : z ? 'zone-edge' : 'dockwall', tone: p.tone ?? 'concrete' }
    })
  }
  for (const zp of zones) {
    edges(zp, (o) => {
      if (wIdx.find(o)) return null
      const z = zIdx.find(o)
      if (z && z.y <= zp.y + 0.05) return null
      return { top: z ? z.y : 0, bottom: zp.y - 0.3, kind: 'retaining', tone: 'concrete' }
    })
  }
  return out
}

// The walls' tone: downtown (the Main Branch, the South Branch to Roosevelt, the North Branch to Chicago Avenue) the
// river runs between concrete and sheet-pile dockwalls; upriver its banks are rubble-faced and darker.
export const DOWNTOWN_WALLS = { s: 41.866, n: 41.8975, w: -87.6455, e: -87.600 }
let dtBox = null
export function wallTone(r) {
  if (r.kind !== 'dockwall') return 'concrete'
  if (!dtBox) { const [x0, z0] = project(DOWNTOWN_WALLS.w, DOWNTOWN_WALLS.n), [x1, z1] = project(DOWNTOWN_WALLS.e, DOWNTOWN_WALLS.s); dtBox = { x0, z0, x1, z1 } }
  const x = (r.a[0] + r.b[0]) / 2, z = (r.a[1] + r.b[1]) / 2
  return x >= dtBox.x0 && x <= dtBox.x1 && z >= dtBox.z0 && z <= dtBox.z1 ? 'concrete' : 'riprap'
}

// Wall runs → vertical quads facing into the sunken side (away from n), uv = (along, height) in metres.
export function wallMesh(runs) {
  const positions = [], normals = [], uvs = []
  for (const { a, b, n, top, bottom } of runs) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), f = [-n[0], 0, -n[1]]
    const P = [[a[0], top, a[1]], [b[0], top, b[1]], [b[0], bottom, b[1]], [a[0], bottom, a[1]]]
    const UV = [[0, top], [L, top], [L, bottom], [0, bottom]]
    // wound so the face looks along f
    const e1 = [P[1][0] - P[0][0], P[1][1] - P[0][1], P[1][2] - P[0][2]], e2 = [P[2][0] - P[0][0], P[2][1] - P[0][1], P[2][2] - P[0][2]]
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]
    const order = cr[0] * f[0] + cr[1] * f[1] + cr[2] * f[2] >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]
    for (const k of order) { positions.push(...P[k]); normals.push(...f); uvs.push(...UV[k]) }
  }
  return { positions, normals, uvs }
}

// Split wall runs into the tiles their middles fall in (a run longer than a tile is cut first).
export function runsByTile(runs, tileKeyFor, maxLen = 60) {
  const out = new Map()
  for (const r of runs) {
    const L = Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]), k = Math.max(1, Math.ceil(L / maxLen))
    for (let i = 0; i < k; i++) {
      const a = [r.a[0] + ((r.b[0] - r.a[0]) * i) / k, r.a[1] + ((r.b[1] - r.a[1]) * i) / k]
      const b = [r.a[0] + ((r.b[0] - r.a[0]) * (i + 1)) / k, r.a[1] + ((r.b[1] - r.a[1]) * (i + 1)) / k]
      const key = tileKeyFor([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])
      if (!out.has(key)) out.set(key, [])
      out.get(key).push({ ...r, a, b })
    }
  }
  return out
}

// ── The street-level ground over a sunken floor ─────────────────────────────────────────────────────────────────────
// Flat up-facing triangles (a ribbon, a park) minus the zones: triangles clear of every zone stay as they are; the
// rest are clipped and re-triangulated, uvs carried over barycentrically. y stays the triangle's own.
const close = (r) => [...r, r[0]]
export const cutMeshOutside = (m, zones) => clipFlat(m, zones, 'outside')
export const cutMeshInside = (m, zones) => clipFlat(m, zones, 'inside')
function clipFlat(m, zones, mode) {
  const outside = mode === 'outside'
  if (!m.positions.length || (!zones.length && outside)) return outside ? m : { positions: [], normals: [], uvs: [] }
  const zb = zones.map((z) => ({ z, b: bboxOf(z), poly: [close(z.outer), ...(z.holes ?? []).map(close)] }))
  const out = { positions: [], normals: [], uvs: [] }
  const P = m.positions, N = m.normals, U = m.uvs
  for (let t = 0; t < P.length / 9; t++) {
    const v = [0, 1, 2].map((k) => [P[t * 9 + k * 3], P[t * 9 + k * 3 + 1], P[t * 9 + k * 3 + 2]])
    const tb = { minX: Math.min(v[0][0], v[1][0], v[2][0]), maxX: Math.max(v[0][0], v[1][0], v[2][0]), minZ: Math.min(v[0][2], v[1][2], v[2][2]), maxZ: Math.max(v[0][2], v[1][2], v[2][2]) }
    const hits = zb.filter(({ b }) => bbNear(tb, b, 0))
    const keep = () => { for (let k = 0; k < 3; k++) { out.positions.push(...v[k]); out.normals.push(N[t * 9 + k * 3], N[t * 9 + k * 3 + 1], N[t * 9 + k * 3 + 2]); out.uvs.push(U[t * 6 + k * 2], U[t * 6 + k * 2 + 1]) } }
    if (!hits.length) { if (outside) keep(); continue }
    const tri = [[v[0][0], v[0][2]], [v[1][0], v[1][2]], [v[2][0], v[2][2]]]
    const det = (tri[1][0] - tri[0][0]) * (tri[2][1] - tri[0][1]) - (tri[2][0] - tri[0][0]) * (tri[1][1] - tri[0][1])
    if (Math.abs(det) < 1e-9) continue
    let res
    try {
      res = outside ? polygonClipping.difference([close(tri)], ...hits.map((h) => h.poly))
        : polygonClipping.intersection([close(tri)], polygonClipping.union(...hits.map((h) => h.poly)))
    } catch { if (outside) keep(); continue }
    const bary = ([x, z]) => {
      const l1 = ((x - tri[0][0]) * (tri[2][1] - tri[0][1]) - (tri[2][0] - tri[0][0]) * (z - tri[0][1])) / det
      const l2 = ((tri[1][0] - tri[0][0]) * (z - tri[0][1]) - (x - tri[0][0]) * (tri[1][1] - tri[0][1])) / det
      return [1 - l1 - l2, l1, l2]
    }
    const y = v[0][1], n = [N[t * 9], N[t * 9 + 1], N[t * 9 + 2]]
    for (const [outer, ...holes] of res) {
      const flat = [], hi = []
      for (const [x, z] of openRing(outer)) flat.push(x, z)
      for (const h of holes) { hi.push(flat.length / 2); for (const [x, z] of openRing(h)) flat.push(x, z) }
      const ids = earcut(flat, hi.length ? hi : undefined, 2)
      for (let i = 0; i < ids.length; i += 3) {
        let q = [ids[i], ids[i + 1], ids[i + 2]]
        const pq = q.map((k) => [flat[k * 2], flat[k * 2 + 1]])
        // the source triangle's winding (up-facing)
        const cr = (pq[1][0] - pq[0][0]) * (pq[2][1] - pq[0][1]) - (pq[2][0] - pq[0][0]) * (pq[1][1] - pq[0][1])
        if (Math.sign(cr) !== Math.sign(det)) q = [q[0], q[2], q[1]]
        for (const k of q) {
          const p = [flat[k * 2], flat[k * 2 + 1]], w = bary(p)
          out.positions.push(p[0], y, p[1]); out.normals.push(...n)
          out.uvs.push(w[0] * U[t * 6] + w[1] * U[t * 6 + 2] + w[2] * U[t * 6 + 4], w[0] * U[t * 6 + 1] + w[1] * U[t * 6 + 3] + w[2] * U[t * 6 + 5])
        }
      }
    }
  }
  return out
}

// The underside of a bridge ribbon where it crosses a sunken floor (seen from the Riverwalk): the part of each
// triangle over a zone, copied down to `y` and turned to face down.
export function soffitOver(m, zones, y) {
  const inside = cutMeshInside(m, zones), out = { positions: [], normals: [], uvs: [] }
  for (let t = 0; t < inside.positions.length / 9; t++) for (const k of [0, 2, 1]) {
    out.positions.push(inside.positions[t * 9 + k * 3], y, inside.positions[t * 9 + k * 3 + 2])
    out.normals.push(0, -1, 0); out.uvs.push(inside.uvs[t * 6 + k * 2], inside.uvs[t * 6 + k * 2 + 1])
  }
  return out
}

// ── River-front building skirts (D1-3) ──────────────────────────────────────────────────────────────────────────────
// A building whose footprint comes within SKIRT_M of the sunken water (or of a sunken floor) would otherwise float on
// the dockwall's lip: its ground-level pieces run down to the water (RIVER_Y − 0.5) or to the floor beside it.
export const SKIRT_M = 3
export function skirtBase(b, { waterIdx, zoneIdx = null, riverY, reach = SKIRT_M }) {
  let base = 0
  const pts = b.polygons.flatMap((p) => [p.outer, ...(p.holes ?? [])]).flatMap((r) => r.flatMap((a, i) => {
    const c = r[(i + 1) % r.length], n = Math.max(1, Math.ceil(Math.hypot(c[0] - a[0], c[1] - a[1]) / 2))
    return Array.from({ length: n }, (_, k) => [a[0] + ((c[0] - a[0]) * k) / n, a[1] + ((c[1] - a[1]) * k) / n])
  }))
  // an edge within reach of any point of the outline; or (rarely) the whole footprint out in the water or on the floor
  for (const pt of pts) {
    if (waterIdx.nearEdge(pt, reach)) return riverY - 0.5
    const z = zoneIdx?.nearEdge(pt, reach)
    if (z) base = Math.min(base, z.y)
  }
  if (pts.length && waterIdx.find(pts[0])) return riverY - 0.5
  const z = pts.length && zoneIdx?.find(pts[0])
  if (z) base = Math.min(base, z.y)
  return base
}
export function applySkirts(buildings, opts) {
  let n = 0
  for (const b of buildings) {
    if (!b.polygons?.length || !b.pieces?.length || b.source === 'park' || b.source === 'pond') continue
    const base = skirtBase(b, opts)
    if (base >= 0) continue
    b.skirtBase = base; n++
    b.pieces = b.pieces.map((p) => ((p.base ?? 0) <= 0.01 ? { ...p, base } : p))
  }
  return n
}

// ── Subway tubes under the river (D1-5) ─────────────────────────────────────────────────────────────────────────────
// Where a tube may dive to: under the sunken water (and DIP_MARGIN_M either side, the dockwall and the pier) the
// rail-top target is the nearest D0-3 river crossing's railY (levels.json tubeDips), else RIVER_Y − 15 m; within
// LOWER_REACH_M of a lower-deck crossing, that crossing's railY. Infinity elsewhere (the tube stays at SUBWAY_Y).
export const DIP_MARGIN_M = 8, CROSSING_REACH_M = 250, LOWER_REACH_M = 15
export function tubeDipTarget({ water, crossings, riverY }) {
  const idx = polyIndex(water)
  const river = crossings.filter((c) => c.kind === 'river'), lower = crossings.filter((c) => c.kind === 'lower')
  const nearWater = (pt) => Boolean(idx.near(pt, DIP_MARGIN_M))
  return (pt) => {
    let t = Infinity
    if (nearWater(pt)) {
      const c = river.map((q) => ({ q, d: Math.hypot(q.x - pt[0], q.z - pt[1]) })).filter((x) => x.d <= CROSSING_REACH_M).sort((a, b) => a.d - b.d)[0]
      t = c ? c.q.railY : riverY - 15
    }
    for (const q of lower) if (Math.hypot(q.x - pt[0], q.z - pt[1]) <= LOWER_REACH_M) t = Math.min(t, q.railY)
    return t
  }
}

// ── The river-corridor mask (D1-6) ──────────────────────────────────────────────────────────────────────────────────
// 40 m cells within `reach` of the river system, as row runs: the app's mirror plane sits at RIVER_Y while the view's
// target is in one, at the lake's plane elsewhere.
export const CORRIDOR = { cell: 40, reach: 90 }
export function corridorMask(sunk, bounds, { cell = CORRIDOR.cell, reach = CORRIDOR.reach } = {}) {
  const x0 = Math.floor(bounds.minX / cell) * cell, z0 = Math.floor(bounds.minZ / cell) * cell
  const cols = Math.ceil((bounds.maxX - x0) / cell), rows = Math.ceil((bounds.maxZ - z0) / cell)
  const on = new Uint8Array(cols * rows)
  const mark = (i, j) => { if (i >= 0 && j >= 0 && i < cols && j < rows) on[j * cols + i] = 1 }
  const centre = (i, j) => [x0 + (i + 0.5) * cell, z0 + (j + 0.5) * cell]
  for (const p of sunk) {
    for (const r of rings(p)) for (let k = 0; k < r.length; k++) {
      const a = r[k], b = r[(k + 1) % r.length]
      const i0 = Math.floor((Math.min(a[0], b[0]) - reach - x0) / cell), i1 = Math.floor((Math.max(a[0], b[0]) + reach - x0) / cell)
      const j0 = Math.floor((Math.min(a[1], b[1]) - reach - z0) / cell), j1 = Math.floor((Math.max(a[1], b[1]) + reach - z0) / cell)
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) if (segDist(centre(i, j), a, b) <= reach) mark(i, j)
    }
    const b = bboxOf(p)
    for (let i = Math.floor((b.minX - x0) / cell); i <= Math.floor((b.maxX - x0) / cell); i++) for (let j = Math.floor((b.minZ - z0) / cell); j <= Math.floor((b.maxZ - z0) / cell); j++) {
      if (i < 0 || j < 0 || i >= cols || j >= rows || on[j * cols + i]) continue
      if (inPoly(centre(i, j), p)) mark(i, j)
    }
  }
  const runs = []
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    if (!on[j * cols + i]) continue
    let e = i
    while (e + 1 < cols && on[j * cols + e + 1]) e++
    runs.push(j, i, e)
    i = e
  }
  return { cell, x0, z0, cols, rows, runs }
}
// the same lookup the app does (app/src/lib/levels.js inCorridor)
export function inCorridor(mask, x, z) {
  const i = Math.floor((x - mask.x0) / mask.cell), j = Math.floor((z - mask.z0) / mask.cell)
  for (let k = 0; k < mask.runs.length; k += 3) if (mask.runs[k] === j && i >= mask.runs[k + 1] && i <= mask.runs[k + 2]) return true
  return false
}

// Simplified outlines for the manifest's levels block (the app's sunken-floor and corridor lookups)
export const ringArea = (r) => Math.abs(signedArea(r))
