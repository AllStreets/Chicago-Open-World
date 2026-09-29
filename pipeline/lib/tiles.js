// pipeline/lib/tiles.js — 500 m world tiles.
export const TILE_SIZE = 500
export const tileKeyFor = ([x, z]) => `${Math.floor(x / TILE_SIZE)}_${Math.floor(z / TILE_SIZE)}`
export function tileBounds(key) {
  const [tx, tz] = key.split('_').map(Number)
  return { minX: tx * TILE_SIZE, maxX: (tx + 1) * TILE_SIZE, minZ: tz * TILE_SIZE, maxZ: (tz + 1) * TILE_SIZE }
}
export function groupByTile(buildings) {
  const m = new Map()
  for (const b of buildings) {
    const k = tileKeyFor(b.centroid)
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(b)
  }
  return m
}

// Every tile a bbox touches: polygons (water, parks) claim their tiles even where no building stands.
export function tileKeysForBBox({ minX, minZ, maxX, maxZ }) {
  const out = []
  for (let tx = Math.floor(minX / TILE_SIZE); tx <= Math.floor(maxX / TILE_SIZE); tx++)
    for (let tz = Math.floor(minZ / TILE_SIZE); tz <= Math.floor(maxZ / TILE_SIZE); tz++) out.push(`${tx}_${tz}`)
  return out
}
