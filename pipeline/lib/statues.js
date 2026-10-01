// pipeline/lib/statues.js — figures on plinths (Phase 3): CBOT's Ceres, the Lincoln Park statues, the fountain's
// seahorse unit. A Blender export is used when present (heroes/out/*.glb); otherwise a low-poly procedural stand-in
// that reads correctly as a silhouette from 80 m. Either way the figure stands exactly heightM tall on `base`.
import { fileURLToPath } from 'node:url'
import { mesh, tri, tube, merge, bearing, revolve } from './meshkit.js'
import { lathe } from './sacred.js'
import { loadBlenderMesh } from './blenderMesh.js'

// A closed box plinth: w × w, from base to base + h.
export function plinth({ at, base, w, h, d = w }) {
  const out = mesh(), c = [at[0], base + h / 2, at[1]]
  const X = [at[0] - w / 2, at[0] + w / 2], Z = [at[1] - d / 2, at[1] + d / 2], Y = [base, base + h]
  const v = (i, j, k) => [X[i], Y[j], Z[k]]
  const faces = [[v(0, 0, 0), v(1, 0, 0), v(1, 1, 0), v(0, 1, 0)], [v(1, 0, 1), v(0, 0, 1), v(0, 1, 1), v(1, 1, 1)], [v(0, 0, 1), v(0, 0, 0), v(0, 1, 0), v(0, 1, 1)],
    [v(1, 0, 0), v(1, 0, 1), v(1, 1, 1), v(1, 1, 0)], [v(0, 1, 0), v(1, 1, 0), v(1, 1, 1), v(0, 1, 1)], [v(0, 0, 0), v(0, 0, 1), v(1, 0, 1), v(1, 0, 0)]]
  for (const [a, b, e, f] of faces) {
    const m = [(a[0] + e[0]) / 2 - c[0], (a[1] + e[1]) / 2 - c[1], (a[2] + e[2]) / 2 - c[2]]
    tri(out, a, b, e, m); tri(out, a, e, f, m)
  }
  return out
}

// Standing figure, as [radius, height] fractions of the figure's height: hem, robe, waist, shoulders, neck, head.
const FIGURE = [[0.15, 0], [0.16, 0.04], [0.13, 0.4], [0.11, 0.58], [0.14, 0.74], [0.12, 0.8], [0.05, 0.84], [0.065, 0.89], [0.06, 0.95], [0, 1]]
const RIDER = [[0.1, 0], [0.12, 0.3], [0.11, 0.55], [0.05, 0.68], [0.07, 0.8], [0.0, 1]]

function figure(at, base, H, sides = 14) { return lathe(at, base, H, FIGURE, sides) }

// Local (x across, y up, z forward along the bearing) → world, about `at`.
const frame = (at, deg) => { const f = bearing(deg), r = [-f[1], f[0]]; return (x, y, z) => [at[0] + r[0] * x + f[0] * z, y, at[1] + r[1] * x + f[1] * z] }

