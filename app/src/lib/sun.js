// app/src/lib/sun.js — real Chicago sun for a time preset.
import * as SunCalc from 'suncalc'
import { ORIGIN } from '../../../shared/project.js'

const MIN = 60 * 1000

export function presetDate(preset, now) {
  const t = SunCalc.getTimes(now, ORIGIN.lat, ORIGIN.lon)
  switch (preset) {
    case 'DAWN': return new Date(t.sunrise.getTime() + 20 * MIN)
    case 'DAY': return new Date(t.solarNoon.getTime() - 90 * MIN)
    case 'DUSK': return new Date(t.sunset.getTime() - 12 * MIN)
    case 'NIGHT': return new Date(t.sunset.getTime() + 120 * MIN)
    // user fixes: a midsummer early afternoon (1 pm CDT, July 15) and Christmas Eve just after sunset (4:55 pm CST; sunset
    // ≈ 4:26) — the sun's disc would otherwise shine through the overcast sky
    case 'SUNNY': return new Date(Date.UTC(now.getFullYear(), 6, 15, 18, 0))
    case 'SNOW': return new Date(Date.UTC(now.getFullYear(), 11, 24, 22, 55))
    default: return now
  }
}

export function sunForPreset(preset, now = new Date()) {
  const date = presetDate(preset, now)
  // suncalc v2: degrees; azimuth clockwise from north. Returned here in radians.
  const pos = SunCalc.getPosition(date, ORIGIN.lat, ORIGIN.lon)
  const altitude = (pos.altitude * Math.PI) / 180
  const azimuth = (pos.azimuth * Math.PI) / 180
  // World: +X east, -Z north.
  const c = Math.cos(altitude)
  const direction = [Math.sin(azimuth) * c, Math.sin(altitude), -Math.cos(azimuth) * c]
  // night: 0 above 6° altitude, 1 below -4°
  const night = Math.min(1, Math.max(0, (6 - pos.altitude) / 10))
  return { date, altitude, azimuth, direction, night }
}
