// app/src/traffic/graph.js — the road graph from traffic.bin (pipeline lib/traffic.js): directed lane-links between
// junctions, which junctions have traffic lights, and where each approach's stop line is. Pure.
export const CLASSES = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'local', 'link']
// total ribbon width per class (pipeline ground.js ROAD_WIDTHS; local = residential/unclassified)
export const ROAD_WIDTH = [22, 18, 16, 14, 12, 9, 8]
export const SPEED = [27, 20, 14, 13, 12, 9, 13] // m/s: ~60 mph expressways, 30 mph arterials, 20 mph side streets
export const LANE_M = 3.3
const SIGNAL_CLUSTER_M = 28

export const LOWER_FLAG = 8 // pipeline traffic.js: a lower-level edge (heights per point, a deck width)
export const DEEP_M = 0.5    // a roadway this far under the street is on a lower level

// traffic.bin → { nodes: Float32Array x, z…, nodeY: Float32Array, edges: [{ from, to, cls, fwd, back, pts, ys, w }] }.
// v1: the street level only. v2 (D3-1): plus the lower levels — a node's y (m over the street's road ribbon, 0 on the
// street) and, on a lower edge, a y per point and the deck's width.
export function decodeRoadGraph(buf) {
  const a = buf instanceof Int16Array ? buf : new Int16Array(buf)
  let i = 0
  const version = a[i++]
  if (version !== 1 && version !== 2) throw new Error(`traffic.bin: version ${version}`)
  const nN = a[i++] & 0xffff, nodes = new Float32Array(nN * 2), nodeY = new Float32Array(nN)
  for (let k = 0; k < nN * 2; k++) nodes[k] = a[i++]
  if (version >= 2) { const nY = a[i++] & 0xffff; for (let k = 0; k < nY; k++) { nodeY[a[i] & 0xffff] = a[i + 1] / 100; i += 2 } }
  const nE = a[i++] & 0xffff, edges = []
  for (let e = 0; e < nE; e++) {
    const from = a[i++] & 0xffff, to = a[i++] & 0xffff, flags = a[i++], fwd = a[i++], back = a[i++], k = a[i++]
    const low = version >= 2 && (flags & LOWER_FLAG) !== 0, cls = flags & 7
    const w = low ? a[i++] / 10 : null
    const pts = [[nodes[from * 2], nodes[from * 2 + 1]]], ys = low ? [nodeY[from]] : null
    for (let j = 0; j < k; j++) { pts.push([a[i], a[i + 1]]); i += 2; if (low) ys.push(a[i++] / 100) }
    pts.push([nodes[to * 2], nodes[to * 2 + 1]])
    if (low) ys.push(nodeY[to])
    edges.push({ from, to, cls, fwd, back, pts, ys, w })
  }
  return { nodes, nodeY, edges }
}

// the y of a link `s` metres along it (m over the street's road ribbon: 0 on the street, about −5.2 on Lower Wacker)
export function yAt(l, s) {
  if (!l.ys) return 0
  const n = l.xs.length
  if (s <= 0) return l.ys[0]
  if (s >= l.len) return l.ys[n - 1]
  let lo = 0, hi = n - 1
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (l.cum[m] <= s) lo = m; else hi = m }
  const L = l.cum[hi] - l.cum[lo] || 1
  return l.ys[lo] + ((l.ys[hi] - l.ys[lo]) * (s - l.cum[lo])) / L
}

