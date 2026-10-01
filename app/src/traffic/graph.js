// app/src/traffic/graph.js — the road graph from traffic.bin (pipeline lib/traffic.js): directed lane-links between
// junctions, which junctions have traffic lights, and where each approach's stop line is. Pure.
export const CLASSES = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'local', 'link']
// total ribbon width per class (pipeline ground.js ROAD_WIDTHS; local = residential/unclassified)
export const ROAD_WIDTH = [22, 18, 16, 14, 12, 9, 8]
export const SPEED = [27, 20, 14, 13, 12, 9, 13] // m/s: ~60 mph expressways, 30 mph arterials, 20 mph side streets
export const LANE_M = 3.3
const SIGNAL_CLUSTER_M = 28

export function decodeRoadGraph(buf) {
  const a = buf instanceof Int16Array ? buf : new Int16Array(buf)
  let i = 0
  const version = a[i++]
  if (version !== 1) throw new Error(`traffic.bin: version ${version}`)
  const nN = a[i++] & 0xffff, nodes = new Float32Array(nN * 2)
  for (let k = 0; k < nN * 2; k++) nodes[k] = a[i++]
  const nE = a[i++] & 0xffff, edges = []
  for (let e = 0; e < nE; e++) {
    const from = a[i++], to = a[i++], cls = a[i++], fwd = a[i++], back = a[i++], k = a[i++]
    const pts = [[nodes[from * 2], nodes[from * 2 + 1]]]
    for (let j = 0; j < k; j++) { pts.push([a[i], a[i + 1]]); i += 2 }
    pts.push([nodes[to * 2], nodes[to * 2 + 1]])
    edges.push({ from, to, cls, fwd, back, pts })
  }
  return { nodes, edges }
}

function polyline(pts) {
  const n = pts.length, xs = new Float32Array(n), zs = new Float32Array(n), cum = new Float32Array(n)
  for (let k = 0; k < n; k++) { xs[k] = pts[k][0]; zs[k] = pts[k][1]; if (k) cum[k] = cum[k - 1] + Math.hypot(xs[k] - xs[k - 1], zs[k] - zs[k - 1]) }
  return { xs, zs, cum, len: cum[n - 1] }
}
const heading = (dx, dz) => Math.atan2(dz, dx)
const angDiff = (a, b) => { let d = Math.abs(a - b) % (2 * Math.PI); return d > Math.PI ? 2 * Math.PI - d : d }

// one directed link per carriageway direction: lanes to the right of the centreline on a two-way road, centred on a
// one-way; `stopAt` holds cars back from the junction box
export function buildNetwork({ nodes, edges }) {
  const links = [], outOf = new Map(), into = new Map()
  const push = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v) }
  edges.forEach((e, ei) => {
    for (const dir of [1, -1]) {
      const lanes = dir > 0 ? e.fwd : e.back
      if (!lanes) continue
      const pts = dir > 0 ? e.pts : [...e.pts].reverse(), P = polyline(pts)
      if (P.len < 1) continue
      const half = ROAD_WIDTH[e.cls] / 2, twoWay = e.fwd > 0 && e.back > 0
      const laneW = Math.min(LANE_M, ((twoWay ? half : 2 * half) - 0.6) / lanes)
      const offsets = Array.from({ length: lanes }, (_, i) => (twoWay ? 0.4 + (i + 0.5) * laneW : (i - (lanes - 1) / 2) * laneW))
      const n = P.xs.length
      const link = {
        id: links.length, edge: ei, from: dir > 0 ? e.from : e.to, to: dir > 0 ? e.to : e.from, cls: e.cls, lanes, offsets, half, ...P,
        headIn: heading(P.xs[1] - P.xs[0], P.zs[1] - P.zs[0]), headOut: heading(P.xs[n - 1] - P.xs[n - 2], P.zs[n - 1] - P.zs[n - 2]),
        speed: SPEED[e.cls], stopAt: P.len, signal: -1, phase: 0, next: [],
        bbox: [Math.min(...P.xs), Math.min(...P.zs), Math.max(...P.xs), Math.max(...P.zs)],
      }
      links.push(link); push(outOf, link.from, link); push(into, link.to, link)
    }
  })
  // turns: every link leaving the node this one enters, except straight back along the same street (unless it's a dead end)
  for (const l of links) {
    const out = (outOf.get(l.to) ?? []).filter((o) => o.edge !== l.edge)
    l.next = out.length ? out : (outOf.get(l.to) ?? [])
    l.turn = l.next.map((o) => angDiff(l.headOut, o.headIn))
  }
  // stop lines: back from the node by the widest crossing street's half-width
  for (const l of links) {
    const cross = (into.get(l.to) ?? []).concat(outOf.get(l.to) ?? []).filter((o) => o.edge !== l.edge)
    if (!cross.length) continue
    const w = Math.max(...cross.map((o) => o.half))
    l.stopAt = Math.max(l.len * 0.5, l.len - w - 1.5)
  }
  return { links, outOf, into, signals: placeSignals(nodes, edges, links, into) }
}

