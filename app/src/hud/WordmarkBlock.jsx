import { useStore } from '../state/store.js'
import HudClock from './HudClock.jsx'

export default function WordmarkBlock() {
  const r = useStore((s) => s.readout)
  const transit = useStore((s) => s.transit)
  return (
    <div className="hud-panel hud-wordmark">
      <div className="wm-row">
        <span className="wm-logo">CHI ATLAS</span>
        <span className="wm-sub">OPEN WORLD</span>
      </div>
      <div className="wm-readout">{r.streets} · {r.altitude} M ALT · HDG {String(r.heading).padStart(3, '0')}°</div>
      <div className="wm-clock"><HudClock /></div>
      {transit && <div className="wm-chips"><span className="hud-chip" title="Trains run on typical schedules until the live CTA feed arrives (Phase 5)">SIMULATED</span></div>}
    </div>
  )
}