const BUILD = {
  // Ceres: a faceless robed figure; the wheat sheaf held up in her left hand, a sickle arm down on the right
  ceres(at, base, H, deg) {
    const P = frame(at, deg), out = figure(at, base, H)
    tube(out, P(0.13 * H, base + 0.72 * H, 0), P(0.2 * H, base + 0.55 * H, 0.05 * H), 0.03 * H, 6)
    tube(out, P(-0.13 * H, base + 0.72 * H, 0), P(-0.19 * H, base + 0.84 * H, 0.04 * H), 0.03 * H, 6)
    const sheaf = P(-0.19 * H, 0, 0.04 * H)
    return merge(out, lathe([sheaf[0], sheaf[2]], base + 0.8 * H, 0.18 * H, [[0.12, 0], [0.3, 0.5], [0.2, 0.85], [0, 1.0]], 8))
  },
  // Standing Lincoln: the figure risen from the chair behind him
  lincoln(at, base, H, deg) {
    const P = frame(at, deg), out = figure(at, base, H)
    const c = P(0, 0, -0.3 * H), seat = mesh()
    for (const [x, z] of [[-0.18, -0.2], [0.18, -0.2], [-0.18, -0.4], [0.18, -0.4]]) tube(seat, P(x * H, base, z * H), P(x * H, base + 0.28 * H, z * H), 0.02 * H, 4)
    tube(seat, [c[0], base + 0.3 * H, c[2]], [c[0], base + 0.62 * H, c[2]], 0.14 * H, 4)
    return merge(out, seat)
  },
  // Goethe: a tall cloaked figure (the cloak widens the silhouette), an eagle at his side
  goethe(at, base, H, deg) {
    const P = frame(at, deg), out = lathe(at, base, H, [[0.2, 0], [0.2, 0.05], [0.17, 0.4], [0.13, 0.6], [0.16, 0.76], [0.12, 0.81], [0.05, 0.85], [0.065, 0.9], [0.06, 0.95], [0, 1]], 14)
    const e = P(0.3 * H, 0, 0.05 * H)
    return merge(out, lathe([e[0], e[2]], base, 0.22 * H, [[0.2, 0], [0.35, 0.45], [0.22, 0.8], [0, 1]], 8))
  },
  // Grant: a horse (body, four legs, neck and head, tail) under a mounted figure
  grant(at, base, H, deg) {
    const P = frame(at, deg), out = mesh(), L = 0.55 * H, legH = 0.3 * H
    for (const [x, z] of [[-0.07, 0.2], [0.07, 0.2], [-0.07, -0.2], [0.07, -0.2]]) tube(out, P(x * H, base, z * H), P(x * H, base + legH + 0.02 * H, z * H), 0.028 * H, 5)
    tube(out, P(0, base + 0.41 * H, -L / 2), P(0, base + 0.41 * H, L / 2), 0.1 * H, 8)
    tube(out, P(0, base + 0.44 * H, L / 2 - 0.02 * H), P(0, base + 0.66 * H, L / 2 + 0.1 * H), 0.05 * H, 6)
    tube(out, P(0, base + 0.66 * H, L / 2 + 0.08 * H), P(0, base + 0.6 * H, L / 2 + 0.24 * H), 0.04 * H, 6)
    tube(out, P(0, base + 0.43 * H, -L / 2), P(0, base + 0.2 * H, -L / 2 - 0.08 * H), 0.02 * H, 4)
    const seat = P(0, 0, -0.02 * H)
    return merge(out, lathe([seat[0], seat[2]], base + 0.5 * H, 0.5 * H, RIDER, 10))
  },
  // Seahorse: a curled tail rising into the body, a crested head with a snout
  seahorse(at, base, H, deg) {
    const P = frame(at, deg), out = mesh(), pts = []
    for (let k = 0; k <= 14; k++) {
      const t = k / 14, a = t * Math.PI * 1.6
      pts.push(P(0, base + H * (0.05 + 0.75 * t), H * 0.18 * Math.sin(a) * (1 - 0.5 * t)))
    }
    for (let k = 0; k < pts.length - 1; k++) tube(out, pts[k], pts[k + 1], H * (0.05 + 0.07 * (k / pts.length)), 6)
    tube(out, P(0, base, 0.1 * H), pts[0], 0.05 * H, 6)
    const top = pts[pts.length - 1]
    tube(out, top, P(0, base + H * 0.93, 0.02 * H), 0.1 * H, 6)
    tube(out, P(0, base + H * 0.88, 0.05 * H), P(0, base + H * 0.8, 0.26 * H), 0.035 * H, 5)
    tube(out, P(0, base + H * 0.9, -0.02 * H), P(0, base + H, -0.05 * H), 0.03 * H, 4)
    return out
  },
}

// Lincoln Park pass (B-6): stand-ins for the monuments whose Blender exports are heroes/out/statue_<kind>.glb
for (const k of ['schiller', 'hamilton', 'franklin', 'altgeld', 'andersen']) BUILD[k] = BUILD.lincoln
BUILD.signal = BUILD.grant

// The figure scaled so it spans exactly base..base + heightM (a stand-in's parts may fall short of the top).
function fit(m, base, heightM, at) {
  let lo = Infinity, hi = -Infinity
  for (let i = 1; i < m.positions.length; i += 3) { lo = Math.min(lo, m.positions[i]); hi = Math.max(hi, m.positions[i]) }
  const k = heightM / ((hi - lo) || 1)
  for (let i = 0; i < m.positions.length; i += 3) {
    m.positions[i] = at[0] + (m.positions[i] - at[0]) * k
    m.positions[i + 1] = base + (m.positions[i + 1] - lo) * k
    m.positions[i + 2] = at[1] + (m.positions[i + 2] - at[1]) * k
  }
  return m
}

