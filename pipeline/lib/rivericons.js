// pipeline/lib/rivericons.js — the Chicago River's icons to the Tribune/Wrigley standard (Workstream A, plan
// 2026-10-01 §2). One sculpt per building, each taking its OSM massing (pieces) and its sourced sculptParams
// (heroes.json) and returning close-range detail: piers, fins, bands, colonnades, cupolas, clocks, spires.
// A sculpt never edits the Lincoln Park or icons.js heroes; heroes.js#applyHero routes `spec.sculpt` here by name
// and treats a name it does not know as a no-op.
//
// A sculpt returns { pieces?, meshes } where each mesh is { mesh, facade, seed, style, part, lod1 }:
//   - facade undefined = the building's own façade family (walls with windows, coloured by the hero look);
//   - lod1 true keeps the mesh in the LOD1 tiles and 2 km blocks (silhouette and crown); detail is LOD0 only;
//   - a piece with hidden: true still counts for the hover height, trees and clearance, but is not drawn (a
//     sculpted body, e.g. St. Regis's frustums, draws itself).
import earcut from 'earcut'
import polygonClipping from 'polygon-clipping'
import { ensureCCW, ringCentroid, pointInRing, signedArea } from './geom.js'
import { orientedBox, lathe, DOME } from './sacred.js'
import { drum, spire } from './crowns.js'
import { wallPolygon } from './icons.js'
import { add2, sub2, mul2, dot2, norm2, norm3, cross3, left, bearing, mesh, tri, quad, merge, slab, tube, barrel } from './meshkit.js'
import { LANDMARK_FACADES as F } from './facadeIds.js'
import { project } from '../../shared/project.js'

export const part = (m, facade, style, name, { lod1 = false, seed = 0.5 } = {}) => ({ mesh: m, facade, seed, style, part: name, lod1 })
const Y = (p, y) => [p[0], y, p[1]]
const area = (r) => Math.abs(signedArea(r))
const tallest = (pieces) => pieces.reduce((a, p) => (p.top > a.top ? p : a))
const widest = (pieces) => pieces.reduce((a, p) => (area(p.outer) > area(a.outer) ? p : a))

// ── Rings ─────────────────────────────────────────────────────────────────────────────────────────────────────
// Every edge of a ring with its unit direction t and outward normal n (rings are made CCW on the map first).
export function edgesOf(ring, minLen = 0.05) {
  const r = ensureCCW(ring), out = []
  for (let i = 0; i < r.length; i++) {
    const a = r[i], b = r[(i + 1) % r.length], d = sub2(b, a), len = Math.hypot(...d)
    if (len < minLen) continue
    const t = mul2(d, 1 / len)
    out.push({ a, b, t, n: [-t[1], t[0]], len, mid: mul2(add2(a, b), 0.5) })
  }
  return out
}
// Grow (d > 0) or shrink (d < 0) a ring along its corner bisectors, the miter capped at 3|d|.
export function offsetRing(ring, d) {
  const r = ensureCCW(ring), n = r.length
  const out = (a, b) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l] }
  return r.map((p, i) => {
    const n0 = out(r[(i - 1 + n) % n], p), n1 = out(p, r[(i + 1) % n])
    const bis = norm2(add2(n0, n1)), c = Math.max(0.33, dot2(bis, n1))
    return add2(p, mul2(bis, d / c))
  })
}
export const scaleRing = (ring, c, s) => ring.map(([x, z]) => [c[0] + (x - c[0]) * s, c[1] + (z - c[1]) * s])
export const polyRing = (c, r, n, rotDeg = 0) => Array.from({ length: n }, (_, i) => { const a = ((i + 0.5) / n) * Math.PI * 2 + (rotDeg * Math.PI) / 180; return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)] })
// A rectangle on the oriented box of `ring`, scaled, with its corners cut by `chamfer` metres (35 E Wacker's tower).
export function boxRing(ring, { s = 1, chamfer = 0, L, W } = {}) {
  const ob = orientedBox(ring), hl = (L ?? ob.L * s) / 2, hw = (W ?? ob.W * s) / 2, P = (a, b) => add2(add2(ob.c, mul2(ob.u, a)), mul2(ob.v, b))
  if (!chamfer) return [P(-hl, -hw), P(hl, -hw), P(hl, hw), P(-hl, hw)]
  const c = Math.min(chamfer, hl * 0.45, hw * 0.45)
  return [P(-hl + c, -hw), P(hl - c, -hw), P(hl, -hw + c), P(hl, hw - c), P(hl - c, hw), P(-hl + c, hw), P(-hl, hw - c), P(-hl, -hw + c)]
}
// The edges of a ring that face a compass bearing (within `tol` degrees): a building's river or avenue face.
export const facing = (edges, deg, tol = 50) => { const f = bearing(deg); return edges.filter((e) => dot2(e.n, f) >= Math.cos((tol * Math.PI) / 180)) }

// The wall runs of a set of pieces that are open air: each edge from the top of whatever stands against it
// (a lower neighbour's roof) up to its own top (Willis's fins, generalised).
export function exposedEdges(pieces, minLen = 0.8) {
  const out = []
  for (const p of pieces) for (const e of edgesOf(p.outer, minLen)) {
    const probe = add2(e.mid, mul2(e.n, 0.6))
    const hidden = Math.max(p.base ?? 0, ...pieces.filter((q) => q !== p && pointInRing(probe, q.outer)).map((q) => q.top))
    if (hidden < p.top - 0.5) out.push({ ...e, y0: hidden, y1: p.top })
  }
  return out
}

// ── Meshes ────────────────────────────────────────────────────────────────────────────────────────────────────
// A fin or pier standing `d` proud of a wall: its face, two sides and a top (never seen from inside or below).
export function finAt(out, at, t, n, w, d, y0, y1, cap = true) {
  const Q = (s, dd, y) => [at[0] + t[0] * s + n[0] * dd, y, at[1] + t[1] * s + n[1] * dd]
  quad(out, Q(-w / 2, d, y0), Q(w / 2, d, y0), Q(w / 2, d, y1), Q(-w / 2, d, y1), [n[0], 0, n[1]], [0, y0, w, y1])
  for (const s of [-1, 1]) quad(out, Q((s * w) / 2, 0, y0), Q((s * w) / 2, d, y0), Q((s * w) / 2, d, y1), Q((s * w) / 2, 0, y1), [t[0] * s, 0, t[1] * s], [0, y0, d, y1])
  if (cap) quad(out, Q(-w / 2, 0, y1), Q(w / 2, 0, y1), Q(w / 2, d, y1), Q(-w / 2, d, y1), [0, 1, 0])
  return out
}
// Fins along wall runs, `every` metres apart (rounded so they space evenly), one at each run's start corner.
export function fins(out, edges, { every, w = 0.3, d = 0.3, y0, y1 }) {
  for (const e of edges) {
    const lo = Math.max(y0 ?? -Infinity, e.y0 ?? -Infinity), hi = Math.min(y1 ?? Infinity, e.y1 ?? Infinity)
    if (!(hi > lo) || !Number.isFinite(lo) || !Number.isFinite(hi)) continue
    const k = Math.max(1, Math.round(e.len / every))
    for (let i = 0; i < k; i++) finAt(out, add2(e.a, mul2(e.t, (i * e.len) / k)), e.t, e.n, w, d, lo, hi, w > 0.35) // a thin fin's top is never seen
  }
  return out
}
// Horizontal bands (belt courses, spandrel ribs, cornices) along wall runs: face, top and soffit.
export function bands(out, edges, { ys, h, d, ext = d }) {
  for (const e of edges) for (const y of ys) {
    if (e.y0 != null && (y < e.y0 - 0.01 || y + h > e.y1 + 0.01)) continue
    const a = add2(e.a, mul2(e.t, -ext)), b = add2(e.b, mul2(e.t, ext)), o = mul2(e.n, d)
    quad(out, Y(add2(a, o), y), Y(add2(b, o), y), Y(add2(b, o), y + h), Y(add2(a, o), y + h), [e.n[0], 0, e.n[1]], [0, y, e.len, y + h])
    quad(out, Y(a, y + h), Y(b, y + h), Y(add2(b, o), y + h), Y(add2(a, o), y + h), [0, 1, 0])
    if (d > 0.5) quad(out, Y(a, y), Y(b, y), Y(add2(b, o), y), Y(add2(a, o), y), [0, -1, 0]) // a thin band's soffit reads as its face
  }
  return out
}
// A flat cap over a ring at height y (earcut), facing up.
export function capRing(out, ring, y, down = false) {
  const flat = ring.flatMap((p) => p), ids = earcut(flat)
  for (let i = 0; i < ids.length; i += 3) tri(out, Y(ring[ids[i]], y), Y(ring[ids[i + 1]], y), Y(ring[ids[i + 2]], y), [0, down ? -1 : 1, 0], ring[ids[i]], ring[ids[i + 1]], ring[ids[i + 2]])
  return out
}
// Walls between rings of equal length at heights ys (a frustum stack, a tapering shaft), with metre UVs so the
// façade shader lays its windows on them like on any extruded wall; the last ring is capped.
export function loft(rings, ys, { cap = true } = {}) {
  const out = mesh()
  for (let k = 0; k + 1 < rings.length; k++) {
    const A = ensureCCW(rings[k]), B = ensureCCW(rings[k + 1]) // same vertex order on both rings (a scaled or offset copy)
    let u = 0
    for (let i = 0; i < A.length; i++) {
      const j = (i + 1) % A.length, d = sub2(A[j], A[i]), len = Math.hypot(...d)
      if (len < 1e-6) continue
      const n = [-d[1] / len, d[0] / len]
      quad(out, Y(A[i], ys[k]), Y(A[j], ys[k]), Y(B[j], ys[k + 1]), Y(B[i], ys[k + 1]), [n[0], 0, n[1]], [u, ys[k], u + len, ys[k + 1]])
      u += len
    }
  }
  if (cap) capRing(out, rings.at(-1), ys.at(-1))
  return out
}
// Round columns on a circle (a tholos), each a short-sided drum with a square abacus.
export function columnsOnCircle(out, c, r, n, y0, y1, cr, sides = 8) {
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) / n) * Math.PI * 2, at = [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]
    const m = merge(drum({ at, base: y0, top: y1 - cr * 0.7, r: cr, sides }), slab(mesh(), at, [Math.cos(a), Math.sin(a)], cr * 2.6, cr * 2.6, y1 - cr * 0.7, y1))
    for (const k of ['positions', 'normals', 'uvs']) out[k].push(...m[k])
  }
  return out
}
// Round columns standing proud of a wall run, `n` of them evenly spaced inside it.
export function columnsAlong(out, e, n, y0, y1, cr, proud, sides = 8) {
  for (let i = 0; i < n; i++) {
    const at = add2(add2(e.a, mul2(e.t, ((i + 0.5) * e.len) / n)), mul2(e.n, proud))
    const m = merge(drum({ at, base: y0, top: y1 - cr * 0.7, r: cr, sides }), slab(mesh(), at, e.t, cr * 2.6, cr * 2.6, y1 - cr * 0.7, y1))
    for (const k of ['positions', 'normals', 'uvs']) out[k].push(...m[k])
  }
  return out
}
// A clock face (disc, bezel, hour marks, hands) on a wall at `o` facing `d`; the face is lit at night (façade 27).
export function clockFace(face, hands, o, d, cy, r) {
  const al = left(d), pts = []
  for (let k = 0; k < 28; k++) { const a = (k / 28) * Math.PI * 2; pts.push([r * Math.cos(a), cy + r * Math.sin(a)]) }
  wallPolygon(face, o, al, d, pts, 0.1)
  for (let k = 0; k < 28; k++) {
    const a0 = (k / 28) * Math.PI * 2, a1 = ((k + 1) / 28) * Math.PI * 2, r1 = r * 1.12
    wallPolygon(hands, o, al, d, [[r * Math.cos(a0), cy + r * Math.sin(a0)], [r1 * Math.cos(a0), cy + r1 * Math.sin(a0)], [r1 * Math.cos(a1), cy + r1 * Math.sin(a1)], [r * Math.cos(a1), cy + r * Math.sin(a1)]], 0.12)
  }
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2, c0 = Math.cos(a), s0 = Math.sin(a), t = [-s0 * r * 0.035, c0 * r * 0.035]
    wallPolygon(hands, o, al, d, [[0.78 * r * c0 + t[0], cy + 0.78 * r * s0 + t[1]], [0.93 * r * c0 + t[0], cy + 0.93 * r * s0 + t[1]], [0.93 * r * c0 - t[0], cy + 0.93 * r * s0 - t[1]], [0.78 * r * c0 - t[0], cy + 0.78 * r * s0 - t[1]]], 0.14)
  }
  const w = r * 0.04
  wallPolygon(hands, o, al, d, [[-w, cy], [w, cy], [w, cy + r * 0.8], [-w, cy + r * 0.8]], 0.18) // minute hand at twelve
  wallPolygon(hands, o, al, d, [[0, cy - w], [r * 0.55, cy - w], [r * 0.55, cy + w], [0, cy + w]], 0.2) // hour hand at three
}
// A dome of radius r springing at y0 (height r × rise), with an optional lantern drum and finial above.
export function domeOn(at, y0, r, { rise = 1, sides = 20 } = {}) {
  const prof = DOME.map(([a, b]) => [a, b * rise])
  return lathe(at, y0, r, prof, sides)
}
// Dark openings (arches, louvres, slots) drawn on a wall run: a polygon in (s along the run, y) pushed `proud`.
export function openingsAlong(out, e, n, y0, y1, w, { arch = true, proud = 0.08 } = {}) {
  for (let i = 0; i < n; i++) {
    const s = ((i + 0.5) * e.len) / n, pts = [[s - w / 2, y0], [s + w / 2, y0]]
    if (arch) for (let k = 0; k <= 8; k++) { const a = (k / 8) * Math.PI; pts.push([s + (w / 2) * Math.cos(a), y1 - w / 2 + (w / 2) * Math.sin(a)]) }
    else pts.push([s + w / 2, y1], [s - w / 2, y1])
    wallPolygon(out, e.a, e.t, e.n, pts, proud)
  }
  return out
}
const pushAll = (out, m) => { for (const k of ['positions', 'normals', 'uvs']) out[k].push(...m[k]); return out }

// ── Tier 1 (A-3) ──────────────────────────────────────────────────────────────────────────────────────────────

