// pipeline/lib/marina.js — Marina City's corn cobs (I-3.2): a round concrete core, nineteen parking levels as one
// open helical ramp (a turn per level, low parapet, the cars' floors visible from the river), a service floor, then
// forty apartment floors whose balconies are scalloped petal slabs around a recessed glass line, and the roof.
// Sourced in heroes.json (marina1.sculptParams); radii come from the OSM footprint unless overridden.
import { readFileSync } from 'node:fs'

const hero = JSON.parse(readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8')).heroes.find((h) => h.key === 'marina1')
const sp = hero?.sculptParams ?? {}
export const MARINA = { heightM: hero?.heightM ?? 179, floors: sp.floors ?? 65, parkingLevels: sp.parkingLevels ?? 19, aptFrom: sp.aptFrom ?? 21, aptTo: sp.aptTo ?? 60, petals: sp.petals ?? 16 }

const TAU = Math.PI * 2
const mesh = () => ({ positions: [], normals: [], uvs: [] })
// a triangle with its true normal, wound and flipped so that normal points along `want`
function tri(m, a, b, c, want) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
  let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
  const l = Math.hypot(...n)
  if (l < 1e-9) return
  if (n[0] * want[0] + n[1] * want[1] + n[2] * want[2] < 0) { [b, c] = [c, b]; n = n.map((k) => -k) }
  for (const p of [a, b, c]) { m.positions.push(...p); m.normals.push(n[0] / l, n[1] / l, n[2] / l); m.uvs.push(p[0] + p[2], p[1]) }
}
const quad = (m, a, b, c, d, want) => { tri(m, a, b, c, want); tri(m, a, c, d, want) }

// Scalloped outline: each petal a round lobe, tip at rPetal, meeting its neighbours in a cusp at rCore.
export function petalRing([cx, cz], rCore, rPetal, petals = 16, samplesPerPetal = 12) {
  const out = [], n = petals * samplesPerPetal
  for (let i = 0; i < n; i++) {
    const th = (i / n) * TAU, f = (i % samplesPerPetal) / samplesPerPetal
    const r = rCore + (rPetal - rCore) * Math.sin(Math.PI * f) ** 0.6
    out.push([cx + r * Math.cos(th), cz + r * Math.sin(th)])
  }
  return out
}

// A flat plate between an inner circle and an outer ring (same sample count, matched by angle), top and bottom.
function plate(m, [cx, cz], inner, outer, y0, y1) {
  for (let i = 0; i < outer.length; i++) {
    const j = (i + 1) % outer.length
    const P = (p, y) => [p[0], y, p[1]]
    quad(m, P(inner[i], y1), P(inner[j], y1), P(outer[j], y1), P(outer[i], y1), [0, 1, 0])
    quad(m, P(inner[i], y0), P(inner[j], y0), P(outer[j], y0), P(outer[i], y0), [0, -1, 0])
    const out = [(outer[i][0] + outer[j][0]) / 2 - cx, 0, (outer[i][1] + outer[j][1]) / 2 - cz]
    quad(m, P(outer[i], y0), P(outer[j], y0), P(outer[j], y1), P(outer[i], y1), out)
  }
}
const circleAs = ([cx, cz], r, n) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos((i / n) * TAU), cz + r * Math.sin((i / n) * TAU)])

export function marinaTower(center, { heightM, rCore, rPetal, floorH, parkingLevels, aptFrom, aptTo, petals = 16, coreR = rPetal * 0.34, slabT = 0.35 }) {
  const [cx, cz] = center
  const core = mesh(), slabs = mesh(), ramp = mesh(), glass = mesh()

  // the core: a plain concrete drum to the roof, capped
  const coreRing = circleAs(center, coreR, 24)
  for (let i = 0; i < 24; i++) {
    const a = coreRing[i], b = coreRing[(i + 1) % 24], out = [(a[0] + b[0]) / 2 - cx, 0, (a[1] + b[1]) / 2 - cz]
    quad(core, [a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], heightM, b[1]], [a[0], heightM, a[1]], out)
    tri(core, [a[0], heightM, a[1]], [b[0], heightM, b[1]], [cx, heightM, cz], [0, 1, 0])
  }

  // parking: one helical ramp, a turn per level, from the core out to the petal valleys, with a 1 m parapet
  const perTurn = 32, steps = parkingLevels * perTurn, rIn = coreR, rOut = rCore, rampCentreline = []
  const at = (k, r) => { const th = (k / perTurn) * TAU; return [cx + r * Math.cos(th), (k / perTurn) * floorH, cz + r * Math.sin(th)] }
  for (let k = 0; k <= steps; k++) { const p = at(k, (rIn + rOut) / 2); rampCentreline.push(p) }
  for (let k = 0; k < steps; k++) {
    const a = at(k, rIn), b = at(k + 1, rIn), c = at(k + 1, rOut), d = at(k, rOut)
    const up = (p) => [p[0], p[1] + slabT, p[2]], park = (p) => [p[0], p[1] + slabT + 1.0, p[2]]
    quad(ramp, up(a), up(b), up(c), up(d), [0, 1, 0])
    quad(ramp, a, b, c, d, [0, -1, 0])
    const out = [(c[0] + d[0]) / 2 - cx, 0, (c[2] + d[2]) / 2 - cz]
    quad(ramp, d, c, park(c), park(d), out)
  }

  // apartments: a scalloped balcony slab at every floor, the glass line set back behind it, a roof slab on top
  const spp = 6, edge = petalRing(center, rCore, rPetal, petals, spp), inner = circleAs(center, coreR, edge.length)
  for (let f = aptFrom; f <= aptTo; f++) plate(slabs, center, inner, edge, f * floorH, f * floorH + slabT)
  const roofY = (aptTo + 1) * floorH
  plate(slabs, center, inner, edge, roofY, roofY + slabT * 2)
  const line = petalRing(center, rCore - 2.2, rPetal - 2.6, petals, spp), g0 = parkingLevels * floorH
  for (let i = 0; i < line.length; i++) {
    const a = line[i], b = line[(i + 1) % line.length], out = [(a[0] + b[0]) / 2 - cx, 0, (a[1] + b[1]) / 2 - cz]
    quad(glass, [a[0], g0, a[1]], [b[0], g0, b[1]], [b[0], roofY, b[1]], [a[0], roofY, a[1]], out)
  }
  return { core, slabs, ramp, glass, rampCentreline }
}
