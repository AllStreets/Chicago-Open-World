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
import { add2, sub2, mul2, left, len2, norm2, mesh, merge, slab, revolve, ringAround, tri, quad, tube, at3 } from './meshkit.js'
import { frameOf, at, prism, ringBand, offsetRing, edgeNormal, bellRoof, hatch, siteBuilding, siteGreen, into } from './parkkit.js'
import { project } from '../../shared/project.js'
import polygonClipping from 'polygon-clipping'
import { LANDMARK_FACADES as F } from './facadeIds.js'

// close-range detail stays out of LOD1 (the size budget); the silhouette parts draw at every distance
const FINE = new Set(['reliefs', 'tables', 'boards', 'stools', 'piece-reliefs', 'king', 'queen', 'door', 'fence', 'ledges', 'falls', 'council-ring', 'pavilion-piers', 'belfry', 'parapet', 'pinnacles', 'quoins'])
const P = (m, facade, style, part, seed = 0.5) => ({ mesh: m, facade, seed, style, part, lod0Only: FINE.has(part) })
const obOf = (b) => orientedBox(convexHull(b.polygons.flatMap((p) => p.outer)))
const frac = (x) => x - Math.floor(x)
const rnd = (k) => frac(Math.sin(k * 127.1 + 311.7) * 43758.5453)
const LIME = 'lp-limestone'

// a chess piece turned on a lathe: [radius, height] from the foot up
const KING = [[0.55, 0], [0.55, 0.12], [0.38, 0.22], [0.24, 0.5], [0.18, 0.95], [0.3, 1.05], [0.2, 1.15], [0.28, 1.36], [0.001, 1.4]]
const QUEEN = [[0.55, 0], [0.55, 0.12], [0.38, 0.22], [0.24, 0.5], [0.17, 0.92], [0.29, 1.02], [0.19, 1.1], [0.3, 1.32], [0.12, 1.38], [0.001, 1.4]]

// Gilbertson's carved pieces on the end walls, as flat silhouettes [across, up] one unit tall (counter-clockwise):
// the king (his lathe profile mirrored, crowned with a cross) and the knight, its head turned to one side
const KING_RELIEF = (() => {
  const side = KING.slice(0, -1).map(([r, y]) => [r * 0.62, y / 1.75])
  const cross = [[0.05, 1.36 / 1.75], [0.05, 1.47 / 1.75], [0.15, 1.47 / 1.75], [0.15, 1.56 / 1.75], [0.05, 1.56 / 1.75], [0.05, 1]]
  const right = [...side, ...cross]
  return [...right, ...right.slice().reverse().map(([x, y]) => [-x, y])].filter((p, i, a) => i === 0 || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1])
})()
const KNIGHT_RELIEF = [[-0.4, 0], [0.4, 0], [0.4, 0.1], [0.3, 0.16], [0.24, 0.3], [0.14, 0.46], [0.3, 0.56], [0.46, 0.6], [0.48, 0.68], [0.4, 0.76],
  [0.22, 0.86], [0.12, 1], [0.04, 0.92], [-0.14, 0.9], [-0.28, 0.76], [-0.32, 0.55], [-0.26, 0.3], [-0.3, 0.16], [-0.4, 0.1]]

// A silhouette carved in relief: its 2D outline [s along the wall, y up] at `origin`, standing `depth` proud along
// `dir` — a front face and the sides that give it a shadow (geometry, not paint).
export function carvedRelief(out, origin, along, dir, outline, depth) {
  let pts = outline
  const area = pts.reduce((a, p, i) => { const q = pts[(i + 1) % pts.length]; return a + p[0] * q[1] - q[0] * p[1] }, 0)
  if (area < 0) pts = pts.slice().reverse()
  const P3 = ([s, y], d) => [origin[0] + along[0] * s + dir[0] * d, y, origin[1] + along[1] * s + dir[1] * d]
  const tr = earcut(pts.flat()), front = [dir[0], 0, dir[1]]
  for (let i = 0; i < tr.length; i += 3) tri(out, P3(pts[tr[i]], depth), P3(pts[tr[i + 1]], depth), P3(pts[tr[i + 2]], depth), front)
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], t = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(...t)
    if (l < 1e-6) continue
    const n2 = [t[1] / l, -t[0] / l] // outward for a counter-clockwise outline
    quad(out, P3(a, 0), P3(b, 0), P3(b, depth), P3(a, depth), [along[0] * n2[0], n2[1], along[1] * n2[0]])
  }
  return out
}

