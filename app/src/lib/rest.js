// app/src/lib/rest.js — "settled" = the watched numbers stayed within eps for `frames` consecutive samples.
export function createRestTracker({ frames = 20, eps = 1e-3 } = {}) {
  let last = null, still = 0
  return {
    sample(values) {
      const moved = !last || values.length !== last.length || values.some((v, i) => Math.abs(v - last[i]) > eps)
      if (moved) { last = values.slice(); still = 0 } else still++
      return still >= frames
    },
  }
}