// Trump International Hotel & Tower (Adrian Smith / SOM, 2009). OSM already maps the three setbacks and the core;
// the sculpt adds the polished-stainless mullion fins (every other 1.5 m mullion, so they read without shimmering),
// stainless ledges at each rounded setback, and the telescoping stainless spire from the 357 m roof to 423 m.
function trump({ pieces, sp, main }) {
  const roof = sp.roofM ?? 357, tip = sp.spireTopM ?? 423.2
  // OSM draws the spire as three stacked thin cylinders: the sculpt replaces them with one tapering mast
  // OSM's parts cover the footprint, so the 60 m podium (the setback on the Wrigley cornice line) is not drawn:
  // the building's own outline at podiumM restores it
  const podium = sp.podiumM && main ? [{ outer: main.outer, holes: main.holes ?? [], base: 0, top: sp.podiumM }] : []
  const body = [...podium, ...pieces.filter((p) => !(area(p.outer) < 40 && p.top > roof - 1))]
  const spireAt = ringCentroid((pieces.filter((p) => area(p.outer) < 40 && p.top > roof - 1)[0] ?? tallest(body)).outer)
  const edges = exposedEdges(body)
  const fin = fins(mesh(), edges.filter((e) => e.y1 <= roof - 5), { every: sp.finEvery ?? 3.0, w: 0.28, d: 0.32 })
  const ledges = bands(mesh(), edges, { ys: [...new Set(edges.map((e) => e.y1))].filter((y) => y < roof - 5).map((y) => y - 1.4), h: 1.4, d: 0.35 })
  const mast = mesh(), secs = sp.spire ?? [[roof, roof + 23, 1.7, 1.25], [roof + 23, roof + 48, 1.05, 0.75], [roof + 48, tip, 0.55, 0.12]]
  for (const [y0, y1, r0, r1] of secs) {
    pushAll(mast, spire({ at: spireAt, base: y0, top: y1, r0, r1: r1 > 0.2 ? r1 : 0, sides: 12 }))
    pushAll(mast, drum({ at: spireAt, base: y0, top: y0 + 1.2, r: r0 + 0.35, sides: 12 })) // the collar at each telescoping joint
  }
  return {
    pieces: body,
    meshes: [part(fin, F.paint, 'trump-stainless', 'fins'), part(ledges, F.paint, 'trump-stainless', 'ledges'), part(mast, F.paint, 'trump-stainless', 'spire', { lod1: true })],
  }
}

// St. Regis Chicago (Studio Gang, 2020): three stacks of alternating frustums, each leaning out 1.6 m over 13 floors
// and back over the next 13 (a 24.4 m ↔ 27.4 m floor plate); glass dark at a frustum's waist and bright at its belt
// (six shades, three rows here); the open blow-through floor near the top of the tallest stack.
function stregis({ pieces, sp }) {
  const stacks = pieces.filter((p) => p.top > (sp.stackMinM ?? 100)).sort((a, b) => b.top - a.top)
  const module = sp.moduleM ?? 47, sMin = sp.waistScale ?? 0.89, meshes = []
  const shades = [mesh(), mesh(), mesh()]
  stacks.forEach((p, idx) => {
    const c = ringCentroid(p.outer), phase = idx === 1 ? 1 : 0 // the middle stack's belts meet the outer stacks' waists
    const sAt = (y) => { const k = Math.floor(y / module), f = y / module - k, up = (k + phase) % 2 === 0; return up ? sMin + (1 - sMin) * f : 1 - (1 - sMin) * f }
    const gap = idx === 0 && sp.gapM ? [sp.gapM, sp.gapM + (sp.gapH ?? 7.2)] : null
    let y = 0
    while (y < p.top - 0.01) {
      const yEnd = Math.min(p.top, (Math.floor(y / module + 1e-9) + 1) * module)
      // thirds of each frustum: the shade follows the plate width (narrow = dark)
      for (let t = 0; t < 3; t++) {
        let a = y + ((yEnd - y) * t) / 3, b = y + ((yEnd - y) * (t + 1)) / 3
        const mid = (a + b) / 2, s = sAt(mid), shade = s < sMin + (1 - sMin) / 3 ? 0 : s < sMin + (2 * (1 - sMin)) / 3 ? 1 : 2
        if (gap && b > gap[0] && a < gap[1]) {
          // the blow-through: a recessed open floor (the core only) between gap[0] and gap[1]
          if (a < gap[0]) pushAll(shades[shade], loft([scaleRing(p.outer, c, sAt(a)), scaleRing(p.outer, c, sAt(gap[0]))], [a, gap[0]], { cap: false }))
          meshes.push(part(loft([scaleRing(p.outer, c, 0.42), scaleRing(p.outer, c, 0.42)], [gap[0], gap[1]], { cap: false }), F.paint, 'stregis-gap', 'blow-through'))
          meshes.push(part(capRing(mesh(), scaleRing(p.outer, c, sAt(gap[0])), gap[0], true), F.paint, 'stregis-gap', 'gap-soffit'))
          meshes.push(part(capRing(mesh(), scaleRing(p.outer, c, sAt(gap[1])), gap[1]), F.paint, 'stregis-gap', 'gap-floor'))
          if (b > gap[1]) pushAll(shades[shade], loft([scaleRing(p.outer, c, sAt(gap[1])), scaleRing(p.outer, c, sAt(b))], [gap[1], b], { cap: false }))
          continue
        }
        pushAll(shades[shade], loft([scaleRing(p.outer, c, sAt(a)), scaleRing(p.outer, c, sAt(b - 1e-6))], [a, b], { cap: false }))
      }
      y = yEnd
    }
    capRing(shades[2], scaleRing(p.outer, c, sAt(p.top - 1e-6)), p.top)
  })
  shades.forEach((m, i) => meshes.push(part(m, undefined, `stregis-glass-${i + 1}`, `frustums-${i + 1}`, { lod1: true })))
  return { pieces: pieces.map((p) => (stacks.includes(p) ? { ...p, hidden: true } : p)), meshes }
}

// 333 W Wacker (KPF, 1983): the green reflective glass bow on the river bend, ribbed by stainless bands at every floor,
// over a four-storey base striped in green Vermont Verde Antique serpentine and grey granite, with the octagonal
// granite columns that carry the curved river front.
function wacker333({ pieces, sp }) {
  const body = widest(pieces), top = body.top, base = sp.baseM ?? 16.5, floor = sp.floorM ?? (top - base) / (sp.floors ?? 32)
  const edges = edgesOf(body.outer, 0.4).map((e) => ({ ...e, y0: 0, y1: top }))
  const ribs = bands(mesh(), edges, { ys: Array.from({ length: Math.floor((top - base) / floor) }, (_, i) => base + (i + 1) * floor - 0.5).filter((y) => y < top - 1), h: 0.45, d: 0.14, ext: 0.05 })
  const course = sp.courseM ?? 1.1, green = mesh(), grey = mesh()
  for (let i = 0, y = 0; y < base - 0.01; i++, y += course) bands(i % 2 ? grey : green, edges, { ys: [y], h: Math.min(course, base - y), d: 0.12, ext: 0.12 })
  // the river front: octagonal columns along the curved face, standing clear of the set-back lobby glass
  const river = facing(edges, sp.riverFace ?? 315, sp.riverTol ?? 55), cols = mesh()
  for (const e of river) { const n = Math.max(1, Math.round(e.len / (sp.columnEvery ?? 9))); for (let i = 0; i < n; i++) pushAll(cols, drum({ at: add2(add2(e.a, mul2(e.t, ((i + 0.5) * e.len) / n)), mul2(e.n, 1.6)), base: 0, top: base, r: 0.95, sides: 8 })) }
  const cap = bands(mesh(), edges, { ys: [top - 1.2], h: 1.2, d: 0.25 })
  return {
    pieces,
    meshes: [part(ribs, F.paint, 'wacker333-stainless', 'ribs'), part(cap, F.paint, 'wacker333-stainless', 'cap'), part(green, F.stone, 'verde-antique', 'base-serpentine'), part(grey, F.stone, 'wacker333-granite', 'base-granite'), part(cols, F.stone, 'wacker333-granite', 'river-columns')],
  }
}

// 330 N Wabash (Mies van der Rohe with C. F. Murphy, 1972): a plain black slab on a 5 ft (1.52 m) module — bronze-
// anodised aluminium I-beam mullions at every module, a louvred mechanical band at the top, and the 26 ft glass lobby
// set back behind the exposed columns on their 30 ft bays.
function wabash330({ pieces, sp }) {
  const body = widest(pieces), top = body.top, lobby = sp.lobbyM ?? 7.9
  const lobbyRing = offsetRing(body.outer, -(sp.lobbySetbackM ?? 3.0))
  const out = [{ ...body, base: 0, top: lobby, outer: lobbyRing, holes: [] }, { ...body, base: lobby, top }]
  const edges = edgesOf(body.outer, 1)
  const mull = fins(mesh(), edges, { every: sp.moduleM ?? 1.524, w: 0.16, d: 0.22, y0: lobby, y1: top - (sp.louvreM ?? 8) })
  const cols = mesh()
  for (const e of edges) { const k = Math.max(1, Math.round(e.len / (sp.bayM ?? 9.14))); for (let i = 0; i <= k; i++) finAt(cols, add2(e.a, mul2(e.t, (i * e.len) / k)), e.t, mul2(e.n, -1), 0.7, 0.7, 0, lobby) }
  const louvre = bands(mesh(), edges.map((e) => ({ ...e, y0: 0, y1: top })), { ys: [top - (sp.louvreM ?? 8)], h: (sp.louvreM ?? 8), d: 0.1, ext: 0.1 })
  const soffit = capRing(mesh(), body.outer, lobby, true)
  return {
    pieces: out,
    meshes: [part(mull, F.paint, 'mies-bronze-black', 'mullions'), part(cols, F.paint, 'mies-bronze-black', 'columns'), part(louvre, F.grid, 'mies-bronze-black', 'louvres', { lod1: true }), part(soffit, F.paint, 'mies-bronze-black', 'soffit')],
  }
}

// A tempietto: a round temple of columns under an entablature and a small dome (35 E Wacker's corner pavilions,
// the London Guarantee's tholos), with a drum base and an optional lantern and finial.
export function tempietto({ at, base, r, cols, colH, baseH = 1.2, entH = 1.2, domeR = r * 0.92, rise = 0.9, lantern = 0, finial = 0, sides = 20 }) {
  const stone = mesh(), dome = mesh()
  pushAll(stone, drum({ at, base, top: base + baseH, r: r + 0.35, sides }))
  columnsOnCircle(stone, at, r, cols, base + baseH, base + baseH + colH, Math.max(0.28, r * 0.09))
  pushAll(stone, drum({ at, base: base + baseH, top: base + baseH + colH, r: r * 0.62, sides })) // the cella wall behind the columns
  const ent = base + baseH + colH
  pushAll(stone, drum({ at, base: ent, top: ent + entH, r: r + 0.3, sides }))
  pushAll(dome, domeOn(at, ent + entH, domeR, { rise, sides }))
  let y = ent + entH + domeR * rise
  if (lantern) { pushAll(stone, drum({ at, base: y - 0.3, top: y + lantern, r: Math.max(0.5, domeR * 0.22), sides: 8 })); y += lantern }
  const fin = finial ? spire({ at, base: y - 0.1, top: y + finial, r0: Math.max(0.2, domeR * 0.08), sides: 8 }) : null
  return { stone, dome, fin, top: y + finial }
}

// 35 E Wacker, the Jewelers Building (Giaver & Dinkelberg, 1926): a buff terra-cotta block of 23 floors with a dark
// green band under its cornice, four columned corner tempietti on its roof (they hid water tanks), the chamfered
// tower, and the domed belvedere temple on top — floodlit gold at night.
function jewelers35({ pieces, sp, b }) {
  const block = widest(pieces), blockTop = sp.blockM ?? 92, crownTop = sp.topM ?? 159.4
  const towerP = pieces.filter((p) => p !== block && area(p.outer) > 150).reduce((a, p) => (!a || area(p.outer) > area(a.outer) ? p : a), null) ?? block
  const t1 = boxRing(towerP.outer, { chamfer: sp.chamferM ?? 3.5 }), c = ringCentroid(t1), tc = ringCentroid(towerP.outer)
  const s2 = sp.upperScale ?? 0.84, t2 = scaleRing(t1, c, s2)
  const [y1, y2] = sp.towerM ?? [124, 135]
  const out = [{ outer: block.outer, holes: block.holes ?? [], base: 0, top: blockTop }, { outer: t1, holes: [], base: blockTop, top: y1 }, { outer: t2, holes: [], base: y1, top: y2 }]
  const meshes = []
  // the corner tempietti on the block's roof, walked in from its corners
  const bb = boxRing(block.outer, { s: 1 }), stone = mesh(), domes = mesh(), gold = mesh()
  for (const k of bb) {
    const at = add2(k, mul2(norm2(sub2(ringCentroid(bb), k)), sp.tempiettoInsetM ?? 6.5))
    const tp = tempietto({ at, base: blockTop, r: sp.tempiettoR ?? 2.8, cols: 8, colH: 7.5, domeR: 2.9, lantern: 0.8, finial: 1.6, sides: 12 })
    pushAll(stone, tp.stone); pushAll(domes, tp.dome); if (tp.fin) pushAll(gold, tp.fin)
  }
  // the belvedere: a round colonnaded temple and its dome over the tower
  const bt = tempietto({ at: c, base: y2, r: sp.templeR ?? 7.6, cols: 16, colH: sp.templeColH ?? 9.5, baseH: 1.6, entH: 1.6, domeR: 7.0, rise: 0.8, lantern: 2.4, finial: 0 })
  pushAll(stone, bt.stone); pushAll(domes, bt.dome)
  const finTop = crownTop, finBase = bt.top
  if (finTop > finBase + 0.5) pushAll(gold, spire({ at: c, base: finBase - 0.1, top: finTop, r0: 0.6, sides: 8 }))
  // façade: the dark green band (floors 20–22), the block cornice, tower piers and a belt at each setback
  const blockEdges = edgesOf(block.outer, 1).map((e) => ({ ...e, y0: 0, y1: blockTop }))
  const [g0, g1] = sp.greenBandM ?? [78, 89]
  const green = bands(mesh(), blockEdges, { ys: [g0, g1 - 1.0], h: 1.0, d: 0.35 })
  fins(green, blockEdges, { every: 2.45, w: 0.6, d: 0.3, y0: g0 + 1.0, y1: g1 - 1.0 })
  const cornice = bands(mesh(), blockEdges, { ys: [blockTop - 1.6], h: 1.6, d: 0.9 })
  const towerEdges = [...edgesOf(t1, 1).map((e) => ({ ...e, y0: blockTop, y1: y1 })), ...edgesOf(t2, 1).map((e) => ({ ...e, y0: y1, y1: y2 }))]
  const piers = fins(mesh(), towerEdges, { every: 3.2, w: 0.7, d: 0.4 })
  bands(cornice, towerEdges, { ys: [y1 - 1.2, y2 - 1.2], h: 1.2, d: 0.6 })
  const basePiers = fins(mesh(), blockEdges, { every: sp.blockPierEvery ?? 4.9, w: 0.8, d: 0.3, y0: 6, y1: g0 })
  meshes.push(part(stone, F.stone, 'jewelers-terracotta', 'temples', { lod1: true }), part(domes, F.stone, 'jewelers-terracotta', 'domes', { lod1: true }), part(gold, F.paint, 'gold-leaf', 'finials', { lod1: true }))
  meshes.push(part(green, F.stone, 'jewelers-green', 'green-band'), part(cornice, F.stone, 'jewelers-terracotta', 'cornices'), part(piers, F.stone, 'jewelers-terracotta', 'tower-piers'), part(basePiers, F.stone, 'jewelers-terracotta', 'piers'))
  void tc; void b
  return { pieces: out, meshes }
}

