// pipeline/lib/gaps.js — open storeys: a building whose pieces leave a vertical gap (a blow-through floor, a recessed
// mechanical storey, stilts, a roof canopy) is never drawn see-through. Extruded pieces have walls and a roof but no
// underside, so a piece standing on air shows its own hollow inside and the sky through the gap (user, 2026-10-02: "it
// cannot have an invisible interior … it needs flat steel rods around the edges that show the building is held up").
//
// findGaps(pieces) finds every region of a piece's footprint that nothing below reaches; closeGap closes it:
//   - 'storey' (an open floor between two volumes, or a building on stilts): a floor slab and a soffit, a solid dark
//     core set back `inset` from the glass line, and flat steel plates at every corner and every ~4.5 m along the
//     edges, each spanning the glass line to the core. The plates cut the recess into convex cells that each open on
//     one side only, so no straight line of sight passes through the storey from any angle (see the proof in openStorey).
//   - 'canopy' (an OSM building:part=roof over open ground): the soffit and steel posts along its edges — the space
//     under a roof is open air, not an interior.
//   - 'overhang' (a cantilever or ledge over open ground, higher than GAP.overhangM) and 'arcade' (a sculpted
//     landmark's colonnade, pilotis or passage at street level, whose sculpt draws the columns): the soffit only.
//   - 'facade' (an OSM data error or a sliver narrower than a room): the gap is filled as continuous façade.
// Every closing piece is kept at LOD1 and in the 2 km blocks, so no distance shows the gap open.
import earcut from 'earcut'
import pc from 'polygon-clipping'
import { ensureCCW, signedArea, simplifyRing, pointInRing } from './geom.js'
import { add2, sub2, mul2, dot2, norm2, mesh, tri, quad, merge } from './meshkit.js'
import { extrudeBuilding } from './extrude.js'
import { LANDMARK_FACADES as F } from './facadeIds.js'

export const GAP = {
  minArea: 4, // m² of unsupported footprint before a piece counts as standing on air
  minFrac: 0.02, // … or this share of the piece, whichever is larger
  tol: 0.3, // m: a lower piece whose roof is within this of the base still carries it
  minH: 0.5, // m: a gap thinner than this is a seam, not a storey
  inset: 1.5, // m: the dark core's setback behind the glass line
  every: 4.5, // m: steel plate spacing along an edge (3–6 m)
  plateW: 0.6, // m: a plate's face, sized to read at a distance
  proud: 0, // m: plates stand this proud of the glass line (flush: a proud plate would need its own top and bottom)
  sliverW: 2.5, // m: a gap region narrower than this (2·area/perimeter) is a data sliver: continuous façade
  overhangM: 15, // m: open ground under a piece higher than this is a cantilever or ledge, not stilts
  postW: 0.6, // m: canopy posts
  postEvery: 6,
}

const Y = (p, y) => [p[0], y, p[1]]
const lerp2 = (p, q, f) => [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]
const closed = (r) => [...r, r[0]]
const polyOf = (p) => [closed(p.outer), ...(p.holes ?? []).map(closed)]
const ringArea = (r) => Math.abs(signedArea(r))
const mpArea = (mp) => mp.reduce((s, pg) => s + pg.reduce((t, r, i) => t + (i ? -1 : 1) * ringArea(r.slice(0, -1)), 0), 0)
const perimeter = (r) => r.reduce((s, p, i) => s + Math.hypot(...sub2(r[(i + 1) % r.length], p)), 0)

// Grow (d > 0) or shrink (d < 0) a ring along its corner bisectors (miter capped at 3|d|); vertex i stays vertex i.
export function offsetRing(ring, d) {
  const r = ensureCCW(ring), n = r.length
  const out = (a, b) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l] }
  return r.map((p, i) => {
    const n0 = out(r[(i - 1 + n) % n], p), n1 = out(p, r[(i + 1) % n])
    const bis = norm2(add2(n0, n1)), c = Math.max(0.33, dot2(bis, n1))
    return add2(p, mul2(bis, d / c))
  })
}
// outward normal of a CCW edge a→b (the same convention as loft and edgesOf)
const outN = (t) => [-t[1], t[0]]

