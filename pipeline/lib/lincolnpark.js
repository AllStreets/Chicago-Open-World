// pipeline/lib/lincolnpark.js — "the cool stone structures in Lincoln Park" (user request), procedural, in limestone
// material rows. Sources and anchors in heroes.json (chesspavilion, couchtomb, lilypool, wavelandclock):
//   Chess Pavilion (Maurice Webster, architect; Boris Gilbertson, carver; 1957): a thin flat concrete roof on Indiana
//     limestone end walls carved with game boards and reliefs, chess tables beneath, and the five-foot carved limestone
//     king and queen flanking it.
//   Couch Tomb (1858): the Couch family vault, the last tomb left from the City Cemetery that became the park — a
//     Greek Revival limestone block with a heavy cornice and an iron door.
//   Alfred Caldwell Lily Pool (1936–38): a prairie river of a pool between stratified limestone ledges, a waterfall at
//     its north end, Caldwell's long low prairie pavilion and a stone council ring.
//   Waveland Clock Tower (Edwin H. Clark, 1931): the seven-storey English Gothic brick-and-limestone carillon tower of
//     the Waveland fieldhouse, a clock on each face.
// Dimensions not in the sources are read from photographs and marked approximate in heroes.json.
import { convexHull } from './venue.js'
import { orientedBox } from './sacred.js'
import { pointInRing } from './geom.js'
import earcut from 'earcut'
import { spire } from './crowns.js'
import { wallPolygon } from './icons.js'
import { add2, mul2, left, mesh, merge, slab, revolve, ringAround } from './meshkit.js'
import { LANDMARK_FACADES as F } from './facadeIds.js'

const P = (m, facade, style, part, seed = 0.5) => ({ mesh: m, facade, seed, style, part })
const obOf = (b) => orientedBox(convexHull(b.polygons.flatMap((p) => p.outer)))
const frac = (x) => x - Math.floor(x)
const rnd = (k) => frac(Math.sin(k * 127.1 + 311.7) * 43758.5453)
const LIME = 'lp-limestone'

// a chess piece turned on a lathe: [radius, height] from the foot up
const KING = [[0.55, 0], [0.55, 0.12], [0.38, 0.22], [0.24, 0.5], [0.18, 0.95], [0.3, 1.05], [0.2, 1.15], [0.28, 1.36], [0.001, 1.4]]
const QUEEN = [[0.55, 0], [0.55, 0.12], [0.38, 0.22], [0.24, 0.5], [0.17, 0.92], [0.29, 1.02], [0.19, 1.1], [0.3, 1.32], [0.12, 1.38], [0.001, 1.4]]

