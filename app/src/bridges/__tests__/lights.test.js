import { describe, it, expect } from 'vitest'
import { lightColour, lightPosition } from '../lights.js'
describe('bridge lights', () => {
  it('nav lights read red while the leaf is down and green once it is open to boats', () => {
    expect(lightColour('nav', 0)[0]).toBeGreaterThan(0.9)
    expect(lightColour('nav', (70 * Math.PI) / 180)[1]).toBeGreaterThan(0.9)
    expect(lightColour('pier', 1.2)[0]).toBeGreaterThan(0.9)
    const w = lightColour('lantern', 0); expect(w[0]).toBeGreaterThan(w[2])
  })
  it('a nav light rides its leaf; fixed lights stay put', () => {
    const leaves = [{ bridge: 'x', pivot: [0, -1, 0], k: [-1, 0, 0] }]
    const up = lightPosition({ p: [0, 1, 30], kind: 'nav', leaf: 0 }, leaves, { x: Math.PI / 2 })
    expect(up[1]).toBeGreaterThan(25)
    expect(lightPosition({ p: [5, 1, 5], kind: 'pier' }, leaves, { x: 1 })).toEqual([5, 1, 5])
  })
})
