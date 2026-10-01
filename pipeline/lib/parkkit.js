// pipeline/lib/parkkit.js — the small architecture kit the Lincoln Park and zoo sculpts share (Workstream B): oriented
// frames, hip / gable / gambrel roofs, prisms over real OSM outlines, window and door openings cut as dark insets,
// string courses, columns and pediments. Meshes are raw { positions, normals, uvs } in world metres (meshkit.js).
import earcut from 'earcut'
import { convexHull } from './venue.js'
import { orientedBox } from './sacred.js'
import { pointInRing, signedArea } from './geom.js'
import { add2, sub2, mul2, left, norm2, len2, at3, mesh, tri, quad, slab, tube, revolve } from './meshkit.js'
import { wallPolygon } from './icons.js'

// The oriented box of a footprint's hull: c, u (long axis), v = left(u), L ≥ W. `flip` turns u round (a sculpt that
// needs its "front" on a given side passes a compass bearing it should face).
export function frameOf(b, { faceDeg = null } = {}) {
  const ob = orientedBox(convexHull(b.polygons.flatMap((p) => p.outer)))
  let { c, u, L, W } = ob
  if (faceDeg != null) {
    // make v (left of u) point as near the wanted facing as possible: rotate u by multiples of 90°
    const want = [Math.sin((faceDeg * Math.PI) / 180), -Math.cos((faceDeg * Math.PI) / 180)]
    const cands = [[u, L, W], [left(u), W, L], [mul2(u, -1), L, W], [mul2(left(u), -1), W, L]]
    const best = cands.reduce((a, k) => { const v = left(k[0]); return v[0] * want[0] + v[1] * want[1] > a.d ? { d: v[0] * want[0] + v[1] * want[1], k } : a }, { d: -2, k: null }).k
    ;[u, L, W] = best
  }
  return { c, u, v: left(u), L, W }
}
// a point in the frame: a along u, s along v
export const at = (fr, a, s = 0) => add2(add2(fr.c, mul2(fr.u, a)), mul2(fr.v, s))
export const rectRing = (c, u, L, W) => { const v = left(u); return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, s]) => add2(add2(c, mul2(u, (a * L) / 2)), mul2(v, (s * W) / 2))) }

const ccw = (ring) => (signedArea(ring) < 0 ? ring.slice().reverse() : ring)
// The outward normal of edge i of a ring (works for either winding).
export function edgeNormal(ring, i) {
  const a = ring[i], b = ring[(i + 1) % ring.length], t = norm2(sub2(b, a))
  let n = [t[1], -t[0]]
  const mid = mul2(add2(a, b), 0.5)
  if (pointInRing(add2(mid, mul2(n, 0.05)), ring)) n = mul2(n, -1)
  return n
}

// A prism over a real outline: its walls and its flat top (earcut), as separate meshes so they take their own rows.
export function prism(ring, y0, y1, { top = true, bottom = false } = {}) {
  const walls = mesh(), cap = mesh()
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], L = len2(sub2(b, a))
    if (L < 1e-3) continue
    const n = edgeNormal(ring, i)
    quad(walls, at3(a, y0), at3(b, y0), at3(b, y1), at3(a, y1), [n[0], 0, n[1]], [0, y0, L, y1])
  }
  if (top || bottom) {
    const r = ccw(ring), flat = r.flat(), t = earcut(flat)
    for (let i = 0; i < t.length; i += 3) {
      const p = [t[i], t[i + 1], t[i + 2]].map((k) => r[k])
      if (top) tri(cap, at3(p[0], y1), at3(p[1], y1), at3(p[2], y1), [0, 1, 0], p[0], p[1], p[2])
      if (bottom) tri(cap, at3(p[0], y0), at3(p[1], y0), at3(p[2], y0), [0, -1, 0], p[0], p[1], p[2])
    }
  }
  return { walls, top: cap }
}

// A ring pushed out (d > 0) or in (d < 0) by d metres along its edge normals (mitred; fine for the gentle outlines here).
export function offsetRing(ring, d) {
  const n = ring.length, out = []
  for (let i = 0; i < n; i++) {
    const n0 = edgeNormal(ring, (i - 1 + n) % n), n1 = edgeNormal(ring, i), m = norm2(add2(n0, n1))
    const cos = Math.max(0.35, m[0] * n1[0] + m[1] * n1[1])
    out.push(add2(ring[i], mul2(m, d / cos)))
  }
  return out
}

