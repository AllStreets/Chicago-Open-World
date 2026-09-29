import { describe, it, expect } from 'vitest'
import { planWorld } from '../tilePlan.js'
// 40×40 tiles (20 km) with 2 km blocks
const tiles = [], blocks = new Map()
for (let x = -20; x < 20; x++) for (let z = -20; z < 20; z++) {
  const block = `${Math.floor(x / 4)}_${Math.floor(z / 4)}`
  tiles.push({ key: `${x}_${z}`, block, bounds: { minX: x * 500, maxX: x * 500 + 500, minZ: z * 500, maxZ: z * 500 + 500 } })
  const [bx, bz] = block.split('_').map(Number)
  blocks.set(block, { key: block, bounds: { minX: bx * 2000, maxX: bx * 2000 + 2000, minZ: bz * 2000, maxZ: bz * 2000 + 2000 } })
}
const manifest = { tiles, blocks: [...blocks.values()] }
describe('planWorld', () => {
  const p = planWorld([250, 250], manifest, new Map())
  it('near tiles at full detail', () => { expect(p.get('t:0_0')).toBe('lod0') })
  it('blocks touching the near ring break into LOD1 tiles; the rest stay whole blocks', () => {
    expect(p.get('b:0_0')).toBeUndefined()       // contains LOD0 tiles
    expect(p.get('t:3_3')).toMatch(/lod0|lod1/)  // its other tiles still render
    expect(p.get('b:2_0')).toBe('block')         // 4–6 km away, nothing near
  })
  it('never renders a tile both as itself and inside a block', () => {
    for (const [id] of p) if (id.startsWith('t:')) {
      const t = tiles.find((x) => `t:${x.key}` === id)
      expect(p.has(`b:${t.block}`)).toBe(false)
    }
  })
  it('far beyond range renders nothing, and the file count stays small', () => {
    expect(p.has('b:-5_-5')).toBe(false) // ~13 km away
    expect(p.size).toBeLessThan(120)
  })
})