// Sculpt pass (user, 2026-09-30: "it reads as a plain slab"): the OSM outline is the roof seen from above — a thin
// canopy that cantilevers past two carved limestone end walls and out over the open long sides from a spine of
// slender columns; two rows of stone chess tables (a checkerboard on each, a stool at either side) beneath it; the
// end walls' outer faces carry a giant king and a knight in relief, their inner faces carved game boards.
export function chessPavilion(b, spec = {}) {
  const { c, u, v, L, W } = obOf(b), roofY = spec.roofM ?? 3.0
  const floorY = 0.2, coreY = roofY - 0.14 // the canopy: a 0.16 m rim, deepening to 0.3 m over the walls and spine
  const overEnd = Math.min(1.1, L * 0.06), overSide = Math.min(1.4, W * 0.18), wallT = 0.7
  const wallW = W - 2 * overSide, wallMid = L / 2 - overEnd - wallT / 2, wallOuter = L / 2 - overEnd
  const stone = mesh(), roof = mesh(), tables = mesh(), boards = mesh(), stools = mesh(), reliefs = mesh(), pieces = mesh(), walls = mesh(), cols = mesh(), plinths = mesh()
  const A = (a, s = 0) => add2(add2(c, mul2(u, a)), mul2(v, s))
  slab(stone, c, u, L - 0.4, W - 0.4, 0, floorY)
  // the canopy
  slab(roof, c, u, L, W, roofY, roofY + 0.16)
  slab(roof, c, u, 2 * wallOuter, wallW, coreY, roofY)
  // the slender columns down the spine, between the end walls
  const span = 2 * (wallMid - wallT / 2), n = Math.max(2, Math.round(span / 5) - 1)
  for (let k = 1; k <= n; k++) { const p = A(-span / 2 + (k * span) / (n + 1)); tube(cols, at3(p, floorY), at3(p, coreY), 0.11, 8) }
  // the carved end walls: a knight on one outer face, the king on the other, a game board inside each
  for (const e of [-1, 1]) {
    slab(walls, A(e * wallMid), u, wallT, wallW, floorY, coreY)
    const dir = mul2(u, e), along = mul2(v, e), face = A(e * wallOuter), inner = A(e * (wallOuter - wallT))
    const h = Math.min(2.1, coreY - floorY - 0.5), y0 = floorY + 0.3
    const shape = (e < 0 ? KING_RELIEF : KNIGHT_RELIEF).map(([x, y]) => [x * h, y0 + y * h])
    carvedRelief(pieces, face, along, dir, shape, 0.1)
    // a raised frame round the panel, its field cut back and in shadow so the piece stands out
    const fw = Math.min(wallW - 0.4, h * 1.6), fy0 = floorY + 0.15, fy1 = coreY - 0.15
    wallPolygon(reliefs, face, along, dir, [[-fw / 2, fy0], [fw / 2, fy0], [fw / 2, fy1], [-fw / 2, fy1]], 0.01)
    for (const [s0, s1, a0, a1] of [[-fw / 2, fw / 2, fy0, fy0 + 0.1], [-fw / 2, fw / 2, fy1 - 0.1, fy1], [-fw / 2, -fw / 2 + 0.1, fy0, fy1], [fw / 2 - 0.1, fw / 2, fy0, fy1]]) {
      carvedRelief(pieces, face, along, dir, [[s0, a0], [s1, a0], [s1, a1], [s0, a1]], 0.05)
    }
    const back = mul2(dir, -1), bAlong = mul2(along, -1)
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2 === 0) {
      const s0 = -0.9 + i * 0.45, yb = 1.0 + j * 0.45
      wallPolygon(reliefs, inner, bAlong, back, [[s0, yb], [s0 + 0.45, yb], [s0 + 0.45, yb + 0.45], [s0, yb + 0.45]], 0.02)
    }
  }
  // the chess tables: two rows, one either side of the columns, each with an inlaid board and a stool at either side
  const row = Math.min(1.7, W * 0.23), reach = wallMid - wallT / 2 - 1.1, step = 2.2
  const count = Math.max(1, Math.floor((2 * reach) / step) + 1), first = -((count - 1) * step) / 2
  const STOOL = [[0.17, 0], [0.11, 0.06], [0.11, 0.36], [0.19, 0.4], [0.19, 0.45], [0, 0.45]]
  const topY = 0.76, sq = 0.075
  for (const r of [-row, row]) for (let k = 0; k < count; k++) {
    const t = A(first + k * step, r)
    slab(tables, t, u, 0.3, 0.3, floorY, topY - 0.08); slab(tables, t, u, 0.78, 0.78, topY - 0.08, topY)
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if ((i + j) % 2 === 0) {
      const p = (a, s) => at3(add2(add2(t, mul2(u, (a - 4) * sq)), mul2(v, (s - 4) * sq)), topY + 0.004)
      quad(boards, p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1), [0, 1, 0])
    }
    for (const s of [-0.62, 0.62]) { const m = revolve(A(first + k * step, r + s), STOOL.map(([rr, y]) => [rr, floorY + y]), { sides: 8 }); for (const key of ['positions', 'normals', 'uvs']) stools[key].push(...m[key]) }
  }
  // the king and queen, five feet tall on their plinths, beyond the canopy at opposite corners (clear of the reliefs)
  const at = (e) => A(e * (L / 2 + 1.3), -e * Math.max(0, W / 2 - 0.9))
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
    P(pieces, F.stone, LIME, 'piece-reliefs'),
    P(reliefs, F.paint, 'gothic-shadow', 'reliefs'),
    P(roof, F.paint, 'lp-concrete', 'roof'),
    P(cols, F.paint, 'lp-concrete', 'columns'),
    P(tables, F.stone, LIME, 'tables'),
    P(boards, F.paint, 'gothic-shadow', 'boards'),
    P(stools, F.stone, LIME, 'stools'),
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
    const pool = mesh(), tri = earcut(r.flat()), y = 0.25
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