// A hipped roof over an oriented rectangle: eaves at y0 pushed out by `over`, rising `rise` to a ridge along u (a
// pyramid when L = W). The soffit underneath closes it, so it reads from below.
export function hipRoof(c, u, L, W, y0, rise, over = 0.6) {
  const out = mesh(), v = left(u), hl = L / 2 + over, hw = W / 2 + over, r = Math.max(0, hl - hw)
  const E = (a, s) => at3(add2(add2(c, mul2(u, a)), mul2(v, s)), y0)
  const R = (a) => at3(add2(c, mul2(u, a)), y0 + rise)
  const e = [E(-hl, -hw), E(hl, -hw), E(hl, hw), E(-hl, hw)]
  const up = (n) => [n[0], 1, n[1]]
  quad(out, e[0], e[1], R(r), R(-r), up(mul2(v, -1))) // the long slopes (a triangle each when r = 0)
  quad(out, e[2], e[3], R(-r), R(r), up(v))
  tri(out, e[1], e[2], R(r), up(u)); tri(out, e[3], e[0], R(-r), up(mul2(u, -1))) // the hips
  quad(out, e[0], e[1], e[2], e[3], [0, -1, 0])
  return out
}
// A gabled roof (ridge along u): two slopes and the soffit; `gables` are the triangular end walls at ±L/2 (wall row).
export function gableRoof(c, u, L, W, y0, rise, over = 0.5) {
  const roof = mesh(), gables = mesh(), v = left(u), hl = L / 2 + over, hw = W / 2 + over
  const P = (a, s, y) => at3(add2(add2(c, mul2(u, a)), mul2(v, s)), y)
  const k = (W / 2 + over) / (W / 2) // the slope continues past the wall to the eave
  const yE = y0 + rise - rise * k
  for (const s of [-1, 1]) quad(roof, P(-hl, s * hw, yE), P(hl, s * hw, yE), P(hl, 0, y0 + rise), P(-hl, 0, y0 + rise), [v[0] * s, 1, v[1] * s])
  quad(roof, P(-hl, -hw, yE), P(hl, -hw, yE), P(hl, hw, yE), P(-hl, hw, yE), [0, -1, 0])
  for (const e of [-1, 1]) tri(gables, P((e * L) / 2, -W / 2, y0), P((e * L) / 2, W / 2, y0), P((e * L) / 2, 0, y0 + rise), [u[0] * e, 0, u[1] * e])
  return { roof, gables }
}
// A gambrel (barn) roof: two pitches a side — steep from the eave to the knee, shallow to the ridge — with gable ends.
export function gambrelRoof(c, u, L, W, y0, knee, ridge, { kneeIn = 0.22, over = 0.4 } = {}) {
  const roof = mesh(), gables = mesh(), v = left(u), hl = L / 2 + over
  const prof = [[-W / 2 - over, y0 - 0.3], [-W / 2 + kneeIn * W, y0 + knee], [0, y0 + ridge], [W / 2 - kneeIn * W, y0 + knee], [W / 2 + over, y0 - 0.3]]
  const P = (a, [s, y]) => at3(add2(add2(c, mul2(u, a)), mul2(v, s)), y)
  for (let i = 0; i + 1 < prof.length; i++) {
    const [s0, y0a] = prof[i], [s1, y1a] = prof[i + 1], n = [-(y1a - y0a), s1 - s0] // outward-up in (s, y)
    quad(roof, P(-hl, prof[i]), P(hl, prof[i]), P(hl, prof[i + 1]), P(-hl, prof[i + 1]), [v[0] * n[0], n[1], v[1] * n[0]].map((x) => x * Math.sign(n[1] || 1)))
  }
  const wall = [[-W / 2, y0], [-W / 2 + kneeIn * W * (W / 2) / (W / 2 + over), y0 + knee * 0.98], [0, y0 + ridge - 0.05], [W / 2 - kneeIn * W * (W / 2) / (W / 2 + over), y0 + knee * 0.98], [W / 2, y0]]
  for (const e of [-1, 1]) {
    const o = add2(c, mul2(u, (e * L) / 2)), d = mul2(u, e)
    wallPolygon(gables, o, v, d, wall, 0)
  }
  return { roof, gables }
}

