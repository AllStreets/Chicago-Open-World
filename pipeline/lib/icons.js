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
import { ringCentroid } from './geom.js'
import { add2, sub2, mul2, norm2, left, bearing, mesh, tri, quad, merge, slab } from './meshkit.js'
import { LANDMARK_FACADES as F } from './facadeIds.js'

const P = (m, facade, style, part, seed = 0.5) => ({ mesh: m, facade, seed, style, part })
const Y = (p, y) => [p[0], y, p[1]]

// A shape drawn on a wall: 2D points (s along the wall, y up) at `origin`, pushed `proud` metres out along `dir`.
function wallPolygon(out, origin, along, dir, pts, proud) {
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
