// pipeline/lib/transit/stations.js — stations from OSM, the lines that stop there, and platform / canopy /
// stair / sign geometry. Colours come from a V2 look (base = platform, spandrel = canopy, mullion = frames).
import earcut from 'earcut'
import { project } from '../../../shared/project.js'
import { operatorOf } from './lines.js'
import { projectOnPolyline } from './polyline.js'
import { box, quad, tri, hexToLinear, KIND, cross3, unit3 } from './meshkit.js'

export const PLATFORM = { cta: { length: 128, width: 3.7, aboveRail: 1.07 }, metra: { length: 240, width: 4.0, aboveRail: 0.25 } }
export const PLATFORM_EDGE_M = 1.55
export const MERGE_M = 150, STOP_MATCH_M = 250, STOP_NEAR_M = 60, SITE_M = 120, PLATFORM_MATCH_M = 90
export const CANOPY = { share: 0.6, height: 3.2, post: 7.5 }
export const STEP = { rise: 0.18, run: 0.28, width: 1.8 }
export const SIGN = { height: 2.3, board: [1.6, 0.45] }
const LOOK_ROLES = { platform: 'base', roof: 'spandrel', frame: 'mullion', glass: 'glass' }
const Y = [0, 1, 0]

const isRailStation = (t = {}) => t.railway === 'station' || ['subway', 'train', 'light_rail'].includes(t.station) ||
  (t.public_transport === 'station' && (t.train === 'yes' || t.subway === 'yes' || t.light_rail === 'yes'))
const isPlatform = (t = {}) => t.railway === 'platform' || (t.public_transport === 'platform' && (t.train === 'yes' || t.subway === 'yes'))
export const normName = (s) => String(s ?? '').toLowerCase().replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+station\s*$/, '').replace(/\s+/g, ' ').trim()
const mean = (pts) => [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length]
const centreOf = (el) => (el.type === 'node' ? project(el.lon, el.lat) : el.geometry?.length ? mean(el.geometry.map((p) => project(p.lon, p.lat))) : null)

export function stationFeatures(elements) {
  const out = []
  for (const el of elements) {
    const t = el.tags ?? {}
    if (!isRailStation(t) || !t.name) continue
    const pt = centreOf(el)
    if (!pt) continue
    const key = normName(t.name), osm = `${el.type[0]}${el.id}`
    const op = operatorOf(t) ?? (t.station === 'subway' ? 'cta' : t.train === 'yes' || t.station === 'train' ? 'metra' : null)
    const hit = out.find((s) => s.key === key && Math.hypot(s.pt[0] - pt[0], s.pt[1] - pt[1]) < MERGE_M && (!s.operator || !op || s.operator === op))
    if (hit) {
      hit.operator ??= op
      if (el.type === 'node' && !hit.fromNode) { hit.pt = pt; hit.fromNode = true }
      hit.osm.push(osm)
      continue
    }
    out.push({ id: `st-${osm}`, key, name: t.name, pt, operator: op, fromNode: el.type === 'node', osm: [osm] })
  }
  return out.map(({ fromNode, ...s }) => s)
}

function lineToOutline(pts, hw) {
  const L = [], R = []
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    const s = [-(b[1] - a[1]) / l, (b[0] - a[0]) / l]
    L.push([p[0] + s[0] * hw, p[1] + s[1] * hw]); R.push([p[0] - s[0] * hw, p[1] - s[1] * hw])
  })
  return [...L, ...R.reverse()]
}

export function platformWays(elements) {
  const out = []
  for (const el of elements) {
    if (el.type !== 'way' || !isPlatform(el.tags) || !(el.geometry?.length >= 2)) continue
    const pts = el.geometry.map((p) => project(p.lon, p.lat))
    const closed = pts.length >= 4 && Math.hypot(pts[0][0] - pts.at(-1)[0], pts[0][1] - pts.at(-1)[1]) < 0.01
    const outline = closed ? pts.slice(0, -1) : lineToOutline(pts, PLATFORM.cta.width / 2)
    out.push({ outline, centre: mean(outline) })
  }
  return out
}

export function linkStops(stations, routes, order) {
  const lines = new Map(stations.map((s) => [s, new Set()]))
  for (const r of routes) for (const stop of r.stops) {
    const key = normName(stop.name)
    let best = null, bd = Infinity
    for (const s of stations) {
      const d = Math.hypot(s.pt[0] - stop.pt[0], s.pt[1] - stop.pt[1]), lim = key && s.key === key ? STOP_MATCH_M : STOP_NEAR_M
      if (d < lim && d < bd) { best = s; bd = d }
    }
    stop.station = best?.id ?? null
    if (best) lines.get(best).add(r.line)
  }
  for (const s of stations) s.lines = [...lines.get(s)].sort((a, b) => order.indexOf(a) - order.indexOf(b))
}

