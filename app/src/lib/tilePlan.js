// app/src/lib/tilePlan.js — which tiles to show, at which detail, for a camera target.
export const LOD0_M = 1600
export const LOD1_M = 7000
export const HYST = 1.15
export const MAX_LOD0 = 36

const centre = ({ minX, maxX, minZ, maxZ }) => [(minX + maxX) / 2, (minZ + maxZ) / 2]

export function planTiles([tx, tz], tiles, current) {
  const scored = tiles.map((t) => { const [cx, cz] = centre(t.bounds); return { t, d: Math.hypot(cx - tx, cz - tz) } }).sort((a, b) => a.d - b.d)
  const plan = new Map()
  let lod0 = 0
  for (const { t, d } of scored) {
    const was = current.get(t.key)
    const lod0Limit = was === 'lod0' ? LOD0_M * HYST : LOD0_M
    const lod1Limit = was ? LOD1_M * HYST : LOD1_M
    if (d <= lod0Limit && lod0 < MAX_LOD0) { plan.set(t.key, 'lod0'); lod0++ }
    else if (d <= lod1Limit) plan.set(t.key, 'lod1')
  }
  return plan
}
