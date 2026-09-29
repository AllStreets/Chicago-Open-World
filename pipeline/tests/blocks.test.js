// pipeline/tests/blocks.test.js
import { describe, it, expect } from 'vitest'
import { createBlock, addTileToBlock, blockLayers, blockSidecar } from '../lib/blocks.js'

const tri = (ids) => ({ positions: ids.flatMap(() => [0, 0, 0]), normals: ids.flatMap(() => [0, 1, 0]), uvs: ids.flatMap(() => [0, 0]), fac: ids.map(() => 1), seed: ids.map(() => 0.5), bldg: ids })
const ground = { positions: [], normals: [], uvs: [], extra: { LAYER: new Float32Array(0) } }
const water = (n, c) => ({ positions: Array(n * 3).fill(0), normals: Array(n * 3).fill(0), uvs: Array(n * 2).fill(0), extra: { CALM: new Float32Array(n).fill(c) } })

describe('blocks (H7)', () => {
  it('shifts each tile’s building indices so _BLDG is unique inside the block', () => {
    const B = createBlock()
    addTileToBlock(B, '0_0', { buildings: tri([0, 0, 0, 1, 1, 1]), ground, water: water(3, 0.6), count: 2 })
    addTileToBlock(B, '1_0', { buildings: tri([0, 0, 0, 1, 1, 1]), ground, water: water(3, 0.35), count: 2 })
    const L = blockLayers(B)
    expect([...L.buildings.extra.BLDG]).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3])
    expect(new Set(L.buildings.extra.BLDG).size).toBe(4)
    expect(blockSidecar(B)).toEqual({ tiles: [{ key: '0_0', base: 0, count: 2 }, { key: '1_0', base: 2, count: 2 }] })
  })
  it('water calm travels into the block', () => {
    const B = createBlock()
    addTileToBlock(B, '0_0', { buildings: tri([]), ground, water: water(3, 0.6), count: 0 })
    expect(blockLayers(B).water.extra.CALM).toHaveLength(3)
  })
})

describe('blocks carry the style index (V2)', () => {
  it('_STYLE travels from tiles into the block, unshifted', () => {
    const B = createBlock()
    const t = { ...tri([0, 0, 0]), style: [7, 7, 7] }
    addTileToBlock(B, '0_0', { buildings: t, ground, water: water(0, 1), count: 1 })
    expect([...blockLayers(B).buildings.extra.STYLE]).toEqual([7, 7, 7])
  })
})

