// app/src/world/livePlaces.js — CHI ATLAS's live places (P4 · I-4.1), fetched once per session on the first visit to
// the VISIT lens and merged where the build-time map has nothing: pinned on the local roof height. Offline: nothing.
import { chiGet } from '../services/chiApi.js'
import { useStore } from '../state/store.js'
import { project } from '../../../shared/project.js'
import { roofHeightAt } from '../lib/clearance.js'
import { mergeLivePlaces } from '../lib/poiFilter.js'
import { allTilePois, registerTilePois } from './poiRegistry.js'

const BBOX = { s: 41.826, w: -87.695, n: 41.952, e: -87.595 }
let started = false
export async function loadLivePlaces({ get = chiGet } = {}) {
  if (started) return 0
  started = true
  const [a, b] = await Promise.all([get('/api/places?type=all'), get('/api/places?type=nightlife_all')])
  useStore.getState().setFeed('places', a || b ? 'LIVE' : 'SIMULATED') // P5: the chip's sources list names it
  if (!a && !b) started = false // offline: try again on the next visit (the probe may have come up since)
  const live = { places: [...(a?.places ?? []), ...(b?.places ?? [])] }
  const inWorld = (p) => p.lat >= BBOX.s && p.lat <= BBOX.n && p.lon >= BBOX.w && p.lon <= BBOX.e
  const anchor = ({ x, z }) => ({ x, y: (roofHeightAt(x, z) || 0) + 6, z, bldg: -1 })
  const added = mergeLivePlaces(allTilePois(), live, { project, anchor, inWorld }).filter((p) => p.live)
  registerTilePois('live', added)
  return added.length
}
export const _resetLivePlaces = () => { started = false }