export function chessPavilion(b, spec = {}) {
  const { c, u, v, L, W } = obOf(b), roofY = spec.roofM ?? 3.0
  const stone = mesh(), roof = mesh(), tables = mesh(), reliefs = mesh(), walls = mesh(), plinths = mesh()
  slab(stone, c, u, L + 1, W + 1, 0, 0.3)
  for (const s of [-0.25, 0, 0.25]) slab(stone, add2(c, mul2(u, s * L)), u, 0.6, 0.6, 0.3, roofY)
  // the carved end walls: game boards and incised panels on their outer faces
  for (const e of [-1, 1]) {
    const wc = add2(c, mul2(u, e * (L / 2 - 0.4)))
    slab(walls, wc, v, W, 0.8, 0.3, roofY)
    const face = add2(c, mul2(u, e * L / 2)), dir = mul2(u, e), along = mul2(v, e)
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2 === 0) {
      const s0 = -0.9 + i * 0.45, y0 = 1.0 + j * 0.45
      wallPolygon(reliefs, face, along, dir, [[s0, y0], [s0 + 0.45, y0], [s0 + 0.45, y0 + 0.45], [s0, y0 + 0.45]], 0.02)
    }
    for (const s of [-W / 2 + 0.6, W / 2 - 1.6]) wallPolygon(reliefs, face, along, dir, [[s, 0.8], [s + 1.0, 0.8], [s + 1.0, roofY - 0.5], [s, roofY - 0.5]], 0.02)
  }
  slab(roof, c, u, L + 3, W + 2.4, roofY, roofY + 0.32)
  // the chess tables: two rows down the pavilion
  for (const row of [-0.27, 0.27]) for (let a = -L / 2 + 2.4; a <= L / 2 - 2.4; a += 2.6) {
    const t = add2(add2(c, mul2(u, a)), mul2(v, row * W))
    slab(tables, t, u, 0.28, 0.28, 0.3, 0.72); slab(tables, t, u, 0.8, 0.8, 0.72, 0.8)
  }
  // the king and queen, five feet tall on their plinths, flanking the pavilion
  const at = (e) => add2(c, mul2(u, e * (L / 2 + 1.3)))
  for (const e of [-1, 1]) slab(plinths, at(e), u, 1.3, 1.3, 0, 0.9)
  const king = revolve(at(-1), KING.map(([r, y]) => [r, 0.9 + y * 1.1]), { sides: 16 })
  const cross = mesh(), kc = at(-1), ky = 0.9 + 1.4 * 1.1
  slab(cross, kc, u, 0.1, 0.1, ky - 0.05, ky + 0.38); slab(cross, kc, u, 0.32, 0.1, ky + 0.16, ky + 0.26)
  const queen = revolve(at(1), QUEEN.map(([r, y]) => [r, 0.9 + y * 1.1]), { sides: 16 })
  const coronet = mesh()
  for (const p of ringAround(at(1), 0.28, 8)) { const s = spire({ at: p, base: 0.9 + 1.32 * 1.1, top: 0.9 + 1.32 * 1.1 + 0.22, r0: 0.05, sides: 5 }); for (const k of ['positions', 'normals', 'uvs']) coronet[k].push(...s[k]) }
  return { replace: true, pieces: [], meshes: [
    P(merge(stone, plinths), F.stone, LIME, 'platform'),
    P(walls, F.stone, LIME, 'end-walls'),
    P(reliefs, F.paint, 'gothic-shadow', 'reliefs'),
    P(roof, F.paint, 'lp-concrete', 'roof'),
    P(tables, F.paint, 'lp-concrete', 'tables'),
    P(merge(king, cross), F.stone, LIME, 'king'),
    P(merge(queen, coronet), F.stone, LIME, 'queen'),
  ] }
}

export function couchTomb(b, spec = {}) {
  const { c, u, v, L, W } = obOf(b), H = spec.heightM ?? 3.5
  const plinth = slab(mesh(), c, u, L + 0.6, W + 0.6, 0, 0.45)
  const vault = slab(mesh(), c, u, L, W, 0.45, H)
  for (const [a, s] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) slab(vault, add2(add2(c, mul2(u, a * (L / 2 - 0.25))), mul2(v, s * (W / 2 - 0.25))), u, 0.62, 0.62, 0.45, H) // corner pilasters
  const cornice = merge(slab(mesh(), c, u, L + 0.5, W + 0.5, H, H + 0.25), slab(mesh(), c, u, L + 0.7, W + 0.7, H + 0.25, H + 0.4))
  const attic = slab(mesh(), c, u, L * 0.82, W * 0.82, H + 0.4, H + 1.05)
  // the iron door, centred on a long face (spec.doorSide flips it)
  const dir = mul2(v, spec.doorSide ?? 1), face = add2(c, mul2(dir, W / 2)), door = mesh()
  wallPolygon(door, face, left(dir), dir, [[-0.6, 0.45], [0.6, 0.45], [0.6, 2.45], [-0.6, 2.45]], 0.04)
  wallPolygon(door, face, left(dir), dir, [[-0.9, 2.75], [0.9, 2.75], [0.9, 3.15], [-0.9, 3.15]], 0.03) // the COUCH name panel over the door
  // the iron fence round the vault, 1.6 m out: posts every 1.2 m and two rails
  const fence = mesh(), fL = L + 3.2, fW = W + 3.2
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, s]) => add2(add2(c, mul2(u, (a * fL) / 2)), mul2(v, (s * fW) / 2)))
  for (let i = 0; i < 4; i++) {
    const a = corners[i], bq = corners[(i + 1) % 4], len = Math.hypot(bq[0] - a[0], bq[1] - a[1]), t = [(bq[0] - a[0]) / len, (bq[1] - a[1]) / len], n = Math.round(len / 1.2)
    for (let k = 0; k < n; k++) slab(fence, add2(a, mul2(t, (k * len) / n)), t, 0.06, 0.06, 0, 1.3)
    for (const y of [0.2, 1.15]) slab(fence, add2(a, mul2(t, len / 2)), t, len, 0.05, y, y + 0.05)
  }
  return { replace: true, pieces: [], meshes: [
    P(plinth, F.stone, LIME, 'plinth'), P(vault, F.stone, LIME, 'vault'), P(cornice, F.stone, LIME, 'cornice'), P(attic, F.stone, LIME, 'attic'),
    P(door, F.paint, 'tomb-iron', 'door'), P(fence, F.paint, 'tomb-iron', 'fence'),
  ] }
}