// The London Guarantee Building, now LondonHouse (Alfred Alschuler, 1923): Bedford limestone, the concave corner on
// the river plaza with its three-storey Corinthian colonnade under the cornice, the four entrance columns, and the
// tholos cupola after the Lysicrates monument — floodlit warm white at night.
function londonhouse({ pieces, sp }) {
  const body = widest(pieces), roof = sp.roofM ?? 79, top = sp.topM ?? 102.9
  const cupola = pieces.find((p) => p !== body && area(p.outer) < 120)
  const at = cupola ? ringCentroid(cupola.outer) : ringCentroid(body.outer)
  const out = [{ outer: body.outer, holes: body.holes ?? [], base: 0, top: roof }]
  const edges = edgesOf(body.outer, 1).map((e) => ({ ...e, y0: 0, y1: roof }))
  const front = facing(edges, sp.cornerFace ?? 18, sp.cornerTol ?? 22), stone = mesh()
  const [c0, c1] = sp.colonnadeM ?? [66, 78]
  for (const e of front) columnsAlong(stone, e, Math.max(1, Math.round(e.len / 4.4)), c0, c1, 0.62, 1.0, 10)
  bands(stone, front, { ys: [c1], h: 1.4, d: 1.7 }) // the entablature over the colonnade
  const ave = facing(edges, sp.avenueFace ?? 89, 15).sort((a, b) => b.len - a.len)[0]
  if (ave) columnsAlong(stone, { ...ave, a: add2(ave.a, mul2(ave.t, ave.len * 0.3)), len: ave.len * 0.4 }, 4, 0, 10.5, 0.55, 0.9, 10)
  bands(stone, edges, { ys: [roof - 1.8], h: 1.8, d: 1.1 }) // the main cornice
  bands(stone, edges, { ys: [10.5, c0 - 1.0], h: 1.0, d: 0.5 })
  const tp = tempietto({ at, base: roof, r: sp.tholosR ?? 4.6, cols: 12, colH: sp.tholosColH ?? 9.0, baseH: 4.0, entH: 1.5, domeR: 4.6, rise: 0.75, lantern: 2.0, finial: 0 })
  const fin = spire({ at, base: tp.top - 0.1, top, r0: 0.35, sides: 8 })
  return {
    pieces: out,
    meshes: [part(stone, F.stone, 'londonhouse-limestone', 'colonnades'), part(tp.stone, F.stone, 'londonhouse-limestone', 'tholos', { lod1: true }), part(tp.dome, F.stone, 'londonhouse-cupola', 'dome', { lod1: true }), part(fin, F.paint, 'gold-leaf', 'finial', { lod1: true })],
  }
}

// Mather Tower (Herbert Hugh Riddle, 1928): a 24-storey cream terra-cotta box, then an octagonal tower narrowing in
// three stages with buttress piers at every corner, the lantern and the gilded cupola (replaced 2002). At night the
// octagon's columns are uplit cool white and the gold roof amber (Schuler Shook).
function mather({ pieces, sp }) {
  const box = widest(pieces), boxTop = sp.boxM ?? 93, top = sp.topM ?? 158.8
  const c = ringCentroid(box.outer), ob = orientedBox(box.outer), rot = (Math.atan2(ob.u[1], ob.u[0]) * 180) / Math.PI
  const stages = sp.stages ?? [[boxTop, 117, 8.5], [117, 133, 6.5], [133, 145, 4.6]] // [from, to, apothem]
  const oct = (apo) => polyRing(c, apo / Math.cos(Math.PI / 8), 8, rot)
  const out = [{ outer: box.outer, holes: box.holes ?? [], base: 0, top: boxTop }, ...stages.map(([y0, y1, apo]) => ({ outer: oct(apo), holes: [], base: y0, top: y1 }))]
  const stone = mesh(), lantern = mesh(), gold = mesh(), dark = mesh()
  // buttress piers and pinnacles at each octagon corner
  for (const [y0, y1, apo] of stages) {
    for (const p of oct(apo)) { const n = norm2(sub2(p, c)); finAt(stone, p, left(n), n, 1.0, 0.9, y0, y1 + 1.2); pushAll(stone, spire({ at: add2(p, mul2(n, 0.45)), base: y1 + 1.2, top: y1 + 4.2, r0: 0.45, sides: 6 })) }
    bands(stone, edgesOf(oct(apo), 1).map((e) => ({ ...e, y0, y1 })), { ys: [y1 - 1.0], h: 1.0, d: 0.5 })
  }
  const boxEdges = edgesOf(box.outer, 1).map((e) => ({ ...e, y0: 0, y1: boxTop }))
  bands(stone, boxEdges, { ys: [boxTop - 1.4], h: 1.4, d: 0.7 })
  fins(stone, boxEdges, { every: 3.0, w: 0.6, d: 0.3, y0: 8, y1: boxTop - 1.4 })
  const [l0, l1, lApo] = sp.lantern ?? [145, 152, 2.9]
  const lr = oct(lApo)
  pushAll(lantern, loft([lr, lr], [l0, l1], { cap: true }))
  for (const e of edgesOf(lr, 0.5)) openingsAlong(dark, { ...e }, 1, l0 + 1.0, l1 - 1.0, e.len * 0.55)
  // the gilded cupola: an octagonal ogee roof rising to the finial
  const cup = [[1.15, 0], [1.1, 0.25], [0.85, 0.5], [0.45, 0.72], [0.18, 0.85], [0.08, 1]]
  pushAll(gold, lathe(c, l1, lApo, cup.map(([r, h]) => [r, (h * (top - 1.5 - l1)) / lApo]), 8))
  pushAll(gold, spire({ at: c, base: top - 1.6, top, r0: 0.18, sides: 6 }))
  return {
    pieces: out,
    meshes: [part(stone, F.stone, 'mather-terracotta', 'buttresses'), part(lantern, F.stone, 'mather-terracotta', 'lantern', { lod1: true }), part(dark, F.paint, 'gothic-shadow', 'lantern-openings'), part(gold, F.paint, 'mather-gold', 'cupola', { lod1: true })],
  }
}

// Reid, Murdoch & Co. (George C. Nimmons, 1914): a long red-brick Prairie-school warehouse on the river with dark
// terra-cotta trim, its brick piers running up the river front, and the clock tower at the centre of that front.
function reidmurdoch({ pieces, sp }) {
  const body = widest(pieces), top = sp.bodyM ?? 33, tTop = sp.towerTopM ?? 53
  const edges = edgesOf(body.outer, 1).map((e) => ({ ...e, y0: 0, y1: top }))
  const river = facing(edges, sp.riverFace ?? 182, 25).sort((a, b) => b.len - a.len)
  // the river front's middle, from the long run(s) of the south face
  const run = river.reduce((acc, e) => acc.concat([e.a, e.b]), [])
  const along = river[0].t, proj = run.map((p) => dot2(p, along)), mid = (Math.min(...proj) + Math.max(...proj)) / 2
  const e0 = river[0], s0 = dot2(e0.a, along), centre = add2(e0.a, mul2(along, mid - s0))
  const [tw, td] = sp.towerPlanM ?? [12, 10]
  const tc = add2(centre, mul2(e0.n, 1.0 - td / 2))
  const towerRing = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b2]) => add2(add2(tc, mul2(along, (a * tw) / 2)), mul2(e0.n, (b2 * td) / 2)))
  const out = [{ outer: body.outer, holes: body.holes ?? [], base: 0, top }, { outer: towerRing, holes: [], base: 0, top: tTop }]
  const trim = mesh(), brick = mesh(), face = mesh(), hands = mesh()
  bands(trim, edges, { ys: [top - 1.0, 4.5], h: 1.0, d: 0.35 })
  fins(brick, river.map((e) => ({ ...e })), { every: sp.pierEvery ?? 6.1, w: 1.0, d: 0.35, y0: 4.5, y1: top - 1.0 })
  const tEdges = edgesOf(towerRing, 1).map((e) => ({ ...e, y0: top, y1: tTop }))
  fins(brick, tEdges, { every: tw / 2, w: 1.2, d: 0.4, y0: top, y1: tTop - 1.2 })
  bands(trim, tEdges, { ys: [tTop - 1.2, tTop - 9.5], h: 1.2, d: 0.45 })
  const cr = sp.clockR ?? 1.85, cy = tTop - 5.5
  for (const e of tEdges) clockFace(face, hands, add2(e.mid, mul2(e.n, 0.42)), e.n, cy, cr)
  return {
    pieces: out,
    meshes: [part(trim, F.stone, 'reid-trim', 'trim'), part(brick, F.stone, 'reid-brick', 'piers'), part(face, F.signal, 'reid-clock', 'clock'), part(hands, F.paint, 'clock-hands', 'hands')],
  }
}

// ── Tier 1 heavy (A-4) ────────────────────────────────────────────────────────────────────────────────────────

// Pieces whose OSM height came from a level count (3.8 m a floor) get the building's real floor heights: tall
// commercial floors make the Mart's 18 storeys about 78 m and the Post Office's 9 about 58 m.
const relevel = (pieces, tops, floorM = 3.8) => pieces.map((p) => {
  const lv = Math.round(p.top / floorM)
  return tops[lv] != null && Math.abs(p.top - lv * floorM) < 0.05 ? { ...p, top: tops[lv] } : p
})
// The longest straight run of a ring's face toward a bearing, merged across small kinks: its centre, outward normal
// and length (the Mart's river face for Art on theMART).
export function faceRun(ring, deg, tol = 25) {
  const es = facing(edgesOf(ring, 0.5), deg, tol)
  if (!es.length) return null
  const f = bearing(deg), along = left(f), pts = es.flatMap((e) => [e.a, e.b])
  const s = pts.map((p) => dot2(p, along)), o = Math.max(...pts.map((p) => dot2(p, f)))
  const s0 = Math.min(...s), s1 = Math.max(...s), mid = (s0 + s1) / 2
  return { c: add2(mul2(along, mid), mul2(f, o)), n: f, t: along, len: s1 - s0 }
}

// The Merchandise Mart (Graham, Anderson, Probst & White, 1930): the 18-storey block (about 78 m), the corner towers
// (19 and 22 storeys) with their stepped parapets, the 25-storey central tower to 103.6 m ringed near its top by the
// 56 terra-cotta heads of Native American chiefs, piers on every face, and the river façade Art on theMART lights.
function mart({ pieces, sp }) {
  // the main block: OSM has it as the whole outline, which the parts parser leaves at the lowest part's height
  const block = widest(pieces)
  const out = relevel(pieces, sp.levelTops ?? { 19: 82, 22: 92, 8: 32 }).map((p, i) => (pieces[i] === block ? { ...p, top: sp.blockM ?? 78 } : p))
  const tower = tallest(out), meshes = [], stone = mesh(), heads = mesh(), caps = mesh()
  const edges = exposedEdges(out)
  // piers on every face but the river's (the river face has its own, landmarks.js#martRiverFace)
  const notRiver = edges.filter((e) => dot2(e.n, bearing(sp.riverFace ?? 180)) < 0.7)
  fins(stone, notRiver, { every: sp.pierEvery ?? 6.1, w: 0.9, d: 0.45 })
  // cornices on every roof edge, and stepped parapets on the corner towers
  bands(caps, edges, { ys: [...new Set(edges.map((e) => e.y1))].map((y) => y - 1.5), h: 1.5, d: 0.6 })
  for (const p of out) {
    if (p === tower || area(p.outer) > 400 || p.top < 80) continue
    const c = ringCentroid(p.outer)
    pushAll(caps, loft([scaleRing(p.outer, c, 0.86), scaleRing(p.outer, c, 0.86)], [p.top, p.top + 2.2]))
    pushAll(caps, loft([scaleRing(p.outer, c, 0.66), scaleRing(p.outer, c, 0.66)], [p.top + 2.2, p.top + 3.8]))
  }
  // the central tower: piers between its windows, a frieze of 56 chiefs' heads (3.5 × 7 ft) under the cornice
  const te = edgesOf(tower.outer, 1).map((e) => ({ ...e, y0: sp.blockM ?? 78, y1: tower.top }))
  fins(stone, te, { every: 3.05, w: 0.6, d: 0.35, y1: tower.top - 9 })
  const per = te.reduce((s, e) => s + e.len, 0), n = sp.heads ?? 56, hy = tower.top - 8.2
  let acc = 0
  for (const e of te) {
    const k0 = Math.ceil((acc / per) * n - 1e-9), k1 = Math.ceil(((acc + e.len) / per) * n - 1e-9)
    for (let k = k0; k < k1; k++) finAt(heads, add2(e.a, mul2(e.t, ((k + 0.5) * per) / n - acc)), e.t, e.n, 1.07, 0.45, hy, hy + 2.13)
    acc += e.len
  }
  bands(caps, te, { ys: [hy - 0.6, hy + 2.6], h: 0.6, d: 0.55 })
  meshes.push(part(stone, F.stone, 'mart-limestone', 'piers'), part(caps, F.stone, 'mart-limestone', 'cornices', { lod1: true }), part(heads, F.stone, 'mart-heads', 'chiefs-heads'))
  // Art on theMART: the projected image on the river façade (556 × 165 ft), lit by the app on its schedule
  const run = faceRun(widest(out).outer, sp.riverFace ?? 180, 30)
  const [a0, a1] = sp.artM ?? [14, 64.3], halfW = (sp.artWidthM ?? 169.5) / 2
  const runtime = run ? { artOnTheMart: { c: run.c.map((v) => Math.round(v * 10) / 10), n: run.n.map((v) => Math.round(v * 1000) / 1000), halfW: Math.min(halfW, run.len / 2), y0: a0, y1: a1 } } : undefined
  return { pieces: out, meshes, runtime }
}

