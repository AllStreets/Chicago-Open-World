// pipeline/lib/feel.js — how a neighbourhood feels, as five 0–10 scores (P4 · I-4.3), each rank-normalised across the
// zones so the numbers compare neighbourhoods with each other rather than claiming absolute truth.
//   walk      ∝ everyday places per km² (food, coffee, shops, services)
//   transit   ∝ stations + ½ × lines
//   nightlife ∝ bars and clubs per km²
//   green     ∝ the share of the zone that is park
//   quiet     ∝ −(nightlife density + major-road density), each scaled to its maximum
const n = (o, k) => Number(o?.[k]) || 0

function rankScores(values) {
  const order = values.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]), out = new Array(values.length)
  for (let i = 0; i < order.length;) {
    let j = i
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++
    const r = (i + j) / 2 // ties share the average rank
    for (let k = i; k <= j; k++) out[order[k][1]] = values.length > 1 ? Math.round((100 * r) / (values.length - 1)) / 10 : 5
    i = j + 1
  }
  return out
}

export function feelScores(zones) {
  const area = (z) => Math.max(0.05, n(z, 'areaKm2'))
  const walk = zones.map((z) => (n(z.poiCounts, 'food') + n(z.poiCounts, 'coffee') + n(z.poiCounts, 'shops') + n(z.poiCounts, 'services')) / area(z))
  const night = zones.map((z) => (n(z.poiCounts, 'drinks') + n(z.poiCounts, 'nightlife')) / area(z))
  const transit = zones.map((z) => n(z, 'stationCount') + 0.5 * n(z, 'lineCount'))
  const green = zones.map((z) => n(z, 'parkShare'))
  const road = zones.map((z) => n(z, 'majorRoadKmPerKm2'))
  const maxN = Math.max(1e-9, ...night), maxR = Math.max(1e-9, ...road)
  const quiet = zones.map((_, i) => -(night[i] / maxN + road[i] / maxR))
  const S = { walk: rankScores(walk), transit: rankScores(transit), nightlife: rankScores(night), green: rankScores(green), quiet: rankScores(quiet) }
  return Object.fromEntries(zones.map((z, i) => [z.id, { walk: S.walk[i], transit: S.transit[i], nightlife: S.nightlife[i], green: S.green[i], quiet: S.quiet[i] }]))
}
