// pipeline/lib/venue.js — open-air stadiums: raked seating bowl, surfaced field, lights, boards, street landmarks.
// Every piece is a raw non-indexed mesh { positions, normals, uvs } tagged with a venue façade index and a style
// seed; the façade shader draws seats, turf, clay, paint, steel, lamps, screens and stadium walls procedurally.
import earcut from 'earcut'
import polygonClipping from 'polygon-clipping'
import { drum, spire } from './crowns.js'
import { insetRing } from './roofs.js'
import { pointInRing } from './geom.js'

export const VENUE_FACADES = { seats: 9, turf: 10, clay: 11, paint: 12, steel: 13, lamp: 14, screen: 15, wall: 16, marquee: 17, ivy: 18, arena: 16, sacred: 19, roofing: 20 }
// Style selectors travel in _SEED; the shader reads the ranges.
export const STYLE = {
  seats: { green: 0.1, navy: 0.35, red: 0.6, blue: 0.85 },
  wall: { 'brick-steel': 0.05, limestone: 0.2, 'glass-steel': 0.35, concrete: 0.5, arena: 0.65 },
  steel: { green: 0.1, gray: 0.35, white: 0.6, navy: 0.85 },
  paint: { white: 0.1, navy: 0.35, orange: 0.6 },
  turf: { checker: 0.1, bands: 0.6 },
  clay: { infield: 0.1, track: 0.6 },
  screen: { manual: 0.1, video: 0.6 },
  lamp: { flood: 0.1 },
  marquee: { red: 0.1 },
  ivy: { ivy: 0.1 },
}

const FIELD_Y = 0.22
const WALL_H = 3.4

// ── vector helpers (2D ground plane: [x, z]) ─────────────────────────────────
const add = (a, b) => [a[0] + b[0], a[1] + b[1]]
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]]
const mul = (a, s) => [a[0] * s, a[1] * s]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1]
const len = (a) => Math.hypot(a[0], a[1])
const norm = (a) => mul(a, 1 / (len(a) || 1))
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
// left of a heading when seen from above (+x east, −z north)
const left = (d) => [d[1], -d[0]]
const rot = (d, deg) => { const a = (deg * Math.PI) / 180; return add(mul(d, Math.cos(a)), mul(left(d), Math.sin(a))) }
const signedAngle = (d, v) => (Math.atan2(dot(v, left(d)), dot(v, d)) * 180) / Math.PI

export function convexHull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lo = [], hi = []
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q) }
  for (const q of p.reverse()) { while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q) }
  return lo.slice(0, -1).concat(hi.slice(0, -1))
}
const centroidOf = (ring) => mul(ring.reduce((s, p) => add(s, p), [0, 0]), 1 / ring.length)
const circle = (c, r, n = 40) => Array.from({ length: n }, (_, i) => add(c, [r * Math.cos((i / n) * 2 * Math.PI), r * Math.sin((i / n) * 2 * Math.PI)]))
const strip = (a, b, w) => { const n = mul(norm(left(sub(b, a))), w / 2); return [add(a, n), add(b, n), sub(b, n), sub(a, n)] }
const quadAt = (c, u, v, hu, hv) => [add(add(c, mul(u, -hu)), mul(v, -hv)), add(add(c, mul(u, hu)), mul(v, -hv)), add(add(c, mul(u, hu)), mul(v, hv)), add(add(c, mul(u, -hu)), mul(v, hv))]

// Slide a fixture (w wide, dpt deep, facing −d) toward the centre until its footprint sits inside the ring.
function fitInside(ring, center, d, r, w, dpt) {
  const side = left(d)
  for (let rr = r; rr > 0; rr -= 0.5) {
    const at = add(center, mul(d, rr))
    const corners = quadAt(at, side, d, w / 2 + 0.3, dpt / 2 + 0.3)
    if (corners.every((q) => pointInRing(q, ring))) return at
  }
  return add(center, mul(d, r))
}

// Distances along c + t·d where the ray crosses the ring.
function rayHits(ring, c, d) {
  const out = []
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], e = sub(b, a)
    const den = d[0] * e[1] - d[1] * e[0]
    if (Math.abs(den) < 1e-12) continue
    const w = sub(a, c)
    const t = (w[0] * e[1] - w[1] * e[0]) / den, s = (w[0] * d[1] - w[1] * d[0]) / den
    if (t > 1e-6 && s >= 0 && s <= 1) out.push(t)
  }
  return out
}

