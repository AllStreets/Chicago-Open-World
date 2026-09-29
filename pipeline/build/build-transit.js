// pipeline/build/build-transit.js — V3 transit build: OSM route relations + stations → transit.json and per-tile
// structure, tie, station and glow layers. Called by build-world.js; pure over its inputs (no file writes).
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { project } from '../../shared/project.js'
import { tileKeyFor } from '../lib/tiles.js'
import { splitLineByTiles } from '../lib/tilepack.js'
import { lineIdFor, lineOrder } from '../lib/transit/lines.js'
import { chainRelation, stopsOnRun, isStopRole } from '../lib/transit/chain.js'
import { resample, simplifyLine3, runsWhere, segLen } from '../lib/transit/polyline.js'
import { gradeOf, refineGrades, heightProfile, RAIL_TOP_Y } from '../lib/transit/grade.js'
import { linesByWay, planBents } from '../lib/transit/trackage.js'
import { createMesh, toLayer, hexToLinear } from '../lib/transit/meshkit.js'
import { elevatedPiece, embankmentPiece, atGradePiece, portalPiece, catenary, bentsMesh, junctionBox } from '../lib/transit/structure.js'
import { createGlow, glowPiece, toGlowLayer } from '../lib/transit/glow.js'
import { stationFeatures, platformWays, linkStops, stationSite, platformsFor, stationMesh, PLATFORM } from '../lib/transit/stations.js'
import { transitStats, validateTransit } from '../lib/transit/validate.js'
import { validateLook } from '../lib/looks.js'

export const RESAMPLE_M = 12
export const PORTAL_DEPTH_Y = -6 // subway track above this is an open ramp and gets trench walls
export const GLOW_LOD_TOL_M = 3
const r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100