export function statueFallback(kind, { at, base, heightM, bearingDeg = 0 }) {
  const build = BUILD[kind]
  if (!build) throw new Error(`no statue stand-in for "${kind}"`)
  return fit(build(at, base, heightM, bearingDeg), base, heightM, at)
}

const warned = new Set()
export async function statueMesh(spec, { at, base, bearingDeg = spec.bearingDeg ?? 0 }) {
  const path = fileURLToPath(new URL(`../${spec.file}`, import.meta.url))
  const m = spec.file ? await loadBlenderMesh(path, { at, baseY: base, rotationDeg: bearingDeg, maxTris: spec.maxTris ?? 12000 }) : null
  if (m) return { mesh: fit(m, base, spec.heightM, at), source: 'blender' }
  if (!warned.has(spec.kind)) { warned.add(spec.kind); console.log(`statue ${spec.kind}: fallback`) }
  return { mesh: statueFallback(spec.kind, { at, base, heightM: spec.heightM, bearingDeg }), source: 'fallback' }
}

// Build-time path: the Blender export is read once before the tile loop (preloadStatue, async); placing it is then
// synchronous, so the hero and landmark builders stay synchronous.
export async function preloadStatue(spec) {
  if (!spec.file) return null
  return loadBlenderMesh(fileURLToPath(new URL(`../${spec.file}`, import.meta.url)), { at: [0, 0], baseY: 0, maxTris: spec.maxTris ?? 12000 })
}
export function placeStatue(spec, { at, base, bearingDeg = spec.bearingDeg ?? 0 }, preloaded = null) {
  if (preloaded) {
    const r = (bearingDeg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r), p = preloaded.positions, n = preloaded.normals
    const m = { positions: new Array(p.length), normals: new Array(n.length), uvs: preloaded.uvs.slice() }
    for (let i = 0; i < p.length; i += 3) {
      m.positions[i] = at[0] + p[i] * c - p[i + 2] * s; m.positions[i + 1] = base + p[i + 1]; m.positions[i + 2] = at[1] + p[i] * s + p[i + 2] * c
      m.normals[i] = n[i] * c - n[i + 2] * s; m.normals[i + 1] = n[i + 1]; m.normals[i + 2] = n[i] * s + n[i + 2] * c
    }
    return { mesh: fit(m, base, spec.heightM, at), source: 'blender' }
  }
  if (!warned.has(spec.kind)) { warned.add(spec.kind); console.log(`statue ${spec.kind}: fallback`) }
  return { mesh: statueFallback(spec.kind, { at, base, heightM: spec.heightM, bearingDeg }), source: 'fallback' }
}

// ── Lincoln Park monument bases and furniture (B-6) ──────────────────────────────────────────────────────────────────
// A stepped granite base: tiers [[w, d, h], …] from the ground up, each centred, turned to `bearingDeg`; an optional
// arch (spanM wide, its crown riseM up) cut through the lowest tier front to back as a dark opening (the Grant
// Memorial's arched terrace). Returns { stone, shadow, top }.
// a turned shape: radii in metres, heights as fractions of h above y0
const L = (at, y0, h, prof, sides = 12) => revolve(at, prof.map(([rr, g]) => [Math.max(0.001, rr), y0 + g * h]), { sides })
const rot = (deg) => { const f = bearing(deg); return { f, r: [-f[1], f[0]] } }
export function steppedBase({ at, bearingDeg = 0, tiers, arch = null }) {
  const { f, r } = rot(bearingDeg), stone = mesh(), shadow = mesh()
  let y = 0
  for (const [w, d, h] of tiers) {
    const q = (a, b, yy) => [at[0] + r[0] * a + f[0] * b, yy, at[1] + r[1] * a + f[1] * b]
    const box = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]]
    for (let i = 0; i < 4; i++) {
      const [a0, b0] = box[i], [a1, b1] = box[(i + 1) % 4], n = [r[0] * (a0 + a1) / 2 + f[0] * (b0 + b1) / 2, 0, r[1] * (a0 + a1) / 2 + f[1] * (b0 + b1) / 2]
      tri(stone, q(a0, b0, y), q(a1, b1, y), q(a1, b1, y + h), n); tri(stone, q(a0, b0, y), q(a1, b1, y + h), q(a0, b0, y + h), n)
    }
    tri(stone, q(-w / 2, -d / 2, y + h), q(w / 2, -d / 2, y + h), q(w / 2, d / 2, y + h), [0, 1, 0]); tri(stone, q(-w / 2, -d / 2, y + h), q(w / 2, d / 2, y + h), q(-w / 2, d / 2, y + h), [0, 1, 0])
    y += h
  }
  if (arch) {
    const [w0, d0] = tiers[0], hs = arch.spanM / 2, spring = arch.riseM - hs, n = 12
    for (const side of [-1, 1]) {
      const q = (a, yy) => [at[0] + r[0] * a + f[0] * side * (d0 / 2 + 0.03), yy, at[1] + r[1] * a + f[1] * side * (d0 / 2 + 0.03)]
      const pts = [[-hs, 0], [hs, 0]]
      for (let k = 0; k <= n; k++) { const a = (k / n) * Math.PI; pts.push([hs * Math.cos(a), spring + hs * Math.sin(a)]) }
      const c = [0, spring * 0.6]
      for (let i = 0; i < pts.length; i++) { const A = pts[i], B = pts[(i + 1) % pts.length]; tri(shadow, q(...c), q(...A), q(...B), [f[0] * side, 0, f[1] * side]) }
    }
  }
  return { stone, shadow, top: y }
}

