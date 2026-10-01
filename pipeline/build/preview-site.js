// pipeline/build/preview-site.js — a close look at one hero before it goes into the city (Workstream B, the F1 Pixel
// Cup review loop): builds the hero exactly as build-world does (its OSM footprint, applyHero, the landmark builder),
// colours every part by its material row and writes a glb, then renders it in Blender (EEVEE, sun and sky) from four
// sides with pipeline/heroes/scripts/site_preview.py.
//   node build/preview-site.js <heroKey> [outDir]            (BLENDER=/path/to/Blender, NO_RENDER=1 to skip Blender)
import { readFileSync, readdirSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { project } from '../../shared/project.js'
import { osmToBuilding } from '../lib/osm.js'
import { applyHero, findByOsm, expandHeroGroups } from '../lib/heroes.js'
import { extrudeBuilding } from '../lib/extrude.js'
import { writeMeshGlb } from '../lib/glb.js'
import { materialRows } from '../lib/styles.js'
import { sortCacheFiles } from '../lib/manifest.js'
import { ringBBox, ringCentroid, signedArea, openRing } from '../lib/geom.js'
import { preloadStatue } from '../lib/statues.js'
import { setSiteLookup } from '../lib/parkkit.js'
import { assembleRings } from '../lib/multipolygon.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = join(ROOT, 'cache', 'world')
const [key, outDir = '/tmp/site-preview'] = process.argv.slice(2)
if (!key) { console.error('usage: node build/preview-site.js <heroKey> [outDir]'); process.exit(2) }
const heroes = expandHeroGroups(JSON.parse(readFileSync(join(ROOT, 'data', 'heroes.json'), 'utf8')).heroes)
const h = heroes.find((x) => x.key === key)
if (!h) { console.error(`no hero ${key}`); process.exit(2) }
for (const s of [h.statue, ...(h.landmark?.type === 'statues' ? h.landmark.items : [])].filter(Boolean)) s.preloaded = await preloadStatue(s)

const els = (kind) => sortCacheFiles(readdirSync(CACHE), `osm-${kind}-`).flatMap((f) => JSON.parse(readFileSync(join(CACHE, f), 'utf8')).data.elements)
const all = [...new Map(els('allbuildings').map((e) => [e.type + e.id, e])).values()].map(osmToBuilding).filter(Boolean)
const greens = new Map(els('parks').filter((e) => e.geometry).map((e) => { const o = openRing(e.geometry.map((p) => project(p.lon, p.lat))); return [e.id, { id: e.id, outer: o, holes: [], tags: e.tags ?? {}, bbox: ringBBox(o) }] }))
const waterEls = els('water')
const waterOf = (id) => {
  const e = waterEls.find((x) => x.id === id)
  if (!e) return []
  if (e.geometry) return [{ id, outer: openRing(e.geometry.map((p) => project(p.lon, p.lat))), holes: [], tags: e.tags ?? {} }]
  return assembleRings(e.members.filter((m) => m.role === 'outer' && m.geometry).map((m) => m.geometry.map((p) => project(p.lon, p.lat)))).map((o) => ({ id, outer: o, holes: [], tags: e.tags ?? {} }))
}
setSiteLookup({ building: (ref) => findByOsm(all, ref), green: (id) => greens.get(id) ?? null, water: waterOf })
let b
const circle = (c, r) => Array.from({ length: 24 }, (_, i) => [c[0] + r * Math.cos((i / 24) * Math.PI * 2), c[1] + r * Math.sin((i / 24) * Math.PI * 2)])
const mk = (outer, holes = []) => ({ id: `x-${key}`, osmId: null, tags: {}, name: h.name, polygons: [{ outer, holes }], area: Math.abs(signedArea(outer)), centroid: ringCentroid(outer), bbox: ringBBox(outer), height: 0, parts: null })
if (h.match.synthetic) b = mk(circle(project(h.match.lon, h.match.lat), h.match.radius ?? 20))
else if (h.match.waterOsmId) {
  const w = els('water').find((e) => e.id === h.match.waterOsmId)
  b = mk(openRing(w.geometry.map((p) => project(p.lon, p.lat))))
} else {
  b = h.match.osmId ? findByOsm(all, h.match.osmId) : null
  if (!b) { console.error('footprint not found'); process.exit(2) }
}
const r = applyHero(b, h)
const rows = new Map(materialRows().map((s) => [s.key, s.base]))
for (const x of heroes) if (x.look) rows.set(x.key, x.look.base)
const hex = (s) => { const n = parseInt(s.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map((v) => v ** 2.2) }
const FACADE_GREY = { 20: '#8a4b33', 22: '#2f5560', 16: '#9a8f80' }
const out = { positions: [], normals: [], uvs: [], colors: [] }
const [cx, cz] = b.centroid
const add = (m, colour) => {
  const c = hex(colour)
  for (let i = 0; i < m.positions.length; i += 3) { out.positions.push(m.positions[i] - cx, m.positions[i + 1], m.positions[i + 2] - cz); out.colors.push(...c) }
  out.normals.push(...m.normals)
}
if (!r.sculptReplaces) for (const p of r.pieces) add(extrudeBuilding(p), h.look?.base ?? '#a8a296')
for (const m of r.extraMeshes ?? []) add(m, rows.get(m.style) ?? FACADE_GREY[m.facade] ?? '#b0a898')
for (const v of r.venueMeshes ?? []) add(v.mesh, rows.get(v.style) ?? FACADE_GREY[v.facade] ?? '#b0a898')
// a ground plate under it, park green
const bb = ringBBox(b.polygons.flatMap((p) => p.outer)), pad = 25, g = -0.02
const G = [[bb.minX - pad, bb.minZ - pad], [bb.maxX + pad, bb.minZ - pad], [bb.maxX + pad, bb.maxZ + pad], [bb.minX - pad, bb.maxZ + pad]].map(([x, z]) => [x, g, z])
add({ positions: [...G[0], ...G[2], ...G[1], ...G[0], ...G[3], ...G[2]], normals: Array(6).fill([0, 1, 0]).flat() }, '#5d7f45')
const tris = out.positions.length / 9
const ys = out.positions.filter((_, i) => i % 3 === 1), span = Math.hypot(bb.maxX - bb.minX, bb.maxZ - bb.minZ, Math.max(...ys))
mkdirSync(outDir, { recursive: true })
const glb = join(outDir, `${key}.glb`)
await writeMeshGlb(glb, { positions: out.positions, normals: out.normals, colors: out.colors })
console.log(`${key}: ${tris} triangles (incl. ground plate) → ${glb}`)
if (!process.env.NO_RENDER) {
  const blender = process.env.BLENDER ?? '/Applications/Blender.app/Contents/MacOS/Blender'
  execFileSync(blender, ['-b', '--factory-startup', '-P', join(ROOT, 'heroes', 'scripts', 'site_preview.py'), '--', glb, join(outDir, key), process.env.SIZE ?? '900', String(span)], { stdio: ['ignore', 'ignore', 'inherit'] })
  console.log(`renders → ${join(outDir, key)}_*.png`)
}
