// pipeline/lib/traffic.js — the drivable road graph for the traffic sim (user, 2026-09-30: cars, buses and trucks,
// traffic lights). OSM road ways split at shared nodes into edges between junctions, with each edge's class, lanes each
// way and geometry. Tunnels, service roads and private ways are left out: nothing drives where the world can't show
// it. D3-1: the multi-level streets (Lower Wacker, Lower Michigan, Lower Columbus … — lowerLevels.js) are driven too,
// at their decks' heights, climbing their ramps to the street; only the pieces lower-levels.json draws whole. Written
// as one compact integer array (metres; heights in centimetres) so the world stays in budget.
import { MOUTH_Y, segmentProfile } from './lowerLevels.js'
export const CLASSES = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'local', 'link']
const CLASS_OF = { motorway: 0, trunk: 1, primary: 2, secondary: 3, tertiary: 4, unclassified: 5, residential: 5, motorway_link: 6, trunk_link: 6, primary_link: 6, secondary_link: 6, tertiary_link: 6 }
// lanes each way when OSM doesn't say: [two-way road, one-way carriageway]
const DEFAULT_LANES = [[3, 3], [2, 3], [2, 3], [2, 2], [1, 2], [1, 1], [1, 1]]

// a street-level way's class (-1: not driven). `lower`: the way is one of the multi-level streets lower-levels.json
// draws, so its tunnel and layer tags don't rule it out
export function trafficClass(t = {}, lower = false) {
  const c = CLASS_OF[t.highway]
  if (c === undefined) return -1
  if (!lower && ((t.tunnel && t.tunnel !== 'no') || parseInt(t.layer ?? '0', 10) < 0)) return -1
  if (/^(no|private)$/.test(t.access ?? '') || /^(no|private)$/.test(t.motor_vehicle ?? '') || t.area === 'yes') return -1
  return c
}

// lanes in the way's own direction and against it (0: one-way)
export function lanesOf(t = {}, cls) {
  const ow = t.oneway === 'yes' || t.oneway === '1' || t.oneway === '-1' || t.junction === 'roundabout' || cls === 0
  const n = parseInt(t.lanes ?? '', 10), [two, one] = DEFAULT_LANES[cls]
  const clamp = (v) => Math.max(1, Math.min(5, v))
  if (ow) return { fwd: clamp(n > 0 ? n : one), back: 0, reverse: t.oneway === '-1' }
  const f = parseInt(t['lanes:forward'] ?? '', 10), b = parseInt(t['lanes:backward'] ?? '', 10)
  if (f > 0 && b > 0) return { fwd: clamp(f), back: clamp(b), reverse: false }
  const each = n > 1 ? clamp(Math.floor(n / 2)) : two
  return { fwd: each, back: each, reverse: false }
}

export const TRAFFIC_VERSION = 2
export const LOWER_FLAG = 8 // an edge's class byte | 8: a lower-level edge (its points carry heights, plus a deck width)
const DEEP_M = 0.5 // a vertex this far under the street is on a lower level: it never joins a street way passing over it
export const MAX_DRIVE_GRADE = 0.25 // a real ramp climbs 8 %; the deck profile steepens a short last piece (Lake St's exit: 22 %) — beyond this it isn't driven
export const maxGrade = (pts) => {
  let g = 0
  for (let i = 1; i < pts.length; i++) g = Math.max(g, Math.abs(pts[i][2] - pts[i - 1][2]) / Math.max(0.01, Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])))
  return g
}

