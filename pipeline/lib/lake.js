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

// The land mesh minus every mapped water polygon: the city boundary reaches into the harbours, and land 4 cm
// under the water z-fights with it from a kilometre away. Cut out, the two never overlap.
export function landMinusWater({ land, water }) {
  const polys = (list) => list.map((p) => [close(p.outer), ...(p.holes || []).map(close)])
  return polygonClipping.difference(polys(land), ...polys(water))
    .map(([outer, ...holes]) => ({ outer: openRing(outer), holes: holes.map(openRing) }))
    .filter((p) => p.outer.length >= 3 && Math.abs(signedArea(p.outer)) > 1)
}

// Join polylines end to end (either direction); endpoints within tol count as one. Longest chain first.
export function joinLines(lines, tol = 1) {
  const pool = lines.map((l) => l.slice())
  const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= tol
  const chains = []
  while (pool.length) {
    let chain = pool.shift(), grew = true
    while (grew) {
      grew = false
      for (let i = 0; i < pool.length; i++) {
        const l = pool[i], s = chain[0], e = chain[chain.length - 1]
        if (near(e, l[0])) chain = [...chain, ...l.slice(1)]
        else if (near(e, l[l.length - 1])) chain = [...chain, ...l.slice(0, -1).reverse()]
        else if (near(s, l[l.length - 1])) chain = [...l.slice(0, -1), ...chain]
        else if (near(s, l[0])) chain = [...l.slice(1).reverse(), ...chain]
        else continue
        pool.splice(i, 1); grew = true; break
      }
    }
    chains.push(chain)
  }
  return chains.sort((a, b) => b.length - a.length)
}

// The lake side of the longest shoreline chain: the chain closed off far to the east. Land never extends past it.
export function lakeSide(chains, far) {
  const c = chains[0]
  if (!c || c.length < 2) return []
  const [x0, z0] = c[0], [x1, z1] = c[c.length - 1]
  const ring = [...c, [x1 + far, z1], [x0 + far, z0]]
  return polygonClipping.union([close(ring)])
    .map(([outer, ...holes]) => ({ outer: openRing(outer), holes: holes.map(openRing) }))
}
