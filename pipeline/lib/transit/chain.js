// pipeline/lib/transit/chain.js — an OSM route relation → ordered runs of track (with the way under each segment) and its stops.
import { projectOnPolyline, cumulative } from './polyline.js'

const JOIN_M = 1
export const MIN_RUN_M = 50
export const isTrackRole = (role = '') => role === '' || role === 'forward' || role === 'backward'
export const isStopRole = (role = '') => /^stop(_entry_only|_exit_only)?$/.test(role)

const ends = (w) => [{ node: w.nodes?.[0], pt: w.pts[0] }, { node: w.nodes?.at(-1), pt: w.pts.at(-1) }]
const meet = (a, b) => (a.node != null && a.node === b.node) || Math.hypot(a.pt[0] - b.pt[0], a.pt[1] - b.pt[1]) < JOIN_M
const touches = (end, w) => ends(w).some((e) => meet(end, e))

export function chainRelation(rel, ways) {
  const list = rel.members.filter((m) => m.type === 'way' && isTrackRole(m.role)).map((m) => ways.get(m.ref))
  const runs = []
  let cur = null
  const finish = () => { if (cur && cumulative(cur.pts).at(-1) >= MIN_RUN_M) runs.push(cur); cur = null }
  const start = (w, next) => {
    const [a, b] = ends(w)
    const flip = !!next && !touches(b, next) && touches(a, next)
    cur = { pts: flip ? [...w.pts].reverse() : [...w.pts], segWay: Array(w.pts.length - 1).fill(w.id), wayIds: [w.id], end: flip ? a : b }
  }
  for (let i = 0; i < list.length; i++) {
    const w = list[i]
    if (!w || w.pts.length < 2) { finish(); continue } // outside the bbox: the run breaks here
    const n = list[i + 1], next = n && n.pts.length >= 2 ? n : null
    if (!cur) { start(w, next); continue }
    const [a, b] = ends(w)
    let pts, end
    if (meet(cur.end, a)) { pts = w.pts; end = b }
    else if (meet(cur.end, b)) { pts = [...w.pts].reverse(); end = a }
    else { finish(); start(w, next); continue }
    cur.pts.push(...pts.slice(1)); cur.segWay.push(...Array(pts.length - 1).fill(w.id)); cur.wayIds.push(w.id); cur.end = end
  }
  finish()
  return runs.map(({ pts, segWay, wayIds }) => ({ pts, segWay, wayIds }))
}

export function stopsOnRun(run, stops, maxD = 40) {
  return stops
    .map((st) => ({ st, pr: projectOnPolyline(run.pts, st.pt) }))
    .filter(({ pr }) => pr.d <= maxD)
    .sort((a, b) => a.pr.s - b.pr.s)
    .map(({ st, pr }) => ({ id: st.id, name: st.name, pt: st.pt, s: +pr.s.toFixed(1), d: +pr.d.toFixed(1) }))
}
