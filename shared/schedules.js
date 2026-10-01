// shared/schedules.js — ESPN's public site API → Game records, shared by the build (pipeline/lib/schedules.js →
// schedules.json) and the live site's cached /api/schedule proxy (app/api/schedule.js).
// The browser never calls ESPN; our own cached /api/schedule does.
import { VENUE_BY_NAME } from './teams.js'

export const ESPN = 'https://site.api.espn.com/apis/site/v2/sports'
// 1 preseason, 2 regular season, 3 postseason. MLB spring training is in Arizona (skipped); MLS takes no parameter.
export const SEASON_TYPES = { mlb: [2, 3], nfl: [1, 2, 3], nba: [1, 2, 3], nhl: [1, 2, 3], wnba: [1, 2, 3], 'usa.1': [null] }

export function scheduleUrls(team) {
  const base = `${ESPN}/${team.sport}/${team.league}/teams/${team.espnId}/schedule`
  return SEASON_TYPES[team.league].map((st) => (st == null ? base : `${base}?seasontype=${st}`))
}

// Today's league scoreboard: the ESPN list that carries in-progress scores.
export const scoreboardUrl = (team) => `${ESPN}/${team.sport}/${team.league}/scoreboard`

export function scoreOf(s) {
  if (s == null) return null
  const v = typeof s === 'object' ? (s.value ?? (s.displayValue != null ? Number(s.displayValue) : NaN)) : Number(s)
  return Number.isFinite(v) ? v : null
}

const VOID = new Set(['STATUS_POSTPONED', 'STATUS_CANCELED', 'STATUS_CANCELLED', 'STATUS_FORFEIT'])

export function parseEvent(e, team) {
  const c = e?.competitions?.[0]
  const home = c?.competitors?.find((x) => x.homeAway === 'home'), away = c?.competitors?.find((x) => x.homeAway === 'away')
  if (!e?.date || !home || !away) return null
  const st = c.status?.type ?? {}
  const pre = (st.state ?? 'pre') === 'pre'
  const side = (x) => ({ abbr: x.team?.abbreviation ?? '?', name: x.team?.displayName ?? '?', score: pre ? null : scoreOf(x.score), winner: typeof x.winner === 'boolean' ? x.winner : null })
  const ours = String(home.team?.id) === String(team.espnId) ? home : away
  const theirs = ours === home ? away : home
  const results = {}
  if (st.state === 'post' && st.completed !== false && !VOID.has(st.name)) {
    const us = scoreOf(ours.score), them = scoreOf(theirs.score)
    const r = ours.winner === true ? 'W' : theirs.winner === true ? 'L' : us != null && them != null ? (us > them ? 'W' : us < them ? 'L' : 'T') : null
    if (r) results[team.key] = r
  }
  return {
    id: String(e.id), teams: [team.key], results, sport: team.sport, league: team.league,
    start: new Date(e.date).toISOString(), venue: VENUE_BY_NAME[c.venue?.fullName] ?? null, venueName: c.venue?.fullName ?? '',
    status: st.name ?? 'STATUS_SCHEDULED', state: st.state ?? 'pre', detail: st.shortDetail ?? '',
    home: side(home), away: side(away), chicagoHome: ours === home, attendance: c.attendance || null,
  }
}

// One record per league:id; a game listed by two Chicago teams (Crosstown) keeps both teams and results.
export function mergeGames(lists) {
  const byId = new Map()
  for (const g of lists.flat()) {
    if (!g) continue
    const k = `${g.league}:${g.id}`, cur = byId.get(k)
    if (!cur) { byId.set(k, { ...g, teams: [...g.teams], results: { ...g.results } }); continue }
    for (const t of g.teams) if (!cur.teams.includes(t)) cur.teams.push(t)
    Object.assign(cur.results, g.results)
  }
  return [...byId.values()].sort((a, b) => a.start.localeCompare(b.start))
}

// Refresh fast from 90 min before an in-map start until an hour after its likely end (4 h), or while ESPN says a
// game at one of our venues is in progress — the same window as the app's live-score cadence (liveScores.sportsInterval).
export const WINDOW_BEFORE_MS = 90 * 60000, WINDOW_AFTER_MS = (4 * 60 + 60) * 60000
export function inGameWindow(games, nowMs) {
  for (const g of games ?? []) {
    if (!g?.venue) continue
    if (g.state === 'in') return true
    const t = Date.parse(g.start)
    if (g.state !== 'post' && nowMs >= t - WINDOW_BEFORE_MS && nowMs <= t + WINDOW_AFTER_MS) return true
  }
  return false
}