export function lilyPool(b, spec = {}) {
  const u = [0, 1], x = [1, 0] // the pool runs north–south (north is −z)
  // on the mapped pond (match.waterOsmId) the ledges follow its real banks and OSM draws the water; otherwise
  // (a synthetic anchor) the builder draws a meandering pool of the given size
  const ringMode = (b.area ?? 0) > 300
  const banks = [], meshes = [], clear = []
  let c = b.centroid, Lp = spec.lengthM ?? 110, Wp = spec.widthM ?? 22
  if (ringMode) {
    const r = b.polygons[0].outer, xs = r.map((p) => p[0]), zs = r.map((p) => p[1])
    c = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2]; Lp = Math.max(...zs) - Math.min(...zs); Wp = Math.max(...xs) - Math.min(...xs)
    for (let i = 0; i < r.length; i++) {
      const p = r[i], q = r[(i + 1) % r.length], t = [q[0] - p[0], q[1] - p[1]], len = Math.hypot(...t)
      if (len < 0.5) continue
      let n = [t[1] / len, -t[0] / len]
      const mid = mul2(add2(p, q), 0.5)
      if (pointInRing(add2(mid, mul2(n, 0.3)), r)) n = mul2(n, -1)
      // ~3 m stones, so the courses run continuously along a long straight bank
      const k = Math.max(1, Math.round(len / 3))
      for (let j = 0; j < k; j++) banks.push([add2(p, mul2(t, j / k)), add2(p, mul2(t, (j + 1) / k)), n])
    }
    // the pond's surface, a hand above the park ground (OSM's pond sits flush with the grass and was lost under it)
    const pool = mesh(), tri = earcut(r.flat()), y = 0.12
    for (let i = 0; i < tri.length; i += 3) { const [a, bb, cc] = [r[tri[i]], r[tri[i + 1]], r[tri[i + 2]]]; slabTri(pool, [a[0], y, a[1]], [bb[0], y, bb[1]], [cc[0], y, cc[1]]) }
    meshes.push(P(pool, F.paint, 'lp-pool', 'pool'))
  } else {
    const N = 28, bankL = [], bankR = []
    for (let i = 0; i <= N; i++) {
      const s = -Lp / 2 + (Lp * i) / N, t = s / Lp
      const hw = (Wp / 2) * (0.55 + 0.45 * Math.sin(Math.PI * (t + 0.5))) * (1 + 0.15 * Math.sin(t * 6.2 * Math.PI))
      const mid = add2(add2(c, mul2(u, s)), mul2(x, 6 * Math.sin(2 * Math.PI * t)))
      bankL.push(add2(mid, mul2(x, -hw))); bankR.push(add2(mid, mul2(x, hw)))
    }
    const pool = mesh()
    for (let i = 0; i < N; i++) {
      const a = bankL[i], bb = bankR[i], cc = bankR[i + 1], d = bankL[i + 1], y = 0.12
      slabQuad(pool, [a[0], y, a[1]], [bb[0], y, bb[1]], [cc[0], y, cc[1]], [d[0], y, d[1]])
      banks.push([bankL[i], bankL[i + 1], [-1, 0]], [bankR[i], bankR[i + 1], [1, 0]])
    }
    meshes.push(P(pool, F.paint, 'lp-pool', 'pool'))
    clear.push([...bankL, ...[...bankR].reverse()])
  }
  // stratified limestone: thin courses stepping back from the water, two to four high
  const ledges = mesh()
  let k = 0
  for (const [p, q, out] of banks) {
    const t = [q[0] - p[0], q[1] - p[1]], len = Math.hypot(...t), tu = [t[0] / len, t[1] / len], courses = 2 + Math.floor(rnd(++k) * 3)
    let y = 0
    for (let j = 0; j < courses; j++) {
      const th = 0.22 + rnd(++k) * 0.16, ln = 2 + rnd(++k) * 2.5, d = 1.2 + rnd(++k) * 0.5
      const at = add2(add2(p, mul2(tu, len / 2 + (rnd(++k) - 0.5) * 0.8)), mul2(out, d / 2 + j * 0.45))
      slab(ledges, at, tu, Math.min(ln, len + 0.6), d, y, y + th)
      y += th
    }
  }
  // the waterfall at the north end: a taller ledge stack with a sheet of water before it
  const north = ringMode ? b.polygons[0].outer.reduce((a, p) => (p[1] < a[1] ? p : a)) : add2(c, mul2(u, -Lp / 2))
  const top = add2(north, mul2(u, -1.5)), falls = mesh()
  let fy = 0
  for (let j = 0; j < 5; j++) { const th = 0.3 + rnd(++k) * 0.1; slab(ledges, add2(top, mul2(u, -j * 0.5)), x, 7 - j * 0.6, 2, fy, fy + th); fy += th }
  slab(falls, add2(top, mul2(u, 1.05)), x, 4.5, 0.12, 0.12, fy - 0.1)
  // Caldwell's pavilion on the east bank: limestone piers under a long, low, deep-eaved roof
  const pav = add2(add2(c, mul2(u, Lp * 0.3)), mul2(x, Wp / 2 + 10)), piers = mesh()
  for (const a of [-4.5, 0, 4.5]) for (const s of [-1.8, 1.8]) slab(piers, add2(add2(pav, mul2(u, a)), mul2(x, s)), u, 0.7, 0.7, 0, 2.5)
  const roof = merge(slab(mesh(), pav, u, 13, 6.6, 2.5, 2.72), slab(mesh(), pav, u, 11, 4.8, 2.72, 2.9))
  // a council ring west of the pool: stone seats in a circle around a fire place
  const cr = add2(add2(c, mul2(u, -Lp * 0.1)), mul2(x, -(Wp / 2 + 11))), ring = mesh()
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2, p = add2(cr, [3.6 * Math.cos(a), 3.6 * Math.sin(a)])
    slab(ring, p, [-Math.sin(a), Math.cos(a)], 1.4, 0.6, 0, 0.45)
  }
  return { replace: true, pieces: [], clear, meshes: [
    ...meshes,
    P(ledges, F.stone, 'lp-ledgestone', 'ledges'),
    P(falls, F.paint, 'lp-falls', 'falls'),
    P(piers, F.stone, LIME, 'pavilion-piers'),
    P(roof, F.paint, 'lp-roof', 'pavilion-roof'),
    P(ring, F.stone, 'lp-ledgestone', 'council-ring'),
  ] }
}
function slabTri(out, a, b, c) {
  const up = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]) > 0
  const [p, q, r] = up ? [a, b, c] : [a, c, b]
  out.positions.push(...p, ...q, ...r); for (let i = 0; i < 3; i++) out.normals.push(0, 1, 0); out.uvs.push(p[0], p[2], q[0], q[2], r[0], r[2])
}
function slabQuad(out, a, b, c, d) {
  const push = (p, q, r) => { out.positions.push(...p, ...q, ...r); for (let i = 0; i < 3; i++) out.normals.push(0, 1, 0); out.uvs.push(p[0], p[2], q[0], q[2], r[0], r[2]) }
  // wind so the face looks up
  const up = (p, q, r) => (q[2] - p[2]) * (r[0] - p[0]) - (q[0] - p[0]) * (r[2] - p[2]) > 0
  if (up(a, b, c)) { push(a, b, c); push(a, c, d) } else { push(a, c, b); push(a, d, c) }
}

