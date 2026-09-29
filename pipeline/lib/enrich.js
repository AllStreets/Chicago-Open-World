// pipeline/lib/enrich.js — fill OSM buildings with City stories / year / address (spatial join).
import { pointInRing } from './geom.js'
import { FLOOR_M } from './height.js'

export function buildGridIndex(items, cell, keyFn) {
  const grid = new Map()
  const k = (x, z) => `${Math.floor(x / cell)}:${Math.floor(z / cell)}`
  for (const it of items) {
    const [x, z] = keyFn(it); const key = k(x, z)
    if (!grid.has(key)) grid.set(key, [])
    grid.get(key).push(it)
  }
  return {
    query([x, z], r = 0) {
      const out = [], cx = Math.floor(x / cell), cz = Math.floor(z / cell), n = Math.max(0, Math.ceil(r / cell))
      for (let i = cx - n; i <= cx + n; i++) for (let j = cz - n; j <= cz + n; j++) out.push(...(grid.get(`${i}:${j}`) || []))
      return out
    },
    rect({ minX, minZ, maxX, maxZ }) {
      const out = []
      for (let i = Math.floor(minX / cell); i <= Math.floor(maxX / cell); i++)
        for (let j = Math.floor(minZ / cell); j <= Math.floor(maxZ / cell); j++) out.push(...(grid.get(`${i}:${j}`) || []))
      return out
    },
  }
}

export function enrichFromCity(osmBuildings, cityBuildings) {
  const idx = buildGridIndex(cityBuildings, 100, (c) => c.centroid)
  for (const b of osmBuildings) {
    const hit = idx.rect(b.bbox).find((c) => b.polygons.some((p) => pointInRing(c.centroid, p.outer)))
    if (!hit) continue
    b.cityId = hit.id
    if (hit.stories && !b.stories) b.stories = hit.stories
    if (hit.year && !b.year) b.year = hit.year
    if (hit.address && !b.address) b.address = hit.address
    if (b.heightSource === 'default' && hit.stories) { b.height = hit.stories * FLOOR_M; b.heightSource = 'city' }
  }
}
