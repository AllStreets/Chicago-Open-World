// app/src/transit/tunnels.js — the subways' tubes and stations, built from transit.json's route paths (user,
// 2026-09-30: tunnels for every line that goes under, underground stations, a follow cam that rides through them).
// Every route point deeper than the portal mouth gets a concrete tube: floor, walls, ceiling, track bed and rails,
// a lamp every 15 m. Parallel tracks share one wide tube (no wall between them); underground stations get platforms,
// tiled walls, fluorescent strips and name signs. Pure arrays: Tunnels.jsx turns them into two meshes. The ground,
// the water and everything above stay as they are — the tubes sit 4+ m below the surface and face inward.

export const TUNNEL = {
  mouthY: -4.6,   // rail top at the portal headwall (pipeline structure.js PORTAL.mouth): the tube starts here
  half: 3.0,      // wall half-width from a lone track (the headwall's reach: PORTAL.half + thick)
  sideHalf: 5.4,  // in a side-platform station the outer wall steps back to make room
  floorDrop: 0.6, clear: 4.2, // floor under rail top; ceiling over it (PORTAL.clearance)
  joinMax: 10,    // tracks closer than this share one tube
  dedupeM: 0.9,   // routes on the same track draw it once
  endPad: 0.35,   // each segment's box overlaps the next at bends
  lampM: 15,
}
export const STATION = { len: 150, platformAbove: 1.0, edge: 1.65, islandMin: 4.8, islandMax: 12, signEveryM: 25 }

const C = {
  floor: [0.15, 0.145, 0.14], bed: [0.09, 0.085, 0.08], rail: [0.62, 0.6, 0.58], wall: [0.34, 0.33, 0.31], ceiling: [0.2, 0.2, 0.21],
  tile: [0.72, 0.68, 0.56], platform: [0.4, 0.39, 0.37], edge: [0.85, 0.66, 0.05], lamp: [1, 0.93, 0.8], column: [0.6, 0.57, 0.48],
}
const LIT = { tube: 0.28, station: 0.62, lamp: 3.0 } // station walls stay under the bloom threshold; only the lamps glow
const CELL = 24

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const crossY = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

// underground pieces of each route: consecutive points at or below the mouth, clipped where the ramp crosses it
export function undergroundSegments(routes, mouthY = TUNNEL.mouthY) {
  const out = []
  for (const r of routes ?? []) {
    const p = r.path ?? []
    let s = 0
    for (let i = 1; i < p.length; i++) {
      let a = p[i - 1], b = p[i]
      const L = Math.hypot(b[0] - a[0], b[2] - a[2]), s0 = s
      s += L
      if (L < 0.5 || (a[1] > mouthY && b[1] > mouthY)) continue
      let sa = s0, sb = s
      if (a[1] > mouthY || b[1] > mouthY) { // the ramp: keep the deep part
        const f = (mouthY - a[1]) / (b[1] - a[1]), m = [a[0] + (b[0] - a[0]) * f, mouthY, a[2] + (b[2] - a[2]) * f]
        if (a[1] > mouthY) { a = m; sa = s0 + L * f } else { b = m; sb = s0 + L * f }
      }
      const len = Math.hypot(b[0] - a[0], b[2] - a[2])
      if (len < 0.5) continue
      const t = [(b[0] - a[0]) / len, (b[2] - a[2]) / len]
      out.push({ route: r.id, line: r.line, a, b, sa, sb, len, t, r: [-t[1], t[0]], mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2] })
    }
  }
  return out
}

function gridOf(segs) {
  const g = new Map(), key = (i, j) => `${i},${j}`
  const add = (s) => { const k = key(Math.floor(s.mid[0] / CELL), Math.floor(s.mid[2] / CELL)); if (!g.has(k)) g.set(k, []); g.get(k).push(s) }
  const near = (x, z, reach = 1) => {
    const i0 = Math.floor(x / CELL), j0 = Math.floor(z / CELL), out = []
    for (let i = i0 - reach; i <= i0 + reach; i++) for (let j = j0 - reach; j <= j0 + reach; j++) for (const s of g.get(key(i, j)) ?? []) out.push(s)
    return out
  }
  for (const s of segs) add(s)
  return { add, near }
}

// lateral / along offsets of a point from a segment's start, in its frame
const frame = (s, x, z) => { const dx = x - s.a[0], dz = z - s.a[2]; return { u: dx * s.t[0] + dz * s.t[1], w: dx * s.r[0] + dz * s.r[1] } }

