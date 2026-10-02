// F-8: the beach-volleyball nets — decoded from the manifest, picked near/far/none by distance and view, and cheap.
import { describe, it, expect } from 'vitest'
import { decodeNets, pickNets, netGeometry, netTriangles, medianLength, NEAR_M, FAR_M, NET_TOP } from '../beachNets.js'

describe('beach nets', () => {
  const entry = { stride: 5, nets: [0, 0, -0.5, 0, 9.6, 100, 0, -0.6, 1.57, 9.2, 2000, 0, -0.5, 0, 10] }
  it('decodes x, z, y, yaw, length per net; refuses a malformed entry', () => {
    const n = decodeNets(entry)
    expect(n).toHaveLength(3)
    expect(n[1]).toEqual({ x: 100, z: 0, y: -0.6, yaw: 1.57, len: 9.2 })
    expect(decodeNets({ stride: 5, nets: [1, 2, 3] })).toEqual([])
    expect(decodeNets(null)).toEqual([])
    expect(medianLength(n)).toBe(9.6)
  })
  it('near nets cast shadows, far ones do not, none beyond FAR_M or out of view', () => {
    const n = decodeNets(entry)
    expect(NEAR_M).toBeLessThan(FAR_M)
    const { lod0, lod1 } = pickNets(n, [0, 10, 0])
    expect(lod0).toEqual([0, 1]); expect(lod1).toEqual([])
    const far = pickNets(n, [-300, 10, 0])
    expect(far.lod0).toEqual([]); expect(far.lod1).toEqual([0, 1]) // the one 2.3 km off is not drawn
    expect(pickNets(n, [0, 10, 0], { inView: (x) => x > 50 }).lod0).toEqual([1])
  })
  it('is a ~30-triangle model at regulation height', () => {
    const g = netGeometry(9.6)
    expect(netTriangles(g.solid) + netTriangles(g.mesh)).toBeLessThanOrEqual(32)
    g.solid.computeBoundingBox(); g.mesh.computeBoundingBox()
    expect(g.solid.boundingBox.max.x - g.solid.boundingBox.min.x).toBeCloseTo(9.7, 1)
    expect(g.mesh.boundingBox.max.y).toBeLessThan(NET_TOP)
    expect(g.solid.boundingBox.max.y).toBeGreaterThan(NET_TOP)
  })
})
