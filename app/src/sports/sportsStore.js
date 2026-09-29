// app/src/sports/sportsStore.js — schedule, venues and per-venue states; loaders that never throw.
import { create } from 'zustand'
import { simulatedGames } from './simSchedule.js'
import { chicagoParts } from './chicagoTime.js'
import { isStale } from './venueStates.js'

export const useSports = create((set) => ({
  games: [], source: 'SIMULATED', generatedAt: null, venues: [], states: {}, override: null,
  cardVenue: null, boardOverrides: {}, swells: {},
  setData: (d) => set(d),
  setVenues: (venues) => set({ venues }),
  setStates: (states) => set({ states }),
  setOverride: (override) => set({ override }),
  openCard: (cardVenue) => set({ cardVenue }),
  setBoardOverride: (key, lines) => set((s) => ({ boardOverrides: { ...s.boardOverrides, [key]: lines } })),
  pushSwell: (key, strength = 1) => set((s) => ({ swells: { ...s.swells, [key]: { at: Date.now(), strength } } })),
}))

function simulated(nowMs) {
  const y = chicagoParts(nowMs).year
  return { games: [...simulatedGames(y - 1), ...simulatedGames(y), ...simulatedGames(y + 1)], source: 'SIMULATED', generatedAt: null }
}

// The ESPN schedule built with the world (LIVE provenance) when present and fresh; otherwise the simulated calendar.
export async function loadSchedule(fetchImpl = fetch, nowMs = Date.now()) {
  try {
    const r = await fetchImpl('/world/schedules.json')
    if (!r.ok) return simulated(nowMs)
    const j = await r.json()
    if (!Array.isArray(j?.games) || !j.games.length || isStale(j.generatedAt, nowMs)) return simulated(nowMs)
    return { games: j.games, source: 'LIVE', generatedAt: j.generatedAt }
  } catch {
    return simulated(nowMs)
  }
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
