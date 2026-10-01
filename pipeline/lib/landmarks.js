// pipeline/lib/landmarks.js — Chicago's civic icons that are not boxes: the Centennial Wheel, Cloud Gate,
// Buckingham Fountain, Pritzker Pavilion, the Chicago Theatre sign, museum domes and porticos, the Water Tower.
// Builders return { meshes: [{ mesh, facade, seed, part }], pieces?, replace? } in world metres.
import { convexHull, box, STYLE } from './venue.js'
import { orientedBox, lathe, DOME, SACRED_STYLE } from './sacred.js'
import { drum, spire, pyramid } from './crowns.js'

import { add2, mul2, left, bearing, sub3, at3, mesh, tri, merge, tube, disc, ringAround, revolve, place, slab, norm3, gridSurface } from './meshkit.js'
import { LANDMARK_FACADES } from './facadeIds.js'
import { CIVIC } from './civic.js'
import { P2_BUILDERS } from './p2landmarks.js'
import { FULTON_BUILDERS } from './fulton.js'
import { swapModel } from './swapModel.js'
export { LANDMARK_FACADES }
const F = LANDMARK_FACADES
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

// ── Cloud Gate (Anish Kapoor, 2006) ──────────────────────────────────────────
// https://en.wikipedia.org/wiki/Cloud_Gate — 10 × 20 × 13 m; the omphalos arch is 12 ft (3.7 m) high and its
// concave apex 27 ft (8.2 m) above the ground; polished type-304 stainless steel.
export const BEAN = { L: 20, W: 13, H: 10, arch: 3.7, omphalos: 8.2 }
export function beanMesh(c, u) {
  const v = left(u), HL = BEAN.L / 2, HW = BEAN.W / 2, S = 64, T = 48
  const top = (s) => BEAN.H * Math.pow(Math.max(0, 1 - s * s), 0.32)
  const mid = (s) => 0.45 * top(s)
  const width = (s) => HW * Math.pow(Math.max(0, 1 - s * s), 0.5)
  const under = (s, q) => {
    const arch = BEAN.arch * Math.max(0, 1 - (s / 0.78) ** 2) * (1 - 0.35 * q * q)
    const d = Math.hypot(s * HL, q * width(s))
    return Math.max(0, Math.min(top(s) - 1.2, arch + (BEAN.omphalos - BEAN.arch) * Math.exp(-((d / 2.6) ** 2))))
  }
  const pt = (i, j) => {
    const s = -1 + (2 * i) / S, t = (j / T) * Math.PI * 2, q = Math.cos(t), st = Math.sin(t)
    const y = st >= 0 ? mid(s) + (top(s) - mid(s)) * Math.pow(st, 0.7) : mid(s) + (under(s, q) - mid(s)) * Math.pow(-st, 0.7)
    const g = add2(add2(c, mul2(u, s * HL)), mul2(v, width(s) * q))
    return [g[0], y, g[1]]
  }
  return gridSurface(pt, S, T, -1, true, { smooth: true })   // −1: ∂s × ∂t points inward here; smooth: a mirror shows facets
}
function bean(b) {
  const { c, u } = obOf(b)
  return {
    replace: true, pieces: [], meshes: [],
    detached: [{ key: 'cloudgate', mesh: beanMesh(c, u), centre: [c[0], c[1]] }],
    clear: [ringAround(c, 42)], // Grainger Plaza: open granite around the sculpture
    runtime: { cloudgate: { centre: [c[0], c[1]], radius: 11 }, plazas: [{ key: 'cloudgate', c: [c[0], c[1]], r: 38, avoid: [{ c: [c[0], c[1]], r: 11 }] }] },
  }
}

// ── Buckingham Fountain (1927) ───────────────────────────────────────────────
// https://en.wikipedia.org/wiki/Buckingham_Fountain — pool 280 ft (85 m); basins 103/60/24 ft (31/18/7.3 m);
// upper lip 25 ft (7.6 m) above the lower basin's water; centre jet 150 ft (46 m); 193 jets; Georgia pink marble;
// four pairs of bronze seahorses (Marcel Loyau) for Illinois, Wisconsin, Michigan and Indiana.
export const FOUNTAIN = {
  poolR: 42.5, poolWater: 0.35, poolRim: 0.6,
  basins: [
    { r: 15.7, base: 0, rim: 1.9, water: 1.6, lobes: 16 },
    { r: 9.15, base: 3.4, rim: 5.1, water: 4.8, lobes: 12 },
    { r: 3.66, base: 7.6, rim: 9.2, water: 8.95, lobes: 8 },
  ],
  crownTop: 10.6,
  seahorses: { ring: 20.5, bearings: [45, 135, 225, 315], gap: 3.2 },
  jets: { centre: 46, seahorse: 6, ring: 3.5, lower: 2.5 },
}
const MARBLE = 'georgia-pink-marble'
export const SEAHORSE_MOUTH = [1.85, 3.15, 0]

