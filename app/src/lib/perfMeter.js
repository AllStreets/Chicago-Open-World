// app/src/lib/perfMeter.js — frame-time windows for auto-quality, robust to warm-up and tab switches.
const WARMUP_S = 5      // shader compiles + texture uploads after `ready` never count
const WINDOW_S = 3
const MAX_DT = 0.25     // a longer frame is a background tab / hitch, not steady-state cost
const SLOW_MS = 25

export function createPerfMeter() {
  let warm = 0, t = 0, n = 0, streak = 0
  return {
    sample(dt) {
      if (warm < WARMUP_S) { warm += Math.min(dt, MAX_DT); return null }
      if (dt > MAX_DT) { t = 0; n = 0; return null }
      t += dt; n++
      if (t < WINDOW_S) return null
      const avgMs = (t / n) * 1000
      t = 0; n = 0
      if (avgMs <= SLOW_MS) { streak = 0; return 'ok' }
      streak++
      return streak >= 2 ? 'slow' : 'ok-pending'
    },
  }
}
