// app/src/lib/hudScale.js — the HUD is designed at 1280×800 and shrinks as one piece below that.
export const DESIGN_W = 1280, DESIGN_H = 800
export const MIN_SCALE = 0.55
export const hudScale = (w, h) => Math.max(MIN_SCALE, Math.min(1, w / DESIGN_W, h / DESIGN_H))
// Below this layout width the hint bar would collide with the dock/minimap, so it steps aside.
export const hudCompact = (w, h) => w / hudScale(w, h) < 1150
