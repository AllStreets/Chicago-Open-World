// pipeline/lib/icons.js — close-range detail for two of the river's icons (user request: "go all out"), added to their
// procedural massing (heroes.js) and crowns (crowns.js):
//   Tribune Tower (Hood & Howells, 1925; Indiana limestone, 141 m): vertical pier ribs up the shaft, the pointed Gothic
//     entrance arch on Michigan Avenue, lancet tracery on the octagonal lantern and a ring of pinnacles atop it.
//   Wrigley Building (Graham, Anderson, Probst & White, 1921–24; white glazed terra cotta): the clock tower after
//     Seville's Giralda — a clock stage with four ~6 m (19.7 ft) faces, an arcaded belfry, two octagonal tiers, a
//     cupola and a finial — and the skybridges across the plaza to the north addition.
// Sources in heroes.json (tribune, wrigleybldg).
import { orientedBox } from './sacred.js'
import { lathe, DOME } from './sacred.js'
import { drum, spire } from './crowns.js'
import { ringCentroid, pointInRing } from './geom.js'
import { add2, sub2, mul2, dot2, norm2, left, bearing, mesh, tri, quad, merge, slab } from './meshkit.js'
import { LANDMARK_FACADES as F } from './facadeIds.js'

const P = (m, facade, style, part, seed = 0.5) => ({ mesh: m, facade, seed, style, part })
const Y = (p, y) => [p[0], y, p[1]]

// A shape drawn on a wall: 2D points (s along the wall, y up) at `origin`, pushed `proud` metres out along `dir`.
export function wallPolygon(out, origin, along, dir, pts, proud) {
  const P3 = ([s, y]) => Y(add2(add2(origin, mul2(along, s)), mul2(dir, proud)), y)
  const c = pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0])
  for (let i = 0; i < pts.length; i++) tri(out, P3(c), P3(pts[i]), P3(pts[(i + 1) % pts.length]), [dir[0], 0, dir[1]])
}
// A band following a 2D curve (inner and outer edges), standing `depth` proud of the wall: front, inner and outer faces.
function wallBand(out, origin, along, dir, inner, outer, depth) {
  const P3 = ([s, y], d) => Y(add2(add2(origin, mul2(along, s)), mul2(dir, d)), y)
  for (let i = 0; i + 1 < inner.length; i++) {
    quad(out, P3(inner[i], depth), P3(inner[i + 1], depth), P3(outer[i + 1], depth), P3(outer[i], depth), [dir[0], 0, dir[1]])
    const sideN = (a, b, sign) => { const t = sub2(b, a), n = norm2([-t[1] * sign, t[0] * sign]); return [along[0] * n[0] + dir[0] * 0, n[1], along[1] * n[0]] }
    quad(out, P3(inner[i], 0), P3(inner[i + 1], 0), P3(inner[i + 1], depth), P3(inner[i], depth), sideN(inner[i], inner[i + 1], -1))
    quad(out, P3(outer[i], 0), P3(outer[i + 1], 0), P3(outer[i + 1], depth), P3(outer[i], depth), sideN(outer[i], outer[i + 1], 1))
  }
}
// An equilateral pointed (Gothic) arch of span 2·halfSpan springing at `spring`: each side is an arc centred on the
// opposite springing point; the inner edge has radius = span, the outer `ring` more, both meeting on the centre line.
export function pointedArch(halfSpan, spring, ring, n = 10) {
  const edge = (r) => {
    const amax = Math.acos(halfSpan / r), pts = []
    for (let k = 0; k <= n; k++) { const a = (k / n) * amax; pts.push([halfSpan - r * Math.cos(a), spring + r * Math.sin(a)]) } // left side, up to the apex
    for (let k = n - 1; k >= 0; k--) { const a = (k / n) * amax; pts.push([-halfSpan + r * Math.cos(a), spring + r * Math.sin(a)]) } // right side, back down
    return pts
  }
  return { inner: edge(2 * halfSpan), outer: edge(2 * halfSpan + ring) }
}

