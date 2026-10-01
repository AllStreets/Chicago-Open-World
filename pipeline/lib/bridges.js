// pipeline/lib/bridges.js — Chicago's river bascules: OSM movable ways → named bridges (data/bridges.json),
// ribbon cuts so each crossing draws ONE deck, then trunnion leaves, pits, tender/bridge houses and lights.
import { project } from '../../shared/project.js'
import { roadHalfWidth } from './ground.js'
import { add2, sub2, mul2, dot2, len2, norm2, left, bearing, at3, mesh, slab, tube } from './meshkit.js'
import { LANDMARK_FACADES as F } from './facadeIds.js'
import { drum, pyramid } from './crowns.js'
import { RAIL_TOP_Y } from './transit/grade.js'

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
    // a named bridge must claim its OSM ways: a silent fallback to at/bearing would leave the real ways to become a second deck
    if (!mine.length && !e.allowUnmatched) throw new Error(`bridge ${e.key} matched no OSM movable way within ${r} m — fix data/bridges.json (osmWays, radius, or allowUnmatched)`)
    out.push(resolveBridge(e, c, mine))
  }
  // Movable ways nobody listed become unnamed bascules, so no crossing is left as a flat ribbon — but one lying next to a
  // named bridge is that bridge's drifted OSM way, and building it would stack a second deck on the crossing.
  const rest = movable.filter((w) => !claimed.has(w.id))
  for (const w of rest) for (const e of entries) {
    const c = project(e.at.lon, e.at.lat)
    if (len2(sub2(mid(w.points), c)) < 100) throw new Error(`bridge ${e.key}: OSM movable way ${w.id} lies ${Math.round(len2(sub2(mid(w.points), c)))} m away but was not claimed — add it to osmWays or widen radius`)
  }
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

// ── Leaves ───────────────────────────────────────────────────────────────────
// Chicago-type trunnion bascule: each leaf turns about a fixed trunnion at the bank; a counterweight on the
// short tail behind the trunnion drops into a pit as the leaf rises (https://en.wikipedia.org/wiki/Bascule_bridge).
export const DECK = { sidewalkW: 3, slabT: 0.35, trunnionDrop: 1.2, gap: 0.04, tailFrac: 0.32 }
// app/src/bridges/lift.js MAX_LIFT_DEG: the pits are sized for the leaves' whole sweep up to this angle (D1-4)
export const LIFT_MAX_DEG = 75
// D1 (river at RIVER_Y): no steel hangs lower than this over the water at the trunnion
export const WATER_CLEAR_M = 1.0
// The L crossing a double-deck bascule rides V3's own transit structure (rail top RAIL_TOP_Y.cta = 7.2 m); the leaf
// carries no upper slab of its own, and its through trusses rise clear of a 3.66 m car (CTA 5000/7000 series).
export const L_DECK_Y = RAIL_TOP_Y.cta
const CAR_CLEAR = 3.66 + 1.4
const STEEL = 'chicago-bridge-steel'

export function leafGeometry(b, deckY) {
  return [1, -1].map((s, leaf) => {
    const p2 = add2(b.centre, mul2(b.axis, (s * b.span) / 2)), d = mul2(b.axis, -s)
    return { leaf, s, p2, d, pivot: [p2[0], deckY - DECK.trunnionDrop, p2[1]], k: [-d[1], 0, d[0]], Lf: b.span / 2 - DECK.gap, Lt: (DECK.tailFrac * b.span) / 2 }
  })
}

const frameOf = (g) => { const v = left(g.d); return (a, o = 0) => add2(add2(g.p2, mul2(g.d, a)), mul2(v, o)) }
const panels = (g, N = 8) => Array.from({ length: N + 1 }, (_, i) => -g.Lt + ((g.Lf + g.Lt) * i) / N)

// the deepest a leaf's steel may hang below its deck: clear of the river by WATER_CLEAR_M (none over the flat world)
const depthCap = (deckY, riverY) => (riverY == null ? Infinity : deckY - DECK.slabT - (riverY + WATER_CLEAR_M) - 0.3) // 0.3: the chord tube's radius

