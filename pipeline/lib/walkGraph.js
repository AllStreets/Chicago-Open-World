// pipeline/lib/walkGraph.js — the walkable path network (2026-09-30), for the walking-routes mode to come: park paths,
// trails, the Riverwalk, plazas' walkways, steps and footbridges, split at shared nodes into edges between junctions.
// Bridges and underpasses stay in the graph (you can walk them) though the ground doesn't draw them. Street sidewalks
// aren't fetched, so the graph is the off-street network. Compact JSON in whole metres:
// { version, surfaces, nodes: [x0, z0, …], edges: [a, b, surface, lengthM, k, x, z × k interior points, …] }
import { WALK_SURFACES, pathSurface, isPavingArea } from './paving.js'

const WALKABLE = /^(footway|path|pedestrian|steps|cycleway)$/
export const isWalkable = (t = {}) => WALKABLE.test(t.highway ?? '') && !isPavingArea(t) && t.access !== 'private' && t.access !== 'no' && t.foot !== 'no'
// the surface for the graph: as drawn, or (for a bridge or tunnel the ground doesn't draw) from the surface tag
const surfaceFor = (t) => pathSurface(t) ?? pathSurface({ ...t, bridge: undefined, tunnel: undefined, layer: undefined, covered: undefined, indoor: undefined }) ?? 'concrete'

// Douglas–Peucker on the interior points (the ends stay)
function simplify(pts, tol) {
  if (pts.length <= 2) return pts
  const [a, b] = [pts[0], pts.at(-1)], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1
  let worst = 0, at = -1
  for (let i = 1; i < pts.length - 1; i++) { const d = Math.abs((pts[i][0] - a[0]) * dz - (pts[i][1] - a[1]) * dx) / L; if (d > worst) { worst = d; at = i } }
  return worst <= tol ? [a, b] : [...simplify(pts.slice(0, at + 1), tol).slice(0, -1), ...simplify(pts.slice(at), tol)]
}

export function buildWalkGraph(ways, project, tol = 1.5) {
  const use = new Map(), keep = []
  for (const w of ways) {
    if (w.type !== 'way' || !isWalkable(w.tags) || !w.nodes || !w.geometry || w.nodes.length !== w.geometry.length || w.nodes.length < 2) continue
    keep.push(w)
    w.nodes.forEach((n, i) => use.set(n, (use.get(n) ?? 0) + (i === 0 || i === w.nodes.length - 1 ? 2 : 1)))
  }
  const idx = new Map(), nodes = [], edges = []
  const nodeOf = (id, p) => { if (!idx.has(id)) { idx.set(id, nodes.length); nodes.push(project(p.lon, p.lat)) } return idx.get(id) }
  for (const w of keep) {
    const surface = WALK_SURFACES.indexOf(surfaceFor(w.tags))
    let start = 0
    for (let i = 1; i < w.nodes.length; i++) {
      if (i < w.nodes.length - 1 && (use.get(w.nodes[i]) ?? 0) < 2) continue
      const pts = w.geometry.slice(start, i + 1).map((p) => project(p.lon, p.lat))
      const a = nodeOf(w.nodes[start], w.geometry[start]), b = nodeOf(w.nodes[i], w.geometry[i])
      let len = 0
      for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1])
      if (a !== b && len > 0.5) edges.push({ a, b, surface, len, pts: simplify(pts, tol) })
      start = i
    }
  }
  return { nodes, edges }
}

export function encodeWalkGraph({ nodes, edges }) {
  const r = (v) => Math.round(v) || 0
  const flatEdges = []
  for (const e of edges) {
    const inner = e.pts.slice(1, -1)
    flatEdges.push(e.a, e.b, e.surface, Math.max(1, Math.round(e.len)), inner.length)
    for (const [x, z] of inner) flatEdges.push(r(x), r(z))
  }
  return { version: 1, surfaces: WALK_SURFACES, units: 'm', nodes: nodes.flatMap(([x, z]) => [r(x), r(z)]), edges: flatEdges }
}
