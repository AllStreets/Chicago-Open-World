// pipeline/lib/rollingstock.js — procedural CTA and Metra rolling stock (V4, backlog C6/C7): true outlines and
// proportions at 2–5k triangles per car. Local frame: origin at the car centre on top of rail, +X toward the
// A (cab) end, +Y up, +Z to the right. Every vertex carries a KIND that the train shader reads.
import { createMesh, box, quad, cylinder, extrudeX, quadFacing, triFacing, hexToLinear, KIND } from './transit/meshkit.js'

export const WHEEL_SEGMENTS = 32
export const COLOURS = { stainless: '#b9bec2', glass: '#18222b', dark: '#1c1f22', door: '#a3a9ae', sign: '#101418', head: '#f2efe6', tail: '#7a0c0c', roof: '#8d9296', metraBlue: '#005596', metraRed: '#e31837', locoBody: '#9ea4a8' }
export const C = Object.fromEntries(Object.entries(COLOURS).map(([k, v]) => [k, hexToLinear(v)]))
export const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1]
export const CTA_BODY = { base: 0.95, belt: 1.6, eave: 2.95, roofGear: 0.3 }

export const sideRect = (m, s, xa, xb, ya, yb, off, col, kind) => {
  const z = s * off
  quad(m, [xa, ya, z], [xb, ya, z], [xb, yb, z], [xa, yb, z], [0, 0, s], col, kind)
}
export const endRect = (m, x, dir, za, zb, ya, yb, col, kind) => quad(m, [x, ya, za], [x, ya, zb], [x, yb, zb], [x, yb, za], [dir, 0, 0], col, kind)

export function panes(m, s, xa, xb, ya, yb, off, paneLen = 1.5) {
  const len = xb - xa
  if (len < 0.5) return
  const n = Math.max(1, Math.round(len / paneLen)), w = (len - (n - 1) * 0.12) / n
  for (let i = 0; i < n; i++) {
    const a = xa + i * (w + 0.12)
    sideRect(m, s, a - 0.04, a + w + 0.04, ya - 0.04, yb + 0.04, off + 0.003, C.dark, KIND.dark) // gasket
    sideRect(m, s, a, a + w, ya, yb, off + 0.005, C.glass, KIND.glass)
  }
}

export function doorPair(m, s, xd, w, ya, yb, off) {
  for (const [a, b] of [[xd - w / 2, xd - 0.01], [xd + 0.01, xd + w / 2]]) {
    sideRect(m, s, a, b, ya, yb, off + 0.006, C.door, KIND.door)
    sideRect(m, s, a + 0.1, b - 0.1, ya + 0.6, yb - 0.35, off + 0.008, C.glass, KIND.glass)
  }
}

export function truck(m, xc, { wheel, wheelbase }, shoe = false) {
  const r = wheel / 2, h = wheelbase / 2
  for (const z of [-0.95, 0.95]) box(m, [xc, r + 0.05, z], X, Y, Z, [h + 0.35, 0.16, 0.07], C.dark, KIND.dark) // side frames
  box(m, [xc, r + 0.12, 0], X, Y, Z, [0.25, 0.12, 0.95], C.dark, KIND.dark)                                  // bolster
  for (const dx of [-h, h]) {
    cylinder(m, [xc + dx, r, 0], 'z', 0.08, 0.85, 8, C.dark, KIND.dark, false)                              // axle
    for (const z of [-0.717, 0.717]) cylinder(m, [xc + dx, r, z], 'z', r, 0.065, WHEEL_SEGMENTS, C.dark, KIND.dark)
  }
  for (const dx of [-0.55, 0.55]) for (const z of [-0.95, 0.95]) cylinder(m, [xc + dx, r + 0.3, z], 'y', 0.11, 0.14, 10, C.dark, KIND.dark)
  if (shoe) for (const z of [-1.3, 1.3]) box(m, [xc, 0.3, z], X, Y, Z, [0.2, 0.04, 0.12], C.dark, KIND.dark) // third-rail shoe beams
}

export function coupler(m, x, dir) {
  box(m, [x + dir * 0.3, 0.85, 0], X, Y, Z, [0.3, 0.1, 0.12], C.dark, KIND.dark)
  cylinder(m, [x + dir * 0.55, 0.85, 0], 'x', 0.12, 0.1, 12, C.dark, KIND.dark)
}

function ctaProfile(S) {
  const hw = S.width / 2, top = S.height - CTA_BODY.roofGear, e = CTA_BODY.eave
  return [[hw, CTA_BODY.base], [hw, e], [hw - 0.06, e + 0.2], [hw - 0.32, top - 0.08], [hw - 0.87, top], [-(hw - 0.87), top], [-(hw - 0.32), top - 0.08], [-(hw - 0.06), e + 0.2], [-hw, e], [-hw, CTA_BODY.base]]
}

