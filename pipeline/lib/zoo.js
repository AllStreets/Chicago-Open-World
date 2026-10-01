// pipeline/lib/zoo.js — Lincoln Park Zoo (Workstream B, B-1): the zoo's builders, split out of civic.js so the park's
// landscape (lincolnpark.js) and the zoo grow apart. Sources and anchors in heroes.json (the Lincoln Park block).
//   Kovler Lion House (1912) ─ https://en.wikipedia.org/wiki/Lincoln_Park_Zoo — brick under a hipped tile roof.
import { convexHull } from './venue.js'
import { orientedBox } from './sacred.js'
import { pyramid } from './crowns.js'
import { add2, mul2, left } from './meshkit.js'
import { LANDMARK_FACADES as F } from './facadeIds.js'

const hullOf = (b) => convexHull(b.polygons.flatMap((p) => p.outer))
const obOf = (b) => orientedBox(hullOf(b))
const P = (m, facade, style, part, seed = 0.5) => ({ mesh: m, facade, seed, style, part })
const rectRing = (c, u, L, W) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, o]) => add2(add2(c, mul2(u, (a * L) / 2)), mul2(left(u), (o * W) / 2)))

export function lionHouse(b, spec) {
  const { c, u, L, W } = obOf(b)
  return { meshes: [P(pyramid({ ring: rectRing(c, u, L + 1.2, W + 1.2), base: b.height, top: b.height + (spec.roofRise ?? 5) }), F.roofing, null, 'roof', 0.85)] }
}

export const ZOO_BUILDERS = { lionHouse }
