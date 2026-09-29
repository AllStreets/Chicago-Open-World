// pipeline/lib/transit/services.js — through-routed runs: a Loop train turns back out of the Loop instead of
// vanishing mid-map. Each service is a chain of routes from the world edge (or a cycle) that the simulator runs end to end.
export const EDGE_M = 300, JOIN_M = 150, MAX_CHAIN = 4

export function servicesFor(routes, bounds, { edgeM = EDGE_M, joinM = JOIN_M } = {}) {
  const first = (r) => r.path[0], last = (r) => r.path.at(-1)
  const gap = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2])
  const atEdge = (p) => p[0] - bounds.minX < edgeM || bounds.maxX - p[0] < edgeM || p[2] - bounds.minZ < edgeM || bounds.maxZ - p[2] < edgeM
  const next = new Map()
  for (const r of routes) {
    if (atEdge(last(r))) continue
    const q = routes.filter((x) => x !== r && x.line === r.line && gap(first(x), last(r)) < joinM).sort((a, b) => gap(first(a), last(r)) - gap(first(b), last(r)))[0]
    if (q) next.set(r.id, q.id)
  }
  const hasPred = new Set(next.values()), byId = new Map(routes.map((r) => [r.id, r])), used = new Set(), out = []
  const chain = (id) => {
    const ids = [id]
    while (ids.length < MAX_CHAIN && next.has(ids.at(-1)) && !ids.includes(next.get(ids.at(-1)))) ids.push(next.get(ids.at(-1)))
    return ids
  }
  const add = (id) => {
    const ids = chain(id), a = byId.get(ids[0]), z = byId.get(ids.at(-1))
    ids.forEach((i) => used.add(i))
    out.push({ id: `svc-${ids[0]}`, line: a.line, routes: ids, inbound: Math.hypot(last(z)[0], last(z)[2]) < Math.hypot(first(a)[0], first(a)[2]) })
  }
  for (const r of routes) if (!hasPred.has(r.id)) add(r.id)
  for (const r of routes) if (!used.has(r.id)) add(r.id) // closed cycles
  return out
}
