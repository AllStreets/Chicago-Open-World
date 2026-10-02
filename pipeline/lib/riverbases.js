// pipeline/lib/riverbases.js — A-8: how the river's icons meet the water (plan 2026-10-01 §2, after D1 dropped the
// river to levels.json RIVER_Y). Each site in data/riverbases.json dresses one building's riverfront from a small set of
// parts, each laid against the real dockwall in front of the building (the river polygon's land edges):
//   walk      a river-level walk on piles along the dockwall, railing and lamps on its water edge (Trump, Wrigley, …)
//   stairs    a flight down the dockwall face from the street to that walk
//   plinth    the building's river face below the street as stone (coping, rustication, arched openings)
//   docks     floating docks with finger slips and moored boats (Marina City, River City)
//   balustrade the street-level edge above the dockwall (Mart Plaza, Riverside Plaza): pierced stone rail and lamps
//   deck      a plaza slab over the water on columns (Marina City's raised platform over its marina)
//   drums     a tower's core carried down to the water (Marina City)
//   storefronts buildings under the deck drawn as glass shopfronts at the walk's level (Marina City's restaurants)
//   zones     sunken floors cut into the land (Apple's steps and landing); stairsLand: the steps on them
//   pavilion  Apple Michigan Avenue: glass walls from the river landing to the thin carbon-fibre roof
// Every mesh is attached to its site's building (hover and ⌘K name the building; close-range detail is LOD0 only).
// Pure and deterministic; build-world.js calls buildRiverBases after the heroes and before the street ground is cut.
import { add2, sub2, mul2, dot2, len2, norm2, left, at3, mesh, tri, quad, slab, tube, merge } from './meshkit.js'
import { LANDMARK_FACADES as F } from './facadeIds.js'
import { ensureCCW, ringCentroid, ringBBox, distToRing, pointInRing } from './geom.js'
import { wallRuns, polyIndex } from './riverLevel.js'
import { bands, capRing, openingsAlong, edgesOf, offsetRing } from './rivericons.js'
import { drum } from './crowns.js'
import { mooredInSlip } from './boats.js'

export const RB = {
  riser: 0.17, tread: 0.3, stairW: 2.6, walkT: 0.45,   // stairs: ≈ 31 risers of 6¾ in from Upper Wacker to the Riverwalk
  railH: 1.1, postEvery: 4.5, pileEvery: 7.5, pileR: 0.22, lampEvery: 18, lampH: 3.8,
  dock: { offset: 1.0, width: 2.4, fingerEvery: 7, fingerLen: 8, fingerW: 1.1, freeboard: 0.4 },
  plinthProud: 0.14, rustEvery: 0.9,
}
const P = (m, facade, style, part, { lod0Only = true, seed = 0.5 } = {}) => Object.assign(m, { facade, seed, style, part, lod0Only })
const pushAll = (out, m) => { for (const k of ['positions', 'normals', 'uvs']) out[k].push(...m[k]); return out }
const segDist = (p, a, b) => {
  const d = sub2(b, a), l2 = dot2(d, d), t = l2 ? Math.max(0, Math.min(1, dot2(sub2(p, a), d) / l2)) : 0
  return len2(sub2(p, add2(a, mul2(d, t))))
}
const footDist = (p, b) => Math.min(...b.polygons.map((q) => (pointInRing(p, q.outer) ? 0 : distToRing(p, q.outer))))

