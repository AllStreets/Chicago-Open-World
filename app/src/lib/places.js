// app/src/lib/places.js — everything a person can search for and fly to.
import { project } from '../../../shared/project.js'
import { poseForPlace } from './flight.js'

const N = (name, lat, lon, sub = 'Neighborhood') => ({ name, sub, lat, lon })
export const NEIGHBORHOODS = [
  N('The Loop', 41.8818, -87.6298), N('River North', 41.8924, -87.6341), N('Streeterville', 41.8927, -87.6197),
  N('Magnificent Mile', 41.8953, -87.6242), N('Gold Coast', 41.9048, -87.6275), N('Old Town', 41.9107, -87.638),
  N('Lincoln Park', 41.9214, -87.6513), N('Lincoln Park Zoo', 41.9211, -87.634, 'Park'), N('Lakeview', 41.94, -87.653),
  N('Wrigleyville', 41.9474, -87.6563), N('Wicker Park', 41.9088, -87.6776), N('Bucktown', 41.9217, -87.6796),
  N('Ukrainian Village', 41.8998, -87.6826), N('West Town', 41.896, -87.67), N('River West', 41.892, -87.648),
  N('Goose Island', 41.9046, -87.6557), N('West Loop', 41.882, -87.649), N('Fulton Market', 41.8866, -87.6523),
  N('Greektown', 41.8787, -87.6474), N('Little Italy', 41.8686, -87.6614), N('Pilsen', 41.8577, -87.66),
  N('Chinatown', 41.8526, -87.6325), N('South Loop', 41.8616, -87.625), N("Printer's Row", 41.8736, -87.6289),
  N('Museum Campus', 41.8661, -87.6167, 'Lakefront'), N('Navy Pier', 41.8917, -87.6086, 'Lakefront'),
  N('Millennium Park', 41.8826, -87.6226, 'Park'), N('Grant Park', 41.8739, -87.6194, 'Park'),
  N('Northerly Island', 41.8603, -87.609, 'Park'), N('Bridgeport', 41.838, -87.6515), N('Bronzeville', 41.831, -87.618),
]

export const VIEW_NAMES = {
  streeterville: 'Streeterville from the lake', loop: 'The Loop from above', river: 'Down the Chicago River',
  museum: 'Museum Campus postcard', navypier: 'Navy Pier & 400 Lake Shore', hancock: 'The Hancock',
  willis: 'Willis Tower', wabash: 'Wabash & the Loop L', westloop: 'West Loop & Fulton Market',
  lincolnpark: 'Lincoln Park & the lakefront', wrigleyville: 'Wrigleyville', pilsen: 'Pilsen', soldierfield: 'Soldier Field',
  wellslake: 'Tower 18 — the Loop L junction',
}

export function buildPlaces(manifest, bookmarks) {
  const out = []
  for (const l of manifest?.landmarks ?? []) out.push({ id: `lm:${l.key}`, kind: 'landmark', name: l.name, aliases: l.aliases ?? [], sub: `${l.top} m · Landmark`, pose: poseForPlace(l) })
  for (const t of manifest?.tallest ?? []) out.push({ id: `tb:${t.key}`, kind: 'landmark', name: t.name, sub: `${t.top} m · Tower`, pose: poseForPlace(t) })
  for (const n of NEIGHBORHOODS) {
    const [x, z] = project(n.lon, n.lat)
    out.push({ id: `nb:${n.name}`, kind: 'neighborhood', name: n.name, sub: n.sub, pose: poseForPlace({ x, z, top: 170 }) })
  }
  for (const [key, pose] of Object.entries(bookmarks)) if (VIEW_NAMES[key]) out.push({ id: `vw:${key}`, kind: 'view', name: VIEW_NAMES[key], sub: 'View', pose })
  return out
}

function score(q, name) {
  const n = name.toLowerCase()
  if (n.startsWith(q)) return 100 - n.length * 0.01
  if (n.split(/[\s&.'-]+/).some((w) => w.startsWith(q))) return 80 - n.length * 0.01
  if (n.includes(q)) return 60 - n.length * 0.01
  let i = 0
  for (const c of n) if (c === q[i]) i++
  return i === q.length ? 20 - n.length * 0.01 : 0
}

export function searchPlaces(query, places) {
  const q = query.trim().toLowerCase()
  if (!q) return [...places.filter((p) => p.kind === 'view'), ...places.filter((p) => p.kind === 'landmark').slice(0, 8), ...places.filter((p) => p.kind === 'neighborhood').slice(0, 6)]
  const bonus = { landmark: 2, view: 1, neighborhood: 0, command: 1, transit: 1, game: 2 } // on a tie, a landmark beats the area named after it
  // nicknames count almost as much as the official name ("the Bean", "Sears Tower")
  const best = (p) => Math.max(score(q, p.name), ...(p.aliases ?? []).map((a) => score(q, a) - 1))
  return places.map((p) => { const s = best(p); return { p, s: s > 0 ? s + (bonus[p.kind] ?? 0) : 0 } }).filter((r) => r.s > 0).sort((a, b) => b.s - a.s).map((r) => r.p)
}
