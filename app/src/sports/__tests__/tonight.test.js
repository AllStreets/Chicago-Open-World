import { describe, it, expect, beforeEach } from 'vitest'
import { tonightsGame, stateLabel, gameLabel, dataChip } from '../tonight.js'
import { venueFocusPose } from '../venueFocus.js'
import { gamePlaces } from '../palette.js'
import { useStore } from '../../state/store.js'
import { useSports } from '../sportsStore.js'

const W = { key: 'wrigleyfield', name: 'Wrigley Field', kind: 'baseball', teams: ['cubs'], center: [-2292, -7339], frame: { origin: [-2325, -7319], axis: [0.70711, -0.70711] } }
const U = { key: 'unitedcenter', name: 'United Center', kind: 'arena', teams: ['bulls', 'blackhawks'], center: [-3842, 147], frame: null }
const S = { key: 'soldierfield', name: 'Soldier Field', kind: 'football', teams: ['bears', 'fire'], center: [928, 2187], frame: { origin: [929, 2196], axis: [-0.07324, -0.99731] } }
const g = (o) => ({ id: 'x', sport: 'baseball', start: '2026-07-10T00:05:00Z', home: { abbr: 'CHC' }, away: { abbr: 'MIL' }, teams: ['cubs'], ...o })
const now = Date.parse('2026-07-09T18:00:00Z') // Thu 13:00 CDT

describe('tonight', () => {
  it('prefers a live game, then pregame, then later today, then the next one', () => {
    expect(tonightsGame([W, U], { wrigleyfield: { state: 'pregame', game: g() }, unitedcenter: { state: 'live', game: g({ sport: 'basketball' }) } }, now)).toMatchObject({ venue: U, state: 'live' })
    expect(tonightsGame([W, U], { wrigleyfield: { state: 'idle', game: null, next: g() }, unitedcenter: { state: 'idle', game: null, next: g({ start: '2026-07-12T00:00:00Z' }) } }, now)).toMatchObject({ venue: W, state: 'later' })
    expect(tonightsGame([U], { unitedcenter: { state: 'idle', game: null, next: g({ start: '2026-07-12T00:00:00Z' }) } }, now)).toMatchObject({ state: 'upcoming' })
    expect(tonightsGame([W], { wrigleyfield: { state: 'idle', game: null, next: null } }, now)).toBeNull()
  })
  it('labels', () => {
    expect(stateLabel({ state: 'live' })).toBe('LIVE'); expect(stateLabel({ state: 'postgame' })).toBe('FINAL')
    expect(stateLabel({ state: 'idle', next: g() }, now)).toMatch(/^NEXT (TONIGHT|TOMORROW|[A-Z]{3} [A-Z]{3} \d+) 7:05 PM$/) // dated (V5 review #1); expect(stateLabel(undefined)).toBe('NO GAMES')
    expect(gameLabel(g())).toBe('MIL @ CHC')
    expect(dataChip({ game: g({ simulated: true }) }, 'LIVE')).toBe('SIMULATED'); expect(dataChip({ game: g() }, 'LIVE')).toBe('ESPN') // provenance, never confused with a game in progress
  })
  it('venue focus: above the rim, looking into the bowl', () => {
    const b = venueFocusPose(W), f = venueFocusPose(S), a = venueFocusPose(U)
    expect(b.position[1]).toBeGreaterThanOrEqual(90)
    expect((b.position[0] - W.frame.origin[0]) * W.frame.axis[0] + (b.position[2] - W.frame.origin[1]) * W.frame.axis[1]).toBeLessThan(-100) // behind home plate
    expect(Math.hypot(b.target[0] - W.center[0], b.target[2] - W.center[1])).toBeLessThan(80)
    expect(f.position[0]).toBeLessThan(S.frame.origin[0] - 150) // off the west sideline
    expect(a.position[1]).toBeGreaterThanOrEqual(150)
  })
})

describe('gamePlaces', () => {
  beforeEach(() => { useStore.setState(useStore.getInitialState()); useSports.setState(useSports.getInitialState()) })
  it('offers tonight’s game first, the panel, and one entry per venue', () => {
    const p = gamePlaces({ venues: [W, U], states: { wrigleyfield: { state: 'pregame', game: g() }, unitedcenter: { state: 'idle' } }, nowMs: now })
    expect(p.map((x) => x.id)).toEqual(['g:tonight', 'g:panel', 'g:wrigleyfield', 'g:unitedcenter'])
    expect(p[0]).toMatchObject({ kind: 'game', name: "Go to tonight's game" })
    expect(p[0].sub).toContain('MIL @ CHC')
    expect(p[2].aliases).toEqual(['Cubs'])
    p[0].run()
    expect(useStore.getState().flight.to).toEqual(venueFocusPose(W))
    expect(useSports.getState().cardVenue).toBe('wrigleyfield')
  })
  it('with no game anywhere, "tonight" opens the games panel', () => {
    const p = gamePlaces({ venues: [], states: {}, nowMs: now })
    p[0].run()
    expect(useStore.getState().gamesOpen).toBe(true)
  })
})
