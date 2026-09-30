// app/src/hud/cards/PoiCard.jsx — a place's card (P4 · I-4.1, user fixes): a header in the category's colour with its
// glyph, the address, cuisine and opening hours as mapped, a prominent Website button (or a web search when the map
// has no site), the nearest L and Fly here. Links open in a new tab.
import { RiPlaneLine, RiExternalLinkLine, RiSearchLine, RiTimeLine, RiMapPinLine } from 'react-icons/ri'
import { useStore } from '../../state/store.js'
import { POI_CATEGORIES } from '../../data/poiCategories.js'
import { poiIcon } from '../../data/poiIcons.js'
import { buildingPose } from './BuildingCard.jsx'
import NearestL from './NearestL.jsx'

const withScheme = (u) => (/^https?:\/\//i.test(u) ? u : `https://${u}`)
const niceHost = (u) => withScheme(u).replace(/^https?:\/\//i, '').replace(/^www\./, '').replace(/\/$/, '')

export default function PoiCard({ selection }) {
  const p = selection.data ?? {}, t = p.t ?? {}
  const cat = POI_CATEGORIES[p.c] ?? POI_CATEGORIES[0], Icon = poiIcon(cat.icon)
  const site = t.website ? withScheme(String(t.website).split(';')[0].trim()) : null
  const search = `https://www.google.com/search?q=${encodeURIComponent(`${p.n} Chicago`)}`
  return (
    <div className="poi-card" style={{ '--cat': cat.color }}>
      <div className="pc-head">
        <span className="pc-icon"><Icon aria-hidden="true" /></span>
        <div>
          <span className="hud-title">{p.n}</span>
          <p className="pc-kind"><span>{cat.label}</span>{t.cuisine && <span> · {t.cuisine.replace(/_/g, ' ').replace(/;/g, ', ')}</span>}{p.live && <span> · live</span>}</p>
        </div>
      </div>
      {p.a && <p className="cp-sub pc-row"><RiMapPinLine aria-hidden="true" /> {p.a}</p>}
      {t.opening_hours && <p className="cp-sub pc-row" title="Opening hours as mapped in OpenStreetMap"><RiTimeLine aria-hidden="true" /> {t.opening_hours}</p>}
      {Number.isFinite(p.x) && <NearestL x={p.x} z={p.z} />}
      <div className="cp-actions">
        {site
          ? <a className="hud-pill pc-web" href={site} target="_blank" rel="noreferrer"><RiExternalLinkLine aria-hidden="true" /> Website <span className="pc-host">{niceHost(site)}</span></a>
          : <a className="hud-pill" href={search} target="_blank" rel="noreferrer"><RiSearchLine aria-hidden="true" /> Search the web</a>}
        {Number.isFinite(p.x) && <button type="button" className="hud-pill" onClick={() => useStore.getState().startFlight(buildingPose({ x: p.x, z: p.z, heightM: Math.max(10, (p.y ?? 10) - 4) }), p.n)}><RiPlaneLine aria-hidden="true" /> Fly here</button>}
      </div>
    </div>
  )
}
