import { describe, it, expect } from 'vitest'
import { assembleRings } from '../lib/multipolygon.js'

describe('assembleRings', () => {
  it('joins two open halves (one reversed) into one ring', () => {
    const a = [[0, 0], [10, 0], [10, 10]]
    const b = [[0, 0], [0, 10], [10, 10]] // shares both endpoints, opposite direction
    const rings = assembleRings([a, b])
    expect(rings).toHaveLength(1)
    expect(rings[0]).toHaveLength(4)
  })
  it('keeps already-closed ways as their own ring', () => {
    const closed = [[0, 0], [1, 0], [1, 1], [0, 0]]
    expect(assembleRings([closed])).toEqual([[[0, 0], [1, 0], [1, 1]]])
  })
  it('drops fragments that never close', () => {
    expect(assembleRings([[[0, 0], [1, 0]], [[5, 5], [6, 6]]])).toEqual([])
  })
})
