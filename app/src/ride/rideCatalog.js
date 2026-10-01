// app/src/ride/rideCatalog.js — every ride in the city (P7): one per CTA L service (V4's own track, stops and speed
// profile), the CTA bus routes and the walks from rides.json, and the glide. A ride definition is what rideRun drives.
import { makePath } from '../transit/path.js'
import { buildProfile } from '../transit/profile.js'
import RIDES from '../data/rides.json'

export const RIDE_KINDS = [
  ['L', 'L trains', 'Ride the L — the front window, alongside or behind; every stop announced'],
  ['bus', 'Buses', 'Ride a CTA bus up the big avenues'],
  ['walk', 'Walks', 'Walk at street level — the Riverwalk, the Mag Mile, the lakefront, Fulton Market, Lincoln Park'],
  ['drive', 'Drives', 'Drive the streets under the streets — Lower Wacker, from the front of a bus'],
  ['glide', 'Glide', 'Hang-glide over the city — {↑} dive · {↓} climb · {←} {→} turn · {Shift} boost'],
]
// keys in braces are drawn as keycaps (hud/Keycap.jsx withKeys); keysPlain() gives the words for a tooltip
export const GLIDE_RIDE = { id: 'glide', kind: 'glide', name: 'Glide over the city', blurb: 'A hang-glider launched from where you are: {↑} dive, {↓} climb, {←} {→} turn, {Shift} boost' }

export const BUS_PROFILE = { vmax: 40 / 3.6, accel: 1.0, brake: 1.3, dwellS: 12 }
export const BUS_Y = 0.12, WALK_Y = 0.1
export const VIEWS = { L: ['cab', 'side', 'chase'], bus: ['cab', 'side', 'chase'], walk: ['eye'], glide: ['chase'], drive: ['cab'] }
export const DRIVE_MPS = 11 // ≈ 40 km/h: Lower Wacker's 30 mph limit, eased for the view
export const VIEW_NAMES = { cab: 'Front window', side: 'Alongside', chase: 'Behind', eye: 'Street view' }

// --- L ride names (F-4, 2026-10-01): what the train really does, and never two rows that read the same --------------
// The elevated Loop's stations: a service that calls at five or more of them goes around the Loop (Brown, Orange, Pink,
// Purple); Red and Blue run through downtown in subways and Green along Lake and Wabash, so they say where they're signed.
const LOOP_ELEVATED = new Set(['Clark/Lake', 'State/Lake', 'Washington/Wabash', 'Adams/Wabash', 'Harold Washington Library-State/Van Buren', 'LaSalle/Van Buren', 'Quincy', 'Washington/Wells'])
// CTA names a station that exists on two branches by its branch — "Western (O'Hare branch)", "Western (Forest Park
// branch)"; a branch is known by the stations beside it (transitchicago.com station pages)
export const BRANCHES = {
  blue: [
    ["O'Hare branch", ['Damen', 'Division', 'California', 'Logan Square', 'Belmont', 'Addison', 'Irving Park', 'Montrose', 'Jefferson Park', 'Cumberland', 'Rosemont', "O'Hare"]],
    ['Forest Park branch', ['Illinois Medical District', 'Racine', 'UIC-Halsted', 'Kedzie-Homan', 'Pulaski', 'Cicero', 'Austin', 'Oak Park', 'Forest Park']],
  ],
}
function branchOf(lineId, stops, i) {
  for (const j of [i - 1, i + 1, i - 2, i + 2]) {
    const hit = (BRANCHES[lineId] ?? []).find(([, names]) => names.includes(stops[j]?.name))
    if (hit) return hit[0]
  }
  return null
}
// "Western" twice on one service at two different stations: name both by their branch
function stopLabel(lineId, stops, i) {
  const st = stops[i], twin = stops.some((x, j) => j !== i && x.name === st.name && x.station !== st.station)
  const branch = twin ? branchOf(lineId, stops, i) : null
  return branch ? `${st.name} (${branch})` : st.name
}
export function lRideName(line, stops, towards) {
  const a = stopLabel(line.id, stops, 0), b = stopLabel(line.id, stops, stops.length - 1)
  const loop = new Set(stops.map((s) => s.name).filter((n) => LOOP_ELEVATED.has(n))).size >= 5
  if (loop) return `${line.name} · ${a} → around the Loop → ${b}`
  return `${line.name}${towards.length ? ` to ${towards.join(' or ')}` : ''} · ${a} → ${b}`
}

