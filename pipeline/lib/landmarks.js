// pipeline/lib/landmarks.js — Chicago's civic icons that are not boxes: the Centennial Wheel, Cloud Gate,
// Buckingham Fountain, Pritzker Pavilion, the Chicago Theatre sign, museum domes and porticos, the Water Tower.
// Builders return { meshes: [{ mesh, facade, seed, part }], pieces?, replace? } in world metres.
import { convexHull, box, STYLE } from './venue.js'
import { orientedBox, lathe, DOME, SACRED_STYLE } from './sacred.js'
import { drum, spire, pyramid } from './crowns.js'

export const LANDMARK_FACADES = { chrome: 21, water: 22, led: 23, marquee: 17, steel: 13, wall: 16, roofing: 20, paint: 12 }
const F = LANDMARK_FACADES

const add2 = (a, b) => [a[0] + b[0], a[1] + b[1]]
const mul2 = (a, s) => [a[0] * s, a[1] * s]
const left = (d) => [d[1], -d[0]]
const bearing = (deg) => [Math.sin((deg * Math.PI) / 180), -Math.cos((deg * Math.PI) / 180)]
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm3 = (a) => { const l = Math.hypot(...a) || 1; return a.map((x) => x / l) }
const at3 = (p2, y) => [p2[0], y, p2[1]]

const mesh = () => ({ positions: [], normals: [], uvs: [] })
function tri(out, a, b, c, want, ua = [0, 0], ub = [0, 0], uc = [0, 0]) {
  const u = sub3(b, a), v = sub3(c, a)
  let n = cross3(u, v)
  const l = Math.hypot(...n)
  if (l < 1e-9) return
  if (want && n[0] * want[0] + n[1] * want[1] + n[2] * want[2] < 0) { [b, c] = [c, b]; [ub, uc] = [uc, ub]; n = n.map((x) => -x) }
  for (const [p, t] of [[a, ua], [b, ub], [c, uc]]) { out.positions.push(...p); out.normals.push(n[0] / l || 0, n[1] / l || 0, n[2] / l || 0); out.uvs.push(...t) }
}
const merge = (...ms) => { const o = mesh(); for (const m of ms) for (const k of ['positions', 'normals', 'uvs']) o[k].push(...m[k]); return o }

// Cylinder between two 3D points; uvX pins the u coordinate (the wheel's LEDs read their angle from it).
function tube(out, a, b, r, sides = 6, uvX = null) {
  const d = norm3(sub3(b, a)), h = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
  const e1 = norm3(cross3(d, h)), e2 = cross3(d, e1)
  const ring = (p) => Array.from({ length: sides }, (_, k) => {
    const t = (k / sides) * Math.PI * 2, o = [e1[0] * Math.cos(t) + e2[0] * Math.sin(t), e1[1] * Math.cos(t) + e2[1] * Math.sin(t), e1[2] * Math.cos(t) + e2[2] * Math.sin(t)]
    return { p: [p[0] + o[0] * r, p[1] + o[1] * r, p[2] + o[2] * r], o }
  })
  const A = ring(a), B = ring(b), len = Math.hypot(...sub3(b, a))
  for (let k = 0; k < sides; k++) {
    const k2 = (k + 1) % sides, want = A[k].o.map((x, i) => x + A[k2].o[i])
    const u0 = uvX ?? k / sides, u1 = uvX ?? (k + 1) / sides
    tri(out, A[k].p, A[k2].p, B[k2].p, want, [u0, 0], [u1, 0], [u1, len]); tri(out, A[k].p, B[k2].p, B[k].p, want, [u0, 0], [u1, len], [u0, len])
  }
  return out
}
function disc(at, r, y, sides = 48) {
  const out = mesh()
  for (let k = 0; k < sides; k++) {
    const a0 = (k / sides) * Math.PI * 2, a1 = ((k + 1) / sides) * Math.PI * 2
    const p0 = [at[0] + r * Math.cos(a0), y, at[1] + r * Math.sin(a0)], p1 = [at[0] + r * Math.cos(a1), y, at[1] + r * Math.sin(a1)]
    tri(out, [at[0], y, at[1]], p0, p1, [0, 1, 0], [at[0], at[1]], [p0[0], p0[2]], [p1[0], p1[2]])
  }
  return out
}