// The rearing pose (P3), shared with the Blender unit (pipeline/heroes/scripts/seahorse.py): the fishtail coils on the
// back of the rock, the horse's chest rises forward over it, the neck arches up to the poll and the head reaches
// out to the mouth, which spouts the jet. +X forward, y up, the rock at the origin.
const bez = (a, b, c, d, t) => a.map((_, k) => (1 - t) ** 3 * a[k] + 3 * (1 - t) ** 2 * t * b[k] + 3 * (1 - t) * t * t * c[k] + t ** 3 * d[k])
export const SEAHORSE_POSE = {
  body: (t) => bez([-0.6, 1.2, 0], [0.1, 1.55, 0], [0.75, 2.4, 0], [0.8, 3.5, 0], t), // haunch → chest → poll
  bodyR: (t) => 0.5 * Math.sin(Math.PI * Math.min(1, 0.25 + 0.9 * t)) + 0.16,
  tail: (k) => { const a = k * 0.16; return [-0.6 - 1.25 * Math.sin(Math.min(a, 1.4)) - 0.45 * Math.sin(a), 0.5 * (1 - k / 48) * Math.sin(a * 0.5), 1.2 - 0.32 * (1 - Math.cos(a))] },
  shoulder: 0.62,
}

// The Blender-refined unit (heroes/out/seahorse.glb), pre-loaded by the build; used only when it fits (swapModel).
let seahorseBlender = null
export function setSeahorseMesh(m) { seahorseBlender = m }
const xExtent = (m) => { let lo = Infinity, hi = -Infinity; for (let i = 0; i < m.positions.length; i += 3) { lo = Math.min(lo, m.positions[i]); hi = Math.max(hi, m.positions[i]) } return hi - lo }

// One bronze seahorse rearing from its rock: horse forequarters with webbed forefins, maned arched neck, coiled fishtail.
export function seahorseUnit() {
  const m = mesh(), S = SEAHORSE_POSE
  const spine = Array.from({ length: 15 }, (_, i) => S.body(i / 14))
  for (let i = 0; i < 14; i++) tube(m, spine[i], spine[i + 1], S.bodyR(i / 14), 8)
  tube(m, spine[14], SEAHORSE_MOUTH, 0.3, 8)
  let prev = S.tail(0)
  for (let k = 3; k <= 39; k += 3) { const p = S.tail(k); tube(m, prev, p, 0.3 * (1 - k / 40) + 0.05, 6); prev = p }
  const sh = S.body(S.shoulder)
  for (const z of [-0.4, 0.4]) {
    const knee = [sh[0] + 0.5, sh[1] - 0.35, z * 1.3], hoof = [sh[0] + 0.95, sh[1] - 1.15, z * 1.5]
    tube(m, [sh[0], sh[1] - 0.15, z], knee, 0.16, 6); tube(m, knee, hoof, 0.12, 6)
    slab(m, [hoof[0] + 0.2, hoof[2]], [1, 0], 0.7, 0.08, hoof[1] - 0.05, hoof[1] + 0.4)
  }
  for (let i = 7; i < 14; i++) slab(m, [spine[i][0] - 0.15, 0], [1, 0], 0.3, 0.06, spine[i][1] + 0.1, spine[i][1] + 0.45) // the mane
  const rock = revolve([0, 0], [[1.6, 0], [1.4, 0.7], [0.9, 1.1], [0, 1.2]], { sides: 10, lobes: 5, depth: 0.18 })
  return merge(rock, m)
}

export function seahorseSpots(c) {
  const S = FOUNTAIN.seahorses
  return S.bearings.flatMap((b) => {
    const out = bearing(b), side = left(out), pc = add2(c, mul2(out, S.ring))
    return [-1, 1].map((k) => ({ at: add2(pc, mul2(side, (k * S.gap) / 2)), yawDeg: b }))
  })
}

