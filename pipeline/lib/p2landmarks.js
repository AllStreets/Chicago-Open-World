// pipeline/lib/p2landmarks.js — the P2 landmark set (backlog E8 P2, I-3.5): lakefront, park and neighbourhood
// structures, procedural and sourced, coloured through _STYLE rows (data/styles.json). Each builder returns the
// buildLandmark contract { meshes: [{ mesh, facade, seed, style, part }] }; the adapters at the bottom take a
// footprint + heroes.json spec.
import { project } from '../../shared/project.js'
import { convexHull } from './venue.js'
import { orientedBox } from './sacred.js'
import { spire, drum, pyramid, doricColumn } from './crowns.js'
import { add2, sub2, mul2, norm2, left, bearing, mesh, tri, quad, merge, tube, slab } from './meshkit.js'
import { LANDMARK_FACADES as F } from './facadeIds.js'
import { plinth, placeStatue, steppedBase, exedra, totemPole } from './statues.js'

const P = (m, facade, style, part, seed = 0.5) => ({ mesh: m, facade, seed, style, part })
const local = (p) => (p && p.lat != null ? project(p.lon, p.lat) : p)
const Y = (p, y) => [p[0], y, p[1]]

// ── Chicago Harbor Light (1893, on the breakwater) ─ https://en.wikipedia.org/wiki/Chicago_Harbor_Light
// A white conical tower with a red-roofed lantern and gallery, beside the red-roofed fog-signal house; the tower
// stands 48 ft (14.6 m) above the breakwater.
export const LIGHTHOUSE = { towerH: 10.5, galleryH: 0.3, lanternH: 2.0, roofH: 1.8, r0: 2.6, r1: 1.9 }
export function lighthouse({ at, base = 0 }, spec = {}) {
  const L = { ...LIGHTHOUSE, ...spec }, y1 = base + L.towerH, y2 = y1 + L.galleryH, y3 = y2 + L.lanternH, y4 = y3 + L.roofH
  const house = slab(mesh(), [at[0] - 7, at[1]], [1, 0], 10, 7, base, base + 5)
  const hr = [[at[0] - 12.4, at[1] - 3.9], [at[0] - 1.6, at[1] - 3.9], [at[0] - 1.6, at[1] + 3.9], [at[0] - 12.4, at[1] + 3.9]]
  return { meshes: [
    P(spire({ at, base, top: y1, r0: L.r0, r1: L.r1, sides: 16 }), F.paint, 'lighthouse-white', 'tower'),
    P(drum({ at, base: y1, top: y2, r: L.r1 + 0.7, sides: 16 }), F.paint, 'lighthouse-red', 'gallery'),
    P(drum({ at, base: y2, top: y3, r: 1.3, sides: 8 }), F.signal, 'lighthouse-lamp', 'lantern'),
    P(spire({ at, base: y3, top: y4, r0: 1.6, r1: 0, sides: 8 }), F.paint, 'lighthouse-red', 'roof'),
    P(house, F.paint, 'lighthouse-white', 'fog-house'),
    P(pyramid({ ring: hr, base: base + 5, top: base + 7 }), F.paint, 'lighthouse-red', 'fog-house-roof'),
  ] }
}