// Piecewise-linear table [[angle, value], …]; angles ≥ 0 only → symmetric lookup on |angle|.
function lookup(table, angle) {
  const a = table[0][0] >= 0 ? Math.abs(angle) : angle
  if (a <= table[0][0]) return table[0][1]
  for (let i = 1; i < table.length; i++) if (a <= table[i][0]) {
    const [a0, v0] = table[i - 1], [a1, v1] = table[i]
    return v0 + ((v1 - v0) * (a - a0)) / (a1 - a0 || 1)
  }
  return table[table.length - 1][1]
}

// ── mesh helpers ─────────────────────────────────────────────────────────────
const mesh = () => ({ positions: [], normals: [], uvs: [] })
function tri(out, a, b, c, want, ua = [0, 0], ub = [0, 0], uc = [0, 0]) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
  let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
  const l = Math.hypot(...n)
  if (l < 1e-9) return
  if (n[0] * want[0] + n[1] * want[1] + n[2] * want[2] < 0) { [b, c] = [c, b]; [ub, uc] = [uc, ub]; n = n.map((x) => -x) }
  for (const [p, t] of [[a, ua], [b, ub], [c, uc]]) { out.positions.push(...p); out.normals.push(n[0] / l || 0, n[1] / l || 0, n[2] / l || 0); out.uvs.push(...t) }
}
const quad = (out, a, b, c, d, want, ua, ub, uc, ud) => { tri(out, a, b, c, want, ua, ub, uc); tri(out, a, c, d, want, ua, uc, ud) }

// Oriented box: centre (ground xz), base/top heights, fwd = facing direction. Returns front + rest meshes.
export function box(c, fwd, w, dpt, base, top) {
  const f = norm(fwd), r = [-f[1], f[0]]
  const P = (sr, sf, y) => { const q = add(add(c, mul(r, (sr * w) / 2)), mul(f, (sf * dpt) / 2)); return [q[0], y, q[1]] }
  const front = mesh(), rest = mesh()
  const uv = (x, y) => [x, y]
  quad(front, P(-1, 1, base), P(1, 1, base), P(1, 1, top), P(-1, 1, top), [f[0], 0, f[1]], uv(0, base), uv(w, base), uv(w, top), uv(0, top))
  quad(rest, P(-1, -1, base), P(1, -1, base), P(1, -1, top), P(-1, -1, top), [-f[0], 0, -f[1]], uv(0, base), uv(w, base), uv(w, top), uv(0, top))
  quad(rest, P(1, -1, base), P(1, 1, base), P(1, 1, top), P(1, -1, top), [r[0], 0, r[1]], uv(0, base), uv(dpt, base), uv(dpt, top), uv(0, top))
  quad(rest, P(-1, -1, base), P(-1, 1, base), P(-1, 1, top), P(-1, -1, top), [-r[0], 0, -r[1]], uv(0, base), uv(dpt, base), uv(dpt, top), uv(0, top))
  quad(rest, P(-1, -1, top), P(1, -1, top), P(1, 1, top), P(-1, 1, top), [0, 1, 0], uv(0, 0), uv(w, 0), uv(w, dpt), uv(0, dpt))
  return { front, rest }
}

// Flat multipolygon (polygon-clipping format) at height y, uv in a local frame (o, axis).
function flatMP(mp, y, o, axis) {
  const out = mesh(), perp = left(axis)
  for (const poly of mp) {
    const flat = [], holes = []
    poly.forEach((ring, i) => { if (i) holes.push(flat.length / 2); for (const [x, z] of ring.slice(0, -1)) flat.push(x, z) })
    const t = earcut(flat, holes.length ? holes : undefined, 2)
    for (let i = 0; i < t.length; i += 3) {
      const p = [t[i], t[i + 1], t[i + 2]].map((k) => [flat[k * 2], y, flat[k * 2 + 1]])
      const uv = p.map(([x, , z]) => { const v = sub([x, z], o); return [dot(v, axis), dot(v, perp)] })
      tri(out, p[0], p[1], p[2], [0, 1, 0], ...uv)
    }
  }
  return out
}

