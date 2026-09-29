import { describe, it, expect } from 'vitest'
import { gradeOf, refineGrades, heightProfile, RAIL_TOP_Y, AT_GRADE_Y, SUBWAY_Y, RAMP_SLOPE } from '../lib/transit/grade.js'

describe('gradeOf — OSM tags → grade', () => {
  it.each([
    [{ railway: 'subway', bridge: 'yes', layer: '2' }, 'elevated'],     // the L: CTA tracks are tagged railway=subway even when elevated
    [{ railway: 'subway', bridge: 'viaduct' }, 'elevated'],
    [{ railway: 'subway', layer: '1' }, 'elevated'],
    [{ railway: 'subway', tunnel: 'yes', layer: '-2' }, 'subway'],
    [{ railway: 'subway', location: 'underground' }, 'subway'],
    [{ railway: 'rail', layer: '-1' }, 'subway'],
    [{ railway: 'rail', embankment: 'yes' }, 'embankment'],
    [{ railway: 'rail', layer: '1' }, 'embankment'],
    [{ railway: 'rail', bridge: 'yes', layer: '1' }, 'elevated'],
    [{ railway: 'rail', cutting: 'yes' }, 'at_grade'],
    [{ railway: 'subway' }, 'at_grade'],                                 // Dan Ryan / Kennedy medians
    [{ railway: 'rail', bridge: 'no', tunnel: 'no' }, 'at_grade'],
  ])('%j → %s', (tags, grade) => expect(gradeOf(tags)).toBe(grade))
})

describe('refineGrades', () => {
  const seg = (grade, len, rail = true) => ({ grade, len, rail })
  it('a short at-grade gap between Metra viaducts is embankment; a long one stays at grade', () => {
    expect(refineGrades([seg('elevated', 30), seg('at_grade', 300), seg('elevated', 30)])).toEqual(['elevated', 'embankment', 'elevated'])
    expect(refineGrades([seg('elevated', 30), seg('at_grade', 900), seg('elevated', 30)])).toEqual(['elevated', 'at_grade', 'elevated'])
  })
  it('a 40 m bridge on an at-grade CTA line stays at grade (no 7 m hump)', () => {
    expect(refineGrades([seg('at_grade', 400, false), seg('elevated', 40, false), seg('at_grade', 400, false)])).toEqual(['at_grade', 'at_grade', 'at_grade'])
    expect(refineGrades([seg('elevated', 40, false), seg('at_grade', 400, false)])).toEqual(['at_grade', 'at_grade'])
    expect(refineGrades([seg('elevated', 400, false), seg('at_grade', 400, false)])).toEqual(['elevated', 'at_grade'])
  })
})

describe('heightProfile', () => {
  const line = Array.from({ length: 101 }, (_, i) => [i * 10, 0])
  const slopeOk = (pts, y) => pts.slice(1).every((p, i) => Math.abs(y[i + 1] - y[i]) <= RAMP_SLOPE * Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]) + 0.011)
  it('elevated → subway: holds the deck, then ramps down into the portal on the subway side', () => {
    const grades = [...Array(50).fill('elevated'), ...Array(50).fill('subway')]
    const y = heightProfile(line, grades, 'cta')
    expect(y[0]).toBe(RAIL_TOP_Y.cta); expect(y[50]).toBe(RAIL_TOP_Y.cta)
    expect(y[51]).toBeCloseTo(RAIL_TOP_Y.cta - 0.4, 2)
    expect(y[100]).toBe(SUBWAY_Y)
    expect(slopeOk(line, y)).toBe(true)
  })
  it('at grade next to elevated rises on the at-grade side; never jumps', () => {
    const grades = [...Array(50).fill('at_grade'), ...Array(50).fill('elevated')]
    const y = heightProfile(line, grades, 'metra')
    expect(y[0]).toBe(AT_GRADE_Y); expect(y[100]).toBe(RAIL_TOP_Y.metra)
    expect(y[40]).toBeCloseTo(RAIL_TOP_Y.metra - 0.04 * 100, 2)
    expect(slopeOk(line, y)).toBe(true)
  })
})
