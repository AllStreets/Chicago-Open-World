// app/src/sports/anchors.js — packed seat/plaza anchors, field-frame ↔ world, fans on the field.
import { rng } from './crowd.js'

export function decodeAnchors(buffer, center) {
  const a = new Int16Array(buffer), n = a.length / 4, out = new Float32Array(n * 4)
  for (let i = 0; i < n; i++) {
    out[i * 4] = center[0] + a[i * 4] / 10; out[i * 4 + 1] = a[i * 4 + 1] / 10
    out[i * 4 + 2] = center[1] + a[i * 4 + 2] / 10; out[i * 4 + 3] = a[i * 4 + 3] / 10000
  }
  return out
}
export function frameToWorld(frame, u, v) {
  const [ax, az] = frame.axis, L = [az, -ax]
  return [frame.origin[0] + ax * u + L[0] * v, frame.origin[1] + az * u + L[1] * v]
}
const FAN_AREA = { baseball: [8, 60, 22], football: [-30, 30, 18] } // u from, u to, |v| max
export function fieldFans(frame, kind, n, seed = 3) {
  const [u0, u1, vm] = FAN_AREA[kind] ?? FAN_AREA.football, r = rng(seed), out = new Float32Array(n * 4)
  for (let i = 0; i < n; i++) {
    const [x, z] = frameToWorld(frame, u0 + r() * (u1 - u0), (r() * 2 - 1) * vm)
    out.set([x, 0.3, z, r() * Math.PI * 2], i * 4)
  }
  return out
}
const cache = new Map()
export function fetchAnchors(path, center, fetchImpl = fetch) {
  if (!cache.has(path)) cache.set(path, fetchImpl(`/world/${path}`).then((r) => (r.ok ? r.arrayBuffer() : new ArrayBuffer(0))).then((b) => decodeAnchors(b, center)).catch(() => new Float32Array(0)))
  return cache.get(path)
}
