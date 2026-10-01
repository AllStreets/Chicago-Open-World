// app/src/sports/SportsClock.jsx — loads the schedule and venues, recomputes every venue's state every 15 s,
// and hands each venue's light level to the façade shader.
import { useEffect } from 'react'
import { useSports, loadSchedule, loadVenues } from './sportsStore.js'
import { computeStates, overrideStates, parseOverride, lightLevel } from './venueStates.js'
import { setVenueLights } from '../world/materials/facadeMaterial.js'
import { overlayLive, scoreEvents } from './liveScores.js'
import { SPORT_MINUTES } from './gameState.js'
import { teamByKey } from '../../../shared/teams.js'
import { cheer } from '../audio/cheers.js'

const LIVE_STALE_MS = 20 * 60000
const likelyEnd = (g) => g.startMs + (SPORT_MINUTES[teamByKey(g.team)?.sport] ?? 150) * 60000

// P5: a live sports answer — the home crowd stands for every home score (heard only with Sound on), then re-tick
export function applyLiveSports(liveGames, nowMs = Date.now()) {
  const s = useSports.getState()
  for (const e of scoreEvents(s.liveGames, liveGames)) if (e.side === 'home') cheer(e.venueKey, Math.min(1, 0.5 + 0.25 * e.delta))
  // when each final happened: the first report that saw it, or the game's likely end for one already over at first sight
  const seen = new Map(s.liveGames.map((g) => [g.id, g.finalAt]))
  const marked = liveGames.map((g) => (g.state !== 'post' ? g : { ...g, finalAt: seen.get(g.id) ?? Math.min(nowMs, likelyEnd(g)) }))
  useSports.setState({ liveGames: marked, liveAt: nowMs })
  if (s.venues.length) tick(nowMs)
}

export function tick(nowMs = Date.now()) {
  const s = useSports.getState()
  const fresh = s.liveGames.length && nowMs - (s.liveAt ?? 0) < LIVE_STALE_MS // a feed gone quiet hands back to the schedule
  const games = fresh ? overlayLive(s.games, s.liveGames, s.liveAt) : s.games
  const states = s.override ? overrideStates(s.venues, s.override, nowMs) : computeStates(s.venues, nowMs, games)
  s.setStates(states)
  setVenueLights(s.venues.map((v) => ({ slot: v.slot, center: v.center, radius: v.radius, level: lightLevel(states[v.key]?.state) })))
}

export default function SportsClock() {
  useEffect(() => {
    let alive = true
    const params = new URLSearchParams(window.location.search)
    useSports.getState().setOverride(parseOverride(params.get('sports'))) // test-only
    if (params.has('stats')) window.__sports = useSports
    Promise.all([loadSchedule(), loadVenues()]).then(([sched, venues]) => {
      if (!alive) return
      useSports.getState().setData(sched)
      useSports.getState().setVenues(venues)
      tick()
    })
    const id = setInterval(() => tick(), 15000)
    return () => { alive = false; clearInterval(id) }
  }, [])
  return null
}