export function stationSite(st, pieces) {
  let best = null
  for (const pc of pieces) {
    const pr = projectOnPolyline(pc.pts2, st.pt)
    if (pr.d > SITE_M) continue
    const score = pr.d - ((st.lines ?? []).some((l) => pc.lines.includes(l)) ? 1000 : 0)
    if (!best || score < best.score) best = { score, pc, pr }
  }
  if (!best) return null
  const { pc, pr } = best, a = pc.pts3[pr.i], b = pc.pts3[pr.i + 1]
  const tl = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1, t = [(b[0] - a[0]) / tl, (b[2] - a[2]) / tl], side = [-t[1], t[0]]
  let partner = null
  for (const q of pieces) {
    if (q === pc) continue
    const qr = projectOnPolyline(q.pts2, pr.pt)
    if (qr.d < 2.5 || qr.d > 6.5) continue
    const off = (qr.pt[0] - pr.pt[0]) * side[0] + (qr.pt[1] - pr.pt[1]) * side[1]
    if (partner === null || Math.abs(off) < Math.abs(partner)) partner = off
  }
  return { p: pr.pt, y: +(a[1] + (b[1] - a[1]) * pr.t).toFixed(2), t, side, grade: pc.grades[Math.min(pr.i, pc.grades.length - 1)], operator: pc.operator, partner }
}

export function platformsFor(st, site, platforms) {
  const osm = platforms.filter((p) => Math.hypot(p.centre[0] - st.pt[0], p.centre[1] - st.pt[1]) < PLATFORM_MATCH_M &&
    projectOnPolyline([[site.p[0] - site.t[0] * 300, site.p[1] - site.t[1] * 300], [site.p[0] + site.t[0] * 300, site.p[1] + site.t[1] * 300]], p.centre).d < 12)
  if (osm.length) return osm.map(({ outline }) => ({ outline }))
  const P = PLATFORM[site.operator] ?? PLATFORM.cta, edge = PLATFORM_EDGE_M + P.width / 2
  const synth = (off) => {
    const c = [site.p[0] + site.side[0] * off, site.p[1] + site.side[1] * off], hl = P.length / 2, hw = P.width / 2
    return { outline: [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]].map(([u, v]) => [c[0] + site.t[0] * u + site.side[0] * v, c[1] + site.t[1] * u + site.side[1] * v]) }
  }
  if (site.partner === null) return [synth(edge)] // single track: one platform on the right
  const s = Math.sign(site.partner)
  return [synth(-s * edge), synth(site.partner + s * edge)] // side platforms outside both tracks
}

function obb(outline) {
  let a = [1, 0], best = -1
  outline.forEach((p, i) => {
    const q = outline[(i + 1) % outline.length], l = Math.hypot(q[0] - p[0], q[1] - p[1])
    if (l > best) { best = l; a = [(q[0] - p[0]) / l, (q[1] - p[1]) / l] }
  })
  const b = [-a[1], a[0]], us = outline.map((p) => p[0] * a[0] + p[1] * a[1]), vs = outline.map((p) => p[0] * b[0] + p[1] * b[1])
  const cu = (Math.min(...us) + Math.max(...us)) / 2, cv = (Math.min(...vs) + Math.max(...vs)) / 2
  return { a, b, c: [a[0] * cu + b[0] * cv, a[1] * cu + b[1] * cv], hl: (Math.max(...us) - Math.min(...us)) / 2, hw: (Math.max(...vs) - Math.min(...vs)) / 2 }
}