// A flat cap over a polygon with holes at height y, facing up (or down).
export function capPoly(out, outer, holes, y, down = false) {
  const flat = [], hi = []
  for (const p of outer) flat.push(p[0], p[1])
  for (const h of holes ?? []) { hi.push(flat.length / 2); for (const p of h) flat.push(p[0], p[1]) }
  const ids = earcut(flat, hi.length ? hi : undefined, 2), at = (k) => [flat[k * 2], flat[k * 2 + 1]]
  for (let i = 0; i < ids.length; i += 3) tri(out, Y(at(ids[i]), y), Y(at(ids[i + 1]), y), Y(at(ids[i + 2]), y), [0, down ? -1 : 1, 0], at(ids[i]), at(ids[i + 1]), at(ids[i + 2]))
  return out
}

// Walls between two rings of equal length (same vertex order) at y0 and y1, facing out; no caps.
function band(out, A, B, y0, y1) {
  let u = 0
  for (let i = 0; i < A.length; i++) {
    const j = (i + 1) % A.length, d = sub2(A[j], A[i]), len = Math.hypot(...d)
    if (len < 1e-6) continue
    const n = outN(mul2(d, 1 / len))
    quad(out, Y(A[i], y0), Y(A[j], y0), Y(B[j], y1), Y(B[i], y1), [n[0], 0, n[1]], [u, y0, u + len, y1])
    u += len
  }
  return out
}

// A prism on a quad footprint that leans from qa (at y0) to qb (at y1): its four sides, no caps (slabs close it).
const prism = (out, qa, qb, y0, y1) => band(out, ensureCCWPair(qa, qb)[0], ensureCCWPair(qa, qb)[1], y0, y1)
function ensureCCWPair(a, b) { return signedArea(a) < 0 ? [[...a].reverse(), [...b].reverse()] : [a, b] }

