// pipeline/lib/sacred.js — churches, cathedrals, Orthodox domes, mosques, synagogues, temples.
// OSM rarely models their towers, so a rule shapes them: stone walls to the eave, a gabled roof over the
// footprint's oriented box, and the tradition's crown — a steepled tower on the street end, onion domes,
// or a dome with a minaret. Mapped parts and tall towers keep their geometry and only change material.
import { convexHull } from './venue.js'
import { drum, spire, pyramid } from './crowns.js'
import { signedArea } from './geom.js'
import { hashSeed } from './buildings.js'

export const SACRED = { walls: 19, roofing: 20 }
export const SACRED_STYLE = {
  walls: { limestone: 0.1, brick: 0.35, graystone: 0.6, yellowbrick: 0.85 },
  roofing: { slate: 0.1, copper: 0.35, gold: 0.6, terracotta: 0.85 },
}
const MAX_SHAPED_HEIGHT = 45

// Only buildings typed as a house of worship are reshaped. A building=yes storefront that hosts a
// congregation stays a storefront (Phase 2.5 ruling), unless data/sacred.json names it explicitly.
export function sacredKind(tags = {}, { override = null } = {}) {
  const t = tags.building, rel = (tags.religion || '').toLowerCase(), den = (tags.denomination || '').toLowerCase(), name = tags.name || ''
  const typed = ['church', 'cathedral', 'chapel', 'mosque', 'synagogue', 'temple', 'shrine'].includes(t)
  if (!typed && !override) return null
  if (t === 'mosque' || rel === 'muslim' || rel === 'islam' || /masjid|mosque/i.test(name)) return 'mosque'
  if (t === 'synagogue' || rel === 'jewish') return 'synagogue'
  if (t === 'temple' || ['buddhist', 'hindu', 'sikh', 'jain'].includes(rel)) return 'temple'
  if (/orthodox|greek_catholic|byzantine/.test(den) || /orthodox|ukrainian|byzantine/i.test(name)) return 'orthodox'
  if (t === 'cathedral' || /cathedral|basilica/i.test(name)) return 'cathedral'
  return 'church'
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]]
const add = (a, b) => [a[0] + b[0], a[1] + b[1]]
const mul = (a, s) => [a[0] * s, a[1] * s]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1]

// Minimum-area oriented rectangle: centre, long axis u, short axis v, lengths L ≥ W.
export function orientedBox(ring) {
  const h = convexHull(ring)
  let best = null
  for (let i = 0; i < h.length; i++) {
    const e = sub(h[(i + 1) % h.length], h[i]), l = Math.hypot(...e)
    if (l < 1e-9) continue
    const u = mul(e, 1 / l), v = [-u[1], u[0]]
    const pu = h.map((p) => dot(p, u)), pv = h.map((p) => dot(p, v))
    const a0 = Math.min(...pu), a1 = Math.max(...pu), b0 = Math.min(...pv), b1 = Math.max(...pv)
    const area = (a1 - a0) * (b1 - b0)
    if (!best || area < best.area - 1e-9) best = { area, u, v, c: add(mul(u, (a0 + a1) / 2), mul(v, (b0 + b1) / 2)), L: a1 - a0, W: b1 - b0 }
  }
  if (best.W > best.L) best = { ...best, u: best.v, v: [-best.v[1], best.v[0]], L: best.W, W: best.L }
  return best
}

const mesh = () => ({ positions: [], normals: [], uvs: [] })
function tri(out, a, b, c, want, ua = [0, 0], ub = [0, 0], uc = [0, 0]) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
  let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
  const l = Math.hypot(...n)
  if (l < 1e-9) return
  if (n[0] * want[0] + n[1] * want[1] + n[2] * want[2] < 0) { [b, c] = [c, b]; [ub, uc] = [uc, ub]; n = n.map((x) => -x) }
  for (const [p, t] of [[a, ua], [b, ub], [c, uc]]) { out.positions.push(...p); out.normals.push(n[0] / l || 0, n[1] / l || 0, n[2] / l || 0); out.uvs.push(...t) }
}