export function fountainEmitters(c) {
  const Fq = FOUNTAIN, [lo, md, up] = Fq.basins
  const e = [{ kind: 'centre', p: [c[0], Fq.crownTop, c[1]], dir: [0, 1, 0], h: Fq.jets.centre - Fq.crownTop, floor: up.water }]
  for (const s of seahorseSpots(c)) {
    const f = bearing(s.yawDeg)
    e.push({ kind: 'seahorse', p: [s.at[0] + f[0] * SEAHORSE_MOUTH[0], Fq.poolWater - 0.2 + SEAHORSE_MOUTH[1], s.at[1] + f[1] * SEAHORSE_MOUTH[0]], dir: norm3([-f[0] * 0.5, 0.87, -f[1] * 0.5]), h: Fq.jets.seahorse, floor: Fq.poolWater })
  }
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2, r = up.r - 0.3; e.push({ kind: 'ring', p: [c[0] + Math.cos(a) * r, up.rim, c[1] + Math.sin(a) * r], dir: norm3([Math.cos(a) * 0.25, 1, Math.sin(a) * 0.25]), h: Fq.jets.ring, floor: md.water }) }
  for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2, r = lo.r - 0.6; e.push({ kind: 'lower', p: [c[0] + Math.cos(a) * r, lo.rim, c[1] + Math.sin(a) * r], dir: norm3([Math.cos(a) * 0.35, 1, Math.sin(a) * 0.35]), h: Fq.jets.lower, floor: Fq.poolWater }) }
  return e
}

function fountain(b) {
  const c = b.centroid, Fq = FOUNTAIN, meshes = []
  const push = (m, facade, style, part) => meshes.push({ mesh: m, facade, seed: 0.5, style, part })
  push(revolve(c, [[Fq.poolR + 0.6, 0], [Fq.poolR + 0.6, Fq.poolRim], [Fq.poolR, Fq.poolRim], [Fq.poolR, Fq.poolWater]], { sides: 96 }), F.stone, MARBLE, 'rim')
  push(revolve(c, [[Fq.poolR, Fq.poolWater], [0, Fq.poolWater]], { sides: 96 }), F.water, null, 'pool')
  for (const bs of Fq.basins) {
    const prof = [[bs.r * 0.3, bs.base], [bs.r * 0.92, bs.rim - 0.9], [bs.r, bs.rim], [bs.r - 0.4, bs.rim], [bs.r - 0.4, bs.water]]
    push(revolve(c, prof, { sides: 64, lobes: bs.lobes, depth: 0.05 }), F.stone, MARBLE, 'basin')
    push(revolve(c, [[bs.r - 0.4, bs.water], [0, bs.water]], { sides: 64, lobes: bs.lobes, depth: 0.05 }), F.water, null, 'basin-water')
  }
  push(revolve(c, [[2.4, Fq.basins[0].water], [1.6, 2.3], [1.4, Fq.basins[1].base]], { sides: 24 }), F.stone, MARBLE, 'pedestal')
  push(revolve(c, [[1.3, Fq.basins[1].water], [0.8, 5.6], [0.7, Fq.basins[2].base]], { sides: 24 }), F.stone, MARBLE, 'pedestal')
  push(revolve(c, [[0.9, Fq.basins[2].water], [0.5, 9.6], [0.7, 10.1], [0.25, Fq.crownTop], [0, Fq.crownTop]], { sides: 16 }), F.stone, MARBLE, 'crown')
  const proc = seahorseUnit()
  const unit = swapModel({ mesh: proc, lengthM: xExtent(proc) }, seahorseBlender, { minTris: 500, maxTris: 6000 }).mesh
  for (const s of seahorseSpots(c)) push(place(unit, { at: s.at, y: Fq.poolWater - 0.2, yawDeg: s.yawDeg }), F.bronze, 'seahorse-bronze', 'seahorse')
  return {
    replace: true, pieces: [], meshes, clear: [ringAround(c, 58)],
    runtime: { fountain: { centre: [c[0], c[1]], emitters: fountainEmitters(c) }, plazas: [{ key: 'buckingham', c: [c[0], c[1]], r: 62, avoid: [{ c: [c[0], c[1]], r: Fq.poolR + 1.2 }] }] },
  }
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
  const lawnRing = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, s2]) => add2(add2(lc, mul2(d, (a * lawn.L) / 2)), mul2(side, (s2 * lawn.W) / 2)))
  return { clear: [lawnRing], meshes: [
    { mesh: ribbons, facade: F.chrome, seed: 0.1, part: 'headdress' },
    { mesh: trellis, facade: F.steel, seed: STYLE.steel.white, part: 'trellis' },
  ] }
}

const BUILDERS = { wheel, bean, fountain, theatreSign, museum, castellated, pavilion, ...CIVIC, ...P2_BUILDERS, ...FULTON_BUILDERS }
export function buildLandmark(b, spec) {
  const f = BUILDERS[spec.type]
  if (!f) throw new Error(`unknown landmark type: ${spec.type}`)
  return f(b, spec)
}
