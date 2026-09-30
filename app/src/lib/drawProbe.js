// app/src/lib/drawProbe.js — exact draw calls per frame. EffectComposer renders several passes and three resets
// renderer.info on each render() while autoReset is on, so the probe turns autoReset off and resets once per frame,
// after the composer (PerfProbe runs at useFrame priority 1000).
export function createDrawProbe(info, window = 60) {
  const calls = [], tris = [], dts = []
  const push = (a, v) => { a.push(v); if (a.length > window) a.shift() }
  const avg = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0)
  return {
    start() { calls.length = tris.length = dts.length = 0; info.autoReset = false; info.reset() },
    stop() { info.autoReset = true },
    frame() {
      const c = info.render.calls, t = info.render.triangles
      info.reset()
      push(calls, c); push(tris, t)
      return { calls: c, triangles: t }
    },
    tick(dt) { push(dts, dt) },
    stats() {
      const mdt = avg(dts)
      return { calls: Math.round(avg(calls)), maxCalls: Math.max(0, ...calls), triangles: Math.round(avg(tris)), maxTriangles: Math.max(0, ...tris), fps: mdt ? Math.round(1 / mdt) : 0, frames: calls.length }
    },
  }
}