// ── Where the building meets the river ──────────────────────────────────────────────────────────────────────────────
// The dockwall (water edge → land at street level) in front of a building: the parts of every wall run within `reach`
// of the footprint with the building on its land side, as straight segments { a, b, u, n, len } (n: water → land).
// `clip` [s0, s1] (metres) trims the joined frontage to a stretch of it, measured from its west/north end.
export function frontage(b, runs, { reach = 25, step = 1, box = null } = {}) {
  const c = b.centroid ?? ringCentroid(b.polygons[0].outer), segs = []
  for (const r of runs) {
    if (r.kind !== 'dockwall') continue
    const d = sub2(r.b, r.a), L = len2(d)
    if (L < 0.5) continue
    const u = mul2(d, 1 / L), n = r.n
    let s0 = null
    const k = Math.max(1, Math.round(L / step))
    for (let i = 0; i <= k; i++) {
      const s = (L * i) / k, p = add2(r.a, mul2(u, s))
      const ok = dot2(sub2(c, p), n) > 0 && footDist(p, b) <= reach && (!box || (p[0] >= box[0] && p[0] <= box[1] && p[1] >= box[2] && p[1] <= box[3]))
      if (ok && s0 == null) s0 = s
      if ((!ok || i === k) && s0 != null) {
        const s1 = ok ? s : (L * (i - 1)) / k
        if (s1 - s0 >= 1.5) segs.push({ a: add2(r.a, mul2(u, s0)), b: add2(r.a, mul2(u, s1)), u, n, len: s1 - s0 })
        s0 = null
      }
    }
  }
  return segs
}

// A drawn frontage line (model metres), its normal turned toward the building.
export function lineSegs(line, b) {
  const c = b.centroid ?? ringCentroid(b.polygons[0].outer), out = []
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i], e = line[i + 1], u = norm2(sub2(e, a)), n0 = left(u), n = dot2(sub2(c, a), n0) > 0 ? n0 : mul2(n0, -1)
    out.push({ a, b: e, u, n, len: len2(sub2(e, a)) })
  }
  return out
}

// ── Parts ───────────────────────────────────────────────────────────────────────────────────────────────────────────
// A box between two points along a line (a→b), from `o0` to `o1` metres off it toward −n (out over the water).
function strip(out, a, b, n, o0, o1, y0, y1) {
  const u = norm2(sub2(b, a)), L = len2(sub2(b, a)), c = add2(mul2(add2(a, b), 0.5), mul2(n, -(o0 + o1) / 2))
  return slab(out, c, u, L, Math.abs(o1 - o0), y0, y1)
}
// railing posts every 3 m and a top rail along a→b at height y
export function railing(out, a, b, y, { h = RB.railH, every = RB.postEvery } = {}) {
  const L = len2(sub2(b, a)), k = Math.max(1, Math.round(L / every))
  for (let j = 0; j <= k; j++) { const p = add2(a, mul2(sub2(b, a), j / k)); tube(out, at3(p, y), at3(p, y + h), 0.04, 3) }
  tube(out, at3(a, y + h), at3(b, y + h), 0.035, 3)
  tube(out, at3(a, y + h * 0.5), at3(b, y + h * 0.5), 0.02, 3)
  return out
}

// A river-level walk on piles: from the dockwall face out `width` over the water, its deck top at y.
export function walkAlong(segs, { width, y, riverY, t = RB.walkT, lamps = true, rail = true }) {
  const deck = mesh(), piles = mesh(), rails = mesh(), posts = mesh(), lanterns = mesh()
  let since = RB.lampEvery / 2
  for (const s of segs) {
    const a = add2(s.a, mul2(s.u, -0.3)), b = add2(s.b, mul2(s.u, 0.3))
    strip(deck, a, b, s.n, 0.02, width, y - t, y)
    const k = Math.max(1, Math.round(s.len / RB.pileEvery))
    for (let j = 0; j <= k; j++) { const p = add2(add2(s.a, mul2(s.u, (s.len * j) / k)), mul2(s.n, -(width - 0.35))); tube(piles, at3(p, riverY - 0.6), at3(p, y - t), RB.pileR, 4) }
    if (rail) railing(rails, add2(s.a, mul2(s.n, -(width - 0.12))), add2(s.b, mul2(s.n, -(width - 0.12))), y)
    if (lamps) for (let d = 0; d < s.len; d += 1) {
      if (++since < RB.lampEvery) continue
      since = 0
      const p = add2(add2(s.a, mul2(s.u, d)), mul2(s.n, -(width - 0.5)))
      tube(posts, at3(p, y), at3(p, y + RB.lampH - 0.35), 0.07, 4)
      slab(lanterns, p, s.u, 0.42, 0.42, y + RB.lampH - 0.35, y + RB.lampH + 0.15)
    }
  }
  return [P(deck, F.stone, 'riverwalk-granite', 'river-walk'), P(piles, F.stone, 'pit-concrete', 'piles'), P(rails, F.steel, 'lamp-post-black', 'railing'),
    P(posts, F.steel, 'lamp-post-black', 'lamp-post'), P(lanterns, F.signal, 'lantern-warm', 'lantern')].filter((m) => m.positions.length)
}

