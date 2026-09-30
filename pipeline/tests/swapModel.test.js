// pipeline/tests/swapModel.test.js
import { describe, it, expect } from 'vitest'
import { swapModel } from '../lib/swapModel.js'

const boxMesh = (len, tris) => {
  const positions = []
  for (let i = 0; i < tris; i++) positions.push(0, 0, 0, len, 0, 0, 0, 3, 0)
  return { positions, normals: positions.map(() => 0), uvs: [] }
}
const proc = { mesh: boxMesh(14.6, 2000), lengthM: 14.6, bogies: [2.5, 12.1] }

describe('swapModel', () => {
  it('takes the Blender mesh when its length and triangle count fit', () => {
    const r = swapModel(proc, boxMesh(14.62, 4000), { minTris: 2000, maxTris: 5000 })
    expect(r.source).toBe('blender'); expect(r.bogies).toEqual([2.5, 12.1])
  })
  it('keeps procedural when the length is off by more than 2 %', () => {
    expect(swapModel(proc, boxMesh(16, 4000), { minTris: 2000, maxTris: 5000 }).source).toBe('procedural')
  })
  it('keeps procedural when over the triangle budget or missing', () => {
    expect(swapModel(proc, boxMesh(14.6, 9000), { minTris: 2000, maxTris: 5000 }).source).toBe('procedural')
    expect(swapModel(proc, null, { minTris: 2000, maxTris: 5000 }).source).toBe('procedural')
  })
})
