// Team lights: win nights per team (Chicago date, final time, sunset, 2 a.m.), several winners, the showcase, the
// preview, colours, the building zones, the remembered switch, the safe key and the ⌘K rows.
import { describe, it, expect, beforeEach } from 'vitest'
import { TEAMS } from '../../../../shared/teams.js'
import { chicagoToUtc, addDays } from '../chicagoTime.js'
import { SPORT_MINUTES } from '../gameState.js'
import {
  TEAM_LIGHT, LIT_BUILDINGS, zoneTable, ZONE_SLOTS, MODE_CODE, finalAt, winWindow, winningTeams, showcaseWinner, resolveLights,
  sunsetMs, ROTATE_MS, PREVIEW_MS, loadLightsOn, saveLightsOn, STORAGE_KEY, litNote, LIGHTS_UNTIL_HOUR,
} from '../teamLights.js'
import { simulatedGames } from '../simSchedule.js'
import { showcaseState } from '../showcase.js'
import { overrideStates, parseOverride } from '../venueStates.js'
import { useTeamLights } from '../teamLightsStore.js'
import { FEATURE_KEY_CODES, KEEP_CAMERA_CODES } from '../../lib/cameraKeepKeys.js'

const H = 3600000
const game = (team, date, hour, result, extra = {}) => {
  const t = TEAMS.find((x) => x.key === team)
  return { id: `${team}-${date}`, teams: [team], results: { [team]: result }, sport: t.sport, league: t.league, start: new Date(chicagoToUtc(date, hour)).toISOString(), venue: t.home, simulated: false, ...extra }
}
const endOf = (g) => Date.parse(g.start) + SPORT_MINUTES[g.sport] * 60000

