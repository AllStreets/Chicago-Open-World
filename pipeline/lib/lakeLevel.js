// pipeline/lib/lakeLevel.js — Workstream D5: Lake Michigan at its real level (levels.json LAKE_Y, −4.65 m under the
// lakefront the model flattens to y 0). Which mapped water is at lake level (the harbours that open onto the lake), which
// stays perched (Lincoln Park's ponds and lagoon, D5-2), and how every edge meets the water: stepped limestone
// revetments, harbour walls, Navy Pier's dock face, plain faces on narrow moles, the lock's lake gate (the only place the
// river's level meets the lake's) and beaches that slope into the water. Pure: build-world.js calls these.
import polygonClipping from 'polygon-clipping'
import { pointInRing, ringBBox, openRing, signedArea, ensureCCW } from './geom.js'
import { polyIndex, inPoly, cutMeshOutside, LOCK_TOP } from './riverLevel.js'
import { project } from '../../shared/project.js'

// levels.json → the lake stage's flag and constants. LEVELS_LAKE=0 in the environment builds the lake at the street.
export function lakeLevels(data, env = {}) {
  if (!data?.levels || env.LEVELS_LAKE === '0' || !Number.isFinite(data.levels.LAKE_Y)) return null
  return { lake: data.levels.LAKE_Y }
}

const close = (r) => [...r, r[0]]
const rings = (p) => [p.outer, ...(p.holes ?? [])]
const bboxOf = (p) => p.bbox ?? (p.bbox = ringBBox(p.outer))
const segDist = (p, a, b) => {
  const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)) : 0
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz)
}
const areaOf = (p) => Math.abs(signedArea(p.outer)) - (p.holes ?? []).reduce((t, h) => t + Math.abs(signedArea(h)), 0)

// ── Which water is where ─────────────────────────────────────────────────────────────────────────────────────────
// Perched (D5-2): ponds and lagoons of at least minAreaM2, never a fountain, never the river system.
export function isPerchedPond(p, ponds) {
  if (p.tags?._sunk || /fountain/i.test(p.tags?.name ?? '')) return false
  return ponds.types.includes(p.tags?.water) && areaOf(p) >= ponds.minAreaM2
}

// Lake-level water: the mapped water (not the river system, not a perched pond, not a raised pool) that touches the lake
// side of the shore, and whatever touches that in turn (DuSable Harbor opens off Monroe Harbor).
export function lakeWaterOf(water, lakeSide, { ponds, touchM = 5 }) {
  const lIdx = polyIndex(lakeSide)
  const can = (p) => !p.tags?._sunk && !isPerchedPond(p, ponds) && !(Number(p.tags?.layer) > 0) && !p.tags?.amenity && !/fountain|pool/i.test(p.tags?.name ?? '') && areaOf(p) > 2000
  const touches = (p, idx) => rings(p).some((r) => r.some((v, i) => {
    const w = r[(i + 1) % r.length], n = Math.max(1, Math.ceil(Math.hypot(w[0] - v[0], w[1] - v[1]) / 4))
    for (let k = 0; k < n; k++) { const q = [v[0] + ((w[0] - v[0]) * k) / n, v[1] + ((w[1] - v[1]) * k) / n]; if (idx.near(q, touchM)) return true }
    return false
  }))
  const out = water.filter((p) => can(p) && touches(p, lIdx))
  let grew = true
  while (grew) {
    grew = false
    const oIdx = polyIndex(out)
    for (const p of water) if (!out.includes(p) && can(p) && touches(p, oIdx)) { out.push(p); grew = true }
  }
  return out
}