const hullOf = (b) => convexHull(b.polygons.flatMap((p) => p.outer))
const obOf = (b) => orientedBox(hullOf(b))

// ── Centennial Wheel ─────────────────────────────────────────────────────────
function wheel(b, spec) {
  const { c, u, v } = obOf(b)
  const H = spec.heightM ?? 60, R = (H - 4) / 2, hubY = 4 + R
  const P = (ang, off) => { const q = add2(add2(c, mul2(u, Math.cos(ang) * R)), mul2(v, off)); return [q[0], hubY + Math.sin(ang) * R, q[1]] }
  const hub = (off) => at3(add2(c, mul2(v, off)), hubY)
  const led = mesh(), steel = mesh(), N = 48
  for (const off of [-1.6, 1.6]) for (let k = 0; k < N; k++) tube(led, P((k / N) * Math.PI * 2, off), P(((k + 1) / N) * Math.PI * 2, off), 0.35, 5, k / N)
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2
    tube(led, hub(-0.9), P(a, -1.6), 0.13, 4, k / 24); tube(led, hub(0.9), P(a, 1.6), 0.13, 4, k / 24)
    if (k % 2 === 0) tube(steel, P(a, -1.6), P(a, 1.6), 0.16, 4)
  }
  tube(steel, hub(-2.4), hub(2.4), 1.4, 12)
  for (const su of [-1, 1]) for (const sv of [-1, 1]) tube(steel, hub(sv * 2.2), at3(add2(add2(c, mul2(u, su * 14)), mul2(v, sv * 6)), 0), 0.6, 8)
  const gondolas = []
  for (let k = 0; k < 42; k++) {
    const a = (k / 42) * Math.PI * 2, p = P(a, 0)
    const g = box([p[0], p[2]], v, 2.4, 3.0, p[1] - 3.3, p[1] - 0.9)
    gondolas.push(g.front, g.rest)
  }
  return { replace: true, pieces: [], meshes: [
    { mesh: led, facade: F.led, seed: 0.1, part: 'rim' },
    { mesh: steel, facade: F.steel, seed: STYLE.steel.white, part: 'frame' },
    { mesh: merge(...gondolas), facade: F.wall, seed: STYLE.wall['glass-steel'], part: 'gondola' },
  ] }
}

// ── Cloud Gate ───────────────────────────────────────────────────────────────
function bean(b) {
  const { c, u, v } = obOf(b)
  const HL = 10.05, HW = 6.4, S = 48, T = 28, out = mesh()
  const sec = (s) => {
    const top = 0.3 + 9.7 * Math.pow(Math.max(0, 1 - s * s), 0.4)
    const bottom = 3.7 * Math.max(0, 1 - (s / 0.75) ** 2)
    return { yc: (top + bottom) / 2, hh: (top - bottom) / 2, w: HW * Math.pow(Math.max(0, 1 - s * s), 0.5) }
  }
  const pt = (i, j) => {
    const s = -1 + (2 * i) / S, t = (j / T) * Math.PI * 2, q = sec(s)
    const g = add2(add2(c, mul2(u, s * HL)), mul2(v, q.w * Math.cos(t)))
    return { p: [g[0], q.yc + q.hh * Math.sin(t), g[1]], ctr: [c[0] + u[0] * s * HL, q.yc, c[1] + u[1] * s * HL] }
  }
  for (let i = 0; i < S; i++) for (let j = 0; j < T; j++) {
    const a = pt(i, j), b2 = pt(i + 1, j), cc = pt(i + 1, j + 1), d = pt(i, j + 1)
    const want = sub3(a.p, a.ctr)
    tri(out, a.p, b2.p, cc.p, want, [i, j], [i + 1, j], [i + 1, j + 1]); tri(out, a.p, cc.p, d.p, want, [i, j], [i + 1, j + 1], [i, j + 1])
  }
  return { replace: true, pieces: [], meshes: [{ mesh: out, facade: F.chrome, seed: 0.1, part: 'bean' }] }
}

