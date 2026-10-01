// pipeline/lib/landmarkRuntime.js — what the app needs at runtime from the landmark builders (landmarks.json).
import { project } from '../../shared/project.js'
import { ringCentroid } from './geom.js'
import { TEAMS } from '../../shared/teams.js'

// What a landmark is, in a few words, for the hover tooltip and cards (user fixes): venues name their home teams,
// other landmarks their type; towers need none (their floors and year say it).
const VENUE_WORD = { baseball: 'Ballpark', football: 'Stadium', arena: 'Arena', soccer: 'Stadium' }
const TYPE_WORD = { museum: 'Museum', fountain: 'Fountain', wheel: 'Ferris wheel', bean: 'Sculpture', theatreSign: 'Theatre', castellated: 'Historic landmark', pavilion: 'Pavilion', lighthouse: 'Lighthouse', beachHouse: 'Beach house', pagoda: 'Pagoda', gate: 'Gate', boardwalkArches: 'Pavilion', ribbonRink: 'Park', canopy: 'Concert pavilion', statues: 'Statue', totem: 'Totem pole', shipBeachHouse: 'Beach house', passerelle: 'Footbridge', drivingRange: 'Driving range', murals: 'Murals', riverwalk: 'Riverwalk', crownFountain: 'Fountain', lurie: 'Garden', bpBridge: 'Bridge', artInstitute: 'Museum', picasso: 'Sculpture', flamingo: 'Sculpture', culturalCenter: 'Cultural center', unionStation: 'Station', martRiverFace: 'Landmark', headhouse: 'Landmark', ballroom: 'Ballroom', lionHouse: 'Zoo house', glasshouse: 'Conservatory', chessPavilion: 'Pavilion', couchTomb: 'Tomb', lilyPool: 'Garden', wavelandClock: 'Clock tower', glassHouse: 'Conservatory', conservatoryGrounds: 'Conservatory', cafeBrauer: 'Restaurant · event hall', natureBoardwalk: 'Pavilion', brickHouse: 'Zoo house', modernPavilion: 'Zoo house', elksMemorial: 'Memorial', natureMuseum: 'Museum', meshHabitat: 'Zoo habitat', rockHabitat: 'Zoo habitat', seaLionPool: 'Zoo habitat', barn: 'Farm-in-the-Zoo', carousel: 'Carousel' }
const and = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)
export function landmarkKind(hero, isTower) {
  if (hero.sports) {
    const teams = (hero.sports.teams ?? []).map((k) => TEAMS.find((t) => t.key === k)?.name).filter(Boolean).map((n) => `the ${n}`)
    return { kind: 'venue', kindLine: `${VENUE_WORD[hero.sports.kind] ?? 'Stadium'}${teams.length ? ` · home of ${and(teams)}` : ''}` }
  }
  if (hero.kindLine) return { kind: 'landmark', kindLine: hero.kindLine } // a builder shared by unlike buildings (Lincoln Park pass)
  if (hero.landmark?.type) return { kind: 'landmark', kindLine: TYPE_WORD[hero.landmark.type] ?? 'Landmark' }
  return isTower ? { kind: 'tower', kindLine: null } : { kind: 'landmark', kindLine: 'Landmark' }
}
export function collectRuntime(entries) {
  const out = { version: 1, plazas: [], detached: [] }
  for (const { key, runtime, detached } of entries) {
    for (const [k, v] of Object.entries(runtime ?? {})) {
      if (k === 'plazas') out.plazas.push(...v)
      else if (out[k] !== undefined) throw new Error(`landmark runtime "${k}" defined twice (second by ${key})`)
      else out[k] = v
    }
    for (const d of detached ?? []) out.detached.push({ key: d.key, file: `landmarks/${d.key}.glb`, centre: d.centre })
  }
  return out
}


export const V6_LANDMARKS = ['buckingham', 'cloudgate', 'navypier', 'grandballroom', 'riverwalk', 'artinstitute', 'crownfountain', 'lurie', 'bpbridge', 'picasso', 'flamingo', 'culturalcenter', 'unionstation', 'mart', 'lincolnparkzoo', 'conservatory']

export function landmarkEntry(b, hero) {
  const ys = [b.venueTop ?? 0, ...b.pieces.map((p) => p.top)]
  for (const m of b.extraMeshes ?? []) for (let i = 1; i < m.positions.length; i += 3) ys.push(m.positions[i])
  const top = Math.round(ys.reduce((a, y) => Math.max(a, y), 0))
  // aim at the tower, not the whole site: the tallest piece's centre (a podium or plaza can be many times larger)
  const tallest = b.pieces.filter((p) => p.outer).reduce((a, p) => (!a || p.top > a.top ? p : a), null)
  const [cx, cz] = tallest ? ringCentroid(tallest.outer) : b.centroid
  const [bx, bz] = hero.beacon ? project(hero.beacon.lon, hero.beacon.lat) : [cx, cz]
  const r = (x) => Math.round(x) + 0 // + 0 turns −0 into 0
  return { key: hero.key, name: hero.name, aliases: hero.aliases ?? [], x: r(cx), z: r(cz), top, beacon: [r(bx), r(hero.beacon?.y ?? top + 6), r(bz)], ...landmarkKind(hero, Boolean(tallest) || b.pieces.length > 0) }
}

export function validateLandmarkRegistry(heroes, keys = V6_LANDMARKS) {
  const problems = []
  for (const k of keys) {
    const h = heroes.find((x) => x.key === k)
    if (!h) { problems.push(`${k}: missing from heroes.json`); continue }
    if (!h.aliases?.length) problems.push(`${k}: no ⌘K alias`)
    if (!(h.sources ?? []).some((s) => /^https:\/\//.test(s))) problems.push(`${k}: no https source`)
    if (!h.beacon || typeof h.beacon.lat !== 'number') problems.push(`${k}: no VISIT beacon anchor`)
  }
  if (problems.length) throw new Error(`landmark registry:\n  ${problems.join('\n  ')}`)
  return true
}
