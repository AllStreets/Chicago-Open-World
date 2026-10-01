// app/src/transit/liveTrains.js — live CTA trains (P5 · I-5.2, C11): each Train Tracker report snapped onto V3's track
// (the service of its line whose direction matches the heading), then moved forward only between polls. A report
// more than 60 m from its line is dropped, never drawn floating off the structure.
import { CHI_LINE } from '../lib/nearestTransit.js'

export const SNAP_MAX_M = 60

// compass bearing of a local segment: 0 = north (−Z), 90 = east (+X)
const bearing = (dx, dz) => ((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360
const turn = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d }

function nearestOn(points, x, z) {
  let best = { d2: Infinity, s: 0, brg: 0 }, acc = 0
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1], [bx, bz] = points[i], dx = bx - ax, dz = bz - az, len2 = dx * dx + dz * dz, len = Math.sqrt(len2)
    const f = len2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2)) : 0
    const px = ax + dx * f, pz = az + dz * f, d2 = (x - px) ** 2 + (z - pz) ** 2
    if (d2 < best.d2) best = { d2, s: acc + len * f, brg: bearing(dx, dz) }
    acc += len
  }
  return best
}

// `heading` 0 (a stopped train) or not finite means "unknown": the nearest path of the line wins.
export function snapToTrack({ lat, lon, heading, lineId }, paths, project) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !lineId) return null
  const [x, z] = project(lon, lat)
  const known = Number.isFinite(heading) && heading !== 0
  let best = null
  for (const p of paths) {
    if (p.lineId !== lineId || p.points.length < 2) continue
    const n = nearestOn(p.points, x, z), errM = Math.sqrt(n.d2)
    if (errM > SNAP_MAX_M) continue
    if (known && turn(n.brg, heading) > 90) continue // the other direction's track
    if (!best || errM < best.errM) best = { pathId: p.id, s: n.s, errM }
  }
  return best
}

export function createLiveTracker({ paths, maxSpeed = 25, teleportM = 1500, staleMs = 90_000, project, reachS = 45 }) {
  const live = new Map()
  const posAt = (t, tMs) => t.s + Math.min(t.speed * Math.max(0, tMs - t.t) / 1000, t.speed * reachS)
  return {
    ingest(trains, tMs) {
      for (const r of trains ?? []) {
        const lineId = CHI_LINE[r?.line]
        if (!r?.rn || !lineId) continue
        const snap = snapToTrack({ lat: Number(r.lat), lon: Number(r.lon), heading: Number(r.heading), lineId }, paths, project)
        if (!snap) continue
        const prev = live.get(r.rn)
        let s = snap.s, speed = 0
        if (prev && prev.pathId === snap.pathId && Math.abs(snap.s - prev.reportS) <= teleportM && tMs > prev.reportT) {
          speed = Math.max(0, Math.min(maxSpeed, (snap.s - prev.reportS) / ((tMs - prev.reportT) / 1000)))
          s = Math.max(snap.s, posAt(prev, tMs)) // forward only: a small step back in the report is GPS jitter
        }
        live.set(r.rn, { rn: r.rn, lineId, pathId: snap.pathId, s, t: tMs, speed, reportS: snap.s, reportT: tMs, seen: tMs, errM: snap.errM,
          nextStation: r.nextStation ?? null, arrTime: r.arrTime ?? null, destination: r.destination ?? r.destNm ?? null })
      }
    },
    trainsAt(tMs) {
      const out = []
      for (const [rn, t] of live) {
        if (tMs - t.seen > staleMs) { live.delete(rn); continue }
        out.push({ id: `rn:${rn}`, rn, lineId: t.lineId, line: t.lineId, pathId: t.pathId, service: t.pathId, s: posAt(t, tMs), dir: 1, speed: t.speed, live: true, nextStation: t.nextStation, destination: t.destination })
      }
      return out
    },
    reports: () => [...live.values()].map((t) => ({ rn: t.rn, line: Object.keys(CHI_LINE).find((k) => CHI_LINE[k] === t.lineId), nextStation: t.nextStation, arrTime: t.arrTime, destination: t.destination })),
    size: () => live.size,
    clear: () => live.clear(),
  }
}

// V4's services (a line + direction, routes joined) are the snap paths: a live train lands on the same track the
// simulator runs on, so it is drawn by the same instanced renderer.
export const servicePaths = (sim) => (sim?.services ?? []).map((sv) => ({ id: sv.id, lineId: sv.line, points: sv.path.pts.map((p) => [p[0], p[2]]) }))
