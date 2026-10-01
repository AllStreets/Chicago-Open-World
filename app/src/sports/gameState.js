// app/src/sports/gameState.js — a venue's state at an instant: idle | pregame | live | postgame, plus the Cubs
// W / L day (the Chicago date of a finished Cubs game). Pure: (venue, time, schedule) → state.
import { chicagoDate } from './chicagoTime.js'

export const SPORT_MINUTES = { baseball: 180, football: 195, basketball: 150, hockey: 160, soccer: 115 }
export const PREGAME_MIN = 120
export const POSTGAME_MIN = 60
const VOID = new Set(['STATUS_POSTPONED', 'STATUS_CANCELED', 'STATUS_CANCELLED', 'STATUS_FORFEIT'])
export const isVoid = (g) => VOID.has(g?.status)

export function gameWindow(g) {
  const start = Date.parse(g.start), dur = (SPORT_MINUTES[g.sport] ?? 150) * 60000
  return { open: start - PREGAME_MIN * 60000, start, end: start + dur, close: start + dur + POSTGAME_MIN * 60000 }
}

const RANK = { live: 3, pregame: 2, postgame: 1 }
function clockState(g, nowMs) {
  const w = gameWindow(g)
  if (nowMs < w.open || nowMs >= w.close) return null
  return nowMs < w.start ? 'pregame' : nowMs < w.end ? 'live' : 'postgame'
}
// P5: a live report (CHI /api/sports via liveScores.overlayLive) wins over the clock — a game in progress is live
// whatever the schedule says; a final is postgame for an hour after the report, then over. 'pre' keeps the clock.
function liveState(g, nowMs) {
  const L = g.live
  if (!L || L.state === 'pre') return undefined
  if (L.state === 'in') return 'live'
  return nowMs < (L.at ?? 0) + POSTGAME_MIN * 60000 ? 'postgame' : null
}
export function gameState(venueKey, nowMs, games) {
  let best = null
  for (const g of games) {
    if (g.venue !== venueKey || isVoid(g)) continue
    const ls = liveState(g, nowMs), state = ls === undefined ? clockState(g, nowMs) : ls
    if (!state) continue
    if (!best || RANK[state] > RANK[best.state]) best = { state, game: g }
  }
  const day = resultDay('cubs', nowMs, games)
  return { state: best?.state ?? 'idle', game: best?.game ?? null, winDay: day === 'W', lossDay: day === 'L' }
}

// The result of the team's latest game that finished today (Chicago date of its start), else null.
export function resultDay(teamKey, nowMs, games) {
  const today = chicagoDate(nowMs)
  let latest = null
  for (const g of games) {
    if (!g.teams?.includes(teamKey) || isVoid(g)) continue
    const r = g.results?.[teamKey]
    if (r !== 'W' && r !== 'L') continue
    const w = gameWindow(g)
    if ((nowMs < w.end && g.live?.state !== 'post') || chicagoDate(w.start) !== today) continue // a live final counts at once
    if (!latest || w.start > latest.start) latest = { start: w.start, r }
  }
  return latest?.r ?? null
}

export function nextGame(venueKey, nowMs, games) {
  let best = null, bestT = Infinity
  for (const g of games) {
    if (g.venue !== venueKey || isVoid(g)) continue
    const t = Date.parse(g.start)
    if (t > nowMs && t < bestT) { best = g; bestT = t }
  }
  return best
}