// ── Buckingham Fountain ──────────────────────────────────────────────────────
function fountain(b) {
  const c = b.centroid, stone = STYLE.wall.limestone
  const meshes = [
    { mesh: disc(c, 42.3, 0.45, 72), facade: F.water, seed: 0.1, part: 'pool' },
    { mesh: lathe(c, 0, 42.7, [[1, 0], [1, 0.025], [0.99, 0.025], [0.99, 0.012]], 72), facade: F.wall, seed: stone, part: 'rim' },
    { mesh: drum({ at: c, base: 0, top: 9.4, r: 1.9, sides: 16 }), facade: F.wall, seed: stone, part: 'column' },
  ]
  for (const [r, base, top] of [[13.7, 1.0, 3.2], [7.3, 4.6, 6.4], [4.9, 7.8, 9.2]]) {
    const h = top - base
    meshes.push({ mesh: lathe(c, base, r, [[0.2, 0], [0.55, (h / r) * 0.45], [0.95, (h / r) * 0.9], [1, h / r]], 40), facade: F.wall, seed: stone, part: 'basin' })
    meshes.push({ mesh: disc(c, r * 0.97, top - 0.05, 40), facade: F.water, seed: 0.1, part: 'basin-water' })
  }
  meshes.push({ mesh: spire({ at: c, base: 9.2, top: 17, r0: 0.45, r1: 0.12, sides: 10 }), facade: F.paint, seed: STYLE.paint.white, part: 'jet' })
  return { replace: true, pieces: [], meshes }
}

// ── Chicago Theatre sign ─────────────────────────────────────────────────────
function theatreSign(b, spec) {
  const d = bearing(spec.facingBearing ?? 90), hull = hullOf(b)
  const c = hull.reduce((s, p) => add2(s, p), [0, 0]).map((x) => x / hull.length)
  const face = Math.max(...hull.map((p) => (p[0] - c[0]) * d[0] + (p[1] - c[1]) * d[1]))
  const at = add2(c, mul2(d, face))
  const sign = box(add2(at, mul2(d, 1.6)), d, 3.2, 1.2, 7, 25)
  const canopy = box(add2(at, mul2(d, 1.6)), d, 15, 3.2, 4, 6.8)
  return { meshes: [
    { mesh: merge(sign.front, sign.rest), facade: F.marquee, seed: STYLE.marquee.red, part: 'sign' },
    { mesh: merge(canopy.front, canopy.rest), facade: F.marquee, seed: STYLE.marquee.red, part: 'canopy' },
  ] }
}

