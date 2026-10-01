// app/src/hud/cards/BuildingCard.jsx — a building's card (P4 · I-4.6): name, address, stories, year, height, the
// nearest L, and Fly here (a close look that clears the roofs around it).
import { RiPlaneLine } from 'react-icons/ri'
import { useStore } from '../../state/store.js'
import { ensureClear } from '../../lib/poseClearance.js'
import NearestL from './NearestL.jsx'
import VenueActions from '../VenueActions.jsx'

export function buildingPose({ x, z, heightM = 20 }) {
  const d = Math.max(160, heightM * 2.2)
  return ensureClear({ position: [x + d * 0.6, heightM * 0.8 + 70, z + d * 0.7], target: [x, heightM * 0.5, z] })
}

export default function BuildingCard({ selection }) {
  const d = selection.data ?? {}
  const venue = d.kind && d.kind !== 'tower' // a stadium, museum or fountain says what it is, not how many floors
  const facts = venue
    ? [d.kindLine, d.year ? `built ${d.year}` : null].filter(Boolean)
    : [d.stories && (d.storiesEstimated ? `~${d.stories} floors` : `${d.stories} floors`), d.year ? `built ${d.year}` : null, d.heightM ? `${Math.round(d.heightM)} m` : null].filter(Boolean)
  return (
    <>
      {/* a building with no name in the map data leads with its address */}
      <span className="hud-title">{d.name || d.address || 'Building'}</span>
      {d.name && d.address && <p className="cp-sub">{d.address}</p>}
      {facts.length > 0 && <p className="cp-facts">{facts.join(' · ')}</p>}
      {Number.isFinite(d.x) && <NearestL x={d.x} z={d.z} />}
      <VenueActions venueKey={selection.id} />
      {Number.isFinite(d.x) && <button type="button" className="hud-pill" onClick={() => useStore.getState().startFlight(buildingPose(d), d.name || 'Building')}><RiPlaneLine aria-hidden="true" /> Fly here</button>}
    </>
  )
}