export function dedupeSegments(segs, tol = TUNNEL.dedupeM) {
  const kept = [], g = gridOf([])
  for (const s of segs) {
    const dup = g.near(s.mid[0], s.mid[2]).some((k) => Math.abs(k.t[0] * s.t[0] + k.t[1] * s.t[1]) > 0.9 && Math.abs(k.mid[1] - s.mid[1]) < 2 &&
      (({ u, w }) => Math.abs(w) < tol && u > -2 && u < k.len + 2)(frame(k, s.mid[0], s.mid[2])))
    if (!dup) { kept.push(s); g.add(s) }
  }
  return kept
}

// each side of each segment: open to a neighbouring track (shared tube) or walled
export function sideRoom(segs, half = TUNNEL.half, joinMax = TUNNEL.joinMax) {
  const g = gridOf(segs)
  for (const s of segs) {
    s.ext = { 1: half, '-1': half }; s.wall = { 1: true, '-1': true }
    for (const k of g.near(s.mid[0], s.mid[2])) {
      if (k === s || Math.abs(k.t[0] * s.t[0] + k.t[1] * s.t[1]) < 0.7 || Math.abs(k.mid[1] - s.mid[1]) > 3) continue
      const { u, w } = frame(s, k.mid[0], k.mid[2])
      if (u < -k.len / 2 - 1 || u > s.len + k.len / 2 + 1 || Math.abs(w) <= TUNNEL.dedupeM || Math.abs(w) > joinMax) continue
      const side = w > 0 ? 1 : -1, e = Math.abs(w) / 2 + 0.3
      if (s.wall[side] || e < s.ext[side]) { s.ext[side] = e; s.wall[side] = false }
    }
  }
  return segs
}

// stations: the platform plan from the tracks nearest the station point
export function stationPlans(stations, segs) {
  const g = gridOf(segs), plans = []
  for (const st of stations ?? []) {
    if (st.grade !== 'subway') continue
    const cand = g.near(st.x, st.z, 2).map((s) => {
      const { u, w } = frame(s, st.x, st.z)
      return { s, d: Math.hypot(Math.max(0, -u, u - s.len), w) }
    }).filter((c) => c.d < 30).sort((a, b) => a.d - b.d)
    if (!cand.length) continue
    const axis = cand[0].s, t = axis.t, r = axis.r, y = axis.a[1] + (axis.b[1] - axis.a[1]) * Math.max(0, Math.min(1, frame(axis, st.x, st.z).u / axis.len))
    // lateral offsets of the parallel tracks through the station, clustered
    const offs = []
    for (const { s } of cand) {
      if (Math.abs(s.t[0] * t[0] + s.t[1] * t[1]) < 0.9) continue
      const fu = frame(s, st.x, st.z).u, f = Math.max(0, Math.min(1, fu / s.len))
      const px = s.a[0] + (s.b[0] - s.a[0]) * f, pz = s.a[2] + (s.b[2] - s.a[2]) * f
      const w = (px - st.x) * r[0] + (pz - st.z) * r[1]
      if (!offs.some((o) => Math.abs(o - w) < 1.5)) offs.push(w)
    }
    offs.sort((a, b) => Math.abs(a) - Math.abs(b))
    const two = offs.slice(0, 2).sort((a, b) => a - b), gap = two.length === 2 ? two[1] - two[0] : 0
    const kind = gap >= STATION.islandMin && gap <= STATION.islandMax ? 'island' : 'side'
    const tracks = kind === 'island' || (gap > 0 && gap < STATION.islandMin) ? two : [offs[0]] // a lone track: the platform faces the station
    plans.push({ name: st.name, lines: st.lines, c: [st.x, st.z], y, t, r, kind, tracks })
  }
  return plans
}

const inZone = (p, x, z, pad = 0) => {
  const dx = x - p.c[0], dz = z - p.c[1], u = dx * p.t[0] + dz * p.t[1], w = dx * p.r[0] + dz * p.r[1]
  const lo = Math.min(...p.tracks) - 9, hi = Math.max(...p.tracks) + 9
  return Math.abs(u) <= STATION.len / 2 + pad && w >= lo && w <= hi
}

