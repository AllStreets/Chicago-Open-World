// app/src/transit/glowWidth.js — how wide the line glow is: its physical strip up close, never under 2 px far away (B.3).
export const GLOW_DEFAULTS = { minPx: 3, baseHalfM: 0.18, dayLevel: 0.2 }

export const worldPerPixel = (dist, tanHalfFov, viewportH) => (2 * Math.max(0, dist) * tanHalfFov) / Math.max(1, viewportH)

export function glowHalfWidth(dist, tanHalfFov, viewportH, minPx = GLOW_DEFAULTS.minPx, baseHalfM = GLOW_DEFAULTS.baseHalfM) {
  return Math.max(baseHalfM, 0.5 * minPx * worldPerPixel(dist, tanHalfFov, viewportH))
}

// the neon rule (B.1.1): ~15 % by day, full at dusk and night
export function glowLevel(night, day = GLOW_DEFAULTS.dayLevel) {
  return day + (1 - day) * Math.min(1, Math.max(0, night))
}

// The ribbon sits at track height, so a low roof between it and an oblique camera cut the neon into dashes: each vertex is
// drawn pulled toward the camera by 12 % of its distance (at most 120 m) — thin neighbours no longer occlude it, towers do.
export const GLOW_PULL = { k: 0.12, maxM: 120 }
export const glowDepthPull = (dist) => Math.min(GLOW_PULL.maxM, GLOW_PULL.k * Math.max(0, dist))

const d = GLOW_DEFAULTS.dayLevel
export const GLOW_GLSL = /* glsl */ `
float owGlowHalfWidth(float dist, float tanHalfFov, float viewportH, float minPx, float baseHalf) {
  float wpp = 2.0 * max(dist, 0.0) * tanHalfFov / max(1.0, viewportH);
  return max(baseHalf, 0.5 * minPx * wpp);
}
float owGlowPull(float dist) { return min(${GLOW_PULL.maxM.toFixed(1)}, ${GLOW_PULL.k.toFixed(3)} * max(dist, 0.0)); }
float owGlowLevel(float night) { return ${d.toFixed(3)} + ${(1 - d).toFixed(3)} * clamp(night, 0.0, 1.0); }
`
