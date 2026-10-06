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

describe('simulated results are realistic', () => {
  const years = [2025, 2026, 2027].flatMap((y) => simulatedGames(y))
  const of = (k) => years.filter((x) => x.teams[0] === k)
  const RANGES = { cubs: [0, 12], whitesox: [0, 12], bears: [0, 45], bulls: [80, 140], sky: [60, 115], blackhawks: [0, 8], fire: [0, 4] }
  for (const k of Object.keys(RANGES)) {
    it(`${k}: sane win rate, varied margins, plausible scores`, () => {
      const gs = of(k)
      const wins = gs.filter((x) => x.results[k] === 'W').length
      const decided = gs.filter((x) => x.results[k] !== 'T').length
      const rate = wins / decided
      expect(rate, `win rate ${rate}`).toBeGreaterThan(0.35)
      expect(rate, `win rate ${rate}`).toBeLessThan(0.75)
      const margins = gs.map((x) => x.home.score - x.away.score)
      expect(margins.some((m) => m < 0)).toBe(true)
      const pm1 = margins.filter((m) => Math.abs(m) === 1).length / gs.length
      expect(pm1, `share of ±1 margins ${pm1}`).toBeLessThan(0.6)
      expect(new Set(margins.map(Math.abs)).size).toBeGreaterThan(2)
      const [lo, hi] = RANGES[k]
      for (const x of gs) for (const s of [x.home.score, x.away.score]) {
        expect(Number.isInteger(s)).toBe(true)
        expect(s).toBeGreaterThanOrEqual(lo); expect(s).toBeLessThanOrEqual(hi)
      }
      expect(new Set(gs.map((x) => x.home.score)).size).toBeGreaterThan(2)
      if (k !== 'fire') expect(gs.every((x) => x.home.score !== x.away.score)).toBe(true)
      for (const x of gs) { expect(x.home.winner).toBe(x.home.score > x.away.score); expect(x.away.winner).toBe(x.away.score > x.home.score) }
    })
  }
  it('home teams win roughly 55% across all sports', () => {
    const decided = years.filter((x) => x.results[x.teams[0]] !== 'T')
    const rate = decided.filter((x) => x.results[x.teams[0]] === 'W').length / decided.length
    expect(rate).toBeGreaterThan(0.48); expect(rate).toBeLessThan(0.63)
  })
  it('Fire has real draws, but under 40%', () => {
    const gs = of('fire'), d = gs.filter((x) => x.results.fire === 'T').length / gs.length
    expect(d).toBeGreaterThan(0.08); expect(d).toBeLessThan(0.4)
  })
  it('Bears scores look like football (never 1)', () => {
    for (const x of of('bears')) for (const s of [x.home.score, x.away.score]) expect(s).not.toBe(1)
  })
  it('scores are deterministic across runs', () => {
    const again = [2025, 2026, 2027].flatMap((y) => simulatedGames(y)).map((x) => [x.home.score, x.away.score])
    expect(again).toEqual(years.map((x) => [x.home.score, x.away.score]))
  })
})