function deckTrusses(b, g, deckY, riverY) {
  const out = mesh(), at = frameOf(g), W = b.width, top = deckY - DECK.slabT, cap = depthCap(deckY, riverY)
  const offs = W > 26 ? [-(W / 2 - 2.5), -W / 6, W / 6, W / 2 - 2.5] : [-(W / 2 - 2.5), W / 2 - 2.5]
  const [d0, d1] = b.decks === 2 ? [7.5, 6.6] : [5.5, 1.8]
  const depth = (a) => Math.min(cap, a <= 0 ? d0 : d0 + ((d1 - d0) * a) / g.Lf)
  const A = panels(g)
  for (const o of offs) for (let i = 0; i < A.length - 1; i++) {
    const T0 = at3(at(A[i], o), top), T1 = at3(at(A[i + 1], o), top)
    const B0 = at3(at(A[i], o), top - depth(A[i])), B1 = at3(at(A[i + 1], o), top - depth(A[i + 1]))
    tube(out, T0, T1, 0.25, 4); tube(out, B0, B1, 0.25, 4); tube(out, T0, B0, 0.18, 4)
    tube(out, i % 2 ? T0 : B0, i % 2 ? B1 : T1, 0.18, 4)   // Warren diagonals
  }
  return out
}

function throughTrusses(b, g, deckY) {
  const out = mesh(), at = frameOf(g), W = b.width, o = W / 2 - 0.6
  const H = b.decks === 2 ? L_DECK_Y + CAR_CLEAR - deckY : 6.0
  const height = (a) => (b.decks === 2 || a <= 0.2 * g.Lf ? H : H * (1 - (0.45 * (a - 0.2 * g.Lf)) / (0.8 * g.Lf)))
  const A = panels(g)
  for (const side of [-o, o]) for (let i = 0; i < A.length - 1; i++) {
    const B0 = at3(at(A[i], side), deckY), B1 = at3(at(A[i + 1], side), deckY)
    const T0 = at3(at(A[i], side), deckY + height(A[i])), T1 = at3(at(A[i + 1], side), deckY + height(A[i + 1]))
    tube(out, B0, B1, 0.25, 4); tube(out, T0, T1, 0.25, 4); tube(out, B0, T0, 0.18, 4)
    tube(out, i % 2 ? B0 : T0, i % 2 ? T1 : B1, 0.18, 4)
  }
  for (let i = 0; i < A.length; i += 2) tube(out, at3(at(A[i], -o), deckY + height(A[i])), at3(at(A[i], o), deckY + height(A[i])), 0.15, 4) // top struts
  return out
}

function girders(b, g, deckY, riverY) {
  const out = mesh(), at = frameOf(g), W = b.width, top = deckY - DECK.slabT, cap = depthCap(deckY, riverY)
  const offs = W > 20 ? [-(W / 2 - 2), -W / 6, W / 6, W / 2 - 2] : [-(W / 2 - 2), W / 2 - 2]
  const depth = (a) => Math.min(cap, a <= 0 ? 3.5 : 3.5 - (2.1 * a) / g.Lf)
  const A = panels(g)
  for (const o of offs) for (let i = 0; i < A.length - 1; i++) {
    const m = (A[i] + A[i + 1]) / 2
    slab(out, at(m, o), g.d, A[i + 1] - A[i], 0.6, top - depth(m), top)
  }
  return out
}

