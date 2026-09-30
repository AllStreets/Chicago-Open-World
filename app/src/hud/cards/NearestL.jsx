// app/src/hud/cards/NearestL.jsx — "Nearest L: Grand (Red) · 4 min walk" with line swatches (P4 · I-4.5, C17).
import { useStore } from '../../state/store.js'
import { nearestStations } from '../../lib/nearestTransit.js'

const title = (id) => id.charAt(0).toUpperCase() + id.slice(1)

export default function NearestL({ x, z }) {
  const transit = useStore((s) => s.transit)
  const near = nearestStations(x, z, transit?.stations ?? [], { k: 1 })[0]
  if (!near) return <p className="cp-sub nearest-l">No L within walking distance</p>
  const colour = (id) => transit.lines.find((l) => l.id === id)?.colour ?? '#888'
  return (
    <p className="cp-sub nearest-l">
      <span className="hud-label">Nearest L</span>{' '}
      {near.lines.map((l) => <i key={l} className="tl-swatch" style={{ background: colour(l) }} aria-hidden="true" />)}{' '}
      <span>{`${near.station.name} (${near.lines.map(title).join(', ')}) · ${Math.max(1, Math.round(near.walkMin))} min walk`}</span>
    </p>
  )
}
