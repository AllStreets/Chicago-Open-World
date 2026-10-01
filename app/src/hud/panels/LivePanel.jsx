// app/src/hud/panels/LivePanel.jsx — the LIVE lens (P4 · I-4.3): every neighbourhood, with its best feel at a glance.
import { useStore } from '../../state/store.js'
import { FEEL_KEYS } from '../../lib/neighborhoods.js'
import { openZone } from '../../world/NeighborhoodZones.jsx'
import { SCAN_METRICS } from '../../scan/scanMath.js'

export default function LivePanel() {
  const hoods = useStore((s) => s.hoods)
  const scan = useStore((s) => s.scan), metric = useStore((s) => s.scanMetric)
  if (!hoods?.length) return <p className="cp-sub">Neighborhood data is not in this world build.</p>
  const best = (z) => FEEL_KEYS.map(([k, l]) => [l, z.feel?.[k] ?? 0]).sort((a, b) => b[1] - a[1])[0][0]
  return (
    <div className="lens-panel">
      <p className="cp-sub">Click a neighborhood — or its name on the map — for its profile.</p>
      {/* P5: in Scan, a light column rises over each neighborhood — pick what its height shows */}
      <div className="lp-scan" role="group" aria-label="Scan columns">
        <span className="hud-label">{scan ? 'Scan columns' : 'Scan (V) shows columns for'}</span>
        {SCAN_METRICS.map(([k, l]) => (
          <button key={k} type="button" className={`hud-pill ${metric === k ? 'active' : ''}`} aria-pressed={metric === k} onClick={() => { useStore.getState().setScanMetric(k); useStore.getState().setScan(true) }}>{l}</button>
        ))}
      </div>
      {[...hoods].sort((a, b) => a.name.localeCompare(b.name)).map((z) => (
        <button key={z.id} type="button" className="lp-row" onClick={() => openZone(z)}>{z.name} <span className="lp-sub">{best(z).toLowerCase()}</span></button>
      ))}
    </div>
  )
}