// The Civic Opera Building (Graham, Anderson, Probst & White, 1929): the "armchair" — the 45-storey tower along Wacker
// (169 m) is its back, the 22-storey wings its arms, the 12-storey opera house its seat facing the river — with the
// two-storey portico of square piers the length of Wacker Drive and its 55 lanterns.
function opera({ pieces, sp }) {
  const portH = sp.porticoM ?? 12
  let out = pieces.map((p) => (p.top > 150 ? { ...p, top: sp.towerM ?? 169.2 } : p))
  // the portico strip OSM maps along Wacker (long and thin): the building above it on piers, open below
  const strip = out.find((p) => { const ob = orientedBox(p.outer); return ob.W < 10 && ob.L > 60 })
  const meshes = [], piers = mesh(), soffit = mesh(), lamps = mesh(), stone = mesh()
  if (strip) {
    const ob = orientedBox(strip.outer), others = out.filter((p) => p !== strip)
    const slices = Math.ceil(ob.L / 3), inward = (() => { const c = ringCentroid(widest(others).outer); return dot2(sub2(c, ob.c), ob.v) > 0 ? ob.v : mul2(ob.v, -1) })()
    const runs = []
    for (let i = 0; i < slices; i++) {
      const a = -ob.L / 2 + (i * ob.L) / slices, b = -ob.L / 2 + ((i + 1) * ob.L) / slices
      const probe = add2(add2(ob.c, mul2(ob.u, (a + b) / 2)), mul2(inward, ob.W / 2 + 3))
      const top = Math.max(0, ...others.filter((p) => pointInRing(probe, p.outer)).map((p) => p.top))
      if (runs.length && runs.at(-1).top === top) runs.at(-1).b = b; else runs.push({ a, b, top })
    }
    const rect = (a, b) => [[a, -ob.W / 2], [b, -ob.W / 2], [b, ob.W / 2], [a, ob.W / 2]].map(([s, w]) => add2(add2(ob.c, mul2(ob.u, s)), mul2(ob.v, w)))
    const above = runs.filter((r) => r.top > portH).map((r) => ({ outer: rect(r.a, r.b), holes: [], base: portH, top: r.top }))
    for (const p of above) capRing(soffit, p.outer, portH, true)
    out = [...others, ...above]
    // square limestone piers on the street line, and a lantern hung in every bay
    const outward = mul2(inward, -1), line = add2(ob.c, mul2(outward, ob.W / 2 - 0.6)), n = sp.piers ?? 24
    for (let i = 0; i <= n; i++) {
      const at = add2(line, mul2(ob.u, -ob.L / 2 + 1 + ((ob.L - 2) * i) / n))
      pushAll(piers, slab(mesh(), at, ob.u, 1.3, 1.3, 0, portH))
      if (i < n) { const lc = add2(add2(line, mul2(ob.u, -ob.L / 2 + 1 + ((ob.L - 2) * (i + 0.5)) / n)), mul2(inward, 2.5)); pushAll(lamps, slab(mesh(), lc, ob.u, 0.6, 0.6, portH - 3.4, portH - 2.2)) }
    }
  }
  // cornices at the wing and tower tops, and limestone piers up the tower's exposed faces
  const edges = exposedEdges(out)
  bands(stone, edges, { ys: [...new Set(edges.map((e) => e.y1))].filter((y) => y > 20).map((y) => y - 1.6), h: 1.6, d: 0.7 })
  fins(stone, edges.filter((e) => e.y1 > 150), { every: 3.2, w: 0.7, d: 0.35, y0: 84 })
  meshes.push(part(piers, F.stone, 'opera-limestone', 'portico-piers'), part(soffit, F.stone, 'opera-limestone', 'portico-ceiling'), part(lamps, F.signal, 'opera-lantern', 'portico-lanterns'), part(stone, F.stone, 'opera-limestone', 'cornices-piers'))
  return { pieces: out, meshes }
}

// The Old Main Post Office (Graham, Anderson, Probst & White, 1932): nine tall storeys (58 m) of Bedford limestone
// on black granite, 65.5 m at its corner towers, fluted piers, the roof park (2022) — and the Eisenhower Expressway
// running straight through its base in two 40 ft bores.
function postoffice({ pieces, sp }) {
  let out = relevel(pieces, sp.levelTops ?? { 9: 58, 10: 62, 11: 65.5, 6: 38.6 })
  const [z0, z1] = sp.portalZ ?? [697, 727], clear = sp.portalM ?? 7.2
  const inBand = (p) => { const c = ringCentroid(p.outer), ob = orientedBox(p.outer); return c[1] > z0 && c[1] < z1 && Math.min(ob.L, ob.W) < z1 - z0 + 4 }
  const meshes = [], soffit = mesh(), granite = mesh(), stone = mesh(), lawn = mesh(), track = mesh()
  const bridges = out.filter(inBand)
  out = out.map((p) => (bridges.includes(p) ? { ...p, base: clear } : p))
  for (const p of bridges) {
    capRing(soffit, p.outer, clear, true)
    // the central pier between the two bores, and the portal's granite jambs
    const ob = orientedBox(p.outer), along = Math.abs(ob.u[0]) > Math.abs(ob.u[1]) ? ob.u : ob.v, span = Math.abs(ob.u[0]) > Math.abs(ob.u[1]) ? ob.L : ob.W
    pushAll(granite, slab(mesh(), ob.c, along, span, sp.pierW ?? 4.5, 0, clear))
  }
  const edges = exposedEdges(out)
  // black granite at the base where the walls meet the street (the bridges' undersides excepted)
  bands(granite, edges.filter((e) => e.y0 < 1), { ys: [0], h: 5.5, d: 0.25 })
  fins(stone, edges.filter((e) => e.y1 - e.y0 > 20), { every: sp.pierEvery ?? 3.4, w: 0.8, d: 0.35, y0: 6.5 })
  bands(stone, edges, { ys: [...new Set(edges.map((e) => e.y1))].filter((y) => y > 20).map((y) => y - 1.6), h: 1.6, d: 0.6 })
  // the roof park on the long nine-storey roofs: lawn and a running track loop
  for (const p of out.filter((q) => Math.abs(q.top - 58) < 0.5 && area(q.outer) > 4000)) {
    const r = offsetRing(p.outer, -4)
    capRing(lawn, r, p.top + 0.08)
    for (const e of edgesOf(offsetRing(p.outer, -6), 2)) { const d = mul2(e.n, -1); quad(track, Y(add2(e.a, mul2(d, 0)), p.top + 0.12), Y(add2(e.b, mul2(d, 0)), p.top + 0.12), Y(add2(e.b, mul2(d, 2.4)), p.top + 0.12), Y(add2(e.a, mul2(d, 2.4)), p.top + 0.12), [0, 1, 0]) }
  }
  meshes.push(part(soffit, F.stone, 'postoffice-limestone', 'portal-soffit'), part(granite, F.stone, 'postoffice-granite', 'granite'), part(stone, F.stone, 'postoffice-limestone', 'piers-cornices'), part(lawn, F.paint, 'roof-lawn', 'roof-park'), part(track, F.paint, 'roof-track', 'roof-track'))
  return { pieces: out, meshes }
}

// 150 N Riverside (Goettsch Partners, 2017): the tower stands on a core only 39 ft (12 m) wide for its first eight
// storeys (31.7 m), then splays out on sloping steel to its full 120 ft (36.6 m) floor plate; a glass-fin lobby round
// the core; silver fins at every mullion whose depth ripples every two floors.
function riverside150({ pieces, sp, main }) {
  const full = widest(pieces), ob = orientedBox(full.outer)
  const top = sp.roofM ?? 221, screenTop = sp.topM ?? 229, coreTop = sp.coreM ?? 31.7, plate = sp.plateM ?? 42
  const coreW = sp.coreWidthM ?? 12, coreL = ob.L * (sp.coreLengthFrac ?? 0.72)
  const box = (L, W, c = ob.c) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => add2(add2(c, mul2(ob.u, (a * L) / 2)), mul2(ob.v, (b * W) / 2)))
  const core = box(coreL, coreW), lobby = box(coreL + 4, coreW + 8), plateBox = box(ob.L, ob.W)
  const out = [
    { outer: full.outer, holes: [], base: 0, top: screenTop, hidden: true }, // the whole building, for height and clearance
    { outer: core, holes: [], base: 0, top: coreTop },
    { outer: lobby, holes: [], base: 0, top: sp.lobbyM ?? 9 },
    { outer: full.outer, holes: full.holes ?? [], base: plate, top },
    { outer: offsetRing(full.outer, -2), holes: [], base: top, top: screenTop },
  ]
  // the sloped transition from the core's top to the floor plate: walls of glass, a steel soffit underneath
  const trans = loft([core, plateBox], [coreTop, plate], { cap: false })
  const under = capRing(mesh(), plateBox, plate, true)
  // rippling fins on the long faces: depth 10–25 cm, changing every two floors (~8.4 m)
  const fin = mesh(), band = sp.rippleM ?? 8.4
  // (the wide east and west faces, where the ripple reads: the long sides of the plate's oriented box)
  for (const e of edgesOf(plateBox, 6).filter((e) => e.len > ob.W + 1)) {
    const k = Math.max(1, Math.round(e.len / (sp.finEvery ?? 4.5)))
    for (let i = 0; i < k; i++) for (let y = plate, j = 0; y < top - 0.5; y += band, j++) {
      const d = 0.1 + 0.15 * (0.5 + 0.5 * Math.sin(i * 0.9 + j * 1.3))
      finAt(fin, add2(e.a, mul2(e.t, ((i + 0.5) * e.len) / k)), e.t, e.n, 0.12, d * (sp.finScale ?? 2.2), y, Math.min(top, y + band), false)
    }
  }
  void main
  return {
    pieces: out,
    meshes: [part(trans, undefined, 'riverside150', 'transition', { lod1: true }), part(under, F.paint, 'riverside150-steel', 'soffit', { lod1: true }), part(fin, F.paint, 'riverside150-fin', 'fins')],
  }
}

// A parabolic arch frame standing on a wall run's centre, `proud` out: ribs of slabs along y = H·(1 − (s/half)²),
// or hung from above when inverted (River Point's base arch and the inverted arch at its crown).
function parabolicArch(out, fill, c, t, n, { half, H, y0, proud, w = 1.2, d = 1.0, invert = false, seg = 16 }) {
  const P2 = (s) => { const k = 1 - (s / half) ** 2; return invert ? y0 - H * k : y0 + H * k }
  const pts = Array.from({ length: seg + 1 }, (_, i) => -half + (2 * half * i) / seg)
  for (let i = 0; i < seg; i++) {
    const s0 = pts[i], s1 = pts[i + 1], ya = P2(s0), yb = P2(s1)
    const A = add2(add2(c, mul2(t, s0)), mul2(n, proud)), B = add2(add2(c, mul2(t, s1)), mul2(n, proud))
    const dir = [B[0] - A[0], yb - ya, B[1] - A[1]], L = Math.hypot(...dir), up = [-(dir[1] / L) * t[0], Math.hypot(dir[0], dir[2]) / L, -(dir[1] / L) * t[1]]
    const off = (p, y, a, b2) => [p[0] + up[0] * a + n[0] * b2, y + up[1] * a, p[1] + up[2] * a + n[1] * b2]
    const hw = w / 2
    // the rib's face (toward n), its two edges, as quads
    quad(out, off(A, ya, -hw, d / 2), off(B, yb, -hw, d / 2), off(B, yb, hw, d / 2), off(A, ya, hw, d / 2), [n[0], 0, n[1]])
    quad(out, off(A, ya, hw, -d / 2), off(B, yb, hw, -d / 2), off(B, yb, hw, d / 2), off(A, ya, hw, d / 2), up)
    quad(out, off(A, ya, -hw, -d / 2), off(B, yb, -hw, -d / 2), off(B, yb, -hw, d / 2), off(A, ya, -hw, d / 2), up.map((v) => -v))
  }
  if (fill) wallPolygon(fill, c, t, n, pts.map((s) => [s, P2(s)]).concat(invert ? [[half, y0], [-half, y0]] : []), proud - d / 2 - 0.05)
}

// River Point (Pickard Chilton, 2017): 223 m of curving green glass over the Metra tracks; its convex east face holds
// a tall parabolic arch at the base, framing the sloped red travertine lobby wall, and a shorter inverted arch at the
// crown — both drawn by the sloping perimeter columns that carry it over the tracks.
function riverpoint({ pieces, sp }) {
  const body = widest(pieces), top = sp.topM ?? 223
  const out = pieces.map((p) => (p === body ? { ...p, top } : p))
  const run = faceRun(body.outer, sp.archFace ?? 75, 25)
  const ribs = mesh(), lobby = mesh(), meshes = []
  if (run) {
    // the arch stands just clear of the face's outermost point (the curve falls away behind its feet)
    const half = sp.archHalfM ?? 17
    parabolicArch(ribs, lobby, run.c, run.t, run.n, { half, H: sp.archH ?? 26, y0: 0, proud: 1.2, w: 1.6, d: 1.2 })
    parabolicArch(ribs, null, run.c, run.t, run.n, { half: half * 0.8, H: sp.crownArchH ?? 14, y0: top, proud: 0.9, w: 1.2, d: 0.9, invert: true })
  }
  const edges = edgesOf(body.outer, 0.5).map((e) => ({ ...e, y0: 0, y1: top }))
  const mull = fins(mesh(), edges, { every: sp.columnEvery ?? 8.5, w: 0.5, d: 0.35, y0: (sp.archH ?? 26) * 0.5 })
  bands(mull, edges, { ys: [top - 1.0], h: 1.0, d: 0.3 })
  meshes.push(part(ribs, F.paint, 'riverpoint-steel', 'arches', { lod1: true }), part(lobby, F.paint, 'red-travertine', 'lobby-wall'), part(mull, F.paint, 'riverpoint-steel', 'columns'))
  return { pieces: out, meshes }
}