// A round-headed opening [s, y] outline, springing at `spring`, `n` segments over the head.
export function roundHead(halfW, sill, spring, n = 8) {
  const pts = [[-halfW, sill], [halfW, sill]]
  for (let k = 0; k <= n; k++) { const a = (k / n) * Math.PI; pts.push([halfW * Math.cos(a), spring + halfW * Math.sin(a)]) }
  return pts
}
export const flatHead = (halfW, sill, head) => [[-halfW, sill], [halfW, sill], [halfW, head], [-halfW, head]]
// A band following a round arch (its archivolt), standing `depth` proud: inner radius r, outer r + ring.
export function archivolt(out, origin, along, dir, r, ring, spring, depth, n = 12) {
  const P = (s, y, d) => [origin[0] + along[0] * s + dir[0] * d, y, origin[1] + along[1] * s + dir[1] * d]
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * Math.PI, a1 = ((k + 1) / n) * Math.PI
    const i0 = [r * Math.cos(a0), spring + r * Math.sin(a0)], i1 = [r * Math.cos(a1), spring + r * Math.sin(a1)]
    const o0 = [(r + ring) * Math.cos(a0), spring + (r + ring) * Math.sin(a0)], o1 = [(r + ring) * Math.cos(a1), spring + (r + ring) * Math.sin(a1)]
    quad(out, P(...i0, depth), P(...i1, depth), P(...o1, depth), P(...o0, depth), [dir[0], 0, dir[1]])
    quad(out, P(...o0, 0), P(...o1, 0), P(...o1, depth), P(...o0, depth), [Math.cos((a0 + a1) / 2) * along[0], Math.sin((a0 + a1) / 2), Math.cos((a0 + a1) / 2) * along[1]])
  }
  return out
}

// Openings along one wall from a to b (outward normal n): `count` (or every `spacing` m) dark insets of the given
// outline, `margin` m clear of each end. Sills (a stone ledge under each) go to `sills` when given.
export function openingsAlong(out, a, b, n, { count = null, spacing = 4, margin = 1.5, outline, proud = 0.05, sills = null, sillW = 0.3 }) {
  const d = sub2(b, a), L = len2(d), t = norm2(d), usable = L - 2 * margin
  if (usable <= 0) return 0
  const k = count ?? Math.max(1, Math.floor(usable / spacing) + 1)
  for (let i = 0; i < k; i++) {
    const s = k === 1 ? L / 2 : margin + (usable * i) / (k - 1)
    const o = add2(a, mul2(t, s))
    wallPolygon(out, o, t, n, outline, proud)
    if (sills) { const xs = outline.map((p) => p[0]), y = Math.min(...outline.map((p) => p[1])); slab(sills, add2(o, mul2(n, 0.12)), t, Math.max(...xs) - Math.min(...xs) + 0.3, 0.26, y - 0.18, y) }
  }
  return k
}
// …round every face of an oriented box, faces listed as 'front' (+v), 'back' (−v), 'left' (−u), 'right' (+u).
export function boxFaces(c, u, L, W) {
  const v = left(u), P = (a, s) => add2(add2(c, mul2(u, a)), mul2(v, s))
  return {
    front: { a: P(L / 2, W / 2), b: P(-L / 2, W / 2), n: v, len: L },
    back: { a: P(-L / 2, -W / 2), b: P(L / 2, -W / 2), n: mul2(v, -1), len: L },
    left: { a: P(-L / 2, W / 2), b: P(-L / 2, -W / 2), n: mul2(u, -1), len: W },
    right: { a: P(L / 2, -W / 2), b: P(L / 2, W / 2), n: u, len: W },
  }
}

// A string course or cornice round an oriented box: a slab `proud` m bigger each side, from y0 to y1.
export const band = (out, c, u, L, W, y0, y1, proud = 0.15) => slab(out, c, u, L + 2 * proud, W + 2 * proud, y0, y1)
// …and round a real outline.
export function ringBand(out, ring, y0, y1, proud = 0.15) {
  const r = offsetRing(ring, proud), p = prism(r, y0, y1, { top: true, bottom: true })
  for (const m of [p.walls, p.top]) for (const k of ['positions', 'normals', 'uvs']) out[k].push(...m[k])
  return out
}

