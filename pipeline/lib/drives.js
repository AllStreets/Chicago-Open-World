// pipeline/lib/drives.js — D3-3: drives under the street for Ride mode. A drive is routed over the traffic graph
// (traffic.bin, decoded and laned exactly as the app's traffic is: app/src/traffic/graph.js), through named waypoints,
// in the right-hand lane — so the ride's bus keeps clear of the deck's walls and columns like every other vehicle —
// and carries the roadway's height per point: down the ramp from the street, along the deck, up the exit.
import { decodeRoadGraph, buildNetwork, pointOnLink } from '../../app/src/traffic/graph.js'

// the curated drives (plan §4.5 D3-3: Columbus → Lower Wacker → the Lake St exit). Waypoints are [x, z, y] (y: 0 on the
// street, about −5.2 on Lower Wacker), each with the name the ride announces as you reach it.
export const DRIVES = [
  {
    id: 'lower-wacker', name: 'Lower Wacker · Columbus → Lake St', from: 'Randolph St & Columbus Dr', to: 'Lake St & Wacker Dr',
    blurb: 'Down the Randolph ramp, along Lower Columbus and under the river front on Lower Wacker, up the Lake St exit',
    waypoints: [
      { name: 'Randolph St & Columbus Dr', at: [470, -262, 0] },
      { name: 'Lower Columbus Dr', at: [598, -420, -5.2] },
      { name: 'Lower Wacker Dr at Columbus', at: [598, -640, -5.2] },
      { name: 'Lower Wacker Dr at Michigan Ave', at: [330, -694, -5.2] },
      { name: 'Lower Wacker Dr at State St', at: [0, -545, -5.2] },
      { name: 'Lower Wacker Dr at Franklin St', at: [-600, -545, -5.2] },
      { name: 'Lake St & Wacker Dr', at: [-752, -385, 0] },
    ],
    sources: ['https://en.wikipedia.org/wiki/Wacker_Drive', 'https://www.openstreetmap.org/way/24954034'],
  },
]

const SAMPLE_M = 4

// the link (and arc length on it) nearest a waypoint at its level
function snap(net, [x, z, y]) {
  let best = null
  for (const l of net.links) {
    if (l.bbox[0] > x + 40 || l.bbox[2] < x - 40 || l.bbox[1] > z + 40 || l.bbox[3] < z - 40) continue
    for (let s = 0; s <= l.len; s += 1) {
      const p = pointOnLink(l, Math.min(s, l.len), 0)
      if (Math.abs(p.y - y) > 1.5) continue
      const d = Math.hypot(p.x - x, p.z - z)
      if (!best || d < best.d) best = { link: l, s: Math.min(s, l.len), d }
    }
  }
  return best
}

// shortest chain of links from (a, sa) to (b, sb), following the turns a vehicle may take
function route(net, a, b) {
  if (a.link === b.link && b.s >= a.s) return [a.link]
  const dist = new Map([[a.link.id, a.link.len - a.s]]), prev = new Map(), done = new Set()
  const heap = [[a.link.len - a.s, a.link.id]]
  while (heap.length) {
    heap.sort((p, q) => q[0] - p[0] || q[1] - p[1])
    const [d, id] = heap.pop()
    if (done.has(id)) continue
    done.add(id)
    if (id === b.link.id && id !== a.link.id) break
    for (const n of net.links[id].next) {
      const nd = d + n.len
      if (nd < (dist.get(n.id) ?? Infinity)) { dist.set(n.id, nd); prev.set(n.id, id); heap.push([nd, n.id]) }
    }
  }
  if (!prev.has(b.link.id)) return null
  const chain = [b.link.id]
  while (chain[0] !== a.link.id) chain.unshift(prev.get(chain[0]))
  return chain.map((id) => net.links[id])
}

// traffic.bin (Int16Array) + a drive → { path: [[x, z, y]…] (y: the roadway, absolute), stops: [{ name, s }] } or null
export function driveRide(bin, drive, { roadY = 0.12 } = {}) {
  const net = buildNetwork(decodeRoadGraph(bin))
  const snaps = drive.waypoints.map((w) => snap(net, w.at))
  if (snaps.some((s) => !s || s.d > 25)) return null
  const pts = [], stops = []
  let len = 0
  const add = (p) => {
    const q = [Math.round(p.x * 10) / 10 + 0, Math.round(p.z * 10) / 10 + 0, Math.round((p.y + roadY) * 100) / 100 + 0]
    const last = pts.at(-1)
    if (last) { const d = Math.hypot(q[0] - last[0], q[1] - last[1]); if (d < 0.5) return; len += d }
    pts.push(q)
  }
  // the right-hand lane of each link (the one a vehicle keeps to for a right-hand exit)
  const lane = (l) => l.offsets.reduce((m, o) => Math.max(m, o), -Infinity)
  const walk = (l, s0, s1) => { for (let s = s0; s < s1; s += SAMPLE_M) add(pointOnLink(l, s, lane(l))); add(pointOnLink(l, s1, lane(l))) }
  stops.push({ name: drive.waypoints[0].name, s: 0 })
  for (let i = 1; i < snaps.length; i++) {
    const chain = route(net, snaps[i - 1], snaps[i])
    if (!chain) return null
    chain.forEach((l, k) => walk(l, k === 0 ? snaps[i - 1].s : 0, k === chain.length - 1 ? snaps[i].s : l.len))
    stops.push({ name: drive.waypoints[i].name, s: Math.round(len) })
  }
  return { path: simplify3(pts, 0.1), stops }
}

// Douglas–Peucker in 3D (heights weighted ×4, so a ramp's knee always stays a point), ends kept
export function simplify3(pts, tol) {
  if (pts.length <= 2) return pts
  const W = 4, a = pts[0], b = pts.at(-1)
  const d = [b[0] - a[0], b[1] - a[1], (b[2] - a[2]) * W], L2 = d[0] ** 2 + d[1] ** 2 + d[2] ** 2 || 1
  let worst = 0, at = -1
  for (let i = 1; i < pts.length - 1; i++) {
    const v = [pts[i][0] - a[0], pts[i][1] - a[1], (pts[i][2] - a[2]) * W], u = Math.max(0, Math.min(1, (v[0] * d[0] + v[1] * d[1] + v[2] * d[2]) / L2))
    const e = Math.hypot(v[0] - u * d[0], v[1] - u * d[1], v[2] - u * d[2])
    if (e > worst) { worst = e; at = i }
  }
  if (worst <= tol) return [a, b]
  return [...simplify3(pts.slice(0, at + 1), tol).slice(0, -1), ...simplify3(pts.slice(at), tol)]
}
