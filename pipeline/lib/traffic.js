// pipeline/lib/traffic.js — the drivable road graph for the traffic sim (user, 2026-09-30: cars, buses and trucks,
// traffic lights). OSM road ways split at shared nodes into edges between junctions, with each edge's class, lanes each
// way and geometry. Tunnels, Lower Wacker (layer < 0), service roads and private ways are left out: nothing drives
// where the ground can't show it. Written as one compact integer array (metres) so the world stays in budget.
export const CLASSES = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'local', 'link']
const CLASS_OF = { motorway: 0, trunk: 1, primary: 2, secondary: 3, tertiary: 4, unclassified: 5, residential: 5, motorway_link: 6, trunk_link: 6, primary_link: 6, secondary_link: 6, tertiary_link: 6 }
// lanes each way when OSM doesn't say: [two-way road, one-way carriageway]
const DEFAULT_LANES = [[3, 3], [2, 3], [2, 3], [2, 2], [1, 2], [1, 1], [1, 1]]

export function trafficClass(t = {}) {
  const c = CLASS_OF[t.highway]
  if (c === undefined) return -1
  if ((t.tunnel && t.tunnel !== 'no') || parseInt(t.layer ?? '0', 10) < 0) return -1
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

// ways: OSM elements with nodes + geometry. Returns { nodes: [[x, z]], edges: [{ a, b, cls, fwd, back, pts }] }
// where pts runs a → b and includes both ends.
export function buildRoadGraph(ways, project) {
  const use = new Map(), keep = []
  for (const w of ways) {
    const cls = trafficClass(w.tags)
    if (cls < 0 || !w.nodes || !w.geometry || w.nodes.length !== w.geometry.length || w.nodes.length < 2) continue
    keep.push({ w, cls })
    w.nodes.forEach((n, i) => use.set(n, (use.get(n) ?? 0) + (i === 0 || i === w.nodes.length - 1 ? 2 : 1)))
  }
  const nodeIdx = new Map(), nodes = []
  const nodeOf = (id, p) => { if (!nodeIdx.has(id)) { nodeIdx.set(id, nodes.length); nodes.push(project(p.lon, p.lat)) } return nodeIdx.get(id) }
  const edges = []
  for (const { w, cls } of keep) {
    const l = lanesOf(w.tags, cls)
    let start = 0
    for (let i = 1; i < w.nodes.length; i++) {
      if (i < w.nodes.length - 1 && (use.get(w.nodes[i]) ?? 0) < 2) continue
      const seg = w.geometry.slice(start, i + 1).map((p) => project(p.lon, p.lat))
      let a = nodeOf(w.nodes[start], w.geometry[start]), b = nodeOf(w.nodes[i], w.geometry[i])
      if (l.reverse) { [a, b] = [b, a]; seg.reverse() }
      if (a !== b) edges.push({ a, b, cls, fwd: l.fwd, back: l.back, pts: seg })
      start = i
    }
  }
  return { nodes, edges }
}

// [version, nodeCount, x0, z0, …, edgeCount, then per edge: a, b, cls, fwd, back, k, k-2 interior points as x, z]
// in whole metres (int16 range: the world is ±32 km)
export function encodeRoadGraph({ nodes, edges }) {
  const out = [1, nodes.length]
  const r = (v) => Math.round(v) || 0 // no -0
  for (const [x, z] of nodes) out.push(r(x), r(z))
  out.push(edges.length)
  for (const e of edges) {
    const inner = e.pts.slice(1, -1)
    out.push(e.a, e.b, e.cls, e.fwd, e.back, inner.length)
    for (const [x, z] of inner) out.push(r(x), r(z))
  }
  return out
}
