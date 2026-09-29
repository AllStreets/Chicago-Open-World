// pipeline/lib/bridges.js — Chicago's river bascules: OSM movable ways → named bridges (data/bridges.json),
// ribbon cuts so each crossing draws ONE deck, then trunnion leaves, pits, tender/bridge houses and lights.
import { project } from '../../shared/project.js'
import { roadHalfWidth } from './ground.js'
import { add2, sub2, mul2, dot2, len2, norm2, left, bearing } from './meshkit.js'

export const isMovableBridge = (tags = {}) => {
  const kind = tags['bridge:movable']
  if (kind) return kind === 'bascule'
  return tags.bridge === 'movable'
}

const mid = (pts) => mul2(add2(pts[0], pts[pts.length - 1]), 0.5)
export const lenOf = (pts) => pts.slice(1).reduce((s, p, i) => s + len2(sub2(p, pts[i])), 0)
const canonical = (a) => (a[1] > 1e-9 || (Math.abs(a[1]) <= 1e-9 && a[0] < 0) ? mul2(a, -1) : a)

function resolveBridge(e, c, ways) {
  const roads = ways.filter((w) => w.tags.highway)
  const longest = [...(roads.length ? roads : ways)].sort((a, b) => lenOf(b.points) - lenOf(a.points))[0]
  let axis
  if (e.bearing != null) axis = bearing(e.bearing)
  else if (longest) axis = norm2(sub2(longest.points.at(-1), longest.points[0]))
  else throw new Error(`bridge ${e.key} matched no OSM way and has no bearing — fix data/bridges.json`)
  const centre = ways.length ? mul2(ways.reduce((s, w) => add2(s, mid(w.points)), [0, 0]), 1 / ways.length) : c
  return {
    key: e.key, name: e.name ?? null, street: e.street ?? null, branch: e.branch ?? null, year: e.year ?? null,
    leaf: e.leaf ?? 'girder', decks: e.decks ?? 1, houses: e.houses ?? { count: 0, style: 'modern' }, reliefs: e.reliefs ?? null,
    liftable: e.liftable ?? true, generic: Boolean(e.generic), aliases: e.aliases ?? [], source: e.source ?? null,
    centre, axis: canonical(axis),
    span: e.clearSpan ?? Math.round(Math.max(30, ...ways.map((w) => lenOf(w.points)))),
    width: e.width ?? Math.max(12, roads.reduce((s, w) => s + 2 * (roadHalfWidth(w.tags) || 4), 0) + 6),
    wayIds: ways.map((w) => w.id), railWayIds: ways.filter((w) => w.tags.railway).map((w) => w.id),
  }
}

export function detectBridges(ways, entries) {
  const listed = new Set(entries.flatMap((e) => e.osmWays ?? []))
  const movable = ways.filter((w) => isMovableBridge(w.tags) || listed.has(w.id))
  const claimed = new Set(), out = []
  for (const e of entries) {
    const c = project(e.at.lon, e.at.lat), r = e.radius ?? 60
    const mine = movable.filter((w) => !claimed.has(w.id) && ((e.osmWays ?? []).includes(w.id) || len2(sub2(mid(w.points), c)) <= r))
    for (const w of mine) claimed.add(w.id)
    if (!mine.length && e.bearing == null) throw new Error(`bridge ${e.key} matched no OSM way and has no bearing — fix data/bridges.json`)
    out.push(resolveBridge(e, c, mine))
  }
  // Movable ways nobody listed become unnamed bascules, so no crossing is left as a flat ribbon.
  const rest = movable.filter((w) => !claimed.has(w.id))
  while (rest.length) {
    const seed = rest.shift(), group = [seed]
    for (let i = rest.length - 1; i >= 0; i--) if (len2(sub2(mid(rest[i].points), mid(seed.points))) < 45) group.push(...rest.splice(i, 1))
    const id = Math.min(...group.map((w) => w.id))
    out.push(resolveBridge({ key: `osm-${id}`, name: seed.tags.name ?? null, generic: true, leaf: 'girder', decks: 1, houses: { count: 0, style: 'modern' }, liftable: true }, mid(seed.points), group))
  }
  return out
}

// Liang–Barsky against an oriented rectangle { c, u, hl, hw }: the [t0, t1] of segment a→b inside it, or null.
export function clipSegment(a, b, { c, u, hl, hw }) {
  const v = left(u), da = sub2(a, c), d = sub2(b, a)
  const pa = [dot2(da, u), dot2(da, v)], pd = [dot2(d, u), dot2(d, v)]
  let t0 = 0, t1 = 1
  for (const [p, q] of [[-pd[0], pa[0] + hl], [pd[0], hl - pa[0]], [-pd[1], pa[1] + hw], [pd[1], hw - pa[1]]]) {
    if (Math.abs(p) < 1e-12) { if (q < 0) return null; continue }
    const r = q / p
    if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r } else { if (r < t0) return null; if (r < t1) t1 = r }
  }
  return t1 - t0 > 1e-9 ? [t0, t1] : null
}

// The parts of a polyline outside the rectangle (pieces shorter than 0.5 m are dropped).
export function cutPolyline(points, rect) {
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
  const pieces = []
  let cur = []
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1], hit = clipSegment(a, b, rect)
    if (!hit) { if (!cur.length) cur.push(a); cur.push(b); continue }
    const [t0, t1] = hit
    if (t0 > 0) { if (!cur.length) cur.push(a); cur.push(lerp(a, b, t0)) }
    if (cur.length >= 2) pieces.push(cur)
    cur = t1 < 1 ? [lerp(a, b, t1), b] : []
  }
  if (cur.length >= 2) pieces.push(cur)
  return pieces.filter((p) => lenOf(p) >= 0.5)
}