// ── Lincoln Park Conservatory (Joseph Lyman Silsbee with M. E. Bell, 1890–95; B-2) ─────────────────────────────────
// Four Victorian glass houses on iron frames, white-painted: the Palm House at the front (50 ft, 15.2 m, its tall
// central pavilion over lower wings and a glazed entrance vestibule facing the formal garden), the Fern Room (sunk
// 5.5 ft below grade), the Orchid House and the Show House; propagation ranges behind them; the French formal garden in
// front with the Bates Fountain ("Storks at Play", Saint-Gaudens and MacMonnies, 1887) at its far end. Every house is
// its own hero (its OSM outline); the conservatory's outline carries the ranges, the garden and the fountain.
const GLASS = 'lp-glasshouse', IRON = 'lp-iron-white'
// a Victorian bell: steep at the eave, swelling, then flattening to the crown (fractions of half-width and rise)
const BELL = [[1, 0], [0.985, 0.1], [0.94, 0.22], [0.86, 0.36], [0.74, 0.5], [0.59, 0.63], [0.43, 0.75], [0.27, 0.86], [0.13, 0.95], [0.02, 1]]
const bellProfile = (hw, eave, top, shape = BELL) => shape.map(([f, g]) => [Math.max(0.05, f * hw), eave + g * (top - eave)])
const GLASS_FINE = new Set(['ribs', 'stanchions', 'beds', 'hedges', 'fountain-group', 'reeds', 'rail', 'finials'])
const PG = (m, facade, style, part) => ({ mesh: m, facade, seed: 0.5, style, part, lod0Only: GLASS_FINE.has(part) })

