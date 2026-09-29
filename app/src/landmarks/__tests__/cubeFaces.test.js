import { describe, it, expect } from 'vitest'
import { cubeFaceFor, cubeActive, CUBE } from '../cubeFaces.js'
describe('Cloud Gate cube camera budget', () => {
  it('one face per frame for frames 0–5 of every 30, then idle', () => {
    expect([0, 1, 2, 3, 4, 5].map((f) => cubeFaceFor(f))).toEqual([0, 1, 2, 3, 4, 5])
    for (let f = 6; f < 30; f++) expect(cubeFaceFor(f)).toBe(-1)
    expect(cubeFaceFor(30)).toBe(0); expect(cubeFaceFor(65)).toBe(5)
  })
  it('stays correct for huge and negative frame counters', () => {
    const f = cubeFaceFor(Number.MAX_SAFE_INTEGER)
    expect(f >= -1 && f <= 5 && Number.isInteger(f)).toBe(true)
    expect(cubeFaceFor(-30)).toBe(0)
  })
  it('never renders at LOW or when the Bean is far away', () => {
    expect(cubeActive({ quality: 'LOW', camDist: 10 })).toBe(false)
    expect(cubeActive({ quality: 'HIGH', camDist: CUBE.maxDist + 1 })).toBe(false)
    expect(cubeActive({ quality: 'HIGH', camDist: 800 })).toBe(true)
    expect(cubeActive({ quality: 'ULTRA', camDist: 0 })).toBe(true)
  })
})
