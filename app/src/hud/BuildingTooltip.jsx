// app/src/hud/BuildingTooltip.jsx — the name, address, stories and year of the building under the pointer (P4 · I-4.6).
import { useStore } from '../state/store.js'
import { hudScale } from '../lib/hudScale.js'

export default function BuildingTooltip() {
  const hover = useStore((s) => s.hover)
  if (!hover?.lines?.length) return null
  const k = hudScale(window.innerWidth, window.innerHeight) // the HUD is zoomed; pointer pixels are not
  return (
    <div className="hud-panel building-tooltip" role="tooltip" style={{ left: (hover.x + 14) / k, top: (hover.y + 14) / k }}>
      {hover.lines.map((l, i) => <div key={i} className={i === 0 ? 'bt-name' : 'bt-line'}>{l}</div>)}
    </div>
  )
}
