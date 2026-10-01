// app/src/lib/lineSwatch.js — a line's colour as a swatch on the dark HUD (F-5, 2026-10-01): the official CTA colour at
// full strength for the fill, ringed in a lighter tint of the same hue so even Brown (#62361b, ~1.9:1 on the panel)
// stands out at ≥ 3:1 (WCAG 1.4.11 for graphics), with a soft glow like the neon lines in the city.
export const PANEL_BG = '#0a111f' // --panel-solid

const chan = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const lum = (hex) => {
  const [r, g, b] = chan(hex).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const hex2 = (v) => Math.round(v).toString(16).padStart(2, '0')
const mix = (hex, t) => `#${chan(hex).map((v) => hex2(v + (255 - v) * t)).join('')}` // toward white by t

// the lightest step toward white the colour needs to reach `min` on the panel (plus a little headroom), never white
export function swatchRing(hex, min = 3.2, bg = PANEL_BG) {
  if (!/^#[0-9a-f]{6}$/i.test(hex ?? '')) return 'rgba(255, 255, 255, 0.7)'
  for (let t = 0; t <= 0.8; t += 0.05) { const c = mix(hex, t); if (contrast(c, bg) >= min) return c }
  return mix(hex, 0.8)
}
export const swatchStyle = (hex) => ({ backgroundColor: hex, borderColor: swatchRing(hex), boxShadow: `0 0 8px ${swatchRing(hex)}66` })
