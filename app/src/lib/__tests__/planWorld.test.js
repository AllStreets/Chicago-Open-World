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

describe('admitTiles (gradual load-in)', () => {
  it('keeps everything already loaded and admits only the nearest few new ones', async () => {
    const { admitTiles } = await import('../tilePlan.js')
    const entries = [['t:a', 'lod0', 10], ['t:b', 'lod0', 20], ['b:c', 'block', 3000], ['t:d', 'lod1', 900], ['t:e', 'lod1', 1200]]
    const ready = new Set(['b:c:block'])
    const out = admitTiles(entries, ready, 2).map(([id]) => id)
    expect(out).toEqual(['t:a', 't:b', 'b:c']) // c already loaded; a,b nearest of the new ones
  })
  it('a tile changing detail keeps showing while its new level loads', async () => {
    const { admitTiles } = await import('../tilePlan.js')
    const out = admitTiles([['t:a', 'lod0', 10]], new Set(['t:a:lod1']), 0)
    expect(out.map(([id]) => id)).toEqual(['t:a'])
  })
  it('upgrades wait their turn: beyond the limit a tile keeps drawing at the level it has', async () => {
    const { admitTiles } = await import('../tilePlan.js')
    const entries = [['t:a', 'lod0', 10], ['t:b', 'lod0', 20], ['t:c', 'lod0', 30]]
    const out = admitTiles(entries, new Set(['t:a:lod1', 't:b:lod1', 't:c:lod1']), 1)
    expect(out).toEqual([['t:a', 'lod0', 10], ['t:b', 'lod1', 20], ['t:c', 'lod1', 30]])
  })
})

describe('retainOutgoing (no holes while swapping detail)', () => {
  const B = { 'b:k': { minX: 0, maxX: 2000, minZ: 0, maxZ: 2000 }, 't:1': { minX: 0, maxX: 500, minZ: 0, maxZ: 500 }, 't:2': { minX: 500, maxX: 1000, minZ: 0, maxZ: 500 }, 't:far': { minX: 5000, maxX: 5500, minZ: 0, maxZ: 500 } }
  const boundsOf = (id) => B[id]
  it('a block stays on screen until every tile replacing it has loaded', async () => {
    const { retainOutgoing } = await import('../tilePlan.js')
    const prev = [['b:k', 'block', 100]]
    const plan = [['t:1', 'lod0', 50], ['t:2', 'lod1', 60]]
    expect(retainOutgoing(prev, plan, new Set(['b:k:block', 't:1:lod0']), boundsOf).map(([id]) => id)).toEqual(['b:k'])
    expect(retainOutgoing(prev, plan, new Set(['b:k:block', 't:1:lod0', 't:2:lod1']), boundsOf)).toEqual([])
  })
  it('tiles leaving for a far block stay until the block is in; unrelated or unloaded content is not kept', async () => {
    const { retainOutgoing } = await import('../tilePlan.js')
    const prev = [['t:1', 'lod0', 50], ['t:far', 'lod1', 5000], ['t:2', 'lod1', 60]]
    const plan = [['b:k', 'block', 100]]
    const kept = retainOutgoing(prev, plan, new Set(['t:1:lod0', 't:far:lod1']), boundsOf).map(([id]) => id)
    expect(kept).toEqual(['t:1']) // t:far overlaps nothing in the plan; t:2 never loaded
  })
})
