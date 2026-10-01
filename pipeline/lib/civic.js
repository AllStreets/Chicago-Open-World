// pipeline/lib/civic.js — the P1 civic landmarks (backlog E8): procedural, sourced, coloured through _STYLE.
import { project } from '../../shared/project.js'
import { convexHull } from './venue.js'
import { orientedBox, lathe, DOME } from './sacred.js'
import { drum, pyramid } from './crowns.js'
import { add2, sub2, mul2, dot2, len2, norm2, left, bearing, at3, norm3, mesh, tri, quad, merge, tube, slab, barrel, place, catmullRom, ringAround } from './meshkit.js'
import earcut from 'earcut'
import { pointInRing } from './geom.js'
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

// ── The Picasso (1967) ─ https://en.wikipedia.org/wiki/Chicago_Picasso — 50 ft (15.2 m), 162 short tons of Cor-Ten.
function picasso(b, spec) {
  const c = b.centroid, f = bearing(spec.facingBearing ?? 180), s = left(f), H = spec.heightM ?? 15.2, m = mesh(), base = slab(mesh(), c, f, 9, 6, 0, 0.6)
  const Q = (a, o, y) => at3(add2(add2(c, mul2(f, a)), mul2(s, o)), y)
  for (const o of [-1, 1]) slab(m, add2(c, mul2(s, o * 2.2)), f, 1.2, 0.6, 0.6, 4.5)             // legs
  slab(m, add2(c, mul2(f, 0.3)), f, 0.4, 2.4, 4, H - 1.6)                                          // the long face
  for (const o of [-1, 1]) for (let i = 0; i < 6; i++) {                                           // swept "wings"
    const y0 = 4 + i * 1.8, y1 = y0 + 1.8, sw = (y) => 2.2 + 1.8 * Math.sin(((y - 4) / (H - 4)) * Math.PI)
    const q = [Q(-0.3, o * 0.5, y0), Q(-3.5, o * sw(y0), y0), Q(-3.5, o * sw(y1), y1), Q(-0.3, o * 0.5, y1)]
    quad(m, ...q, [s[0] * o, 0, s[1] * o]); quad(m, ...q, [-s[0] * o, 0, -s[1] * o])
  }
  let prev = null
  for (let k = 0; k <= 16; k++) { const t = (k / 16) * Math.PI * 2, q = Q(0.1, Math.cos(t) * 2.8, H - 4.32 + Math.sin(t) * 4.1); if (prev) tube(m, prev, q, 0.22, 5); prev = q }  // head ring
  for (let i = 0; i < 10; i++) { const y = 5.5 + i * 0.85; tube(m, Q(-0.2, 0, y), Q(-3.4, (i % 2 ? 1 : -1) * 2.6, y + 0.4), 0.06, 4) }  // rods
  return { replace: true, pieces: [], clear: [ringAround(c, 12)], meshes: [P(m, F.bronze, 'corten', 'sculpture'), P(base, F.stone, 'aic-plinth-granite', 'plinth')],
    runtime: { plazas: [{ key: 'picasso', c: [c[0], c[1]], r: 30, avoid: [{ c: [c[0], c[1]], r: 7 }] }] } }
}

// ── Flamingo (Alexander Calder, 1974) ─ https://en.wikipedia.org/wiki/Flamingo_(sculpture) — 53 ft (16.2 m), vermilion.
function flamingo(b, spec) {
  const c = b.centroid, H = spec.heightM ?? 16.2, m = mesh(), Pt = (dx, dz) => [c[0] + dx, c[1] + dz]
  const arch = (a0, a1, h, n = 14) => {
    let prev = null
    for (let i = 0; i <= n; i++) { const t = i / n, q = at3(add2(mul2(a0, 1 - t), mul2(a1, t)), h * Math.sin(Math.PI * t)); if (prev) tube(m, prev, q, 0.9 - 0.5 * Math.sin(Math.PI * t) + 0.1, 6); prev = q }
  }
  arch(Pt(-9, -2), Pt(8, 3), H - 0.5); arch(Pt(-2, 7), Pt(3, -8), 0.7 * H); arch(Pt(4, 6), Pt(9, -1), 0.4 * H)
  return { replace: true, pieces: [], clear: [ringAround(c, 16)], meshes: [P(m, F.paint, 'calder-red', 'flamingo')],
    runtime: { plazas: [{ key: 'flamingo', c: [c[0], c[1]], r: 32, avoid: [{ c: [c[0], c[1]], r: 10 }] }] } }
}