// traffic lights: junctions of three or more streets where at least two are arterials (trunk … tertiary, ramps), never
// on the expressways themselves. Junction nodes within 28 m (a divided road's two carriageways) share one controller.
// Each approach is phase 0 (along the controller's main axis) or phase 1 (across it).
export function placeSignals(nodes, edges, links, into) {
  const deg = new Map(), art = new Map(), fast = new Set()
  edges.forEach((e) => {
    for (const n of [e.from, e.to]) {
      deg.set(n, (deg.get(n) ?? 0) + 1)
      if (e.cls >= 1 && e.cls <= 4 || e.cls === 6) art.set(n, (art.get(n) ?? 0) + 1)
      if (e.cls === 0) fast.add(n)
    }
  })
  const lit = [...deg.keys()].filter((n) => deg.get(n) >= 3 && (art.get(n) ?? 0) >= 2 && !fast.has(n))
  // cluster
  const cell = new Map(), key = (x, z) => `${Math.floor(x / SIGNAL_CLUSTER_M)},${Math.floor(z / SIGNAL_CLUSTER_M)}`
  const ctrlOf = new Map(), ctrls = []
  for (const n of lit) {
    const x = nodes[n * 2], z = nodes[n * 2 + 1]
    let found = null
    const [ci, cj] = key(x, z).split(',').map(Number)
    for (let i = ci - 1; i <= ci + 1 && found == null; i++) for (let j = cj - 1; j <= cj + 1 && found == null; j++)
      for (const m of cell.get(`${i},${j}`) ?? []) if (Math.hypot(nodes[m * 2] - x, nodes[m * 2 + 1] - z) < SIGNAL_CLUSTER_M) { found = ctrlOf.get(m); break }
    if (found == null) { found = ctrls.length; ctrls.push({ id: found, nodes: [], x, z, axis: null, offset: 0 }) }
    ctrlOf.set(n, found); ctrls[found].nodes.push(n)
    const k = key(x, z); if (!cell.has(k)) cell.set(k, []); cell.get(k).push(n)
  }
  for (const c of ctrls) {
    const approaches = c.nodes.flatMap((n) => into.get(n) ?? [])
    // the main axis: the highest-class approach (lowest class number), its heading folded to [0, π)
    const main = approaches.reduce((b, l) => (!b || l.cls < b.cls || (l.cls === b.cls && l.lanes > b.lanes) ? l : b), null)
    c.axis = main ? ((main.headOut % Math.PI) + Math.PI) % Math.PI : 0
    c.offset = ((c.x * 7.13 + c.z * 3.71) % 58 + 58) % 58
    for (const l of approaches) {
      // an approach inside the cluster (between a divided road's carriageways) isn't held at a line
      if (ctrlOf.get(l.from) === c.id) continue
      l.signal = c.id
      const h = ((l.headOut % Math.PI) + Math.PI) % Math.PI, d = Math.min(Math.abs(h - c.axis), Math.PI - Math.abs(h - c.axis))
      l.phase = d < Math.PI / 4 ? 0 : 1
    }
  }
  return ctrls
}

// the 58 s cycle: green 24, amber 3, all-red 2 per phase
export const CYCLE = { green: 24, amber: 3, red: 2 }
const PERIOD = 2 * (CYCLE.green + CYCLE.amber + CYCLE.red)
export function signalState(ctrl, phase, t) {
  const c = (((t + ctrl.offset) % PERIOD) + PERIOD) % PERIOD, half = PERIOD / 2
  const local = phase === 0 ? c : (c + half) % PERIOD
  return local < CYCLE.green ? 'green' : local < CYCLE.green + CYCLE.amber ? 'amber' : 'red'
}

// point and heading `s` metres along a link, `off` metres to the right of its centreline; `hint` is a segment index to
// start the search from (cars only move forward)
export function pointOnLink(l, s, off, hint = 0) {
  const n = l.xs.length
  let k = Math.min(Math.max(hint, 0), n - 2)
  while (k < n - 2 && l.cum[k + 1] < s) k++
  while (k > 0 && l.cum[k] > s) k--
  const L = l.cum[k + 1] - l.cum[k] || 1, f = Math.max(0, Math.min(1, (s - l.cum[k]) / L))
  const dx = (l.xs[k + 1] - l.xs[k]) / L, dz = (l.zs[k + 1] - l.zs[k]) / L
  return { x: l.xs[k] + (l.xs[k + 1] - l.xs[k]) * f - dz * off, z: l.zs[k] + (l.zs[k + 1] - l.zs[k]) * f + dx * off, dx, dz, k }
}