// One step of a flight against the wall: its tread, its riser faces (both ends) and its outer side — never the faces
// against the wall, under the deck or between steps that no one sees (6 triangles, not a box's 12).
function step(out, c, u, n, L, W, y0, y1) {
  const v = mul2(n, -1), P = (a, b, y) => at3(add2(add2(c, mul2(u, a)), mul2(v, b - W / 2)), y), hl = L / 2
  quad(out, P(-hl, 0, y1), P(hl, 0, y1), P(hl, W, y1), P(-hl, W, y1), [0, 1, 0])
  quad(out, P(-hl, W, y0), P(hl, W, y0), P(hl, W, y1), P(-hl, W, y1), [v[0], 0, v[1]])
  for (const s of [-1, 1]) quad(out, P(s * hl, 0, y0), P(s * hl, W, y0), P(s * hl, W, y1), P(s * hl, 0, y1), [u[0] * s, 0, u[1] * s])
  return out
}

// A flight down the dockwall face, parallel to it: its top at `at` metres along the segment (street level, y0), going
// `dir` (+1 along u, −1 against it) down to y1; inner edge against the wall, `width` out over the water.
export function stairDown(seg, { at, dir = 1, width = RB.stairW, y0 = 0, y1, riser = RB.riser, tread = RB.tread, t = RB.walkT }) {
  const m = mesh(), rail = mesh(), count = Math.max(1, Math.round((y0 - y1) / riser)), rise = (y0 - y1) / count
  const along = (d) => add2(seg.a, mul2(seg.u, at + dir * d))
  slab(m, add2(along(-dir * 1.3), mul2(seg.n, -width / 2 - 0.02)), seg.u, 2.6, width, y1 - t, y0) // the landing at the top
  for (let k = 1; k < count; k++) {
    const c = add2(along((k - 0.5) * tread), mul2(seg.n, -width / 2 - 0.02))
    step(m, c, seg.u, seg.n, tread + 0.02, width, y1 - t, y0 - k * rise)
  }
  const o = mul2(seg.n, -(width - 0.08)), top = add2(along(0), o), bot = add2(along((count - 1) * tread), o)
  tube(rail, at3(top, y0 + RB.railH), at3(bot, y1 + RB.railH), 0.035, 3)
  for (let k = 0; k <= Math.ceil(((count - 1) * tread) / 3); k++) { const f = Math.min(1, (k * 3) / ((count - 1) * tread || 1)), p = add2(top, mul2(sub2(bot, top), f)), y = y0 + (y1 - y0) * f; tube(rail, at3(p, y - (y0 - y1) / count), at3(p, y + RB.railH), 0.04, 3) }
  return { meshes: [P(m, F.stone, 'riverwalk-granite', 'stairs'), P(rail, F.steel, 'lamp-post-black', 'stair-rail')], run: (count - 1) * tread }
}

