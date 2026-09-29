// pipeline/lib/shapes.js — per-landmark geometry corrections before heroes exist.
import { signedArea, ringCentroid } from './geom.js'

export const HERO_SHAPES = {
  // 875 N Michigan: ~80 x 50 m at the base, ~50 x 31 m at the roof.
  '331204': { name: 'John Hancock Center', topScale: 0.62 },
}

const areaOf = (p) => Math.abs(signedArea(p.outer))

export function shapePieces(b) {
  const pieces = []
  if (b.height > 0) for (const p of b.polygons) pieces.push({ outer: p.outer, holes: p.holes, base: 0, top: b.height })
  for (const p of b.parts || []) if (p.top > p.base) pieces.push({ ...p })
  const shape = HERO_SHAPES[b.id]
  if (!shape) return pieces

  const isAntenna = (p) => areaOf(p) < 0.03 * b.area
  const body = pieces.filter((p) => !isAntenna(p))
  if (!body.length) return pieces
  const shaftTop = Math.max(...body.map((p) => p.top))
  const center = b.centroid
  const taper = { center, shaftTop, topScale: shape.topScale }
  return pieces.map((p) => {
    if (!isAntenna(p) || p.top <= shaftTop) return { ...p, taper }
    const [px, pz] = ringCentroid(p.outer)
    const dx = (center[0] - px) * (1 - shape.topScale), dz = (center[1] - pz) * (1 - shape.topScale)
    const move = (r) => r.map(([x, z]) => [x + dx, z + dz])
    return { outer: move(p.outer), holes: p.holes.map(move), base: shaftTop * 0.98, top: p.top }
  })
}
