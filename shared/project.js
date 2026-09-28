// shared/project.js — the one projection shared by pipeline and app.
// Local tangent plane in metres around State & Madison (the zero point of
// Chicago's address grid). +X east, -Z north, +Y up.
export const ORIGIN = { lat: 41.88203, lon: -87.62784 }

export function metresPerDegree(latDeg) {
  const φ = (latDeg * Math.PI) / 180
  const mLat = 111132.954 - 559.822 * Math.cos(2 * φ) + 1.175 * Math.cos(4 * φ)
  const mLon = 111412.84 * Math.cos(φ) - 93.5 * Math.cos(3 * φ)
  return { mLat, mLon }
}

const { mLat, mLon } = metresPerDegree(ORIGIN.lat)

export function project(lon, lat) {
  return [(lon - ORIGIN.lon) * mLon, -(lat - ORIGIN.lat) * mLat]
}

export function unproject(x, z) {
  return [ORIGIN.lon + x / mLon, ORIGIN.lat - z / mLat]
}
