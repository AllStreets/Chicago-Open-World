// app/src/hud/panels/VisitPanel.jsx — the VISIT lens (P4 · I-4.2): three guided tours, the place filters, and the
// curated landmarks by category (those beyond today's map are listed, not dropped).
import { RiPlayLine } from 'react-icons/ri'
import { useStore } from '../../state/store.js'
import { LANDMARKS, CATEGORY_COLOR, inWorld } from '../../data/landmarks.js'
import { TOURS, startTour } from '../../lib/tourPoses.js'
import { beaconSpots, openLandmark } from '../../world/Beacons.jsx'
import PoiFilters from './PoiFilters.jsx'

const BBOX = { s: 41.826, w: -87.695, n: 41.952, e: -87.595 }
const CATS = ['icon', 'architecture', 'culture', 'nature', 'hidden']

export default function VisitPanel() {
  const manifest = useStore((s) => s.manifest)
  const spots = manifest ? beaconSpots(manifest) : []
  const beyond = LANDMARKS.filter((l) => !inWorld(l, BBOX))
  return (
    <div className="lens-panel">
      <h3 className="hud-label">Tours</h3>
      {TOURS.map((t) => <button key={t.id} type="button" className="lp-row" onClick={() => startTour(t.id, useStore)}><RiPlayLine aria-hidden="true" /> {t.name} <span className="lp-sub">{t.stops.length} stops{t.time ? ` · ${t.time.toLowerCase()}` : ''}</span></button>)}
      <h3 className="hud-label">Places</h3>
      <PoiFilters />
      {CATS.map((c) => {
        const here = spots.filter((s) => s.lm.category === c)
        return here.length ? (
          <section key={c}>
            <h3 className="hud-label"><i className="lm-dot" style={{ background: CATEGORY_COLOR[c] }} /> {c}</h3>
            {here.map((s) => <button key={s.lm.id} type="button" className="lp-row" onClick={() => openLandmark(s)}>{s.lm.name}</button>)}
          </section>
        ) : null
      })}
      {beyond.length > 0 && (
        <section>
          <h3 className="hud-label">Beyond the map — coming in Phase 6</h3>
          {beyond.map((l) => <p key={l.id} className="lp-sub lp-beyond">{l.name}</p>)}
        </section>
      )}
    </div>
  )
}
