// app/src/sports/SportsClock.jsx — loads the schedule and venues, recomputes every venue's state every 15 s,
// and hands each venue's light level to the façade shader.
import { useEffect } from 'react'
import { useSports, loadSchedule, loadVenues } from './sportsStore.js'
import { computeStates, overrideStates, parseOverride, lightLevel } from './venueStates.js'
import { setVenueLights } from '../world/materials/facadeMaterial.js'

export function tick(nowMs = Date.now()) {
  const s = useSports.getState()
  const states = s.override ? overrideStates(s.venues, s.override, nowMs) : computeStates(s.venues, nowMs, s.games)
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