// levels (D1): { river: RIVER_Y, lower: LOWER_Y } — the trusses stay clear of the water and a double deck's lower
// roadway hangs at the Lower Wacker level; without it (the flat world) the leaves are as before.
export function buildLeaves(b, deckY, levels = null) {
  const W = b.width, riverY = levels?.river ?? null
  return leafGeometry(b, deckY).map((g) => {
    const at = frameOf(g), len = g.Lf + g.Lt, mid = (g.Lf - g.Lt) / 2, meshes = []
    const push = (m, facade, style, part) => meshes.push({ mesh: m, facade, seed: 0.5, style, part })
    push(slab(mesh(), at(mid), g.d, len, W - 2 * DECK.sidewalkW, deckY - DECK.slabT, deckY), F.grid, 'grid-deck-steel', 'deck')
    const walks = mesh(), rails = mesh()
    for (const o of [-1, 1]) {
      slab(walks, at(mid, o * (W / 2 - DECK.sidewalkW / 2)), g.d, len, DECK.sidewalkW, deckY - DECK.slabT, deckY + 0.15)
      slab(rails, at(mid, o * (W / 2 - 0.04)), g.d, len, 0.08, deckY + 0.15, deckY + 1.25)   // lattice railing
    }
    push(walks, F.stone, 'sidewalk-concrete', 'sidewalk')
    push(rails, F.grid, STEEL, 'railing')
    if (b.leaf === 'through-truss') push(throughTrusses(b, g, deckY), F.steel, STEEL, 'truss')
    else if (b.leaf === 'girder') push(girders(b, g, deckY, riverY), F.steel, STEEL, 'girder')
    else push(deckTrusses(b, g, deckY, riverY), F.steel, STEEL, 'truss')
    // a double-deck through truss carries the L on V3's transit structure; other double decks hang a lower roadway
    // (at LOWER_Y over the sunken river: DuSable's lower deck is Lower Michigan, the Outer Drive's its lower level)
    const low = levels?.lower != null ? [levels.lower - 0.35, levels.lower] : [deckY - 6.3, deckY - 5.95]
    if (b.decks === 2 && b.leaf !== 'through-truss') push(slab(mesh(), at(mid), g.d, len, W - 4, low[0], low[1]), F.stone, 'sidewalk-concrete', 'lower-deck')
    // the counterweight: a concrete block under the tail's end (over the sunken river), or the old hanging slab
    if (levels) push(slab(mesh(), at(-g.Lt + Math.min(5, 0.45 * g.Lt) / 2), g.d, Math.min(5, 0.45 * g.Lt), W - 4, deckY - 4.5, deckY - DECK.slabT - 0.02), F.stone, 'pit-concrete', 'counterweight')
    else push(slab(mesh(), at(-g.Lt / 2 - 0.5), g.d, Math.max(1, g.Lt - 1), W - 4, deckY - 9, deckY - 3), F.stone, 'pit-concrete', 'counterweight')
    const nav = mesh()
    for (const o of [-1, 1]) slab(nav, at(g.Lf - 0.3, o * (W / 2 - 0.3)), g.d, 0.35, 0.35, deckY + 1.0, deckY + 1.45)
    push(nav, F.signal, 'nav-red', 'nav')
    return { leaf: g.leaf, pivot: g.pivot, k: g.k, meshes }
  })
}

// The leaf's tail-side sweep (D1-4): every vertex behind the trunnion (along < 0.4 at rest), turned through 0…LIFT_MAX_DEG
// about the trunnion, in the leaf's own frame (along a from the trunnion toward the river, y up). The pit holds it all.
export function rotateLeafPoint([a, y], pivotY, deg) {
  const t = (deg * Math.PI) / 180, r = y - pivotY
  return [a * Math.cos(t) - r * Math.sin(t), pivotY + a * Math.sin(t) + r * Math.cos(t)]
}
export function leafFramePoints(g, meshes) {
  const v = left(g.d), out = []
  for (const m of meshes) for (let i = 0; i < m.mesh.positions.length; i += 3) {
    const d = [m.mesh.positions[i] - g.p2[0], m.mesh.positions[i + 2] - g.p2[1]]
    out.push([dot2(d, g.d), m.mesh.positions[i + 1], dot2(d, v)])
  }
  return out
}
export function tailSweep(b, deckY, levels, step = 2.5) {
  const leaves = buildLeaves(b, deckY, levels)
  return leafGeometry(b, deckY).map((g, i) => {
    const pts = leafFramePoints(g, leaves[i].meshes).filter(([a]) => a < 0.4)
    let a0 = Infinity, a1 = -Infinity, y0 = Infinity, w = 0
    for (let deg = 0; deg <= LIFT_MAX_DEG + 1e-9; deg += step) for (const [a, y, o] of pts) {
      const [ra, ry] = rotateLeafPoint([a, y], g.pivot[1], deg)
      if (ry > deckY - 0.4) continue // above the street: out of the pit
      a0 = Math.min(a0, ra); a1 = Math.max(a1, ra); y0 = Math.min(y0, ry); w = Math.max(w, Math.abs(o))
    }
    return { a0, a1, y0, halfW: w }
  })
}

