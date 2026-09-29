// app/src/transit/glowWidth.js — how wide the line glow is: its physical strip up close, never under 2 px far away (B.3).
export const GLOW_DEFAULTS = { minPx: 2, baseHalfM: 0.18, dayLevel: 0.15 }

export const worldPerPixel = (dist, tanHalfFov, viewportH) => (2 * Math.max(0, dist) * tanHalfFov) / Math.max(1, viewportH)

export function glowHalfWidth(dist, tanHalfFov, viewportH, minPx = GLOW_DEFAULTS.minPx, baseHalfM = GLOW_DEFAULTS.baseHalfM) {
  return Math.max(baseHalfM, 0.5 * minPx * worldPerPixel(dist, tanHalfFov, viewportH))
}

// the neon rule (B.1.1): ~15 % by day, full at dusk and night
export function glowLevel(night, day = GLOW_DEFAULTS.dayLevel) {
  return day + (1 - day) * Math.min(1, Math.max(0, night))
}

const d = GLOW_DEFAULTS.dayLevel
export const GLOW_GLSL = /* glsl */ `
float owGlowHalfWidth(float dist, float tanHalfFov, float viewportH, float minPx, float baseHalf) {
  float wpp = 2.0 * max(dist, 0.0) * tanHalfFov / max(1.0, viewportH);
  return max(baseHalf, 0.5 * minPx * wpp);
}
float owGlowLevel(float night) { return ${d.toFixed(3)} + ${(1 - d).toFixed(3)} * clamp(night, 0.0, 1.0); }
`