// Turned columns between two points on the ground: base, shaft (with entasis) and capital, `sides` facets.
export function column(out, p, y0, y1, r, sides = 10) {
  const h = y1 - y0
  const prof = [[r * 1.35, y0], [r * 1.35, y0 + 0.12 * r * 4], [r * 1.08, y0 + 0.2 * r * 4], [r, y0 + 0.08 * h], [r * 0.98, y0 + 0.5 * h], [r * 0.86, y1 - 0.06 * h], [r * 1.2, y1 - 0.03 * h], [r * 1.45, y1 - 0.02 * h], [r * 1.45, y1], [0.001, y1]]
  const m = revolve(p, prof, { sides })
  for (const k of ['positions', 'normals', 'uvs']) out[k].push(...m[k])
  return out
}
// A triangular pediment over a portico face: centre `o` on the wall line, `along` across the face, `dir` out, a slab
// `depth` deep from the face, base y0, apex y0 + rise.
export function pediment(out, o, along, dir, span, depth, y0, rise) {
  const P = (s, y, d) => [o[0] + along[0] * s + dir[0] * d, y, o[1] + along[1] * s + dir[1] * d]
  const h = span / 2
  for (const d of [0, depth]) tri(out, P(-h, y0, d), P(h, y0, d), P(0, y0 + rise, d), d ? [dir[0], 0, dir[1]] : [-dir[0], 0, -dir[1]])
  const sl = (s0, s1) => { const n = norm2([-(rise * Math.sign(s1 - s0)), h]); return [along[0] * n[0], n[1], along[1] * n[0]] }
  quad(out, P(-h, y0, 0), P(0, y0 + rise, 0), P(0, y0 + rise, depth), P(-h, y0, depth), sl(-h, 0))
  quad(out, P(0, y0 + rise, 0), P(h, y0, 0), P(h, y0, depth), P(0, y0 + rise, depth), sl(0, h))
  quad(out, P(-h, y0, 0), P(h, y0, 0), P(h, y0, depth), P(-h, y0, depth), [0, -1, 0])
  return out
}

// A masonry hall over a real outline: walls to the eave, a water table at the foot, belt courses and a cornice, and
// window openings on every wall long enough to hold one (`skip(point)` keeps them off an entrance). Returns
// { walls, trim, glass, sills } for the caller to give their rows.
export function masonryHall(ring, { eave, plinth = 0.9, belts = [], cornice = 0.6, corniceProud = 0.3, windows = null, skip = () => false, top = true }) {
  const walls = prism(ring, 0, eave, { top }), trim = mesh(), glass = mesh(), sills = mesh()
  if (plinth > 0) ringBand(trim, ring, 0, plinth, 0.1)
  for (const y of belts) ringBand(trim, ring, y, y + 0.3, 0.06)
  if (cornice > 0) ringBand(trim, ring, eave - cornice, eave, corniceProud)
  if (windows) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length], L = len2(sub2(b, a))
      if (L < (windows.minEdge ?? 4)) continue
      const n = edgeNormal(ring, i), t = norm2(sub2(b, a)), m = windows.margin ?? 1.5, usable = L - 2 * m
      const k = Math.max(1, Math.floor(usable / windows.spacing) + 1)
      for (let j = 0; j < k; j++) {
        const s = k === 1 ? L / 2 : m + (usable * j) / (k - 1), o = add2(a, mul2(t, s))
        if (skip(o)) continue
        wallPolygon(glass, o, t, n, windows.outline, 0.05)
        const xs = windows.outline.map((p) => p[0]), y = Math.min(...windows.outline.map((p) => p[1]))
        slab(sills, add2(o, mul2(n, 0.12)), t, Math.max(...xs) - Math.min(...xs) + 0.3, 0.26, y - 0.18, y)
      }
    }
  }
  return { walls: walls.walls, top: walls.top, trim, glass, sills }
}