// ── Chicago Cultural Center ─ https://en.wikipedia.org/wiki/Chicago_Cultural_Center — the Tiffany dome (38 ft) over
// Preston Bradley Hall (Washington St side) and the Healy & Millet dome (40 ft) over the G.A.R. Hall (Randolph side).
// Both sit under protective skylights, so from outside they read as glazed roof lanterns that glow at night.
function culturalCenter(b, spec) {
  const { u } = obOf(b), top = b.height, meshes = []
  for (const d of spec.domes) {
    const at = local(d.at), r = d.r, ring = rectRing(at, u, 2 * r + 1.6, 2 * r + 1.6)
    meshes.push(P(slab(mesh(), at, u, 2 * r + 1.6, 2 * r + 1.6, top, top + 1.2), F.stone, 'tender-limestone', 'skylight-curb'))
    meshes.push(P(pyramid({ ring, base: top + 1.2, top: top + 1.2 + 0.45 * r }), F.signal, d.kind === 'tiffany' ? 'tiffany-glass' : 'healy-millet-glass', `dome:${d.kind}`))
  }
  return { meshes }
}

// ── Chicago Union Station (1925) ─ https://en.wikipedia.org/wiki/Chicago_Union_Station — the Canal Street colonnade
// and the barrel-vaulted skylight of the Great Hall (219 ft long, 115 ft high inside).
function unionStation(b, spec) {
  const f = bearing(spec.facingBearing ?? 90), { c, face, side, o0, o1 } = faceOf(b, f), H = spec.columnH ?? 16, n = spec.columns ?? 20
  const span = o1 - o0 - 6, front = add2(c, mul2(f, face + 2.2)), mid = (o0 + o1) / 2, hall = spec.hall ?? { L: 67, W: 30, rise: 8 }
  const cols = merge(...Array.from({ length: n }, (_, i) => drum({ at: add2(front, mul2(side, mid - span / 2 + (span * i) / (n - 1))), base: 0, top: H, r: 0.95, sides: 12 })))
  const ent = slab(mesh(), add2(front, mul2(side, mid)), f, 3.4, span + 2.4, H, H + 2.2)
  return { meshes: [P(cols, F.stone, 'union-limestone', 'column'), P(ent, F.stone, 'union-limestone', 'entablature'), P(barrel(c, side, hall.L, hall.W, b.height - 4, hall.rise), F.wall, 'conservatory-glass', 'great-hall', 0.35)] }
}

// ── Merchandise Mart (1930) ─ https://en.wikipedia.org/wiki/Merchandise_Mart — the river façade's limestone piers
// and corner towers above the main block.
function martRiverFace(b, spec) {
  const f = bearing(spec.facingBearing ?? 180), { c, face, side, o0, o1 } = faceOf(b, f), top = spec.pierTop ?? 78, every = spec.pierEvery ?? 6.1
  const piers = mesh(), towers = mesh(), n = Math.max(1, Math.floor((o1 - o0) / every))
  // a pier stops at the roof directly behind it (the Mart steps back; OSM parts carry the heights)
  // (no pieces known: the spec's pierTop; pieces known but none behind this spot — the outline curves away: no pier)
  const roofAt = (p) => { if (!b.pieces?.length) return top; const q = add2(p, mul2(f, -2)), pc = b.pieces.filter((x) => pointInRing(q, x.outer)); return pc.length ? Math.max(...pc.map((x) => x.top)) : 0 }
  for (let i = 0; i <= n; i++) { const at = add2(add2(c, mul2(f, face + 0.45)), mul2(side, o0 + ((o1 - o0) * i) / n)), h = Math.min(top, roofAt(at)); if (h > 3) slab(piers, at, f, 0.9, 1.1, 0, h) }
  for (const o of [o0 + 4, o1 - 4]) { const at = add2(add2(c, mul2(f, face - 4)), mul2(side, o)), t = Math.min(top, roofAt(at)); if (t > 3) slab(towers, at, f, 8, 8, t, t + 9) }
  return { meshes: [P(piers, F.stone, 'mart-limestone', 'pier'), P(towers, F.stone, 'mart-limestone', 'corner-tower')] }
}

// ── Navy Pier (1916) ─ https://en.wikipedia.org/wiki/Navy_Pier — the Headhouse's twin towers at the entrance,
// and the Aon Grand Ballroom's 100 ft (30.5 m) dome at the east end.
function headhouse(b, spec) {
  const f = bearing(spec.facingBearing ?? 270), { c, face, side, o0, o1 } = faceOf(b, f), H = spec.towerH ?? 30, out = []
  for (const o of [o0 + 4, o1 - 4]) {
    const at = add2(add2(c, mul2(f, face - 3.5)), mul2(side, o))
    out.push(P(slab(mesh(), at, f, 7, 7, 0, H), F.stone, 'navy-pier-brick', 'tower'))
    out.push(P(pyramid({ ring: rectRing(at, f, 7.8, 7.8), base: H, top: H + 6 }), F.roofing, null, 'tower-roof', 0.85))   // terracotta tile
  }
  out.push(P(slab(mesh(), add2(add2(c, mul2(f, face + 0.5)), mul2(side, (o0 + o1) / 2)), f, 1, Math.max(4, o1 - o0 - 16), 6, 14), F.stone, 'navy-pier-brick', 'gateway'))
  return { meshes: out, runtime: { plazas: [{ key: 'navypier', c: add2(c, mul2(f, face + 25)), r: 22, avoid: [] }] } }
}
function ballroom(b, spec) {
  const { c } = obOf(b), top = b.height, r = spec.domeR ?? 15.2
  return { meshes: [
    P(drum({ at: c, base: top - 0.5, top: top + 3, r: r * 1.04, sides: 32 }), F.stone, 'navy-pier-brick', 'drum'),
    P(lathe(c, top + 3, r, DOME, 32), F.stone, 'ballroom-dome', 'dome'),
    P(drum({ at: c, base: top + 3 + r * 0.97, top: top + 3 + r + 2.5, r: r * 0.12, sides: 12 }), F.stone, 'ballroom-dome', 'lantern'),
  ] }
}