// The Marina City theater (Bertrand Goldberg, 1967; now House of Blues): concrete walls under a lead-sheathed saddle
// roof — high at both ends of its long axis, low at the middle of its long sides.
function saddle({ pieces, sp, b }) {
  const body = widest(pieces), ob = orientedBox(body.outer)
  const yc = sp.midM ?? 13, a = sp.endRiseM ?? 6, bb = sp.sideDropM ?? 4
  const roofY = (p) => { const r = sub2(p, ob.c), u = dot2(r, ob.u) / (ob.L / 2), v = dot2(r, ob.v) / (ob.W / 2); return yc + a * u * u - bb * v * v }
  const ring = boxRing(body.outer), walls = mesh(), roof = mesh()
  // walls up to the saddle, edge by edge in short steps so the eave follows the curve
  for (const e of edgesOf(ring, 1)) {
    const k = Math.max(2, Math.round(e.len / 2))
    for (let i = 0; i < k; i++) {
      const p0 = add2(e.a, mul2(e.t, (i * e.len) / k)), p1 = add2(e.a, mul2(e.t, ((i + 1) * e.len) / k))
      quad(walls, Y(p0, 0), Y(p1, 0), Y(p1, roofY(p1)), Y(p0, roofY(p0)), [e.n[0], 0, e.n[1]], [(i * e.len) / k, 0, ((i + 1) * e.len) / k, roofY(p1)])
    }
  }
  const S = 16, T = 10, pt = (i, j) => { const p = add2(add2(ob.c, mul2(ob.u, (-0.5 + i / S) * ob.L)), mul2(ob.v, (-0.5 + j / T) * ob.W)); return [p[0], roofY(p) + 0.02, p[1]] }
  for (let i = 0; i < S; i++) for (let j = 0; j < T; j++) quad(roof, pt(i, j), pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1), [0, 1, 0], [i, j, i + 1, j + 1])
  void b
  return {
    pieces: pieces.map((p) => ({ ...p, top: yc + a, hidden: true })),
    meshes: [part(walls, F.stone, 'marina-concrete', 'walls', { lod1: true }), part(roof, F.paint, 'saddle-lead', 'saddle-roof', { lod1: true })],
  }
}

// ── Tier 2 (A-6) ──────────────────────────────────────────────────────────────────────────────────────────────

// Polygon set operations on pieces' rings (polygon-clipping speaks [[[x, z], …], hole, …] polygons).
const asPoly = (outer, holes = []) => [outer.map(([x, z]) => [x, z]), ...holes.map((h) => h.map(([x, z]) => [x, z]))]
const fromMulti = (mp) => mp.map((poly) => ({ outer: poly[0].slice(0, -1), holes: poly.slice(1).map((h) => h.slice(0, -1)) })).filter((p) => p.outer.length >= 3 && area(p.outer) > 1)
export const clipTo = (outer, holes, clip) => fromMulti(polygonClipping.intersection([asPoly(outer, holes)], [asPoly(clip)]))
export const cutAway = (outer, holes, cut) => fromMulti(polygonClipping.difference([asPoly(outer, holes)], [asPoly(cut)]))
// A band of an oriented box: [s0, s1] along u (metres from its centre), the full width across, padded.
const band = (ob, s0, s1, pad = 50) => [[s0, -ob.W / 2 - pad], [s1, -ob.W / 2 - pad], [s1, ob.W / 2 + pad], [s0, ob.W / 2 + pad]].map(([a, b]) => add2(add2(ob.c, mul2(ob.u, a)), mul2(ob.v, b)))

// 110 N Wacker (Goettsch Partners, 2020): the river face steps back in a sawtooth of 30 ft bays; the tower overhangs
// the Riverwalk by 55 ft (17 m), carried on three steel "tridents" 55 ft (16.8 m) tall; vertical glass fins.
function wacker110({ pieces, sp }) {
  const f = bearing(sp.riverFace ?? 270), over = sp.overhangM ?? 17, H = sp.tridentM ?? 16.8
  const all = pieces.flatMap((p) => p.outer), reach = Math.max(...all.map((q) => dot2(q, f)))
  // the strip within `over` metres of the river face, cut out of every piece below H
  const ob = orientedBox(widest(pieces).outer), side = left(f), cc = ob.c, sPad = Math.max(ob.L, ob.W)
  const strip = [[-sPad, reach - over], [sPad, reach - over], [sPad, reach + 5], [-sPad, reach + 5]].map(([s, d]) => add2(mul2(side, s + dot2(cc, side)), mul2(f, d)))
  const out = [], soffit = mesh()
  for (const p of pieces) {
    if ((p.base ?? 0) >= H) { out.push(p); continue }
    for (const q of cutAway(p.outer, p.holes ?? [], strip)) out.push({ ...q, base: p.base ?? 0, top: p.top })
    for (const q of clipTo(p.outer, p.holes ?? [], strip)) if (p.top > H) { out.push({ ...q, base: H, top: p.top }); capRing(soffit, q.outer, H, true) }
  }
  // the three tridents along the overhang's middle line
  const tr = mesh(), mid = reach - over / 2, ext = all.map((q) => dot2(q, side)), s0 = Math.min(...ext), s1 = Math.max(...ext), n = sp.tridents ?? 3
  for (let i = 0; i < n; i++) {
    const s = s0 + ((i + 0.5) * (s1 - s0)) / n, base = add2(mul2(side, s), mul2(f, mid)), knee = sp.kneeM ?? 7
    pushAll(tr, drum({ at: base, base: 0, top: knee, r: 0.75, sides: 10 }))
    for (const [ds, dd] of [[-5.5, -3], [0, 3.5], [5.5, -3]]) tube(tr, Y(base, knee - 0.5), Y(add2(base, add2(mul2(side, ds), mul2(f, dd))), H - 0.45), 0.42, 8) // the branch ends under the soffit
  }
  const fin = fins(mesh(), exposedEdges(out).filter((e) => e.y1 - e.y0 > 30), { every: sp.finEvery ?? 3.0, w: 0.08, d: 0.45 })
  return {
    pieces: out,
    meshes: [part(soffit, F.paint, 'wacker110-steel', 'soffit', { lod1: true }), part(tr, F.paint, 'wacker110-steel', 'tridents', { lod1: true }), part(fin, F.paint, 'wacker110-fin', 'glass-fins')],
  }
}

// The Wolf Point towers at the forks of the river (Pelli Clarke Pelli; West by bKL): West's layered planes and aluminium
// tube bands, East's rounded corners and radiused sunshades under a crown of lighter vertical bands, South's three
// glass slabs rising to a central peak.
function wolfpoint({ pieces, sp }) {
  const body = widest(pieces), top = sp.topM ?? body.top, ob = orientedBox(body.outer), meshes = []
  let out = [{ ...body, top }]
  const floor = sp.floorM ?? 3.3, lines = mesh(), crown = mesh()
  if (sp.form === 'slabs') {
    // three slabs side by side along the long axis, the outer two lower
    const [fa, fb] = sp.splits ?? [-0.17, 0.17], drops = sp.drops ?? [22, 0, 14]
    const cuts = [[-ob.L, fa * ob.L], [fa * ob.L, fb * ob.L], [fb * ob.L, ob.L]]
    out = cuts.flatMap(([a, b], i) => clipTo(body.outer, body.holes ?? [], band(ob, a, b)).map((q) => ({ ...q, base: 0, top: top - drops[i] })))
  } else if (sp.form === 'planes') {
    // two planes sliding past each other: one half of the slab a few floors lower
    const cuts = [[-ob.L, 0], [0, ob.L]], drops = sp.drops ?? [0, 9]
    out = cuts.flatMap(([a, b], i) => clipTo(body.outer, body.holes ?? [], band(ob, a, b)).map((q) => ({ ...q, base: 0, top: top - drops[i] })))
  } else if (sp.form === 'crown') {
    const c0 = top - (sp.crownM ?? 18)
    out = [{ ...body, top: c0 }, { outer: offsetRing(body.outer, -(sp.setbackM ?? 1.8)), holes: [], base: c0, top }]
    fins(crown, edgesOf(out[1].outer, 0.5).map((e) => ({ ...e, y0: c0, y1: top })), { every: 1.6, w: 0.5, d: 0.35 })
  }
  // horizontal lines at every floor: aluminium tubes (West), radiused sunshades (East), tapering accents (South)
  const ex = exposedEdges(out)
  for (const e of ex) {
    const ys = []; for (let y = sp.linesFromM ?? 12; y < e.y1 - 1; y += floor * (sp.lineEvery ?? 1)) if (y > e.y0) ys.push(y)
    bands(lines, [e], { ys, h: sp.lineH ?? 0.3, d: sp.lineD ?? 0.35, ext: 0.05 })
  }
  bands(lines, ex, { ys: [...new Set(ex.map((e) => e.y1))].map((y) => y - 1.2), h: 1.2, d: 0.3 })
  meshes.push(part(lines, F.paint, sp.lineStyle ?? 'wolfpoint-aluminium', 'floor-lines'))
  if (crown.positions.length) meshes.push(part(crown, F.paint, sp.crownStyle ?? 'wolfpoint-crown', 'crown-bands', { lod1: true }))
  return { pieces: out, meshes }
}

// The Boeing Building (Perkins & Will, 1990): grey stone and dark glass, its south-west corner hung over the Metra
// tracks from cantilever trusses on the roof, left exposed as architecture.
function boeing({ pieces, sp }) {
  const tower = tallest(pieces), top = sp.topM ?? 171, ob = orientedBox(tower.outer)
  const out = pieces.map((p) => (p === tower ? { ...p, top } : p))
  const truss = mesh(), dH = sp.trussDepthM ?? 8, corner = sp.cornerFace ?? [225]
  const faces = edgesOf(tower.outer, 6).filter((e) => corner.some((deg) => dot2(e.n, bearing(deg)) > 0.3))
  for (const e of faces) {
    const k = Math.max(2, Math.round(e.len / 6))
    const P = (i, y) => Y(add2(add2(e.a, mul2(e.t, (i * e.len) / k)), mul2(e.n, 0.9)), y)
    for (let i = 0; i <= k; i++) tube(truss, P(i, top - 0.2), P(i, top + dH), 0.32, 6)
    tube(truss, P(0, top + dH), P(k, top + dH), 0.38, 6); tube(truss, P(0, top), P(k, top), 0.38, 6)
    for (let i = 0; i < k; i++) tube(truss, P(i, i % 2 ? top + dH : top), P(i + 1, i % 2 ? top : top + dH), 0.28, 6)
    // the hangers down the suspended corner bay
    for (const i of [0, k]) tube(truss, P(i, sp.hangToM ?? 18), P(i, top), 0.3, 6)
  }
  const ex = exposedEdges(out)
  bands(truss, ex, { ys: [...new Set(ex.map((e) => e.y1))].map((y) => y - 1.2), h: 1.2, d: 0.3 })
  const stone = fins(mesh(), ex.filter((e) => e.y1 > 100), { every: 4.5, w: 1.1, d: 0.3, y0: 50 })
  void ob
  return { pieces: out, meshes: [part(truss, F.paint, 'boeing-truss', 'roof-truss', { lod1: true }), part(stone, F.stone, 'boeing-granite', 'piers')] }
}

// Riverside Plaza, the Chicago Daily News Building (Holabird & Root, 1929): a wide Art Deco slab of light brown
// limestone on the river, its end pavilions stepping down by setbacks, strong continuous piers.
function riversideplaza({ pieces, sp }) {
  const fl = sp.floorM ?? 3.54
  const out = pieces.map((p) => { const lv = Math.round(p.top / 3.8); return Math.abs(p.top - lv * 3.8) < 0.05 ? { ...p, top: lv * fl } : p })
  const ex = exposedEdges(out), stone = mesh()
  fins(stone, ex.filter((e) => e.y1 - e.y0 > 12), { every: sp.pierEvery ?? 2.6, w: 0.7, d: 0.35, y0: 6 })
  bands(stone, ex, { ys: [...new Set(ex.map((e) => e.y1))].map((y) => y - 1.3), h: 1.3, d: 0.55 })
  bands(stone, ex.filter((e) => e.y0 < 1), { ys: [0], h: 6, d: 0.2 })
  return { pieces: out, meshes: [part(stone, F.stone, 'dailynews-limestone', 'piers')] }
}

// Chicago Union Station's headhouse (Graham, Anderson, Probst & White, 1925): a Bedford limestone base filling the
// block, the 8-storey office block set back from its edges round the light court, and in the court the Great Hall's
// barrel-vault skylight (219 ft long). The Canal Street colonnade is landmarks' (civic.js#unionStation).
function unionstation({ pieces, sp }) {
  const body = widest(pieces), baseM = sp.baseM ?? 20, top = sp.topM ?? 40
  const ob = orientedBox(body.outer)
  const office = offsetRing(body.outer, -(sp.officeSetbackM ?? 10.5))
  const court = boxRing(body.outer, { L: sp.courtM?.[0] ?? 76, W: sp.courtM?.[1] ?? 36 })
  const out = [{ outer: body.outer, holes: [], base: 0, top: baseM }, { outer: office, holes: [court], base: baseM, top }]
  const hall = sp.hall ?? { L: 66.8, W: 30.5, rise: 9 }
  const along = ob.L >= ob.W ? ob.u : ob.v
  const vault = barrel(ob.c, (sp.hallAlongShort ? left(along) : along), hall.L, hall.W, baseM, hall.rise, 14)
  const ex = exposedEdges(out), stone = mesh()
  bands(stone, ex, { ys: [...new Set(ex.map((e) => e.y1))].map((y) => y - 1.6), h: 1.6, d: 0.8 })
  fins(stone, ex.filter((e) => e.y0 >= baseM - 0.1), { every: 3.6, w: 0.7, d: 0.3 })
  return { pieces: out, meshes: [part(vault, F.wall, 'conservatory-glass', 'great-hall-skylight', { lod1: true, seed: 0.35 }), part(stone, F.stone, 'union-limestone', 'cornices-piers')] }
}

