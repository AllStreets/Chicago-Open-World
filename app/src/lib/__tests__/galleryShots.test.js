import { describe, it, expect } from 'vitest'
import { galleryFile, parseGallery, refuseOverwrite } from '../galleryShots.js'

describe('gallery shots', () => {
  it('names new gallery images v<N>-<subject>-<time>.png', () => {
    expect(galleryFile({ milestone: 'v6', subject: 'bridges-before', time: 'day' })).toBe('docs/screenshots/v6-bridges-before-day.png')
    expect(galleryFile({ dir: '/tmp/x', milestone: 'v6', subject: 'dusable', time: 'night' })).toBe('/tmp/x/v6-dusable-night.png')
  })
  it('rejects names that would not sort or read cleanly', () => {
    expect(() => galleryFile({ milestone: 'V6', subject: 'a', time: 'day' })).toThrow(/milestone/)
    expect(() => galleryFile({ milestone: 'v6', subject: 'Bridges Before', time: 'day' })).toThrow(/subject/)
    expect(() => galleryFile({ milestone: 'v6', subject: 'a', time: 'noon' })).toThrow(/time/)
  })
  it('parses view:subject@time lists', () => {
    expect(parseGallery('river:bridges-before@day, dusable:dusable-before@night')).toEqual([
      { view: 'river', subject: 'bridges-before', time: 'day' },
      { view: 'dusable', subject: 'dusable-before', time: 'night' },
    ])
    expect(() => parseGallery('river@day')).toThrow(/view:subject@time/)
  })
  it('never overwrites an existing README image', () => {
    expect(() => refuseOverwrite('docs/screenshots/phase2-loop-day.png', () => true)).toThrow(/already exists/)
    expect(refuseOverwrite('docs/screenshots/v6-new-day.png', () => false)).toBe('docs/screenshots/v6-new-day.png')
  })
})

import { SPORTS_GALLERY, sportsShotQuery } from '../galleryShots.js'
describe('sports gallery poses (E3-4 / E4-6)', () => {
  it('every subject is kebab-case with a full pose; the query pins the pose, time and venue state', () => {
    for (const [k, v] of Object.entries(SPORTS_GALLERY)) { expect(k).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/); expect(v.pose.position).toHaveLength(3); expect(v.pose.target).toHaveLength(3) }
    expect(sportsShotQuery(SPORTS_GALLERY['united-center-live'], 'night')).toBe('pose=-3655,88,375,-3846,44,150&time=night&stats&sports=live:bulls')
  })
})

import { RIVER_GALLERY, riverShotQuery } from '../galleryShots.js'
describe('river gallery poses (A-0)', () => {
  it('eight kebab-case river poses, each a full pose the query pins', () => {
    expect(Object.keys(RIVER_GALLERY)).toHaveLength(8)
    for (const [k, v] of Object.entries(RIVER_GALLERY)) { expect(k).toMatch(/^river[a-z0-9]+$/); expect(v.position).toHaveLength(3); expect(v.target).toHaveLength(3) }
    expect(riverShotQuery(RIVER_GALLERY.rivermouth, 'night')).toBe('pose=2150,90,-600,1500,10,-720&time=night')
  })
})
