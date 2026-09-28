import { describe, it, expect } from 'vitest'
import { ORIGIN, project, unproject, metresPerDegree } from '../../shared/project.js'

describe('project', () => {
  it('maps origin to 0,0', () => {
    const [x, z] = project(ORIGIN.lon, ORIGIN.lat)
    expect(x).toBeCloseTo(0, 6)
    expect(z).toBeCloseTo(0, 6)
  })
  it('north is -Z and east is +X', () => {
    const [, zN] = project(ORIGIN.lon, ORIGIN.lat + 0.01)
    const [xE] = project(ORIGIN.lon + 0.01, ORIGIN.lat)
    expect(zN).toBeLessThan(0)
    expect(xE).toBeGreaterThan(0)
  })
  it('one mile north (Chicago Ave, 800 N) is ~1609 m', () => {
    const { mLat } = metresPerDegree(ORIGIN.lat)
    const [, z] = project(ORIGIN.lon, ORIGIN.lat + 1609.344 / mLat)
    expect(z).toBeCloseTo(-1609.344, 3)
  })
  it('round-trips within 1 mm across Ring 0', () => {
    for (const [lon, lat] of [[-87.645, 41.865], [-87.605, 41.9], [-87.6359, 41.879]]) {
      const [x, z] = project(lon, lat)
      const [lon2, lat2] = unproject(x, z)
      const [x2, z2] = project(lon2, lat2)
      expect(Math.hypot(x2 - x, z2 - z)).toBeLessThan(0.001)
    }
  })
  it('Willis Tower lands ~680 m west, ~250 m south of origin', () => {
    const [x, z] = project(-87.6359, 41.8789)
    expect(x).toBeGreaterThan(-720); expect(x).toBeLessThan(-640)
    expect(z).toBeGreaterThan(300); expect(z).toBeLessThan(380)
  })
})
