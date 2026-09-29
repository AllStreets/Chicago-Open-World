// pipeline/lib/civic.js — the P1 civic landmarks (backlog E8): procedural, sourced, coloured through _STYLE.
import { project } from '../../shared/project.js'
import { convexHull } from './venue.js'
import { orientedBox, lathe, DOME } from './sacred.js'
import { drum, pyramid } from './crowns.js'
import { add2, sub2, mul2, dot2, norm2, left, bearing, at3, norm3, mesh, quad, merge, tube, slab, barrel, place, catmullRom, ringAround } from './meshkit.js'
import { LANDMARK_FACADES as F } from './facadeIds.js'

const local = (p) => project(p.lon, p.lat)
const hullOf = (b) => convexHull(b.polygons.flatMap((p) => p.outer))
const obOf = (b) => orientedBox(hullOf(b))
const P = (m, facade, style, part, seed = 0.5) => ({ mesh: m, facade, seed, style, part })
const rectRing = (c, u, L, W) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, o]) => add2(add2(c, mul2(u, (a * L) / 2)), mul2(left(u), (o * W) / 2)))

// The face of a footprint looking along f: hull centre, how far out the face is, and its extent across (side).
export function faceOf(b, f) {
  const hull = hullOf(b), c = mul2(hull.reduce((s, p) => add2(s, p), [0, 0]), 1 / hull.length), side = left(f)
  const face = Math.max(...hull.map((p) => dot2(sub2(p, c), f)))
  const near = hull.filter((p) => dot2(sub2(p, c), f) > face - 10).map((p) => dot2(sub2(p, c), side))
  return { c, face, side, o0: Math.min(...near), o1: Math.max(...near) }
}

// ── Crown Fountain (Jaume Plensa, 2004) ─ https://en.wikipedia.org/wiki/Crown_Fountain
// Towers 50 × 23 × 16 ft (15.2 × 7.0 × 4.9 m) of glass brick with LED faces; black granite pool 48 × 232 ft (15 × 71 m).
export const CROWN = { towerW: 7.0, towerD: 4.9, towerH: 15.2, poolL: 71, poolW: 15 }
function crownFountain(b, spec) {
  const [t1, t2] = spec.towers.map(local), axis = norm2(sub2(t2, t1)), mid = mul2(add2(t1, t2), 0.5), meshes = [], spouts = []
  meshes.push(P(slab(mesh(), mid, axis, CROWN.poolL, CROWN.poolW, 0, 0.12), F.stone, 'black-granite', 'pool'))
  meshes.push(P(slab(mesh(), mid, axis, CROWN.poolL - 0.6, CROWN.poolW - 0.6, 0.12, 0.14), F.water, null, 'pool-water', 0.1))
  ;[t1, t2].forEach((t, i) => {
    const f = norm2(sub2(mid, t)), side = left(f)
    meshes.push(P(slab(mesh(), t, f, CROWN.towerD, CROWN.towerW, 0, CROWN.towerH), F.stone, 'crown-glass-block', 'tower'))
    const face = add2(t, mul2(f, CROWN.towerD / 2 + 0.03)), Q = (o, y) => at3(add2(face, mul2(side, o)), y)
    meshes.push(P(quad(mesh(), Q(-3.2, 0.6), Q(3.2, 0.6), Q(3.2, 14.6), Q(-3.2, 14.6), [f[0], 0, f[1]], [0, 0, 1, 1]), F.face, null, 'screen', i === 0 ? 0.25 : 0.75))
    spouts.push({ kind: 'crown', tower: i, p: at3(add2(face, mul2(f, 0.1)), 0.6 + 14 * 0.35), dir: norm3([f[0] * 0.95, 0.3, f[1] * 0.95]), h: 4, floor: 0.14 })
  })
  return {
    replace: true, pieces: [], meshes, clear: [rectRing(mid, axis, CROWN.poolL + 12, CROWN.poolW + 16)],
    runtime: { crown: { towers: [t1, t2], spouts }, plazas: [{ key: 'crownfountain', c: mid, r: 45, avoid: [{ c: t1, r: 5 }, { c: t2, r: 5 }] }] },
  }
}

// ── Lurie Garden (2004) ─ https://en.wikipedia.org/wiki/Lurie_Garden — the 15 ft Shoulder Hedge on the north and west,
// the dark and light plates of perennials, divided by the "seam" boardwalk.
function lurie(b, spec) {
  const c = b.centroid, u = bearing(spec.bearing ?? 90), v = left(u), L = spec.L ?? 100, W = spec.W ?? 100, seamA = -0.1 * L
  const at = (a, o) => add2(add2(c, mul2(u, a)), mul2(v, o))
  const hedge = mesh()
  slab(hedge, at(0, W / 2 - 1.5), u, L, 3, 0, 4.6)                       // north
  slab(hedge, at(-L / 2 + 1.5, -1.5), u, 3, W - 3, 0, 4.6)               // west
  const d0 = -L / 2 + 3, d1 = seamA - 1.5, l0 = seamA + 1.5, l1 = L / 2
  return {
    replace: true, pieces: [], clear: [rectRing(c, u, L, W)],
    meshes: [
      P(hedge, F.ivy, 'lurie-hedge', 'hedge'),
      P(slab(mesh(), at((d0 + d1) / 2, -1.5), u, d1 - d0, W - 3, 0, 0.45), F.ivy, 'lurie-dark-plate', 'planting'),
      P(slab(mesh(), at((l0 + l1) / 2, -1.5), u, l1 - l0, W - 3, 0, 0.45), F.ivy, 'lurie-light-plate', 'planting'),
      P(slab(mesh(), at(seamA, 0), u, 3, W, 0, 0.5), F.stone, 'bp-deck-wood', 'seam'),
    ],
  }
}

