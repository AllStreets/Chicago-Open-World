// pipeline/lib/lowerLevels.js — Workstream D2-1: Chicago's multi-level streets as compact centrelines for the app.
// Lower Wacker, Lower Michigan, Lower Columbus, Lower (and Lower Lower) Randolph, Lake, South Water, Stetson, Field …
// are OSM ways the street-level world never draws (layer < 0 or tunnel). Here they become { level, width, [x, z, y] }
// polylines: level 1 at LOWER_Y (−5.1 m, the real Lower Wacker roadway), level 2 at LOWER2_Y (−9.5 m, the third level
// under the Illinois Center grid), with the ramps where they meet the street (or the level above) climbing at a real
// ramp grade. The app builds the decks, columns and lights from this (app/src/world/LowerLevels.jsx), so the world's
// tiles don't change by a byte. Pure: build-world.js and build/build-lower-levels.js call buildLowerLevels.
import { project } from '../../shared/project.js'
import { pointInRing } from './geom.js'
import { ROAD_WIDTHS } from './ground.js'
import { LOWER_ZONE } from './levels.js'

export const LOWER_LEVELS_FILE = 'lower-levels.json'
export const LOWER_LEVELS_VERSION = 1
export const RAMP_GRADE = 0.08 // Lower Wacker's ramps climb at ≈ 6–8 % (a 5 m rise in ≈ 65 m)
export const MOUTH_Y = 0.12 // a ramp meets the street on the road ribbon (pipeline GROUND_Y.roads)
export const COLUMN_M = 9.75 // Lower Wacker's column bays: 32 ft (D0 findings)
export const MAX_BYTES = 150_000

const DRIVABLE = new Set(Object.keys(ROAD_WIDTHS))
const LOWER_RE = /\bLower\b/
const LOWER2_RE = /\bLower Lower\b/
const inZone = (g) => g.length > 1 && g.every((p) => p.lat >= LOWER_ZONE.s && p.lat <= LOWER_ZONE.n && p.lon >= LOWER_ZONE.w && p.lon <= LOWER_ZONE.e)

// Which ways are a lower street: inside the downtown multi-level zone (outside it, layer < 0 is a rail underpass or an
// expressway trench, never a deck), drivable, and either below the street (layer < 0) or named "Lower …" (Lower
// Michigan is mapped as a layer-0 tunnel; a stretch of Lower Wacker as a layer-1 bridge over the level below). Not:
// a building passage (a street through a building's ground floor, at grade) or a movable bridge (bridges.js draws
// the bascules' lower decks).
export function isLowerWay(el) {
  const t = el.tags || {}
  if (!DRIVABLE.has(t.highway) || !inZone(el.geometry || [])) return false
  if (t.tunnel === 'building_passage' || t.bridge === 'movable') return false
  return Number(t.layer) < 0 || LOWER_RE.test(t.name ?? '')
}

// The level a lower way runs on: "Lower Lower …" is the third level; a `level` tag is absolute (Lower Randolph is
// layer −2 but level −1); otherwise layer −1 is the Lower Wacker level and anything deeper the third level. Ways named
// "Lower …" with a layer ≥ 0 are on the Lower Wacker level.
export function levelOf(tags = {}) {
  const name = tags.name ?? ''
  if (LOWER2_RE.test(name)) return 2
  const lv = Number(tags.level)
  if (Number.isFinite(lv) && lv < 0) return Math.min(2, -lv)
  const layer = Number(tags.layer)
  if (Number.isFinite(layer) && layer < 0) return layer <= -2 ? 2 : 1
  return LOWER_RE.test(name) ? 1 : 0
}

// the level of a way that is NOT a lower street, seen from a lower way's end: a movable bridge's lower deck (DuSable's
// is Lower Michigan) is on the lower level; everything else is the street
const neighbourLevel = (tags = {}) => (LOWER2_RE.test(tags.name ?? '') ? 2 : LOWER_RE.test(tags.name ?? '') ? 1 : 0)

export function widthOf(tags = {}) {
  const lanes = Number(tags.lanes)
  return Number.isFinite(lanes) && lanes > 0 ? Math.max(lanes * 3.3, 5) : ROAD_WIDTHS[tags.highway] ?? 6
}

const r1 = (v) => Math.round(v * 10) / 10 || 0

