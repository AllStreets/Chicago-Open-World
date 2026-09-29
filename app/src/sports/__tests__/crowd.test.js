import { describe, it, expect } from 'vitest'
import { shirtColors, crowdDensity, plazaDensity, lifeVisible, shownCount, flagMask, homeTeamFor, celebration } from '../crowd.js'
import { plazaCount } from '../crowd.js'

describe('crowd', () => {
  it('shirts are weighted to the home team, deterministic', () => {
    const s = shirtColors(20000, ['#0E3386', '#CC3433'], ['#9A9CA0', '#F2F2F0'], 1)
    const share = (c) => s.filter((x) => x === c).length / s.length
    expect(share('#0E3386')).toBeGreaterThan(0.40); expect(share('#0E3386')).toBeLessThan(0.44)
    expect(share('#CC3433')).toBeGreaterThan(0.16); expect(share('#CC3433')).toBeLessThan(0.20)
    expect(shirtColors(20000, ['#0E3386', '#CC3433'], ['#9A9CA0', '#F2F2F0'], 1)).toEqual(s)
  })
  it('density follows the game state, and attendance when known', () => {
    expect(crowdDensity('idle', null, 41649)).toBe(0)
    expect(crowdDensity('pregame', null, 41649)).toBe(0.35)
    expect(crowdDensity('live', { attendance: null }, 41649)).toBe(0.92)
    expect(crowdDensity('live', { attendance: 20824 }, 41649)).toBeCloseTo(0.5, 2)
    expect(crowdDensity('live', { attendance: 5000 }, 41649)).toBe(0.3)
    expect(plazaDensity('pregame')).toBe(0.8); expect(plazaDensity('idle')).toBe(0)
  })
  it('life is culled beyond 1.5 km and off at LOW', () => {
    expect(lifeVisible([0, 100, 1400], [0, 0], 'HIGH')).toBe(true)
    expect(lifeVisible([0, 100, 1600], [0, 0], 'HIGH')).toBe(false)
    expect(lifeVisible([0, 100, 10], [0, 0], 'LOW')).toBe(false)
  })
  it('shows a clamped prefix; a quarter of fans carry flags', () => {
    expect(shownCount(1000, 0.35)).toBe(350); expect(shownCount(1000, 2)).toBe(1000); expect(shownCount(1000, -1)).toBe(0)
    const m = flagMask(8000)
    const share = m.reduce((s, x) => s + x, 0) / m.length
    expect(share).toBeGreaterThan(0.23); expect(share).toBeLessThan(0.27)
  })
  it('the home side is the game’s Chicago team, else the venue’s first team', () => {
    const uc = { key: 'unitedcenter', teams: ['bulls', 'blackhawks'] }
    expect(homeTeamFor(uc, { game: { teams: ['blackhawks'] } }).key).toBe('blackhawks')
    expect(homeTeamFor(uc, { game: null, next: { teams: ['blackhawks'] } }).key).toBe('blackhawks')
    expect(homeTeamFor(uc, undefined).key).toBe('bulls')
  })
  it('a Cubs W day fills Wrigley with flag-waving fans, stands and field', () => {
    expect(celebration('wrigleyfield', { winDay: true })).toEqual({ wave: 1, fans: 160, minDensity: 0.15 })
    expect(celebration('wrigleyfield', { winDay: false, lossDay: true })).toEqual({ wave: 0, fans: 0, minDensity: 0 })
    expect(celebration('ratefield', { winDay: true })).toEqual({ wave: 0, fans: 0, minDensity: 0 })
  })
})

describe('arena plaza', () => {
  const uc = { key: 'unitedcenter', teams: ['bulls', 'blackhawks'], plazaCount: 1000 }
  it('fills before and after a game, empties during it and when idle', () => {
    expect(plazaCount(uc, { state: 'pregame' })).toBe(800)
    expect(plazaCount(uc, { state: 'live' })).toBe(80)
    expect(plazaCount(uc, { state: 'postgame' })).toBe(900)
    expect(plazaCount(uc, { state: 'idle' })).toBe(0)
    expect(plazaCount(uc, undefined)).toBe(0)
  })
})