// ── BP Pedestrian Bridge (Frank Gehry, 2004) ─ https://en.wikipedia.org/wiki/BP_Pedestrian_Bridge — a 935 ft (285 m)
// serpentine footbridge over Columbus Drive, hardwood deck, brushed stainless steel side panels.
function bpBridge(b, spec) {
  const pts = catmullRom(spec.path.map(local), 2), n = pts.length, W = 3.4, rise = spec.rise ?? 4.4
  const deck = mesh(), skin = mesh(), piers = mesh(), y = (i) => 0.4 + rise * Math.sin((Math.PI * i) / (n - 1))
  for (let i = 0; i < n - 1; i++) {
    const a = pts[i], c2 = pts[i + 1], s = left(norm2(sub2(c2, a))), A = (p, o, yy) => at3(add2(p, mul2(s, o)), yy)
    quad(deck, A(a, -W / 2, y(i)), A(c2, -W / 2, y(i + 1)), A(c2, W / 2, y(i + 1)), A(a, W / 2, y(i)), [0, 1, 0], [0, 0, 2, W])
    quad(deck, A(a, -W / 2, y(i) - 0.5), A(c2, -W / 2, y(i + 1) - 0.5), A(c2, W / 2, y(i + 1) - 0.5), A(a, W / 2, y(i) - 0.5), [0, -1, 0])
    for (const o of [-1, 1]) {
      const q = [A(a, (o * W) / 2, y(i) - 0.5), A(c2, (o * W) / 2, y(i + 1) - 0.5), A(c2, o * (W / 2 + 0.45), y(i + 1) + 1.9), A(a, o * (W / 2 + 0.45), y(i) + 1.9)]
      quad(skin, ...q, [s[0] * o, 0.3, s[1] * o]); quad(skin, ...q, [-s[0] * o, 0.3, -s[1] * o])   // outer and inner faces
    }
    if (i % 15 === 7 && y(i) > 1.2) tube(piers, at3(a, 0), at3(a, y(i) - 0.5), 0.5, 8)
  }
  return { replace: true, pieces: [], meshes: [P(deck, F.stone, 'bp-deck-wood', 'deck'), P(skin, F.bronze, 'gehry-stainless', 'skin'), P(piers, F.steel, 'gehry-stainless', 'pier')] }
}

// ── Art Institute of Chicago ─ https://en.wikipedia.org/wiki/Art_Institute_of_Chicago_Building (Edward Kemeys'
// bronze lions, 1894, flanking the Michigan Avenue steps); https://en.wikipedia.org/wiki/Modern_Wing (Renzo Piano, 2009).
export function lionFigure() {   // local: faces +x, stands on a 1.5 m plinth
  const m = mesh()
  tube(m, [-1.2, 2.3, 0], [0.9, 2.45, 0], 0.55, 8)
  tube(m, [1.2, 2.95, 0], [1.8, 2.75, 0], 0.36, 8)
  for (const [x, z] of [[0.8, 0.35], [0.8, -0.35], [-0.9, 0.35], [-0.9, -0.35]]) tube(m, [x, 1.5, z], [x, 2.25, z], 0.2, 6)
  tube(m, [-1.2, 2.4, 0], [-1.9, 1.9, 0.2], 0.1, 6)
  return merge(m, drum({ at: [1.0, 0], base: 2.0, top: 3.1, r: 0.72, sides: 10 }))   // mane
}
function artInstitute(b, spec) {
  const meshes = [], lion = lionFigure(), plinth = slab(mesh(), [0, 0], [1, 0], 3.9, 1.7, 0, 1.5)
  for (const l of spec.lions) {
    const at = local(l)
    meshes.push(P(place(plinth, { at, yawDeg: spec.facingBearing }), F.stone, 'aic-plinth-granite', 'plinth'))
    meshes.push(P(place(lion, { at, yawDeg: spec.facingBearing }), F.bronze, 'aic-lion-bronze', 'lion'))
  }
  const cv = spec.canopy, cc = local(cv.at), u = bearing(cv.bearing ?? 90), m = slab(mesh(), cc, u, cv.L, cv.W, cv.y, cv.y + 0.35)
  for (let k = 0; k < 40; k++) slab(m, add2(cc, mul2(left(u), -cv.W / 2 + (cv.W * (k + 0.5)) / 40)), u, cv.L, 0.12, cv.y - 0.9, cv.y)   // blades
  meshes.push(P(m, F.steel, 'modern-wing-white', 'modern-wing-canopy'))
  return { meshes }
}

export const CIVIC = { crownFountain, lurie, bpBridge, artInstitute }