const elementsOf = (dir, kind) => readdirSync(dir).filter((f) => f.startsWith(`osm-${kind}-`)).sort()
  .flatMap((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')).data.elements)
export const loadTransitCache = (cacheDir) => ({ routeEls: elementsOf(cacheDir, 'routes'), stationEls: elementsOf(cacheDir, 'stations') })

export function gradeRuns({ pts3, grades }) {
  const out = []
  grades.forEach((g, i) => {
    const last = out.at(-1)
    if (last && last.grade === g) last.pts3.push(pts3[i + 1]); else out.push({ grade: g, pts3: [pts3[i], pts3[i + 1]] })
  })
  return out
}
function* byTile(pts3) { // splitLineByTiles keys on [x, z]; carry y along as the third value
  for (const [k, lines] of splitLineByTiles(pts3.map(([x, y, z]) => [x, z, y]))) for (const l of lines) yield [k, l.map(([x, z, y]) => [x, y, z])]
}

export function buildTransit({ routeEls, stationEls, catalog, styles = null }) {
  const order = lineOrder(catalog), lineById = new Map(catalog.lines.map((l) => [l.id, l]))
  const colourOf = (id) => hexToLinear(lineById.get(id).colour)
  const ways = new Map(), nodes = new Map(), rels = []
  for (const el of routeEls) {
    if (el.type === 'way' && el.geometry?.length >= 2) ways.set(el.id, { id: el.id, nodes: el.nodes ?? [], pts: el.geometry.map((p) => project(p.lon, p.lat)), tags: el.tags ?? {} })
    else if (el.type === 'node') nodes.set(el.id, el)
    else if (el.type === 'relation') rels.push(el)
  }
  rels.sort((a, b) => a.id - b.id) // deterministic: the first run to cover a way draws it

  // ── routes: every run of every CTA / Metra relation, graded and height-profiled
  const routes = [], pieces = new Map()
  for (const rel of rels) {
    const line = lineIdFor(rel.tags, catalog)
    if (!line) continue
    const operator = lineById.get(line).operator
    const stops = rel.members.filter((m) => m.type === 'node' && isStopRole(m.role)).map((m) => nodes.get(m.ref)).filter(Boolean)
      .map((n) => ({ id: n.id, name: n.tags?.name ?? null, pt: project(n.lon, n.lat) }))
    chainRelation(rel, ways).forEach((run, k) => {
      const { pts, tags: segWay } = resample(run.pts, run.segWay, RESAMPLE_M)
      const grades = refineGrades(segWay.map((w, i) => ({ grade: gradeOf(ways.get(w).tags), len: segLen(pts[i], pts[i + 1]), rail: ways.get(w).tags.railway === 'rail' })))
      const ys = heightProfile(pts, grades, operator)
      const pts3 = pts.map((p, i) => [p[0], ys[i], p[1]])
      routes.push({ id: `${line}-${rel.id}-${k}`, line, relation: rel.id, name: rel.tags.name ?? '', from: rel.tags.from ?? '', to: rel.tags.to ?? '', wayIds: [...new Set(segWay)], pts3, stops: stopsOnRun({ pts }, stops) })
      for (let i = 0; i < segWay.length;) {
        let j = i
        while (j + 1 < segWay.length && segWay[j + 1] === segWay[i]) j++
        if (!pieces.has(segWay[i])) pieces.set(segWay[i], { wayId: segWay[i], operator, tags: ways.get(segWay[i]).tags, pts3: pts3.slice(i, j + 2), grades: grades.slice(i, j + 1) })
        i = j + 1
      }
    })
  }
  const lanes = linesByWay(routes, order)
  const drawn = [...pieces.values()].sort((a, b) => a.wayId - b.wayId)
  for (const pc of drawn) { pc.lines = lanes.get(pc.wayId) ?? []; pc.pts2 = pc.pts3.map((p) => [p[0], p[2]]) }

  // ── per-tile layers
  const tiles = new Map()
  const T = (k) => { if (!tiles.has(k)) tiles.set(k, { transit: createMesh(), ties: createMesh(), stations: createMesh(), glow: createGlow(), glowLod: createGlow() }); return tiles.get(k) }
  const glowSpec = (pc) => ({ lines: pc.lines, colours: pc.lines.map(colourOf), lineIndex: pc.lines.map((l) => order.indexOf(l)), intensity: pc.lines.map((l) => lineById.get(l).glow) })
  for (const pc of drawn) {
    for (const run of gradeRuns(pc)) {
      const parts = run.grade === 'subway' ? runsWhere(run.pts3, (p) => p[1] > PORTAL_DEPTH_Y) : [run.pts3]
      for (const part of parts) for (const [k, pts] of byTile(part)) {
        const t = T(k), piece = { pts, operator: pc.operator, colours: pc.lines.map(colourOf) }
        if (run.grade === 'elevated') elevatedPiece(t.transit, t.ties, piece)
        else if (run.grade === 'embankment') embankmentPiece(t.transit, piece)
        else if (run.grade === 'at_grade') atGradePiece(t.transit, piece)
        else portalPiece(t.transit, piece)
        if (pc.tags.electrified === 'contact_line' && run.grade !== 'subway') catenary(t.transit, piece)
      }
    }
    for (const [k, pts] of byTile(pc.pts3)) glowPiece(T(k).glow, pts, glowSpec(pc))
    for (const [k, pts] of byTile(simplifyLine3(pc.pts3, GLOW_LOD_TOL_M))) glowPiece(T(k).glowLod, pts, glowSpec(pc))
  }
  // bents: CTA steel every 18 m; Metra viaducts longer than 60 m on piers every 25 m
  const raised = (op) => drawn.filter((pc) => pc.operator === op).flatMap((pc) => gradeRuns(pc).filter((r) => r.grade === 'elevated').map((r) => ({ wayId: pc.wayId, pts: r.pts3 })))
  const metraLong = raised('metra').filter((p) => segLen([p.pts[0][0], p.pts[0][2]], [p.pts.at(-1)[0], p.pts.at(-1)[2]]) > 60)
  for (const b of [...planBents(raised('cta')), ...planBents(metraLong, { spacing: 25, outset: 0.8, singleHalf: 2.4 })]) {
    bentsMesh(T(tileKeyFor([(b.a[0] + b.b[0]) / 2, (b.a[1] + b.b[1]) / 2])).transit, [b])
  }
  for (const j of catalog.junctions ?? []) {
    const [x, z] = project(j.lon, j.lat)
    junctionBox(T(tileKeyFor([x, z])).transit, { x, z, y: RAIL_TOP_Y.cta, size: j.size, tower: j.tower })
  }

  // ── stations (colours are the V2 looks station-cta / station-metra, registered in the shared palette)
  const looks = catalog.stationLooks ?? {}
  const lookErrors = Object.entries(looks).flatMap(([op, look]) => validateLook(look, `station-${op}`))
  for (const [op, look] of Object.entries(looks)) styles?.add(`station-${op}`, look)
  const stations = stationFeatures(stationEls)
  linkStops(stations, routes, order)
  const platforms = platformWays(stationEls), withLines = drawn.filter((p) => p.lines.length)
  const stationOut = stations.map((st) => {
    const site = stationSite(st, withLines), operator = site?.operator ?? st.operator ?? 'cta', above = !!site && site.y > -1
    stationMesh(T(tileKeyFor(st.pt)).stations, st, site, above ? platformsFor(st, site, platforms) : [], { look: looks[operator], lineColours: Object.fromEntries(st.lines.map((l) => [l, colourOf(l)])) })
    return { id: st.id, name: st.name, operator, lines: st.lines, x: r1(st.pt[0]), z: r1(st.pt[1]), y: above ? r2(site.y + PLATFORM[operator].aboveRail) : 0, grade: site?.grade ?? 'unknown', heading: site ? r2(Math.atan2(site.t[0], site.t[1])) : 0, osm: st.osm }
  })

  const stats = transitStats(drawn)
  const validation = validateTransit(stats, catalog, stationOut)
  validation.errors.push(...lookErrors)
  const present = order.filter((id) => routes.some((r) => r.line === id))
  const json = {
    version: 1,
    lines: present.map((id) => { const { expect, refs, names, ...rest } = lineById.get(id); return { ...rest, index: order.indexOf(id) } }),
    routes: routes.map((r) => ({ id: r.id, line: r.line, relation: r.relation, name: r.name, from: r.from, to: r.to,
      path: r.pts3.map(([x, y, z]) => [r1(x), r2(y), r1(z)]), stops: r.stops.map((s) => ({ station: s.station ?? null, name: s.name, s: s.s })) })),
    stations: stationOut,
    junctions: (catalog.junctions ?? []).map(({ name, lat, lon }) => { const [x, z] = project(lon, lat); return { name, x: r1(x), z: r1(z) } }),
    stats,
  }
  const layers = new Map([...tiles].map(([k, t]) => [k, { transit: toLayer(t.transit), ties: toLayer(t.ties), stations: toLayer(t.stations), glow: toGlowLayer(t.glow), glowLod: toGlowLayer(t.glowLod) }]))
  return { json, tiles: layers, wayIds: new Set(pieces.keys()), stats, validation }
}
