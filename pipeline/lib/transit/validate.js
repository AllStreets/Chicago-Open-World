// pipeline/lib/transit/validate.js — the build refuses a transit network missing a CTA line or a landmark station.
export function transitStats(pieces) {
  const out = {}
  for (const p of pieces) {
    let len = 0
    for (let i = 1; i < p.pts2.length; i++) len += Math.hypot(p.pts2[i][0] - p.pts2[i - 1][0], p.pts2[i][1] - p.pts2[i - 1][1])
    for (const l of p.lines) { out[l] ??= { segments: 0, km: 0 }; out[l].segments++; out[l].km = +(out[l].km + len / 1000).toFixed(3) }
  }
  return out
}

export function validateTransit(stats, catalog, stations) {
  const errors = [], warnings = []
  for (const l of catalog.lines) {
    const s = stats[l.id] ?? { segments: 0, km: 0 }, e = l.expect ?? {}
    if (e.inBounds === false) { if (s.segments) warnings.push(`${l.id}: expected outside the world but found ${s.segments} segments`); continue }
    const bad = s.segments < e.minSegments ? `${l.id}: ${s.segments} segments < ${e.minSegments}`
      : s.km < e.minKm || s.km > e.maxKm ? `${l.id}: ${s.km.toFixed(1)} km outside [${e.minKm}, ${e.maxKm}]` : null
    if (bad) (l.operator === 'cta' ? errors : warnings).push(bad)
  }
  for (const re of catalog.requiredStations ?? []) if (!stations.some((s) => new RegExp(re, 'i').test(s.name))) errors.push(`station missing: /${re}/`)
  return { errors, warnings }
}

export function assertTransit(v, log = console) {
  for (const w of v.warnings) log.warn(`   transit warning: ${w}`)
  if (v.errors.length) throw new Error(`transit validation failed:\n  ${v.errors.join('\n  ')}`)
}