// ── Chicago Riverwalk ─ https://en.wikipedia.org/wiki/Chicago_Riverwalk — granite walk along the south bank with
// its "rooms"; the River Theater's seating steps. Over the sunken river (D1, levels.json) the Riverwalk is built at
// river level by riverwalk.js once the bridges are known, and this builder only claims the footprint; in the flat
// world (LEVELS_RIVER=0) it is the street-level walk below.
let riverLevelOn = false
export const setRiverwalkAtRiverLevel = (on) => { riverLevelOn = Boolean(on) }
function riverwalk(b, spec) {
  if (riverLevelOn) return { replace: true, pieces: [], meshes: [] }
  const ring = b.polygons[0].outer, y = spec.y ?? 0.16, meshes = [], flat = ring.flat(), t = earcut(flat, undefined, 2), pave = mesh()
  for (let i = 0; i < t.length; i += 3) {
    const v = [t[i], t[i + 1], t[i + 2]]
    tri(pave, ...v.map((k) => [flat[2 * k], y, flat[2 * k + 1]]), [0, 1, 0], ...v.map((k) => [flat[2 * k], flat[2 * k + 1]]))
  }
  meshes.push(P(pave, F.stone, 'riverwalk-granite', 'paving'))
  const rail = mesh(), facing = (spec.riverFacing ?? [[0, -1]]).map(norm2)
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], c2 = ring[(i + 1) % ring.length], e = sub2(c2, a), L = len2(e)
    if (L < 1) continue
    let n = norm2(left(e))
    if (pointInRing(add2(mul2(add2(a, c2), 0.5), mul2(n, 0.5)), ring)) n = mul2(n, -1)   // point out of the walk
    if (!facing.some((d) => dot2(n, d) > 0.7)) continue
    const k = Math.max(1, Math.round(L / 3))
    for (let j = 0; j <= k; j++) { const p = add2(a, mul2(e, j / k)); tube(rail, at3(p, y), at3(p, y + 1.1), 0.05, 4) }
    tube(rail, at3(a, y + 1.1), at3(c2, y + 1.1), 0.05, 4)
  }
  meshes.push(P(rail, F.steel, 'lamp-post-black', 'railing'))
  if (spec.theater) {
    const at = local(spec.theater.at), f = bearing(spec.theater.bearing ?? 180), steps = mesh()
    for (let k = 0; k < (spec.theater.steps ?? 5); k++) slab(steps, add2(at, mul2(f, k * 1.2)), f, 1.2, spec.theater.w ?? 30, y, y + 0.45 * (k + 1))
    meshes.push(P(steps, F.stone, 'riverwalk-granite', 'river-theater'))
  }
  return { replace: true, pieces: [], meshes }
}

// ── Lincoln Park Zoo ─ https://en.wikipedia.org/wiki/Lincoln_Park_Zoo — the Kovler Lion House (1912), brick under a
// hipped tile roof. Lincoln Park Conservatory (1895) ─ https://en.wikipedia.org/wiki/Lincoln_Park_Conservatory —
// the glass Palm House dome (50 ft) and its vaulted wings.
function lionHouse(b, spec) {
  const { c, u, L, W } = obOf(b)
  return { meshes: [P(pyramid({ ring: rectRing(c, u, L + 1.2, W + 1.2), base: b.height, top: b.height + (spec.roofRise ?? 5) }), F.roofing, null, 'roof', 0.85)] }
}
function glasshouse(b, spec) {
  const { c, u, L, W } = obOf(b), r = spec.domeR ?? 9, glass = (m, part) => P(m, F.wall, 'conservatory-glass', part, 0.35)
  const meshes = [glass(drum({ at: c, base: 0, top: 6, r, sides: 24 }), 'palm-house'), glass(lathe(c, 6, r, DOME, 24), 'palm-dome')]
  const wingL = Math.max(6, (L - 2 * r) / 2), wingW = Math.min(W, 14)
  for (const s of [-1, 1]) {
    const at = add2(c, mul2(u, s * (r + wingL / 2)))
    meshes.push(glass(slab(mesh(), at, u, wingL, wingW, 0, 4), 'wing'), glass(barrel(at, u, wingL, wingW, 4, 5), 'wing-vault'))
  }
  return { replace: true, pieces: [], meshes }
}

export const CIVIC = { crownFountain, lurie, bpBridge, artInstitute, picasso, flamingo, culturalCenter, unionStation, martRiverFace, headhouse, ballroom, riverwalk, lionHouse, glasshouse }
