// pipeline/lib/transit/grade.js — elevated / embankment / at_grade / subway from OSM tags, and rail-top heights with ramps.
import { segLen } from './polyline.js'

export const RAIL_TOP_Y = { cta: 7.2, metra: 5.8 } // CTA deck ~23 ft over the street; Chicago rail embankments ~19 ft
export const AT_GRADE_Y = 0.35   // rail top on ballast
export const SUBWAY_Y = -9       // rail top in the tubes (hidden)
export const RAMP_SLOPE = 0.04   // 4 % inclines and portal ramps
export const SHORT_EMBANKMENT_GAP_M = 600
export const SHORT_BRIDGE_M = 120

const yes = (v) => v != null && v !== 'no'

export function gradeOf(tags = {}) {
  const layer = parseInt(tags.layer ?? '0', 10) || 0
  if (yes(tags.tunnel) || tags.location === 'underground' || (layer < 0 && !yes(tags.bridge))) return 'subway'
  if (yes(tags.bridge)) return 'elevated'
  if (yes(tags.embankment)) return 'embankment'
  if (yes(tags.cutting)) return 'at_grade'
  if (layer >= 1) return tags.railway === 'rail' ? 'embankment' : 'elevated'
  return 'at_grade'
}

export function refineGrades(segs) {
  const out = segs.map((s) => s.grade)
  const runs = []
  segs.forEach((s, i) => {
    const last = runs.at(-1)
    if (last && last.grade === s.grade) { last.end = i; last.len += s.len } else runs.push({ grade: s.grade, start: i, end: i, len: s.len })
  })
  const raised = (r) => r && (r.grade === 'elevated' || r.grade === 'embankment')
  const low = (r) => !r || r.grade === 'at_grade'
  const fill = (r, g) => { for (let i = r.start; i <= r.end; i++) out[i] = g }
  runs.forEach((r, k) => {
    const prev = runs[k - 1], next = runs[k + 1]
    // Chicago rail rides embankments between viaducts; OSM rarely tags the embankment itself
    if (segs[r.start].rail && r.grade === 'at_grade' && r.len <= SHORT_EMBANKMENT_GAP_M && raised(prev) && raised(next)) fill(r, 'embankment')
    // a short CTA bridge on a line that is otherwise at grade crosses a ditch or canal at track level
    // (Metra bridges are real rises between embankments, so the rule skips railway=rail)
    if (!segs[r.start].rail && r.grade === 'elevated' && r.len <= SHORT_BRIDGE_M && low(prev) && low(next) && (prev || next)) fill(r, 'at_grade')
  })
  return out
}

export const targetY = (grade, operator) => (grade === 'subway' ? SUBWAY_Y : grade === 'at_grade' ? AT_GRADE_Y : RAIL_TOP_Y[operator] ?? RAIL_TOP_Y.metra)

// D1-5: the tubes dive under the sunken river (and under the lower decks). Each subway vertex may go down to its dip
// target (`target(p)`, Infinity where there is none), the deep run spreading out along the line at RAMP_SLOPE — but
// never into a station (`fixed(i)`: the platforms stay level at SUBWAY_Y) and never into a portal ramp: from every
// fixed vertex the line may only fall away at RAMP_SLOPE. So a crossing close to a station dips as deep as the 4 %
// ramp from its platform end allows, and a crossing far from one reaches its full target.
export function dipProfile(pts, ys, { target, fixed, slope = RAMP_SLOPE }) {
  const n = pts.length, cap = Array(n), floor = Array(n)
  for (let i = 0; i < n; i++) {
    const subway = ys[i] <= SUBWAY_Y + 1e-6
    cap[i] = subway ? target(pts[i], i) : Infinity
    floor[i] = !subway || fixed(pts[i], i) ? ys[i] : -Infinity
  }
  for (let i = 1; i < n; i++) { const d = slope * segLen(pts[i - 1], pts[i]); cap[i] = Math.min(cap[i], cap[i - 1] + d); floor[i] = Math.max(floor[i], floor[i - 1] - d) }
  for (let i = n - 2; i >= 0; i--) { const d = slope * segLen(pts[i], pts[i + 1]); cap[i] = Math.min(cap[i], cap[i + 1] + d); floor[i] = Math.max(floor[i], floor[i + 1] - d) }
  return ys.map((y, i) => +Math.min(y, Math.max(cap[i], floor[i])).toFixed(2))
}

// each vertex takes the higher target of its two segments; a forward and a backward pass limit the slope,
// so ramps always fall on the lower side (the at-grade approach, or the subway portal)
export function heightProfile(pts, segGrades, operator) {
  const n = pts.length, y = Array(n).fill(-Infinity)
  segGrades.forEach((g, i) => { const t = targetY(g, operator); y[i] = Math.max(y[i], t); y[i + 1] = Math.max(y[i + 1], t) })
  for (let i = 1; i < n; i++) y[i] = Math.max(y[i], y[i - 1] - RAMP_SLOPE * segLen(pts[i - 1], pts[i]))
  for (let i = n - 2; i >= 0; i--) y[i] = Math.max(y[i], y[i + 1] - RAMP_SLOPE * segLen(pts[i], pts[i + 1]))
  return y.map((v) => +v.toFixed(2))
}