// Gabled roof over the oriented box (slopes + gable-end triangles), eave overhang included.
function gableRoof({ c, u, v, L, W }, eave, rise) {
  const roof = mesh(), gables = mesh()
  const hl = L / 2 + 0.4, hw = W / 2 + 0.5
  const P = (a, b, y) => { const q = add(add(c, mul(u, a)), mul(v, b)); return [q[0], y, q[1]] }
  const slope = Math.hypot(hw, rise)
  for (const s of [-1, 1]) {
    const want = [v[0] * s * rise, hw, v[1] * s * rise]
    const A = P(-hl, s * hw, eave), B = P(hl, s * hw, eave), R1 = P(hl, 0, eave + rise), R0 = P(-hl, 0, eave + rise)
    tri(roof, A, B, R1, want, [0, 0], [2 * hl, 0], [2 * hl, slope]); tri(roof, A, R1, R0, want, [0, 0], [2 * hl, slope], [0, slope])
    const E0 = P(s * (hl - 0.4), -hw + 0.5, eave), E1 = P(s * (hl - 0.4), hw - 0.5, eave), Et = P(s * (hl - 0.4), 0, eave + rise)
    tri(gables, E0, E1, Et, [u[0] * s, 0, u[1] * s], [0, eave], [W, eave], [W / 2, eave + rise])
  }
  return { roof, gables }
}

// Surface of revolution from a profile of [radius, height] multiples of r.
export function lathe(at, y0, r, profile, sides = 16) {
  const out = mesh(), cy = y0 + r * 0.6
  const ring = (j) => Array.from({ length: sides }, (_, k) => {
    const a = (k / sides) * Math.PI * 2
    return [at[0] + Math.cos(a) * r * profile[j][0], y0 + r * profile[j][1], at[1] + Math.sin(a) * r * profile[j][0]]
  })
  for (let j = 0; j < profile.length - 1; j++) {
    const A = ring(j), B = ring(j + 1)
    for (let k = 0; k < sides; k++) {
      const k2 = (k + 1) % sides
      const mid = [(A[k][0] + B[k2][0]) / 2 - at[0], (A[k][1] + B[k2][1]) / 2 - cy, (A[k][2] + B[k2][2]) / 2 - at[1]]
      tri(out, A[k], A[k2], B[k2], mid, [k, j], [k + 1, j], [k + 1, j + 1]); tri(out, A[k], B[k2], B[k], mid, [k, j], [k + 1, j + 1], [k, j + 1])
    }
  }
  return out
}
const ONION = [[1, 0], [1.18, 0.35], [1.12, 0.75], [0.8, 1.1], [0.42, 1.38], [0.14, 1.62], [0.05, 1.85], [0, 2.1]]
export const DOME = [[1, 0], [0.97, 0.25], [0.87, 0.5], [0.71, 0.71], [0.5, 0.87], [0.26, 0.97], [0, 1]]

const squareRing = (c, u, v, h) => [add(add(c, mul(u, -h)), mul(v, -h)), add(add(c, mul(u, h)), mul(v, -h)), add(add(c, mul(u, h)), mul(v, h)), add(add(c, mul(u, -h)), mul(v, h))]
const octRing = (c, u, v, r) => Array.from({ length: 8 }, (_, i) => { const a = ((i + 0.5) / 8) * Math.PI * 2; return add(add(c, mul(u, Math.cos(a) * r)), mul(v, Math.sin(a) * r)) })
const clamp = (x, a, b) => Math.min(b, Math.max(a, x))