// ── Museum dome + porticos ───────────────────────────────────────────────────
function museum(b, spec) {
  const ob = obOf(b), { c, u, v, L, W } = ob
  const top = b.height, meshes = []
  const stone = STYLE.wall.limestone
  if (spec.dome) {
    const { r } = spec.dome, at = add2(add2(c, mul2(u, (spec.dome.at?.[0] ?? 0) * L)), mul2(v, (spec.dome.at?.[1] ?? 0) * W))
    const roofing = SACRED_STYLE.roofing[spec.dome.style ?? 'copper']
    meshes.push({ mesh: drum({ at, base: top - 1, top: top + r * 0.3, r: r * 1.03, sides: spec.dome.sides ?? 24 }), facade: F.wall, seed: stone, part: 'drum' })
    meshes.push({ mesh: spec.dome.sides ? pyramid({ ring: Array.from({ length: spec.dome.sides }, (_, i) => { const a = (i / spec.dome.sides) * Math.PI * 2; return [at[0] + Math.cos(a) * r, at[1] + Math.sin(a) * r] }), base: top + r * 0.3, top: top + r * 1.3 }) : lathe(at, top + r * 0.3, r, DOME, 24), facade: F.roofing, seed: roofing, part: 'dome' })
    meshes.push({ mesh: drum({ at, base: top + r * 1.25, top: top + r * 1.55, r: r * 0.14, sides: 10 }), facade: F.wall, seed: stone, part: 'lantern' })
  }
  if (spec.portico) {
    const { ends = 2, columns = 8, h = 16, r = 1.05 } = spec.portico
    for (const s of ends === 2 ? [1, -1] : [spec.portico.side ?? 1]) {
      const face = add2(c, mul2(u, s * (L / 2 + 3.2)))
      const span = Math.min(0.62 * W, columns * 5.2)
      for (let i = 0; i < columns; i++) {
        const at = add2(face, mul2(v, -span / 2 + (span * i) / (columns - 1)))
        meshes.push({ mesh: drum({ at, base: 1.6, top: 1.6 + h, r, sides: 12 }), facade: F.wall, seed: stone, part: 'column' })
      }
      const step = box(face, mul2(u, s), span + 6, 8, 0, 1.6)
      const ent = box(face, mul2(u, s), span + 4, 7.4, 1.6 + h, 1.6 + h + 2.4)
      meshes.push({ mesh: merge(step.front, step.rest, ent.front, ent.rest), facade: F.wall, seed: stone, part: 'portico' })
      // pediment: a low gable across the portico
      const ped = mesh(), y0 = 1.6 + h + 2.4, rise = 0.18 * (span + 4)
      const Pp = (a, bb, y) => at3(add2(add2(face, mul2(v, a)), mul2(u, s * bb)), y)
      const hw = (span + 4) / 2
      for (const e of [-3.7, 3.7]) tri(ped, Pp(-hw, e, y0), Pp(hw, e, y0), Pp(0, e, y0 + rise), [u[0] * s * Math.sign(e), 0, u[1] * s * Math.sign(e)])
      for (const sv of [-1, 1]) { const A = Pp(sv * hw, -3.7, y0), B = Pp(sv * hw, 3.7, y0), T0 = Pp(0, -3.7, y0 + rise), T1 = Pp(0, 3.7, y0 + rise); tri(ped, A, B, T1, [v[0] * sv, 1, v[1] * sv]); tri(ped, A, T1, T0, [v[0] * sv, 1, v[1] * sv]) }
      meshes.push({ mesh: ped, facade: F.wall, seed: stone, part: 'pediment' })
    }
  }
  return { meshes }
}

// ── Chicago Water Tower (1869): castellated limestone ────────────────────────
function castellated(b, spec) {
  const { c, u, v, L, W } = obOf(b), H = spec.heightM ?? b.height
  const sq = (s) => { const hu = (L * s) / 2, hv = (W * s) / 2; return [add2(add2(c, mul2(u, -hu)), mul2(v, -hv)), add2(add2(c, mul2(u, hu)), mul2(v, -hv)), add2(add2(c, mul2(u, hu)), mul2(v, hv)), add2(add2(c, mul2(u, -hu)), mul2(v, hv))] }
  const pieces = [
    { outer: sq(1), holes: [], base: 0, top: 0.3 * H },
    { outer: sq(0.46), holes: [], base: 0, top: 0.72 * H },
    { outer: sq(0.27), holes: [], base: 0, top: 0.86 * H },
  ]
  const stone = STYLE.wall.limestone, meshes = []
  meshes.push({ mesh: spire({ at: c, base: 0.86 * H, top: H, r0: 0.15 * Math.min(L, W), sides: 8 }), facade: F.wall, seed: stone, part: 'lantern' })
  for (const p of sq(0.9)) {
    const r = 0.07 * Math.min(L, W)
    meshes.push({ mesh: merge(drum({ at: p, base: 0, top: 0.38 * H, r, sides: 8 }), spire({ at: p, base: 0.38 * H, top: 0.46 * H, r0: r * 1.1, sides: 8 })), facade: F.wall, seed: stone, part: 'turret' })
  }
  return { replace: true, pieces, meshes }
}

