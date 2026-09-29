import { describe, it, expect } from 'vitest'
import { fieldMarks, FIELD_COLORS as C } from '../fieldMarks.js'

const FB = { u0: -75, u1: 75, v0: -37.5, v1: 37.5, ring: [], origin: [0, 0], axis: [0, -1] }
const sq = (u0, v0, u1, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]
const BB = { u0: -24, u1: 132, v0: -96, v1: 96, origin: [0, 0], axis: [0.707, -0.707], ring: sq(-18, -85, 122, 85), grassRing: sq(-13, -80, 117, 80) }
const pts = (ops) => ops.flatMap((o) => o.pts ?? (o.at ? [o.at] : []))
const texts = (ops) => ops.filter((o) => o.op === 'text')

describe('fieldMarks', () => {
  it('football: 21 yard lines sideline to sideline, navy end zones, BEARS north and CHICAGO south', () => {
    const ops = fieldMarks('football', FB)
    const yard = ops.filter((o) => o.op === 'line' && o.pts.length === 2 && o.pts[0][0] === o.pts[1][0] && Math.abs(o.pts[0][1] - o.pts[1][1]) > 40)
    expect(yard).toHaveLength(21)
    expect(yard.filter((o) => o.width > 0.2)).toHaveLength(2) // goal lines are 8 in
    const zones = ops.filter((o) => o.op === 'poly' && o.color === C.bearsNavy && o.pts.some((p) => Math.abs(p[0]) > 40)) // end zones, not the C's keyline
    expect(zones).toHaveLength(2)
    expect(Math.max(...zones.flatMap((z) => z.pts.map((p) => Math.abs(p[0]))))).toBeCloseTo(54.864, 2)
    const bears = texts(ops).find((t) => t.text === 'BEARS'), chicago = texts(ops).find((t) => t.text === 'CHICAGO')
    expect(bears.at[0]).toBeGreaterThan(45.7); expect(bears.angle).toBeCloseTo(-Math.PI / 2)
    expect(chicago.at[0]).toBeLessThan(-45.7); expect(chicago.angle).toBeCloseTo(Math.PI / 2)
    expect(bears.stroke).toBe(C.bearsOrange)
  })
  it('football: 18 yard numbers, 6 ft tall, centred 10 yd in from each sideline, reading toward the sideline', () => {
    const nums = texts(fieldMarks('football', FB)).filter((t) => /^\d0$/.test(t.text))
    expect(nums).toHaveLength(18)
    expect(nums.filter((t) => t.text === '50')).toHaveLength(2)
    for (const n of nums) { expect(n.size).toBeCloseTo(1.8288, 4); expect(Math.abs(n.at[1])).toBeCloseTo(15.24, 2); expect(n.angle).toBeCloseTo(n.at[1] > 0 ? 0 : Math.PI) }
  })
  it('football: a midfield C in Bears orange', () => {
    const c = fieldMarks('football', FB).filter((o) => o.op === 'poly' && o.color === C.bearsOrange)
    expect(c).toHaveLength(1)
    for (const [u, v] of c[0].pts) expect(Math.hypot(u, v)).toBeLessThan(4.7)
  })
  it('soccer: 105 × 68 m touchlines, a 9.15 m centre circle', () => {
    const ops = fieldMarks('soccer', FB)
    const lines = ops.filter((o) => o.op === 'line')
    const outer = lines.find((o) => o.closed && Math.max(...o.pts.map((p) => p[0])) === 52.5)
    expect(Math.max(...outer.pts.map((p) => p[1]))).toBe(34)
    const circle = lines.find((o) => o.closed && o.pts.every((p) => Math.abs(Math.hypot(p[0], p[1]) - 9.15) < 1e-9))
    expect(circle).toBeTruthy()
  })
  it('baseball: the mound, bases and foul lines at MLB distances', () => {
    const ops = fieldMarks('baseball-wrigley', BB)
    const mound = ops.find((o) => o.part === 'mound')
    const mc = mound.pts.reduce((s, p) => [s[0] + p[0] / mound.pts.length, s[1] + p[1] / mound.pts.length], [0, 0])
    expect(mc[0]).toBeCloseTo(18.44, 1); expect(mc[1]).toBeCloseTo(0, 1)
    const bases = ops.filter((o) => o.part === 'base').map((o) => o.pts.reduce((s, p) => [s[0] + p[0] / 4, s[1] + p[1] / 4], [0, 0]))
    expect(bases).toHaveLength(3)
    const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.05
    expect(bases.some((b) => near(b, [19.397, -19.397]))).toBe(true) // first base, right-field side
    expect(bases.some((b) => near(b, [38.795, 0]))).toBe(true)
    expect(bases.some((b) => near(b, [19.397, 19.397]))).toBe(true)
    const foul = ops.filter((o) => o.part === 'foul')
    expect(foul).toHaveLength(2)
    for (const f of foul) expect(Math.abs(Math.atan2(f.pts[1][1], f.pts[1][0]))).toBeCloseTo(Math.PI / 4, 3)
  })
  it('Wrigley on-deck circles are Cubs blue; Rate Field is black and silver, with SOX behind the plate', () => {
    expect(fieldMarks('baseball-wrigley', BB).filter((o) => o.part === 'ondeck').map((o) => o.color)).toEqual([C.cubsBlue, C.cubsBlue])
    const sox = fieldMarks('baseball-sox', BB)
    expect(sox.filter((o) => o.part === 'ondeck').map((o) => o.color)).toEqual([C.soxBlack, C.soxBlack])
    const t = texts(sox).find((x) => x.text === 'SOX')
    expect(t).toMatchObject({ color: C.soxBlack, stroke: C.soxSilver })
    expect(t.at[0]).toBeLessThan(-5)
  })
  it('every placed mark and every word lies inside its frame (mowing patterns are clipped, so they may overhang)', () => {
    for (const [layout, f] of [['football', FB], ['soccer', FB], ['baseball-wrigley', BB], ['baseball-sox', BB]]) {
      const placed = fieldMarks(layout, f).filter((o) => o.part || o.op === 'text' || (layout !== 'football' && o.op === 'line'))
      for (const [u, v] of pts(placed)) { expect(u, layout).toBeGreaterThan(f.u0); expect(u, layout).toBeLessThan(f.u1); expect(Math.abs(v), layout).toBeLessThan(f.v1) }
    }
  })
})