// Lanes on a lower deck (D3-2): kept clear of its side walls and of the rows of columns lowerLevels.js stands just
// inside the kerbs (and down the middle of a deck 14 m or wider), so no vehicle — up to a 2.6 m truck — ever touches
// one. Offsets right of the centreline; a two-way deck uses its right half.
export const DECK = { colIn: 0.5, colHalf: 0.3, colMinW: 8, midColW: 14, wallPad: 0.3, vehHalf: 1.3, margin: 0.6 } // margin: the graph's whole-metre points (≤ 0.5 m) + 0.1
export function deckLaneOffsets(w, lanes, twoWay) {
  const half = w / 2, D = DECK
  const outer = w >= D.colMinW ? half - D.colIn - D.colHalf - D.vehHalf - D.margin : half + D.wallPad - D.vehHalf - D.margin
  const midClear = w >= D.midColW ? D.colHalf + D.vehHalf + D.margin : 0 // the middle column row
  const inner = twoWay ? Math.max(D.vehHalf + D.margin, midClear) : -outer
  const span = twoWay ? half : w, laneW = span / lanes
  const want = Array.from({ length: lanes }, (_, i) => (twoWay ? (i + 0.5) * laneW : -half + (i + 0.5) * laneW))
  const fit = (o) => {
    const v = Math.max(inner, Math.min(outer, o))
    return !twoWay && midClear && Math.abs(v) < midClear ? (v < 0 ? -midClear : midClear) : v
  }
  const out = []
  for (const o of want.map(fit)) if (o >= inner - 1e-6 && o <= outer + 1e-6 && out.every((q) => Math.abs(q - o) >= 2 * D.vehHalf + 0.2)) out.push(o)
  return out.length ? out : [twoWay ? half / 2 : 0]
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
export function buildNetwork({ nodes, nodeY = null, edges }) {
  const links = [], outOf = new Map(), into = new Map()
  const push = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v) }
  edges.forEach((e, ei) => {
    for (const dir of [1, -1]) {
      const lanes0 = dir > 0 ? e.fwd : e.back
      if (!lanes0) continue
      const pts = dir > 0 ? e.pts : [...e.pts].reverse(), P = polyline(pts)
      if (P.len < 1) continue
      const twoWay = e.fwd > 0 && e.back > 0, deck = e.w != null
      const half = deck ? e.w / 2 : ROAD_WIDTH[e.cls] / 2
      let offsets
      if (deck) offsets = deckLaneOffsets(e.w, lanes0, twoWay)
      else {
        const laneW = Math.min(LANE_M, ((twoWay ? half : 2 * half) - 0.6) / lanes0)
        offsets = Array.from({ length: lanes0 }, (_, i) => (twoWay ? 0.4 + (i + 0.5) * laneW : (i - (lanes0 - 1) / 2) * laneW))
      }
      const ys = e.ys ? Float32Array.from(dir > 0 ? e.ys : [...e.ys].reverse()) : null
      const n = P.xs.length, lanes = offsets.length
      const link = {
        id: links.length, edge: ei, from: dir > 0 ? e.from : e.to, to: dir > 0 ? e.to : e.from, cls: e.cls, lanes, offsets, half, ...P, ys,
        // lower: anywhere under the street; deep: under it end to end (seen only while the lower levels are drawn)
        lower: Boolean(ys && ys.some((y) => y < -DEEP_M)), deep: Boolean(ys && ys.every((y) => y < -DEEP_M)),
        headIn: heading(P.xs[1] - P.xs[0], P.zs[1] - P.zs[0]), headOut: heading(P.xs[n - 1] - P.xs[n - 2], P.zs[n - 1] - P.zs[n - 2]),
        speed: SPEED[e.cls], stopAt: P.len, signal: -1, phase: 0, next: [], holds: [], spans: [],
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
  return { links, outOf, into, signals: placeSignals(nodes, edges, links, into, nodeY) }
}

// traffic lights: junctions of three or more streets where at least two are arterials (trunk … tertiary, ramps), never
// on the expressways themselves. Junction nodes within 28 m (a divided road's two carriageways) share one controller.
// Each approach is phase 0 (along the controller's main axis) or phase 1 (across it).
// D3-2: none under the street (OSM tags no signals there); a ramp coming up to a lit street junction is held at its
// line like any other approach.
export function placeSignals(nodes, edges, links, into, nodeY = null) {
  const deg = new Map(), art = new Map(), fast = new Set()
  edges.forEach((e) => {
    for (const n of [e.from, e.to]) {
      deg.set(n, (deg.get(n) ?? 0) + 1)
      if (e.cls >= 1 && e.cls <= 4 || e.cls === 6) art.set(n, (art.get(n) ?? 0) + 1)
      if (e.cls === 0) fast.add(n)
    }
  })
  const lit = [...deg.keys()].filter((n) => deg.get(n) >= 3 && (art.get(n) ?? 0) >= 2 && !fast.has(n) && !(nodeY && nodeY[n] < -DEEP_M))
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
      if (l.ys && yAt(l, l.stopAt) < -1) continue // its stop line would be down the ramp, under the street
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
  const y = l.ys ? l.ys[k] + (l.ys[k + 1] - l.ys[k]) * f : 0, grade = l.ys ? (l.ys[k + 1] - l.ys[k]) / L : 0
  return { x: l.xs[k] + (l.xs[k + 1] - l.xs[k]) * f - dz * off, z: l.zs[k] + (l.zs[k + 1] - l.zs[k]) * f + dx * off, y, grade, dx, dz, k }
}

// --- raised bridges ------------------------------------------------------------------------------------------------
// Where each link crosses a bascule (bridges.json: centre, axis along the road, span). `spans`: the stretch of the link
// on the leaves; `holds`: where a vehicle waits while that bridge is up — a few metres short of the leaves on this
// link, or at the end of the link before when the bridge starts with this one (OSM splits the bridge out as its own
// way), then only for the vehicles about to turn onto it (`via`). The lower decks (Lower Michigan across DuSable) are
// on the same leaves, so they wait too.
export const BRIDGE = { sideM: 14, endPadM: 1, holdBackM: 4, sampleM: 2, parallel: 0.6 }
export function bridgeCrossings(net, bridges) {
  for (const l of net.links) { l.spans = []; l.holds = [] }
  for (const b of bridges ?? []) {
    const ax = b.axis[0], az = b.axis[1], al = Math.hypot(ax, az) || 1, ux = ax / al, uz = az / al
    const half = b.span / 2 + BRIDGE.endPadM, reach = half + BRIDGE.sideM
    const [cx, cz] = b.centre
    for (const l of net.links) {
      if (l.bbox[0] > cx + reach || l.bbox[2] < cx - reach || l.bbox[1] > cz + reach || l.bbox[3] < cz - reach) continue
      let s0 = -1, s1 = -1
      for (let s = 0; s <= l.len; s += BRIDGE.sampleM) {
        const p = pointOnLink(l, Math.min(s, l.len), 0)
        if (Math.abs(p.dx * ux + p.dz * uz) < BRIDGE.parallel) continue
        const along = (p.x - cx) * ux + (p.z - cz) * uz, across = -(p.x - cx) * uz + (p.z - cz) * ux
        if (Math.abs(along) <= half && Math.abs(across) <= BRIDGE.sideM) { if (s0 < 0) s0 = s; s1 = Math.min(s, l.len) }
      }
      if (s0 >= 0) l.spans.push({ key: b.key, s0, s1 })
    }
  }
  for (const l of net.links) for (const sp of l.spans) {
    if (sp.s0 > BRIDGE.holdBackM + 2) { l.holds.push({ key: sp.key, at: sp.s0 - BRIDGE.holdBackM, via: null }); continue }
    for (const p of net.into.get(l.from) ?? []) {
      if (p.spans.some((q) => q.key === sp.key)) continue // already on the bridge
      let h = p.holds.find((q) => q.key === sp.key && q.via)
      if (!h) { h = { key: sp.key, at: Math.max(0, p.len - (BRIDGE.holdBackM - sp.s0)), via: new Set() }; p.holds.push(h) }
      h.via.add(l)
    }
  }
  return net
}

// is a bridge "closed" to traffic: its leaves off the deck, or a lift starting within leadS (the gates come down
// first, so the deck is clear when the leaves rise). lift: BridgeLeaves' liveLift { angles, elapsed, order, T }.
export function closedBridges(lift, leadS = 10, eps = 0.002) {
  const out = new Set()
  if (!lift) return out
  for (const [k, a] of Object.entries(lift.angles ?? {})) if (a > eps) out.add(k)
  if (lift.elapsed != null && lift.T && lift.order) {
    const T = lift.T, end = T.raiseS + T.holdS + T.lowerS
    lift.order.forEach((k, i) => { const t = lift.elapsed - i * T.staggerS; if (t > -leadS && t < end) out.add(k) })
  }
  return out
}

// --- what the lower decks draw ------------------------------------------------------------------------------------
// The deck mesh (world/lowerLevels.js hideThroughDecks) leaves out the part of a ramp that rises inside another
// roadway's footprint (OSM draws a ramp's centreline a few metres from the road it leaves). A vehicle there would rise
// through that road's ceiling, so it isn't drawn there: `hide` holds the link's [s0, s1, …] stretches off every drawn
// deck while it is above its level. shown: the deck pieces actually drawn ({ w, p: [[x, z, y]] }, y absolute);
// roadY: the street's road ribbon (link heights are measured from it).
export function deckHides(net, shown, roadY = 0.12, stepM = 2) {
  const cell = 40, grid = new Map(), key = (i, j) => `${i},${j}`
  for (const w of shown ?? []) for (let i = 1; i < w.p.length; i++) {
    const a = w.p[i - 1], b = w.p[i], r = w.w / 2 + 0.5
    for (let ci = Math.floor((Math.min(a[0], b[0]) - r) / cell); ci <= Math.floor((Math.max(a[0], b[0]) + r) / cell); ci++)
      for (let cj = Math.floor((Math.min(a[1], b[1]) - r) / cell); cj <= Math.floor((Math.max(a[1], b[1]) + r) / cell); cj++) {
        const k = key(ci, cj); if (!grid.has(k)) grid.set(k, []); grid.get(k).push([a, b, r])
      }
  }
  const onDeck = (x, z, y) => {
    for (const [a, b, r] of grid.get(key(Math.floor(x / cell), Math.floor(z / cell))) ?? []) {
      const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1
      const u = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2))
      if (Math.hypot(x - a[0] - u * dx, z - a[1] - u * dz) <= r && Math.abs(a[2] + u * (b[2] - a[2]) - y) < 0.6) return true
    }
    return false
  }
  for (const l of net.links) {
    l.hide = null
    if (!l.lower) continue
    let lo = Infinity
    for (const y of l.ys) lo = Math.min(lo, y)
    const out = []
    let open = -1
    for (let s = 0; s <= l.len + stepM - 1e-6; s += stepM) {
      const ss = Math.min(s, l.len), y = yAt(l, ss)
      const p = pointOnLink(l, ss, 0)
      const off = y < -DEEP_M && y > lo + 0.3 && !onDeck(p.x, p.z, y + roadY)
      if (off && open < 0) open = Math.max(0, ss - stepM / 2)
      if (!off && open >= 0) { out.push(open, ss - stepM / 2); open = -1 }
    }
    if (open >= 0) out.push(open, l.len)
    if (out.length) l.hide = Float32Array.from(out)
  }
  return net
}
export function hiddenAt(l, s) {
  const h = l.hide
  if (!h) return false
  for (let i = 0; i < h.length; i += 2) if (s >= h[i] && s <= h[i + 1]) return true
  return false
}
