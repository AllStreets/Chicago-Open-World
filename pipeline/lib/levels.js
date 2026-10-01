// pipeline/lib/levels.js — Workstream D0: the vertical stack under Chicago's flat street datum (model y 0).
// Pure helpers for pipeline/data/levels.json: invariants (D0-1), LiDAR sample summaries (D0-2), subway-tube
// crossings and dip checks (D0-3), and the compact lower-level centrelines the D0-4 bytes ledger measures.
// Nothing here draws anything; D1–D5 read the constants from levels.json.
import { project } from '../../shared/project.js'
import { pointInRing } from './geom.js'
import { ROAD_WIDTHS } from './ground.js'

export const FT = 0.3048
export const LEVEL_SPACING_MIN_M = 4.0

export function median(xs) {
  const a = [...xs].sort((p, q) => p - q), n = a.length
  if (!n) return NaN
  return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2
}

// D0-1 invariants. Returns a list of human-readable failures (empty = fine).
export function checkLevels(L) {
  const f = []
  if (!(L.LOWER_Y - L.RIVER_Y >= 0.8)) f.push(`LOWER_Y − RIVER_Y = ${(L.LOWER_Y - L.RIVER_Y).toFixed(2)} < 0.8 (lower deck must stay above the river)`)
  if (!(-L.SLAB_M - L.LOWER_Y >= Math.max(4.19, L.CLEAR_M))) f.push(`clearance under the upper slab = ${(-L.SLAB_M - L.LOWER_Y).toFixed(2)} m < ${Math.max(4.19, L.CLEAR_M)} (13′9″)`)
  if (!(L.CLEAR_M >= 4.19)) f.push(`CLEAR_M ${L.CLEAR_M} < 4.19 (13′9″)`)
  const step = L.LAKE_Y - L.RIVER_Y
  if (!(step >= 0 && step <= 1.7)) f.push(`LAKE_Y − RIVER_Y = ${step.toFixed(2)} outside [0, 1.7]`)
  if (!(L.RIVERWALK_Y > L.RIVER_Y + 0.3 && L.RIVERWALK_Y < 0)) f.push(`RIVERWALK_Y ${L.RIVERWALK_Y} must sit above the water (RIVER_Y + 0.3) and below the street`)
  // the third level is a service deck: measured level spacing is ≈ 4.0–4.3 m (levels.json.notes.levelSpacing)
  if (!(L.LOWER_Y - L.LOWER2_Y >= LEVEL_SPACING_MIN_M)) f.push(`LOWER2_Y ${L.LOWER2_Y} must sit ≥ ${LEVEL_SPACING_MIN_M} m under LOWER_Y`)
  return f
}

export const ccdToNavd88 = (ftCcd, datum) => datum.ccdZeroNavd88Ft + ftCcd
export const igldToNavd88 = (ftIgld, datum) => ftIgld + datum.igld85ToNavd88Ft

// The water surfaces the drops are measured to (ft NAVD88): the river at its regulated normal level, the lake at
// its long-term mean. The LiDAR's own hydro-flattened water is NOT used (see levels.json.water.lidarWaterNote).
export function waterRefsNavd88(data) {
  const { datum, water } = data
  return { river: ccdToNavd88(water.riverNormalCcdFt, datum), lake: igldToNavd88(water.lakeMeanIgldFt, datum) }
}

const med = (samples, kind) => median(samples.filter((s) => s.kind === kind).map((s) => s.ftNavd88))

// Medians per kind → drops in metres. River-side drops are measured from Upper Wacker (the street the model flattens
// to y 0 beside the river); the lake drop from the lakefront street / park grade.
export function summarizeSamples(samples, water) {
  const upperWackerFt = med(samples, 'upperWacker'), lakeStreetFt = med(samples, 'lakeStreet')
  return {
    loopStreetFt: med(samples, 'loopStreet'),
    upperWackerFt,
    riverwalkFt: med(samples, 'riverwalk'),
    bridgeApproachFt: med(samples, 'bridgeApproach'),
    lakeStreetFt,
    lakeEdgeFt: med(samples, 'lakeEdge'),
    riverDropM: (upperWackerFt - water.river) * FT,
    riverwalkDropM: (upperWackerFt - med(samples, 'riverwalk')) * FT,
    lakeDropM: (lakeStreetFt - water.lake) * FT,
    lakeEdgeAboveWaterM: (med(samples, 'lakeEdge') - water.lake) * FT,
    // ramp mouths where the lower roadway is open to the sky read below the Loop grade; ones that read the street don't count
    lowerDropM: (upperWackerFt - median(samples.filter((s) => s.kind === 'lowerEntrance' && s.ftNavd88 < med(samples, 'loopStreet') - 3).map((s) => s.ftNavd88))) * FT,
  }
}

