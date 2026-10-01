// app/src/weather/weatherState.js — Chicago's weather (P5 · I-5.3): CHI's /api/weather (OpenWeather) → a weather state
// → how the city looks. It reuses the SNOW view's systems (atmosphere overcast / snow / fog, SeasonRig's flakes) and
// adds only rain; the wind drifts both. Pure functions: everything here is safe to call inside a frame.
const MPH = 0.44704

const clearDefault = () => ({ kind: 'clear', intensity: 0, windDeg: 270, windMps: 3, source: 'default', label: 'clear sky' })

function grade(desc, { light, mid, heavy }) {
  if (/heavy|extreme|very/.test(desc)) return heavy
  if (/light|drizzle/.test(desc)) return light
  return mid
}

export function weatherFromChi(w) {
  if (!w || typeof w !== 'object' || typeof w.icon !== 'string') return clearDefault()
  const code = w.icon.slice(0, 2), desc = String(w.description ?? '').toLowerCase()
  const vis = Number.isFinite(Number(w.visibility)) && w.visibility !== null ? Number(w.visibility) : 10
  let kind, intensity
  if (code === '01' || code === '02') { kind = 'clear'; intensity = 0 }
  else if (code === '03') { kind = 'overcast'; intensity = 0.5 }
  else if (code === '04') { kind = 'overcast'; intensity = 0.9 }
  else if (code === '09' || code === '10') { kind = 'rain'; intensity = Math.min(1, grade(desc, { light: 0.35, mid: 0.6, heavy: 0.9 }) + (/shower/.test(desc) ? 0.1 : 0)) }
  else if (code === '11') { kind = 'rain'; intensity = 1 }
  else if (code === '13') { kind = 'snow'; intensity = grade(desc, { light: 0.35, mid: 0.6, heavy: 0.9 }) }
  else if (code === '50') { kind = 'fog'; intensity = vis <= 0.5 ? 1 : vis <= 2 ? 0.7 : 0.4 }
  else return clearDefault()
  if ((kind === 'clear' || kind === 'overcast') && vis <= 1) { kind = 'fog'; intensity = 0.6 }
  const mph = Number(w.windMph ?? w.wind?.speed), deg = Number(w.wind?.deg)
  return {
    kind, intensity, source: 'live', label: desc || kind,
    windMps: Number.isFinite(mph) ? mph * MPH : 3, windDeg: Number.isFinite(deg) ? deg : 270,
  }
}

export const WEATHER_MODES = ['LIVE', 'CLEAR', 'OVERCAST', 'RAIN', 'SNOW', 'FOG']
export const WEATHER_NAMES = { LIVE: 'Live Chicago weather', CLEAR: 'Clear', OVERCAST: 'Overcast', RAIN: 'Rain', SNOW: 'Snow', FOG: 'Lake fog' }
export const manualWeather = (mode) => (mode === 'CLEAR' || !WEATHER_NAMES[mode] || mode === 'LIVE'
  ? { ...clearDefault(), source: 'manual' }
  : { kind: mode.toLowerCase(), intensity: 0.7, windMps: 4, windDeg: 290, source: 'manual', label: WEATHER_NAMES[mode].toLowerCase() })

