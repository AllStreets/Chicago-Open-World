// app/src/lib/nearestTransit.js — the nearest L from any point (P4 · I-4.5, C17): the stations in walking range,
// with walking minutes, and the lines they serve. Every card uses this ("Nearest L: Grand (Red) · 4 min walk").
export const WALK_M_PER_MIN = 80 // spec §9
// CHI ATLAS / CTA line codes → the app's line ids (V3)
export const CHI_LINE = { Red: 'red', Blue: 'blue', Brn: 'brown', G: 'green', Org: 'orange', Pink: 'pink', P: 'purple', Y: 'yellow' }

export function nearestStations(x, z, stations, { k = 3, maxM = 1600, kind = 'cta' } = {}) {
  if (!Number.isFinite(x) || !Number.isFinite(z) || !Array.isArray(stations)) return []
  return stations
    .filter((s) => (s.operator ?? 'cta') === kind)
    .map((station) => { const distM = Math.hypot(station.x - x, station.z - z); return { station, distM, walkMin: distM / WALK_M_PER_MIN, lines: station.lines ?? [] } })
    .filter((r) => r.distM <= maxM)
    .sort((a, b) => a.distM - b.distM)
    .slice(0, k)
}

export function linesNear(x, z, stations, maxM = 800) {
  const out = []
  for (const r of nearestStations(x, z, stations, { k: Infinity, maxM })) for (const l of r.lines) if (!out.includes(l)) out.push(l)
  return out
}