// ── Nearest-edge distances (beaches) ─────────────────────────────────────────────────────────────────────────────────
export function edgeIndex(segs, cell = 25) {
  const g = new Map(), key = (i, j) => `${i},${j}`
  for (const s of segs) {
    const [a, b] = s
    for (let i = Math.floor(Math.min(a[0], b[0]) / cell); i <= Math.floor(Math.max(a[0], b[0]) / cell); i++) for (let j = Math.floor(Math.min(a[1], b[1]) / cell); j <= Math.floor(Math.max(a[1], b[1]) / cell); j++) {
      const k = key(i, j); if (!g.has(k)) g.set(k, []); g.get(k).push(s)
    }
  }
  // the nearest segment within maxR (Infinity when none)
  const nearest = ([x, z], maxR) => {
    let best = Infinity
    const R = Math.ceil(maxR / cell)
    for (let ring = 0; ring <= R; ring++) {
      if (best <= (ring - 1) * cell) break // nothing in a farther ring of cells can be nearer
      for (let ci = Math.floor(x / cell) - ring; ci <= Math.floor(x / cell) + ring; ci++) for (let cj = Math.floor(z / cell) - ring; cj <= Math.floor(z / cell) + ring; cj++) {
        if (Math.max(Math.abs(ci - Math.floor(x / cell)), Math.abs(cj - Math.floor(z / cell))) !== ring) continue
        for (const [a, b] of g.get(key(ci, cj)) ?? []) best = Math.min(best, segDist([x, z], a, b))
      }
    }
    return best <= maxR ? best : Infinity
  }
  return { nearest }
}