const RAIN_COUNT = { LOW: 6000, HIGH: 6000, ULTRA: 9000 }
const SNOW_COUNT = { LOW: 4000, HIGH: 4000, ULTRA: 6000 }
const NUM = ['sunScale', 'overcast', 'shadowOpacity', 'fogScale', 'rain', 'snow', 'haze']
export function weatherVisuals({ kind, intensity }, quality = 'HIGH') {
  const i = Math.max(0, Math.min(1, intensity ?? 0)), low = quality === 'LOW' ? 0.25 : 1
  // haze pulls the far fog in too (the designed views clamp how far fogScale can bring it)
  const v = { sunScale: 1, overcast: 0, shadowOpacity: 1, fogScale: 1, rain: 0, snow: 0, haze: 0, particles: { kind: 'none', count: 0, fallMps: 0 } }
  if (kind === 'overcast') Object.assign(v, { overcast: 0.4 + 0.5 * i, fogScale: 1 - 0.25 * i })
  else if (kind === 'rain') Object.assign(v, { overcast: 0.6 + 0.3 * i, fogScale: 0.85 - 0.35 * i, rain: 0.3 + 0.7 * i, sunScale: 0.9, particles: { kind: 'rain', count: Math.round((RAIN_COUNT[quality] ?? 6000) * i * low), fallMps: 9 } })
  else if (kind === 'snow') Object.assign(v, { overcast: 0.75, fogScale: 0.7 - 0.3 * i, snow: 0.3 + 0.7 * i, particles: { kind: 'snow', count: Math.round((SNOW_COUNT[quality] ?? 4000) * i * low), fallMps: 1.1 } })
  else if (kind === 'fog') Object.assign(v, { overcast: 0.5, fogScale: 0.45 - 0.3 * i, haze: 0.55 + 0.4 * i })
  if (kind === 'rain') v.haze = 0.35 * i
  if (kind === 'snow') v.haze = 0.3 * i
  v.shadowOpacity = 1 - 0.85 * v.overcast
  return v
}

// How much the weather hides the sun's disc and its glare, 0 (clear) … 1 (gone), from an atmosphere's eased
// overcast / rain / haze / snow. Rising smoothly with each, so a thin overcast only dims it and rain, lake fog, snow
// or a full deck hide it (user, 2026-09-30: "sun disc visible through rain at dusk").
const ramp = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
export function sunVeil({ overcast = 0, rain = 0, haze = 0, snow = 0 } = {}) {
  return Math.max(ramp(0.1, 0.7, overcast), ramp(0.05, 0.4, rain), ramp(0.1, 0.5, haze), ramp(0.05, 0.4, snow))
}

export function tweenWeather(a, b, t) {
  if (t >= 1) return b
  if (t <= 0) return a
  const out = { particles: { kind: t < 0.5 ? a.particles.kind : b.particles.kind, count: Math.round(a.particles.count + (b.particles.count - a.particles.count) * t), fallMps: a.particles.fallMps + (b.particles.fallMps - a.particles.fallMps) * t } }
  for (const k of NUM) out[k] = a[k] + (b[k] - a[k]) * t
  return out
}

export function wrapParticle(p, c, half) {
  return p.map((v, i) => { const span = 2 * half; let d = (v - c[i] + half) % span; if (d < 0) d += span; return i === 1 ? v : d - half + c[i] })
}

// Weather on top of a time view's atmosphere. Live weather shapes only the LIVE time view (DAY / SUNNY / SNOW and
// the dawn-dusk-night looks keep their designed sky); a weather picked from the menu shapes any view. The wind is
// where it blows *to*, in local metres per second ([+X east, −Z north]).
const DESIGNED_KEEP = ['DAWN', 'DAY', 'DUSK', 'NIGHT', 'SUNNY', 'SNOW']
export function applyWeather(atm, weather, mode, preset, quality = 'HIGH') {
  const apply = mode !== 'LIVE' || !DESIGNED_KEEP.includes(preset)
  const v = weatherVisuals(apply ? weather ?? clearDefault() : clearDefault(), quality)
  const to = (((weather?.windDeg ?? 270) + 180) * Math.PI) / 180, mps = apply ? weather?.windMps ?? 3 : 2
  return {
    ...atm,
    overcast: Math.max(atm.overcast, v.overcast),
    snow: Math.max(atm.snow, v.snow),
    sunScale: atm.sunScale * v.sunScale,
    fogScale: atm.fogScale * v.fogScale,
    skyGain: atm.skyGain * (1 - 0.3 * Math.max(0, v.overcast - atm.overcast)),
    rain: v.rain,
    haze: v.haze,
    wind: [Math.sin(to) * mps, -Math.cos(to) * mps],
  }
}