// ctx.front: a point on the nearest street; the tower goes on that end.
export function shapeSacred(b, ctx = {}) {
  const kind = sacredKind(b.tags, { override: ctx.override })
  if (!kind) return null
  // an office tower that hosts a congregation (Chicago Temple) keeps its skyscraper; a church's tall tag is its steeple
  const churchTyped = ['church', 'cathedral', 'chapel', 'mosque', 'synagogue', 'temple'].includes(b.tags.building)
  if (b.height > MAX_SHAPED_HEIGHT && !churchTyped) return null
  const h = hashSeed(b.id)
  const mat = (b.tags['building:material'] || '').toLowerCase()
  const byMaterial = mat === 'brick' ? 'brick' : /limestone|sandstone/.test(mat) ? 'limestone' : /stone|granite/.test(mat) ? 'graystone' : null
  const wallStyle = byMaterial ?? (kind === 'mosque' ? 'limestone' : kind === 'orthodox' ? (h < 0.5 ? 'yellowbrick' : 'brick') : h < 0.45 ? 'brick' : h < 0.75 ? 'limestone' : h < 0.9 ? 'graystone' : 'yellowbrick')
  const seed = SACRED_STYLE.walls[wallStyle]
  const base = { facade: 'sacred', seed, noParapet: true }
  if (b.parts?.length) return { ...base, keepPieces: true }

  const main = b.polygons.reduce((a, p) => (Math.abs(signedArea(p.outer)) > Math.abs(signedArea(a.outer)) ? p : a))
  const box = orientedBox(main.outer)
  const area = Math.abs(signedArea(main.outer))
  const cathedral = kind === 'cathedral'
  const eave = clamp(b.height * 0.75, 7, cathedral ? 20 : 16)
  const pieces = b.polygons.map((p) => ({ outer: p.outer, holes: p.holes, base: 0, top: eave, part: 'walls' }))
  const meshes = []
  const put = (m, facade, s, part) => { if (m.positions.length) meshes.push({ mesh: m, facade, seed: s, part }) }
  const rectangular = area / (box.L * box.W) >= 0.8 && box.W >= 6 && box.L * box.W <= 9000
  const roofStyle = kind === 'orthodox' ? SACRED_STYLE.roofing.copper : kind === 'temple' ? SACRED_STYLE.roofing.terracotta : SACRED_STYLE.roofing.slate
  const domeStyle = h < 0.5 ? SACRED_STYLE.roofing.gold : SACRED_STYLE.roofing.copper
  let rise = 0
  if (rectangular && kind !== 'mosque') {
    rise = Math.min(14, box.W <= 22 ? 0.55 * box.W : 0.35 * box.W)
    const g = gableRoof(box, eave, rise)
    put(g.roof, SACRED.roofing, roofStyle, 'roof')
    put(g.gables, SACRED.walls, seed, 'gable')
  }
  // the street end (the end whose midpoint is nearer the front hint)
  const ends = [1, -1].map((s) => ({ s, mid: add(box.c, mul(box.u, (s * box.L) / 2)) }))
  const front = ctx.front ? ends.reduce((a, e) => (Math.hypot(...sub(e.mid, ctx.front)) < Math.hypot(...sub(a.mid, ctx.front)) ? e : a)) : ends[0]

  const crown = ctx.override?.crown ?? 'spire'
  if ((kind === 'church' || kind === 'cathedral') && box.L >= 16 && box.W >= 8) {
    if (crown === 'dome') {
      // Renaissance: a great dome on a drum over the crossing, twin cupola towers on the front corners
      const r = clamp(0.3 * box.W, 5, 13)
      const dc = add(box.c, mul(box.u, -front.s * box.L * 0.12))
      const drumTop = eave + rise + r * 0.7
      put(drum({ at: dc, base: eave, top: drumTop, r: r * 1.02, sides: 24 }), SACRED.walls, seed, 'drum')
      put(lathe(dc, drumTop, r, DOME, 24), SACRED.roofing, SACRED_STYLE.roofing.copper, 'dome')
      put(drum({ at: dc, base: drumTop + r, top: drumTop + r + r * 0.35, r: r * 0.16, sides: 12 }), SACRED.walls, seed, 'lantern')
      const ts = clamp(0.24 * box.W, 4, 8), tTop = eave + rise + ts * 1.6
      for (const sv of [-1, 1]) {
        const tc = add(add(box.c, mul(box.u, front.s * (box.L / 2 - ts / 2))), mul(box.v, sv * (box.W / 2 - ts / 2)))
        pieces.push({ outer: squareRing(tc, box.u, box.v, ts / 2), holes: [], base: 0, top: tTop, part: 'tower' })
        put(lathe(tc, tTop, ts * 0.45, DOME, 12), SACRED.roofing, SACRED_STYLE.roofing.copper, 'cupola')
      }
    } else {
      const s = clamp((cathedral ? 0.45 : 0.4) * box.W, 4, cathedral ? 12 : 10)
      const tc = add(box.c, mul(box.u, front.s * (box.L / 2 - s / 2)))
      const spireH = crown === 'spire' ? s * (cathedral ? 3.4 : 2.4) : s * 0.55
      let towerTop = eave + rise + clamp(0.6 * box.W, 6, 18) * (cathedral ? 1.35 : 1) * (crown === 'tower' ? 1.25 : 1)
      if (b.heightSource && b.heightSource !== 'default' && b.height > towerTop + spireH) towerTop = b.height - spireH
      pieces.push({ outer: squareRing(tc, box.u, box.v, s / 2), holes: [], base: 0, top: towerTop, part: 'tower' })
      if (crown === 'spire') put(pyramid({ ring: octRing(tc, box.u, box.v, s * 0.47), base: towerTop, top: towerTop + spireH }), SACRED.roofing, SACRED_STYLE.roofing.slate, 'spire')
      else for (const [a, bb] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {   // Gothic corner pinnacles
        const pc = add(add(tc, mul(box.u, a * s * 0.42)), mul(box.v, bb * s * 0.42))
        put(spire({ at: pc, base: towerTop, top: towerTop + s * 0.55, r0: s * 0.09, sides: 6 }), SACRED.walls, seed, 'pinnacle')
      }
    }
  }
  if (kind === 'orthodox') {
    const r = clamp(0.2 * box.W, 2.5, 6.5)
    const spots = [[0, 0, r]]
    const n = box.L * box.W > 500 ? 4 : 2
    for (let i = 0; i < n; i++) {
      const su = i < 2 ? front.s : -front.s, sv = i % 2 ? 1 : -1
      spots.push([su * box.L * 0.32, sv * box.W * 0.26, r * 0.55])
    }
    for (const [a, bb, rr] of spots) {
      const at = add(add(box.c, mul(box.u, a)), mul(box.v, bb))
      const drumTop = eave + rise + rr * (a === 0 && bb === 0 ? 1.2 : 0.6)
      put(drum({ at, base: eave + rise * 0.4, top: drumTop, r: rr * 0.95, sides: 16 }), SACRED.walls, seed, 'drum')
      put(lathe(at, drumTop, rr, ONION), SACRED.roofing, domeStyle, 'dome')
      put(spire({ at, base: drumTop + rr * 2.05, top: drumTop + rr * 2.05 + rr * 0.9, r0: 0.12, r1: 0.05, sides: 6 }), SACRED.roofing, SACRED_STYLE.roofing.gold, 'cross')
    }
  }
  if (kind === 'mosque') {
    const r = clamp(0.28 * box.W, 3, 9)
    put(drum({ at: box.c, base: eave, top: eave + r * 0.4, r: r * 1.02, sides: 20 }), SACRED.walls, seed, 'drum')
    put(lathe(box.c, eave + r * 0.4, r, DOME, 20), SACRED.roofing, domeStyle, 'dome')
    const mc = add(add(box.c, mul(box.u, front.s * (box.L / 2 - 2))), mul(box.v, box.W / 2 - 2))
    const mTop = eave * 2.4
    put(drum({ at: mc, base: 0, top: mTop, r: 1.2, sides: 12 }), SACRED.walls, SACRED_STYLE.walls.limestone, 'minaret')
    put(spire({ at: mc, base: mTop, top: mTop + 4.5, r0: 1.5, sides: 12 }), SACRED.roofing, domeStyle, 'minaret')
  }
  return { ...base, pieces, meshes }
}