// Layers in priority order (first wins); the remainder of the field is the base surface.
function surfaceField(fieldRing, layers, base, o, axis) {
  const out = []
  const field = [fieldRing]
  let taken = null
  for (const L of layers) {
    let g = polygonClipping.intersection(field, L.geom)
    if (taken) g = polygonClipping.difference(g, taken)
    taken = taken ? polygonClipping.union(taken, L.geom) : polygonClipping.union(L.geom)
    if (g.length) out.push({ mesh: flatMP(g, FIELD_Y, o, axis), facade: L.facade, seed: L.seed, field: true, part: L.part })
  }
  const rest = taken ? polygonClipping.difference(field, taken) : [field]
  out.push({ mesh: flatMP(rest, FIELD_Y, o, axis), facade: base.facade, seed: base.seed, field: true, part: 'turf' })
  return out
}

// ── the bowl ─────────────────────────────────────────────────────────────────
// Rays from `center` sample the field edge (inner) and the footprint (outer); each ray carries a seating profile.
function bowl({ inner, outer, center, ref, rimAt, roofAt, frontAt, spec, N = 192 }) {
  const rows = [] // per ray: { I, O, H, roof, front }
  for (let k = 0; k < N; k++) {
    const d = rot(ref, (k / N) * 360)
    const hO = rayHits(outer, center, d), hI = rayHits(inner, center, d)
    if (!hO.length || !hI.length) throw new Error(`venue ray ${k} misses the ${hO.length ? 'field' : 'footprint'} (center ${center.map((v) => v.toFixed(1))}, outer ${outer.length} pts, inner ${inner.length} pts)`)
    const rO = Math.max(...hO)
    const rI = Math.min(Math.max(...hI), rO - 6)
    const I = add(center, mul(d, rI)), O = add(center, mul(d, rO))
    rows.push({ I, O, H: rimAt(I), roof: roofAt(I), front: frontAt(I) })
  }
  const tm = 0.5
  const profile = ({ H }) => {
    const tall = H > 18
    const y1 = tall ? 0.42 * H : WALL_H + (H - WALL_H) * tm
    const y2 = tall ? 0.56 * H : y1
    return [[0, 0], [0, WALL_H], [tm, y1], [tm + 0.01, y2], [1, H], [1, H + 1.2]]
  }
  const P = rows.map((r) => profile(r).map(([t, y]) => { const q = lerp(r.I, r.O, t); return [q[0], y, q[1]] }))
  const seats = mesh(), front = { ivy: mesh(), wall: mesh() }, riser = mesh(), rail = mesh(), ext = mesh(), roof = mesh()
  const uAcc = Array.from({ length: 6 }, () => 0)
  for (let k = 0; k < N; k++) {
    const k2 = (k + 1) % N
    const inward = norm(sub(center, lerp(rows[k].I, rows[k2].I, 0.5)))
    const toC = [inward[0], 0, inward[1]], up = [inward[0] * 0.6, 1, inward[1] * 0.6]
    const du = P[k].map((p, j) => Math.hypot(P[k2][j][0] - p[0], P[k2][j][2] - p[2]))
    const u0 = [...uAcc]
    for (let j = 0; j < 6; j++) uAcc[j] += du[j]
    const seg = (out, j, want) => quad(out, P[k][j], P[k2][j], P[k2][j + 1], P[k][j + 1], want,
      [u0[j], P[k][j][1]], [uAcc[j], P[k2][j][1]], [uAcc[j + 1], P[k2][j + 1][1]], [u0[j + 1], P[k][j + 1][1]])
    seg(rows[k].front === 'ivy' ? front.ivy : front.wall, 0, toC)
    seg(seats, 1, up)
    seg(riser, 2, toC)
    seg(seats, 3, up)
    seg(rail, 4, toC)
    // exterior wall down to the street
    const oA = rows[k].O, oB = rows[k2].O, hA = rows[k].H + 1.2, hB = rows[k2].H + 1.2
    quad(ext, [oA[0], 0, oA[1]], [oB[0], 0, oB[1]], [oB[0], hB, oB[1]], [oA[0], hA, oA[1]], [-toC[0], 0, -toC[2]], [u0[5], 0], [uAcc[5], 0], [uAcc[5], hB], [u0[5], hA])
    // rim cap between the top rail and the exterior wall edge (closes the top of the stand)
    // (P[..][5] sits on the outer ring, so the rail itself closes the silhouette)
    if (rows[k].roof && rows[k2].roof) {
      const lift = spec.roofRise ?? 6
      const t0 = 1 - (spec.roofDepth ?? 0.48)
      const a0 = lerp(rows[k].I, rows[k].O, t0), b0 = lerp(rows[k2].I, rows[k2].O, t0)
      const ya = rows[k].H + lift, yb = rows[k2].H + lift
      const A0 = [a0[0], ya, a0[1]], B0 = [b0[0], yb, b0[1]], A1 = [oA[0], ya, oA[1]], B1 = [oB[0], yb, oB[1]]
      quad(roof, A0, B0, B1, A1, [0, 1, 0], [a0[0], a0[1]], [b0[0], b0[1]], [oB[0], oB[1]], [oA[0], oA[1]])
      const dn = (p) => [p[0], p[1] - 0.9, p[2]]
      quad(roof, dn(A0), dn(B0), dn(B1), dn(A1), [0, -1, 0])
      quad(roof, A0, B0, dn(B0), dn(A0), toC)
      // canopy props: a thin steel mullion every few rays from the rail up to the canopy
      if (k % 6 === 0) {
        const m = lerp(rows[k].I, rows[k].O, 0.97)
        const col = spire({ at: m, base: rows[k].H + 1.2, top: ya, r0: 0.35, r1: 0.35, sides: 6 })
        for (const key of ['positions', 'normals', 'uvs']) roof[key].push(...col[key])
      }
    }
  }
  const fieldRing = rows.map((r) => r.I)
  return { rows, fieldRing, seats, front, riser, rail, ext, roof }
}

