// app/src/hud/panels/VisitPanel.jsx — the VISIT lens (P4 · I-4.2): the guided tours as cards, the place filters, and the
// curated landmarks in today's map by category. (Landmarks outside the map stay in data/landmarks.js for when the
// world grows; the panel lists only what you can fly to.)
import { RiPlayFill, RiArrowRightSLine } from 'react-icons/ri'
import { useStore } from '../../state/store.js'
import { CATEGORY_COLOR } from '../../data/landmarks.js'
import { POI_CAT_IDS } from '../../data/poiCategories.js'
import { TOURS, startTour } from '../../lib/tourPoses.js'
import { beaconSpots, openLandmark } from '../../world/Beacons.jsx'
import PoiFilters from './PoiFilters.jsx'

const CATS = ['icon', 'architecture', 'culture', 'nature', 'hidden']
const CAT_LABEL = { icon: 'Icons', architecture: 'Architecture', culture: 'Culture', nature: 'Nature', hidden: 'Hidden gems' }

export default function VisitPanel() {
  const manifest = useStore((s) => s.manifest)
  const setPoiCats = useStore((s) => s.setPoiCats)
  const spots = manifest ? beaconSpots(manifest) : []
  return (
    <div className="lens-panel visit-panel">
      <section className="vp-sec">
        <h3 className="hud-label vp-head">Tours</h3>
        {TOURS.map((t) => (
          <button key={t.id} type="button" className="vp-tour" onClick={() => startTour(t.id, useStore)}>
            <span className="vp-play" aria-hidden="true"><RiPlayFill /></span>
            <span className="vp-tour-text">
              <span className="vp-tour-name">{t.name}</span>
              <span className="vp-meta">{t.stops.length} stops{t.time ? ` · ${t.time.toLowerCase()}` : ''}</span>
            </span>
          </button>
        ))}
      </section>
      <section className="vp-sec">
        <div className="vp-head">
          <h3 className="hud-label">Places</h3>
          <span className="vp-actions">
            <button type="button" className="vp-link" onClick={() => setPoiCats([...POI_CAT_IDS])}>All</button>
            <button type="button" className="vp-link" onClick={() => setPoiCats([])}>None</button>
          </span>
        </div>
        <PoiFilters bare />
      </section>
      {CATS.map((c) => {
        const here = spots.filter((s) => s.lm.category === c)
        return here.length ? (
          <section key={c} className="vp-sec" style={{ '--cat': CATEGORY_COLOR[c] }}>
            <div className="vp-head">
              <h3 className="hud-label"><i className="lm-dot" /> {CAT_LABEL[c] ?? c}</h3>
              <span className="vp-count">{here.length}</span>
            </div>
            <div className="vp-list">
              {here.map((s) => (
                <button key={s.lm.id} type="button" className="vp-place" onClick={() => openLandmark(s)}>
                  <span>{s.lm.name}</span><RiArrowRightSLine aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>
        ) : null
      })}
    </div>
  )
}
