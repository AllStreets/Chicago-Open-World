import { describe, it, expect } from 'vitest'
import { simulatedGames } from '../simSchedule.js'
import { chicagoDate, chicagoParts } from '../chicagoTime.js'

describe('simulatedGames', () => {
  const g = simulatedGames(2026)
  const of = (k) => g.filter((x) => x.teams[0] === k)
  it('is deterministic and covers all seven teams with plausible home counts', () => {
    expect(simulatedGames(2026)).toEqual(g)
    expect(of('cubs').length).toBeGreaterThan(55); expect(of('cubs').length).toBeLessThan(90)
    expect(of('bears').length).toBeGreaterThanOrEqual(6); expect(of('bears').length).toBeLessThanOrEqual(10)
    for (const k of ['whitesox', 'bulls', 'blackhawks', 'fire', 'sky']) expect(of(k).length).toBeGreaterThan(5)
    for (const x of g) expect(x.simulated).toBe(true)
  })
  it('never books two games at one venue on one Chicago date', () => {
    const seen = new Set()
    for (const x of g) { const k = `${x.venue}:${chicagoDate(Date.parse(x.start))}`; expect(seen.has(k), k).toBe(false); seen.add(k) }
  })
  it('keeps Chicago wall-clock start times through DST', () => {
    const jan = of('bulls').find((x) => x.start.startsWith('2026-01'))
    expect(chicagoParts(Date.parse(jan.start)).hour).toBe(19)
    expect(new Date(jan.start).getUTCHours()).toBe(1)
    const jul = of('cubs').find((x) => chicagoDate(Date.parse(x.start)).startsWith('2026-07') && chicagoParts(Date.parse(x.start)).hour === 19)
    expect(jul.start).toMatch(/T00:05:00\.000Z$/)
  })
  it('results agree with the scores', () => {
    for (const x of g) {
      const r = x.results[x.teams[0]]
      expect(r).toBe(x.home.score > x.away.score ? 'W' : x.home.score < x.away.score ? 'L' : 'T')
      if (x.sport !== 'soccer') expect(r).not.toBe('T')
    }
  })
})