// One glass house over its OSM outline: glass walls on a stone base with white iron stanchions, then each roof in
// spec.roofs — a bell (`top`) over a stadium (`halfW`, `spineHalf`) at frame offset `at` [a along the long axis, s
// across], spine along the long axis (or across, `across: true`), its eave raised on a glazed drum when `eave` is
// above the walls'. Defaults: one bell over the whole frame.
export function glassHouse(b, spec = {}) {
  const ring = b.polygons.reduce((a, p) => (Math.abs(polyArea(p.outer)) > Math.abs(polyArea(a.outer)) ? p : a)).outer
  const fr = frameOf(b), wallH = spec.wallM ?? 4.6, base = spec.baseM ?? 0.7
  const walls = prism(ring, 0, wallH), glass = into(mesh(), walls.walls, walls.top), ribs = mesh(), stone = mesh(), finials = mesh()
  ringBand(stone, ring, 0, base, 0.08)
  ringBand(ribs, ring, wallH - 0.18, wallH + 0.04, 0.06) // the white eave rail
  // stanchions: a white iron upright at every corner and every 1.6 m along each wall
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], c = ring[(i + 1) % ring.length], L = len2(sub2(c, a)), t = norm2(sub2(c, a)), n = edgeNormal(ring, i), k = Math.max(1, Math.round(L / 1.6))
    for (let j = 0; j < k; j++) slab(ribs, add2(add2(a, mul2(t, (j * L) / k)), mul2(n, 0.03)), t, 0.1, 0.08, base, wallH - 0.1)
  }
  const roofs = spec.roofs ?? [{ top: spec.heightM ?? 8 }]
  for (const r of roofs) {
    const ax = r.across ? fr.v : fr.u, len = r.across ? fr.W : fr.L, wid = r.across ? fr.L : fr.W
    const hw = r.halfW ?? wid / 2, sh = r.spineHalf ?? Math.max(0, len / 2 - hw), c = at(fr, ...(r.at ?? [0, 0])), eave = r.eave ?? wallH
    const prof = bellProfile(hw, eave, r.top)
    if (eave > wallH + 0.05) prof.unshift([hw, wallH]) // the glazed drum up to the raised eave
    const bell = bellRoof(c, ax, sh, prof, { K: Math.max(4, Math.round((2 * sh) / 1.8)), M: r.M ?? 12, purlins: eave > wallH + 0.05 ? [0, 1, 4] : [0, 3] })
    into(glass, bell.glass); into(ribs, bell.ribs)
    // a finial at each end of the crown
    for (const e of sh > 0.5 ? [-1, 1] : [0]) into(finials, spire({ at: add2(c, mul2(ax, e * sh)), base: r.top - 0.05, top: r.top + (r.finialM ?? 1.4), r0: 0.12, sides: 6 }))
  }
  return { replace: true, pieces: [], meshes: [
    PG(glass, F.paint, GLASS, 'glass'),
    PG(ribs, F.paint, IRON, 'ribs'),
    PG(stone, F.stone, 'lp-limestone', 'base'),
    PG(finials, F.paint, IRON, 'finials'),
  ] }
}
const polyArea = (r) => r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]; return s + p[0] * q[1] - q[0] * p[1] }, 0) / 2

// The Bates Fountain ("Storks at Play"): a round granite basin, a low pedestal, and the bronze group — three storks
// among bronze reeds with three merboys — at the centre (figures procedural stand-ins, approximate).
export function batesFountain(at0, { r = 6, rim = 0.55 } = {}) {
  const granite = revolve(at0, [[r, 0], [r, rim], [r - 0.45, rim], [r - 0.45, 0.25]], { sides: 40 })
  const water = mesh()
  for (let k = 0; k < 40; k++) {
    const a0 = (k / 40) * Math.PI * 2, a1 = ((k + 1) / 40) * Math.PI * 2, y = 0.36
    tri(water, [at0[0], y, at0[1]], [at0[0] + (r - 0.45) * Math.cos(a1), y, at0[1] + (r - 0.45) * Math.sin(a1)], [at0[0] + (r - 0.45) * Math.cos(a0), y, at0[1] + (r - 0.45) * Math.sin(a0)], [0, 1, 0])
  }
  const pedestal = revolve(at0, [[1.5, 0.2], [1.5, 0.55], [1.0, 0.75], [0.75, 1.3], [1.05, 1.45], [0.001, 1.5]], { sides: 20 })
  const group = mesh(), reeds = mesh()
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.3, d = [Math.cos(a), Math.sin(a)], p = add2(at0, mul2(d, 0.55)), f = [-d[1], d[0]]
    // a stork: legs, a long body tilted up, the S of its neck and the beak raised to spout
    for (const s of [-0.12, 0.12]) tube(group, at3(add2(p, mul2(f, s)), 1.5), at3(add2(p, mul2(f, s * 0.6)), 2.25), 0.04, 5)
    tube(group, at3(add2(p, mul2(d, -0.2)), 2.35), at3(add2(p, mul2(d, 0.35)), 2.65), 0.22, 8)
    tube(group, at3(add2(p, mul2(d, 0.35)), 2.65), at3(add2(p, mul2(d, 0.5)), 3.15), 0.07, 6)
    tube(group, at3(add2(p, mul2(d, 0.5)), 3.15), at3(add2(p, mul2(d, 0.9)), 3.45), 0.04, 5)
    // a merboy between the storks, sitting on the pedestal's edge
    const q = add2(at0, mul2([Math.cos(a + Math.PI / 3), Math.sin(a + Math.PI / 3)], 1.1))
    into(group, revolve(q, [[0.22, 1.45], [0.2, 1.75], [0.14, 2.05], [0.05, 2.1], [0.11, 2.2], [0.001, 2.38]], { sides: 8 }))
    for (let k = 0; k < 4; k++) { const rr = add2(at0, mul2([Math.cos(a + 0.6 + k * 0.25), Math.sin(a + 0.6 + k * 0.25)], 0.85 + 0.1 * k)); tube(reeds, at3(rr, 1.45), at3(add2(rr, mul2(d, 0.15)), 2.4 + 0.25 * (k % 2)), 0.035, 4) }
  }
  return [PG(granite, F.stone, 'plinth-granite', 'basin'), PG(water, F.water, null, 'water'), PG(pedestal, F.stone, 'plinth-granite', 'pedestal'), PG(group, F.bronze, 'statue-bronze', 'fountain-group'), PG(reeds, F.bronze, 'statue-bronze', 'reeds')]
}

