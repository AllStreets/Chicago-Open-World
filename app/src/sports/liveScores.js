// app/src/sports/liveScores.js — live scores from CHI's /api/sports over V5's build-time schedule (P5 · I-5.5).
// gameState stays a pure function of (venue, time, games): live data arrives as a `live` field on each game.
import { TEAMS, VENUE_BY_NAME } from '../../../shared/teams.js'
import { chicagoDate } from './chicagoTime.js'
import { POSTGAME_MIN } from './gameState.js'

export const VENUE_KEYS = VENUE_BY_NAME
const MATCH_MS = 3 * 3600000
const num = (v) => { const n = Number(v); return v === '' || v == null || !Number.isFinite(n) ? null : n }
const teamByName = (name) => TEAMS.find((t) => t.name === name) ?? null

export function parseChiSports(json) {
  if (!Array.isArray(json)) return []
  return json.filter((t) => t && typeof t === 'object').map((t) => {
    const team = teamByName(t.name)
    const games = [...(Array.isArray(t.today) ? t.today : []), ...(Array.isArray(t.upcoming) ? t.upcoming : [])]
      .filter((g) => g?.id != null && Number.isFinite(Date.parse(g.date)))
      .map((g) => ({
        id: String(g.id), team: team?.key ?? null, venueKey: VENUE_KEYS[g.venue] ?? null, startMs: Date.parse(g.date),
        state: ['pre', 'in', 'post'].includes(g.state) ? g.state : 'pre', status: g.status ?? '',
        homeTeam: g.homeTeam ?? '', awayTeam: g.awayTeam ?? '', homeScore: num(g.homeScore), awayScore: num(g.awayScore),
      }))
    return { team: team?.key ?? null, league: t.league ?? null, games }
  })
}

const isChicagoTeam = (name, team) => Boolean(team && name === team.full)
const abbrOf = (name) => TEAMS.find((t) => t.full === name)?.abbr ?? String(name).split(/\s+/).filter(Boolean).at(-1)?.slice(0, 3).toUpperCase() ?? '—'
function resultFor(g, team) {
  if (g.state !== 'post' || g.homeScore == null || g.awayScore == null || g.homeScore === g.awayScore) return null
  const home = isChicagoTeam(g.homeTeam, team)
  return (home ? g.homeScore > g.awayScore : g.awayScore > g.homeScore) ? 'W' : 'L'
}

// A copy of the schedule in which every game CHI reports carries `live` (and its live score); home games the schedule
// does not know (a makeup game) are appended.
export function overlayLive(games, liveGames, nowMs = Date.now()) {
  const out = games.map((g) => ({ ...g }))
  for (const lg of liveGames ?? []) {
    const team = TEAMS.find((t) => t.key === lg.team) ?? null
    let g = out.find((x) => String(x.id) === lg.id) ?? out.find((x) => lg.venueKey && x.venue === lg.venueKey && Math.abs(Date.parse(x.start) - lg.startMs) < MATCH_MS)
    if (!g) {
      if (!lg.venueKey || !team) continue // an away game, or a venue outside the map
      g = { id: lg.id, teams: [team.key], results: {}, sport: team.sport, league: team.league, start: new Date(lg.startMs).toISOString(), venue: lg.venueKey,
        venueName: '', status: '', state: lg.state, detail: '', home: { abbr: abbrOf(lg.homeTeam), name: lg.homeTeam, score: null }, away: { abbr: abbrOf(lg.awayTeam), name: lg.awayTeam, score: null }, chicagoHome: isChicagoTeam(lg.homeTeam, team) }
      out.push(g)
    }
    g.live = { state: lg.state, homeScore: lg.homeScore, awayScore: lg.awayScore, status: lg.status, at: lg.finalAt ?? nowMs }
    g.simulated = false
    if (lg.homeScore != null) g.home = { ...g.home, score: lg.homeScore }
    if (lg.awayScore != null) g.away = { ...g.away, score: lg.awayScore }
    const r = team && resultFor(lg, team)
    if (r) g.results = { ...(g.results ?? {}), [team.key]: r }
  }
  return out
}

export function cubsWonOn(liveGames, date) {
  const cubs = TEAMS.find((t) => t.key === 'cubs')
  return (liveGames ?? []).some((g) => g.team === 'cubs' && chicagoDate(g.startMs) === date && resultFor(g, cubs) === 'W')
}

// Runs, goals and points since the last poll, at the venues on the map (the crowd stands; heard only with Sound on).
export function scoreEvents(prev, next) {
  const before = new Map((prev ?? []).map((g) => [g.id, g]))
  const out = []
  for (const g of next ?? []) {
    const p = before.get(g.id)
    if (!p || !g.venueKey) continue
    for (const side of ['home', 'away']) {
      const d = (g[`${side}Score`] ?? 0) - (p[`${side}Score`] ?? 0)
      if (d > 0) out.push({ venueKey: g.venueKey, side, delta: d })
    }
  }
  return out
}

export const FAST_MS = 60_000, SLOW_MS = 600_000
// Every minute from 90 min before an in-map start until an hour after its final (or its likely end); else every 10.
export function sportsInterval(liveGames, nowMs) {
  for (const g of liveGames ?? []) {
    if (!g.venueKey) continue
    const from = g.startMs - 90 * 60000, until = g.startMs + (4 * 60 + POSTGAME_MIN) * 60000
    if (nowMs >= from && nowMs <= until) return FAST_MS
  }
  return SLOW_MS
}