export function tribuneDetail({ tower, towerBase, towerTop, crownTop, entranceFace, base, rLantern = 7.5 }) {
  const ob = orientedBox(tower), c = ringCentroid(tower), meshes = []
  // vertical pier ribs on all four faces, ~3 m apart, 0.6 m proud
  const piers = mesh()
  for (const [u, half, span] of [[ob.u, ob.W / 2, ob.L], [left(ob.u), ob.L / 2, ob.W]]) {
    const v = left(u)
    for (const side of [-1, 1]) for (let s = -span / 2 + 1.5; s <= span / 2 - 1.5 + 1e-6; s += 3) {
      slab(piers, add2(add2(c, mul2(u, s)), mul2(v, side * (half + 0.3))), u, 0.8, 0.6, towerBase, towerTop)
    }
  }
  meshes.push(P(piers, F.stone, 'tribune-limestone', 'piers'))
  // the entrance: a pointed arch three storeys tall on the base's Michigan Avenue face, a dark tracery screen within
  const dir = norm2(entranceFace), along = left(dir)
  const reach = Math.max(...base.map((p) => (p[0] - c[0]) * dir[0] + (p[1] - c[1]) * dir[1]))
  const face = add2(c, mul2(dir, reach))
  const arch = pointedArch(4, 7.5, 1.3)
  const ent = mesh()
  wallBand(ent, face, along, dir, arch.inner, arch.outer, 1.2)
  for (const s of [-1, 1]) slab(ent, add2(face, add2(mul2(along, s * 4.65), mul2(dir, 0.6))), along, 1.3, 1.2, 0, 7.5)
  meshes.push(P(ent, F.stone, 'tribune-limestone', 'entrance'))
  const screen = mesh()
  wallPolygon(screen, face, along, dir, [[4, 0], [-4, 0], ...arch.inner], 0.15)
  meshes.push(P(screen, F.paint, 'gothic-shadow', 'entrance-screen'))
  // lancet tracery: two tall pointed slits on each of the lantern's eight faces
  const lanTop = crownTop - 4, tracery = mesh()
  for (let k = 0; k < 8; k++) {
    const a = ((k + 0.5) / 8) * Math.PI * 2, d = [Math.cos(a), Math.sin(a)], apo = rLantern * Math.cos(Math.PI / 8)
    const fc = add2(c, mul2(d, apo)), al = left(d)
    for (const s of [-1.1, 1.1]) wallPolygon(tracery, add2(fc, mul2(al, s)), al, d, [[-0.45, towerTop + 4], [0.45, towerTop + 4], [0.45, lanTop - 3], [0, lanTop - 1.8], [-0.45, lanTop - 3]], 0.08)
  }
  meshes.push(P(tracery, F.paint, 'gothic-shadow', 'tracery'))
  // a ring of slim pinnacles around the lantern's top
  const pins = mesh()
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2, at = add2(c, mul2([Math.cos(a), Math.sin(a)], rLantern * 0.92))
    const s = spire({ at, base: lanTop, top: Math.min(crownTop, lanTop + 3.6), r0: 0.35, sides: 6 })
    pins.positions.push(...s.positions); pins.normals.push(...s.normals); pins.uvs.push(...s.uvs)
  }
  meshes.push(P(pins, F.stone, 'tribune-limestone', 'pinnacles'))
  return meshes
}

export function wrigleyClockTower({ at, side, base, top, bearingDeg = 0 }) {
  const H = top - base, f = bearing(bearingDeg), meshes = []
  const y1 = base + 0.27 * H, y2 = base + 0.48 * H, y3 = base + 0.64 * H, y4 = base + 0.76 * H
  meshes.push(P(slab(mesh(), at, f, side, side, base, y1), F.stone, 'wrigley-terracotta', 'stage'))
  // four clock faces, 19.7 ft (6 m) across, centred on the stage, with their hands
  const cy = (base + y1) / 2, hands = mesh()
  for (const d of [f, left(f), mul2(f, -1), mul2(left(f), -1)]) {
    const al = left(d), o = add2(at, mul2(d, side / 2)), face = mesh(), pts = []
    for (let k = 0; k < 32; k++) { const a = (k / 32) * Math.PI * 2; pts.push([3.0 * Math.cos(a), cy + 3.0 * Math.sin(a)]) }
    wallPolygon(face, o, al, d, pts, 0.12)
    meshes.push(P(face, F.signal, 'wrigley-clock', 'clock'))
    // the dark bezel and the twelve hour marks that make the face read against the white terra cotta
    for (let k = 0; k < 40; k++) {
      const a0 = (k / 40) * Math.PI * 2, a1 = ((k + 1) / 40) * Math.PI * 2, r0 = 3.0, r1 = 3.35
      wallPolygon(hands, o, al, d, [[r0 * Math.cos(a0), cy + r0 * Math.sin(a0)], [r1 * Math.cos(a0), cy + r1 * Math.sin(a0)], [r1 * Math.cos(a1), cy + r1 * Math.sin(a1)], [r0 * Math.cos(a1), cy + r0 * Math.sin(a1)]], 0.14)
    }
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2, c0 = Math.cos(a), s0 = Math.sin(a), t = [-s0 * 0.11, c0 * 0.11]
      wallPolygon(hands, o, al, d, [[2.3 * c0 + t[0], cy + 2.3 * s0 + t[1]], [2.8 * c0 + t[0], cy + 2.8 * s0 + t[1]], [2.8 * c0 - t[0], cy + 2.8 * s0 - t[1]], [2.3 * c0 - t[0], cy + 2.3 * s0 - t[1]]], 0.16)
    }
    wallPolygon(hands, o, al, d, [[-0.12, cy], [0.12, cy], [0.12, cy + 2.4], [-0.12, cy + 2.4]], 0.2) // minute hand at twelve
    wallPolygon(hands, o, al, d, [[0, cy - 0.12], [1.6, cy - 0.12], [1.6, cy + 0.12], [0, cy + 0.12]], 0.22) // hour hand at three
  }
  meshes.push(P(hands, F.paint, 'clock-hands', 'hands'))
  // the belfry: an arcade of three round-headed openings on each face
  const bw = side * 0.82
  meshes.push(P(slab(mesh(), at, f, bw, bw, y1, y2), F.stone, 'wrigley-terracotta', 'belfry'))
  const arches = mesh()
  for (const d of [f, left(f), mul2(f, -1), mul2(left(f), -1)]) {
    const al = left(d), o = add2(at, mul2(d, bw / 2))
    for (const s of [-bw / 3, 0, bw / 3]) {
      const pts = [[s - 1.1, y1 + 1.2], [s + 1.1, y1 + 1.2]]
      for (let k = 0; k <= 8; k++) { const a = (k / 8) * Math.PI; pts.push([s + 1.1 * Math.cos(a), y2 - 2.4 + 1.1 * Math.sin(a)]) }
      wallPolygon(arches, o, al, d, pts, 0.06)
    }
  }
  meshes.push(P(arches, F.paint, 'gothic-shadow', 'belfry-arches'))
  // two octagonal tiers, the cupola and the finial
  meshes.push(P(merge(drum({ at, base: y2, top: y3, r: side * 0.42, sides: 8 }), drum({ at, base: y3, top: y4, r: side * 0.3, sides: 8 })), F.stone, 'wrigley-terracotta', 'octagon'))
  const rc = side * 0.22, domeTop = y4 + rc
  meshes.push(P(lathe(at, y4, rc, DOME, 16), F.stone, 'wrigley-terracotta', 'cupola'))
  meshes.push(P(spire({ at, base: domeTop - 0.2, top, r0: 0.55, sides: 8 }), F.paint, 'gate-gold', 'finial'))
  return meshes
}

