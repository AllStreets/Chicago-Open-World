// app/src/lib/atmosphere.js — the weather and season of each view (user fixes 2026-09-29: "the day is too gray"):
// DAY and SUNNY are clear, blue-skied days; SNOW is Christmas Eve at dusk — overcast, snow falling, snow on the roofs
// and parks, the lake frozen along the shore. Everything else keeps the original look.
export const PRESETS = ['LIVE', 'DAWN', 'DAY', 'DUSK', 'NIGHT', 'SUNNY', 'SNOW']

const BASE = { skyGain: 0.42, skyTint: [1, 1, 1], sunScale: 1, turbidity: 3.2, rayleigh: 1.2, fogTint: null, fogScale: 1, snow: 0, ice: 0, overcast: 0 }
const LOOKS = {
  // the physical sky blows out to white under the composer's ACES: a lower gain and a blue tint make a clear blue day
  DAY: { skyGain: 0.38, skyTint: [0.58, 0.84, 1.42], turbidity: 2.0, rayleigh: 2.2, fogTint: '#a3c3ea', fogScale: 1.6 },
  SUNNY: { skyGain: 0.3, skyTint: [0.55, 0.82, 1.4], sunScale: 0.82, turbidity: 1.6, rayleigh: 2.6, fogTint: '#9cc2ee', fogScale: 1.9 },
  // overcast: a flat grey-blue sky (no stars), light from the whole sky rather than the sun
  SNOW: { skyGain: 0.24, skyTint: [0.7, 0.74, 0.84], turbidity: 10, rayleigh: 0.5, fogTint: '#8f99ab', fogScale: 0.45, snow: 1, ice: 1, overcast: 0.8 },
}
export const atmosphereFor = (preset) => ({ ...BASE, ...(LOOKS[preset] ?? {}) })