// ── Edges and how they meet the water ─────────────────────────────────────────────────────────────────────────────────
// Sample every edge of the lake-level water every ≤ 2 m just outside itself and say what is there:
//   more lake-level water → nothing · a beach → nothing (the sand slopes in) · the river system → 'gate' (the Harbor
//   Lock's lake gate; anywhere else is an error the build reports) · land → a profile: 'pier' inside a pier zone,
//   'mole' where the land is narrower than moleWidthM or is a perched pond's weir, 'harbour' on a harbour, else 'revetment'.
// Returns chains: runs of consecutive points of one kind, each point with its seaward unit normal.
export const PROBE = 0.6
export function shoreChains({ lakeWater, sunk = [], ponds = [], beaches = [], zones = [], moleWidthM = 18, within = null, isHarbour = (p) => p.tags?.water === 'harbour' }) {
  const lwIdx = polyIndex(lakeWater), sIdx = polyIndex(sunk), pIdx = polyIndex(ponds), bIdx = polyIndex(beaches)
  const zoneAt = (pt) => zones.find((z) => pt[0] >= z.minX && pt[0] <= z.maxX && pt[1] >= z.minZ && pt[1] <= z.maxZ)
  const chains = [], contacts = []
  const classify = (pt, seaward, owner) => {
    if (lwIdx.find(pt)) return null
    if (bIdx.find(pt)) return null
    const s = sIdx.find(pt)
    if (s) { contacts.push({ pt, water: s }); return 'gate' }
    if (pIdx.find(pt)) return 'mole'
    const z = zoneAt(pt)
    if (z) return z.profile
    // narrow land: lake-level water again within moleWidthM behind the edge
    const wet = (q) => lwIdx.find(q) || sIdx.find(q)
    const back = [pt[0] - seaward[0] * moleWidthM, pt[1] - seaward[1] * moleWidthM]
    if (wet(back)) return 'mole'
    // a mole's tip: water on both sides within its width
    const h = moleWidthM, side = [-seaward[1] * h, seaward[0] * h]
    if (wet([pt[0] + side[0], pt[1] + side[1]]) && wet([pt[0] - side[0], pt[1] - side[1]])) return 'mole'
    return isHarbour(owner) ? 'harbour' : 'revetment'
  }
  for (const p of lakeWater) for (const r of rings(p)) {
    const pts = [] // [point, kind of the stretch that starts here, seaward normal]
    for (let i = 0; i < r.length; i++) {
      const a = r[i], b = r[(i + 1) % r.length], L = Math.hypot(b[0] - a[0], b[1] - a[1])
      if (L < 0.05) continue
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
      let n = [(b[1] - a[1]) / L, -(b[0] - a[0]) / L] // flipped below to point out of the water (toward land)
      if (inPoly([m[0] + n[0] * PROBE * 0.5, m[1] + n[1] * PROBE * 0.5], p)) n = [-n[0], -n[1]]
      const sea = [-n[0], -n[1]]
      const k = Math.max(1, Math.ceil(L / 2)), at = (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
      let cur
      for (let j = 0; j < k; j++) {
        const c = at((j + 0.5) / k)
        const inside = !within || (c[0] >= within.minX && c[0] <= within.maxX && c[1] >= within.minZ && c[1] <= within.maxZ)
        const kind = inside ? classify([c[0] + n[0] * PROBE, c[1] + n[1] * PROBE], sea, p) : null
        if (j === 0 || kind !== cur) { pts.push([at(j / k), kind, sea]); cur = kind }
      }
    }
    if (!pts.length) continue
    // chains: maximal stretches of one kind, wrapping round the ring
    let start = pts.findIndex((q, i) => q[1] !== pts[(i - 1 + pts.length) % pts.length][1])
    if (start < 0) { if (pts[0][1]) chains.push({ kind: pts[0][1], pts: [...pts, pts[0]].map((q) => ({ p: q[0], sea: q[2] })), closed: true, owner: p }); continue }
    for (let c = 0; c < pts.length;) {
      const i0 = (start + c) % pts.length, kind = pts[i0][1]
      const seq = []
      let j = c
      while (j < pts.length && pts[(start + j) % pts.length][1] === kind) { seq.push(pts[(start + j) % pts.length]); j++ }
      const end = pts[(start + j) % pts.length] // the next stretch's first point closes this one
      if (kind) chains.push({ kind, pts: [...seq.map((q) => ({ p: q[0], sea: q[2] })), { p: end[0], sea: seq[seq.length - 1][2] }], closed: false, owner: p })
      c = j
    }
  }
  return { chains, contacts }
}

// lat/lon zone boxes (data/shore.json) → model-space boxes
export const zoneBoxes = (zones) => zones.map((z) => { const [x0, z0] = project(z.w, z.n), [x1, z1] = project(z.e, z.s); return { ...z, minX: x0, maxX: x1, minZ: z0, maxZ: z1 } })

// A profile (data/shore.json points: [seaward m, metres above the lake, layer]) → absolute [d, y, layer] from the edge top.
export const EDGE_TOP = 0.12 // the ground layers' height: the profile's top meets the park and the trail with no seam
export function profileAt(spec, lakeY, top = EDGE_TOP) {
  return [[0, top, null], ...spec.points.map(([d, h, layer]) => [d, lakeY + h, layer])]
}

// Chains → meshes per ground layer: the profile swept along the chain with mitred corners (capped at 3×) and an end cap
// (the profile's cross-section, filled down to its bottom) where an open chain stops. uv: treads world xz, faces
// (distance along, height).
export function sweepChains(chains, profiles, lakeY) {
  const out = {}
  const M = (layer) => (out[layer] ??= { positions: [], normals: [], uvs: [] })
  const push = (layer, P, N, U) => { const m = M(layer); for (let k = 0; k < 3; k++) { m.positions.push(...P[k]); m.normals.push(...N); m.uvs.push(...U[k]) } }
  const tri = (layer, a, b, c, want, ua, ub, uc) => {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
    let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]
    const l = Math.hypot(...n)
    if (l < 1e-9) return
    n = n.map((v) => v / l)
    if (n[0] * want[0] + n[1] * want[1] + n[2] * want[2] < 0) { push(layer, [a, c, b], n.map((v) => -v), [ua, uc, ub]); return }
    push(layer, [a, b, c], n, [ua, ub, uc])
  }
  for (const ch of chains) {
    const prof = profiles[ch.kind]
    if (!prof) continue
    const P = ch.pts, n = P.length
    if (n < 2) continue
    // seaward direction of segment j, and the mitre at each point
    const segSea = []
    for (let j = 0; j < n - 1; j++) {
      const a = P[j].p, b = P[j + 1].p, L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
      let s = [-(b[1] - a[1]) / L, (b[0] - a[0]) / L]
      if (s[0] * P[j].sea[0] + s[1] * P[j].sea[1] < 0) s = [-s[0], -s[1]]
      segSea.push(s)
    }
    const mit = P.map((_, i) => {
      const s0 = segSea[Math.max(0, i - 1)] ?? segSea[0], s1 = segSea[Math.min(n - 2, i)] ?? s0
      const prevS = ch.closed && i === 0 ? segSea[n - 2] : s0, nextS = ch.closed && i === n - 1 ? segSea[0] : s1
      let mx = prevS[0] + nextS[0], mz = prevS[1] + nextS[1]
      const ml = Math.hypot(mx, mz)
      if (ml < 1e-6) return nextS
      mx /= ml; mz /= ml
      const k = Math.min(3, 1 / Math.max(1 / 3, mx * nextS[0] + mz * nextS[1]))
      return [mx * k, mz * k]
    })
    const along = [0]
    for (let j = 1; j < n; j++) along.push(along[j - 1] + Math.hypot(P[j].p[0] - P[j - 1].p[0], P[j].p[1] - P[j - 1].p[1]))
    const at = (i, d, y) => [P[i].p[0] + mit[i][0] * d, y, P[i].p[1] + mit[i][1] * d]
    for (let s = 1; s < prof.length; s++) {
      const [d0, y0] = prof[s - 1], [d1, y1, layer] = prof[s]
      const tread = Math.abs(y1 - y0) < 1e-6
      for (let j = 0; j < n - 1; j++) {
        const A = at(j, d0, y0), B = at(j + 1, d0, y0), C = at(j + 1, d1, y1), D = at(j, d1, y1)
        const ss = segSea[j], dd = d1 - d0, dy = y1 - y0, l = Math.hypot(dd, dy) || 1
        const want = [ss[0] * (-dy / l), dd / l, ss[1] * (-dy / l)] // up and out of the profile
        const uv = tread ? (p) => [p[0], p[2]] : (p, i) => [along[i], p[1]]
        tri(layer, A, B, C, want, uv(A, j), uv(B, j + 1), uv(C, j + 1))
        tri(layer, A, C, D, want, uv(A, j), uv(C, j + 1), uv(D, j))
      }
    }
    if (!ch.closed) {
      // end caps: the cross-section as a filled polygon (profile + straight back down to the bottom at d = 0)
      const bottom = prof[prof.length - 1][1]
      for (const [i, dir] of [[0, -1], [n - 1, 1]]) {
        const sj = segSea[Math.min(n - 2, Math.max(0, i - 1))], along3 = [-sj[1] * dir, 0, sj[0] * dir]
        const t = [-sj[1], sj[0]] // along the chain (sign-free: the cap faces outward by `want`)
        const want = [along3[0], 0, along3[2]]
        const pts = prof.map(([d, y]) => at(i, d, y))
        pts.push(at(i, 0, bottom))
        void t
        for (let k = 1; k + 1 < pts.length; k++) tri('dockwall', pts[0], pts[k], pts[k + 1], want, [0, pts[0][1]], [prof[Math.min(k, prof.length - 1)][0], pts[k][1]], [0, pts[k + 1][1]])
      }
    }
  }
  return out
}