// The closed open storey between ring A (the glass line at y0) and ring B (the glass line at y1, the same vertices
// moved — a frustum's lean): { slabs, core, steel }.
//   slabs: the floor (A at y0, facing up; skipped with floor: false where a lower roof already is) and the soffit
//          (B at y1, facing down).
//   core:  the dark inner wall, `inset` behind the glass line (flush when the plate is too narrow for a recess).
//   steel: a solid corner column filling each convex corner of the recess (the glass line to the core), a plate along
//          each reflex corner's bisector, and flat plates every ~`every` m along each edge, each one `plateW` wide and
//          as deep as the recess.
// Why nothing is see-through: the slabs close the storey top and bottom, so a sight line inside it is a chord of the
// plan. The core leaves a frame `inset` deep; the plates cut that frame into cells — a rectangle between two plates on
// one edge, or a convex quad beside a corner — each bounded by the glass line on ONE side only. A line meets a convex
// cell's boundary twice: it enters through the open side and the second point is a plate or the core. A chord that
// cuts a convex corner without reaching the core is exactly a chord through the corner column's quad.
export function openStorey(outerA, outerB, y0, y1, { inset = GAP.inset, every = GAP.every, plateW = GAP.plateW, proud = GAP.proud, floor = true, underside = false, holes = [], minEdge = 1.2 } = {}) {
  let A = outerA, B = outerB
  if (signedArea(A) < 0) { A = [...A].reverse(); B = [...B].reverse() }
  // the slabs follow the glass line exactly
  const slabs = mesh()
  if (floor) capPoly(slabs, A, holes, y0)
  if (floor && underside) capPoly(slabs, A, holes, y0 - 0.05, true) // where no lower roof is under it, the floor's underside faces the air
  capPoly(slabs, B, holes, y1, true)
  // drop vertices that make edges shorter than `minEdge` (a curved or jagged outline would get a plate per vertex,
  // overlapping), on both rings alike so vertex i stays vertex i
  for (let i = 0; A.length > 3 && i < A.length;) {
    const j = (i + 1) % A.length
    if (Math.hypot(...sub2(A[j], A[i])) < minEdge) { A = A.filter((_, k) => k !== j); B = B.filter((_, k) => k !== j) } else i++
  }
  const n = A.length
  // a plate too narrow for a recess gets a flush core
  const minW = (2 * ringArea(A)) / perimeter(A)
  const d = minW > 2 * inset + 1 ? inset : 0
  const IA = d ? offsetRing(A, -d) : A, IB = d ? offsetRing(B, -d) : B
  const core = band(mesh(), IA, IB, y0, y1)
  const steel = mesh()
  const plate = (pa, pb, ta, tb, dep) => {
    // a plate centred on the glass-line points pa (y0) / pb (y1), `plateW` along the edge, from `proud` outside the
    // glass line to `dep` inside; its back face is against the core, its top and bottom against the slabs
    const ring = (p, t) => { const nn = outN(t), h = plateW / 2; return [add2(add2(p, mul2(t, -h)), mul2(nn, proud)), add2(add2(p, mul2(t, -h)), mul2(nn, -dep)), add2(add2(p, mul2(t, h)), mul2(nn, -dep)), add2(add2(p, mul2(t, h)), mul2(nn, proud))] }
    prism(steel, ring(pa, ta), ring(pb, tb), y0, y1)
  }
  const along = (P, I, tp, tn) => { const v = sub2(I, P), l = Math.hypot(...v); if (l < 1e-6) return [norm2(add2(tp, tn)), 0]; const u = mul2(v, 1 / l); return [[-u[1], u[0]], l] }
  const bisectorPlate = (i) => {
    const h = (i - 1 + n) % n, j = (i + 1) % n, tg = (R, k) => norm2(add2(norm2(sub2(R[k], R[h])), norm2(sub2(R[j], R[k]))))
    const [ta, la] = along(A[i], IA[i], tg(A, i), tg(A, i)), [tb] = along(B[i], IB[i], tg(B, i), tg(B, i))
    plate(A[i], B[i], ta, tb, la + 0.05)
  }
  for (let i = 0; i < n; i++) {
    const h = (i - 1 + n) % n, j = (i + 1) % n
    const tPrevA = norm2(sub2(A[i], A[h])), tNextA = norm2(sub2(A[j], A[i])), tPrevB = norm2(sub2(B[i], B[h])), tNextB = norm2(sub2(B[j], B[i]))
    const turn = tPrevA[0] * tNextA[1] - tPrevA[1] * tNextA[0]
    if (d && turn < -1e-3) {
      // convex corner (the ring turns toward its inside): the quad glass corner → foot on the next edge → core corner →
      // foot on the previous edge — exactly the part of the recess a corner-cutting sight line crosses
      const q = (P, I, tp, tn, lp, ln) => [P, add2(P, mul2(tn, Math.min(ln * 0.5, dot2(sub2(I, P), tn)))), I, add2(P, mul2(tp, Math.max(-lp * 0.5, dot2(sub2(I, P), tp))))]
      const lpA = Math.hypot(...sub2(A[i], A[h])), lnA = Math.hypot(...sub2(A[j], A[i])), lpB = Math.hypot(...sub2(B[i], B[h])), lnB = Math.hypot(...sub2(B[j], B[i]))
      const qa = q(A[i], IA[i], tPrevA, tNextA, lpA, lnA)
      const convex = (r) => { const c = r.map((p, k) => { const a = sub2(r[(k + 1) % 4], p), b = sub2(r[(k + 2) % 4], r[(k + 1) % 4]); return a[0] * b[1] - a[1] * b[0] }); return c.every((x) => x > 1e-4) || c.every((x) => x < -1e-4) }
      const qb = q(B[i], IB[i], tPrevB, tNextB, lpB, lnB)
      const stout = (r) => Math.min(Math.hypot(...sub2(r[1], r[0])), Math.hypot(...sub2(r[3], r[0]))) > plateW // not a sliver (a sharp petal tip gets a plate)
      if (ringArea(qa) > 0.05 && convex(qa) && convex(qb) && stout(qa) && stout(qb)) prism(steel, qa, qb, y0, y1)
      else bisectorPlate(i) // a near-straight or a very sharp corner (a petal tip): a plate from the glass corner to the core's
    } else {
      // reflex (or straight) corner, or a flush core: a plate on the bisector, from the glass corner to the core's
      // corner (outN(t) = −u: the plate's depth runs along u, toward the core)
      bisectorPlate(i)
    }
    // plates along the edge i → j
    const len = Math.hypot(...sub2(A[j], A[i])), k = Math.max(1, Math.round(len / every))
    if (len < 2 * plateW + 0.5) continue
    for (let m = 1; m < k; m++) plate(lerp2(A[i], A[j], m / k), lerp2(B[i], B[j], m / k), tNextA, tNextB, d + 0.05)
  }
  return { slabs, core, steel }
}

