// app/src/ride/walkGraph.js — the ground fork's walkable network (walk-graph.json: park paths, trails, the Riverwalk,
// footbridges) and shortest routes over it, so a walk's off-street legs follow the real paths once it is in the world.
// Format: { nodes: [x0, z0, …], edges: [a, b, surface, lengthM, k, x, z × k interior points, …] }.

export function parseWalkGraph(json) {
  const nodes = json?.nodes, flat = json?.edges
  if (!Array.isArray(nodes) || !Array.isArray(flat)) return null
  const n = nodes.length / 2, adj = Array.from({ length: n }, () => [])
  for (let i = 0; i < flat.length;) {
    const a = flat[i], b = flat[i + 1], len = flat[i + 3], k = flat[i + 4]
    const inner = []
    for (let j = 0; j < k; j++) inner.push([flat[i + 5 + 2 * j], flat[i + 6 + 2 * j]])
    i += 5 + 2 * k
    if (!(a >= 0 && a < n && b >= 0 && b < n)) continue
    adj[a].push({ to: b, len, pts: inner })
    adj[b].push({ to: a, len, pts: [...inner].reverse() })
  }
  return { nodes, n, adj }
}

const pt = (g, i) => [g.nodes[2 * i], g.nodes[2 * i + 1]]
export function nearestNode(g, [x, z], maxM = 40) {
  let best = -1, bd = maxM * maxM
  for (let i = 0; i < g.n; i++) { const dx = g.nodes[2 * i] - x, dz = g.nodes[2 * i + 1] - z, d = dx * dx + dz * dz; if (d < bd) { bd = d; best = i } }
  return best
}

// Dijkstra with a binary heap; returns the polyline from a to b (with each edge's interior points) or null
function shortest(g, a, b) {
  const dist = new Float64Array(g.n).fill(Infinity), prev = new Int32Array(g.n).fill(-1), via = new Array(g.n)
  const heap = [[0, a]]
  dist[a] = 0
  const push = (e) => { heap.push(e); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p } }
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m } } return top }
  while (heap.length) {
    const [d, u] = pop()
    if (u === b) break
    if (d > dist[u]) continue
    for (const e of g.adj[u]) { const nd = d + e.len; if (nd < dist[e.to]) { dist[e.to] = nd; prev[e.to] = u; via[e.to] = e; push([nd, e.to]) } }
  }
  if (!Number.isFinite(dist[b])) return null
  const out = [pt(g, b)]
  for (let v = b; v !== a; v = prev[v]) { out.push(...[...via[v].pts].reverse()); out.push(pt(g, prev[v])) }
  return out.reverse()
}

// A walk leg between two waypoints over the graph: both ends must be within `snapM` of a node, else (or with no
// path) the leg stays the straight curated line. The waypoints themselves start and end the leg.
export function routeLeg(g, from, to, snapM = 40) {
  if (!g) return [from, to]
  const a = nearestNode(g, from, snapM), b = nearestNode(g, to, snapM)
  if (a < 0 || b < 0) return [from, to]
  if (a === b) return [from, to]
  const mid = shortest(g, a, b)
  return mid ? [from, ...mid, to] : [from, to]
}

export function routeOnGraph(g, waypoints, snapM = 40) {
  const out = []
  for (let i = 1; i < waypoints.length; i++) {
    const leg = routeLeg(g, waypoints[i - 1], waypoints[i], snapM)
    out.push(...(i === 1 ? leg : leg.slice(1)))
  }
  return out
}