describe('win night per team', () => {
  for (const t of TEAMS) {
    it(`${t.name}: a night win lights from the final to 2 a.m. the next Chicago morning`, () => {
      const g = game(t.key, '2026-10-05', 19, 'W')
      const fin = endOf(g)
      expect(winningTeams([g], fin - 60000)).toEqual([])                       // still playing
      expect(winningTeams([g], fin + 60000)).toEqual([{ team: t.key, simulated: false }])
      const two = chicagoToUtc('2026-10-06', LIGHTS_UNTIL_HOUR)
      expect(winningTeams([g], two - 60000).map((w) => w.team)).toEqual([t.key])
      expect(winningTeams([g], two)).toEqual([])                               // 2:00 a.m.: dark again
    })
  }
  it('a loss, a tie, a postponement never light', () => {
    const at = chicagoToUtc('2026-10-05', 23)
    expect(winningTeams([game('cubs', '2026-10-05', 19, 'L')], at)).toEqual([])
    expect(winningTeams([game('fire', '2026-10-05', 19, 'T')], at)).toEqual([])
    expect(winningTeams([game('bears', '2026-10-05', 19, 'W', { status: 'STATUS_POSTPONED' })], at)).toEqual([])
  })
  it('a day game lights from sunset, not the final', () => {
    const g = game('cubs', '2026-10-05', 13, 'W'), set = sunsetMs('2026-10-05')
    expect(endOf(g)).toBeLessThan(set)
    expect(winWindow(g, 'cubs', set + H).from).toBe(set)
    expect(winningTeams([g], set - 60000)).toEqual([])
    expect(winningTeams([g], set + 60000).map((w) => w.team)).toEqual(['cubs'])
  })
  it('a live final counts from the report, before the likely end', () => {
    const g = game('bulls', '2026-10-05', 19, 'W', { live: { state: 'post', at: chicagoToUtc('2026-10-05', 21) } })
    expect(finalAt(g, chicagoToUtc('2026-10-05', 21, 5))).toBe(chicagoToUtc('2026-10-05', 21))
    expect(winningTeams([g], chicagoToUtc('2026-10-05', 21, 5)).map((w) => w.team)).toEqual(['bulls'])
    expect(finalAt({ ...g, live: { state: 'in' } }, Date.now())).toBeNull()
  })
  it('uses the Chicago date: yesterday’s win is over at 2 a.m., not at UTC midnight', () => {
    const g = game('sky', '2026-07-10', 19, 'W')
    expect(winningTeams([g], Date.parse('2026-07-11T05:30:00Z')).map((w) => w.team)).toEqual(['sky']) // 0:30 a.m. CDT
    expect(winningTeams([g], Date.parse('2026-07-11T07:30:00Z'))).toEqual([])                         // 2:30 a.m. CDT
    expect(winningTeams([g], chicagoToUtc('2026-07-11', 21))).toEqual([])                              // the next night
  })
  it('several winners in TEAMS order, rotating every 12 s', () => {
    const at = chicagoToUtc('2026-10-05', 23, 30)
    const w = winningTeams([game('bulls', '2026-10-05', 19, 'W'), game('cubs', '2026-10-05', 18, 'W'), game('bears', '2026-10-05', 12, 'W')], at)
    expect(w.map((x) => x.team)).toEqual(['cubs', 'bears', 'bulls'])
    const base = Math.floor(at / ROTATE_MS) * ROTATE_MS
    const seq = [0, 1, 2, 3].map((i) => resolveLights({ winners: w, nowMs: base + i * ROTATE_MS }).team)
    expect(new Set(seq.slice(0, 3)).size).toBe(3)
    expect(seq[3]).toBe(seq[0])
  })
  it('simulated wins count only when the whole schedule is simulated, and say so', () => {
    const g = { ...game('cubs', '2026-10-05', 19, 'W'), simulated: true }, at = chicagoToUtc('2026-10-05', 23)
    expect(winningTeams([g], at, { source: 'LIVE' })).toEqual([])
    expect(winningTeams([g], at, { source: 'SIMULATED' })).toEqual([{ team: 'cubs', simulated: true }])
    expect(litNote(resolveLights({ winners: [{ team: 'cubs', simulated: true }], nowMs: at }))).toMatch(/Cubs win \(simulated schedule\)/)
  })
  it('the simulated calendar finds win nights for the teams', () => {
    const games = simulatedGames(2026), lit = new Set()
    for (let d = 0; d < 365; d += 1) {
      const at = chicagoToUtc(addDays('2026-01-01', d), 23, 45)
      for (const w of winningTeams(games, at, { source: 'SIMULATED' })) lit.add(w.team)
    }
    // every team the calendar gives a home win (its simulated Fire matches happen to be all draws)
    const winners = new Set(games.filter((g) => g.results[g.teams[0]] === 'W' && g.start < '2026-12-31').map((g) => g.teams[0]))
    expect([...lit].sort()).toEqual([...winners].sort())
    expect(lit.size).toBeGreaterThanOrEqual(6)
  })
  it('a test override lights the named team; idle lights nothing (hero-view baselines)', () => {
    expect(winningTeams([], 0, { override: parseOverride('win:bears') })).toEqual([{ team: 'bears', simulated: true }])
    expect(winningTeams([], 0, { override: parseOverride('win') })).toEqual([{ team: 'cubs', simulated: true }])
    expect(winningTeams([game('cubs', '2026-10-05', 19, 'W')], chicagoToUtc('2026-10-05', 23), { override: parseOverride('idle') })).toEqual([])
  })
})

describe('what the buildings show', () => {
  const venue = { key: 'soldierfield', name: 'Soldier Field', teams: ['bears', 'fire'] }
  it('the Play a game showcase lights its team during the final only', () => {
    const t0 = 1_000_000
    const live = showcaseState(venue, 'bears', t0, t0 + 40000), final = showcaseState(venue, 'bears', t0, t0 + 80000)
    expect(showcaseWinner({ soldierfield: live })).toBeNull()
    expect(showcaseWinner({ soldierfield: final })).toBe('bears')
    expect(showcaseWinner(overrideStates([{ ...venue, center: [0, 0] }], { mode: 'win', team: 'bears' }, t0))).toBeNull() // not a showcase
  })
  it('preview > showcase > win; the switch turns off all but a preview', () => {
    const winners = [{ team: 'cubs', simulated: false }], now = 5000
    expect(resolveLights({ winners, nowMs: now })).toMatchObject({ team: 'cubs', why: 'win' })
    expect(resolveLights({ winners, showcaseTeam: 'whitesox', nowMs: now })).toMatchObject({ team: 'whitesox', why: 'showcase' })
    expect(resolveLights({ winners, showcaseTeam: 'whitesox', preview: { team: 'sky', until: now + 1 }, nowMs: now })).toMatchObject({ team: 'sky', why: 'preview' })
    expect(resolveLights({ on: false, winners, showcaseTeam: 'bears', nowMs: now })).toBeNull()
    expect(resolveLights({ on: false, preview: { team: 'bulls', until: now + 1 }, nowMs: now })).toMatchObject({ team: 'bulls' })
    expect(resolveLights({ preview: { team: 'bulls', until: now }, nowMs: now })).toBeNull() // expired
  })
  it('a preview runs a minute', () => {
    useTeamLights.getState().startPreview('bears', 1000)
    expect(useTeamLights.getState().preview).toEqual({ team: 'bears', until: 1000 + PREVIEW_MS })
    expect(PREVIEW_MS).toBe(60000)
  })
})