function ctaCar(S, { rake, paneLen }) {
  const m = createMesh(), L = S.length, hw = S.width / 2, x0 = -L / 2, x1 = L / 2, top = S.height - CTA_BODY.roofGear
  const prof = ctaProfile(S), inside = [x0, 2.0, 0]
  const front = (y) => x1 - rake * Math.min(1, Math.max(0, (y - CTA_BODY.belt) / (top - CTA_BODY.belt))) // cab face x at height y
  // stainless shell; the 7000-series cab end leans back above the belt line
  extrudeX(m, prof, x0, x1 - rake, C.stainless, KIND.stainless, { caps: [true, rake === 0] })
  if (rake) {
    const A = prof.map(([z, y]) => [x1 - rake, y, z]), B = prof.map(([z, y]) => [front(y), y, z])
    prof.forEach((_, k) => { const k2 = (k + 1) % prof.length; quadFacing(m, A[k], A[k2], B[k2], B[k], inside, C.stainless, KIND.stainless) })
    const c = [B.reduce((a, p) => a + p[0], 0) / B.length, B.reduce((a, p) => a + p[1], 0) / B.length, 0]
    B.forEach((p, k) => triFacing(m, c, p, B[(k + 1) % B.length], inside, C.stainless, KIND.stainless))
  }
  // A end: windshield, destination + run-number signs, headlights, marker/tail lights, anticlimber, grab rails, coupler
  const fx = (y) => front(y) + 0.004
  for (const [za, zb] of [[-1.15, -0.1], [0.1, 1.15]]) quadFacing(m, [fx(1.75), 1.75, za], [fx(1.75), 1.75, zb], [fx(2.7), 2.7, zb], [fx(2.7), 2.7, za], inside, C.glass, KIND.glass)
  box(m, [front(2.95) + 0.03, 2.95, 0.15], X, Y, Z, [0.03, 0.12, 0.62], C.sign, KIND.sign)
  box(m, [front(2.95) + 0.03, 2.95, -1.0], X, Y, Z, [0.03, 0.1, 0.2], C.sign, KIND.sign)
  for (const z of [-0.85, 0.85]) cylinder(m, [x1 + 0.03, 1.35, z], 'x', 0.09, 0.03, 16, C.head, KIND.headlight)
  for (const z of [-1.18, 1.18]) box(m, [x1 + 0.03, 1.35, z], X, Y, Z, [0.03, 0.06, 0.08], C.tail, KIND.tail)
  box(m, [x1 + 0.08, 1.02, 0], X, Y, Z, [0.08, 0.07, 1.25], C.dark, KIND.dark)
  for (const z of [-1.3, 1.3]) box(m, [x1 + 0.03, 2.0, z], X, Y, Z, [0.02, 0.4, 0.02], C.dark, KIND.dark)
  coupler(m, x1, 1)
  // B end: storm door and end windows (married pair side)
  endRect(m, x0 - 0.004, -1, -0.4, 0.4, 1.1, 2.95, C.door, KIND.door)
  endRect(m, x0 - 0.006, -1, -0.25, 0.25, 1.9, 2.6, C.glass, KIND.glass)
  for (const z of [-0.95, 0.95]) endRect(m, x0 - 0.005, -1, z - 0.3, z + 0.3, 1.9, 2.6, C.glass, KIND.glass)
  box(m, [x0 - 0.08, 1.02, 0], X, Y, Z, [0.08, 0.07, 1.25], C.dark, KIND.dark)
  coupler(m, x0, -1)
  // sides: two door pairs at the quarter points, window panes between, a side destination sign
  const doors = [-L / 4, L / 4], dw = S.doorWidth
  for (const s of [-1, 1]) {
    for (const xd of doors) doorPair(m, s, xd, dw, 1.1, CTA_BODY.eave, hw)
    for (const [a, b] of [[x0 + 1.0, doors[0] - dw / 2 - 0.25], [doors[0] + dw / 2 + 0.25, doors[1] - dw / 2 - 0.25], [doors[1] + dw / 2 + 0.25, x1 - rake - 1.0]]) panes(m, s, a, b, 1.6, 2.55, hw, paneLen)
    box(m, [doors[1] + 1.1, 2.78, s * (hw + 0.02)], X, Y, Z, [0.5, 0.11, 0.02], C.sign, KIND.sign)
  }
  // running gear, underfloor equipment, roof HVAC (the HVAC tops set the 3.66 m height)
  for (const sx of [-1, 1]) truck(m, (sx * S.truckCentres) / 2, S, true)
  for (let i = 0; i < 6; i++) box(m, [-3 + i * 1.2, 0.72, i % 2 ? 0.5 : -0.5], X, Y, Z, [0.55, 0.22, 0.45], C.dark, KIND.dark)
  for (const x of [-3.2, 3.2]) box(m, [x, top + CTA_BODY.roofGear / 2, 0], X, Y, Z, [1.1, CTA_BODY.roofGear / 2, 0.7], C.roof, KIND.roof)
  for (const x of [-5.5, -1, 1, 5.5]) box(m, [x, top + 0.05, 0], X, Y, Z, [0.25, 0.05, 0.2], C.roof, KIND.roof)
  return m
}

export const cta5000 = (S) => ctaCar(S, { rake: 0, paneLen: 1.5 })
export const cta7000 = (S) => ctaCar(S, { rake: 0.35, paneLen: 1.9 })

export function buildRollingStock(catalog) {
  const S = catalog.rollingStock
  return { cta5000: cta5000(S.cta5000), cta7000: cta7000(S.cta7000) }
}