// ── mesh building
function mesher() {
  const pos = [], col = [], s = [], lit = [], idx = []
  // four corners in order around the quad; wound so its face points along `n` (the side you see it from)
  function quad(P, colour, S, L, n) {
    const base = pos.length / 3
    const c = crossY(sub(P[1], P[0]), sub(P[2], P[0]))
    const order = dot3(c, n) >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]
    for (let i = 0; i < 4; i++) { pos.push(...P[i]); col.push(...colour); s.push(S[i]); lit.push(L) }
    for (const o of order) idx.push(base + o)
  }
  return { quad, out: () => ({ position: new Float32Array(pos), color: new Float32Array(col), s: new Float32Array(s), lit: new Float32Array(lit), index: pos.length / 3 > 65535 ? new Uint32Array(idx) : new Uint16Array(idx) }) }
}

const at = (p, r, w, y) => [p[0] + r[0] * w, y, p[2] + r[1] * w]

function tubePiece(m, s, station) {
  const e = TUNNEL.endPad, A = [s.a[0] - s.t[0] * e, s.a[1], s.a[2] - s.t[1] * e], B = [s.b[0] + s.t[0] * e, s.b[1], s.b[2] + s.t[1] * e]
  const S = [s.sa - e, s.sa - e, s.sb + e, s.sb + e], lit = station ? LIT.station : LIT.tube
  const R = s.ext[1], L = s.ext[-1], r = s.r, fa = A[1] - TUNNEL.floorDrop, fb = B[1] - TUNNEL.floorDrop, ca = A[1] + TUNNEL.clear, cb = B[1] + TUNNEL.clear
  const up = [0, 1, 0], down = [0, -1, 0], toLeft = [-r[0], 0, -r[1]], toRight = [r[0], 0, r[1]]
  m.quad([at(A, r, -L, fa), at(A, r, R, fa), at(B, r, R, fb), at(B, r, -L, fb)], C.floor, S, lit, up)
  m.quad([at(A, r, -L, ca), at(A, r, R, ca), at(B, r, R, cb), at(B, r, -L, cb)], C.ceiling, S, lit, down)
  const wallC = station ? C.tile : C.wall
  if (s.wall[1]) m.quad([at(A, r, R, fa), at(B, r, R, fb), at(B, r, R, cb), at(A, r, R, ca)], wallC, S, lit, toLeft)
  if (s.wall[-1]) m.quad([at(A, r, -L, fa), at(B, r, -L, fb), at(B, r, -L, cb), at(A, r, -L, ca)], wallC, S, lit, toRight)
  // track bed (a slab with its two side faces) and the running rails
  const bed = -0.34, ba = A[1] + bed, bb = B[1] + bed
  m.quad([at(A, r, -1.3, ba), at(A, r, 1.3, ba), at(B, r, 1.3, bb), at(B, r, -1.3, bb)], C.bed, S, lit, up)
  m.quad([at(A, r, 1.3, fa), at(B, r, 1.3, fb), at(B, r, 1.3, bb), at(A, r, 1.3, ba)], C.bed, S, lit, toRight)
  m.quad([at(A, r, -1.3, fa), at(B, r, -1.3, fb), at(B, r, -1.3, bb), at(A, r, -1.3, ba)], C.bed, S, lit, toLeft)
  for (const g of [-0.7175, 0.7175]) {
    m.quad([at(A, r, g - 0.035, A[1]), at(A, r, g + 0.035, A[1]), at(B, r, g + 0.035, B[1]), at(B, r, g - 0.035, B[1])], C.rail, S, lit * 1.4, up)
    for (const [d, n] of [[-0.035, toLeft], [0.035, toRight]]) m.quad([at(A, r, g + d, ba), at(B, r, g + d, bb), at(B, r, g + d, B[1]), at(A, r, g + d, A[1])], C.rail, S, lit, n)
  }
  // a ceiling lamp over the track every 15 m (stations have their own strips)
  if (!station) for (let k = Math.ceil(s.sa / TUNNEL.lampM) * TUNNEL.lampM; k < s.sb; k += TUNNEL.lampM) {
    const f = (k - s.sa) / (s.sb - s.sa), p = [s.a[0] + (s.b[0] - s.a[0]) * f, s.a[1] + (s.b[1] - s.a[1]) * f, s.a[2] + (s.b[2] - s.a[2]) * f]
    const y = p[1] + TUNNEL.clear - 0.04, h = 0.7, t = s.t
    const P0 = [p[0] - t[0] * h, y, p[2] - t[1] * h], P1 = [p[0] + t[0] * h, y, p[2] + t[1] * h]
    m.quad([at(P0, r, -0.14, y), at(P0, r, 0.14, y), at(P1, r, 0.14, y), at(P1, r, -0.14, y)], C.lamp, [k, k, k, k], LIT.lamp, down)
  }
}