// Steel posts under a canopy's edges, from y0 (the ground or a lower roof) up to its soffit at y1.
function canopyPosts(outer, y0, y1, { w = GAP.postW, every = GAP.postEvery } = {}) {
  const r = ensureCCW(outer), out = mesh()
  for (let i = 0; i < r.length; i++) {
    const j = (i + 1) % r.length, dd = sub2(r[j], r[i]), len = Math.hypot(...dd)
    if (len < 0.5) continue
    const t = mul2(dd, 1 / len), nn = outN(t), k = Math.max(1, Math.round(len / every))
    for (let m = 0; m < k; m++) {
      const c = add2(lerp2(r[i], r[j], m / k), add2(mul2(t, m === 0 ? w / 2 : 0), mul2(nn, -w / 2)))
      const sq = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => add2(c, add2(mul2(t, (a * w) / 2), mul2(nn, (b * w) / 2))))
      prism(out, sq, sq, y0, y1)
    }
  }
  return out
}

// ── Finding gaps ─────────────────────────────────────────────────────────────────────────────────────────────
// For each drawn piece standing above the ground: the part of its footprint that no lower piece reaches (within
// `tol` of its base). Each region gets the height it opens from (the highest lower roof under it, or the ground) and a
// kind: 'canopy' for an OSM roof part, 'facade' for a sliver, otherwise 'storey'.
export function findGaps(pieces, { minArea = GAP.minArea, minFrac = GAP.minFrac, tol = GAP.tol, minH = GAP.minH, sliverW = GAP.sliverW, overhangM = GAP.overhangM } = {}) {
  const out = []
  pieces.forEach((P, pi) => {
    if (!(P.base > minH) || P.top <= P.base) return
    const pa = ringArea(P.outer)
    const below = pieces.filter((Q) => Q !== P && (Q.base ?? 0) < P.base - 0.01)
    const support = below.filter((Q) => Q.top >= P.base - tol)
    let unc
    try { unc = support.length ? pc.difference(polyOf(P), ...support.map(polyOf)) : [polyOf(P)] } catch { return }
    const ua = mpArea(unc)
    if (ua < Math.max(minArea, minFrac * pa)) return
    for (const pg of unc) {
      const outer = pg[0].slice(0, -1), holes = pg.slice(1).map((h) => h.slice(0, -1))
      const a = ringArea(outer) - holes.reduce((s, h) => s + ringArea(h), 0)
      if (a < minArea) continue
      // the highest lower roof under this region (or the ground)
      let y0 = 0, under = 0
      const lows = []
      for (const Q of below) {
        if (Q.top >= P.base - tol) continue
        let ia = 0
        try { ia = mpArea(pc.intersection([pg], polyOf(Q))) } catch { continue }
        if (ia > 0.02 * a) { y0 = Math.max(y0, Q.top); lows.push(Q) }
      }
      // the share of the region with anything under it (the union: overlapping lower pieces count once)
      try { if (lows.length) under = mpArea(pc.intersection([pg], pc.union(...lows.map(polyOf)))) } catch { under = 0 }
      if (P.base - y0 < minH) continue
      const width = (2 * a) / perimeter(outer)
      // over open ground: a building on stilts if it is low, otherwise a cantilever or ledge (open air under a soffit)
      const ground = y0 < minH || under < 0.5 * a, kind = P.role === 'roof' ? 'canopy' : ground && (P.base > overhangM || width < sliverW) ? 'overhang' : width < sliverW ? 'facade' : 'storey'
      out.push({ piece: pi, outer: simplifyRing(outer, 0.2), holes, area: a, y0, y1: P.base, under: Math.min(1, under / a), width, kind })
    }
  })
  return out
}

