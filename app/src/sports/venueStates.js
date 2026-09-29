// app/src/sports/venueStates.js — every venue's state now; the test-only override; light levels; staleness.
import { gameState, nextGame, SPORT_MINUTES } from './gameState.js'
import { teamByKey } from '../../../shared/teams.js'

export function computeStates(venues, nowMs, games) {
  const out = {}
  for (const v of venues) out[v.key] = { ...gameState(v.key, nowMs, games), next: nextGame(v.key, nowMs, games) }
  return out
}

export const LIGHT = { idle: 0.5, pregame: 1, live: 1, postgame: 0.7 }
export const lightLevel = (state) => LIGHT[state] ?? LIGHT.idle

export const STALE_DAYS = 45
export function isStale(generatedAt, nowMs) {
  const t = Date.parse(generatedAt ?? '')
  return !Number.isFinite(t) || nowMs - t > STALE_DAYS * 86400000
}

const MODES = ['idle', 'pregame', 'live', 'postgame', 'win', 'loss']
// Test-only: ?sports=<mode>[:<teamKey>] (screenshots, e2e). People never need it.
export function parseOverride(q) {
  if (!q) return null
  const [mode, team = null] = String(q).split(':')
  return MODES.includes(mode) ? { mode, team } : null
}

export function overrideStates(venues, { mode, team }, nowMs) {
  const out = {}
  for (const v of venues) {
    if (mode === 'idle') { out[v.key] = { state: 'idle', game: null, winDay: false, lossDay: false, next: null }; continue }
    const t = teamByKey(team && v.teams.includes(team) ? team : v.teams[0])
    const dur = SPORT_MINUTES[t.sport] * 60000
    const start = mode === 'live' ? nowMs - 0.45 * dur : mode === 'pregame' ? nowMs + 3600000 : nowMs - dur - 1200000
    const won = mode !== 'loss'
    const [us, them] = t.sport === 'basketball' ? (won ? [104, 97] : [95, 108]) : t.sport === 'football' ? (won ? [24, 17] : [13, 27]) : won ? [5, 3] : [2, 6]
    const game = {
      id: `override-${v.key}`, teams: [t.key], results: { [t.key]: won ? 'W' : 'L' }, sport: t.sport, league: t.league,
      start: new Date(start).toISOString(), venue: v.key, venueName: v.name ?? '', status: 'STATUS_SCHEDULED', state: 'pre', detail: '',
      home: { abbr: t.abbr, name: t.full, score: us, winner: won }, away: { abbr: 'VIS', name: 'Visitors', score: them, winner: !won },
      chicagoHome: true, attendance: null, simulated: true,
    }
    const state = mode === 'win' || mode === 'loss' ? 'postgame' : mode
    const cubsDay = v.teams.includes('cubs') || mode === 'win' || mode === 'loss'
    out[v.key] = { state, game, winDay: mode === 'win' && cubsDay, lossDay: mode === 'loss' && cubsDay, next: null }
  }
  return out
}