// The Stanford White exedra behind the Standing Lincoln: a granite bench curving round the statue's back, `lengthM`
// along its arc, a seat and a high back, with a block at each end.
export function exedra({ at, bearingDeg = 0, radiusM = 9, lengthM = 18.3 }) {
  const { f } = rot(bearingDeg), back = [-f[0], -f[1]], out = mesh()
  const span = lengthM / radiusM, a0 = Math.atan2(back[1], back[0]) - span / 2, n = 24
  const ring = (r, y0, y1, k) => {
    const a = a0 + (span * k) / n, b = a0 + (span * (k + 1)) / n
    const P = (ang, rr, y) => [at[0] + rr * Math.cos(ang), y, at[1] + rr * Math.sin(ang)]
    return { P, a, b }
  }
  for (let k = 0; k < n; k++) {
    const { P, a, b } = ring(0, 0, 0, k)
    const seg = (r0, r1, y0, y1) => {
      const o = [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)]
      tri(out, P(a, r1, y0), P(b, r1, y0), P(b, r1, y1), o); tri(out, P(a, r1, y0), P(b, r1, y1), P(a, r1, y1), o)
      tri(out, P(a, r0, y0), P(b, r0, y1), P(b, r0, y0), o.map((x) => -x)); tri(out, P(a, r0, y0), P(a, r0, y1), P(b, r0, y1), o.map((x) => -x))
      tri(out, P(a, r0, y1), P(b, r0, y1), P(b, r1, y1), [0, 1, 0]); tri(out, P(a, r0, y1), P(b, r1, y1), P(a, r1, y1), [0, 1, 0])
    }
    seg(radiusM - 0.9, radiusM, 0, 0.48) // the seat
    seg(radiusM, radiusM + 0.45, 0, 1.5) // the back
  }
  for (const e of [a0 - 0.06, a0 + span + 0.06]) {
    const c = [at[0] + (radiusM - 0.2) * Math.cos(e), at[1] + (radiusM - 0.2) * Math.sin(e)]
    const m = L(c, 0, 1.9, [[0.85, 0], [0.85, 0.8], [0.7, 0.85], [0.7, 1]], 4)
    for (const k of ['positions', 'normals', 'uvs']) out[k].push(...m[k])
  }
  return out
}

