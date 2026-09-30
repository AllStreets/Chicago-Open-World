// app/src/lib/picking.js — what the pointer is over (P4 · I-4.6): the building index from a raycast hit (V1's
// unique _bldg per tile), its sidecar record, and the tooltip's plain-English lines.
const STOREY_M = 3.8

export function bldgIndexFromHit(hit) {
  const o = hit?.object
  if (!o || (o.name || o.parent?.name) !== 'buildings' || o.userData?.lod === 'block') return null
  const a = o.geometry?.attributes?._bldg
  if (!a || hit.face?.a == null) return null
  const v = a.getX(hit.face.a)
  return Number.isFinite(v) ? Math.round(v) : null
}

export function buildingInfo(meta, idx, landmarks = null) {
  const b = meta?.buildings?.[idx]
  if (!b) return null
  // a landmark building is named by its landmark entry (OSM often leaves stadiums and museums unnamed)
  const lm = b.hero && landmarks ? landmarks.find((l) => l.key === b.hero) : null
  const heightM = Number(b.height) || 0
  const estimated = !(b.stories > 0)
  return {
    id: b.id, name: lm?.name ?? b.name ?? null, address: b.address ?? null, kind: lm?.kind ?? null, kindLine: lm?.kindLine ?? null,
    stories: estimated ? (heightM > 0 ? Math.max(1, Math.round(heightM / STOREY_M)) : null) : Number(b.stories), storiesEstimated: estimated,
    year: b.year ?? null, heightM, hero: b.hero ?? null,
  }
}

export function tooltipLines(info) {
  if (!info) return []
  const lines = [info.name || 'Unnamed building']
  if (info.address) lines.push(info.address)
  // a venue or landmark says what it is (floors of a stadium or a fountain mean nothing)
  if (info.kind && info.kind !== 'tower') { lines.push(info.kindLine ?? (info.year ? `Built ${info.year}` : 'Landmark')); return lines }
  const st = info.stories ? (info.storiesEstimated ? `~${info.stories} stories (est.)` : `${info.stories} stories`) : null
  lines.push([st, info.year ? String(info.year) : 'year unknown'].filter(Boolean).join(' · '))
  return lines
}