// The pit and pier under each trunnion (D1-4, over the sunken river): an open concrete box sized from the tail's sweep,
// its walls running down to the riverbed so the pier stands in the water; the pier's river face is its front wall.
export const PIT = { wall: 0.5, margin: 0.6, floorT: 0.4 }
export function pierBoxes(b, deckY, levels) {
  const sw = tailSweep(b, deckY, levels)
  return leafGeometry(b, deckY).map((g, i) => {
    const s = sw[i], a0 = s.a0 - PIT.margin, a1 = Math.max(0.4, s.a1 + PIT.margin), floor = s.y0 - 0.5
    const inner = Math.max(b.width / 2, s.halfW) + 0.1
    return { g, a0, a1, floor, inner, outer: inner + PIT.wall, top: deckY - 0.4, bottom: Math.min(floor - PIT.floorT, levels.river - 0.5) }
  })
}
// the footprint of a pier box (outer walls) or of its open pit (inner), as a ring in world xz
export function pierRing(p, which = 'outer') {
  const at = frameOf(p.g), w = which === 'outer' ? p.outer : p.inner, e = which === 'outer' ? PIT.wall : 0
  return [[p.a0 - e, -w], [p.a1 + e, -w], [p.a1 + e, w], [p.a0 - e, w]].map(([a, o]) => at(a, o))
}

// Open pit behind each trunnion: the tail and counterweight swing down into it as the leaf rises.
export function buildPits(b, deckY, levels = null) {
  if (levels) return pierBoxes(b, deckY, levels).map((p) => {
    const at = frameOf(p.g), m = mesh(), L = p.a1 - p.a0 + 2 * PIT.wall, mid = (p.a0 + p.a1) / 2
    slab(m, at(mid), p.g.d, L, 2 * p.outer, p.floor - PIT.floorT, p.floor)                      // floor
    for (const o of [-1, 1]) slab(m, at(mid, o * (p.inner + PIT.wall / 2)), p.g.d, L, PIT.wall, p.bottom, p.top)   // side walls
    slab(m, at(p.a0 - PIT.wall / 2), p.g.d, PIT.wall, 2 * p.inner, p.bottom, p.top)               // back wall
    slab(m, at(p.a1 + PIT.wall / 2), p.g.d, PIT.wall, 2 * p.inner, p.bottom, p.top)               // river face of the pier
    return { mesh: m, facade: F.stone, seed: 0.5, style: 'pit-concrete', part: 'pit' }
  })
  return leafGeometry(b, deckY).map((g) => {
    const at = frameOf(g), m = mesh(), a0 = -g.Lt - 0.6, a1 = 0.4, L = a1 - a0, W = b.width, y0 = deckY - 9.4, y1 = deckY - 0.4
    slab(m, at((a0 + a1) / 2), g.d, L, W, y0, y0 + 0.4)                       // floor
    for (const o of [-1, 1]) slab(m, at((a0 + a1) / 2, o * (W / 2 - 0.25)), g.d, L, 0.5, y0, y1)
    slab(m, at(a0 + 0.25), g.d, 0.5, W, y0, y1)                               // back wall
    return { mesh: m, facade: F.stone, seed: 0.5, style: 'pit-concrete', part: 'pit' }
  })
}

// ── Houses, balustrades, lanterns ────────────────────────────────────────────
// Tender houses stand on diagonal corners (the operating houses); DuSable has four Bedford-stone bridgehouses
// with Fraser's (north) and Hering's (south) 1928 reliefs (https://en.wikipedia.org/wiki/DuSable_Bridge).
export const HOUSE_STYLES = {
  'beaux-arts': { w: 6, dpt: 5, h: 6.5, roof: 'hip' },
  deco: { w: 6, dpt: 5, h: 7, roof: 'stepped' },
  moderne: { w: 7, dpt: 4.5, h: 6, roof: 'flat' },
  modern: { w: 7, dpt: 5, h: 5.5, roof: 'flat', glass: true },
  dusable: { w: 9.5, dpt: 9.5, h: 12.5, roof: 'attic' },
}
const cornerName = (p, c) => `${p[1] < c[1] ? 'n' : 's'}${p[0] < c[0] ? 'w' : 'e'}`
const slug = (s) => s.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')

