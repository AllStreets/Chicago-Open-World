// pipeline/lib/heroes.js — hand-shaped landmark specs (data/heroes.json) → extrusion pieces + crown meshes.
import { shapePieces } from './shapes.js'
import { spire, antenna, pyramid, drum, sloped } from './crowns.js'
import { signedArea } from './geom.js'

// Mirror of the façade shader's curtain-glass tint buckets: g = fract(seed * 3.7).
const TINT_G = { dark: 0.14, green: 0.39, silver: 0.64, blue: 0.89 }
export const seedForTint = (tint) => TINT_G[tint] / 3.7

const scaleRing = (ring, [cx, cz], s, [ox, oz] = [0, 0]) => ring.map(([x, z]) => [cx + (x - cx) * s + ox, cz + (z - cz) * s + oz])
const CROWNS = { spire, antenna, pyramid, drum, sloped }

export function applyHero(b, spec) {
  let pieces = shapePieces(b, spec.taper ? { topScale: spec.taper.topScale } : undefined)
  const [cx, cz] = b.centroid
  const main = b.polygons.reduce((a, p) => (Math.abs(signedArea(p.outer)) > Math.abs(signedArea(a.outer)) ? p : a))

  if (spec.tiers?.length) {
    const first = spec.tiers[0].from
    pieces = [{ outer: main.outer, holes: main.holes, base: 0, top: first }]
    for (const t of spec.tiers) pieces.push({ outer: scaleRing(main.outer, [cx, cz], t.scale, t.offset), holes: [], base: t.from, top: t.to })
  } else if (spec.heightM) {
    const bodyTop = Math.max(...pieces.filter((p) => Math.abs(signedArea(p.outer)) >= 0.03 * b.area).map((p) => p.top))
    pieces = pieces.map((p) => (p.top === bodyTop ? { ...p, top: spec.heightM } : p))
  }

  const extraMeshes = (spec.crowns || []).map((c) => {
    const at = [cx + (c.at?.[0] ?? 0), cz + (c.at?.[1] ?? 0)]
    const ring = c.scale ? scaleRing(main.outer, [cx, cz], c.scale, c.offset) : undefined
    return CROWNS[c.type]({ ...c, at, ring: c.ring ?? ring })
  })

  if (spec.facade) b.facadeOverride = spec.facade
  if (spec.tint) b.seedOverride = seedForTint(spec.tint)
  return { pieces, extraMeshes }
}