export function skybridge({ from, to, width, y0, y1 }) {
  const d = sub2(to, from), L = Math.hypot(...d)
  return slab(mesh(), mul2(add2(from, to), 0.5), norm2(d), L, width, y0, y1)
}

// Willis Tower (SOM, 1974): nine bundled 75 ft (23 m) tubes. The black aluminium skin reads by its deep vertical mullion
// fins, broken by the louvred mechanical belts, and the Skydeck Ledge's four glass boxes jut 4.3 ft (1.3 m) from the
// 103rd floor's west face. Each tube's walls carry fins only where they are open air, above any neighbour's roof.
// Sources in heroes.json (willis).
export function willisDetail({ pieces, belts = [], ledge = null, finGap = 4.6 }) {
  const fins = mesh(), bands = mesh(), boxes = mesh()
  const edges = []
  for (const p of pieces) {
    const r = p.outer
    for (let i = 0; i < r.length; i++) {
      const a = r[i], b = r[(i + 1) % r.length], e = sub2(b, a), len = Math.hypot(...e)
      if (len < 1) continue
      const t = mul2(e, 1 / len), mid = mul2(add2(a, b), 0.5)
      let n = [t[1], -t[0]]
      if (pointInRing(add2(mid, mul2(n, 0.3)), r)) n = mul2(n, -1)
      const probe = add2(mid, mul2(n, 0.6))
      const hidden = Math.max(p.base ?? 0, ...pieces.filter((q) => q !== p && pointInRing(probe, q.outer)).map((q) => q.top))
      if (hidden < p.top) edges.push({ a, t, n, len, mid, y0: hidden, y1: p.top })
    }
  }
  for (const { a, t, n, len, y0, y1 } of edges) {
    const k = Math.max(1, Math.round(len / finGap))
    // a fin is only ever seen from outside: its face and two sides (half a box's triangles, for the size budget)
    for (let i = 0; i <= k; i++) {
      const at = add2(a, mul2(t, (i * len) / k)), Q = (s, d, y) => [at[0] + t[0] * s + n[0] * d, y, at[1] + t[1] * s + n[1] * d]
      quad(fins, Q(-0.175, 0.3, y0), Q(0.175, 0.3, y0), Q(0.175, 0.3, y1), Q(-0.175, 0.3, y1), [n[0], 0, n[1]])
      for (const s of [-1, 1]) quad(fins, Q(s * 0.175, 0, y0), Q(s * 0.175, 0.3, y0), Q(s * 0.175, 0.3, y1), Q(s * 0.175, 0, y1), [t[0] * s, 0, t[1] * s])
    }
    for (const [b0, b1] of belts) {
      const lo = Math.max(b0, y0), hi = Math.min(b1, y1)
      if (hi > lo) slab(bands, add2(add2(a, mul2(t, len / 2)), mul2(n, 0.2)), t, len, 0.4, lo, hi)
    }
  }
  const meshes = [P(fins, F.paint, 'willis-fin', 'fins'), P(bands, F.paint, 'willis-louver', 'belts')] // matte: steel's sky reflection read them as pale lines
  if (ledge) {
    const f = norm2(ledge.face)
    const face = edges.filter((e) => e.y0 <= ledge.y && e.y1 >= ledge.y + 4 && dot2(e.n, f) > 0.9).sort((x, y) => dot2(y.mid, f) - dot2(x.mid, f))[0]
    if (face) {
      for (const s of [-1.5, -0.5, 0.5, 1.5]) slab(boxes, add2(add2(face.mid, mul2(face.t, s * 3.6)), mul2(f, 0.65)), face.t, 3.0, 1.3, ledge.y, ledge.y + 3.1)
      meshes.push(P(boxes, F.paint, 'willis-ledge', 'ledge'))
    }
  }
  return meshes
}

