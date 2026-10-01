// app/src/hud/panels/WorkPanel.jsx — the WORK lens (P4 · I-4.4): set an office (click the map, or type an address in
// ⌘K), then see how far the L gets you — isochrone shells on the map, the useful lines brighter, and every
// neighbourhood ranked by commute. Always labelled as an estimate.
import { useEffect } from 'react'
import { RiMapPinUserLine, RiCrosshair2Line } from 'react-icons/ri'
import { useStore } from '../../state/store.js'
import { officeModel } from '../../world/workState.js'
import { setLineGain, resetLineEmphasis } from '../../transit/lineEmphasis.js'
import { openZone } from '../../world/NeighborhoodZones.jsx'

// the isochrone shells' colours (world/Isochrones.jsx): cyan < 15 min, amber < 30, red beyond
export const BAND = { near: '#45d8ff', mid: '#ffc84d', far: '#ff5c4d' }
export const bandColour = (m) => (m < 15 ? BAND.near : m < 30 ? BAND.mid : BAND.far)
const fmt = (m) => (m < 60 ? `${Math.round(m)} min` : `${Math.floor(m / 60)} h ${Math.round(m % 60)} min`)

export default function WorkPanel() {
  const office = useStore((s) => s.office), armed = useStore((s) => s.officeArmed), transit = useStore((s) => s.transit), hoods = useStore((s) => s.hoods)
  const model = officeModel(office, transit, hoods)
  const colour = (id) => transit?.lines.find((l) => l.id === id)?.colour ?? '#888'
  useEffect(() => {
    if (!model) return undefined
    for (const l of transit?.lines ?? []) setLineGain(l.id, 0.6 + 0.8 * (model.usefulness.get(l.id) ?? 0))
    return () => resetLineEmphasis()
  }, [model, transit])
  const s = useStore.getState()
  return (
    <div className="lens-panel">
      <p className="cp-facts">ESTIMATE · simplified transit model</p>
      <button type="button" className={`hud-pill${armed ? ' active' : ''}`} aria-pressed={armed} onClick={() => s.setOfficeArmed(!armed)}>
        {armed ? <RiCrosshair2Line aria-hidden="true" /> : <RiMapPinUserLine aria-hidden="true" />} {armed ? 'Click the map to set your office' : 'Set office'}
      </button>
      <p className="cp-sub">{office ? <>Office: <b>{office.label}</b></> : 'Or type an address in ⌘K, like “333 N Green”.'}</p>
      {model && (
        <>
          <h3 className="hud-label">Commute by neighborhood</h3>
          {model.ranked.map((r) => (
            <button key={r.zone.id} type="button" className="lp-row wp-row" style={{ '--band': bandColour(r.minutes) }} onClick={() => openZone(r.zone)}>
              <span className="wp-name">{r.zone.name}</span>
              <span className="wp-time">
                {r.lines.map((l) => <i key={l} className="tl-swatch" title={l} style={{ background: colour(l) }} />)}
                {fmt(r.minutes)}{r.lines.length ? ` · ${r.lines.join(' → ')}` : ' · walk'}
              </span>
            </button>
          ))}
          <p className="nb-note">Walk 80 m/min · L 30 km/h · +4 min per transfer · at most one transfer. CTA L only.</p>
        </>
      )}
    </div>
  )
}