// ── Jay Pritzker Pavilion: stainless headdress + trellis over the Great Lawn ─
function pavilion(b, spec) {
  const hull = hullOf(b), stage = hull.reduce((s, p) => add2(s, p), [0, 0]).map((x) => x / hull.length)
  const d = bearing(spec.facingBearing ?? 90), side = left(d)
  const ribbons = mesh()
  const bez = (p0, p1, p2, t) => p0.map((_, i) => (1 - t) ** 2 * p0[i] + 2 * (1 - t) * t * p1[i] + t * t * p2[i])
  for (let i = 0; i < 11; i++) {
    const a = -1 + (2 * i) / 10, sg = Math.sign(a) || 1
    const p0 = at3(add2(stage, mul2(side, a * 18)), 9 + 5 * (1 - Math.abs(a)))
    const p2 = at3(add2(add2(stage, mul2(side, a * 30 + sg * 5)), mul2(d, -9 - 5 * Math.abs(a))), 25 + 11 * (1 - a * a))
    const mid = p0.map((x, k) => (x + p2[k]) / 2), p1 = [mid[0] + d[0] * 9, mid[1] + 4, mid[2] + d[1] * 9]
    const width = 5.5, steps = 12
    let prev = null
    for (let k = 0; k <= steps; k++) {
      const t = k / steps, C = bez(p0, p1, p2, t), tw = a * 0.9 * t
      const w = [side[0] * Math.cos(tw) * width / 2, Math.sin(tw) * width / 2, side[1] * Math.cos(tw) * width / 2]
      const L0 = C.map((x, j) => x - w[j]), R0 = C.map((x, j) => x + w[j])
      if (prev) for (const want of [[d[0], 0.3, d[1]], [-d[0], 0.3, -d[1]]]) { tri(ribbons, prev[0], prev[1], R0, want); tri(ribbons, prev[0], R0, L0, want) }
      prev = [L0, R0]
    }
  }
  const lawn = spec.lawn ?? { dist: 95, L: 150, W: 95, h: 21 }
  const lc = add2(stage, mul2(d, lawn.dist)), trellis = mesh()
  const arch = (x) => lawn.h + 2.5 * (1 - (2 * x / lawn.L) ** 2)
  for (let j = 0; j <= 8; j++) {
    const off = -lawn.W / 2 + (lawn.W * j) / 8
    for (let k = 0; k < 16; k++) {
      const x0 = -lawn.L / 2 + (lawn.L * k) / 16, x1 = -lawn.L / 2 + (lawn.L * (k + 1)) / 16
      tube(trellis, at3(add2(add2(lc, mul2(d, x0)), mul2(side, off)), arch(x0)), at3(add2(add2(lc, mul2(d, x1)), mul2(side, off)), arch(x1)), 0.35, 5)
    }
  }
  for (let j = 0; j <= 12; j++) {
    const x = -lawn.L / 2 + (lawn.L * j) / 12
    for (let k = 0; k < 8; k++) {
      const o0 = -lawn.W / 2 + (lawn.W * k) / 8, o1 = -lawn.W / 2 + (lawn.W * (k + 1)) / 8
      tube(trellis, at3(add2(add2(lc, mul2(d, x)), mul2(side, o0)), arch(x)), at3(add2(add2(lc, mul2(d, x)), mul2(side, o1)), arch(x)), 0.3, 5)
    }
  }
  for (const x of [-0.35, 0.05, 0.45]) for (const sv of [-1, 1]) {
    const p = add2(add2(lc, mul2(d, x * lawn.L)), mul2(side, sv * (lawn.W / 2 + 2)))
    tube(trellis, at3(p, 0), at3(p, arch(x * lawn.L)), 1.2, 8)
  }
  return { meshes: [
    { mesh: ribbons, facade: F.chrome, seed: 0.1, part: 'headdress' },
    { mesh: trellis, facade: F.steel, seed: STYLE.steel.white, part: 'trellis' },
  ] }
}

const BUILDERS = { wheel, bean, fountain, theatreSign, museum, castellated, pavilion }
export function buildLandmark(b, spec) {
  const f = BUILDERS[spec.type]
  if (!f) throw new Error(`unknown landmark type: ${spec.type}`)
  return f(b, spec)
}
