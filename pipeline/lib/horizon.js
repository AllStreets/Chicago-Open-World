// pipeline/lib/horizon.js — a band of simple city blocks beyond the detailed world, laid on Chicago's grid,
// so the city runs on to the horizon instead of ending in flat ground.
// Chicago blocks are 1/16 mile east–west and 1/8 mile north–south; State & Madison (the origin) is on the grid.
export const GRID = { x: 100.6, z: 201.2 }
const STREET = 11      // half the curb-to-curb + sidewalk width, each side of a street centreline
const ALLEY = 3
const LAKEFRONT = 400  // keep houses off the lakefront parks

function rng(seed) {
  let s = seed >>> 0 || 1
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000 }
}

export function horizonBoxes({ inner, band, isLand, seed = 1 }) {
  const out = []
  const outer = { minX: inner.minX - band, maxX: inner.maxX + band, minZ: inner.minZ - band, maxZ: inner.maxZ + band }
  const inside = (x, z, r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ
  for (let kx = Math.floor(outer.minX / GRID.x); kx * GRID.x < outer.maxX; kx++) {
    for (let kz = Math.floor(outer.minZ / GRID.z); kz * GRID.z < outer.maxZ; kz++) {
      const x0 = kx * GRID.x + STREET, x1 = (kx + 1) * GRID.x - STREET
      const z0 = kz * GRID.z + STREET, z1 = (kz + 1) * GRID.z - STREET
      const corners = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]
      if (corners.some(([x, z]) => !inside(x, z, outer))) continue
      // the block must lie wholly outside the detailed world
      if (!(x1 < inner.minX || x0 > inner.maxX || z1 < inner.minZ || z0 > inner.maxZ)) continue
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2
      if (!corners.every((p) => isLand(p)) || !isLand([cx + LAKEFRONT, cz])) continue
      const r = rng(seed * 7919 + (kx + 5000) * 104729 + (kz + 5000) * 1299709)
      const onArterial = Math.abs(((kx * GRID.x) % 804.7 + 804.7) % 804.7) < GRID.x || Math.abs(((kz * GRID.z) % 804.7 + 804.7) % 804.7) < GRID.z
      // two rows of buildings either side of a north–south alley, broken into runs of lots
      const xm = (x0 + x1) / 2
      for (const [a, b] of [[x0, xm - ALLEY], [xm + ALLEY, x1]]) {
        let z = z0
        while (z < z1 - 6) {
          const len = Math.min(z1 - z, 18 + r() * 34)
          const depth = (b - a) * (0.55 + r() * 0.35)
          const front = a === x0 ? a : b - depth       // buildings front the street, yards face the alley
          const midrise = r() < (onArterial ? 0.22 : 0.07)
          const top = midrise ? 16 + r() * 22 : onArterial ? 9 + r() * 6 : 7 + r() * 6
          out.push({ outer: [[front, z], [front + depth, z], [front + depth, z + len - 1.5], [front, z + len - 1.5]], top: Math.round(top * 10) / 10, family: midrise ? 'prewar-brick' : r() < 0.7 ? 'three-flat-brick' : 'prewar-brick', seed: r() })
          z += len
        }
      }
    }
  }
  return out
}
