// app/src/hud/RideBar.jsx — the bar at the bottom during a ride (P7): what's next, what's nearby, and a button for every
// ride control, each with its key — so the keyboard is never needed.
import './Ride.css'
import { RiPauseLine, RiPlayLine, RiSkipBackLine, RiSkipForwardLine, RiCameraSwitchLine, RiCloseLine } from 'react-icons/ri'
import { useStore } from '../state/store.js'
import { togglePause, changeSpeed, skipTo, cycleView, stopRide } from '../ride/rideActions.js'
import { VIEWS, VIEW_NAMES } from '../ride/rideCatalog.js'

const eta = (s) => (s < 45 ? 'arriving' : `${Math.round(s / 60)} min`)

export default function RideBar() {
  const ride = useStore((s) => s.ride), hud = useStore((s) => s.rideHud)
  if (!ride) return null
  const kbd = (k) => <span className="hud-kbd">{k}</span>
  if (ride.kind === 'glide') {
    return (
      <div className="hud-panel ride-bar" role="region" aria-label="Glide">
        <div className="rb-info">
          <span className="hud-title">Gliding</span>
          <span className="rb-line">{hud ? `${hud.speedKmh} km/h · ${hud.altM} m` : '—'}</span>
          <span className="rb-boost" aria-label="Boost"><i style={{ width: `${Math.round((hud?.boost ?? 1) * 100)}%` }} /></span>
          <span className="rb-keys">{kbd('↑')} dive {kbd('↓')} climb {kbd('← →')} turn {kbd('Shift')} boost</span>
        </div>
        <div className="rb-buttons"><button type="button" className="hud-pill" onClick={() => stopRide()} aria-label="Land (Esc)"><RiCloseLine /> Land {kbd('Esc')}</button></div>
      </div>
    )
  }
  const views = VIEWS[ride.kind] ?? []
  const where = hud?.done ? 'End of the line' : hud?.at && hud?.dwelling ? `At ${hud.at}` : hud?.next ? `Next: ${hud.next.name} · ${eta(hud.next.etaS)}` : ''
  return (
    <div className="hud-panel ride-bar" role="region" aria-label={`Riding ${ride.name}`}>
      <div className="rb-info">
        <span className="hud-title">{ride.name}</span>
        <span className="rb-line">{where}{hud?.underground ? (hud.tunnels ? ' · in the subway' : ' · above the subway') : ''}</span>
        {hud?.nearby?.length > 0 && <span className="rb-near">Nearby: {hud.nearby.join(' · ')}</span>}
        <span className="rb-progress" aria-hidden="true"><i style={{ width: `${Math.round((hud?.progress ?? 0) * 100)}%` }} /></span>
      </div>
      <div className="rb-buttons">
        <button type="button" className="dock-btn" aria-label="Previous stop (,)" title="Previous stop (,)" onClick={() => skipTo(-1)}><RiSkipBackLine /></button>
        <button type="button" className="dock-btn" aria-label={ride.paused ? 'Resume (Space)' : 'Pause (Space)'} title="Pause / resume (Space)" onClick={togglePause}>{ride.paused ? <RiPlayLine /> : <RiPauseLine />}</button>
        <button type="button" className="dock-btn" aria-label="Next stop (.)" title="Next stop (.)" onClick={() => skipTo(1)}><RiSkipForwardLine /></button>
        <button type="button" className="hud-pill" aria-label={`Speed ×${ride.speed} (< >)`} title="Speed: < slower, > faster" onClick={() => changeSpeed(ride.speed >= 4 ? -2 : 1)}>×{ride.speed}</button>
        {views.length > 1 && <button type="button" className="hud-pill" aria-label={`View: ${VIEW_NAMES[ride.view]} (C)`} title="Change the view (C)" onClick={cycleView}><RiCameraSwitchLine /> {VIEW_NAMES[ride.view]}</button>}
        <button type="button" className="hud-pill" aria-label="Stop riding (Esc)" onClick={() => stopRide()}><RiCloseLine /> Stop {kbd('Esc')}</button>
      </div>
    </div>
  )
}
