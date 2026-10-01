// app/src/ride/rideCatalog.js — every ride in the city (P7): one per CTA L service (V4's own track, stops and speed
// profile), the CTA bus routes and the walks from rides.json, and the glide. A ride definition is what rideRun drives.
import { makePath } from '../transit/path.js'
import { buildProfile } from '../transit/profile.js'

export const RIDE_KINDS = [
  ['L', 'L trains', 'Ride the L — the front window, alongside or behind; every stop announced'],
  ['bus', 'Buses', 'Ride a CTA bus up the big avenues'],
  ['walk', 'Walks', 'Walk at street level — the Riverwalk, the Mag Mile, the lakefront, Fulton Market, Lincoln Park'],
  ['glide', 'Glide', 'Hang-glide over the city'],
]
export const GLIDE_RIDE = { id: 'glide', kind: 'glide', name: 'Glide over the city', blurb: 'A hang-glider launched from where you are: ↑ dive, ↓ climb, ← → turn, Shift boost' }

export const BUS_PROFILE = { vmax: 40 / 3.6, accel: 1.0, brake: 1.3, dwellS: 12 }
export const BUS_Y = 0.12, WALK_Y = 0.1
export const VIEWS = { L: ['cab', 'side', 'chase'], bus: ['cab', 'side', 'chase'], walk: ['eye'], glide: ['chase'] }
export const VIEW_NAMES = { cab: 'Front window', side: 'Alongside', chase: 'Behind', eye: 'Street view' }

// One ride per CTA service; the same track twice (Green Line branches drawn twice) is listed once.
export function lRides(sim, transit) {
  if (!sim || !transit) return []
  const lines = new Map(transit.lines.map((l) => [l.id, l])), dims = transit.rollingStock ?? {}, seen = new Set(), out = []
  for (const sv of sim.services) {
    const line = lines.get(sv.line)
    if (line?.operator !== 'cta' || sv.stops.length < 2) continue
    const first = sv.stops[0].name, last = sv.stops.at(-1).name
    const key = `${sv.line}|${first}|${last}|${Math.round(sv.path.length / 50)}`
    if (seen.has(key)) continue
    seen.add(key)
    const name = first === last ? `${line.name}: ${first} → the Loop → ${last}` : `${line.name}: ${first} → ${last}`
    const car = dims[sv.spec.stock]?.length ?? 14.6
    out.push({ id: `l:${sv.id}`, kind: 'L', name, line: sv.line, colour: line.colour, service: sv.id, path: sv.path, stops: sv.stops, profile: sv.profile, spec: sv.spec, inbound: sv.inbound, trainLength: car * (sv.spec.cars?.offpeak ?? 6) })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

const toPath = (pts, y) => makePath(pts.map(([x, z]) => [x, y, z]))
// arc length of the nearest point of a polyline to (x, z)
export function projectS(path, x, z) {
  let best = Infinity, bestS = 0
  for (let i = 1; i < path.pts.length; i++) {
    const [ax, , az] = path.pts[i - 1], [bx, , bz] = path.pts[i], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz
    const f = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0
    const d = (ax + dx * f - x) ** 2 + (az + dz * f - z) ** 2
    if (d < best) { best = d; bestS = path.cum[i - 1] + Math.sqrt(l2) * f }
  }
  return { s: bestS, d: Math.sqrt(best) }
}

export function busRides(json) {
  return (json?.buses ?? []).filter((b) => b.path?.length >= 2).map((b) => {
    const path = toPath(b.path, BUS_Y)
    const stops = (b.stops ?? []).map((st) => ({ name: st.name, s: st.s })).sort((a, c) => a.s - c.s)
    if (!stops.length || stops[0].s > 1) stops.unshift({ name: b.from ?? 'Start', s: 0 })
    if (stops.at(-1).s < path.length - 1) stops.push({ name: b.to ?? 'End', s: path.length })
    return { id: `bus:${b.id}`, kind: 'bus', name: `#${b.ref} ${b.name}`, ref: b.ref, colour: '#4a90d9', path, stops, profile: buildProfile(path, stops.map((x) => x.s), BUS_PROFILE), trainLength: 12.2, sources: b.sources }
  })
}

// Walks: their sights are the stops (named as you reach them); the path starts and ends at the walk's own ends.
export function walkRides(json) {
  return (json?.walks ?? []).filter((w) => w.path?.length >= 2).map((w) => {
    const path = toPath(w.path, WALK_Y)
    const sights = (w.sights ?? []).map((st) => ({ name: st.name, ...projectS(path, st.x, st.z) })).filter((st) => st.d < 120).map(({ name, s }) => ({ name, s })).sort((a, b) => a.s - b.s)
    const stops = [{ name: w.from ?? 'Start', s: 0 }, ...sights.filter((x) => x.s > 5 && x.s < path.length - 5), { name: w.to ?? 'End', s: path.length }]
    return { id: `walk:${w.id}`, kind: 'walk', name: w.name, blurb: w.blurb, path, stops, paceMps: 1.4, sources: w.sources }
  })
}

let ridesJson = null, ridesUrl = null
export async function loadRidesJson(url = '/world/rides.json', fetchImpl = fetch) {
  if (ridesJson && ridesUrl === url) return ridesJson
  try { const r = await fetchImpl(url); ridesJson = r.ok ? await r.json() : { buses: [], walks: [] } } catch { ridesJson = { buses: [], walks: [] } }
  ridesUrl = url
  return ridesJson
}
export const ridesJsonNow = () => ridesJson

const memo = { sim: null, json: null, list: [] }
export function allRides(sim, transit, json = ridesJson) {
  if (memo.sim === sim && memo.json === json && memo.list.length) return memo.list
  memo.sim = sim; memo.json = json
  memo.list = [...lRides(sim, transit), ...busRides(json), ...walkRides(json), GLIDE_RIDE]
  return memo.list
}
