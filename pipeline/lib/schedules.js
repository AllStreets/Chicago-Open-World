// pipeline/lib/schedules.js — the public ESPN site API → Game records (build time only; the app never calls ESPN).
import { TEAMS, VENUE_BY_NAME } from '../../shared/teams.js'

export const ESPN = 'https://site.api.espn.com/apis/site/v2/sports'
// 1 preseason, 2 regular season, 3 postseason. MLB spring training is in Arizona (skipped); MLS takes no parameter.
export const SEASON_TYPES = { mlb: [2, 3], nfl: [1, 2, 3], nba: [1, 2, 3], nhl: [1, 2, 3], wnba: [1, 2, 3], 'usa.1': [null] }

export function scheduleUrls(team) {
  const base = `${ESPN}/${team.sport}/${team.league}/teams/${team.espnId}/schedule`
  return SEASON_TYPES[team.league].map((st) => (st == null ? base : `${base}?seasontype=${st}`))
}

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

export async function fetchAllSchedules(fetchImpl, { teams = TEAMS, timeoutMs = 10000, log = () => {} } = {}) {
  const lists = [], failures = []
  for (const team of teams) {
    for (const url of scheduleUrls(team)) {
      try {
        const r = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': 'chi-atlas-open-world (build)' } })
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const events = (await r.json())?.events ?? []
        lists.push(events.map((e) => parseEvent(e, team)))
        log(`  ✓ ${team.key} ${url.split('?')[1] ?? 'season'}: ${events.length}`)
      } catch (err) {
        failures.push({ team: team.key, url, error: String(err?.message ?? err) })
      }
    }
  }
  return { games: mergeGames(lists), failures }
}
