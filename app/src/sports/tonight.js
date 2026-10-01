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
// E1-4: ESPN data older than this means the refresh (/api/schedule) isn't getting through — say so, in amber.
export const STALE_AFTER_MS = 6 * 3600000
const isOld = (generatedAt, nowMs) => { const t = Date.parse(generatedAt ?? ''); return Number.isFinite(t) && nowMs - t > STALE_AFTER_MS }
// Provenance chip: 'LIVE' only for a game in progress; 'ESPN' for a fresh ESPN schedule (the /api/schedule proxy or
// the build-time file), 'STALE' when that schedule is over 6 h old, 'SIMULATED' for the fallback calendar.
export const dataChip = (st, source, generatedAt = null, nowMs = Date.now()) =>
  st?.game?.live?.state === 'in' ? 'LIVE' : (st?.game ?? st?.next)?.simulated || source !== 'LIVE' ? 'SIMULATED' : isOld(generatedAt, nowMs) ? 'STALE' : 'ESPN'
const ago = (ms) => { const m = Math.floor(ms / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ago` }
const dayOf = (t) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Chicago' })
// Where the schedule came from and how old it is, in words (the VenueCard and Games panel feet).
export function sourceNote({ source, generatedAt }, nowMs = Date.now()) {
  if (source !== 'LIVE') return { chip: 'SIMULATED', text: 'Simulated schedule — typical home dates', stale: false }
  const t = Date.parse(generatedAt ?? '')
  if (!Number.isFinite(t)) return { chip: 'ESPN', text: 'ESPN schedule', stale: false }
  if (isOld(generatedAt, nowMs)) return { chip: 'STALE', text: `ESPN schedule from ${dayOf(t)} — couldn’t refresh`, stale: true }
  return { chip: 'ESPN', text: `ESPN · updated ${ago(Math.max(0, nowMs - t))}`, stale: false }
}