// ── Beach houses ─ North Avenue Beach House (1999, built as an ocean liner: white hull, blue upper deck, two
// funnels, portholes) https://en.wikipedia.org/wiki/North_Avenue_Beach ; 'small' is a one-storey concession stand.
export function beachHouse(b, { style = 'ship' } = {}) {
  const ob = orientedBox(convexHull(b.polygons.flatMap((p) => p.outer))), u = ob.u, v = left(u), c = ob.c
  if (style === 'small') {
    const L = Math.min(ob.L, 30), W = Math.min(ob.W, 12)
    return { meshes: [P(slab(mesh(), c, u, L, W, 0, 3.6), F.paint, 'beachhouse-white', 'walls'), P(slab(mesh(), c, u, L + 2, W + 2, 3.6, 3.95), F.paint, 'beachhouse-blue', 'roof')] }
  }
  const L = Math.min(ob.L, 90), W = Math.min(ob.W, 22), meshes = []
  meshes.push(P(slab(mesh(), c, u, L, W, 0, 4.2), F.paint, 'beachhouse-white', 'hull'))
  meshes.push(P(slab(mesh(), add2(c, mul2(u, -0.08 * L)), u, 0.55 * L, 0.7 * W, 4.2, 7.4), F.paint, 'beachhouse-blue', 'deck'))
  meshes.push(P(slab(mesh(), add2(c, mul2(u, 0.14 * L)), u, 0.16 * L, 0.5 * W, 7.4, 9.8), F.paint, 'beachhouse-white', 'bridge'))
  const funnels = merge(...[-0.3, -0.15].map((k) => drum({ at: add2(c, mul2(u, k * L)), base: 7.4, top: 13.5, r: 1.2, sides: 12 })))
  meshes.push(P(funnels, F.paint, 'beachhouse-blue', 'funnels'))
  // a row of portholes along both long sides, just proud of the hull
  const ports = mesh()
  for (const s of [-1, 1]) {
    const n = mul2(v, s), face = add2(c, mul2(n, W / 2 + 0.05))
    for (let a = -L / 2 + 3; a <= L / 2 - 3; a += 3) {
      const p = add2(face, mul2(u, a)), h = 0.45, e = mul2(u, h)
      quad(ports, Y(sub2(p, e), 2.0), Y(add2(p, e), 2.0), Y(add2(p, e), 2.9), Y(sub2(p, e), 2.9), [n[0], 0, n[1]])
    }
  }
  meshes.push(P(ports, F.led, 'porthole-glow', 'portholes'))
  return { meshes }
}

// ── Ping Tom Park pagoda ─ https://en.wikipedia.org/wiki/Ping_Tom_Memorial_Park — tiers of red walls under green-tiled
// hipped roofs whose corners turn up.
function hippedRoof(out, at, eaveHalf, topHalf, y0, y1, lift) {
  const c = [at[0], y0, at[1]], corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
  for (let i = 0; i < 4; i++) {
    const a = corners[i], b = corners[(i + 1) % 4], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    const E = (q, y) => [at[0] + q[0] * eaveHalf, y, at[1] + q[1] * eaveHalf], T = (q) => [at[0] + q[0] * topHalf, y1, at[1] + q[1] * topHalf]
    const out3 = [(a[0] + b[0]) / 2, 0.8, (a[1] + b[1]) / 2] // outward and up
    tri(out, E(a, y0 + lift), E(m, y0), T(m), out3); tri(out, E(a, y0 + lift), T(m), T(a), out3)
    tri(out, E(m, y0), E(b, y0 + lift), T(b), out3); tri(out, E(m, y0), T(b), T(m), out3)
    // the soffit, seen from below
    tri(out, E(a, y0 + lift), E(b, y0 + lift), [c[0] + m[0] * topHalf, y0, c[2] + m[1] * topHalf], [0, -1, 0])
  }
}
export function pagoda({ at, tiers = 4, baseW = 10, tierH = 3 }) {
  const meshes = [], walls = mesh()
  for (let i = 0; i < tiers; i++) {
    const w = baseW * (1 - 0.17 * i), next = i + 1 < tiers ? baseW * (1 - 0.17 * (i + 1)) : 1.2, y0 = i * tierH, yw = y0 + tierH * 0.6
    slab(walls, at, [1, 0], w, w, y0, yw)
    const roof = mesh()
    hippedRoof(roof, at, w / 2 + 1.4, next / 2, yw, y0 + tierH, 0.5)
    meshes.push(P(roof, F.paint, 'pagoda-green-tile', 'roof'))
  }
  meshes.unshift(P(walls, F.paint, 'pagoda-red', 'walls'))
  meshes.push(P(spire({ at, base: tiers * tierH, top: tiers * tierH + 2.2, r0: 0.35, r1: 0, sides: 6 }), F.paint, 'gate-gold', 'finial'))
  return { meshes }
}

