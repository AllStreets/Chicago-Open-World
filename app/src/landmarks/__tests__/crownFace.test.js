import { describe, it, expect } from 'vitest'
import { crownFace, crownWaterOn } from '../crownFace.js'
describe('Crown Fountain face cycle (5 minutes per face)', () => {
  it('holds 4 min, puckers 15 s, spouts 30 s, smiles 15 s', () => {
    expect(crownFace(10).phase).toBe('hold')
    expect(crownFace(245).pucker).toBeCloseTo(1 / 3)
    expect(crownFace(260)).toMatchObject({ phase: 'spout', spout: 1 })
    expect(crownFace(290)).toMatchObject({ phase: 'smile', smile: 1 })
  })
  it('no water out of season, but the faces keep playing', () => {
    expect(crownFace(260, { waterOn: false })).toMatchObject({ phase: 'spout', spout: 0 })
    expect(crownWaterOn(new Date('2026-07-01T17:00:00Z'))).toBe(true)
    expect(crownWaterOn(new Date('2026-12-01T17:00:00Z'))).toBe(false)
  })
  it('a deterministic face per cycle, within the ~1,000 portraits', () => {
    const a = crownFace(10).face, b = crownFace(310).face
    expect(crownFace(20).face).toBe(a)
    expect(a).toBeGreaterThanOrEqual(0); expect(b).toBeLessThan(1000)
  })
})
