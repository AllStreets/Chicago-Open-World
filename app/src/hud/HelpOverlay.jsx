// app/src/hud/HelpOverlay.jsx — every control in plain words (opens on "?" and on a first visit).
import { useEffect } from 'react'
import { useStore } from '../state/store.js'
import { FEATURE_CONTROLS } from './featureControls.js'

const GROUPS = [
  ['Move around', [['↑ ↓ ← →', 'or W A S D — glide over the city'], ['Shift', '+ W A S D to go faster'], ['R / F', 'or Page Up / Down — rise and descend'], ['Scroll', 'or + / − — zoom in and out']]],
  ['Look around', [['Drag', 'with the mouse to turn and tilt'], ['Shift + arrows', 'or Q / E — turn and tilt'], ['N', 'face north'], ['O', 'slowly orbit where you are']]],
  ['Search and fly', [['⌘K', 'or / — find any landmark, neighborhood or view'], ['Double-click', 'anywhere to fly there'], ['[ ]', 'previous / next view'], ['H', 'back home'], ['Minimap', 'click to fly']]],
  ['City life', [
    ...FEATURE_CONTROLS.map((c) => [c.keyLabel, `${c.label} button — ${c.help}`]),
    ['Legend', 'click a transit line to hide or show it; All / None'],
    ['Click', 'a train, a station or a ballpark for its card'],
    ['⌘K', '“Follow a train” rides along (any key stops) · “Go to Clark/Lake” · type “tonight” for tonight’s game'],
  ]],
  ['Time and quality', [['1 – 5', 'live Chicago time, dawn, day, dusk, night'], ['Quality', 'button on the right if things feel slow · Low also turns off water reflections'], ['Stats', '⌘K “performance” shows draw calls and frame rate']]],
]

export default function HelpOverlay() {
  const open = useStore((s) => s.helpOpen)
  const ready = useStore((s) => s.load.ready)
  useEffect(() => {
    if (!ready) return
    let seen = true
    try { seen = localStorage.getItem('chi-ow-help-seen') === '1' } catch {}
    if (!seen) useStore.getState().setHelpOpen(true)
  }, [ready])
  if (!open) return null
  const close = () => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} useStore.getState().setHelpOpen(false) }
  return (
    <div className="cmdk-backdrop help-backdrop" onMouseDown={close}>
      <div className="cmdk hud-panel help" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Controls">
        <div className="help-head"><span className="hud-label">Atlas <span className="slash">/</span> Controls</span><span className="hud-title">How to fly Chicago</span></div>
        <div className="help-grid">
          {GROUPS.map(([title, rows]) => (
            <section key={title}>
              <h3 className="hud-label">{title}</h3>
              {rows.map(([k, v]) => <p key={k}><span className="hud-kbd">{k}</span> {v}</p>)}
            </section>
          ))}
        </div>
        <button type="button" className="hud-pill active help-ok" onClick={close}>Got it</button>
      </div>
    </div>
  )
}
