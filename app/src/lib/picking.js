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

export function buildingInfo(meta, idx) {
  const b = meta?.buildings?.[idx]
  if (!b) return null
  const heightM = Number(b.height) || 0
  const estimated = !(b.stories > 0)
  return {
    id: b.id, name: b.name ?? null, address: b.address ?? null,
    stories: estimated ? (heightM > 0 ? Math.max(1, Math.round(heightM / STOREY_M)) : null) : Number(b.stories), storiesEstimated: estimated,
    year: b.year ?? null, heightM, hero: b.hero ?? null,
  }
}

export function tooltipLines(info) {
  if (!info) return []
  const lines = [info.name || 'Unnamed building']
  if (info.address) lines.push(info.address)
  const st = info.stories ? (info.storiesEstimated ? `~${info.stories} stories (est.)` : `${info.stories} stories`) : null
  lines.push([st, info.year ? String(info.year) : 'year unknown'].filter(Boolean).join(' · '))
  return lines
}
