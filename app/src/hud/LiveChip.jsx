// app/src/hud/LiveChip.jsx — the one honest sign of live data (P5 · I-5.1): LIVE CTA when real trains are shown,
// SIMULATED otherwise. A click opens "Data sources" in plain words, with a Try live again button. No other error UI.
import { useEffect, useState } from 'react'
import { useStore } from '../state/store.js'
import { retryLive } from '../services/feeds.js'

const ago = (t, now) => {
  if (!t) return ''
  const s = Math.max(0, Math.round((now - t) / 1000))
  return s < 60 ? `${s} s ago` : `${Math.round(s / 60)} min ago`
}

export function sourceLines(state, now = Date.now()) {
  const { feeds, feedAt, weather } = state
  const live = (k) => feeds[k] === 'LIVE'
  const sky = weather?.label ?? 'clear sky'
  return [
    ['Trains', live('cta') ? `live from CTA Train Tracker, updated ${ago(feedAt.cta, now)}` : 'simulated from CTA and Metra timetables (typical service)'],
    ['Line alerts', live('alerts') ? `live CTA service alerts, updated ${ago(feedAt.alerts, now)}` : 'none shown — the live alerts feed is not connected'],
    ['Weather', live('weather') ? `live Chicago weather (${sky}), updated ${ago(feedAt.weather, now)}` : `simulated (${sky})`],
    ['Scores', live('sports') ? `live from ESPN, updated ${ago(feedAt.sports, now)}` : 'the season schedule built with the map, with simulated scores'],
    ['Places', live('places') ? 'live from CHI ATLAS, merged with the map' : 'built into the map from OpenStreetMap'],
  ]
}

export default function LiveChip() {
  const ctaLive = useStore((s) => s.feeds.cta === 'LIVE')
  const open = useStore((s) => s.sourcesOpen)
  const feeds = useStore((s) => s.feeds), feedAt = useStore((s) => s.feedAt), weather = useStore((s) => s.weather)
  const state = { feeds, feedAt, weather }
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!open) return undefined
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(id)
  }, [open])
  const toggle = () => useStore.getState().setSourcesOpen(!open)
  const [note, setNote] = useState('')
  const retry = () => setNote(retryLive() ? 'Checking the live service…' : 'The live service is not connected to this copy of the map, so everything runs on simulations.')
  return (
    <div className="wm-chips live-chip">
      <button type="button" className={`hud-chip${ctaLive ? ' live' : ''}`} aria-label="Data sources" aria-expanded={open} onClick={toggle}
        title={ctaLive ? 'Real CTA trains — click for data sources' : 'Trains run on typical schedules — click for data sources'}>
        {ctaLive && <span className="dot" aria-hidden="true" />}{ctaLive ? 'LIVE CTA' : 'SIMULATED'}
      </button>
      {open && (
        <div className="hud-panel sources-pop" role="dialog" aria-label="Data sources">
          <span className="hud-label">Data sources</span>
          <ul>{sourceLines(state, now).map(([k, v]) => <li key={k}><b>{k}</b> — {v}</li>)}</ul>
          <div className="sources-actions">
            <button type="button" className="hud-pill" onClick={retry}>Try live again</button>
            <button type="button" className="hud-pill" onClick={toggle}>Close</button>
          </div>
          {note && <p className="sources-note">{note}</p>}
        </div>
      )}
    </div>
  )
}
