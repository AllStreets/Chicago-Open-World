// app/src/transit/arrivals.js — CTA arrival times, read in Chicago time whatever the viewer's time zone (P5 · C16).
// CTA's arrTime is Chicago wall time with no offset ('YYYY-MM-DDTHH:mm:ss').
import { CHI_LINE } from '../lib/nearestTransit.js'
import { offsetMinutes, chicagoToUtc } from '../sports/chicagoTime.js'

export const chicagoOffsetMinutes = (ms) => offsetMinutes(ms)

const LOCAL = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/
export function chicagoLocalToMs(s) {
  const m = LOCAL.exec(String(s ?? ''))
  if (!m) return NaN
  return chicagoToUtc(m[1], +m[2], +m[3]) + (+m[4] || 0) * 1000
}

export function minutesUntil(arrTime, nowMs) {
  const t = chicagoLocalToMs(arrTime)
  return Number.isFinite(t) ? Math.max(0, Math.floor((t - nowMs) / 60000)) : NaN
}

export function parseArrivals(json, nowMs) {
  const out = []
  for (const a of json?.arrivals ?? []) {
    const lineId = CHI_LINE[a?.line], minutes = minutesUntil(a?.arrTime, nowMs)
    if (!lineId || !Number.isFinite(minutes)) continue
    out.push({ lineId, destination: a.destination ?? '', minutes, isApproaching: !!a.isApproaching, isDelayed: !!a.isDelayed })
  }
  return out.sort((a, b) => a.minutes - b.minutes)
}

// V3 stations carry no CTA mapId (refresh ruling): live arrivals at a station are the live trains heading for it.
const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
export function liveArrivalsFor(station, reports, nowMs) {
  const name = norm(station?.name), lines = new Set(station?.lines ?? [])
  const out = []
  for (const r of reports ?? []) {
    const lineId = CHI_LINE[r?.line], minutes = minutesUntil(r?.arrTime, nowMs)
    if (!lineId || !lines.has(lineId) || norm(r.nextStation) !== name || !Number.isFinite(minutes)) continue
    out.push({ lineId, destination: r.destination ?? '', minutes, isApproaching: minutes <= 1, isDelayed: false, rn: r.rn })
  }
  return out.sort((a, b) => a.minutes - b.minutes)
}
