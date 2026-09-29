// pipeline/lib/props.js — rooftop clutter that makes a skyline read as Chicago.
import { pointInRing, ringBBox, ringCentroid, signedArea } from './geom.js'
import { hashSeed } from './buildings.js'
import { HERO_SHAPES } from './shapes.js'

const r1 = (n) => Math.round(n * 10) / 10

export function roofProps(b, pieces) {
  const roof = pieces.filter((p) => !p.taper).reduce((a, p) => (!a || p.top > a.top ? p : a), null)
  if (!roof || roof.top <= 15) return []
  const area = Math.abs(signedArea(roof.outer))
  const bb = ringBBox(roof.outer)
  const rnd = (k) => hashSeed(`${b.id}:${k}`)
  const inside = (x, z, pad) => [[0, 0], [pad, 0], [-pad, 0], [0, pad], [0, -pad]].every(([dx, dz]) => pointInRing([x + dx, z + dz], roof.outer))
  const pick = (k, pad) => {
    for (let t = 0; t < 12; t++) {
      const x = bb.minX + (bb.maxX - bb.minX) * rnd(`${k}x${t}`), z = bb.minZ + (bb.maxZ - bb.minZ) * rnd(`${k}z${t}`)
      if (inside(x, z, pad)) return [x, z]
    }
    return null
  }
  const out = []
  const y = roof.top
  if (b.year && b.year < 1950 && roof.top >= 15 && roof.top <= 70 && area > 250 && rnd('wt') < 0.55) {
    const p = pick('wt', 3); if (p) out.push([0, r1(p[0]), r1(y), r1(p[1]), r1(rnd('wtr') * 6.28), 1, 1, 1])
  }
  if (roof.top > 20) {
    const n = Math.min(6, Math.floor(area / 400))
    for (let i = 0; i < n; i++) {
      const s = 2 + rnd(`h${i}`) * 3, p = pick(`h${i}`, s / 2 + 0.5)
      if (p) out.push([1, r1(p[0]), r1(y), r1(p[1]), 0, r1(s), r1(1.2 + rnd(`hh${i}`) * 1.8), r1(s * (0.6 + rnd(`hw${i}`) * 0.6))])
    }
  }
  if (roof.top > 60 && !b.parts && !HERO_SHAPES[b.id]) {
    const [cx, cz] = ringCentroid(roof.outer)
    if (pointInRing([cx, cz], roof.outer)) out.push([2, r1(cx), r1(y), r1(cz), 0, r1((bb.maxX - bb.minX) * 0.3), 5, r1((bb.maxZ - bb.minZ) * 0.3)])
  }
  return out
}
