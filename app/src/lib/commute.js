// app/src/lib/commute.js — the WORK lens's commute model (spec §9, verbatim): walk to the nearest station (80 m/min),
// ride along the line (30 km/h), +4 min per transfer, at most one transfer, walk to the office — or simply walk if
// that's quicker. CTA L only (Metra's headways make a fixed-speed model misleading). Always a finite answer.
export const WALK = 80, RIDE = 500, TRANSFER_MIN = 4, MAX_WALK_M = 1600, TRANSFER_RADIUS = 200

export function buildCommuteGraph(transit) {
  const cta = new Set((transit?.lines ?? []).filter((l) => (l.operator ?? 'cta') === 'cta').map((l) => l.id))
  const stations = new Map(), adj = new Map()
  for (const s of transit?.stations ?? []) if ((s.operator ?? 'cta') === 'cta') { stations.set(s.id, { id: s.id, name: s.name, x: s.x, z: s.z, lines: s.lines ?? [] }); adj.set(s.id, []) }
  const lines = new Map()
  for (const r of transit?.routes ?? []) {
    if (!cta.has(r.line)) continue
    const stops = (r.stops ?? []).filter((st) => stations.has(st.station)).sort((a, b) => a.s - b.s)
    if (!lines.has(r.line)) lines.set(r.line, { stationIds: [], s: new Map() })
    const L = lines.get(r.line)
    for (const st of stops) { if (!L.s.has(st.station)) { L.stationIds.push(st.station); L.s.set(st.station, st.s) } }
    for (let i = 1; i < stops.length; i++) {
      const a = stops[i - 1].station, b = stops[i].station, min = Math.abs(stops[i].s - stops[i - 1].s) / RIDE + 0.5 // + a stop's dwell
      if (a === b) continue
      adj.get(a).push({ to: b, line: r.line, min }); adj.get(b).push({ to: a, line: r.line, min })
    }
  }
  // neighbouring stations of different lines (a few minutes' walk apart) are one transfer point
  const all = [...stations.values()]
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const a = all[i], b = all[j], d = Math.hypot(a.x - b.x, a.z - b.z)
    if (d <= TRANSFER_RADIUS && a.lines.join() !== b.lines.join()) { adj.get(a.id).push({ to: b.id, line: null, min: d / WALK }); adj.get(b.id).push({ to: a.id, line: null, min: d / WALK }) }
  }
  return { stations, adj, lines }
}

const near = (graph, [x, z], maxM = MAX_WALK_M) => [...graph.stations.values()].map((s) => ({ s, d: Math.hypot(s.x - x, s.z - z) })).filter((r) => r.d <= maxM)

// Reverse search from the office: the best minutes from every station, ≤ 1 transfer. State: (station, line ridden
// into the office side of the trip, transfers used). Small enough (≈ 150 stations × 8 lines × 2) for a plain Dijkstra.
function search(graph, dest) {
  const best = new Map(), parent = new Map(), queue = []
  const push = (key, cost, st, par) => { if (cost < (best.get(key) ?? Infinity)) { best.set(key, cost); parent.set(key, par); queue.push([cost, key, st]) } }
  for (const { s, d } of near(graph, dest)) push(`${s.id}|-|0`, d / WALK, { id: s.id, line: null, t: 0 }, null)
  while (queue.length) {
    queue.sort((a, b) => a[0] - b[0])
    const [cost, key, st] = queue.shift()
    if (cost > best.get(key)) continue
    for (const e of graph.adj.get(st.id) ?? []) {
      if (e.line == null) { if (st.line != null) push(`${e.to}|${st.line}|${st.t}w`, cost + e.min, { id: e.to, line: st.line, t: st.t, walked: true }, key); continue }
      let t = st.t, add = e.min
      if (st.line != null && st.line !== e.line) { t += 1; add += TRANSFER_MIN }
      else if (st.walked && st.line === e.line) continue // walked off the line and back on: never useful
      if (t > 1) continue
      push(`${e.to}|${e.line}|${t}`, cost + add, { id: e.to, line: e.line, t }, key)
    }
  }
  return { best, parent }
}

export function stationMinutesTo(dest, graph) {
  const { best } = search(graph, dest), out = new Map()
  for (const [key, cost] of best) { const id = key.split('|')[0]; if (key.split('|')[1] !== '-' && cost < (out.get(id) ?? Infinity)) out.set(id, cost) }
  return out
}

export function commuteMinutes(origin, dest, graph) {
  const walk = Math.hypot(origin[0] - dest[0], origin[1] - dest[1]) / WALK
  const { best, parent } = search(graph, dest)
  let pick = null
  for (const { s, d } of near(graph, origin)) for (const [key, cost] of best) {
    const [id, line] = key.split('|')
    if (id !== s.id || line === '-') continue
    const total = cost + d / WALK
    if (!pick || total < pick.total) pick = { total, key, walkIn: d / WALK, from: s.id }
  }
  if (!pick || walk <= pick.total) return { minutes: walk, mode: 'walk', legs: [{ type: 'walk', minutes: walk }], lines: [], transfers: 0 }
  // the route from the origin's station toward the office, read back along the parents
  const legs = [{ type: 'walk', minutes: pick.walkIn }], lines = []
  let key = pick.key
  while (key) {
    const par = parent.get(key), [, line] = key.split('|')
    if (line !== '-' && !lines.includes(line)) { if (lines.length) legs.push({ type: 'transfer', minutes: TRANSFER_MIN }); lines.push(line); legs.push({ type: 'ride', lineId: line, minutes: 0 }) }
    key = par
  }
  const transfers = Math.max(0, lines.length - 1)
  return { minutes: pick.total, mode: 'transit', legs, lines, transfers }
}

export function isochroneGrid(dest, graph, { minX, maxX, minZ, maxZ }, cell = 150) {
  const cols = Math.max(1, Math.ceil((maxX - minX) / cell)), rows = Math.max(1, Math.ceil((maxZ - minZ) / cell))
  const st = stationMinutesTo(dest, graph), list = [...st].map(([id, m]) => ({ s: graph.stations.get(id), m }))
  const minutes = new Float32Array(cols * rows)
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = minX + (c + 0.5) * cell, z = minZ + (r + 0.5) * cell
    let m = Math.hypot(x - dest[0], z - dest[1]) / WALK
    for (const { s, m: sm } of list) { const d = Math.hypot(s.x - x, s.z - z); if (d <= MAX_WALK_M) m = Math.min(m, sm + d / WALK) }
    minutes[r * cols + c] = m
  }
  return { cols, rows, minX, minZ, cell, minutes }
}

export function lineUsefulness(dest, graph, origins) {
  const count = new Map()
  for (const o of origins) for (const l of commuteMinutes(o, dest, graph).lines) count.set(l, (count.get(l) ?? 0) + 1)
  const max = Math.max(0, ...count.values())
  return new Map([...count].map(([l, n]) => [l, max ? n / max : 0]))
}

export function rankZones(dest, graph, zones) {
  return (zones ?? []).map((zone) => { const r = commuteMinutes(zone.label, dest, graph); return { zone, minutes: r.minutes, lines: r.lines, transfers: r.transfers } }).sort((a, b) => a.minutes - b.minutes)
}