// ways: OSM elements with nodes + geometry. lower: lowerLevels.js lowerProfile() (null: the street level only, as v1).
// Returns { nodes: [[x, z, y]], edges: [{ a, b, cls, fwd, back, pts: [[x, z, y]…], w }] } where pts runs a → b and
// includes both ends, y is the roadway's height over the street's road ribbon (0 on the street, −5.2 on Lower Wacker)
// and w (lower edges only) the deck's width.
export function buildRoadGraph(ways, project, lower = null) {
  const keep = []
  for (const w of ways) {
    const info = lower?.ways.get(w.id) ?? null
    if (info && !lower.drawn.has(w.id)) continue // a lower way with no deck drawn (over a tube, over water): not driven
    const cls = trafficClass(w.tags, Boolean(info))
    if (cls < 0 || !w.nodes || !w.geometry || w.nodes.length !== w.geometry.length || w.nodes.length < 2) continue
    const xz = w.geometry.map((p) => project(p.lon, p.lat))
    const ys = info ? info.h.map((h) => h - MOUTH_Y) : null
    // a deep vertex is its own node: the street passing over it at the same OSM node doesn't connect to it
    const keys = w.nodes.map((n, i) => (ys && ys[i] < -DEEP_M ? `${n}@${Math.round(ys[i])}` : `${n}`))
    keep.push({ w, cls, xz, ys, keys, info })
  }
  const use = new Map()
  for (const { keys } of keep) keys.forEach((k, i) => use.set(k, (use.get(k) ?? 0) + (i === 0 || i === keys.length - 1 ? 2 : 1)))
  const nodeIdx = new Map(), nodes = []
  const nodeOf = (k, p, y) => { if (!nodeIdx.has(k)) { nodeIdx.set(k, nodes.length); nodes.push([p[0], p[1], y]) } return nodeIdx.get(k) }
  const edges = []
  for (const { w, cls, xz, ys, keys, info } of keep) {
    const l = lanesOf(w.tags, cls)
    let start = 0
    for (let i = 1; i < keys.length; i++) {
      if (i < keys.length - 1 && (use.get(keys[i]) ?? 0) < 2) continue
      let seg
      if (!info) seg = xz.slice(start, i + 1).map(([x, z]) => [x, z, 0])
      else {
        // the ramp's knees (where it reaches its level) become points of their own
        seg = [[xz[start][0], xz[start][1], ys[start]]]
        const levelY = lower.levelY[info.level] - MOUTH_Y
        for (let k = start + 1; k <= i; k++) for (const q of segmentProfile(xz[k - 1], xz[k], ys[k - 1], ys[k], levelY, lower.grade).slice(1)) seg.push(q)
      }
      // a ramp the deck profile had to steepen (it meets a junction before it is down) is too steep to drive
      if (info && maxGrade(seg) > MAX_DRIVE_GRADE) { start = i; continue }
      let a = nodeOf(keys[start], xz[start], ys ? ys[start] : 0), b = nodeOf(keys[i], xz[i], ys ? ys[i] : 0)
      if (l.reverse) { [a, b] = [b, a]; seg.reverse() }
      if (a !== b) edges.push({ a, b, cls, fwd: l.fwd, back: l.back, pts: seg, ...(info ? { w: info.width } : {}) })
      start = i
    }
  }
  return { nodes, edges }
}

// v2: [2, nodeCount, x0, z0, …, liftedCount, (node, y cm)…, edgeCount, then per edge: a, b, cls (| LOWER_FLAG), fwd,
// back, k, (lower: deck width dm), k-2 interior points as x, z (lower: x, z, y cm)] in whole metres (int16 range: the
// world is ±32 km). Only the nodes off the street carry a height (most are on it). v1 (no heights) is the same without
// the lifted list, flags and heights.
export function encodeRoadGraph({ nodes, edges }) {
  const out = [TRAFFIC_VERSION, nodes.length]
  const r = (v) => Math.round(v) || 0 // no -0
  const cm = (y) => Math.round(y * 100) || 0
  for (const [x, z] of nodes) out.push(r(x), r(z))
  const lifted = nodes.map((n, i) => [i, cm(n[2] ?? 0)]).filter(([, y]) => y !== 0)
  out.push(lifted.length)
  for (const [i, y] of lifted) out.push(i, y)
  out.push(edges.length)
  for (const e of edges) {
    const inner = e.pts.slice(1, -1), low = e.w != null
    out.push(e.a, e.b, e.cls | (low ? LOWER_FLAG : 0), e.fwd, e.back, inner.length)
    if (low) out.push(Math.round(e.w * 10))
    for (const p of inner) { out.push(r(p[0]), r(p[1])); if (low) out.push(cm(p[2] ?? 0)) }
  }
  return out
}

// the ways the graph is built from: the street level's road ways (build-world's ribbons) plus the lower ways whose deck
// lower-levels.json draws (they are not in the ribbons), in cache order so the build is deterministic
export function trafficRoads(streetRoads, allRoads, lower) {
  if (!lower) return streetRoads
  const have = new Set(streetRoads.map((e) => e.id))
  return [...streetRoads, ...allRoads.filter((e) => e.geometry && lower.drawn.has(e.id) && !have.has(e.id))]
}