// ── Closing gaps ─────────────────────────────────────────────────────────────────────────────────────────────
// `lift` raises an open-air soffit a little into the piece above, under a sculpt's own soffit (no coplanar fight).
// Meshes in the extraMeshes shape the tile writer takes ({ facade, seed, style, part, lod0Only }); facade undefined is
// the building's own façade family (a 'facade' fill). `verdict` (data/gaps.json) can force a kind.
export function closeGap(g, { coreStyle = 'gap-core', steelStyle = 'gap-steel', kind = g.kind, lift = 0 } = {}) {
  const tag = (m, facade, style, part) => Object.assign(m, { facade, seed: 0.5, style, part, lod0Only: false })
  if (kind === 'facade') return [tag(extrudeBuilding({ outer: g.outer, holes: g.holes, base: g.y0, top: g.y1 }), undefined, undefined, 'gap-facade')]
  if (kind === 'overhang' || kind === 'arcade') return [tag(capPoly(mesh(), ensureCCW(g.outer), g.holes, g.y1 + lift, true), F.paint, coreStyle, 'gap-soffit')] // a cantilever's or arcade's underside: open air below
  if (kind === 'canopy') {
    const soffit = capPoly(mesh(), ensureCCW(g.outer), g.holes, g.y1, true)
    return [tag(soffit, F.paint, coreStyle, 'gap-soffit'), tag(canopyPosts(g.outer, g.y0, g.y1), F.steel, steelStyle, 'gap-posts')]
  }
  const s = openStorey(g.outer, g.outer, g.y0, g.y1, { floor: g.under < 0.95, underside: g.under < 0.95, holes: g.holes })
  return [tag(merge(s.slabs, s.core), F.paint, coreStyle, 'gap-core'), tag(s.steel, F.steel, steelStyle, 'gap-steel')]
}

// Every gap of a building, closed: { gaps, meshes }. `verdict` (data/gaps.json) forces a kind for all its gaps.
export function closeGaps(pieces, { verdict } = {}) {
  const gaps = findGaps(pieces).map((g) => ({ ...g, kind: verdict ?? g.kind }))
  return { gaps, meshes: gaps.flatMap((g) => closeGap(g)) }
}

// open air under a roof, a cantilever or an arcade: a sight line may pass under it, never into a hollow
export const OPEN_AIR = new Set(['canopy', 'overhang', 'arcade'])