// River City (Bertrand Goldberg, 1986): two serpentine concrete wings of 7–14 storeys on a 4-storey plinth, the skylit
// "River Road" atrium running between them.
function rivercity({ pieces, sp }) {
  const plinth = widest(pieces), pH = sp.plinthM ?? 15, fl = sp.floorM ?? 3.0
  const wing = sp.wingRing ?? plinth.outer
  const ob = orientedBox(wing), steps = sp.storeys ?? [7, 10, 12, 14, 12, 10]
  const gap = sp.atriumW ?? 10
  const inner = offsetRing(wing, -(sp.wingDepthM ?? 13) - gap / 2)
  const outerRing = offsetRing(wing, -(sp.edgeInsetM ?? 2))
  const out = [{ outer: plinth.outer, holes: [], base: 0, top: pH }]
  steps.forEach((n, i) => {
    const a = -ob.L / 2 + (i * ob.L) / steps.length, b = -ob.L / 2 + ((i + 1) * ob.L) / steps.length
    for (const q of clipTo(outerRing, [inner], band(ob, a, b))) out.push({ ...q, base: pH, top: pH + n * fl })
  })
  // the skylight over the atrium, kept inside the wings' outline (an offset ring can spike at a tight bend)
  const sky = mesh(), skyY = pH + Math.min(sp.atriumStoreys ?? 10, ...steps) * fl - 0.6
  for (const q of clipTo(offsetRing(inner, 0.5), [], outerRing)) capRing(sky, q.outer, skyY)
  return { pieces: out, meshes: [part(sky, F.wall, 'conservatory-glass', 'river-road-skylight', { lod1: true, seed: 0.35 })] }
}

// 333 N Michigan (Holabird & Root, 1928): a slim limestone slab of 24 storeys on Michigan Avenue, its north end
// rising by setbacks to the 35-storey tower; dark polished stone at the base under Fred Torrey's carved frieze.
function michigan333({ pieces, sp }) {
  const body = widest(pieces), ob = orientedBox(body.outer), top = sp.topM ?? 121, slabTop = sp.slabM ?? 85
  const north = dot2(ob.u, [0, -1]) > 0 ? 1 : -1 // which end of the long axis is north
  const frac = sp.towerFrac ?? 0.42, L = ob.L
  const towerBand = north > 0 ? band(ob, L / 2 - frac * L, L) : band(ob, -L, -L / 2 + frac * L)
  const out = [{ ...body, top: slabTop }]
  const steps = sp.setbacks ?? [[slabTop, 98, 1.0], [98, 110, 0.86], [110, top, 0.72]]
  const tw = clipTo(body.outer, [], towerBand)[0]
  const meshes = [], stone = mesh(), dark = mesh(), frieze = mesh()
  if (tw) for (const [y0, y1, s] of steps) out.push({ outer: scaleRing(tw.outer, ringCentroid(tw.outer), s), holes: [], base: y0, top: y1 })
  const ex = exposedEdges(out)
  fins(stone, ex, { every: sp.pierEvery ?? 2.4, w: 0.6, d: 0.35, y0: 23 })
  bands(stone, ex, { ys: [...new Set(ex.map((e) => e.y1))].map((y) => y - 1.2), h: 1.2, d: 0.5 })
  bands(dark, ex.filter((e) => e.y0 < 1), { ys: [0], h: sp.baseM ?? 6, d: 0.25 })
  bands(frieze, ex.filter((e) => e.y0 < 1), { ys: [sp.friezeM ?? 18.5], h: 3.2, d: 0.3 })
  meshes.push(part(stone, F.stone, 'michigan333-limestone', 'piers'), part(dark, F.stone, 'michigan333-granite', 'base'), part(frieze, F.stone, 'michigan333-frieze', 'frieze'))
  return { pieces: out, meshes }
}

// 300 North LaSalle (Pickard Chilton, 2009): a 60-storey glass slab with stainless shade fins, its east and west ends
// stepping in under a luminous stainless crown — "a beacon along the river".
function lasalle300({ pieces, sp }) {
  const body = tallest(pieces), top = sp.topM ?? 239.1, ob = orientedBox(body.outer)
  const stepTops = sp.steps ?? [207, 215, 223, 231]
  const out = pieces.map((p) => (p === body ? { ...p, top: stepTops[0] } : p))
  const inset = sp.stepInsetM ?? 3
  stepTops.forEach((y0, i) => out.push({ outer: boxRing(body.outer, { L: ob.L - 2 * inset * (i + 1), W: ob.W }), holes: [], base: y0, top: i + 1 < stepTops.length ? stepTops[i + 1] : top }))
  const ex = exposedEdges(out), fin = mesh(), crown = mesh()
  fins(fin, ex.filter((e) => e.y1 <= stepTops[0] + 0.1), { every: sp.finEvery ?? 3.0, w: 0.1, d: 0.4, y0: 12 })
  // the stainless crown: a frame of close-set fins and rings round the top steps
  const cr = ex.filter((e) => e.y0 >= stepTops[0] - 0.1)
  fins(crown, cr, { every: 1.5, w: 0.25, d: 0.5 })
  bands(crown, cr, { ys: [...new Set(cr.map((e) => e.y1))].map((y) => y - 0.8), h: 0.8, d: 0.6 })
  return { pieces: out, meshes: [part(fin, F.paint, 'lasalle300-steel', 'fins'), part(crown, F.paint, 'lasalle300-crown', 'crown', { lod1: true })] }
}

// NBC Tower (Adrian Smith / SOM, 1989): Indiana limestone piers and red granite spandrels after 30 Rockefeller Plaza,
// setbacks at about the 20th, 29th and 33rd floors with buttress fins (a nod to the Tribune), and the broadcast spire
// to 191 m.
function nbc({ pieces, sp }) {
  const body = widest(pieces), roof = sp.roofM ?? 151.5, tip = sp.spireTopM ?? 191
  const setbacks = sp.setbacks ?? [[80, 0.86], [114, 0.74], [130, 0.62]]
  const c = ringCentroid(body.outer)
  const out = [{ ...body, top: setbacks[0][0] }]
  setbacks.forEach(([y, s], i) => out.push({ outer: scaleRing(body.outer, c, s), holes: [], base: y, top: i + 1 < setbacks.length ? setbacks[i + 1][0] : roof }))
  const ex = exposedEdges(out), stone = mesh(), granite = mesh(), mast = mesh()
  fins(stone, ex, { every: sp.pierEvery ?? 3.0, w: 0.7, d: 0.4, y0: 8 })
  bands(stone, ex, { ys: [...new Set(ex.map((e) => e.y1))].map((y) => y - 1.4), h: 1.4, d: 0.6 })
  // buttress fins at the upper setbacks: a stepped fin at each corner of the tiers above the first
  for (const [y, s] of setbacks.slice(1)) for (const p of boxRing(body.outer, { s: s + 0.04 })) { const n = norm2(sub2(p, c)); finAt(stone, p, left(n), n, 1.2, 3.0, y - 9, y + 2) }
  bands(granite, ex.filter((e) => e.y0 < 1), { ys: [0], h: 7, d: 0.25 })
  pushAll(mast, spire({ at: c, base: roof, top: roof + 6, r0: 3.2, r1: 2.4, sides: 8 }))
  pushAll(mast, spire({ at: c, base: roof + 6, top: tip, r0: 1.4, r1: 0, sides: 8 }))
  return { pieces: out, meshes: [part(stone, F.stone, 'nbc-limestone', 'piers'), part(granite, F.stone, 'nbc-granite', 'base'), part(mast, F.paint, 'nbc-spire', 'spire', { lod1: true })] }
}

// A 5 × 7 block font for roof signs: each letter a list of filled cells (column, row from the top).
const GLYPHS = {
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'], O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'], T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'], S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'], L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
}
// Lettering laid on a plane: origin o (3D), unit vectors right (along the text) and up (toward the letters' tops)
// and the plane normal; cell size `cell` metres; runs of filled cells merged into strips.
export function letters(out, text, o, right, up, normal, cell, gap = 1) {
  let x = 0
  for (const ch of text) {
    const g = GLYPHS[ch] ?? GLYPHS[' ']
    g.forEach((row, r) => {
      for (let c0 = 0; c0 < 5; c0++) {
        if (row[c0] !== '1') continue
        let c1 = c0; while (c1 + 1 < 5 && row[c1 + 1] === '1') c1++
        const P = (cx, cy) => [0, 1, 2].map((k) => o[k] + right[k] * (x + cx) * cell + up[k] * (6 - r + cy) * cell + normal[k] * 0.06)
        quad(out, P(c0, 0), P(c1 + 1, 0), P(c1 + 1, 1), P(c0, 1), normal)
        c0 = c1
      }
    })
    x += 5 + gap
  }
  return x * cell
}

// The Salt Shed (Graham, Anderson, Probst & White, 1929–30; Morton Salt until 2015, a music venue since 2022): a
// clear-span shed under a steep gable (the salt's angle of repose) on buttressed concrete walls, the giant white
// MORTON SALT letters painted on the roof slope that faces the Kennedy Expressway, floodlit at night.
function saltshed({ pieces, sp, main }) {
  // OSM maps the shed as parts; the gable spans the building's whole outline
  const body = main ?? widest(pieces), ob = orientedBox(body.outer), eave = sp.eaveM ?? 4.5, ridge = sp.ridgeM ?? 21
  const hl = ob.L / 2, hw = ob.W / 2, P = (a, b, y) => Y(add2(add2(ob.c, mul2(ob.u, a)), mul2(ob.v, b)), y)
  const walls = mesh(), roof = mesh(), sign = mesh(), butt = mesh()
  for (const s of [-1, 1]) {
    // the long walls up to the eave, the gable ends up to the ridge, two roof slopes
    quad(walls, P(-hl, s * hw, 0), P(hl, s * hw, 0), P(hl, s * hw, eave), P(-hl, s * hw, eave), [ob.v[0] * s, 0, ob.v[1] * s], [0, 0, ob.L, eave])
    quad(walls, P(s * hl, -hw, 0), P(s * hl, hw, 0), P(s * hl, hw, eave), P(s * hl, -hw, eave), [ob.u[0] * s, 0, ob.u[1] * s], [0, 0, ob.W, eave])
    tri(walls, P(s * hl, -hw, eave), P(s * hl, hw, eave), P(s * hl, 0, ridge), [ob.u[0] * s, 0, ob.u[1] * s])
    const slope = Math.hypot(hw, ridge - eave), want = [ob.v[0] * s * (ridge - eave), hw, ob.v[1] * s * (ridge - eave)]
    quad(roof, P(-hl - 0.6, s * (hw + 0.6), eave - 0.3), P(hl + 0.6, s * (hw + 0.6), eave - 0.3), P(hl + 0.6, 0, ridge), P(-hl - 0.6, 0, ridge), want, [0, 0, ob.L, slope])
    // buttresses along the long walls
    const k = Math.round(ob.L / (sp.buttressEvery ?? 6.1))
    for (let i = 0; i <= k; i++) finAt(butt, add2(add2(ob.c, mul2(ob.u, -hl + (i * ob.L) / k)), mul2(ob.v, s * hw)), ob.u, mul2(ob.v, s), 0.9, 1.4, 0, eave + 0.4)
  }
  // the ridge's ventilation monitor
  pushAll(roof, slab(mesh(), ob.c, ob.u, ob.L * 0.8, 2.4, ridge - 0.6, ridge + 1.6))
  // MORTON SALT on the slope facing the expressway
  const face = bearing(sp.signFace ?? 250), s = dot2(ob.v, face) >= 0 ? 1 : -1
  const nrm = norm3([ob.v[0] * s * (ridge - eave), hw, ob.v[1] * s * (ridge - eave)])
  const upDir = norm3([-ob.v[0] * s * hw, ridge - eave, -ob.v[1] * s * hw]), rightDir = norm3(cross3(upDir, nrm)) // reads left to right from outside
  const cell = sp.letterM ? sp.letterM / 7 : 1.0, text = sp.text ?? 'MORTON SALT', width = text.length * 6 * cell - cell
  const start = P(0, s * hw * 0.82, 0)
  const o = [start[0], eave + (ridge - eave) * 0.18, start[2]].map((v, k) => v - rightDir[k] * (width / 2))
  letters(sign, text, o, rightDir, upDir, nrm, cell)
  return {
    pieces: [{ outer: body.outer, holes: body.holes ?? [], base: 0, top: ridge, hidden: true }],
    meshes: [part(walls, F.stone, 'saltshed-concrete', 'walls', { lod1: true }), part(butt, F.stone, 'saltshed-concrete', 'buttresses'), part(roof, F.paint, 'saltshed-roof', 'roof', { lod1: true }), part(sign, F.paint, 'morton-white', 'morton-salt-sign', { lod1: true })],
  }
}

// The Montgomery Ward Catalog House (Schmidt, Garden & Martin, 1908): a quarter mile of reinforced-concrete frame
// along the North Branch, eight tall storeys of buff concrete piers and red-brown spandrels, a cornice band on top.
function wardcatalog({ pieces, sp }) {
  const out = relevel(pieces, sp.levelTops ?? { 8: 38.5, 12: 52 })
  const ex = exposedEdges(out), frame = mesh(), spandrel = mesh()
  fins(frame, ex, { every: sp.bayM ?? 6.1, w: 0.9, d: 0.35, y0: 0 })
  const fl = sp.floorM ?? 4.6
  for (const e of ex) { const ys = []; for (let y = fl - 1.1; y < e.y1 - 1; y += fl) if (y > e.y0) ys.push(y); bands(spandrel, [e], { ys, h: 1.1, d: 0.12, ext: 0 }) }
  bands(frame, ex, { ys: [...new Set(ex.map((e) => e.y1))].map((y) => y - 1.4), h: 1.4, d: 0.5 })
  return { pieces: out, meshes: [part(frame, F.stone, 'ward-concrete', 'frame'), part(spandrel, F.stone, 'ward-spandrel', 'spandrels')] }
}

// ── Tier 3 (A-7): the Wacker Drive wall and the hotels on the main stem — façade rhythm plus each real crown ────