export function houseSpots(b) {
  const st = HOUSE_STYLES[b.houses?.style] ?? HOUSE_STYLES.moderne, v = left(b.axis), n = b.houses?.count ?? 0
  const corners = n >= 4 ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : n === 2 ? [[1, 1], [-1, -1]] : n === 1 ? [[1, 1]] : []
  const tail = (DECK.tailFrac * b.span) / 2
  return corners.map(([s, side]) => {
    const along = b.span / 2 + (b.houses.style === 'dusable' ? st.dpt / 2 + 0.5 : tail * 0.6)
    const at = add2(add2(b.centre, mul2(b.axis, s * along)), mul2(v, side * (b.width / 2 + st.w / 2 + 0.6)))
    return { at, s, side, facing: mul2(v, -side), corner: cornerName(at, b.centre) }
  })
}

export function buildHouse(spot, styleKey, relief = null) {
  const st = HOUSE_STYLES[styleKey] ?? HOUSE_STYLES.moderne, u = spot.facing, out = []
  const push = (m, facade, style, part, seed = 0.5) => out.push({ mesh: m, facade, seed, style, part })
  const stone = styleKey === 'dusable' ? 'bedford-limestone' : 'tender-limestone'
  if (st.glass) push(slab(mesh(), spot.at, u, st.dpt, st.w, 0, st.h), F.wall, 'tender-glass', 'house', 0.35) // glass-steel band
  else push(slab(mesh(), spot.at, u, st.dpt, st.w, 0, st.h), F.stone, stone, 'house')
  const v = left(u), ring = (e) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, o]) => add2(add2(spot.at, mul2(u, a * (st.dpt / 2 + e))), mul2(v, o * (st.w / 2 + e))))
  if (st.roof === 'hip') push(pyramid({ ring: ring(0.4), base: st.h, top: st.h + 2.6 }), F.roofing, null, 'roof', 0.35) // verdigris copper
  if (st.roof === 'stepped') { const m = mesh(); slab(m, spot.at, u, st.dpt - 1, st.w - 1, st.h, st.h + 1); slab(m, spot.at, u, st.dpt - 2.4, st.w - 2.4, st.h + 1, st.h + 1.8); push(m, F.stone, stone, 'roof') }
  if (st.roof === 'flat') push(slab(mesh(), spot.at, u, st.dpt + 1, st.w + 1, st.h, st.h + 0.4), F.stone, stone, 'roof')
  if (st.roof === 'attic') {
    const m = mesh(); slab(m, spot.at, u, st.dpt + 1, st.w + 1, st.h, st.h + 0.9); slab(m, spot.at, u, st.dpt - 1, st.w - 1, st.h + 0.9, st.h + 2.5)
    push(m, F.stone, stone, 'roof')
  }
  if (relief) {   // bas-relief panel with five standing figures on the face toward the roadway
    const face = add2(spot.at, mul2(u, st.dpt / 2)), m = slab(mesh(), add2(face, mul2(u, 0.17)), u, 0.35, 6, 3, 10)
    for (let i = 0; i < 5; i++) {
      const o = -2.2 + 1.1 * i, p = add2(add2(face, mul2(u, 0.45)), mul2(v, o)), lean = 0.25 * Math.sin(i * 1.7)
      tube(m, at3(p, 3.6), at3(add2(p, mul2(v, lean)), 8.4), 0.42, 6)
      const head = drum({ at: add2(p, mul2(v, lean)), base: 8.4, top: 9.2, r: 0.38, sides: 8 })
      for (const k of ['positions', 'normals', 'uvs']) m[k].push(...head[k])
    }
    push(m, F.stone, 'bedford-limestone-relief', `relief:${slug(relief)}`)
  }
  return out
}

export function buildBalustrades(b, deckY) {
  const v = left(b.axis), out = mesh(), L = 16
  for (const s of [1, -1]) for (const side of [1, -1]) {
    const base = (a) => add2(add2(b.centre, mul2(b.axis, s * a)), mul2(v, side * (b.width / 2 - 0.3)))
    for (let a = b.span / 2; a <= b.span / 2 + L + 1e-6; a += 2.4) slab(out, base(a), b.axis, 0.45, 0.45, deckY, deckY + 1.1)
    slab(out, base(b.span / 2 + L / 2), b.axis, L, 0.55, deckY + 1.1, deckY + 1.35)
  }
  return { mesh: out, facade: F.stone, seed: 0.5, style: 'bedford-limestone', part: 'balustrade' }
}

