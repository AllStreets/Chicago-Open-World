// app/src/sports/SportsClock.jsx — loads the build-time schedule and venues, takes /api/schedule refreshes,
// recomputes every venue's state every 15 s, and hands each venue's light level to the façade shader.
import { useEffect } from 'react'
import { useSports, loadSchedule, loadVenues, scheduleFromProxy } from './sportsStore.js'
import { computeStates, overrideStates, parseOverride, lightLevel } from './venueStates.js'
import { setVenueLights } from '../world/materials/facadeMaterial.js'
import { overlayLive, scoreEvents } from './liveScores.js'
import { SPORT_MINUTES } from './gameState.js'
import { teamByKey } from '../../../shared/teams.js'
import { cheer } from '../audio/cheers.js'
import { applyShowcase } from './showcase.js'
import { useStore } from '../state/store.js'

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

// E1: a good /api/schedule answer (services/feeds.js) — the home crowd stands for every home score since the last
// answer, then the proxy's schedule replaces the build-time one (sportsStore's trust order) and the venues re-tick.
export function applyProxySchedule(doc, nowMs = Date.now()) {
  const s = useSports.getState()
  const next = scheduleFromProxy(doc, s.origin === 'proxy' ? s.games : [], nowMs)
  if (s.origin === 'proxy') {
    const asLive = (gs) => gs.filter((g) => g.live && g.venue).map((g) => ({ id: g.id, venueKey: g.venue, homeScore: g.live.homeScore, awayScore: g.live.awayScore }))
    for (const e of scoreEvents(asLive(s.games), asLive(next.games))) if (e.side === 'home') cheer(e.venueKey, Math.min(1, 0.5 + 0.25 * e.delta))
  }
  if (s.acceptSchedule(next) && s.venues.length) tick(nowMs)
}

export function tick(nowMs = Date.now()) {
  const s = useSports.getState()
  const fresh = s.liveGames.length && nowMs - (s.liveAt ?? 0) < LIVE_STALE_MS // a feed gone quiet hands back to the schedule
  const games = fresh ? overlayLive(s.games, s.liveGames, s.liveAt) : s.games
  const real = s.override ? overrideStates(s.venues, s.override, nowMs) : computeStates(s.venues, nowMs, games)
  // E4: "Play a game" over its venue's real state — only while that venue is idle or in its postgame hour
  const sc = applyShowcase(real, s.venues, s.showcase, nowMs, s.states)
  if (sc.stop) {
    s.stopShowcase()
    if (sc.stop === 'live') useStore.getState().showToast('The real game is starting — showing it live')
    else if (sc.stop === 'pregame') useStore.getState().showToast('The gates are open for the real game — showing it instead')
  }
  for (const e of sc.scored) if (e.side === 'home') cheer(s.showcase.venueKey, Math.min(1, 0.6 + 0.2 * e.delta)) // the crowd stands (heard with Sound on)
  const states = sc.states
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
      useSports.getState().acceptSchedule(sched) // ignored when a fresher /api/schedule answer got here first
      useSports.getState().setVenues(venues)
      tick()
    })
    const id = setInterval(() => tick(), 15000)
    // a showcase moves every second (the board, the marquee, the score); it re-ticks at once when started or stopped
    const fast = setInterval(() => { if (useSports.getState().showcase) tick() }, 1000)
    const unsub = useSports.subscribe((st, prev) => { if (st.showcase !== prev.showcase && st.venues.length) tick() })
    // Esc ends a showcase, like the fireworks (not while typing in ⌘K or a field)
    const esc = (e) => { if (e.key === 'Escape' && useSports.getState().showcase && !['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) useSports.getState().stopShowcase() }
    window.addEventListener('keydown', esc)
    return () => { alive = false; clearInterval(id); clearInterval(fast); unsub(); window.removeEventListener('keydown', esc) }
  }, [])
  return null
}
