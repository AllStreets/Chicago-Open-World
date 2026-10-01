// app/src/scan/__tests__/scanMath.test.js — the Scan sweep and its overlays (P5 Task 5, spec §7).
import { describe, it, expect } from 'vitest'
import { SCAN_SECONDS, scanRadiusAt, scanBlend, scanUniformsAt, landmarkHeat, columnHeights } from '../scanMath.js'

describe('scan sweep', () => {
  it('radius grows monotonically and reaches max at 1.2 s', () => {
    let last = -1
    for (let t = 0; t <= SCAN_SECONDS; t += 0.05) { const r = scanRadiusAt(t, 9000); expect(r).toBeGreaterThanOrEqual(last); last = r }
    expect(scanRadiusAt(SCAN_SECONDS, 9000)).toBe(9000); expect(scanRadiusAt(5, 9000)).toBe(9000)
  })
  it('blend is 1 behind the front and 0 ahead of it', () => {
    expect(scanBlend(100, 1000)).toBe(1); expect(scanBlend(2000, 1000)).toBe(0)
    const mid = scanBlend(1000, 1000); expect(mid).toBeGreaterThan(0); expect(mid).toBeLessThan(1)
  })
  it('toggling back mid-sweep continues from the current radius (no jump)', () => {
    const a = scanUniformsAt({ on: true, changedAt: 0, now: 600, origin: [0, 0] })
    const b = scanUniformsAt({ on: false, changedAt: 600, now: 600, origin: [0, 0], prevRadius: a.uScanRadius })
    expect(b.uScanMode).toBe(0); expect(Math.abs(b.uScanRadius - a.uScanRadius)).toBeLessThan(1)
    const c = scanUniformsAt({ on: false, changedAt: 600, now: 600 + SCAN_SECONDS * 1000, origin: [0, 0], prevRadius: a.uScanRadius })
    expect(c.uScan).toBe(0) // the sweep back finishes with the city fully normal
  })
  it('on and settled: fully scanned; off and settled: untouched', () => {
    expect(scanUniformsAt({ on: true, changedAt: 0, now: 5000, origin: [0, 0] })).toMatchObject({ uScan: 1, uScanMode: 1 })
    expect(scanUniformsAt({ on: false, changedAt: 0, now: 5000, origin: [0, 0] }).uScan).toBe(0)
  })
  it('reduced motion cross-fades without a sweep', () => {
    const u = scanUniformsAt({ on: true, changedAt: 0, now: 200, origin: [0, 0], reducedMotion: true })
    expect(u.uScanRadius).toBe(Infinity); expect(u.uScan).toBeCloseTo(0.5, 1)
  })
})

describe('scan overlays', () => {
  it('landmark heat peaks where landmarks cluster and is normalised', () => {
    const h = landmarkHeat([[0, 0], [50, 0], [0, 50], [3000, 3000]], { minX: -1000, maxX: 4000, minZ: -1000, maxZ: 4000 }, 100)
    expect(Math.max(...h.data)).toBeCloseTo(1)
    const idx = (x, z) => Math.floor((z + 1000) / 100) * h.cols + Math.floor((x + 1000) / 100)
    expect(h.data[idx(0, 0)]).toBeGreaterThan(h.data[idx(3000, 3000)])
  })
  it('column heights normalise per metric and treat missing data as 0', () => {
    const zones = [{ id: 'a', feel: { transit: 9, nightlife: 2, green: 5 }, rent: { oneBr: 3000 } }, { id: 'b', feel: { transit: 3, nightlife: 8, green: 9 }, rent: null }]
    expect(columnHeights(zones, 'transit').get('a')).toBe(1)
    expect(columnHeights(zones, 'rent').get('b')).toBe(0)
    expect(columnHeights(zones, 'rent').get('a')).toBe(1)
  })
})