export function lanternSpots(b, deckY) {
  const v = left(b.axis), out = []
  const along = b.houses?.style === 'dusable' ? [b.span / 2 + 2, b.span / 2 + 9, b.span / 2 + 16] : [b.span / 2 + 1]
  for (const s of [1, -1]) for (const side of [1, -1]) for (const a of along)
    out.push(at3(add2(add2(b.centre, mul2(b.axis, s * a)), mul2(v, side * (b.width / 2 - 0.3))), deckY + 5.6))
  return out
}

export function bridgeLights(b, deckY) {
  const out = lanternSpots(b, deckY).map((p) => ({ p, kind: 'lantern' }))
  for (const g of leafGeometry(b, deckY)) {
    const v = left(g.d)
    for (const o of [-1, 1]) {
      out.push({ p: at3(add2(add2(g.p2, mul2(g.d, g.Lf - 0.3)), mul2(v, o * (b.width / 2 - 0.3))), deckY + 1.25), kind: 'nav', leaf: g.leaf })
      out.push({ p: at3(add2(add2(g.p2, mul2(g.d, 0.6)), mul2(v, o * (b.width / 2 + 0.4))), deckY + 0.5), kind: 'pier' })
    }
  }
  return out
}

export function buildBridge(b, { deckY, levels = null }) {
  const fixed = [...buildPits(b, deckY, levels)]
  for (const spot of houseSpots(b)) fixed.push(...buildHouse(spot, b.houses.style, b.reliefs?.[spot.corner] ?? null))
  if (b.houses?.style === 'dusable') fixed.push(buildBalustrades(b, deckY))
  const posts = mesh(), glass = mesh()
  for (const p of lanternSpots(b, deckY)) {
    tube(posts, [p[0], deckY, p[2]], [p[0], p[1] - 0.4, p[2]], 0.12, 6)
    slab(glass, [p[0], p[2]], b.axis, 0.55, 0.55, p[1] - 0.4, p[1] + 0.3)
  }
  fixed.push({ mesh: posts, facade: F.steel, seed: 0.5, style: 'lamp-post-black', part: 'lamp-post' })
  fixed.push({ mesh: glass, facade: F.signal, seed: 0.5, style: 'lantern-warm', part: 'lantern' })
  return { fixed, leaves: buildLeaves(b, deckY, levels), lights: bridgeLights(b, deckY), piers: levels ? pierBoxes(b, deckY, levels) : [] }
}

// ── World integration ────────────────────────────────────────────────────────
export const spanRect = (b) => ({ c: b.centre, u: b.axis, hl: b.span / 2 + (DECK.tailFrac * b.span) / 2 + 0.6, hw: b.width / 2 + 1.5 })

function runsAlong(points, r) {
  for (let i = 0; i < points.length - 1; i++) {
    if (!clipSegment(points[i], points[i + 1], r)) continue
    if (Math.abs(dot2(norm2(sub2(points[i + 1], points[i])), r.u)) > 0.8) return true
  }
  return false
}

export function makeRibbonCutter(bridges) {
  const rects = bridges.map((b) => ({ r: spanRect(b), ids: new Set(b.wayIds) }))
  return (way) => {
    let lines = [way.points]
    for (const { r, ids } of rects) lines = lines.flatMap((l) => (ids.has(way.id) || runsAlong(l, r) ? cutPolyline(l, r) : [l]))
    return lines
  }
}

const r1 = (x) => Math.round(x * 10) / 10, r3 = (x) => Math.round(x * 1000) / 1000
export function bridgeSidecar(bridges, built, liftOrder) {
  const leaves = [], lights = [], out = []
  bridges.forEach((b, i) => {
    const ids = built[i].leaves.map((l) => { leaves.push({ bridge: b.key, pivot: l.pivot.map(r3), k: l.k.map(r3) }); return leaves.length - 1 })
    for (const L of built[i].lights) lights.push({ p: L.p.map(r1), kind: L.kind, ...(L.leaf != null ? { leaf: ids[L.leaf] } : {}) })
    out.push({ key: b.key, name: b.name, street: b.street ?? null, branch: b.branch ?? null, year: b.year ?? null, liftable: b.liftable, centre: b.centre.map(r1), axis: b.axis.map(r3), span: b.span, leaves: ids, source: b.source ?? null })
  })
  const ok = new Set(bridges.filter((b) => b.liftable).map((b) => b.key))
  return { version: 1, bridges: out, leaves, lights, liftOrder: liftOrder.filter((k) => ok.has(k)) }
}