// ── Chinatown Gate (1975, over Wentworth Avenue) ─ https://en.wikipedia.org/wiki/Chinatown,_Chicago — a paifang: two
// red columns, lintels and a green-tiled hipped roof; bearingDeg is the street's direction.
export function gate({ at, spanM, heightM, bearingDeg = 0 }) {
  const f = bearing(bearingDeg), s = [-f[1], f[0]], H = heightM, colTop = 0.72 * H
  const cols = merge(...[-1, 1].map((k) => drum({ at: add2(at, mul2(s, (k * spanM) / 2)), base: 0, top: colTop, r: 0.7, sides: 12 })))
  const beams = merge(slab(mesh(), at, s, spanM + 1.4, 1.2, 0.62 * H, colTop), slab(mesh(), at, s, spanM - 1, 0.8, 0.45 * H, 0.5 * H))
  const roof = mesh(), y0 = colTop + 0.3, L = spanM / 2 + 1.5, D = 1.8, rl = spanM * 0.4, rd = 0.3
  const base = (a, b, y) => Y(add2(add2(at, mul2(s, a)), mul2(f, b)), y)
  const eave = [base(-L, -D, y0), base(L, -D, y0), base(L, D, y0), base(-L, D, y0)], ridge = [base(-rl, -rd, H), base(rl, -rd, H), base(rl, rd, H), base(-rl, rd, H)]
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4, m = [(eave[i][0] + eave[j][0]) / 2 - at[0], 0.8, (eave[i][2] + eave[j][2]) / 2 - at[1]]
    quad(roof, eave[i], eave[j], ridge[j], ridge[i], m)
  }
  quad(roof, ridge[0], ridge[1], ridge[2], ridge[3], [0, 1, 0]); quad(roof, eave[0], eave[1], eave[2], eave[3], [0, -1, 0])
  slab(roof, at, s, spanM + 1.4, 1.6, colTop, y0)
  return { meshes: [P(cols, F.paint, 'gate-red', 'columns'), P(beams, F.paint, 'gate-red', 'lintels'), P(roof, F.paint, 'pagoda-green-tile', 'roof')] }
}

// ── Nature Boardwalk pavilion (Studio Gang, 2010) ─ https://studiogang.com/project/nature-boardwalk-at-lincoln-park-zoo
// Laminated-wood ribs bent into arches of changing span and height, like a tortoise shell, over a boardwalk deck.
export function boardwalkArches({ at, count = 9, spanM = 12, heightM = 8, bearingDeg = 0 }) {
  const f = bearing(bearingDeg), s = [-f[1], f[0]], ribs = mesh(), gap = 1.6
  for (let i = 0; i < count; i++) {
    const k = Math.sin((Math.PI * (i + 0.5)) / count), h = heightM * (0.55 + 0.45 * k), w = spanM * (0.7 + 0.3 * k)
    const c = add2(at, mul2(f, (i - (count - 1) / 2) * gap))
    let prev = null
    for (let j = 0; j <= 16; j++) {
      const t = (j / 16) * Math.PI, q = Y(add2(c, mul2(s, (Math.cos(t) * w) / 2)), Math.sin(t) * h)
      if (prev) tube(ribs, prev, q, 0.18, 4)
      prev = q
    }
  }
  const deck = slab(mesh(), at, f, count * gap + 6, 4, 0, 0.3)
  return { meshes: [P(ribs, F.paint, 'boardwalk-wood', 'ribs'), P(deck, F.paint, 'boardwalk-wood', 'deck')] }
}

// ── Maggie Daley Park skating ribbon ─ https://en.wikipedia.org/wiki/Maggie_Daley_Park — a looping ice path laid
// flat on the park, `widthM` wide, mitred at every bend.
export function ribbonRink(path, widthM) {
  const pts = path.length > 2 && path[0][0] === path.at(-1)[0] && path[0][1] === path.at(-1)[1] ? path.slice(0, -1) : path
  const n = pts.length, closed = pts !== path, off = []
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n]
    const n1 = left(norm2(sub2(b, a))), n2 = left(norm2(sub2(c, b)))
    const e = !closed && i === 0 ? n2 : !closed && i === n - 1 ? n1 : norm2(add2(n1, n2))
    const cos = Math.max(0.3, e[0] * n2[0] + e[1] * n2[1])
    off.push(mul2(e, widthM / 2 / cos))
  }
  const ice = mesh(), y = 0.05
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const j = (i + 1) % n
    quad(ice, Y(add2(pts[i], off[i]), y), Y(add2(pts[j], off[j]), y), Y(sub2(pts[j], off[j]), y), Y(sub2(pts[i], off[i]), y), [0, 1, 0])
  }
  return { meshes: [P(ice, F.paint, 'rink-ice', 'ice')] }
}