// One ride per CTA service; the same track twice (the Green Line's two southern branches share it here) is listed once,
// signed to both of its destinations.
export function lRides(sim, transit) {
  if (!sim || !transit) return []
  const lines = new Map(transit.lines.map((l) => [l.id, l])), dims = transit.rollingStock ?? {}, seen = new Map(), out = []
  for (const sv of sim.services) {
    const line = lines.get(sv.line)
    if (line?.operator !== 'cta' || sv.stops.length < 2) continue
    const first = sv.stops[0].name, last = sv.stops.at(-1).name
    const key = `${sv.line}|${first}|${last}|${Math.round(sv.path.length / 50)}`
    if (seen.has(key)) { const r = seen.get(key); if (sv.to && !r.towards.includes(sv.to)) r.towards.push(sv.to); continue }
    const car = dims[sv.spec.stock]?.length ?? 14.6
    const r = { id: `l:${sv.id}`, kind: 'L', name: '', line: sv.line, colour: line.colour, service: sv.id, path: sv.path, stops: sv.stops, profile: sv.profile, spec: sv.spec, inbound: sv.inbound, trainLength: car * (sv.spec.cars?.offpeak ?? 6), towards: sv.to ? [sv.to] : [] }
    seen.set(key, r); out.push(r)
  }
  for (const r of out) r.name = lRideName(lines.get(r.line), r.stops, r.towards)
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

// a point is [x, z], or [x, z, y] where the walk leaves the street (D1-7: the Riverwalk at river level)
export const toPath = (pts, y) => makePath(pts.map((p) => [p[0], p.length > 2 && Number.isFinite(p[2]) ? p[2] : y, p[1]]))
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

// D3-3: drives under the street (pipeline/build/build-drives.js): routed over the traffic graph in the right-hand lane,
// with the roadway's height per point — down the ramp from the street, along Lower Wacker, up the Lake St exit
export function driveRides(json) {
  return (json?.drives ?? []).filter((d) => d.path?.length >= 2).map((d) => {
    const path = toPath(d.path, BUS_Y)
    const stops = (d.stops ?? []).map((st) => ({ name: st.name, s: Math.min(st.s, path.length) })).sort((a, b) => a.s - b.s)
    if (!stops.length || stops[0].s > 1) stops.unshift({ name: d.from ?? 'Start', s: 0 })
    if (stops.at(-1).s < path.length - 1) stops.push({ name: d.to ?? 'End', s: path.length })
    stops.at(-1).s = path.length
    return { id: `drive:${d.id}`, kind: 'drive', name: d.name, blurb: d.blurb, path, stops, paceMps: DRIVE_MPS, trainLength: 12.2, sources: d.sources }
  })
}

// the buses and walks ship with the app (27 KB, pipeline/build/build-rides.js): public/world stays within its budget
let ridesJson = RIDES
export const loadRidesJson = async () => ridesJson
export const ridesJsonNow = () => ridesJson
export const setRidesJson = (j) => { ridesJson = j } // tests

const memo = { sim: null, json: null, list: [] }
export function allRides(sim, transit, json = ridesJson) {
  if (memo.sim === sim && memo.json === json && memo.list.length) return memo.list
  memo.sim = sim; memo.json = json
  memo.list = [...lRides(sim, transit), ...busRides(json), ...walkRides(json), ...driveRides(json), GLIDE_RIDE]
  return memo.list
}
