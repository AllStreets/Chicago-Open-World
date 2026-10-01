// pipeline/tests/zoo.test.js — Lincoln Park Zoo (Workstream B): the zoo's builders live in zoo.js (B-1).
import { describe, it, expect } from 'vitest'
import { ZOO_BUILDERS } from '../lib/zoo.js'
import { buildLandmark } from '../lib/landmarks.js'

const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]
const B = (outer, o = {}) => ({ id: 't', height: 11, polygons: [{ outer, holes: [] }], centroid: [(outer[0][0] + outer[2][0]) / 2, (outer[0][1] + outer[2][1]) / 2], area: Math.abs((outer[2][0] - outer[0][0]) * (outer[2][1] - outer[0][1])), ...o })

describe('zoo.js (B-1)', () => {
  it('routes the Lion House through the zoo module', () => {
    expect(Object.keys(ZOO_BUILDERS)).toContain('lionHouse')
    const r = buildLandmark(B(rect(0, 0, 66, 25)), { type: 'lionHouse', roofRise: 5 })
    expect(r.meshes.length).toBeGreaterThan(0)
  })
})
