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

// Whole-world plan: LOD0 tiles near the camera; blocks that touch them split into LOD1 tiles;
// every other block within range renders as one 2 km block. Keys: 't:<tile>' | 'b:<block>'.
export function planWorld(target, manifest, current) {
  const curTiles = new Map([...current].filter(([k]) => k.startsWith('t:')).map(([k, v]) => [k.slice(2), v]))
  const near = planTiles(target, manifest.tiles, curTiles)
  const plan = new Map()
  const lod0Blocks = new Set()
  const byKey = new Map(manifest.tiles.map((t) => [t.key, t]))
  for (const [k, lod] of near) if (lod === 'lod0') { plan.set(`t:${k}`, 'lod0'); lod0Blocks.add(byKey.get(k).block) }
  for (const b of manifest.blocks ?? []) {
    const [cx, cz] = centre(b.bounds)
    const was = current.has(`b:${b.key}`)
    if (Math.hypot(cx - target[0], cz - target[1]) > LOD1_M * (was ? HYST : 1) + 1000) continue
    if (!lod0Blocks.has(b.key)) { plan.set(`b:${b.key}`, 'block'); continue }
    for (const t of manifest.tiles) if (t.block === b.key && !plan.has(`t:${t.key}`)) plan.set(`t:${t.key}`, 'lod1')
  }
  return plan
}