// A glasshouse roof over a stadium plan: a straight spine of half-length `spineHalf` along u, round ends, and a
// cross-section `profile` [[d, y], …] from the eave (d = half-width) up to the crown (d ≈ 0) — a bell, an ogee or a
// barrel as the profile says. Returns { glass, ribs }: the panes, and the white glazing bars standing proud of them
// (every `ribEvery`-th meridian, and a purlin at each profile point listed in `purlins`).
export function bellRoof(c, u, spineHalf, profile, { K = 8, M = 10, ribEvery = 1, purlins = [], ribW = 0.07, ribProud = 0.05 } = {}) {
  const v = left(u), N = 2 * K + 2 * M, glass = mesh(), ribs = mesh()
  // point i of the ring at distance d from the spine: its position and outward (horizontal) direction
  const pt = (i, d) => {
    if (i < K) { const a = spineHalf - (2 * spineHalf * i) / K; return { p: add2(add2(c, mul2(u, a)), mul2(v, -d)), r: mul2(v, -1) } }
    if (i < K + M) { const f = -Math.PI / 2 - (Math.PI * (i - K)) / M, r = add2(mul2(u, Math.cos(f)), mul2(v, Math.sin(f))); return { p: add2(add2(c, mul2(u, -spineHalf)), mul2(r, d)), r } }
    if (i < 2 * K + M) { const a = -spineHalf + (2 * spineHalf * (i - K - M)) / K; return { p: add2(add2(c, mul2(u, a)), mul2(v, d)), r: v } }
    const f = Math.PI / 2 - (Math.PI * (i - 2 * K - M)) / M, r = add2(mul2(u, Math.cos(f)), mul2(v, Math.sin(f)))
    return { p: add2(add2(c, mul2(u, spineHalf)), mul2(r, d)), r }
  }
  for (let j = 0; j + 1 < profile.length; j++) {
    const [d0, y0] = profile[j], [d1, y1] = profile[j + 1]
    for (let i = 0; i < N; i++) {
      const i1 = (i + 1) % N, A = pt(i, d0), B = pt(i1, d0), C = pt(i1, d1), D = pt(i, d1)
      const rm = norm2(add2(A.r, B.r)), want = [rm[0] * (y1 - y0), d0 - d1, rm[1] * (y1 - y0)]
      quad(glass, at3(A.p, y0), at3(B.p, y0), at3(C.p, y1), at3(D.p, y1), want)
      if (i % ribEvery === 0) {
        // a glazing bar down this meridian: a narrow strip standing proud of the pane
        const t = norm2(sub2(pt((i + 1) % N, d0).p, pt((i - 1 + N) % N, d0).p)), lift = (q, r, y) => at3(add2(add2(q, mul2(r, ribProud)), [0, 0]), y)
        const a0 = add2(A.p, mul2(t, -ribW)), a1 = add2(A.p, mul2(t, ribW)), d0p = add2(D.p, mul2(t, -ribW)), d1p = add2(D.p, mul2(t, ribW))
        quad(ribs, lift(a0, A.r, y0 + 0.02), lift(a1, A.r, y0 + 0.02), lift(d1p, D.r, y1 + 0.02), lift(d0p, D.r, y1 + 0.02), want)
      }
    }
  }
  for (const j of purlins) {
    const [d, y] = profile[j], [dn, yn] = profile[Math.min(j + 1, profile.length - 1)]
    const k = Math.hypot(d - dn, yn - y) || 1, dd = ((d - dn) / k) * 0.08, dy = ((yn - y) / k) * 0.08
    for (let i = 0; i < N; i++) {
      const A = pt(i, d + 0.04), B = pt((i + 1) % N, d + 0.04), rm = norm2(add2(A.r, B.r))
      quad(ribs, at3(add2(A.p, mul2(A.r, dd)), y - dy + 0.03), at3(add2(B.p, mul2(B.r, dd)), y - dy + 0.03), at3(add2(B.p, mul2(B.r, -dd)), y + dy + 0.03), at3(add2(A.p, mul2(A.r, -dd)), y + dy + 0.03), [rm[0], 0.6, rm[1]])
    }
  }
  return { glass, ribs }
}

// Lines across an outline: every `spacing` m perpendicular to `dir`, clipped to the ring (even–odd), as segments
// [[a, b], …] — the glazing bars of a flat glass roof, rows of seats, furrows.
export function hatch(ring, dir, spacing) {
  const d = norm2(dir), n = left(d), proj = (p) => p[0] * n[0] + p[1] * n[1], along = (p) => p[0] * d[0] + p[1] * d[1]
  const ks = ring.map(proj), lo = Math.min(...ks), hi = Math.max(...ks), out = []
  for (let k = lo + spacing / 2; k < hi; k += spacing) {
    const xs = []
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length], pa = proj(a) - k, pb = proj(b) - k
      if ((pa < 0) !== (pb < 0)) { const t = pa / (pa - pb); xs.push(add2(a, mul2(sub2(b, a), t))) }
    }
    xs.sort((p, q) => along(p) - along(q))
    for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i], xs[i + 1]])
  }
  return out
}

// Lookups into the city the builders may need (a garden's beds, the houses inside a conservatory's outline). Set by
// build-world (and preview-site) before the heroes are applied; a unit test passes its own.
let site = { building: () => null, green: () => null }
export function setSiteLookup(fns) { site = { ...site, ...fns } }
export const siteBuilding = (ref) => site.building(ref)
export const siteGreen = (id) => site.green(id)

// Concatenate meshes into `into` (in place).
export function into(dst, ...ms) { for (const m of ms) for (const k of ['positions', 'normals', 'uvs']) dst[k].push(...m[k]); return dst }
export const triCount = (meshes) => meshes.reduce((n, m) => n + (m.mesh ?? m).positions.length / 9, 0)
export { tube }