// a flat vertical quad along a chain (the lock's lake gate): top → bottom, facing the lake
export function gateWalls(chains, { top = LOCK_TOP, bottom }) {
  const prof = [[0, top, null], [0, bottom, 'dockwall']]
  return sweepChains(chains.filter((c) => c.kind === 'gate').map((c) => ({ ...c, kind: 'g', closed: true })), { g: prof }, bottom)
}

// ── Beaches slope into the lake ────────────────────────────────────────────────────────────────────────────────────
// Beach edges, each classified by what lies just outside: lake water (the shoreline), another beach (an inner seam) or
// land (the trail side and the ends). The height at a point is f(t), t = dWater / (dWater + dLand): the beach layer's
// height on the land side, `waterlineBelowM` under the lake at the shoreline; inside the water it keeps going down.
export function beachSlope({ beaches, lakeWater, lakeY, top, spec }) {
  const lwIdx = polyIndex(lakeWater), bIdx = polyIndex(beaches)
  const waterSegs = [], landSegs = []
  for (const p of lakeWater) for (const r of rings(p)) for (let i = 0; i < r.length; i++) waterSegs.push([r[i], r[(i + 1) % r.length]])
  for (const p of beaches) for (const r of rings(p)) for (let i = 0; i < r.length; i++) {
    const a = r[i], b = r[(i + 1) % r.length], L = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (L < 0.01) continue
    const k = Math.max(1, Math.ceil(L / 4))
    for (let j = 0; j < k; j++) {
      const a1 = [a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k], b1 = [a[0] + ((b[0] - a[0]) * (j + 1)) / k, a[1] + ((b[1] - a[1]) * (j + 1)) / k]
      const m = [(a1[0] + b1[0]) / 2, (a1[1] + b1[1]) / 2], n = [(b1[1] - a1[1]) / (L / k), -(b1[0] - a1[0]) / (L / k)]
      const o1 = [m[0] + n[0] * PROBE, m[1] + n[1] * PROBE], o2 = [m[0] - n[0] * PROBE, m[1] - n[1] * PROBE]
      // the side of the edge that is not this beach
      const o = inPoly(o1, p) ? o2 : o1
      if (lwIdx.find(o)) continue
      if (bIdx.find(o)) continue
      landSegs.push([a1, b1])
    }
  }
  const W = edgeIndex(waterSegs), Lnd = edgeIndex(landSegs)
  const low = lakeY - spec.waterlineBelowM, reach = spec.reachM
  const y = ([x, z]) => {
    const dW = W.nearest([x, z], reach)
    if (!Number.isFinite(dW)) return top
    if (lwIdx.find([x, z])) return low - 0.1 * dW
    const dL = Lnd.nearest([x, z], reach)
    const t = Number.isFinite(dL) ? (dW + dL > 1e-6 ? dW / (dW + dL) : 0) : Math.min(1, dW / reach)
    return low + (top - low) * Math.pow(Math.max(0, Math.min(1, t)), spec.exponent)
  }
  return { y, landSegs, waterSegs }
}