// Carbide & Carbon Building (Burnham Brothers, 1929): polished black granite at the street, a shaft of dark green
// terra-cotta piers whose tops are touched with gold leaf, two setbacks into a tower clad in gold-leaf piers, and the
// gold spire (crowns.js). Setback heights and scales read from photographs; sources in heroes.json (carbidecarbon).
export function carbideDetail({ tower, bodyTop, graniteTop = 9, setbacks = [], key = 'carbidecarbon' }) {
  const ob = orientedBox(tower), c = ob.c
  const rect = (s) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => add2(add2(c, mul2(ob.u, (a * ob.L * s) / 2)), mul2(ob.v, (b * ob.W * s) / 2)))
  const shaftTop = setbacks.length ? setbacks[0][0] : bodyTop
  const tiers = setbacks.map(([y, s], i) => ({ outer: rect(s), holes: [], base: y, top: i + 1 < setbacks.length ? setbacks[i + 1][0] : bodyTop }))
  // the four faces of the rectangle at scale s: [outward normal, along, half-depth, span]
  const faces = (s) => [[ob.v, ob.u, (ob.W * s) / 2, ob.L * s], [mul2(ob.v, -1), ob.u, (ob.W * s) / 2, ob.L * s], [ob.u, ob.v, (ob.L * s) / 2, ob.W * s], [mul2(ob.u, -1), ob.v, (ob.L * s) / 2, ob.W * s]]
  const piersOn = (out, s, y0, y1, gap, proud, w, caps = null) => {
    for (const [n, along, half, span] of faces(s)) {
      const k = Math.max(1, Math.floor(span / gap)), step = span / k
      for (let i = 0; i <= k; i++) {
        const at = add2(add2(c, mul2(along, -span / 2 + i * step)), mul2(n, half + proud / 2))
        slab(out, at, along, w, proud, y0, y1)
        if (caps) slab(caps, add2(at, mul2(n, 0.08)), along, w + 0.2, proud + 0.16, y1 - 2.4, y1 + 0.6)
      }
    }
  }
  const granite = mesh(), piers = mesh(), caps = mesh(), gold = mesh(), bands = mesh()
  for (const [n, along, half, span] of faces(1)) slab(granite, add2(c, mul2(n, half + 0.125)), along, span + 0.5, 0.25, 0, graniteTop)
  piersOn(piers, 1, graniteTop, shaftTop, 2.6, 0.45, 0.55, caps)
  for (const t of tiers) {
    const s = setbacks.find(([y]) => y === t.base)[1]
    piersOn(gold, s, t.base, t.top, 2.2, 0.35, 0.5)
    for (const [n, along, half, span] of faces(s)) slab(bands, add2(c, mul2(n, half + 0.2)), along, span + 0.4, 0.4, t.top - 1.2, t.top)
  }
  // the setback ledges in the shaft's dark green (a plain roof there reads as a pale stripe between green and gold)
  const ledges = mesh()
  setbacks.forEach(([y], i) => { const s = i ? setbacks[i - 1][1] : 1; slab(ledges, c, ob.u, ob.L * s + 0.6, ob.W * s + 0.6, y - 0.05, y + 0.15) })
  const meshes = [
    P(granite, F.stone, 'cc-granite', 'granite'),
    P(piers, F.stone, key, 'piers'),
    P(caps, F.paint, 'gold-leaf', 'pier-caps'),
    P(gold, F.paint, 'gold-leaf', 'gold-piers'),
    P(bands, F.paint, 'gold-leaf', 'gold-bands'),
    P(ledges, F.stone, key, 'ledges'),
  ]
  return { tiers, shaftTop, meshes }
}
