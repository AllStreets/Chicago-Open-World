// pipeline/lib/beaches.js — Lincoln Park's lakefront beaches (B, coordinator fix 2026-10-01). OSM maps Oak Street and
// the South Side beaches as natural=beach but not North Avenue Beach or the sand north of it, so the beach house stood on
// lawn among trees. Each beach in data/beaches.json is a north–south band of the lakefront: everything between the
// Lakefront Trail (the landward edge, where the grass and trees begin) and the shore is sand. Beach-volleyball courts
// (OSM pitches on sand) are sand too, never turf.
import polygonClipping from 'polygon-clipping'
import { project } from '../../shared/project.js'
import { openRing, ringBBox, signedArea } from './geom.js'

const close = (r) => [...r, r[0]]
export const isSandPitch = (t = {}) => /beach_?volleyball/.test(t.sport ?? '') || t.surface === 'sand'

// trail: polylines (local metres) of the Lakefront Trail; lake: polygons of the lake side of the shore (lakeSide()).
export function lakefrontBeaches(bands, { trail, lake }) {
  const out = []
  for (const b of bands) {
    const zS = project(0, b.south)[1], zN = project(0, b.north)[1]
    const pts = trail.flat().filter(([, z]) => z <= zS + 60 && z >= zN - 60).sort((p, q) => p[1] - q[1])
    if (pts.length < 2) continue
    // the landward edge: for each 10 m of latitude, the trail's westernmost point there (the cycleway, not the beach walks)
    const rows = new Map()
    for (const [x, z] of pts) { const k = Math.round(z / 10); if (!rows.has(k) || x < rows.get(k)[0]) rows.set(k, [x + (b.setbackM ?? 6), z]) }
    const edge = [...rows.values()].sort((p, q) => p[1] - q[1])
    const east = Math.max(...edge.map((p) => p[0])) + 1500
    const band = [...edge, [east, edge.at(-1)[1]], [east, edge[0][1]]]
    const box = [[-1e6, zN], [1e6, zN], [1e6, zS], [-1e6, zS]]
    const clipped = polygonClipping.intersection([close(band)], [close(box)])
    const dry = lake.length ? polygonClipping.difference(clipped, ...lake.map((p) => [close(p.outer), ...(p.holes ?? []).map(close)])) : clipped
    for (const [outer, ...holes] of dry) {
      const o = openRing(outer)
      if (o.length < 3 || Math.abs(signedArea(o)) < 200) continue
      out.push({ id: `beach-${b.key}`, outer: o, holes: holes.map(openRing), tags: { natural: 'beach', name: b.name, surface: 'sand', source: b.source }, bbox: ringBBox(o) })
    }
  }
  return out
}