describe('colours and buildings', () => {
  it('two light colours for every team, from its official colours', () => {
    for (const t of TEAMS) {
      expect(TEAM_LIGHT[t.key], t.key).toHaveLength(2)
      for (const c of TEAM_LIGHT[t.key]) expect(c).toMatch(/^#[0-9A-F]{6}$/)
    }
    // colours that are already light are the official ones' hue: Cubs red, Sky yellow, Fire red
    expect(TEAMS.find((t) => t.key === 'bears').colors).toEqual(['#0B162A', '#C83803'])
    expect(TEAM_LIGHT.bears[1]).toMatch(/^#FF5/) // orange
    expect(TEAM_LIGHT.whitesox[1]).toBe('#0A0A0A') // black: dark bands
  })
  it('the buildings that really light up, each in two colours', () => {
    expect(LIT_BUILDINGS.map((b) => b.key)).toEqual(['willis', 'hancock', 'twopru', 'wrigleybldg', 'mart'])
    for (const b of LIT_BUILDINGS) {
      expect(new Set(b.zones.map((z) => z.c)), b.key).toEqual(new Set([0, 1]))
      for (const z of b.zones) { expect(z.y1).toBeGreaterThan(z.y0); expect(MODE_CODE[z.mode]).toBeGreaterThan(0) }
    }
  })
  it('the zone table fits the shader and skips buildings without a style row', () => {
    const keys = [...new Set(LIT_BUILDINGS.flatMap((b) => b.zones.flatMap((z) => z.styles ?? [b.key])))]
    const all = zoneTable(new Map(keys.map((k, i) => [k, i + 1])))
    expect(all.length).toBe(LIT_BUILDINGS.reduce((n, b) => n + b.zones.reduce((m, z) => m + (z.styles?.length ?? 1), 0), 0))
    expect(all.length).toBeLessThanOrEqual(ZONE_SLOTS)
    expect(zoneTable(new Map([['willis', 1]])).map((z) => z.row)).toEqual([1, 1])
    expect(zoneTable(new Map())).toEqual([])
  })
})

describe('the switch', () => {
  beforeEach(() => { localStorage.clear(); useTeamLights.setState(useTeamLights.getInitialState()) })
  it('is on by default and remembers off', () => {
    expect(loadLightsOn()).toBe(true)
    useTeamLights.getState().setOn(false)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('off')
    expect(loadLightsOn()).toBe(false)
    useTeamLights.getState().setOn(true)
    expect(loadLightsOn()).toBe(true)
  })
  it('blocked storage: simply on, never throws', () => {
    const bad = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    expect(loadLightsOn(bad)).toBe(true)
    expect(() => saveLightsOn(false, bad)).not.toThrow()
  })
  it('turning off ends a preview', () => {
    useTeamLights.getState().startPreview('cubs')
    useTeamLights.getState().setOn(false)
    expect(useTeamLights.getState().preview).toBeNull()
  })
  it('I is a camera-safe key: it never ends a follow, tour or ride', () => {
    expect(FEATURE_KEY_CODES).toContain('KeyI')
    expect(KEEP_CAMERA_CODES.has('KeyI')).toBe(true)
  })
})
