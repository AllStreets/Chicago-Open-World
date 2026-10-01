// app/src/hud/RidePanel.jsx — Ride the city (P7): every ride in plain words — the L lines, the buses, the walks and the
// glide. L, the dock's Ride button or ⌘K "Ride" opens it; picking a ride starts it where you are.
import './Ride.css'
import { useEffect, useState } from 'react'
import { RiCloseLine, RiTrainLine, RiBusLine, RiWalkLine, RiFlightTakeoffLine } from 'react-icons/ri'
import { useStore } from '../state/store.js'
import { getSim } from '../transit/simStore.js'
import { allRides, loadRidesJson, ridesJsonNow, RIDE_KINDS } from '../ride/rideCatalog.js'
import { startRide } from '../ride/rideActions.js'

const ICON = { L: RiTrainLine, bus: RiBusLine, walk: RiWalkLine, glide: RiFlightTakeoffLine }

export default function RidePanel() {
  const open = useStore((s) => s.ridePanelOpen)
  const transit = useStore((s) => s.transit)
  const [json, setJson] = useState(() => ridesJsonNow())
  useEffect(() => { if (open && !json) loadRidesJson().then(setJson) }, [open, json])
  useEffect(() => {
    if (!open) return undefined
    const k = (e) => { if (e.key === 'Escape') useStore.getState().setRidePanelOpen(false) }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open])
  if (!open) return null
  const rides = allRides(getSim(), transit, json)
  const close = () => useStore.getState().setRidePanelOpen(false)
  return (
    <div className="hud-panel ride-panel" role="dialog" aria-label="Ride the city">
      <div className="ride-head">
        <span className="hud-label">Ride the city</span>
        <button type="button" className="dock-btn" aria-label="Close rides" onClick={close}><RiCloseLine /></button>
      </div>
      <p className="ride-sub">Pick a ride — it starts from where you are. Space pauses, . and , skip stops, &gt; and &lt; change speed, K changes the view, drag to look around, Esc gets off.</p>
      {RIDE_KINDS.map(([kind, title, blurb]) => {
        const list = rides.filter((r) => r.kind === kind), Icon = ICON[kind]
        return (
          <section key={kind} aria-label={title}>
            <h3 className="hud-label"><Icon aria-hidden="true" /> {title}</h3>
            <p className="ride-blurb">{blurb}</p>
            {list.length === 0 && <p className="ride-blurb">{kind === 'L' ? 'The L loads with the map…' : 'Not in this build of the map yet.'}</p>}
            <ul>
              {list.map((r) => (
                <li key={r.id}>
                  <button type="button" className="ride-row" onClick={() => startRide(r.id)} title={r.blurb ?? r.name}>
                    {r.colour && <i className="tl-swatch" style={{ background: r.colour }} aria-hidden="true" />}
                    <span>{r.name}</span>
                    {r.stops && <span className="ride-n">{r.kind === 'walk' ? `${(r.path.length / 1000).toFixed(1)} km` : `${r.stops.length} stops`}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