// a box along the station axis: lateral [w0, w1], along [u0, u1], height [y0, y1]; faces listed by name
function stationBox(m, p, w0, w1, u0, u1, y0, y1, colour, lit, faces) {
  const P = (u, w, y) => [p.c[0] + p.t[0] * u + p.r[0] * w, y, p.c[1] + p.t[1] * u + p.r[1] * w]
  const S = [0, 0, 0, 0], t3 = [p.t[0], 0, p.t[1]], r3 = [p.r[0], 0, p.r[1]], neg = (v) => v.map((x) => -x)
  const F = {
    top: [[P(u0, w0, y1), P(u0, w1, y1), P(u1, w1, y1), P(u1, w0, y1)], [0, 1, 0]],
    bottom: [[P(u0, w0, y0), P(u0, w1, y0), P(u1, w1, y0), P(u1, w0, y0)], [0, -1, 0]],
    right: [[P(u0, w1, y0), P(u1, w1, y0), P(u1, w1, y1), P(u0, w1, y1)], r3],
    left: [[P(u0, w0, y0), P(u1, w0, y0), P(u1, w0, y1), P(u0, w0, y1)], neg(r3)],
    front: [[P(u1, w0, y0), P(u1, w1, y0), P(u1, w1, y1), P(u1, w0, y1)], t3],
    back: [[P(u0, w0, y0), P(u0, w1, y0), P(u0, w1, y1), P(u0, w0, y1)], neg(t3)],
  }
  for (const f of faces) m.quad(F[f][0], colour, S, lit, F[f][1])
}

const CROSS_SIGN_U = (half) => [-half + 20, 0, half - 20]

function stationPiece(m, signs, p, row) {
  const half = STATION.len / 2, y = p.y, top = y + STATION.platformAbove, bedY = y - TUNNEL.floorDrop, ceil = y + TUNNEL.clear
  const lit = LIT.station, ed = STATION.edge
  const slabs = p.kind === 'island'
    ? [[p.tracks[0] + ed, p.tracks[1] - ed, ['left', 'right']]]
    : p.tracks.flatMap((o, i) => { const out = (p.tracks.length === 1 ? (o > 0 ? -1 : 1) : i === 0 ? -1 : 1); return [out < 0 ? [o - TUNNEL.sideHalf + 0.05, o - ed, ['right']] : [o + ed, o + TUNNEL.sideHalf - 0.05, ['left']]] })
  for (const [w0, w1, edges] of slabs) {
    stationBox(m, p, w0, w1, -half, half, bedY, top, C.platform, lit, ['top', 'front', 'back', ...edges])
    for (const e of edges) { // the yellow edge strip, and a fluorescent strip in the ceiling above it
      const we = e === 'left' ? w0 : w1 - 0.4
      stationBox(m, p, we, we + 0.4, -half, half, top, top + 0.01, C.edge, lit, ['top'])
      const wl = e === 'left' ? w0 + 0.3 : w1 - 0.6
      stationBox(m, p, wl, wl + 0.3, -half, half, ceil - 0.05, ceil - 0.04, C.lamp, LIT.lamp, ['bottom'])
    }
    const width = w1 - w0
    if (p.kind === 'island' && width >= 3.2) for (let u = -half + 6; u <= half - 6; u += 9) { // centre columns, clear of the hung signs
      const wc = (w0 + w1) / 2
      if (CROSS_SIGN_U(half).some((su) => Math.abs(su - u) < 4)) continue
      stationBox(m, p, wc - 0.25, wc + 0.25, u - 0.25, u + 0.25, top, ceil, C.column, lit, ['left', 'right', 'front', 'back'])
    }
  }
  // name signs: on the outer walls facing the platform across the tracks, hung over an island facing each track,
  // and hung across the platform facing along it (the ones you read from an arriving train)
  const P = (u, w) => [p.c[0] + p.t[0] * u + p.r[0] * w, p.c[1] + p.t[1] * u + p.r[1] * w]
  const sign = (u, w, n, y0, y1, half) => signs.push({ c: P(u, w), n, y0, y1, half, row })
  const R = (k) => [p.r[0] * k, p.r[1] * k], T = (k) => [p.t[0] * k, p.t[1] * k]
  const outerWalls = p.kind === 'island'
    ? [[p.tracks[0] - TUNNEL.half + 0.04, 1], [p.tracks[1] + TUNNEL.half - 0.04, -1]]
    : slabs.map(([w0, w1, edges]) => (edges[0] === 'right' ? [w0 + 0.04, 1] : [w1 - 0.04, -1]))
  const sy0 = p.kind === 'island' ? y + 1.7 : top + 1.5, sy1 = sy0 + 0.85
  for (let u = -half + 12; u <= half - 12; u += STATION.signEveryM) {
    for (const [w, facing] of outerWalls) sign(u, w, R(facing), sy0, sy1, 2.2)
    if (p.kind === 'island') for (const facing of [-1, 1]) sign(u + STATION.signEveryM / 2, (p.tracks[0] + p.tracks[1]) / 2 + facing * 0.03, R(facing), ceil - 1.25, ceil - 0.45, 2.2)
  }
  for (const [w0, w1] of slabs) for (const u of CROSS_SIGN_U(half)) for (const k of [-1, 1]) {
    const hw = Math.min(1.8, (w1 - w0) / 2 - 0.1)
    if (hw > 0.8) sign(u + k * 0.03, (w0 + w1) / 2, T(k), ceil - 1.3, ceil - 1.3 + hw * 0.38, hw)
  }
}