// D0-2 done-when: every model value within ±tol of the LiDAR median it stands for.
export function sampleChecks(data, tol = 0.7) {
  const summary = summarizeSamples(data.samples, waterRefsNavd88(data))
  const L = data.levels, failures = []
  const pairs = [['RIVER_Y', -L.RIVER_Y, summary.riverDropM], ['LAKE_Y', -L.LAKE_Y, summary.lakeDropM], ['RIVERWALK_Y', -L.RIVERWALK_Y, summary.riverwalkDropM], ['LOWER_Y', -L.LOWER_Y, summary.lowerDropM]]
  for (const [k, model, lidar] of pairs) if (!(Math.abs(model - lidar) <= tol)) failures.push(`${k}: model ${model.toFixed(2)} m vs LiDAR ${lidar.toFixed(2)} m`)
  return { summary, failures }
}

// ── D0-3 subway tubes ─────────────────────────────────────────────────────────────────────────────────────────────
function segInter(a, b, c, d) {
  const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]]
  const den = r[0] * s[1] - r[1] * s[0]
  if (Math.abs(den) < 1e-12) return null
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den, u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [a[0] + t * r[0], a[1] + t * r[1]] : null
}
const inPoly = (p, poly) => pointInRing(p, poly.outer) && !(poly.holes || []).some((h) => pointInRing(p, h))

// Length of a polyline inside a polygon, and the middle of that run (sampled every ~1 m).
function runInside(points, poly) {
  let len = 0, sx = 0, sz = 0, n = 0
  for (let i = 0; i + 1 < points.length; i++) {
    const [a, b] = [points[i], points[i + 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.ceil(L))
    for (let j = 0; j < k; j++) {
      const t = (j + 0.5) / k, p = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]
      if (inPoly(p, poly)) { len += L / k; sx += p[0]; sz += p[1]; n++ }
    }
  }
  return n ? { lengthM: len, at: [sx / n, sz / n] } : null
}

// tubes / lowers: [{ id, name, points:[[x,z]…], layer? }]; rivers: [{ id, outer, holes }] (model metres)
export function tubeCrossings({ tubes, rivers, lowers }) {
  const out = []
  for (const t of tubes) {
    for (const r of rivers) {
      const run = runInside(t.points, r)
      if (run) out.push({ kind: 'river', tube: t.name, tubeId: t.id, river: r.id, ...run })
    }
    for (const w of lowers) {
      for (let i = 0; i + 1 < t.points.length; i++) for (let j = 0; j + 1 < w.points.length; j++) {
        const p = segInter(t.points[i], t.points[i + 1], w.points[j], w.points[j + 1])
        if (p) out.push({ kind: 'lower', tube: t.name, tubeId: t.id, road: w.name, roadId: w.id, layer: w.layer, at: p })
      }
    }
  }
  return out
}

// Tube ceilings: rail top + clearance (app/src/transit/tunnels.js TUNNEL.clear) must clear the water by 1 m and
// the deepest lower deck by 1 m.
export function tubeDipChecks(data) {
  const L = data.levels, clear = data.tubeDips.tunnelClearM ?? 4.2, f = []
  for (const c of data.tubeDips.crossings) {
    const ceiling = c.railY + clear
    const limit = c.kind === 'river' ? L.RIVER_Y - 1 : L.LOWER2_Y - 1
    if (!(ceiling < limit)) f.push(`${c.key}: ceiling ${ceiling.toFixed(1)} ≥ ${limit.toFixed(1)}`)
  }
  return f
}

// ── D0-4 lower-level centrelines (what D2-1 will ship) ────────────────────────────────────────────────────────────
// The multi-level streets are a downtown phenomenon. Outside this box, layer<0 highways are rail underpasses and
// expressway trenches, which D2 must not turn into decks.
export const LOWER_ZONE = { s: 41.8745, n: 41.8975, w: -87.6455, e: -87.6080 }
const DRIVABLE = new Set(Object.keys(ROAD_WIDTHS))

export function lowerLevelZone(el) {
  const t = el.tags || {}
  if (!DRIVABLE.has(t.highway) || !(Number(t.layer) < 0)) return false
  const g = el.geometry || []
  return g.length > 1 && g.every((p) => p.lat >= LOWER_ZONE.s && p.lat <= LOWER_ZONE.n && p.lon >= LOWER_ZONE.w && p.lon <= LOWER_ZONE.e)
}

const r1 = (v) => Math.round(v * 10) / 10 || 0
export function compactLowerWays(els) {
  return els.map((e) => {
    const lanes = Number(e.tags.lanes)
    const w = Number.isFinite(lanes) && lanes > 0 ? Math.max(lanes * 3.3, 5) : ROAD_WIDTHS[e.tags.highway] ?? 6
    return { id: e.id, n: e.tags.name || null, l: Number(e.tags.layer), w, p: e.geometry.map((p) => project(p.lon, p.lat).map(r1)) }
  })
}
