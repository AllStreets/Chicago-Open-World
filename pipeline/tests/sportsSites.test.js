import { describe, it, expect } from 'vitest'
import { shuffled } from '../lib/sportsSites.js'

describe('shuffled', () => {
  const list = Array.from({ length: 500 }, (_, i) => i)
  it('is a deterministic permutation', () => {
    const a = shuffled(list, 3)
    expect([...a].sort((x, y) => x - y)).toEqual(list)
    expect(shuffled(list, 3)).toEqual(a)
    expect(shuffled(list, 4)).not.toEqual(a)
    expect(a).not.toEqual(list)
  })
})
