import { describe, it, expect } from 'vitest'
import { servicesFor } from '../lib/transit/services.js'

const B = { minX: -5000, maxX: 3000, minZ: -8000, maxZ: 6000 }
const R = (id, line, a, b) => ({ id, line, path: [[a[0], 7, a[1]], [b[0], 7, b[1]]] })

describe('servicesFor — through-routed runs', () => {
  const routes = [
    R('A', 'brown', [-4800, -7800], [0, 0]),     // in from the edge, ends in the Loop
    R('B', 'brown', [0, 50], [-4850, -7000]),    // leaves the Loop back to the edge
    R('C', 'red', [0, -7900], [0, 5900]),        // edge to edge
    R('D', 'pink', [100, 100], [200, 200]),      // a closed pair in the middle
    R('E', 'pink', [200, 210], [100, 110]),
    R('F', 'orange', [10, 10], [-4900, 0]),      // starts next to A's end, but another line
    R('G', 'bnsf', [-4900, 0], [-600, 0]),       // Metra inbound to Union Station
  ]
  const s = servicesFor(routes, B)
  it('a Loop line turns back instead of vanishing; every route is used once', () => {
    expect(s.map((x) => x.routes)).toEqual([['A', 'B'], ['C'], ['F'], ['G'], ['D', 'E']])
    expect(s[0]).toMatchObject({ id: 'svc-A', line: 'brown' })
    expect(s.flatMap((x) => x.routes).sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G'])
  })
  it('inbound = ends nearer downtown than it starts', () => {
    expect(s.find((x) => x.line === 'bnsf').inbound).toBe(true)
    expect(s.find((x) => x.line === 'orange').inbound).toBe(false)
  })
})