// the sign quads: an atlas row per station name, read left to right from the side the sign faces (`n`)
export function signQuads(signs, rowsTotal) {
  const pos = [], uv = [], idx = []
  for (const { c, n, y0, y1, half, row } of signs) {
    const ax = [n[1], -n[0]], base = pos.length / 3 // the viewer looks along −n; their right hand is ax
    const v0 = 1 - (row + 1) / rowsTotal, v1 = 1 - row / rowsTotal
    for (const [k, yy, uu, vv] of [[-1, y0, 0, v0], [1, y0, 1, v0], [1, y1, 1, v1], [-1, y1, 0, v1]]) { pos.push(c[0] + ax[0] * half * k, yy, c[1] + ax[1] * half * k); uv.push(uu, vv) }
    const q = (i) => pos.slice((base + i) * 3, (base + i) * 3 + 3), cr = crossY(sub(q(1), q(0)), sub(q(2), q(0)))
    idx.push(...(dot3(cr, [n[0], 0, n[1]]) >= 0 ? [base, base + 1, base + 2, base, base + 2, base + 3] : [base, base + 2, base + 1, base, base + 3, base + 2]))
  }
  return { position: new Float32Array(pos), uv: new Float32Array(uv), index: new Uint16Array(idx) }
}

// the inside of the tubes, for the follow cam: is this point clear of the walls, floor and ceiling?
function roomIndex(segs) {
  const g = gridOf(segs), pad = 0.35
  return (x, y, z) => g.near(x, z).some((s) => {
    const { u, w } = frame(s, x, z)
    if (u < -TUNNEL.endPad || u > s.len + TUNNEL.endPad || w < -s.ext[-1] + (s.wall[-1] ? pad : 0) || w > s.ext[1] - (s.wall[1] ? pad : 0)) return false // open sides run on into the next tube
    const ry = s.a[1] + (s.b[1] - s.a[1]) * Math.max(0, Math.min(1, u / s.len))
    return y > ry - TUNNEL.floorDrop + pad && y < ry + TUNNEL.clear - pad
  })
}

export function buildTunnels(transit) {
  const segs = sideRoom(dedupeSegments(undergroundSegments(transit?.routes)))
  const plans = stationPlans(transit?.stations, segs)
  // side-platform stations push the outer walls back; station walls are tiled and brighter
  for (const s of segs) {
    const p = plans.find((q) => inZone(q, s.mid[0], s.mid[2], 4))
    s.station = !!p
    if (p?.kind === 'side') for (const side of [1, -1]) if (s.wall[side]) s.ext[side] = TUNNEL.sideHalf
  }
  const m = mesher(), signs = []
  for (const s of segs) tubePiece(m, s, s.station)
  const names = [...new Set(plans.map((p) => p.name))]
  plans.forEach((p) => stationPiece(m, signs, p, names.indexOf(p.name)))
  return { segs, plans, names, tube: m.out(), signs: signQuads(signs, Math.max(1, names.length)), inside: roomIndex(segs) }
}

// the tubes the scene is drawing, for the follow cam (Tunnels.jsx registers them)
let active = null
export const setActiveTunnels = (t) => { active = t }
export const activeTunnelRoom = () => active?.inside ?? null
