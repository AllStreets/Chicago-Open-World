import { describe, it, expect } from 'vitest'
import { planTiles } from '../tilePlan.js'
const tiles = []; for (let x = -10; x < 10; x++) for (let z = -10; z < 10; z++) tiles.push({ key: `${x}_${z}`, bounds: { minX: x * 500, maxX: x * 500 + 500, minZ: z * 500, maxZ: z * 500 + 500 } })
describe('planTiles', () => {
  it('near tiles LOD0, far LOD1, beyond range none', () => {
    const p = planTiles([250, 250], tiles, new Map())
    expect(p.get('0_0')).toBe('lod0'); expect(p.get('5_0')).toBe('lod1'); expect(p.has('-10_-10')).toBe(false) // 7071 m > 7000 m
    const far = []; for (let x = 0; x < 40; x++) far.push({ key: `${x}_0`, bounds: { minX: x * 500, maxX: x * 500 + 500, minZ: 0, maxZ: 500 } })
    expect(planTiles([250, 250], far, new Map()).has('20_0')).toBe(false) // 10 km away
  })
  it('hysteresis keeps a LOD0 tile slightly past the threshold', () => {
    const row = []; for (let x = -10; x < 10; x++) row.push({ key: `${x}_0`, bounds: { minX: x * 500, maxX: x * 500 + 500, minZ: 0, maxZ: 500 } })
    const cur = new Map([['3_0', 'lod0']])
    expect(planTiles([250, 250], row, cur).get('3_0')).toBe('lod0')   // centre 1500 m → inside
    expect(planTiles([-80, 250], row, cur).get('3_0')).toBe('lod0')   // 1830 m ≤ 1600×1.15 = 1840
    expect(planTiles([-80, 250], row, new Map()).get('3_0')).toBe('lod1') // same spot, not held → LOD1
    expect(planTiles([-600, 250], row, cur).get('3_0')).toBe('lod1')  // 2350 m → drops
  })
  it('caps LOD0 tiles at 36, nearest first', () => {
    const p = planTiles([0, 0], tiles, new Map())
    const lod0 = [...p.entries()].filter(([, v]) => v === 'lod0').map(([k]) => k)
    expect(lod0.length).toBeLessThanOrEqual(36)
    expect(lod0).toContain('0_0')
  })
})
