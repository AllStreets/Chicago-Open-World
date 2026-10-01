// app/src/hud/panels/LivePanel.jsx — the LIVE lens (P4 · I-4.3): every neighbourhood, with its best feel at a glance.
import { useStore } from '../../state/store.js'
import { FEEL_KEYS } from '../../lib/neighborhoods.js'
import { openZone } from '../../world/NeighborhoodZones.jsx'

export default function LivePanel() {
  const hoods = useStore((s) => s.hoods)
  if (!hoods?.length) return <p className="cp-sub">Neighborhood data is not in this world build.</p>
  const best = (z) => FEEL_KEYS.map(([k, l]) => [l, z.feel?.[k] ?? 0]).sort((a, b) => b[1] - a[1])[0][0]
  return (
    <div className="lens-panel">
      <p className="cp-sub">Click a neighborhood — or its name on the map — for its profile.</p>
      {[...hoods].sort((a, b) => a.name.localeCompare(b.name)).map((z) => (
        <button key={z.id} type="button" className="lp-row" onClick={() => openZone(z)}>{z.name} <span className="lp-sub">{best(z).toLowerCase()}</span></button>
      ))}
    </div>
  )
}
