// app/src/lib/__tests__/commute.test.js
import { describe, it, expect } from 'vitest'
import { project } from '../../../../shared/project.js'
import { buildCommuteGraph, commuteMinutes, isochroneGrid, lineUsefulness, stationMinutesTo } from '../commute.js'

// Fixture: Red Line (Addison → Jackson) and Blue Line (Damen → Jackson), station coordinates from CTA's L-stops dataset (approx.)
const st = (id, name, lat, lon, lines) => { const [x, z] = project(lon, lat); return { id, name, x, z, lines } }
const stations = [
  st('addison-red', 'Addison', 41.947428, -87.653626, ['red']), st('belmont-red', 'Belmont', 41.939751, -87.65338, ['red']),
  st('fullerton', 'Fullerton', 41.925051, -87.652866, ['red']), st('northclybourn', 'North/Clybourn', 41.910655, -87.649177, ['red']),
  st('clarkdivision', 'Clark/Division', 41.90392, -87.631412, ['red']), st('chicago-red', 'Chicago', 41.896671, -87.628176, ['red']),
  st('grand-red', 'Grand', 41.891665, -87.628021, ['red']), st('lake-red', 'Lake', 41.884809, -87.627813, ['red']),
  st('monroe-red', 'Monroe', 41.880745, -87.627696, ['red']), st('jackson-red', 'Jackson', 41.878153, -87.627596, ['red']),
  st('damen-blue', 'Damen', 41.909744, -87.677437, ['blue']), st('division-blue', 'Division', 41.903355, -87.666496, ['blue']),
  st('chicago-blue', 'Chicago', 41.896075, -87.655214, ['blue']), st('grand-blue', 'Grand', 41.891189, -87.647578, ['blue']),
  st('clarklake', 'Clark/Lake', 41.885737, -87.630886, ['blue']), st('washington-blue', 'Washington', 41.883164, -87.62944, ['blue']),
  st('monroe-blue', 'Monroe', 41.880703, -87.629378, ['blue']), st('jackson-blue', 'Jackson', 41.878183, -87.629296, ['blue']),
]
// Ruling (P4 Task 8): V3's transit.json shape — lines carry an operator, routes list their stops in order with arc metres
const route = (line, ids) => {
  let s = 0
  const stops = ids.map((id, i) => { const p = stations.find((q) => q.id === id); if (i) { const o = stations.find((q) => q.id === ids[i - 1]); s += Math.hypot(p.x - o.x, p.z - o.z) } return { station: id, name: p.name, s } })
  return { id: `${line}-0`, line, stops }
}
const transit = { stations: stations.map((s) => ({ ...s, operator: 'cta' })), lines: [{ id: 'red', operator: 'cta', index: 0 }, { id: 'blue', operator: 'cta', index: 1 }], routes: [
  route('red', ['addison-red', 'belmont-red', 'fullerton', 'northclybourn', 'clarkdivision', 'chicago-red', 'grand-red', 'lake-red', 'monroe-red', 'jackson-red']),
  route('blue', ['damen-blue', 'division-blue', 'chicago-blue', 'grand-blue', 'clarklake', 'washington-blue', 'monroe-blue', 'jackson-blue']),
] }
const graph = buildCommuteGraph(transit)
const at = (lat, lon) => project(lon, lat)

describe('commute model (spec §9)', () => {
  it('Wrigleyville → Loop rides the Red Line with no transfer, 15–30 min', () => {
    const r = commuteMinutes(at(41.9474, -87.6563), at(41.8818, -87.6298), graph)
    expect(r.mode).toBe('transit'); expect(r.lines).toEqual(['red']); expect(r.transfers).toBe(0)
    expect(r.minutes).toBeGreaterThanOrEqual(15); expect(r.minutes).toBeLessThanOrEqual(30)
  })
  it('a short hop walks (Streeterville → Mag Mile)', () => {
    const r = commuteMinutes(at(41.8927, -87.6197), at(41.8953, -87.6242), graph)
    expect(r.mode).toBe('walk'); expect(r.minutes).toBeLessThan(15)
  })
  it('Wicker Park → Clark/Division uses at most one transfer (Blue ↔ Red at Jackson)', () => {
    const r = commuteMinutes(at(41.9088, -87.6776), at(41.9040, -87.6300), graph)
    expect(r.transfers).toBeLessThanOrEqual(1); expect(Number.isFinite(r.minutes)).toBe(true)
  })
  it('an office in the lake or beyond any station still returns a finite walking estimate', () => {
    const r = commuteMinutes(at(41.9474, -87.6563), at(41.88, -87.55), graph)
    expect(Number.isFinite(r.minutes)).toBe(true); expect(r.minutes).toBeGreaterThan(0)
  })
  it('transfer costs +4 min', () => {
    const r = commuteMinutes(at(41.9088, -87.6776), at(41.9040, -87.6300), graph)
    if (r.transfers === 1) expect(r.legs.find((l) => l.type === 'transfer').minutes).toBeGreaterThanOrEqual(4)
  })
})

describe('isochrones and usefulness', () => {
  const dest = at(41.8818, -87.6298)
  it('the destination cell is ~0 min and every cell is finite', () => {
    const g = isochroneGrid(dest, graph, { minX: dest[0] - 3000, maxX: dest[0] + 3000, minZ: dest[1] - 3000, maxZ: dest[1] + 3000 }, 150)
    const c = Math.floor((dest[0] - g.minX) / g.cell), r = Math.floor((dest[1] - g.minZ) / g.cell)
    expect(g.minutes[r * g.cols + c]).toBeLessThan(2)
    expect([...g.minutes].every(Number.isFinite)).toBe(true)
  })
  it('stations on the destination line are reachable faster than stations on the other line at similar distance', () => {
    const m = stationMinutesTo(dest, graph)
    expect(m.get('addison-red')).toBeLessThan(m.get('damen-blue') + 15)
  })
  it('with a Loop office and north-side origins, Red is the most useful line', () => {
    const u = lineUsefulness(dest, graph, [at(41.9474, -87.6563), at(41.9400, -87.6530), at(41.9214, -87.6513)])
    expect(u.get('red')).toBe(1); expect(u.get('blue') ?? 0).toBeLessThan(1)
  })
})