// A tower's façade rhythm and crown from its sculptParams: piers or fins (`fins`), floor bands (`floors`), a base
// skirt (`base`), and one crown kind — a colonnaded top (Leo Burnett), a glazed temple pediment (77 W Wacker), four
// corner lanterns over a collar (225 W Wacker), a sloped glass mansard (Builders), a lit beacon (LaSalle-Wacker).
function towerdetail({ pieces, sp }) {
  let out = pieces.map((p) => (sp.topM && p === tallest(pieces) ? { ...p, top: sp.topM } : p))
  let tower = tallest(out)
  const top = tower.top, meshes = [], body = mesh(), crown = mesh(), dark = mesh(), skin = mesh()
  const c = ringCentroid(tower.outer), ob = orientedBox(tower.outer)
  const cr = sp.crown ?? {}
  if (sp.setbacks) {
    // tiers stepping in toward the top (LaSalle-Wacker's tower rising out of its H-plan base)
    const t0 = tower, rings = sp.setbacks.map(([y, sc]) => ({ y, outer: scaleRing(t0.outer, c, sc) }))
    out = [...out.filter((p) => p !== t0), { ...t0, top: rings[0].y }, ...rings.map((r, i) => ({ outer: r.outer, holes: [], base: r.y, top: i + 1 < rings.length ? rings[i + 1].y : top }))]
    tower = out.at(-1)
  }
  if (cr.kind === 'mansard') {
    // the 1986 addition: storeys set back behind a sloped glass mansard
    const y0 = top - cr.h
    out = out.map((p) => (p === tower ? { ...p, top: y0 } : p))
    meshes.push(part(loft([offsetRing(tower.outer, -0.5), offsetRing(tower.outer, -(cr.inset ?? 4))], [y0, top]), undefined, cr.style, 'mansard', { lod1: true }))
  }
  const ex = exposedEdges(out)
  if (sp.fins) fins(body, ex, { every: sp.fins.every, w: sp.fins.w, d: sp.fins.d, y0: sp.fins.from ?? 0, y1: cr.kind === 'colonnade' ? top - cr.h : undefined })
  if (sp.floors) for (const e of ex) { const ys = []; for (let y = sp.floors.from; y < e.y1 - 1; y += sp.floors.every) if (y > e.y0) ys.push(y); bands(body, [e], { ys, h: sp.floors.h, d: sp.floors.d, ext: 0.05 }) }
  bands(body, ex, { ys: [...new Set(ex.map((e) => e.y1))].filter((y) => y > 12).map((y) => y - (sp.capH ?? 1.2)), h: sp.capH ?? 1.2, d: sp.capD ?? 0.45 })
  if (sp.base) bands(skin, ex.filter((e) => e.y0 < 1), { ys: [0], h: sp.base.h, d: sp.base.d ?? 0.25 })
  if (cr.kind === 'colonnade') {
    // the top storeys open behind a colonnade of square piers carrying a flat cornice
    const te = edgesOf(tower.outer, 1).map((e) => ({ ...e, y0: top - cr.h, y1: top }))
    fins(crown, te, { every: cr.every, w: cr.w, d: cr.d })
    for (const e of te) openingsAlong(dark, e, Math.max(1, Math.round(e.len / cr.every)), top - cr.h + 0.5, top - 2.2, cr.every - cr.w - 0.2, { arch: false, proud: 0.05 })
    bands(crown, te, { ys: [top - 2.2], h: 2.2, d: cr.d + 0.4 })
  } else if (cr.kind === 'pediment') {
    // a glazed temple: a two-storey colonnade under a gabled roof whose pediments face front and back
    const f = bearing(cr.front ?? 180), along = Math.abs(dot2(ob.u, f)) > Math.abs(dot2(ob.v, f)) ? ob.u : ob.v
    const L = along === ob.u ? ob.L : ob.W, W = along === ob.u ? ob.W : ob.L, side = left(along), y0 = top, rise = cr.rise
    const P2 = (a, b, y) => Y(add2(add2(c, mul2(along, a)), mul2(side, b)), y)
    for (const s of [-1, 1]) {
      quad(crown, P2(-L / 2 - 0.8, s * (W / 2 + 0.8), y0), P2(L / 2 + 0.8, s * (W / 2 + 0.8), y0), P2(L / 2 + 0.8, 0, y0 + rise), P2(-L / 2 - 0.8, 0, y0 + rise), [side[0] * s * rise, W / 2, side[1] * s * rise])
      tri(crown, P2(s * (L / 2 + 0.6), -W / 2 - 0.6, y0), P2(s * (L / 2 + 0.6), W / 2 + 0.6, y0), P2(s * (L / 2 + 0.6), 0, y0 + rise), [along[0] * s, 0, along[1] * s])
      // the pediment's glazed tympanum, set into the gable
      tri(dark, P2(s * (L / 2 + 0.75), -W / 2 + 2.2, y0 + 1.0), P2(s * (L / 2 + 0.75), W / 2 - 2.2, y0 + 1.0), P2(s * (L / 2 + 0.75), 0, y0 + rise - 1.6), [along[0] * s, 0, along[1] * s])
    }
    const te = edgesOf(tower.outer, 1).map((e) => ({ ...e, y0: top - cr.h, y1: top }))
    fins(crown, te, { every: cr.every ?? 4.5, w: 1.1, d: 0.6 })
    bands(crown, te, { ys: [top - 1.4], h: 1.4, d: 0.9 })
  } else if (cr.kind === 'lanterns') {
    // the collar near the top and four lantern spires at the corners of the roof
    const te = edgesOf(tower.outer, 1).map((e) => ({ ...e, y0: 0, y1: top }))
    bands(crown, te, { ys: [top - cr.collarAt], h: cr.collarH, d: 0.6 })
    for (const k of boxRing(tower.outer, { s: 1 })) {
      const at = add2(k, mul2(norm2(sub2(c, k)), cr.inset ?? 3.5)), s2 = cr.w ?? 3.2
      pushAll(crown, slab(mesh(), at, ob.u, s2, s2, top, top + cr.h * 0.62))
      pushAll(crown, slab(mesh(), at, ob.u, s2 * 0.72, s2 * 0.72, top + cr.h * 0.62, top + cr.h * 0.78))
      pushAll(crown, spire({ at, base: top + cr.h * 0.78, top: top + cr.h, r0: s2 * 0.42, sides: 4 }))
      for (const e of edgesOf(boxRing(polyRing(at, s2 / 2, 4, (Math.atan2(ob.u[1], ob.u[0]) * 180) / Math.PI - 45)), 0.5)) openingsAlong(dark, { ...e, a: add2(e.a, mul2(e.n, 0.02)) }, 1, top + cr.h * 0.2, top + cr.h * 0.55, s2 * 0.45)
    }
  } else if (cr.kind === 'beacon') {
    // the peak: a stepped cap lit at night (cobalt blue at LaSalle-Wacker)
    pushAll(crown, loft([scaleRing(tower.outer, c, 0.7), scaleRing(tower.outer, c, 0.7)], [top, top + cr.h * 0.6]))
    pushAll(crown, loft([scaleRing(tower.outer, c, 0.42), scaleRing(tower.outer, c, 0.42)], [top + cr.h * 0.6, top + cr.h]))
  }
  meshes.push(part(body, sp.bodyFacade === 'stone' ? F.stone : F.paint, sp.bodyStyle, 'facade-rhythm'))
  if (skin.positions.length) meshes.push(part(skin, F.stone, sp.base.style, 'base'))
  if (crown.positions.length) meshes.push(part(crown, cr.facade === 'paint' ? F.paint : F.stone, cr.style ?? sp.bodyStyle, 'crown', { lod1: true }))
  if (dark.positions.length) meshes.push(part(dark, F.paint, cr.glassStyle ?? 'gothic-shadow', 'crown-openings'))
  // a skybridge between two towers of one hero (the Hyatt's glass walkways over Stetson Avenue)
  if (sp.skybridge) {
    const towers = out.filter((p) => p.top > 60).sort((a, b) => b.top - a.top).slice(0, 2)
    if (towers.length === 2) {
      const A = ringCentroid(towers[0].outer), B = ringCentroid(towers[1].outer)
      const [y0, y1] = sp.skybridge.y
      meshes.push(part(slab(mesh(), mul2(add2(A, B), 0.5), norm2(sub2(B, A)), Math.hypot(...sub2(B, A)) * 0.6, sp.skybridge.w ?? 6, y0, y1), undefined, sp.skybridge.style, 'skybridge', { lod1: true }))
    }
  }
  return { pieces: out, meshes }
}

// The Seventeenth Church of Christ, Scientist (Harry Weese, 1968): a white travertine half-drum on Wacker Drive, a
// shallow conical lead roof rising to the skylit lantern over the semicircular auditorium.
function church17({ pieces, sp }) {
  const body = widest(pieces), eave = sp.eaveM ?? 16, rise = sp.roofRiseM ?? 5
  const flat = facing(edgesOf(body.outer, 5), sp.flatFace ?? 89, 20).sort((a, b) => b.len - a.len)[0]
  const at = flat ? add2(flat.mid, mul2(flat.n, -(sp.lanternInsetM ?? 9))) : ringCentroid(body.outer)
  const out = [{ ...body, top: eave }]
  const roof = loft([scaleRing(body.outer, at, 1.0), scaleRing(body.outer, at, 0.2)], [eave, eave + rise])
  const frieze = bands(mesh(), edgesOf(body.outer, 1).map((e) => ({ ...e, y0: 0, y1: eave })), { ys: [eave - 2.2], h: 2.2, d: 0.25 })
  const lan = mesh(), glass = mesh()
  pushAll(lan, drum({ at, base: eave + rise - 0.5, top: eave + rise + (sp.lanternH ?? 4.5), r: sp.lanternR ?? 2.4, sides: 16 }))
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2, d = [Math.cos(a), Math.sin(a)], o = add2(at, mul2(d, (sp.lanternR ?? 2.4) * Math.cos(Math.PI / 16))); wallPolygon(glass, o, left(d), d, [[-0.6, eave + rise + 0.6], [0.6, eave + rise + 0.6], [0.6, eave + rise + (sp.lanternH ?? 4.5) - 0.8], [-0.6, eave + rise + (sp.lanternH ?? 4.5) - 0.8]], 0.05) }
  return { pieces: out, meshes: [part(roof, F.paint, 'church17-lead', 'roof', { lod1: true }), part(frieze, F.stone, 'travertine-white', 'frieze'), part(lan, F.stone, 'travertine-white', 'lantern', { lod1: true }), part(glass, F.paint, 'gothic-shadow', 'lantern-glass')] }
}

// ── Rail bridges (A-10) and small river icons (A-11) ──────────────────────────────────────────────────────────

const at2 = (p) => (p.lat != null ? project(p.lon, p.lat) : p)
// A through truss in local leaf coordinates: s along (0 → L), w across (±W/2), h up (0 → H), `panels` Warren panels;
// each member is handed to `seg(a, b, r)` with a, b as [s, w, h].
function trussMembers(L, W, H, panels, seg, { chord = 0.4, web = 0.25 } = {}) {
  for (const w of [-W / 2, W / 2]) {
    seg([0, w, 0], [L, w, 0], chord); seg([0, w, H], [L, w, H], chord)
    for (let i = 0; i <= panels; i++) seg([(i * L) / panels, w, 0], [(i * L) / panels, w, H], web)
    for (let i = 0; i < panels; i++) seg([(i * L) / panels, w, i % 2 ? H : 0], [((i + 1) * L) / panels, w, i % 2 ? 0 : H], web)
  }
  for (let i = 0; i <= panels; i++) { seg([(i * L) / panels, -W / 2, H], [(i * L) / panels, W / 2, H], web * 0.8); seg([(i * L) / panels, -W / 2, 0], [(i * L) / panels, W / 2, 0], web) }
}
// A braced tower of four legs on a w × d footprint, X-braced every `bay` metres, from y0 to y1.
function towerFrame(out, c, u, w, d, y0, y1, bay = 8, r = 0.35) {
  const v = left(u), P = (a, b, y) => Y(add2(add2(c, mul2(u, a)), mul2(v, b)), y)
  const corners = [[-d / 2, -w / 2], [d / 2, -w / 2], [d / 2, w / 2], [-d / 2, w / 2]]
  for (const [a, b] of corners) tube(out, P(a, b, y0), P(a, b, y1), r, 6)
  for (let y = y0; y < y1 - 0.1; y += bay) {
    const yy = Math.min(y1, y + bay)
    for (let i = 0; i < 4; i++) { const [a0, b0] = corners[i], [a1, b1] = corners[(i + 1) % 4]; tube(out, P(a0, b0, y), P(a1, b1, yy), r * 0.6, 4); tube(out, P(a1, b1, y), P(a0, b0, yy), r * 0.6, 4); tube(out, P(a0, b0, yy), P(a1, b1, yy), r * 0.7, 4) }
  }
}

