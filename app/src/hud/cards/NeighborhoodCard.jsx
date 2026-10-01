// app/src/hud/cards/NeighborhoodCard.jsx — a neighbourhood's profile (P4 · I-4.3): character, vibe, rent (honest about
// what is known), the L lines near it, five feel scores, and every source with its date.
import { useStore } from '../../state/store.js'
import { rentRangeLabel, scoreBars } from '../../lib/neighborhoods.js'

export default function NeighborhoodCard({ selection }) {
  const z = selection.data ?? {}, transit = useStore((s) => s.transit)
  const colour = (id) => transit?.lines.find((l) => l.id === id)?.colour ?? '#888'
  return (
    <>
      <span className="hud-title">{z.name}</span>
      <div className="nb-vibe">{(z.vibe ?? []).map((v) => <span key={v} className="hud-chip">{v}</span>)}</div>
      <p className="cp-sub">{z.character}</p>
      <p className="cp-facts" title={z.rent?.source ? `${z.rent.source} · ${z.rent.asOf}` : undefined}>{rentRangeLabel(z.rent)}</p>
      {z.lines?.length > 0 && <p className="cp-sub nearest-l"><span className="hud-label">L lines</span> {z.lines.map((l) => <i key={l} className="tl-swatch" title={l} style={{ background: colour(l) }} />)}</p>}
      <div className="nb-bars" role="list" aria-label="How it feels">
        {scoreBars(z.feel).map((b) => (
          <div key={b.key} className="nb-bar" role="listitem" aria-label={`${b.label} ${b.value} of 10`}>
            <span>{b.label}</span><i><b style={{ width: `${b.value * 10}%` }} /></i><em>{b.value.toFixed(1)}</em>
          </div>
        ))}
      </div>
      <p className="nb-note">Scores rank the 22 zones against each other: places, stations, parks and busy roads.</p>
      <p className="nb-sources">{(z.sources ?? []).map((s) => <span key={s.url}>{s.label} ({s.asOf})</span>)}</p>
    </>
  )
}
