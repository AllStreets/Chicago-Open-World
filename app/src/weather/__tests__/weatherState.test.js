// app/src/weather/__tests__/weatherState.test.js — CHI's OpenWeather answer → a weather state → how it looks (P5 Task 4).
import { describe, it, expect } from 'vitest'
import { weatherFromChi, weatherVisuals, tweenWeather, wrapParticle, manualWeather, applyWeather } from '../weatherState.js'
import { atmosphereFor } from '../../lib/atmosphere.js'

const w = (icon, description = '', visibility = 10) => ({ icon, description, visibility, wind: { speed: 4, deg: 270 } })
describe('weatherFromChi', () => {
  it.each([
    [w('01d'), 'clear'], [w('02n'), 'clear'], [w('03d'), 'overcast'], [w('04d'), 'overcast'],
    [w('10d', 'light rain'), 'rain'], [w('09d', 'shower rain'), 'rain'], [w('11d', 'thunderstorm'), 'rain'],
    [w('13d', 'snow'), 'snow'], [w('50d', 'mist', 1.5), 'fog'],
  ])('%o → %s', (input, kind) => expect(weatherFromChi(input).kind).toBe(kind))
  it('grades intensity from the description', () => {
    expect(weatherFromChi(w('10d', 'light rain')).intensity).toBeCloseTo(0.35)
    expect(weatherFromChi(w('10d', 'heavy intensity rain')).intensity).toBeCloseTo(0.9)
    expect(weatherFromChi(w('09d', 'light shower rain')).intensity).toBeCloseTo(0.45)
    expect(weatherFromChi(w('11d', 'thunderstorm')).intensity).toBe(1)
    expect(weatherFromChi(w('13d', 'heavy snow')).intensity).toBeCloseTo(0.9)
  })
  it('low visibility turns an overcast day into lake fog', () => {
    expect(weatherFromChi(w('04d', 'overcast clouds', 0.8))).toMatchObject({ kind: 'fog', intensity: 0.6 })
    expect(weatherFromChi(w('50d', 'fog', 0.3))).toMatchObject({ kind: 'fog', intensity: 1 })
  })
  it('carries the wind (mph → m/s, the direction it blows from) and a plain label', () => {
    const r = weatherFromChi({ icon: '10d', description: 'light rain', windMph: 10, wind: { speed: 10, deg: 270 } })
    expect(r.windMps).toBeCloseTo(4.47, 1); expect(r.windDeg).toBe(270); expect(r.label).toBe('light rain'); expect(r.source).toBe('live')
  })
  it('null, unknown icons and missing fields fall back to a clear default', () => {
    expect(weatherFromChi(null)).toMatchObject({ kind: 'clear', source: 'default' })
    expect(weatherFromChi({ icon: '99x' })).toMatchObject({ kind: 'clear' })
    expect(weatherFromChi({})).toMatchObject({ kind: 'clear' })
    expect(weatherFromChi({ icon: 42 })).toMatchObject({ kind: 'clear' })
  })
})

describe('weatherVisuals', () => {
  it('clear has no particles and full sun', () => {
    const v = weatherVisuals({ kind: 'clear', intensity: 0 }, 'HIGH'); expect(v.particles.count).toBe(0); expect(v.sunScale).toBe(1); expect(v.overcast).toBe(0)
  })
  it('rain spawns rain under a grey sky; LOW keeps a quarter of the particles', () => {
    const hi = weatherVisuals({ kind: 'rain', intensity: 1 }, 'HIGH'), lo = weatherVisuals({ kind: 'rain', intensity: 1 }, 'LOW')
    expect(hi.rain).toBeGreaterThan(0.5); expect(hi.overcast).toBeGreaterThan(0.5); expect(hi.particles.kind).toBe('rain')
    expect(lo.particles.count).toBe(Math.round(hi.particles.count * 0.25))
  })
  it('snow falls and settles; fog thickens the air; overcast softens shadows', () => {
    expect(weatherVisuals({ kind: 'snow', intensity: 0.6 }, 'HIGH').snow).toBeGreaterThan(0)
    expect(weatherVisuals({ kind: 'fog', intensity: 1 }, 'HIGH').fogScale).toBeLessThan(0.5)
    expect(weatherVisuals({ kind: 'overcast', intensity: 0.9 }, 'HIGH').shadowOpacity).toBeLessThan(0.5)
  })
  it('tween blends numerically and ends exactly on the target', () => {
    const a = weatherVisuals({ kind: 'clear', intensity: 0 }, 'HIGH'), b = weatherVisuals({ kind: 'rain', intensity: 1 }, 'HIGH')
    expect(tweenWeather(a, b, 1)).toEqual(b); expect(tweenWeather(a, b, 0.5).rain).toBeCloseTo(b.rain / 2)
  })
  it('particles wrap around the camera box', () => {
    expect(wrapParticle([250, 10, 0], [0, 0, 0], 200)).toEqual([-150, 10, 0])
  })
})

describe('weather on the atmosphere (reusing the SNOW view systems)', () => {
  it('manual choices are a fixed, firm intensity', () => {
    expect(manualWeather('RAIN')).toMatchObject({ kind: 'rain', intensity: 0.7, source: 'manual' })
    expect(manualWeather('CLEAR').kind).toBe('clear')
  })
  it('live weather greys the LIVE view; a designed view (SUNNY) keeps its own sky unless you pick a weather', () => {
    const rain = { kind: 'rain', intensity: 0.8, windMps: 6, windDeg: 270 }
    const live = applyWeather(atmosphereFor('LIVE'), rain, 'LIVE', 'LIVE', 'HIGH')
    expect(live.overcast).toBeGreaterThan(0.5); expect(live.rain).toBeGreaterThan(0.5)
    expect(live.wind[0]).toBeCloseTo(6) // from the west → blowing east (+X)
    const sunny = applyWeather(atmosphereFor('SUNNY'), rain, 'LIVE', 'SUNNY', 'HIGH')
    expect(sunny.overcast).toBe(0); expect(sunny.rain).toBe(0)
    const chosen = applyWeather(atmosphereFor('SUNNY'), manualWeather('SNOW'), 'SNOW', 'SUNNY', 'HIGH')
    expect(chosen.snow).toBeGreaterThan(0.5)
  })
  it('the SNOW view keeps its snow under any weather', () => {
    expect(applyWeather(atmosphereFor('SNOW'), manualWeather('CLEAR'), 'CLEAR', 'SNOW', 'HIGH').snow).toBe(1)
  })
})
