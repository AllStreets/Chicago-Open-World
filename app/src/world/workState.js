// app/src/world/workState.js — the WORK lens's shared model (P4 · I-4.4): the commute graph (built once from transit),
// and, per office, the isochrone grid, the ranked neighbourhoods and each line's usefulness. Memoised per office.
import { buildCommuteGraph, isochroneGrid, rankZones, lineUsefulness } from '../lib/commute.js'

let graphFor = null, graph = null, cached = null
export const ISO_BOUNDS = { minX: -5375, maxX: 3150, minZ: -7572, maxZ: 6023 }

export function commuteGraph(transit) {
  if (transit !== graphFor) { graphFor = transit; graph = transit ? buildCommuteGraph(transit) : null; cached = null }
  return graph
}

export function officeModel(office, transit, zones) {
  const g = commuteGraph(transit)
  if (!office || !g) return null
  const key = `${Math.round(office.x)}:${Math.round(office.z)}:${zones?.length ?? 0}`
  if (cached?.key === key) return cached
  const dest = [office.x, office.z]
  const ranked = rankZones(dest, g, zones ?? [])
  const usefulness = lineUsefulness(dest, g, ranked.map((r) => r.zone.label))
  cached = { key, grid: isochroneGrid(dest, g, ISO_BOUNDS, 150), ranked, usefulness }
  return cached
}
