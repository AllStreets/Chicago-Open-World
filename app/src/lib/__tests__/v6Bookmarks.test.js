import { describe, it, expect } from 'vitest'
import { BOOKMARKS } from '../bookmarks.js'
import { VIEW_NAMES } from '../places.js'

export const V6_VIEWS = ['bridges', 'dusable', 'southbranch', 'wells', 'buckingham', 'cloudgate', 'crownfountain', 'lurie', 'bpbridge', 'artinstitute', 'daleyplaza', 'federalplaza', 'culturalcenter', 'unionstation', 'martriver', 'navypierhead', 'ballroom', 'riverwalk', 'zoo']

describe('V6 poses', () => {
  it('every V6 pose exists, is named for ⌘K, looks down at its subject from close by', () => {
    for (const k of V6_VIEWS) {
      const b = BOOKMARKS[k]
      expect(b, k).toBeTruthy()
      expect(VIEW_NAMES[k], k).toBeTruthy()
      expect(b.position[1]).toBeGreaterThan(b.target[1])
      const d = Math.hypot(b.position[0] - b.target[0], b.position[2] - b.target[2])
      expect(d, k).toBeLessThan(700)
    }
  })
  it('D5 / B-8 poses: the lock\'s lake gate, Belmont and Diversey harbours, North Avenue Beach — named for ⌘K, low over the water', () => {
    for (const k of ['harborlock', 'belmontharbor', 'diverseyharbor', 'northavebeach']) {
      expect(BOOKMARKS[k], k).toBeTruthy(); expect(VIEW_NAMES[k], k).toBeTruthy()
      expect(BOOKMARKS[k].position[1]).toBeGreaterThanOrEqual(30); expect(BOOKMARKS[k].position[1]).toBeLessThan(120)
    }
  })
  it('the DuSable pose looks at the bridge where OSM puts it (287, −757)', () => {
    expect(BOOKMARKS.dusable.target[0]).toBe(287)
    expect(BOOKMARKS.dusable.target[2]).toBe(-757)
  })
})
