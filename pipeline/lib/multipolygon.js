// pipeline/lib/multipolygon.js — stitch OSM multipolygon member ways into rings.
import { openRing } from './geom.js'

const same = (p, q) => p[0] === q[0] && p[1] === q[1]

export function assembleRings(ways) {
  const rings = []
  const pool = []
  for (const w of ways) {
    if (w.length >= 4 && same(w[0], w[w.length - 1])) rings.push(openRing(w))
    else if (w.length >= 2) pool.push(w.slice())
  }
  while (pool.length) {
    let cur = pool.shift()
    let grew = true
    while (!same(cur[0], cur[cur.length - 1]) && grew) {
      grew = false
      const end = cur[cur.length - 1]
      for (let i = 0; i < pool.length; i++) {
        const w = pool[i]
        if (same(w[0], end)) cur = cur.concat(w.slice(1))
        else if (same(w[w.length - 1], end)) cur = cur.concat(w.slice(0, -1).reverse())
        else continue
        pool.splice(i, 1); grew = true; break
      }
    }
    if (cur.length >= 4 && same(cur[0], cur[cur.length - 1])) rings.push(openRing(cur))
  }
  return rings
}
