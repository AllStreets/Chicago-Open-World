// app/src/lib/__tests__/neighborhoods.test.js
import { describe, it, expect } from 'vitest'
import { zoneAt, rentRangeLabel } from '../neighborhoods.js'

const zones = [{ id: 'loop', ring: [[0, 0], [100, 0], [100, 100], [0, 100]] }, { id: 'west', ring: [[-100, 0], [0, 0], [0, 100], [-100, 100]] }]
describe('neighbourhood helpers', () => {
  it('finds the zone under a point, or null', () => {
    expect(zoneAt(50, 50, zones).id).toBe('loop'); expect(zoneAt(-50, 50, zones).id).toBe('west'); expect(zoneAt(500, 500, zones)).toBeNull()
  })
  it('formats rent ranges honestly', () => {
    expect(rentRangeLabel({ studio: 1600, oneBr: 2100, twoBr: 3000 })).toBe('Studio $1.6k · 1BR $2.1k · 2BR $3.0k')
    expect(rentRangeLabel({ oneBr: 2400 })).toBe('1BR ≈ $2.4k (indicative)')
    expect(rentRangeLabel(null)).toBe('Rent data unavailable')
  })
})

import { zoneForName } from '../neighborhoods.js'
describe('⌘K neighbourhood rows find their LIVE zone', () => {
  const zones = [{ id: 'loop', name: 'The Loop' }, { id: 'little-italy', name: 'Little Italy & UIC' }, { id: 'boystown', name: 'Northalsted' }, { id: 'pilsen', name: 'Pilsen' }]
  it('matches exact, partial and article-less names; null when there is no zone', () => {
    expect(zoneForName('The Loop', zones).id).toBe('loop')
    expect(zoneForName('Loop', zones).id).toBe('loop')
    expect(zoneForName('Little Italy', zones).id).toBe('little-italy')
    expect(zoneForName('Pilsen', zones).id).toBe('pilsen')
    expect(zoneForName('Navy Pier', zones)).toBeNull()
  })
})