// ── venue assembly ───────────────────────────────────────────────────────────
export function buildVenue(outline, spec) {
  const F = VENUE_FACADES, S = STYLE
  const out = []
  const put = (m, facade, seed, extra = {}) => { if (m.positions.length) out.push({ mesh: m, facade, seed, ...extra }) }
  const baseball = spec.kind === 'baseball'
  const outer = spec.outerInset ? insetRing(outline, spec.outerInset) : outline

  let innerPts, ref, center, angleOf
  if (baseball) {
    const home = spec.home, d = norm(spec.cf), W = spec.walls
    const fence = [[-45, W.rf], [-22.5, W.rcf], [0, W.cf], [22.5, W.lcf], [45, W.lf]]
    innerPts = []
    for (let a = -45; a <= 45; a += 3) innerPts.push(add(home, mul(rot(d, a), lookup(fence, a))))
    const lf = rot(d, 45), rf = rot(d, -45)
    innerPts.push(add(add(home, mul(lf, W.lf)), mul(left(lf), spec.foul)), add(add(home, mul(rf, W.rf)), mul(left(rf), -spec.foul)))
    for (let a = 90; a <= 270; a += 10) innerPts.push(add(home, mul(rot(d, a), spec.backstop)))
    ref = d
    angleOf = (p) => signedAngle(d, sub(p, home))
  } else {
    const c = spec.center, ax = norm(spec.axis), pr = left(ax)
    const hl = 109.73 / 2 + (spec.endMargin ?? 9), hw = 48.77 / 2 + (spec.sideMargin ?? 11), cr = 16
    innerPts = []
    for (const [sx, sz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
      const cc = add(add(c, mul(ax, sx * (hl - cr))), mul(pr, sz * (hw - cr)))
      for (const q of circle(cc, cr, 16)) innerPts.push(q)
    }
    ref = ax
    angleOf = (p) => signedAngle(ax, sub(p, c))
  }
  const inner = convexHull(innerPts)
  center = baseball ? centroidOf(inner) : spec.center
  const rimAt = (p) => lookup(spec.rim, angleOf(p))
  const roofAt = (p) => spec.roofFrom != null && Math.abs(angleOf(p)) >= spec.roofFrom
  const fair = (p) => baseball && Math.abs(angleOf(p)) <= 46 && len(sub(p, spec.home)) > 60
  const frontAt = (p) => (spec.ivy && fair(p) ? 'ivy' : 'wall')
  const B = bowl({ inner, outer, center, ref, rimAt, roofAt, frontAt, spec })

  put(B.seats, F.seats, S.seats[spec.seats ?? 'green'])
  put(B.front.ivy, F.ivy, S.ivy.ivy)
  put(B.front.wall, F.wall, S.wall[spec.wall ?? 'concrete'])
  put(B.riser, F.wall, S.wall['glass-steel'])
  put(B.rail, F.steel, S.steel[spec.steel ?? 'gray'])
  put(B.ext, F.wall, S.wall[spec.wall ?? 'concrete'])
  put(B.roof, F.steel, S.steel[spec.steel ?? 'gray'])

  // ── field ──
  const fieldRing = B.fieldRing
  const white = { facade: F.paint, seed: S.paint.white }
  if (baseball) {
    const home = spec.home, d = norm(spec.cf), lf = rot(d, 45), rf = rot(d, -45)
    const mound = add(home, mul(d, 18.44))
    const first = add(home, mul(rf, 27.43)), second = add(home, mul(d, 38.8)), third = add(home, mul(lf, 27.43))
    const dc = centroidOf([home, first, second, third])
    const shrink = (p) => lerp(dc, p, 0.84)
    const apex = sub(home, mul(d, 4.24))
    const wedge = [apex, add(apex, mul(lf, 260)), add(apex, mul(d, 368)), add(apex, mul(rf, 260))]
    const track = polygonClipping.difference([fieldRing], [insetRing(fieldRing, 4.6)])
    const layers = [
      { geom: [strip(home, add(home, mul(lf, spec.walls.lf + 6)), 0.3)], ...white, part: 'line' },
      { geom: [strip(home, add(home, mul(rf, spec.walls.rf + 6)), 0.3)], ...white, part: 'line' },
      ...[first, second, third].map((b) => ({ geom: [quadAt(b, d, left(d), 0.45, 0.45)], ...white, part: 'base' })),
      { geom: [quadAt(home, d, left(d), 0.35, 0.35)], ...white, part: 'plate' },
      { geom: [circle(mound, 2.74, 28)], facade: F.clay, seed: S.clay.infield, part: 'mound' },
      { geom: [circle(home, 4.0, 28)], facade: F.clay, seed: S.clay.infield, part: 'home' },
      ...[first, second, third].map((b) => ({ geom: [circle(b, 3.0, 20)], facade: F.clay, seed: S.clay.infield, part: 'basecut' })),
      { geom: [[home, first, second, third].map(shrink)], facade: F.turf, seed: S.turf.checker, part: 'infield-grass' },
      { geom: polygonClipping.intersection([circle(mound, 29, 64)], [wedge]), facade: F.clay, seed: S.clay.infield, part: 'infield' },
      { geom: track, facade: F.clay, seed: S.clay.track, part: 'track' },
    ]
    out.push(...surfaceField(fieldRing, layers, { facade: F.turf, seed: S.turf.checker }, home, d))
  } else {
    const c = spec.center, ax = norm(spec.axis), pr = left(ax)
    const HL = 109.73 / 2, HW = 48.77 / 2, GL = 91.44 / 2
    const lines = []
    for (let i = 0; i <= 20; i++) { const s = -GL + i * 4.572; lines.push({ geom: [strip(add(add(c, mul(ax, s)), mul(pr, -HW)), add(add(c, mul(ax, s)), mul(pr, HW)), 0.3)], ...white, part: 'yard' }) }
    const border = polygonClipping.difference([quadAt(c, ax, pr, HL + 1.8, HW + 1.8)], [quadAt(c, ax, pr, HL, HW)])
    const zone = (s) => ({ geom: [quadAt(add(c, mul(ax, s * (GL + 4.572))), ax, pr, 4.572, HW)], facade: F.paint, seed: S.paint[spec.endZone ?? 'navy'], part: 'endzone' })
    const layers = [
      { geom: border, ...white, part: 'border' }, ...lines,
      { geom: polygonClipping.difference([circle(c, 5, 40)], [circle(c, 3.4, 40)]), facade: F.paint, seed: S.paint[spec.logo ?? 'orange'], part: 'logo' },
      zone(1), zone(-1),
    ]
    out.push(...surfaceField(fieldRing, layers, { facade: F.turf, seed: S.turf.bands }, c, ax))
  }
  out.push({ mesh: mesh(), facade: F.turf, seed: 0, fieldRing })

  // ── light towers ──
  for (const L of spec.lights || []) {
    const d = rot(ref, L.angle)
    const r = Math.max(...rayHits(outer, center, d))
    const at = fitInside(outer, center, d, r - 1.5, L.w ?? 9, 1.6), base = rimAt(at) + 1.2 + (roofAt(at) ? (spec.roofRise ?? 6) : 0)
    put(spire({ at, base, top: base + L.h, r0: 0.7, r1: 0.45, sides: 8 }), F.steel, S.steel[spec.steel ?? 'gray'], { part: 'light' })
    const head = box(at, mul(d, -1), L.w ?? 9, 1.2, base + L.h - 1, base + L.h + 4)
    put(head.front, F.lamp, S.lamp.flood, { part: 'lamp' })
    put(head.rest, F.steel, S.steel[spec.steel ?? 'gray'], { part: 'light' })
  }

  // ── scoreboards / video boards ──
  const boards = [...(spec.boards || [])]
  if (spec.scoreboard) boards.push({ angle: 0, ...spec.scoreboard })
  for (const sb of boards) {
    const d = rot(ref, sb.angle)
    const r = Math.max(...rayHits(outer, center, d))
    const at = fitInside(outer, center, d, r - (sb.setback ?? 6), sb.w, 2.4)
    const base = sb.base ?? rimAt(at) + 1.2
    const bx = box(at, mul(d, -1), sb.w, 2.4, base, base + sb.h)
    put(bx.front, F.screen, S.screen[sb.style ?? 'video'], { part: 'board' })
    put(bx.rest, F.steel, S.steel[spec.steel ?? 'gray'], { part: 'board' })
    if (sb.style === 'manual') {
      const clock = box(at, mul(d, -1), 4.2, 2.6, base + sb.h, base + sb.h + 3.2)
      put(clock.front, F.screen, S.screen.manual, { part: 'board' })
      put(clock.rest, F.steel, S.steel[spec.steel ?? 'gray'], { part: 'board' })
      put(spire({ at, base: base + sb.h + 3.2, top: base + sb.h + 11, r0: 0.18, r1: 0.1, sides: 6 }), F.steel, S.steel.white, { part: 'board' })
    }
  }

  // ── street marquee (behind home plate) ──
  if (spec.marquee) {
    const d = mul(ref, -1)
    const r = Math.max(...rayHits(outline, center, d))
    const at = add(center, mul(d, r + (spec.marquee.out ?? 3)))
    const { w, h, base } = spec.marquee
    const m = box(at, d, w, 0.8, base, base + h)
    put(m.front, F.marquee, S.marquee.red, { part: 'marquee' })
    put(m.rest, F.marquee, S.marquee.red, { part: 'marquee' })
    const side = left(d)
    for (const s of [-1, 1]) put(spire({ at: add(at, mul(side, s * w * 0.32)), base: 0, top: base, r0: 0.35, r1: 0.3, sides: 8 }), F.steel, S.steel.navy, { part: 'marquee' })
  }

  // ── classical colonnades on both long sides (Soldier Field) ──
  if (spec.colonnade) {
    const C = spec.colonnade, ax = norm(spec.axis), pr = left(ax), c = spec.center
    const ext = (v) => Math.max(...outline.map((p) => dot(sub(p, c), v)))
    const L = C.lengthFrac * (ext(ax) + ext(mul(ax, -1)))
    const style = S.wall[C.style ?? 'limestone']
    for (const s of [-1, 1]) {
      const edge = ext(mul(pr, s))
      const mid = (C.from + (C.from + (C.rows - 1) * C.rowGap)) / 2
      const rowC = add(c, mul(pr, s * (edge - mid)))
      const depth = (C.rows - 1) * C.rowGap + 2 * C.r + 2
      const pod = box(rowC, mul(pr, s), L + 4, depth, 0, C.podium)
      put(pod.front, F.wall, style, { part: 'podium' }); put(pod.rest, F.wall, style, { part: 'podium' })
      const ent = box(rowC, mul(pr, s), L + 4, depth, C.podium + C.h, C.podium + C.h + 3)
      put(ent.front, F.wall, style, { part: 'entablature' }); put(ent.rest, F.wall, style, { part: 'entablature' })
      for (let j = 0; j < C.rows; j++) {
        const off = edge - C.from - j * C.rowGap
        for (let a = -L / 2; a <= L / 2 + 1e-6; a += C.spacing) {
          const at = add(add(c, mul(pr, s * off)), mul(ax, a))
          put(drum({ at, base: C.podium, top: C.podium + C.h, r: C.r, sides: 12 }), F.wall, style, { part: 'column' })
        }
      }
    }
  }
  return out
}