// ── Northerly Island pavilion ─ https://en.wikipedia.org/wiki/Huntington_Bank_Pavilion — a white tensile tent pulled up
// to peaks over its masts; drawn on both faces so it reads from the lawn beneath.
export function canopy({ at, w, d, peakH, masts = 4, edgeH = 5, bearingDeg = 0 }) {
  const f = bearing(bearingDeg), s = [-f[1], f[0]], sig = Math.min(w, d) / 4.5
  const tops = masts === 1 ? [[0, 0]] : masts === 2 ? [[-w / 4, 0], [w / 4, 0]] : [[-w / 4, -d / 4], [w / 4, -d / 4], [w / 4, d / 4], [-w / 4, d / 4]].slice(0, masts)
  const toW = (x, z) => add2(add2(at, mul2(s, x)), mul2(f, z))
  const h = (x, z) => edgeH + (peakH - edgeH) * Math.max(...tops.map(([mx, mz]) => Math.exp(-((x - mx) ** 2 + (z - mz) ** 2) / (sig * sig))))
  const skin = mesh(), nx = 24, nz = 20
  const V = (i, k) => { const x = -w / 2 + (w * i) / nx, z = -d / 2 + (d * k) / nz; return Y(toW(x, z), h(x, z)) }
  for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
    quad(skin, V(i, k), V(i + 1, k), V(i + 1, k + 1), V(i, k + 1), [0, 1, 0])
    quad(skin, V(i, k), V(i + 1, k), V(i + 1, k + 1), V(i, k + 1), [0, -1, 0])
  }
  const poles = mesh()
  for (const [mx, mz] of tops) { const p = toW(mx, mz); tube(poles, Y(p, 0), Y(p, peakH + 1.5), 0.35, 8) }
  return { meshes: [P(skin, F.paint, 'canopy-fabric', 'membrane'), P(poles, F.paint, 'canopy-mast', 'masts')] }
}

// ── Doric colonnade ─ fluted columns in a row from `from` to `to`, under a plain entablature.
export function doricColonnade({ from, to, columns, r, h, style = 'doric-limestone' }) {
  const meshes = [], dir = norm2(sub2(to, from)), len = Math.hypot(...sub2(to, from))
  for (let i = 0; i < columns; i++) meshes.push(P(doricColumn({ at: add2(from, mul2(dir, (len * i) / Math.max(1, columns - 1))), base: 0, top: h, r }), F.stone, style, 'column'))
  meshes.push(P(slab(mesh(), mul2(add2(from, to), 0.5), dir, len + 5 * r, 2.8 * r, h, h + 0.22 * h), F.stone, style, 'entablature'))
  return { meshes }
}

// ── Statues on plinths (Lincoln Park, Task 9): each item stands at its own lat/lon (or `local` metres from the
// footprint centre); the figure is the pre-loaded Blender export when the build found one, else the stand-in.
export function statues(b, { items }) {
  const meshes = []
  for (const it of items) {
    const at = it.local ? add2(b.centroid, it.local) : it.lat != null ? local(it) : b.centroid
    // a stepped (or arched) granite base when the monument has one, else a plain plinth (Lincoln Park pass, B-6)
    let top = it.plinthH
    if (it.tiers) {
      const base = steppedBase({ at, bearingDeg: it.bearingDeg ?? 0, tiers: it.tiers, arch: it.arch ?? null })
      meshes.push(P(base.stone, F.stone, it.plinthStyle ?? 'plinth-granite', 'plinth'))
      if (base.shadow.positions.length) meshes.push(P(base.shadow, F.steel, 'gothic-shadow', 'arch'))
      top = base.top
    } else meshes.push(P(plinth({ at, base: 0, w: it.plinthW ?? it.heightM * 0.8, h: it.plinthH }), F.stone, it.plinthStyle ?? 'plinth-granite', 'plinth'))
    if (it.exedra) meshes.push(P(exedra({ at, bearingDeg: it.bearingDeg ?? 0, ...it.exedra }), F.stone, 'plinth-granite', 'exedra'))
    const { mesh: m } = placeStatue(it, { at, base: top, bearingDeg: it.bearingDeg ?? 0 }, it.preloaded)
    meshes.push(P(m, F.bronze, it.style ?? 'statue-bronze', 'figure'))
  }
  return { replace: true, pieces: [], meshes }
}