// re-height a flat mesh's vertices by y(x, z)
export function drape(m, yAt) {
  for (let i = 0; i < m.positions.length; i += 3) m.positions[i + 1] = yAt([m.positions[i], m.positions[i + 2]])
  return m
}

// The beach's land-side edges where the sand sits below the land beside it (the ends of a beach band, an OSM beach's
// back edge): a vertical face from the land's height down to the sand.
export function beachRisers(landSegs, yAt, { top, faceUp = 0.12 }) {
  const m = { positions: [], normals: [], uvs: [] }
  for (const [a, b] of landSegs) {
    const ya = yAt(a), yb = yAt(b)
    if (ya > top - 0.03 && yb > top - 0.03) continue
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    const P = [[a[0], faceUp, a[1]], [b[0], faceUp, b[1]], [b[0], yb, b[1]], [a[0], ya, a[1]]]
    // faces both ways (it is seen from the sand; from the land side it is behind the ground)
    // a vertical face: its normal is horizontal, square to the edge; one side wound for each normal
    const side = [-(b[1] - a[1]) / L, (b[0] - a[0]) / L]
    for (const [order, sg] of [[[0, 1, 2, 0, 2, 3], 1], [[0, 2, 1, 0, 3, 2], -1]]) {
      const e1 = [P[order[1]][0] - P[order[0]][0], P[order[1]][1] - P[order[0]][1], P[order[1]][2] - P[order[0]][2]], e2 = [P[order[2]][0] - P[order[0]][0], P[order[2]][1] - P[order[0]][1], P[order[2]][2] - P[order[0]][2]]
      const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]
      const nn = cr[0] * side[0] + cr[2] * side[1] >= 0 ? [side[0], 0, side[1]] : [-side[0], 0, -side[1]]
      void sg
      for (const k of order) { m.positions.push(...P[k]); m.normals.push(...nn); m.uvs.push(k === 0 || k === 3 ? 0 : L, P[k][1]) }
    }
  }
  return m
}