export function wavelandClock(b, spec = {}) {
  const { c, u, v, L } = obOf(b), side = spec.sideM ?? 7.5, H = spec.heightM ?? 32
  const at = add2(c, mul2(u, (spec.towerAt ?? 0) * L))
  const tower = slab(mesh(), at, u, side, side, 0, H)
  const quoins = mesh(), bands = mesh()
  for (const [a, s] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) slab(quoins, add2(add2(at, mul2(u, a * (side / 2 - 0.3))), mul2(v, s * (side / 2 - 0.3))), u, 0.75, 0.75, 0, H)
  for (const y of [9, 20]) slab(bands, at, u, side + 0.3, side + 0.3, y, y + 0.45)
  const faces = [u, v, mul2(u, -1), mul2(v, -1)]
  const clock = mesh(), belfry = mesh(), cy = H - 8
  for (const d of faces) {
    const o = add2(at, mul2(d, side / 2)), al = left(d), pts = []
    for (let k = 0; k < 28; k++) { const a = (k / 28) * Math.PI * 2; pts.push([1.6 * Math.cos(a), cy + 1.6 * Math.sin(a)]) }
    wallPolygon(clock, o, al, d, pts, 0.1)
    for (const s of [-1.3, 1.3]) wallPolygon(belfry, o, al, d, [[s - 0.45, H - 5.5], [s + 0.45, H - 5.5], [s + 0.45, H - 2.4], [s, H - 1.7], [s - 0.45, H - 2.4]], 0.06)
  }
  const parapet = mesh()
  for (const d of faces) { const al = left(d); for (let i = 0; i < 4; i++) slab(parapet, add2(add2(at, mul2(d, side / 2 - 0.3)), mul2(al, -side / 2 + 0.95 + i * ((side - 1.9) / 3))), al, 0.8, 0.6, H, H + 1.1) }
  const pinnacles = mesh()
  for (const [a, s] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const p = add2(add2(at, mul2(u, a * (side / 2 - 0.3))), mul2(v, s * (side / 2 - 0.3))); const m = spire({ at: p, base: H, top: H + 5.5, r0: 0.5, sides: 8 }); for (const k of ['positions', 'normals', 'uvs']) pinnacles[k].push(...m[k]) }
  return { meshes: [
    P(tower, F.wall, 'waveland-brick', 'tower'),
    P(merge(quoins, bands), F.stone, LIME, 'quoins'),
    P(clock, F.signal, 'waveland-clock', 'clock'),
    P(belfry, F.paint, 'gothic-shadow', 'belfry'),
    P(parapet, F.stone, LIME, 'parapet'),
    P(pinnacles, F.stone, LIME, 'pinnacles'),
  ] }
}

export const LINCOLN_PARK_BUILDERS = { chessPavilion, couchTomb, lilyPool, wavelandClock }