// The building's river face below the street, as stone: every footprint edge within `reach` of the water (or out over
// it), from `bottom` (the water) up to `top`, with a coping, rustication and optional arched openings.
export function plinth(b, { waterIdx, reach = 4, bottom, top = 0, style, arches = null, rustic = true, wall = null }) {
  const face = mesh(), dark = mesh(), edges = wall ? wall.map((s) => ({ a: s.a, b: s.b, t: s.u, n: mul2(s.n, -1), len: s.len, mid: mul2(add2(s.a, s.b), 0.5) })) : []
  // wall: the dockwall in front (frontage segments) when the building's river face IS the dockwall (the Opera)
  if (!wall) for (const q of b.polygons) for (const e of edgesOf(q.outer, 1.2)) {
    const probe = add2(e.mid, mul2(e.n, 0.8))
    if (waterIdx.nearEdge(probe, reach) || waterIdx.find(probe)) edges.push(e)
  }
  bands(face, edges, { ys: [bottom], h: top - bottom, d: RB.plinthProud, ext: RB.plinthProud })
  bands(face, edges, { ys: [top - 0.5], h: 0.5, d: RB.plinthProud + 0.18, ext: RB.plinthProud + 0.18 }) // the coping
  if (rustic) { const ys = []; for (let y = bottom + RB.rustEvery; y < top - 0.8; y += RB.rustEvery) ys.push(y); bands(face, edges, { ys, h: 0.1, d: RB.plinthProud + 0.05 }) }
  if (arches) for (const e of edges) {
    const k = Math.floor(e.len / arches.every)
    if (k >= 1) openingsAlong(dark, e, k, arches.y0, arches.y0 + arches.h, arches.w, { arch: arches.arch !== false, proud: RB.plinthProud + 0.1 })
  }
  return { edges, meshes: [P(face, F.stone, style, 'river-plinth'), P(dark, F.stone, arches?.style ?? 'arcade-shadow', 'river-arcade')].filter((m) => m.positions.length) }
}

// Floating docks off the wall, finger slips into the river every 7 m, and `boats` boats moored in them (F-9: placements
// of the scripted Blender boats, lib/boats.js — drawn by the app as instances, not baked into the tiles).
export function docksAlong(segs, { riverY, offset = RB.dock.offset, boats = 0, seed = 1 }) {
  const d = mesh(), moored = [], top = riverY + RB.dock.freeboard
  let h = seed
  const rnd = () => { h = (h * 9301 + 49297) % 233280; return h / 233280 }
  for (const s of segs) {
    if (s.len < 8) continue
    strip(d, add2(s.a, mul2(s.u, 1)), add2(s.b, mul2(s.u, -1)), s.n, offset, offset + RB.dock.width, top - 0.45, top)
    for (let x = 4; x < s.len - 3; x += RB.dock.fingerEvery) {
      const base = add2(add2(s.a, mul2(s.u, x)), mul2(s.n, -(offset + RB.dock.width)))
      slab(d, add2(base, mul2(s.n, -RB.dock.fingerLen / 2)), s.n, RB.dock.fingerLen, RB.dock.fingerW, top - 0.4, top)
      if (moored.length < boats && x + RB.dock.fingerEvery < s.len - 3 && rnd() < 0.8) {
        const mouth = add2(base, mul2(s.u, RB.dock.fingerEvery / 2))
        moored.push(mooredInSlip(mouth, mul2(s.n, -1), { y: riverY, rnd, maxL: 14 }))
      }
    }
  }
  return { meshes: [P(d, F.stone, 'boardwalk-wood', 'boat-slips')], boats: moored }
}

