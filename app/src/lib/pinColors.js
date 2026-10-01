// app/src/lib/pinColors.js — colours for the place pins that survive the frame's post-processing (P4 fix). The scene is
// tone-mapped with ACES filmic and bloomed above a luminance of 0.55, both after the pins draw: a plain colour comes out
// desaturated and its white parts glow. So each pin colour is pre-compensated through the exact inverse of three's ACES
// curve (same matrices, exposure 1), and must stay under the bloom threshold.
export const BLOOM_LIMIT = 0.55 // PostFX bloom: luminanceThreshold 0.55 (smoothstep from there up)
// the pin's outline and glyph: the lightest grey that stays under the bloom — reads as white against the deep fills
export const PIN_WHITE = '#c3c8cd'

export function srgbToLinear(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 })
}

// three.js ACESFilmicToneMapping (tonemapping_pars_fragment), column-major matrices as written there
const IN = [[0.59719, 0.35458, 0.04823], [0.07600, 0.90834, 0.01566], [0.02840, 0.13383, 0.83777]]
const OUT = [[1.60475, -0.53108, -0.07367], [-0.10208, 1.10813, -0.00605], [-0.00327, -0.07276, 1.07602]]
const mul = (M, v) => M.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2])
const fit = (v) => v.map((x) => (x * (x + 0.0245786) - 0.000090537) / (x * (0.983729 * x + 0.4329510) + 0.238081))
export function acesFilmic(rgb, exposure = 1) {
  const c = mul(OUT, fit(mul(IN, rgb.map((x) => (x * exposure) / 0.6))))
  return c.map((x) => Math.min(1, Math.max(0, x)))
}

// the scene-linear input whose tone-mapped result is the given sRGB colour (damped Newton, numeric Jacobian diagonal)
export function pinInput(hex) {
  const want = srgbToLinear(hex)
  const x = want.slice()
  for (let it = 0; it < 80; it++) {
    const y = acesFilmic(x)
    for (let k = 0; k < 3; k++) {
      const h = 1e-3, xk = x.slice(); xk[k] += h
      const d = (acesFilmic(xk)[k] - y[k]) / h || 1
      x[k] = Math.max(0, x[k] + (0.8 * (want[k] - y[k])) / Math.max(0.05, d))
    }
  }
  return x
}