// ── Pilsen murals (Task 10) ─ original abstract designs (pipeline/textures/murals.js) on real street walls of
// 18th Street; each quad sits 5 cm proud of its wall, facing `out` (default: left of a → b), and repeats its design
// along the wall so a long wall is not stretched. The facade id picks the mural layer (30 + layer).
export const MURAL_FACADE0 = F.mural
export function muralQuads(walls) {
  return { meshes: walls.map((w, k) => {
    const d = norm2(sub2(w.b, w.a)), n = w.out ?? left(d), off = mul2(n, 0.05), a = add2(w.a, off), b = add2(w.b, off)
    const len = Math.hypot(...sub2(w.b, w.a)), rep = Math.max(1, Math.round(len / (w.top - w.base) / 1.4)), m = mesh()
    quad(m, Y(a, w.base), Y(b, w.base), Y(b, w.top), Y(a, w.top), [n[0], 0, n[1]], [0, 0, rep, 1])
    return P(m, MURAL_FACADE0 + w.layer, null, 'mural', k / walls.length)
  }) }
}

// Adapters: footprint + heroes.json `landmark` spec → the buildLandmark contract (the OSM shell is replaced).
const atOf = (b, s) => (s.at ? local(s.at) : b.centroid)
export const P2_BUILDERS = {
  lighthouse: (b, s) => {
    const at = atOf(b, s), r = lighthouse({ at, base: s.base ?? 0 }, s.params ?? {})
    // the concrete breakwater it stands on, running off along its bearing (the harbour's outer wall)
    if (s.breakwater) { const f = bearing(s.breakwater.bearingDeg ?? 0), c = add2(at, mul2(f, (s.breakwater.aheadM - s.breakwater.behindM) / 2)); r.meshes.push(P(slab(mesh(), c, f, s.breakwater.aheadM + s.breakwater.behindM, s.breakwater.widthM ?? 9, -1, s.base ?? 2), F.stone, 'sidewalk-concrete', 'breakwater')) }
    return { replace: true, pieces: [], ...r }
  },
  beachHouse: (b, s) => ({ replace: true, pieces: [], ...beachHouse(b, s) }),
  pagoda: (b, s) => ({ replace: true, pieces: [], ...pagoda({ at: atOf(b, s), tiers: s.tiers, baseW: s.baseW, tierH: s.tierH }) }),
  gate: (b, s) => ({ replace: true, pieces: [], ...gate({ at: atOf(b, s), spanM: s.spanM, heightM: s.heightM, bearingDeg: s.bearingDeg }) }),
  boardwalkArches: (b, s) => ({ replace: true, pieces: [], ...boardwalkArches({ at: atOf(b, s), count: s.count, spanM: s.spanM, heightM: s.heightM, bearingDeg: s.bearingDeg }) }),
  ribbonRink: (b, s) => ({ replace: true, pieces: [], ...ribbonRink(s.path.map(local), s.widthM) }),
  statues,
  // Kwanusila (B-6): the painted cedar totem pole on its concrete pad
  totem: (b, s) => {
    const at = atOf(b, s), t = totemPole({ at, bearingDeg: s.bearingDeg ?? 0, heightM: s.heightM ?? 12.2 })
    return { replace: true, pieces: [], meshes: [P(plinth({ at, base: 0, w: 2.4, h: 0.3 }), F.stone, 'sidewalk-concrete', 'pad'), P(t.cedar, F.steel, 'lp-cedar', 'pole'), P(t.black, F.steel, 'clock-hands', 'paint-black'), P(t.red, F.steel, 'gate-red', 'paint-red'), P(t.teal, F.steel, 'lp-totem-teal', 'paint-teal'), P(t.white, F.steel, 'lp-trim-white', 'paint-white')] }
  },
  murals: (b, s) => ({ replace: true, pieces: [], ...muralQuads(s.walls.map((w) => ({ ...w, a: local(w.a), b: local(w.b) }))) }),
  canopy: (b, s) => ({ replace: true, pieces: [], ...canopy({ at: atOf(b, s), w: s.w, d: s.d, peakH: s.peakH, masts: s.masts, bearingDeg: s.bearingDeg }) }),
}
