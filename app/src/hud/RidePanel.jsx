// app/src/hud/RidePanel.jsx — Ride the city (P7): every ride in plain words — the L lines, the buses, the walks and the
// glide. L, the dock's Ride button or ⌘K "Ride" opens it; picking a ride starts it where you are.
// F-3/F-5/F-6 (2026-10-01): the ride keys are keycaps in short rows, the line swatches are the CTA colours at full
// strength, and the panel sits under the time and weather pills, never over them.
import './Ride.css'
import { useEffect, useState } from 'react'
import { RiCloseLine, RiTrainLine, RiBusLine, RiWalkLine, RiFlightTakeoffLine, RiCarLine } from 'react-icons/ri'
import { useStore } from '../state/store.js'
import { getSim } from '../transit/simStore.js'
import { allRides, loadRidesJson, ridesJsonNow, RIDE_KINDS } from '../ride/rideCatalog.js'
import { startRide } from '../ride/rideActions.js'
import { withKeys, keysPlain } from './Keycap.jsx'
import { swatchStyle } from '../lib/lineSwatch.js'

const ICON = { L: RiTrainLine, bus: RiBusLine, walk: RiWalkLine, drive: RiCarLine, glide: RiFlightTakeoffLine }
// the controls during a path ride — the same keys as the bar's buttons (rideActions.handleRideKey)
// (two columns, row by row: the two-key rows on the right, where there is room for their words)
export const RIDE_KEYS = [['{Space}', 'pause'], ['{.} {,}', 'next or previous stop'], ['{K}', 'change the view'], ['{>} {<}', 'faster or slower'], ['{Drag}', 'look around'], ['{Esc}', 'get off']]

// "Blue Line to O'Hare · Western (Forest Park branch) → Western (O'Hare branch)": the line and where it is signed to on
// the first line, the stretch you ride under it
function RideName({ name }) {
  const i = name.indexOf(' · ')
  if (i < 0) return <span className="ride-name">{name}</span>
  return <span className="ride-name">{name.slice(0, i)}<small>{name.slice(i + 3)}</small></span>
}

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
      <p className="ride-sub">Pick a ride — it starts from where you are.</p>
      <ul className="ride-keys" aria-label="Ride controls">
        {RIDE_KEYS.map(([k, label]) => <li key={label}>{withKeys(k)}<span>{label}</span></li>)}
      </ul>
      {RIDE_KINDS.map(([kind, title, blurb]) => {
        const list = rides.filter((r) => r.kind === kind), Icon = ICON[kind]
        return (
          <section key={kind} aria-label={title}>
            <h3 className="hud-label"><Icon aria-hidden="true" /> {title}</h3>
            <p className="ride-blurb">{withKeys(blurb)}</p>
            {list.length === 0 && <p className="ride-blurb">{kind === 'L' ? 'The L loads with the map…' : 'Not in this build of the map yet.'}</p>}
            <ul>
              {list.map((r) => (
                <li key={r.id}>
                  <button type="button" className="ride-row" onClick={() => startRide(r.id)} title={keysPlain(r.blurb ?? r.name)}>
                    {r.colour && <i className="ride-swatch" style={swatchStyle(r.colour)} aria-hidden="true" />}
                    <RideName name={r.name} />
                    {r.stops && <span className="ride-n">{r.kind === 'walk' || r.kind === 'drive' ? `${(r.path.length / 1000).toFixed(1)} km` : `${r.stops.length} stops`}</span>}
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