// Kwanusila, the Thunderbird totem pole at Addison (Tony Hunt, 1986, after the 1929 original): 40 ft of carved red
// cedar — the sea monster at its foot, the man riding the whale, Kwanusila at the top with his wings spread — painted
// in black, red and blue-green. Returns meshes by colour; the carving is suggested by turned figures.
export function totemPole({ at, bearingDeg = 0, heightM = 12.2 }) {
  const { f, r } = rot(bearingDeg), H = heightM, cedar = mesh(), black = mesh(), red = mesh(), teal = mesh(), white = mesh()
  const add = (dst, m) => { for (const k of ['positions', 'normals', 'uvs']) dst[k].push(...m[k]) }
  add(cedar, L(at, 0, H * 0.84, [[0.42, 0], [0.4, 0.3], [0.37, 0.7], [0.33, 1.0]], 12))
  // three figures: each a bulge of the pole with a face — brows and eyes (black), mouth (red), cheeks (teal)
  const face = (y, s) => {
    const c = (a, b, yy) => [at[0] + r[0] * a + f[0] * b, yy, at[1] + r[1] * a + f[1] * b]
    add(cedar, L(at, y - 0.9 * s, 1.8 * s, [[0.42, 0], [0.5, 0.3], [0.48, 0.75], [0.4, 1]], 12))
    for (const sx of [-1, 1]) {
      // the brow (black), the eye (black in a teal socket), a red nostril line — Northwest Coast formline, oversized to read
      add(black, L([c(0.2 * sx, 0.46 * s, 0)[0], c(0.2 * sx, 0.46 * s, 0)[2]], y + 0.32 * s, 0.12 * s, [[0.22 * s, 0], [0.24 * s, 0.5], [0.001, 1]], 8))
      add(teal, L([c(0.2 * sx, 0.47 * s, 0)[0], c(0.2 * sx, 0.47 * s, 0)[2]], y + 0.02 * s, 0.26 * s, [[0.17 * s, 0], [0.19 * s, 0.5], [0.001, 1]], 8))
      add(black, L([c(0.2 * sx, 0.52 * s, 0)[0], c(0.2 * sx, 0.52 * s, 0)[2]], y + 0.08 * s, 0.14 * s, [[0.09 * s, 0], [0.1 * s, 0.5], [0.001, 1]], 8))
      add(red, L([c(0.36 * sx, 0.36 * s, 0)[0], c(0.36 * sx, 0.36 * s, 0)[2]], y - 0.3 * s, 0.3 * s, [[0.1 * s, 0], [0.12 * s, 0.5], [0.001, 1]], 6))
    }
    add(red, L([c(0, 0.5 * s, 0)[0], c(0, 0.5 * s, 0)[2]], y - 0.62 * s, 0.22 * s, [[0.3 * s, 0], [0.32 * s, 0.5], [0.001, 1]], 10)) // the mouth
    add(black, L(at, y - 0.92 * s, 0.14 * s, [[0.45, 0], [0.47, 0.5], [0.45, 1]], 12)) // a black band below each figure
  }
  face(H * 0.13, 1.1) // the sea monster
  face(H * 0.42, 0.9) // the man riding the whale
  tube(black, [at[0] + f[0] * 0.5, H * 0.33, at[1] + f[1] * 0.5], [at[0] + f[0] * 0.75, H * 0.36, at[1] + f[1] * 0.75], 0.14, 6) // the whale's fin
  face(H * 0.72, 1.0) // Kwanusila
  // Kwanusila's beak and his spread wings at the top
  tube(black, [at[0], H * 0.8, at[1]], [at[0] + f[0] * 0.95, H * 0.77, at[1] + f[1] * 0.95], 0.13, 6)
  for (const sx of [-1, 1]) {
    const w = (a, y) => [at[0] + r[0] * a + f[0] * 0.1, y, at[1] + r[1] * a + f[1] * 0.1]
    tri(teal, w(0.3 * sx, H * 0.78), w(2.1 * sx, H * 0.95), w(2.0 * sx, H * 0.83), [f[0], 0, f[1]]); tri(teal, w(0.3 * sx, H * 0.78), w(2.0 * sx, H * 0.83), w(2.1 * sx, H * 0.95), [-f[0], 0, -f[1]])
    tri(white, w(0.3 * sx, H * 0.78), w(2.0 * sx, H * 0.83), w(1.2 * sx, H * 0.74), [f[0], 0, f[1]]); tri(white, w(0.3 * sx, H * 0.78), w(1.2 * sx, H * 0.74), w(2.0 * sx, H * 0.83), [-f[0], 0, -f[1]])
  }
  add(black, L(at, H * 0.84, H * 0.16, [[0.36, 0], [0.42, 0.4], [0.3, 0.8], [0.12, 1]], 10)) // the head and crest
  return { cedar, black, red, teal, white }
}