function slab(m, outline, yTop, thick, col, kind) {
  const flat = outline.flat(), idx = earcut(flat)
  for (let i = 0; i < idx.length; i += 3) tri(m, ...[idx[i], idx[i + 1], idx[i + 2]].map((k) => [flat[k * 2], yTop, flat[k * 2 + 1]]), Y, col, kind)
  const c = mean(outline)
  outline.forEach((p, i) => {
    const q = outline[(i + 1) % outline.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1
    let n = [(q[1] - p[1]) / l, 0, -(q[0] - p[0]) / l]
    if (n[0] * ((p[0] + q[0]) / 2 - c[0]) + n[2] * ((p[1] + q[1]) / 2 - c[1]) < 0) n = [-n[0], 0, -n[2]]
    quad(m, [p[0], yTop - thick, p[1]], [q[0], yTop - thick, q[1]], [q[0], yTop, q[1]], [p[0], yTop, p[1]], n, col, kind)
  })
}

function stairs(m, at, o, yTop, col) {
  const n = Math.ceil(yTop / STEP.rise), rise = yTop / n, out = [o.a[0], 0, o.a[1]]
  for (let i = 0; i < n; i++) { // descending outward beyond the platform end
    const u = o.hl + i * STEP.run, y = yTop - (i + 1) * rise, w = STEP.width / 2
    quad(m, at(u, -w, y), at(u + STEP.run, -w, y), at(u + STEP.run, w, y), at(u, w, y), Y, col.platform, KIND.concrete)
    quad(m, at(u, -w, y), at(u, w, y), at(u, w, y + rise), at(u, -w, y + rise), out, col.platform, KIND.concrete)
  }
  const s0 = at(o.hl, 0, yTop), s1 = at(o.hl + n * STEP.run, 0, 0)
  const d = [s1[0] - s0[0], s1[1] - s0[1], s1[2] - s0[2]], len = Math.hypot(...d), dx = unit3(d), bz = [o.b[0], 0, o.b[1]]
  let ay = cross3(bz, dx)
  if (ay[1] < 0) ay = ay.map((v) => -v)
  for (const v of [-1, 1]) { // stringers: their lower edge runs along the stair line, so they never dip below the street
    const off = v * (STEP.width / 2 + 0.08)
    const c = [0, 1, 2].map((k) => s0[k] + d[k] / 2 + bz[k] * off + ay[k] * 0.2)
    box(m, c, dx, ay, bz, [len / 2, 0.2, 0.06], col.frame, KIND.steel)
  }
}

export function stationMesh(m, st, site, platforms, { look, lineColours }) {
  const col = Object.fromEntries(Object.entries(LOOK_ROLES).map(([role, key]) => [role, hexToLinear(look[key])]))
  const bands = st.lines?.length ? st.lines.map((l) => lineColours[l]) : [hexToLinear('#565a5c')]
  if (!site || site.y < -1 || !platforms.length) { // subway (or no track): a street entrance with a line-colour pylon
    const [x, z] = st.pt, X = [1, 0, 0], Z = [0, 0, 1]
    for (const [cx, cz, hx, hz] of [[x, z - 3, 1.1, 0.06], [x - 1.05, z, 0.06, 3], [x + 1.05, z, 0.06, 3]]) box(m, [cx, 0.55, cz], X, Y, Z, [hx, 0.55, hz], col.frame, KIND.steel)
    box(m, [x + 1.9, 1.4, z - 3], X, Y, Z, [0.2, 1.4, 0.2], col.frame, KIND.steel)
    bands.forEach((c, i) => box(m, [x + 1.9, 3.4 - (i + 0.5) * (0.6 / bands.length), z - 3], X, Y, Z, [0.22, 0.3 / bands.length, 0.22], c, KIND.sign))
    return
  }
  const P = PLATFORM[site.operator] ?? PLATFORM.cta, yTop = site.y + P.aboveRail
  for (const { outline } of platforms) {
    slab(m, outline, yTop, 0.3, col.platform, KIND.concrete)
    const o = obb(outline), ax = [o.a[0], 0, o.a[1]], bz = [o.b[0], 0, o.b[1]]
    const at = (u, v, y) => [o.c[0] + o.a[0] * u + o.b[0] * v, y, o.c[1] + o.a[1] * u + o.b[1] * v]
    const cl = o.hl * CANOPY.share
    box(m, at(0, 0, yTop + CANOPY.height + 0.09), ax, Y, bz, [cl, 0.09, o.hw + 0.2], col.roof, KIND.roof)
    for (let u = -cl + 1; u <= cl - 1 + 1e-6; u += CANOPY.post) box(m, at(u, 0, yTop + CANOPY.height / 2), ax, Y, bz, [0.1, CANOPY.height / 2, 0.1], col.frame, KIND.steel, ['front', 'back', 'left', 'right'])
    for (const u of [-o.hl + 4, 0, o.hl - 4]) { // line-colour signs facing the track at both ends and the middle
      box(m, at(u, 0, yTop + SIGN.height / 2), ax, Y, bz, [0.05, SIGN.height / 2, 0.05], col.frame, KIND.steel, ['front', 'back', 'left', 'right'])
      box(m, at(u, 0, yTop + SIGN.height + 0.3), ax, Y, bz, [SIGN.board[0] / 2, SIGN.board[1] / 2, 0.03], col.frame, KIND.dark)
      const h = SIGN.board[1] / bands.length
      bands.forEach((c, i) => box(m, at(u, 0, yTop + SIGN.height + 0.3 + SIGN.board[1] / 2 - (i + 0.5) * h), ax, Y, bz, [SIGN.board[0] / 2 - 0.04, h / 2, 0.045], c, KIND.sign, ['left', 'right']))
    }
    if (site.y >= 3) stairs(m, at, o, yTop, col)
  }
}