// The street edge above the dockwall: a pierced stone balustrade (dark openings for the balusters), lamp standards.
export function balustrade(segs, { y = 0, h = 1.05, t = 0.35, style = 'bedford-limestone', lampEvery = 24 }) {
  const stone = mesh(), dark = mesh(), posts = mesh(), lanterns = mesh()
  for (const s of segs) {
    const e = { a: add2(s.a, mul2(s.n, t)), b: add2(s.b, mul2(s.n, t)), t: s.u, n: mul2(s.n, -1), len: s.len }
    strip(stone, s.a, s.b, mul2(s.n, -1), 0.02, t, y, y + h)
    strip(stone, s.a, s.b, mul2(s.n, -1), -0.08, t + 0.08, y + h, y + h + 0.12)
    const k = Math.floor(s.len / 1.0) // lean: a slot a metre (the balusters between read as the stone)
    if (k) openingsAlong(dark, e, k, y + 0.25, y + h - 0.2, 0.7, { arch: false, proud: 0.02 })
    for (let d = lampEvery / 2; d < s.len; d += lampEvery) {
      const p = add2(add2(s.a, mul2(s.u, d)), mul2(s.n, t / 2 + 0.02))
      slab(stone, p, s.u, 0.7, 0.7, y, y + h + 0.3)
      tube(posts, at3(p, y + h + 0.3), at3(p, y + 4.2), 0.08, 6)
      slab(lanterns, p, s.u, 0.45, 0.45, y + 4.2, y + 4.8)
    }
  }
  return [P(stone, F.stone, style, 'river-balustrade'), P(dark, F.stone, 'arcade-shadow', 'balusters'), P(posts, F.steel, 'lamp-post-black', 'lamp-post'), P(lanterns, F.signal, 'lantern-warm', 'lantern')].filter((m) => m.positions.length)
}

// A slab over the water (a raised plaza), `t` thick, on square columns down into the river every `every` metres along
// its edges that stand over the water.
export function deckOver(ring, { y, t = 0.9, riverY, waterIdx, every = 7.5, col = 0.8, style = 'marina-concrete' }) {
  const r = ensureCCW(ring), m = mesh(), cols = mesh()
  capRing(m, r, y); capRing(m, r, y - t, true)
  for (let i = 0; i < r.length; i++) {
    const a = r[i], b = r[(i + 1) % r.length], n = norm2(left(sub2(b, a)))
    quad(m, at3(a, y - t), at3(b, y - t), at3(b, y), at3(a, y), [-n[0], 0, -n[1]])
    const L = len2(sub2(b, a)), k = Math.floor(L / every)
    for (let j = 0; j <= k; j++) {
      const p = add2(add2(a, mul2(sub2(b, a), k ? j / k : 0.5)), mul2(norm2(sub2(ringCentroid(r), a)), 0.9))
      if (waterIdx.find(p)) slab(cols, p, norm2(sub2(b, a)), col, col, riverY - 0.5, y - t)
    }
  }
  return [P(m, F.stone, style, 'plaza-deck', { lod0Only: false }), P(cols, F.stone, style, 'plaza-columns')]
}

// Glass shopfronts on a footprint between y0 and y1 (the restaurants under Marina City's plaza), mullions every 2.4 m.
export function storefront(ring, { y0, y1 }) {
  const glass = mesh(), frame = mesh()
  for (const e of edgesOf(ring, 0.5)) {
    quad(glass, at3(e.a, y0), at3(e.b, y0), at3(e.b, y1), at3(e.a, y1), [e.n[0], 0, e.n[1]], [0, y0, e.len, y1])
    const k = Math.max(1, Math.round(e.len / 2.4))
    for (let j = 0; j <= k; j++) slab(frame, add2(add2(e.a, mul2(e.t, (e.len * j) / k)), mul2(e.n, 0.06)), e.t, 0.12, 0.12, y0, y1)
    slab(frame, add2(mul2(add2(e.a, e.b), 0.5), mul2(e.n, 0.08)), e.t, e.len, 0.16, y1 - 0.35, y1)
  }
  return [P(glass, F.signal, 'storefront-glass-lit', 'storefront'), P(frame, F.steel, 'lamp-post-black', 'storefront-frame')]
}