// Heights along the network: a "mouth" is a lower way's end node shared only with higher ways (the street, or the
// level above); from each mouth the roadway falls at RAMP_GRADE until it reaches its level. Max-plus Dijkstra over the
// same-level network: h(n) = max(levelY, max over mouths (mouthY − grade · distance)).
function heights(ways, levelY, grade, nodeY) {
  const adj = new Map(), h = new Map()
  const link = (a, b, d) => { if (!adj.has(a)) adj.set(a, []); adj.get(a).push([b, d]) }
  for (const w of ways) for (let i = 1; i < w.nodes.length; i++) {
    const d = Math.hypot(w.pts[i][0] - w.pts[i - 1][0], w.pts[i][1] - w.pts[i - 1][1])
    link(w.nodes[i - 1], w.nodes[i], d); link(w.nodes[i], w.nodes[i - 1], d)
  }
  // a junction of the lower network (three or more ways meet) stays on its level: a ramp has to be down by then, so
  // a side ramp never lifts the main roadway into a hump (Lower Wacker stays at LOWER_Y under Columbus)
  const junction = (n) => new Set((adj.get(n) ?? []).map(([m]) => m)).size >= 3
  const heap = []
  for (const [n, y] of nodeY) if (y > levelY) { h.set(n, y); heap.push([y, n]) }
  // a sorted frontier is plenty for a few thousand nodes; ties break on the node id (deterministic)
  while (heap.length) {
    heap.sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? 1 : -1))
    const [y, n] = heap.pop()
    if (y < h.get(n)) continue
    for (const [m, d] of adj.get(n) ?? []) {
      if (junction(m) && !nodeY.has(m)) continue
      const v = y - grade * d
      if (v > levelY && v > (h.get(m) ?? levelY)) { h.set(m, v); heap.push([v, m]) }
    }
  }
  return h
}

// y along one segment: max(level, hA − g·s, hB − g·(len − s)), with its knees as extra points. A ramp that reaches a
// junction (pinned to its level) before it is down simply steepens over its last segment, so it always meets it.
export function segmentProfile(a, b, ha, hb, levelY, grade) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  if (ha - grade * len > hb + 1e-6 || hb - grade * len > ha + 1e-6) return [[a[0], a[1], ha], [b[0], b[1], hb]]
  const y = (s) => Math.max(levelY, ha - grade * s, hb - grade * (len - s))
  const cuts = new Set([0, len])
  const k1 = (ha - levelY) / grade, k2 = len - (hb - levelY) / grade, peak = (ha - hb + grade * len) / (2 * grade)
  for (const s of [k1, k2, peak]) if (s > 0.5 && s < len - 0.5) cuts.add(s)
  return [...cuts].sort((p, q) => p - q).map((s) => [a[0] + ((b[0] - a[0]) * s) / (len || 1), a[1] + ((b[1] - a[1]) * s) / (len || 1), y(s)])
}