// The conservatory's own outline: the propagation ranges (the outline less the four display houses, which are heroes of
// their own) as low ridge-and-furrow glass; the formal garden's beds (OSM leisure=garden ways, spec.garden.beds) as
// clipped hedges round summer bedding; the Bates Fountain at spec.fountain.
export function conservatoryGrounds(b, spec = {}) {
  const ring = b.polygons[0].outer, houses = (spec.houses ?? []).map(siteBuilding).filter(Boolean).map((h) => h.polygons[0].outer)
  const rangeH = spec.rangeM ?? 3.4, rise = 1.0, bay = 3.2, meshes = []
  const close = (r) => [...r, r[0]]
  const parts = houses.length ? polygonClipping.difference([close(ring)], ...houses.map((h) => [close(h)])) : [[close(ring)]]
  const glass = mesh(), ribs = mesh(), stone = mesh()
  for (const [outer] of parts) {
    const r = outer.slice(0, -1)
    if (Math.abs(polyArea(r)) < 30 || orientedBox(r).W < 4) continue // slivers where OSM's house outlines miss the compound's
    const p = prism(r, 0, rangeH, { top: true })
    into(glass, p.walls, p.top); ringBand(stone, r, 0, 0.6, 0.06)
    // ridge-and-furrow: a ridge every 3.2 m along the range's long axis, clipped to its outline
    const ob = orientedBox(r), n = left(ob.u)
    for (const [a, c] of hatch(r, ob.u, bay)) {
      if (len2(sub2(c, a)) < 1.5) continue
      const A = at3(a, rangeH + rise), C = at3(c, rangeH + rise)
      for (const s of [-1, 1]) quad(glass, at3(add2(a, mul2(n, (s * bay) / 2)), rangeH), at3(add2(c, mul2(n, (s * bay) / 2)), rangeH), C, A, [n[0] * s, 1.5, n[1] * s])
      tube(ribs, A, C, 0.06, 4)
    }
  }
  meshes.push(PG(glass, F.paint, GLASS, 'ranges'), PG(ribs, F.paint, IRON, 'ribs'), PG(stone, F.stone, 'lp-limestone', 'base'))
  // the formal garden: hedge-edged beds of summer flowers
  const beds = mesh(), hedges = mesh(), clearPts = []
  for (const id of spec.garden?.beds ?? []) {
    const g = siteGreen(id)
    if (!g) continue
    const r = g.outer, p = prism(offsetRing(r, -0.35), 0.08, 0.32, { top: true })
    into(beds, p.top)
    for (let i = 0; i < r.length; i++) {
      const a = r[i], c = r[(i + 1) % r.length], L = len2(sub2(c, a))
      if (L < 0.5) continue
      const t = norm2(sub2(c, a)), nn = edgeNormal(r, i)
      slab(hedges, add2(mul2(add2(a, c), 0.5), mul2(nn, -0.2)), t, L + 0.3, 0.4, 0.05, 0.6)
    }
    clearPts.push(...r)
  }
  if (beds.positions.length) meshes.push(PG(beds, F.paint, 'lp-flowers', 'beds'), PG(hedges, F.paint, 'lp-hedge', 'hedges'))
  const clear = []
  if (spec.fountain) {
    const fc = project(spec.fountain.lon, spec.fountain.lat)
    meshes.push(...batesFountain(fc, { r: spec.fountain.radiusM ?? 6 }))
    clear.push(ringAround(fc, (spec.fountain.radiusM ?? 6) + 3, 20))
  }
  if (clearPts.length) clear.push(convexHull(clearPts))
  return { replace: true, pieces: [], meshes, clear }
}

export const LINCOLN_PARK_BUILDERS = { chessPavilion, couchTomb, lilyPool, wavelandClock, glassHouse, conservatoryGrounds }