// Apple Michigan Avenue (Foster + Partners, 2017): 32 ft glass walls from the river landing to a thin carbon-fibre roof
// (111 × 98 ft) on slender stainless columns, its corners rounded like a laptop's lid.
export function applePavilion(ring, { y0, roofTop, roofT = 0.35, L, W, corner = 3, columns = 4 }) {
  const glass = mesh(), roof = mesh(), cols = mesh(), r = ensureCCW(ring), c = ringCentroid(r)
  const under = roofTop - roofT
  for (const e of edgesOf(r, 0.5)) {
    quad(glass, at3(e.a, y0), at3(e.b, y0), at3(e.b, under), at3(e.a, under), [e.n[0], 0, e.n[1]], [0, y0, e.len, under])
    const k = Math.max(1, Math.round(e.len / 3.2)) // the glass fins between 32 ft panes
    for (let j = 1; j < k; j++) slab(cols, add2(add2(e.a, mul2(e.t, (e.len * j) / k)), mul2(e.n, -0.2)), e.n, 0.4, 0.06, y0, under)
  }
  // the roof: a rounded rectangle on the footprint's long axis
  const ob = edgesOf(r, 0.5).reduce((a, e) => (e.len > a.len ? e : a)), u = ob.t, v = left(u), hl = L / 2, hw = W / 2, rc = Math.min(corner, hw * 0.4)
  const pts = []
  for (const [sx, sy, a0] of [[1, 1, 0], [-1, 1, 90], [-1, -1, 180], [1, -1, 270]]) for (let k = 0; k <= 4; k++) {
    const a = ((a0 + (k * 90) / 4) * Math.PI) / 180, lx = sx * (hl - rc) + rc * Math.cos(a), ly = sy * (hw - rc) + rc * Math.sin(a)
    pts.push(add2(add2(c, mul2(u, lx)), mul2(v, ly)))
  }
  const rr = ensureCCW(pts)
  capRing(roof, rr, roofTop); capRing(roof, rr, under, true)
  for (let i = 0; i < rr.length; i++) { const a = rr[i], b = rr[(i + 1) % rr.length], n = norm2(left(sub2(b, a))); quad(roof, at3(a, under), at3(b, under), at3(b, roofTop), at3(a, roofTop), [-n[0], 0, -n[1]]) }
  for (const [sx, sy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]].slice(0, columns)) {
    const p = add2(add2(c, mul2(u, sx * hl * 0.32)), mul2(v, sy * hw * 0.32))
    tube(cols, at3(p, y0), at3(p, under), 0.16, 8)
  }
  return [P(glass, F.wall, 'apple-glass', 'glass-walls', { lod0Only: false, seed: 0.35 }), P(roof, F.chrome, 'apple-roof', 'carbon-roof', { lod0Only: false }), P(cols, F.steel, 'apple-steel', 'columns')]
}

// Wide steps cut into the land (a sunken zone at the bottom level): from `from` (top, y0) to `to` (bottom, y1),
// `width` across; returns the stepped blocks and the zone the street ground gives way to.
export function stepsDown({ from, to, width, y0 = 0, y1, riser = RB.riser }) {
  const d = sub2(to, from), L = len2(d), u = norm2(d), v = left(u), m = mesh()
  const count = Math.max(1, Math.round((y0 - y1) / riser)), rise = (y0 - y1) / count, tread = L / count
  for (let k = 0; k < count; k++) slab(m, add2(from, mul2(u, (k + 0.5) * tread)), u, tread + 0.02, width, y1 - 0.3, y0 - (k + 1) * rise + rise)
  const zone = [add2(from, mul2(v, -width / 2)), add2(to, mul2(v, -width / 2)), add2(to, mul2(v, width / 2)), add2(from, mul2(v, width / 2))]
  return { mesh: P(m, F.stone, 'apple-granite', 'steps', { lod0Only: false }), zone: { outer: ensureCCW(zone), holes: [], y: y1 }, count, tread }
}

