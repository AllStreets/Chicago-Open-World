// pipeline/lib/rides.js — Ride the city's data (P7): CTA bus routes from OpenStreetMap route=bus relations, and the
// curated walks, checked never to pass through a building. Output is compact (whole metres) for app/src/data/rides.json.
import { pointInRing } from './geom.js'

const key = (p) => `${p.lat.toFixed(7)},${p.lon.toFixed(7)}`
const near = (a, b) => Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lon - b.lon) < 1e-6

// A relation's ways in member order, each flipped where needed so the chain runs end to end; a gap starts a new piece.
export function chainWays(ways) {
  const pieces = []
  let cur = null, single = false
  for (const w of ways) {
    let g = w.geometry ?? w
    if (!g?.length) continue
    if (cur) {
      // the first way of a piece may itself be backwards: flip it once if the next way meets its start
      if (single && !near(cur.at(-1), g[0]) && !near(cur.at(-1), g.at(-1)) && (near(cur[0], g[0]) || near(cur[0], g.at(-1)))) cur.reverse()
      const end = cur.at(-1)
      if (near(end, g[0])) { cur.push(...g.slice(1)); single = false; continue }
      if (near(end, g.at(-1))) { cur.push(...[...g].reverse().slice(1)); single = false; continue }
      pieces.push(cur)
    }
    cur = [...g]; single = true
  }
  if (cur) pieces.push(cur)
  return pieces.map((p) => p.filter((q, i) => i === 0 || key(q) !== key(p[i - 1])))
}

// the longest run of a projected polyline inside the box
export function clipToBox(pts, { minX, maxX, minZ, maxZ }) {
  let best = [], run = []
  const inside = ([x, z]) => x >= minX && x <= maxX && z >= minZ && z <= maxZ
  for (const p of pts) {
    if (inside(p)) run.push(p)
    else { if (run.length > best.length) best = run; run = [] }
  }
  return run.length > best.length ? run : best
}

export function polyLength(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L }

export function projectOnto(pts, [x, z]) {
  let best = Infinity, bestS = 0, acc = 0
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz, l = Math.sqrt(l2)
    const f = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0
    const d = Math.hypot(ax + dx * f - x, az + dz * f - z)
    if (d < best) { best = d; bestS = acc + l * f }
    acc += l
  }
  return { s: bestS, d: best }
}

const round = (pts) => pts.map(([x, z]) => [Math.round(x) + 0, Math.round(z) + 0]) // + 0: no -0 in the JSON
// Douglas–Peucker, ends kept
export function simplify(pts, tol) {
  if (pts.length <= 2) return pts
  const [a, b] = [pts[0], pts.at(-1)], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1
  let worst = 0, at = -1
  for (let i = 1; i < pts.length - 1; i++) { const d = Math.abs((pts[i][0] - a[0]) * dz - (pts[i][1] - a[1]) * dx) / L; if (d > worst) { worst = d; at = i } }
  return worst <= tol ? [a, b] : [...simplify(pts.slice(0, at + 1), tol).slice(0, -1), ...simplify(pts.slice(at), tol)]
}

// One relation → { id, ref, name, from, to, path, stops } (or null when too little of it is in the world)
export function busRide(rel, project, box, { minM = 1500, stopM = 25 } = {}) {
  const ways = (rel.members ?? []).filter((m) => m.type === 'way' && (m.role === '' || m.role === 'forward' || m.role === 'backward') && m.geometry)
  const pieces = chainWays(ways).map((p) => clipToBox(p.map((q) => project(q.lon, q.lat)), box))
  const pts = pieces.reduce((a, b) => (polyLength(b) > polyLength(a) ? b : a), [])
  if (pts.length < 2 || polyLength(pts) < minM) return null
  const path = round(simplify(pts, 1.5))
  const seen = new Set(), stops = []
  for (const m of rel.members ?? []) {
    if (m.type !== 'node' || !/stop|platform/.test(m.role ?? '') || m.lat == null) continue
    const name = m.tags?.name
    if (!name || seen.has(name)) continue
    const at = projectOnto(path, project(m.lon, m.lat))
    if (at.d > stopM) continue
    seen.add(name); stops.push({ name, s: Math.round(at.s) })
  }
  stops.sort((a, b) => a.s - b.s)
  const tags = rel.tags ?? {}
  const label = String(tags.name ?? '').replace(/^Bus\s+\w+:?\s*/, '')
  const [from, to] = label.split(/\s*(?:->|→)\s*/)
  return { id: `${tags.ref}-${rel.id}`, ref: tags.ref, name: label.replace(/\s*->\s*/, ' → '), from: from ?? null, to: to ?? null, path, stops, sources: [`https://www.openstreetmap.org/relation/${rel.id}`] }
}

// Every 2 m sample of a walk outside every building footprint (holes — courtyards — are open ground).
export function walkSamplesClear(path, footprintsNear, stepM = 2) {
  const bad = []
  for (let i = 1; i < path.length; i++) {
    const [ax, az] = path[i - 1], [bx, bz] = path[i], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / stepM))
    for (let k = 0; k <= n; k++) {
      const p = [ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]
      for (const b of footprintsNear(p[0], p[1])) {
        for (const poly of b.polygons ?? [{ outer: b.outer, holes: b.holes ?? [] }]) {
          if (pointInRing(p, poly.outer) && !(poly.holes ?? []).some((h) => pointInRing(p, h))) { bad.push({ p: p.map(Math.round), id: b.id, name: b.name ?? null }); break }
        }
      }
    }
  }
  return bad
}

export function walkRide(w, project) {
  const path = round(w.waypoints.map(([lat, lon]) => project(lon, lat)))
  const sights = (w.sights ?? []).map((s) => { const [x, z] = project(s.lon, s.lat); return { name: s.name, x: Math.round(x), z: Math.round(z) } })
  return { id: w.id, name: w.name, blurb: w.blurb, from: w.from, to: w.to, graph: Boolean(w.graph), path, sights, sources: w.sources ?? [] }
}
