// app/src/hud/cards/PoiCard.jsx — a place's card (P4 · I-4.1): name, category, address, cuisine, the raw OSM opening
// hours, the website as text (with a link beside it), the nearest L and Fly here.
import { RiPlaneLine, RiExternalLinkLine } from 'react-icons/ri'
import { useStore } from '../../state/store.js'
import { POI_CATEGORIES } from '../../data/poiCategories.js'
import { buildingPose } from './BuildingCard.jsx'
import NearestL from './NearestL.jsx'

export default function PoiCard({ selection }) {
  const p = selection.data ?? {}, t = p.t ?? {}
  const cat = POI_CATEGORIES[p.c]
  const site = t.website ? String(t.website).replace(/^https?:\/\//, '').replace(/\/$/, '') : null
  return (
    <>
      <span className="hud-title">{p.n}</span>
      <p className="cp-facts">{[cat?.label, t.cuisine?.replace(/_/g, ' '), p.live ? 'live' : null].filter(Boolean).join(' · ')}</p>
      {p.a && <p className="cp-sub">{p.a}</p>}
      {t.opening_hours && <p className="cp-sub" title="Opening hours as mapped in OpenStreetMap">Hours: {t.opening_hours}</p>}
      {site && <p className="cp-sub">{site} <a href={t.website} target="_blank" rel="noreferrer" aria-label={`Open ${site}`}><RiExternalLinkLine /></a></p>}
      <NearestL x={p.x} z={p.z} />
      <button type="button" className="hud-pill" onClick={() => useStore.getState().startFlight(buildingPose({ x: p.x, z: p.z, heightM: Math.max(10, (p.y ?? 10) - 4) }), p.n)}><RiPlaneLine aria-hidden="true" /> Fly here</button>
    </>
  )
}