// ── Perched ponds (D5-2) ────────────────────────────────────────────────────────────────────────────────────────────
// Offset a ring toward one side by d (mitre capped at 2d): into the water for an outer ring, out into it round an island.
function offsetRing(ring, d, intoRing) {
  const r = ensureCCW(ring), n = r.length, sgn = intoRing ? 1 : -1
  const inward = (a, b) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(-(b[1] - a[1]) / l) * sgn, ((b[0] - a[0]) / l) * sgn] }
  return r.map((p, i) => {
    const n0 = inward(r[(i - 1 + n) % n], p), n1 = inward(p, r[(i + 1) % n])
    let bx = n0[0] + n1[0], bz = n0[1] + n1[1]
    const bl = Math.hypot(bx, bz) || 1
    bx /= bl; bz /= bl
    const m = Math.min(2 * d, d / Math.max(0.2, bx * n1[0] + bz * n1[1]))
    return { from: p, to: [p[0] + bx * m, p[1] + bz * m] }
  })
}
// the pond's water height, and a sloped bank from the ground at the edge to bankBelowM under the water
export function pondBank(p, { bankY, spec }) {
  const waterY = bankY - spec.dropM, bottom = waterY - spec.bankBelowM
  const w = Math.min(spec.bankM, Math.sqrt(areaOf(p)) / 8)
  const m = { positions: [], normals: [], uvs: [] }
  rings(p).forEach((r, ri) => {
    const off = offsetRing(r, w, ri === 0)
    for (let i = 0; i < off.length; i++) {
      const A = off[i], B = off[(i + 1) % off.length]
      const P = [[A.from[0], bankY, A.from[1]], [B.from[0], bankY, B.from[1]], [B.to[0], bottom, B.to[1]], [A.to[0], bottom, A.to[1]]]
      const e1 = [P[1][0] - P[0][0], 0, P[1][2] - P[0][2]], e2 = [P[3][0] - P[0][0], P[3][1] - P[0][1], P[3][2] - P[0][2]]
      let nn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]
      if (nn[1] < 0) nn = nn.map((v) => -v)
      const l = Math.hypot(...nn) || 1
      nn = nn.map((v) => v / l)
      const want = nn
      for (const tri of [[0, 1, 2], [0, 2, 3]]) {
        let t = tri
        const a = P[t[0]], b = P[t[1]], c = P[t[2]]
        const cr = [(b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])]
        if (cr[0] * want[0] + cr[1] * want[1] + cr[2] * want[2] < 0) t = [t[0], t[2], t[1]]
        for (const k of t) { m.positions.push(...P[k]); m.normals.push(...nn); m.uvs.push(P[k][0], P[k][2]) }
      }
    }
  })
  return { waterY, mesh: m }
}

// ── Ground over the lake ─────────────────────────────────────────────────────────────────────────────────────────────
// Street-level ground (parks, paths, the trail) that OSM draws past the shoreline would float over the sunken lake: cut
// off at the water. Only the triangles that reach the water are clipped (the rest pass untouched).
export function cutAtWater(m, idx, nearPolys) {
  if (!m.positions.length || !nearPolys.length) return m
  const keep = { positions: [], normals: [], uvs: [] }, mixed = { positions: [], normals: [], uvs: [] }
  const P = m.positions
  for (let t = 0; t < P.length / 9; t++) {
    const v = [0, 1, 2].map((k) => [P[t * 9 + k * 3], P[t * 9 + k * 3 + 2]])
    const r = Math.max(Math.hypot(v[1][0] - v[0][0], v[1][1] - v[0][1]), Math.hypot(v[2][0] - v[0][0], v[2][1] - v[0][1]), Math.hypot(v[2][0] - v[1][0], v[2][1] - v[1][1]))
    const wet = v.map((q) => Boolean(idx.find(q))), near = v.some((q) => idx.nearEdge(q, r + 0.01))
    if (!near && wet.every(Boolean)) continue // wholly in the water
    const dst = near || wet.some(Boolean) ? mixed : keep
    for (let k = 0; k < 3; k++) { dst.positions.push(...m.positions.slice(t * 9 + k * 3, t * 9 + k * 3 + 3)); dst.normals.push(...m.normals.slice(t * 9 + k * 3, t * 9 + k * 3 + 3)); dst.uvs.push(...m.uvs.slice(t * 6 + k * 2, t * 6 + k * 2 + 2)) }
  }
  if (mixed.positions.length) {
    const cut = cutMeshOutside(mixed, nearPolys)
    // a sliver the clipper leaves can carry a non-finite uv (its barycentrics divide by ~0): drop it
    for (let t = 0; t < cut.positions.length / 9; t++) {
      const P9 = cut.positions.slice(t * 9, t * 9 + 9), U6 = cut.uvs.slice(t * 6, t * 6 + 6)
      if (!P9.every(Number.isFinite) || !U6.every(Number.isFinite)) continue
      keep.positions.push(...P9); keep.normals.push(...cut.normals.slice(t * 9, t * 9 + 9)); keep.uvs.push(...U6)
    }
  }
  return keep
}

