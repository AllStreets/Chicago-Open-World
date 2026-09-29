// pipeline/lib/shore.js — distance to the nearest shore over the lake band, as an 8-bit image the water shader
// reads for foam and the shallow tint: 0 on the shore, 255 at maxDist metres or more.
import { makeGrid, fillPolygon, distanceField } from './raster.js'

export const SHORE = { cell: 4, maxDist: 200 }

export function bakeShore({ bounds, land, water }) {
  const g = makeGrid(bounds, SHORE.cell)
  const mask = new Uint8Array(g.width * g.height)
  for (const p of land) fillPolygon(g, [p.outer, ...(p.holes || [])], (k) => { mask[k] = 1 })
  for (const p of water) fillPolygon(g, [p.outer, ...(p.holes || [])], (k) => { mask[k] = 0 })
  const d = distanceField(mask, g.width, g.height)
  const pixels = new Uint8Array(d.length)
  for (let k = 0; k < d.length; k++) pixels[k] = Math.min(255, Math.round(((d[k] * SHORE.cell) / SHORE.maxDist) * 255))
  return { grid: g, pixels }
}
