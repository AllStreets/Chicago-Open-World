// pipeline/lib/lake.js — the open lake: a 120 × 160 km rectangle centred on the shoreline, minus land and minus
// the mapped water polygons (river, harbours, lagoons), so no two water surfaces ever overlap.
import polygonClipping from 'polygon-clipping'
import { openRing, signedArea } from './geom.js'

export const LAKE = { width: 120000, depth: 160000 }
const close = (r) => [...r, r[0]]

export function lakePolygons({ center, land, water }) {
  const [cx, cz] = center, hw = LAKE.width / 2, hd = LAKE.depth / 2
  const rect = [[[cx - hw, cz - hd], [cx + hw, cz - hd], [cx + hw, cz + hd], [cx - hw, cz + hd], [cx - hw, cz - hd]]]
  const cut = [...land, ...water].map((p) => [close(p.outer), ...(p.holes || []).map(close)])
  return polygonClipping.difference(rect, ...cut)
    .map(([outer, ...holes]) => ({ outer: openRing(outer), holes: holes.map(openRing) }))
    .filter((p) => p.outer.length >= 3 && Math.abs(signedArea(p.outer)) > 1)
}