// ── Audit ────────────────────────────────────────────────────────────────────────────────────────────────────
// Sight lines into a gap: rays aimed from outside at points inside the gap region (its centre, and just inside every
// corner and edge midpoint), from `az` compass directions and three pitches, at several heights in the storey. A ray
// that hits nothing went straight through the building (see-through); a ray whose first hit is a back face looked
// into a hollow (an invisible interior). Both must be zero. `tris` is [[a, b, c], …] (xyz triples; front = the side
// its normal faces). A canopy is open air underneath: only hollows count there.
export function auditGap(tris, g, { az = 24, pitches = [-0.3, 0, 0.3], log = null, seam = 0 } = {}) {
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  const pre = tris.map(([a, b, c, n]) => { const e1 = sub(b, a), e2 = sub(c, a); return { a, e1, e2, n: n ?? cross(e1, e2) } })
  const first = (o, d) => {
    let best = Infinity, front = true, hit = -1
    for (let i = 0; i < pre.length; i++) {
      const { a, e1, e2, n } = pre[i], p = cross(d, e2), det = dot(e1, p)
      if (Math.abs(det) < 1e-12) continue
      const inv = 1 / det, s = sub(o, a), u = dot(s, p) * inv
      if (u < 0 || u > 1) continue
      const q = cross(s, e1), v = dot(d, q) * inv
      if (v < 0 || u + v > 1) continue
      const t = dot(e2, q) * inv
      // a coplanar pair (a cap on a soffit, two touching plates) draws its front face: a tie within 2 cm goes to the front
      const f = dot(n, d) < 0
      if (!(t > 1e-6)) continue
      if (t < best - 0.02) { front = f; best = t; hit = i }
      else if (t <= best + 0.02) { if (f && !front) { front = true; hit = i } if (t < best) best = t }
    }
    return best < Infinity ? { front, hit, t: best } : null
  }
  const r = ensureCCW(g.outer), c = r.reduce((s, p) => add2(s, mul2(p, 1 / r.length)), [0, 0])
  const inner = offsetRing(r, -0.3), cand = [c, ...inner]
  for (let i = 0; i < r.length; i++) {
    const j = (i + 1) % r.length, t = norm2(sub2(r[j], r[i]))
    cand.push(add2(lerp2(r[i], r[j], 0.5), mul2(outN(t), -0.3)))
  }
  const targets = cand.filter((p) => pointInRing(p, r) && !(g.holes ?? []).some((h) => pointInRing(p, h)))
  // every ray starts just outside the building's plan (never inside another of its pieces)
  let reach = 0
  for (const t of tris) for (let k = 0; k < 3; k++) reach = Math.max(reach, Math.hypot(t[k][0] - c[0], t[k][2] - c[1]))
  const R = 2 * reach + 5
  let rays = 0, through = 0, hollow = 0
  // a hollow counts where the sight line meets the gap (`seam`: a built tile's positions are quantised to ~3 cm, so a
  // grazing line along a slab's edge may slip through the seam; tests on built tiles pass seam: 0.3): within 1.5 m of its plan and its storey (a sculpt's open fin
  // or crown elsewhere on the building is not this gap's business)
  const xs = r.map((p) => p[0]), zs = r.map((p) => p[1]), m = 1.5
  const near = (o, d, t) => { const x = o[0] + d[0] * t, y = o[1] + d[1] * t, z = o[2] + d[2] * t; return x > Math.min(...xs) - m && x < Math.max(...xs) + m && z > Math.min(...zs) - m && z < Math.max(...zs) + m && y > g.y0 - m && y < g.y1 + m && Math.abs(y - g.y0) > seam && Math.abs(y - g.y1) > seam }
  const hs = [0.2, 0.5, 0.8].map((f) => g.y0 + (g.y1 - g.y0) * f)
  for (const T of targets) for (const y of hs) for (let k = 0; k < az; k++) for (const pt of pitches) {
    const a = ((k + 0.37) / az) * Math.PI * 2, d0 = [Math.sin(a), pt, -Math.cos(a)], l = Math.hypot(...d0), d = d0.map((v) => v / l)
    const o = [T[0] - d[0] * R, y - d[1] * R, T[1] - d[2] * R]
    if (o[1] < 0.2) continue // a sight line from under the ground
    rays++
    const h = first(o, d)
    if (!h) through++
    else if (!h.front && near(o, d, h.t)) { hollow++; log?.push({ o, d, ...h }) }
  }
  // and looking up from the floor of the gap: the soffit, never the hollow inside of the piece above
  let up = 0
  for (const T of targets) for (const [dx, dz] of [[0, 0]]) {
    const l = Math.hypot(dx, 1, dz), h = first([T[0], g.y0 + 0.1, T[1]], [dx / l, 1 / l, dz / l])
    rays++
    // (a start inside a steel plate meets the plate's own leaning side first: only a flat face is the soffit's business)
    const flat = h && Math.abs(pre[h.hit].n[1]) > 0.5 * Math.hypot(...pre[h.hit].n)
    if (!h || (!h.front && flat)) { up++; log?.push({ up: T, ...h }) }
  }
  return { rays, through: OPEN_AIR.has(g.kind) ? 0 : through, hollow: hollow + up }
}
// a mesh's triangles as [[a, b, c, n], …] (n: the stored normal, which says which side is the front)
export function trisOf(m) {
  const out = [], P = m.positions, N = m.normals
  for (let i = 0; i < P.length; i += 9) out.push([[P[i], P[i + 1], P[i + 2]], [P[i + 3], P[i + 4], P[i + 5]], [P[i + 6], P[i + 7], P[i + 8]], [N[i] + N[i + 3] + N[i + 6], N[i + 1] + N[i + 4] + N[i + 7], N[i + 2] + N[i + 5] + N[i + 8]]])
  return out
}