// ── The whole pass ──────────────────────────────────────────────────────────────────────────────────────────────────
// spec: data/riverbases.json; buildings: the city's buildings (heroes applied); water: the sunken river (sunkWater);
// levels: { river, riverwalk }; findBuilding(ref) → building or null (heroes.js findByOsm).
export function buildRiverBases({ spec, buildings, water, levels, findBuilding }) {
  const riverY = levels.river, rwY = levels.riverwalk, waterIdx = polyIndex(water)
  const zones = [], attach = [], report = [], boats = []
  const add = (b, ms) => { if (ms.length) attach.push({ building: b, meshes: ms.filter((m) => m.positions.length) }) }
  for (const site of spec.sites) {
    const b = findBuilding(site.osm)
    if (!b) throw new Error(`riverbases: ${site.key} building ${site.osm} not found`)
    const bb = ringBBox(b.polygons[0].outer), near = water.filter((p) => { const q = p.bbox ?? ringBBox(p.outer); return q.maxX > bb.minX - 80 && q.minX < bb.maxX + 80 && q.maxZ > bb.minZ - 80 && q.minZ < bb.maxZ + 80 })
    const runs = wallRuns({ water: near, riverY })
    // the frontage: the dockwall in front, or (Marina City, whose mapped basin runs in under the platform) a drawn line
    const segs = site.line ? lineSegs(site.line, b) : frontage(b, runs, { reach: site.reach ?? 20, box: site.box ?? null })
    const y = (v) => (v === 'riverwalk' ? rwY : v === 'river' ? riverY : v)
    const ms = [], r = { key: site.key, frontageM: Math.round(segs.reduce((t, s) => t + s.len, 0)), parts: [] }
    for (const ref of site.hide ?? []) { const hb = findBuilding(ref); if (hb) { hb.pieces = hb.pieces.map((p) => ({ ...p, hidden: true })); r.parts.push('hide') } }
    if (site.walk && segs.length) { ms.push(...walkAlong(segs, { width: site.walk.width, y: y(site.walk.y ?? 'riverwalk'), riverY, lamps: site.walk.lamps !== false })); r.parts.push('walk') }
    for (const st of site.stairs ?? []) {
      // the segment nearest `near` (or the first), the stair's top there, running down toward `toward`
      if (st.near === 'start' || st.near === 'end') {
        const longest = [...segs].sort((p, q) => q.len - p.len)[0]
        if (!longest || longest.len < 12) continue
        const s0 = st.near === 'start'
        ms.push(...stairDown(longest, { at: s0 ? 1.5 : longest.len - 1.5, dir: s0 ? 1 : -1, y1: y(st.y ?? site.walk?.y ?? 'riverwalk'), width: st.width ?? RB.stairW }).meshes); r.parts.push('stairs')
        continue
      }
      const seg = st.near ? segs.reduce((a, s) => (segDist(st.near, s.a, s.b) < segDist(st.near, a.a, a.b) ? s : a), segs[0]) : segs[0]
      if (!seg) continue
      const at = st.near ? Math.max(0, Math.min(seg.len, dot2(sub2(st.near, seg.a), seg.u))) : st.at ?? 0
      const dir = st.toward ? Math.sign(dot2(sub2(st.toward, st.near), seg.u)) || 1 : st.dir ?? 1
      ms.push(...stairDown(seg, { at, dir, y1: y(st.y ?? site.walk?.y ?? 'riverwalk'), width: st.width ?? RB.stairW }).meshes); r.parts.push('stairs')
    }
    if (site.plinth) { const p = plinth(b, { waterIdx, bottom: riverY - 0.5, style: site.plinth.style, reach: site.plinth.reach ?? 4, arches: site.plinth.arches ? { ...site.plinth.arches, y0: y(site.plinth.arches.y0 ?? 'riverwalk') } : null, wall: site.plinth.onWall ? segs : null }); ms.push(...p.meshes); r.parts.push(`plinth×${p.edges.length}`) }
    if (site.docks && segs.length) {
      const dk = docksAlong(segs, { riverY, offset: (site.walk?.width ?? 0) + (site.docks.offset ?? RB.dock.offset), boats: site.docks.boats ?? 0, seed: site.docks.seed ?? 7 })
      ms.push(...dk.meshes); boats.push(...dk.boats); r.parts.push('docks'); r.boats = dk.boats.length
    }
    if (site.balustrade && segs.length) { ms.push(...balustrade(segs, { style: site.balustrade.style ?? 'bedford-limestone', lampEvery: site.balustrade.lampEvery ?? 24 })); r.parts.push('balustrade') }
    for (const d of site.decks ?? []) { ms.push(...deckOver(d.xz, { y: y(d.y ?? 0), t: d.t ?? 0.9, riverY, waterIdx, style: d.style ?? 'marina-concrete' })); r.parts.push('deck') }
    for (const d of site.drums ?? []) { ms.push(P(drum({ at: d.at, base: riverY - 0.5, top: y(d.top ?? 0), r: d.r, sides: 24 }), F.stone, d.style ?? 'marina-concrete', 'core-drum')); r.parts.push('drum') }
    for (const s of site.storefronts ?? []) {
      // the building drawn as a shopfront when the build keeps it (an underground layer may not be), else its mapped ring
      const sb = s.osm ? findBuilding(s.osm) : null
      if (sb) { sb.pieces = sb.pieces.map((p) => ({ ...p, hidden: true, base: y(s.y0), top: y(s.y1) })); add(sb, sb.polygons.flatMap((q) => storefront(q.outer, { y0: y(s.y0), y1: y(s.y1) }))) }
      else if (s.xz) ms.push(...storefront(ensureCCW(s.xz), { y0: y(s.y0), y1: y(s.y1) }))
      else throw new Error(`riverbases: ${site.key} storefront ${s.osm} not found and no xz given`)
      r.parts.push('storefront')
    }
    for (const z of site.zones ?? []) { zones.push({ outer: ensureCCW(z.xz), holes: [], y: y(z.y), site: site.key }); r.parts.push('zone') }
    for (const s of site.stepsLand ?? []) {
      const st = stepsDown({ from: s.from, to: s.to, width: s.width, y1: y(s.y ?? 'riverwalk'), riser: s.riser ?? RB.riser })
      ms.push(st.mesh); zones.push({ ...st.zone, site: site.key }); r.parts.push(`steps×${st.count}`)
    }
    if (site.pavilion) {
      const pv = site.pavilion
      for (const ref of pv.hide ?? []) { const hb = findBuilding(ref); if (hb) hb.pieces = hb.pieces.map((p) => ({ ...p, hidden: true })) }
      b.pieces = b.pieces.map((p) => ({ ...p, hidden: true, base: y(pv.y0), top: pv.roofTop }))
      b.sculptReplaces = true
      ms.push(...applePavilion(b.polygons[0].outer, { y0: y(pv.y0), roofTop: pv.roofTop, L: pv.roofL, W: pv.roofW, corner: pv.corner ?? 3 }))
      r.parts.push('pavilion')
    }
    add(b, ms)
    r.tris = Math.round(ms.reduce((t, m) => t + m.positions.length / 9, 0))
    report.push(r)
  }
  return { zones, attach, report, boats }
}

// A-8 "done when": every listed building's footprint edges within `reach` of the river reach down to the water.
export function checkReachesWater(b, { waterIdx, riverY, reach = 3 }) {
  const near = b.polygons.some((q) => q.outer.some((p, i) => { const c = q.outer[(i + 1) % q.outer.length], m = mul2(add2(p, c), 0.5); return waterIdx.nearEdge(m, reach) || waterIdx.find(m) }))
  if (!near) return { near: false, ok: true }
  const minY = (m) => { let lo = Infinity; for (let i = 1; i < m.positions.length; i += 3) lo = Math.min(lo, m.positions[i]); return lo }
  const low = Math.min(...b.pieces.filter((p) => !p.hidden).map((p) => p.base ?? 0), ...(b.extraMeshes ?? []).map(minY))
  return { near: true, ok: low <= riverY - 0.4, low }
}
