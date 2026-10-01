// app/src/sports/sportsStore.js — schedule, venues and per-venue states; loaders that never throw.
// The schedule comes from, in order of trust (E1): our cached same-origin /api/schedule proxy (fresh ESPN data,
// polled by services/feeds.js) → the build-time /world/schedules.json (younger than 45 days) → the simulated
// calendar. The browser never calls ESPN; our own cached /api/schedule does.
import { create } from 'zustand'
import { simulatedGames } from './simSchedule.js'
import { chicagoParts } from './chicagoTime.js'
import { isStale } from './venueStates.js'
import { SPORT_MINUTES } from './gameState.js'

export const ORIGIN_RANK = { simulated: 1, file: 2, proxy: 3 }

export const useSports = create((set, get) => ({
  games: [], source: 'SIMULATED', origin: null, generatedAt: null, venues: [], states: {}, override: null,
  liveGames: [], // P5: CHI /api/sports, overlaid on `games` by the clock (liveScores.overlayLive)
  cardVenue: null, boardOverrides: {}, swells: {},
  setData: (d) => set(d),
  // A schedule replaces the current one only when it is at least as trusted (proxy > file > simulated): the slower
  // build-time file never overwrites a fresh proxy answer. Returns whether it was taken.
  acceptSchedule: (d) => {
    if ((ORIGIN_RANK[d?.origin] ?? 0) < (ORIGIN_RANK[get().origin] ?? 0)) return false
    set({ games: d.games, source: d.source, origin: d.origin, generatedAt: d.generatedAt ?? null })
    return true
  },
  setVenues: (venues) => set({ venues }),
  setStates: (states) => set({ states }),
  setOverride: (override) => set({ override }),
  openCard: (cardVenue) => set({ cardVenue }),
  setBoardOverride: (key, lines) => set((s) => ({ boardOverrides: { ...s.boardOverrides, [key]: lines } })),
  pushSwell: (key, strength = 1) => set((s) => ({ swells: { ...s.swells, [key]: { at: Date.now(), strength } } })),
}))

function simulated(nowMs) {
  const y = chicagoParts(nowMs).year
  return { games: [...simulatedGames(y - 1), ...simulatedGames(y), ...simulatedGames(y + 1)], source: 'SIMULATED', origin: 'simulated', generatedAt: null }
}

// The ESPN schedule built with the world (LIVE provenance) when present and fresh; otherwise the simulated calendar.
export async function loadSchedule(fetchImpl = fetch, nowMs = Date.now()) {
  try {
    const r = await fetchImpl('/world/schedules.json')
    if (!r.ok) return simulated(nowMs)
    const j = await r.json()
    if (!Array.isArray(j?.games) || !j.games.length || isStale(j.generatedAt, nowMs)) return simulated(nowMs)
    return { games: j.games, source: 'LIVE', origin: 'file', generatedAt: j.generatedAt }
  } catch {
    return simulated(nowMs)
  }
}

// A /api/schedule answer worth using: the proxy's shape, with games, generated within the last 6 h. Throws otherwise
// (the feed then counts a failure and the schedule already shown stays).
export const PROXY_MAX_AGE_MS = 6 * 3600000
export function parseProxySchedule(j, nowMs = Date.now()) {
  if (j?.source !== 'espn-proxy' || !Array.isArray(j.games) || !j.games.length) throw new Error('not a schedule')
  const t = Date.parse(j.generatedAt ?? '')
  if (!Number.isFinite(t) || nowMs - t > PROXY_MAX_AGE_MS) throw new Error('stale schedule')
  return j
}

// The proxy's games, ready for the clock: a game ESPN reports in progress or final carries `live` (gameState's
// liveState path — the same one CHI's overlay uses). A final keeps the time it was first seen (else its likely end).
export function scheduleFromProxy(doc, prevGames = [], nowMs = Date.now()) {
  const prev = new Map(prevGames.map((g) => [`${g.league}:${g.id}`, g]))
  const games = doc.games.map((g) => {
    if (g.state !== 'in' && g.state !== 'post') return g
    const before = prev.get(`${g.league}:${g.id}`)?.live
    const likelyEnd = Date.parse(g.start) + (SPORT_MINUTES[g.sport] ?? 150) * 60000
    const at = g.state === 'in' ? nowMs : before?.state === 'post' ? before.at : Math.min(nowMs, likelyEnd)
    return { ...g, simulated: false, live: { state: g.state, homeScore: g.home?.score ?? null, awayScore: g.away?.score ?? null, status: g.detail ?? '', at } } // ESPN's own words ("Top 6th") for the board
  })
  return { games, source: 'LIVE', origin: 'proxy', generatedAt: doc.generatedAt }
}

export async function loadVenues(fetchImpl = fetch) {
  try {
    const r = await fetchImpl('/world/venues.json')
    if (!r.ok) return []
    const j = await r.json()
    return Array.isArray(j?.venues) ? j.venues : []
  } catch {
    return []
  }
}