// The Chicago River's railroad bridges: the Kinzie Street bascule (1908), left raised since 2001; the Canal Street
// vertical lift (1914) between its two 185 ft towers; the St. Charles Air Line's heel-trunnion bascule (1919, moved
// and shortened in 1930) under its winged concrete counterweights. None is liftable here: each stands as it is.
function railbridge({ sp }) {
  const steel = mesh(), conc = mesh(), deck = mesh(), u = bearing(sp.bearing), v = left(u)
  const T = at2(sp.at), y0 = sp.deckM ?? 5.8
  const seg = (map) => (a, b, r) => tube(steel, map(a), map(b), r, 6)
  if (sp.kind === 'raised-bascule') {
    // the leaf pivots on its trunnion and stands at `angle` degrees; the overhead counterweight hangs low behind it
    const th = ((sp.angle ?? 60) * Math.PI) / 180, L = sp.leafM ?? 51.8, W = sp.widthM ?? 12.7, H = sp.trussH ?? 9
    const map = ([s, w, h]) => { const x = s * Math.cos(th) - h * Math.sin(th), y = s * Math.sin(th) + h * Math.cos(th); return Y(add2(add2(T, mul2(u, x)), mul2(v, w)), y0 + y) }
    trussMembers(L, W, H, 8, seg(map), { chord: 0.45, web: 0.28 })
    const behind = add2(T, mul2(u, -(sp.towerBackM ?? 9)))
    towerFrame(steel, behind, u, W + 1, 6, 0, sp.towerM ?? 24, 8, 0.4)
    pushAll(conc, slab(mesh(), add2(behind, mul2(u, -1)), u, 7, W - 1, y0, y0 + (sp.weightH ?? 7)))
    tube(steel, Y(behind, (sp.towerM ?? 24) - 1), Y(T, y0 + 2), 0.35, 6) // the link to the heel
  } else if (sp.kind === 'lift') {
    // two towers at the span's ends, the lift span between them down on its rails, counterweights in the towers
    const L = sp.spanM ?? 82, W = sp.widthM ?? 14, H = sp.trussH ?? 10, tH = sp.towerM ?? 56.4
    const A = add2(T, mul2(u, -L / 2)), B = add2(T, mul2(u, L / 2))
    const map = ([s, w, h]) => Y(add2(add2(A, mul2(u, s)), mul2(v, w)), y0 + h)
    trussMembers(L, W, H, 10, seg(map))
    for (const [p, s] of [[A, -1], [B, 1]]) {
      const c = add2(p, mul2(u, s * 4.5))
      towerFrame(steel, c, u, W + 2, 8, 0, tH, 9.5, 0.45)
      pushAll(steel, slab(mesh(), c, u, 9, W + 3, tH - 0.5, tH + 3)) // the sheave house
      pushAll(conc, slab(mesh(), c, u, 3, W - 2, tH - 18, tH - 8))     // the counterweight, raised as the span is down
    }
    pushAll(deck, slab(mesh(), T, u, L, W - 1, y0 - 1.2, y0 - 0.2))
  } else if (sp.kind === 'heel-trunnion') {
    // the span down across the river; at its heel the frame carrying the two winged counterweights high above the rails
    const L = sp.spanM ?? 67, W = sp.widthM ?? 10, H = sp.trussH ?? 11
    const map = ([s, w, h]) => Y(add2(add2(T, mul2(u, s)), mul2(v, w)), y0 + h)
    trussMembers(L, W, H, 9, seg(map))
    const heel = add2(T, mul2(u, -(sp.frameBackM ?? 10)))
    towerFrame(steel, heel, u, W + 1, 12, 0, sp.frameM ?? 33, 8, 0.45)
    for (const w of [-W / 2 - 1.2, W / 2 + 1.2]) {
      // a winged counterweight: a trapezoid slab 17.2 m tall, 3 m wide at the bottom and 12 m at the top, 1.8 m thick
      const ww = sp.weightW ?? [3, 12], yb = (sp.frameM ?? 33) - (sp.weightH ?? 17.2), yt = sp.frameM ?? 33
      const c = add2(heel, mul2(v, w)), P = (a, y) => Y(add2(c, mul2(u, a)), y)
      const pts = [P(-ww[0] / 2, yb), P(ww[0] / 2, yb), P(ww[1] / 2, yt), P(-ww[1] / 2, yt)]
      for (const s of [-1, 1]) { const o = mul2(v, (s * 0.9)), Q = (p) => [p[0] + o[0], p[1], p[2] + o[1]]; quad(conc, Q(pts[0]), Q(pts[1]), Q(pts[2]), Q(pts[3]), [v[0] * s, 0, v[1] * s]) }
      for (let i = 0; i < 4; i++) { const a = pts[i], b = pts[(i + 1) % 4], o = mul2(v, 0.9), n = norm3(cross3([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [v[0], 0, v[1]])); quad(conc, [a[0] - o[0], a[1], a[2] - o[1]], [b[0] - o[0], b[1], b[2] - o[1]], [b[0] + o[0], b[1], b[2] + o[1]], [a[0] + o[0], a[1], a[2] + o[1]], n) }
    }
  }
  // the towers and frames on the banks as hidden pieces: they keep trees out of the steelwork
  const pieces = []
  const box = (c, L, W, top) => pieces.push({ outer: [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => add2(add2(c, mul2(u, (a * L) / 2)), mul2(v, (b * W) / 2))), holes: [], base: 0, top, hidden: true })
  if (sp.kind === 'raised-bascule') box(add2(T, mul2(u, -(sp.towerBackM ?? 9))), 8, (sp.widthM ?? 12.7) + 2, sp.towerM ?? 24)
  if (sp.kind === 'lift') for (const s of [-1, 1]) box(add2(T, mul2(u, s * ((sp.spanM ?? 82) / 2 + 4.5))), 9, (sp.widthM ?? 14) + 3, (sp.towerM ?? 56.4) + 3)
  if (sp.kind === 'heel-trunnion') box(add2(T, mul2(u, -(sp.frameBackM ?? 10))), 13, (sp.widthM ?? 10) + 5, sp.frameM ?? 33)
  const meshes = [part(steel, F.paint, sp.steelStyle ?? 'rail-bridge-steel', 'steel', { lod1: true })]
  if (conc.positions.length) meshes.push(part(conc, F.stone, 'rail-counterweight', 'counterweight', { lod1: true }))
  if (deck.positions.length) meshes.push(part(deck, F.paint, sp.steelStyle ?? 'rail-bridge-steel', 'deck', { lod1: true }))
  return { pieces, meshes }
}

// The Chicago Harbor Lock (USACE, 1938): a 600 × 80 ft chamber between concrete walls at the river's mouth, a pair of
// steel sector gates at each end, and the ship-shaped, zinc-clad control house (c. 2010).
function harborlock({ pieces, sp }) {
  const c = at2(sp.chamber), u = bearing(sp.bearing ?? 90), v = left(u), L = sp.lengthM ?? 182.9, W = sp.widthM ?? 24.4
  const walls = mesh(), gates = mesh(), house = mesh(), glass = mesh()
  for (const s of [-1, 1]) pushAll(walls, slab(mesh(), add2(c, mul2(v, s * (W / 2 + 2))), u, L + 8, 4, 0, sp.wallM ?? 1.8))
  // sector gates: two curved leaves at each end, drawn closed as a shallow V pointing upstream
  for (const e of [-1, 1]) for (const s of [-1, 1]) {
    const hinge = add2(add2(c, mul2(u, (e * L) / 2)), mul2(v, s * (W / 2))), tip = add2(add2(c, mul2(u, (e * L) / 2 + e * 3)), mul2(v, 0))
    for (let k = 0; k < 6; k++) {
      const a = add2(hinge, mul2(sub2(tip, hinge), k / 6)), b = add2(hinge, mul2(sub2(tip, hinge), (k + 1) / 6))
      pushAll(gates, slab(mesh(), mul2(add2(a, b), 0.5), norm2(sub2(b, a)), Math.hypot(...sub2(b, a)) + 0.1, 0.8, -1, sp.gateM ?? 3.2))
    }
  }
  // the control house: a ship-shaped hull of zinc with a tilted glass bridge on top
  const hc = pieces.length ? ringCentroid(widest(pieces).outer) : add2(c, mul2(v, W / 2 + 10)), hl = sp.houseL ?? 24, hw = sp.houseW ?? 9
  const hull = [[-hl / 2, -hw / 2], [hl / 2 - 4, -hw / 2], [hl / 2, 0], [hl / 2 - 4, hw / 2], [-hl / 2, hw / 2]].map(([a, b]) => add2(add2(hc, mul2(u, a)), mul2(v, b)))
  pushAll(house, loft([hull, hull], [0, 6.5]))
  const bridge = [[-4, -3.5], [5, -3.5], [6.5, 0], [5, 3.5], [-4, 3.5]].map(([a, b]) => add2(add2(hc, mul2(u, a + 2)), mul2(v, b)))
  pushAll(glass, loft([bridge, scaleRing(bridge, ringCentroid(bridge), 1.12)], [6.5, 10]))
  return {
    pieces: pieces.map((p) => ({ ...p, top: 10, hidden: true })),
    meshes: [part(walls, F.stone, 'lock-concrete', 'lock-walls', { lod1: true }), part(gates, F.paint, 'lock-gate-steel', 'sector-gates', { lod1: true }), part(house, F.paint, 'lock-zinc', 'control-house', { lod1: true }), part(glass, F.signal, 'lock-bridge-glass', 'control-bridge')],
  }
}

// The Nicholas J. Melas Centennial Fountain (Dirk Lohan, 1989): granite steps falling from a semicircular basin (the
// continental divide) to the river; in season a water cannon shoots an 80 ft arc toward the far bank. The arc itself is
// drawn by the app on MWRD's schedule (landmarks.json runtime: centennialArc).
function centennial({ sp }) {
  const c = at2(sp.at), f = bearing(sp.riverFace ?? 180), side = left(f), W = sp.widthM ?? 28, steps = sp.steps ?? 6, H = sp.heightM ?? 7
  const stone = mesh(), water = mesh()
  // the stepped cascade: each step a granite slab a little lower toward the river
  for (let i = 0; i < steps; i++) {
    const d = (i * (sp.depthM ?? 18)) / steps, h = H * (1 - i / steps)
    pushAll(stone, slab(mesh(), add2(c, mul2(f, d)), f, (sp.depthM ?? 18) / steps + 0.2, W - i * 1.2, 0, h))
    pushAll(water, slab(mesh(), add2(c, mul2(f, d + 0.6)), f, (sp.depthM ?? 18) / steps - 1.0, W - i * 1.2 - 3, h, h + 0.12))
  }
  // the semicircular basin on top, open toward the river
  const basin = mesh(), r = sp.basinR ?? 9
  for (let k = 0; k < 12; k++) {
    const a0 = Math.PI * (k / 12), a1 = Math.PI * ((k + 1) / 12)
    const p0 = add2(c, add2(mul2(side, r * Math.cos(a0)), mul2(f, -r * Math.sin(a0)))), p1 = add2(c, add2(mul2(side, r * Math.cos(a1)), mul2(f, -r * Math.sin(a1))))
    pushAll(basin, slab(mesh(), mul2(add2(p0, p1), 0.5), norm2(sub2(p1, p0)), Math.hypot(...sub2(p1, p0)) + 0.3, 1.2, 0, H + 1.4))
  }
  const nozzle = add2(c, mul2(f, (sp.depthM ?? 18) + 1))
  // the steps' footprint as a hidden piece: it keeps trees off the cascade and carries the hover height
  const foot = [[-W / 2, -r - 1], [W / 2, -r - 1], [W / 2, (sp.depthM ?? 18) + 0.5], [-W / 2, (sp.depthM ?? 18) + 0.5]].map(([a, d]) => add2(add2(c, mul2(side, a)), mul2(f, d)))
  return {
    pieces: [{ outer: foot, holes: [], base: 0, top: H + 1.4, hidden: true }],
    meshes: [part(stone, F.stone, 'centennial-granite', 'steps', { lod1: true }), part(basin, F.stone, 'centennial-granite', 'basin', { lod1: true }), part(water, F.water, null, 'cascade')],
    runtime: { centennialArc: { at: nozzle.map((x) => Math.round(x * 10) / 10), y: 1.2, dir: f.map((x) => Math.round(x * 1000) / 1000), reachM: sp.arcM ?? 24.4, riseM: sp.arcRiseM ?? 9 } },
  }
}

// The Ping Tom Memorial Park boathouse (Johnson & Lee, 2013): a kayak shed of Mandarin-red steel frames and screens
// under a zig-zag (M and V truss) roof, a black masonry service building, and the tall white steel canopy between.
function boathouse({ pieces, sp }) {
  const body = widest(pieces), ob = orientedBox(body.outer), red = mesh(), black = mesh(), white = mesh(), yellow = mesh()
  const P = (a, b, y) => Y(add2(add2(ob.c, mul2(ob.u, a)), mul2(ob.v, b)), y)
  const L = ob.L, W = ob.W, shed = L * 0.45
  // the red shed: frames every 2 m and a zig-zag roof across them
  const k = Math.max(4, Math.round(shed / 2))
  for (let i = 0; i <= k; i++) { const a = -L / 2 + (i * shed) / k; for (const s of [-1, 1]) pushAll(red, slab(mesh(), add2(add2(ob.c, mul2(ob.u, a)), mul2(ob.v, (s * W) / 2)), ob.u, 0.35, 0.35, 0, 5.5)) }
  for (let i = 0; i < k; i++) {
    const a0 = -L / 2 + (i * shed) / k, a1 = -L / 2 + ((i + 1) * shed) / k, up = i % 2 ? 5.5 : 7.2, dn = i % 2 ? 7.2 : 5.5
    quad(red, P(a0, -W / 2, up), P(a1, -W / 2, dn), P(a1, W / 2, dn), P(a0, W / 2, up), [0, 1, 0])
  }
  pushAll(red, slab(mesh(), add2(ob.c, mul2(ob.u, -L / 2 + shed / 2)), ob.u, shed, W - 1.2, 0, 1.2)) // the screened base
  // the black service building at the other end, the white canopy over the gap with its yellow inner canopy
  pushAll(black, slab(mesh(), add2(ob.c, mul2(ob.u, L / 2 - L * 0.15)), ob.u, L * 0.3, W, 0, 4.2))
  const cc = add2(ob.c, mul2(ob.u, -L / 2 + shed + (L - shed - L * 0.3) / 2)), cl = L - shed - L * 0.3
  for (const s of [-1, 1]) for (const t of [-1, 1]) pushAll(white, slab(mesh(), add2(add2(cc, mul2(ob.u, (t * cl) / 2.4)), mul2(ob.v, (s * W) / 2.2)), ob.u, 0.4, 0.4, 0, 8.5))
  pushAll(white, slab(mesh(), cc, ob.u, cl + 1, W + 2, 8.5, 9.0))
  pushAll(yellow, slab(mesh(), cc, ob.u, cl * 0.7, W * 0.7, 6.2, 6.5))
  return {
    pieces: pieces.map((p) => ({ ...p, top: 9, hidden: true })),
    meshes: [part(red, F.paint, 'pingtom-red', 'kayak-shed', { lod1: true }), part(black, F.stone, 'pingtom-black', 'service-building', { lod1: true }), part(white, F.paint, 'pingtom-white', 'canopy', { lod1: true }), part(yellow, F.paint, 'pingtom-yellow', 'inner-canopy')],
  }
}

export const RIVER_SCULPTS = { trump, stregis, wacker333, wabash330, jewelers35, londonhouse, mather, reidmurdoch, mart, opera, postoffice, riverside150, riverpoint, saddle, wacker110, wolfpoint, boeing, riversideplaza, unionstation, rivercity, michigan333, lasalle300, nbc, saltshed, wardcatalog, towerdetail, church17, railbridge, harborlock, centennial, boathouse }

// heroes.js calls this for any `spec.sculpt`: a river sculpt by name, or nothing at all for a name it does not know.
export function riverSculpt(name, ctx) {
  const f = RIVER_SCULPTS[name]
  return f ? f({ ...ctx, sp: ctx.spec?.sculptParams ?? {} }) : null
}