// roads: OSM way elements (with `nodes` and `geometry`) — every drivable road, so the ramp mouths can be found.
// levels: levels.json `levels`. water: rings ([[x, z]…]) of the sunken river — no deck is laid over open water.
// tracks: transit.json route paths ([[x, y, z]…]); tubeClear: the tubes' ceiling over rail top (levels.json tubeDips).
export function buildLowerLevels({ roads, levels, water = [], tracks = [], tubeClear = 4.2, grade = RAMP_GRADE }) {
  const levelY = { 1: levels.LOWER_Y, 2: levels.LOWER2_Y }
  const lower = roads.filter(isLowerWay).sort((a, b) => a.id - b.id)
  const lowerIds = new Set(lower.map((e) => e.id))
  // every drivable way through each node: the street (or a bridge's lower deck) a lower way's end climbs to
  const at = new Map()
  for (const e of roads) {
    if (!e.nodes || !DRIVABLE.has(e.tags?.highway)) continue
    for (const n of e.nodes) { if (!at.has(n)) at.set(n, []); at.get(n).push(e) }
  }
  const ways = lower.map((e) => ({ e, level: levelOf(e.tags), nodes: e.nodes, pts: e.geometry.map((p) => project(p.lon, p.lat)) }))
  const nodeH = new Map() // node → y, level 1 first, so a level-2 ramp climbs to wherever the level above is
  for (const L of [1, 2]) {
    const mine = ways.filter((w) => w.level === L), mouths = new Map()
    for (const w of mine) for (const n of [w.nodes[0], w.nodes[w.nodes.length - 1]]) {
      const others = (at.get(n) ?? []).filter((o) => o.id !== w.e.id)
      if (!others.length) continue // a dead end (a garage door, a loading dock): stays on its level
      const ys = others.map((o) => (lowerIds.has(o.id) ? (nodeH.get(n) ?? levelY[levelOf(o.tags)]) : neighbourLevel(o.tags) ? levelY[neighbourLevel(o.tags)] : MOUTH_Y))
      if (ys.some((y) => y <= levelY[L] + 1e-6)) continue // the same level (or deeper) meets here: a junction, not a ramp
      mouths.set(n, Math.max(mouths.get(n) ?? -Infinity, Math.min(...ys)))
    }
    const h = heights(mine, levelY[L], grade, mouths)
    for (const w of mine) for (const n of w.nodes) nodeH.set(n, Math.max(nodeH.get(n) ?? -Infinity, h.get(n) ?? levelY[L]))
    for (const w of mine) w.h = w.nodes.map((n) => h.get(n) ?? levelY[L])
  }
  const boxes = water.map((r) => r.reduce((b, [x, z]) => [Math.min(b[0], x), Math.min(b[1], z), Math.max(b[2], x), Math.max(b[3], z)], [Infinity, Infinity, -Infinity, -Infinity]))
  const overWater = (p) => water.some((r, i) => p[0] >= boxes[i][0] && p[0] <= boxes[i][2] && p[1] >= boxes[i][1] && p[1] <= boxes[i][3] && pointInRing(p, r))
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
  const out = []
  for (const w of ways) {
    // split where the line runs over open water (it never should: the bascules carry the lower roadways across)
    let run = [], inRun = false
    const flush = () => { const p = dedupe(run); if (p.length > 1) out.push({ id: w.e.id, n: w.e.tags.name ?? null, lv: w.level, w: widthOf(w.e.tags), p }); run = []; inRun = false }
    const push = (p) => run.push([r1(p[0]), r1(p[1]), r1(p[2])])
    for (let i = 1; i < w.pts.length; i++) {
      const prof = segmentProfile(w.pts[i - 1], w.pts[i], w.h[i - 1], w.h[i], levelY[w.level], grade)
      for (let k = 1; k < prof.length; k++) {
        const a = prof[k - 1], b = prof[k], n = water.length ? Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2)) : 1
        // sample every ≤ 2 m; only the edges of a wet stretch become points
        for (let s = 0; s < n; s++) {
          const p0 = lerp3(a, b, s / n), wet = water.length > 0 && overWater(lerp3(a, b, (s + 0.5) / n))
          if (!wet && !inRun) { push(p0); inRun = true }
          else if (wet && inRun) { push(p0); flush() }
        }
        if (inRun) push(b)
      }
    }
    flush()
  }
  // A lower way that would sit on a below-grade railway (the service drives at Union Station's track level: the
  // tracks already are that level) is left out, so no deck ever runs into a subway tube or a Metra platform.
  const keep = tracks.length ? out.filter((w) => !hitsTrack(w, tracks, tubeClear, levels.SLAB_M)) : out
  return {
    v: LOWER_LEVELS_VERSION,
    y: { 1: levels.LOWER_Y, 2: levels.LOWER2_Y }, slab: levels.SLAB_M, clear: levels.CLEAR_M, columnM: COLUMN_M, grade,
    ways: keep,
  }
}

// does a deck piece come within 1 m (vertically, under its slab) of a below-grade track's tube ceiling inside its
// footprint? tracks: [[x, y, z]…] per route (transit.json route paths: rail-top y)
export function hitsTrack(w, tracks, clear, slab) {
  const half = w.w / 2 + 1
  const box = w.p.reduce((b, [x, z]) => [Math.min(b[0], x - half), Math.min(b[1], z - half), Math.max(b[2], x + half), Math.max(b[3], z + half)], [Infinity, Infinity, -Infinity, -Infinity])
  for (const path of tracks) for (const [x, y, z] of path) {
    if (y > -4 || x < box[0] || x > box[2] || z < box[1] || z > box[3]) continue
    for (let i = 1; i < w.p.length; i++) {
      const a = w.p[i - 1], b = w.p[i], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1
      const u = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2))
      if (Math.hypot(x - a[0] - u * dx, z - a[1] - u * dz) > half) continue
      if (y + clear >= a[2] + u * (b[2] - a[2]) - slab - 1) return true
    }
  }
  return false
}
const dedupe = (pts) => pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1])

// The flag (plan §4.5 fallback): LEVELS_LOWER=0 builds without the lower streets; the manifest then has no
// `levels.lower` and the app draws nothing under the street — exactly the world before D2.
export const lowerLevelsOn = (data, env = {}) => Boolean(data?.levels?.LOWER_Y != null && data?.levels?.LOWER2_Y != null && env.LEVELS_LOWER !== '0')

// the manifest entry the app reads (app/src/lib/levels.js readLevels → levels.lower)
export const lowerManifestEntry = (json) => ({ file: LOWER_LEVELS_FILE, y: json.y[1], y2: json.y[2] })

// the named streets (for tests and the README)
export function streetsIn(json) {
  const names = new Set()
  for (const w of json.ways) if (w.n) names.add(w.n)
  return [...names].sort()
}
