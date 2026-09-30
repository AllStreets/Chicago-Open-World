// app/src/hud/TransitLegend.jsx — the line legend: a swatch and an on/off switch for every line in the world.
import { useState } from 'react'
import { RiArrowDownSLine, RiArrowUpSLine } from 'react-icons/ri'
import { useStore } from '../state/store.js'

export default function TransitLegend() {
  const transit = useStore((s) => s.transit)
  const on = useStore((s) => s.transitOn)
  const hidden = useStore((s) => s.hiddenLines)
  const [open, setOpen] = useState(false) // compact by default: a swatch strip, so the legend never covers the city
  if (!transit || !on) return null
  const { toggleLine, setHiddenLines } = useStore.getState()
  const groups = [['CTA L', transit.lines.filter((l) => l.operator === 'cta')], ['Metra', transit.lines.filter((l) => l.operator === 'metra')]]
  return (
    <div className="hud-panel transit-legend" role="group" aria-label="Transit lines">
      <div className="tl-head">
        <span className="hud-label">Transit lines</span>
        <button type="button" className="tl-mini" onClick={() => setHiddenLines([])}>All</button>
        <button type="button" className="tl-mini" onClick={() => setHiddenLines(transit.lines.map((l) => l.id))}>None</button>
        <button type="button" className="tl-mini" aria-label={open ? 'Collapse legend' : 'Expand legend'} onClick={() => setOpen(!open)}>{open ? <RiArrowDownSLine /> : <RiArrowUpSLine />}</button>
      </div>
      {!open && (
        <div className="tl-strip">
          {groups[0][1].map((l) => (
            <button key={l.id} type="button" className={`tl-chip${hidden.includes(l.id) ? '' : ' on'}`} aria-label={l.name} title={l.name}
              aria-pressed={!hidden.includes(l.id)} onClick={() => toggleLine(l.id)} style={{ background: l.colour }} />
          ))}
          {groups[1][1].length > 0 && <button type="button" className="tl-more" onClick={() => setOpen(true)}>+ {groups[1][1].length} Metra</button>}
        </div>
      )}
      {open && groups.map(([title, lines]) => lines.length > 0 && (
        <section key={title}>
          <h3 className="hud-label tl-group">{title}</h3>
          {lines.map((l) => {
            const shown = !hidden.includes(l.id)
            return (
              <button key={l.id} type="button" className={`tl-line${shown ? ' on' : ''}`} aria-pressed={shown} onClick={() => toggleLine(l.id)}>
                <i className="tl-swatch" style={{ background: l.colour }} />
                <span>{l.name}</span>
              </button>
            )
          })}
        </section>
      ))}
    </div>
  )
}
