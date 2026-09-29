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
