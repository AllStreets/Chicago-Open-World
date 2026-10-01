// app/src/sports/tonight.js — "tonight's game", and the words the HUD uses for a venue's state.
import { chicagoDate, whenChicago } from './chicagoTime.js'

const RANK = { live: 3, pregame: 2, postgame: 1 }
export function tonightsGame(venues, states, nowMs) {
  let best = null
  for (const v of venues) {
    const st = states[v.key]
    if (st?.game && RANK[st.state] && (!best || RANK[st.state] > RANK[best.state])) best = { venue: v, game: st.game, state: st.state }
  }
  if (best) return best
  const today = chicagoDate(nowMs)
  let soon = null
  for (const v of venues) {
    const n = states[v.key]?.next
    if (!n) continue
    const t = Date.parse(n.start)
    if (!soon || t < soon.t) soon = { t, venue: v, game: n, state: chicagoDate(t) === today ? 'later' : 'upcoming' }
  }
  return soon && { venue: soon.venue, game: soon.game, state: soon.state }
}
export function stateLabel(st, nowMs = Date.now()) {
  if (st?.state === 'live') return 'LIVE'
  if (st?.state === 'pregame') return 'STARTS SOON'
  if (st?.state === 'postgame') return 'FINAL'
  return st?.next ? `NEXT ${whenChicago(Date.parse(st.next.start), nowMs).toUpperCase()}` : 'NO GAMES'
}
export const gameLabel = (g) => `${g.away.abbr} @ ${g.home.abbr}`
// Provenance chip: 'ESPN' for the build-time schedule, 'SIMULATED' for the fallback calendar. Never 'LIVE' —
// that word belongs to a game in progress, and one row must not use it for both.
export const dataChip = (st, source) => (st?.game?.live ? 'LIVE' : (st?.game ?? st?.next)?.simulated || source !== 'LIVE' ? 'SIMULATED' : 'ESPN')