// lake-level water clipped to a box (a tile, grown a little), for cutAtWater
export function waterNear(polys, { minX, minZ, maxX, maxZ }, pad = 30) {
  const rect = [[[minX - pad, minZ - pad], [maxX + pad, minZ - pad], [maxX + pad, maxZ + pad], [minX - pad, maxZ + pad], [minX - pad, minZ - pad]]]
  const out = []
  for (const p of polys) {
    const b = bboxOf(p)
    if (b.maxX < minX - pad || b.minX > maxX + pad || b.maxZ < minZ - pad || b.minZ > maxZ + pad) continue
    let res
    try { res = polygonClipping.intersection([close(p.outer), ...(p.holes ?? []).map(close)], rect) } catch { continue }
    for (const [outer, ...holes] of res) { const o = openRing(outer); if (o.length >= 3) out.push({ outer: o, holes: holes.map(openRing), bbox: ringBBox(o) }) }
  }
  return out
}

// ── Buildings at the water ─────────────────────────────────────────────────────────────────────────────────────────
// Breakwaters stand in the lake: from under the water to aboveLakeM over it.
export function lowerBreakwaters(buildings, { lakeY, spec }) {
  let n = 0
  for (const b of buildings) {
    if (b.source !== 'osm-breakwater') continue
    const base = lakeY - spec.belowLakeM, top = lakeY + spec.aboveLakeM
    b.pieces = b.pieces.map((p) => ({ ...p, base, top }))
    b.height = top; n++
  }
  return n
}
// A building out over the lake-level water runs down to it; one on a sloping beach runs down to the sand under it (its
// lowest point). Returns how many were lowered.
export function lakeSkirts(buildings, { waterIdx, lakeY, beachY = null, beachIdx = null }) {
  let n = 0
  for (const b of buildings) {
    if (!b.polygons?.length || b.source === 'park' || b.source === 'pond' || b.source === 'osm-breakwater') continue
    const pts = b.polygons.flatMap((p) => [p.outer, ...(p.holes ?? [])]).flatMap((r) => r.flatMap((a, i) => {
      const c = r[(i + 1) % r.length], k = Math.max(1, Math.ceil(Math.hypot(c[0] - a[0], c[1] - a[1]) / 2))
      return Array.from({ length: k }, (_, j) => [a[0] + ((c[0] - a[0]) * j) / k, a[1] + ((c[1] - a[1]) * j) / k])
    }))
    let base = 0
    // only a footprint that reaches out over the water runs down to it: one standing back from the edge is screened by the
    // revetment's top face, and a skirt would hang its façade down to the waterline
    if (pts.some((pt) => waterIdx.find(pt))) base = lakeY - 0.5
    else if (beachY && beachIdx && pts.some((pt) => beachIdx.near(pt, 1))) base = Math.min(0, ...pts.map((pt) => beachY(pt))) - 0.2
    if (base > -0.25) continue
    b.lakeBase = base; n++
    if (b.pieces?.length) b.pieces = b.pieces.map((p) => ((p.base ?? 0) <= 0.01 ? { ...p, base } : p))
  }
  return n
}

void pointInRing
