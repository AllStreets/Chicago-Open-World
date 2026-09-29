// pipeline/lib/skyline.js — the tallest-buildings list (from Wikipedia) and validation against the build.
import { project } from '../../shared/project.js'
import { pointInRing, signedArea } from './geom.js'

const dms = (d, m = 0, s = 0) => Number(d) + Number(m) / 60 + Number(s) / 3600

function parseRow(row) {
  const clean = row.replace(/<ref[^>]*\/>|<ref[\s\S]*?<\/ref>/g, '')
  const cells = clean.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('|') && !l.startsWith('|-') && !l.startsWith('|}')).map((l) => l.slice(1).trim())
  const rank = parseInt(cells[0], 10)
  const link = clean.match(/\[\[(?!File:)([^\]|]+)(?:\|([^\]]+))?\]\]/)
  const coord = clean.match(/\{\{Coord\|([\d.]+)\|([\d.]+)\|([\d.]+)\|N\|([\d.]+)\|([\d.]+)\|([\d.]+)\|W/i)
  const dec = clean.match(/\{\{Coord\|(\d+\.\d+)\|(-\d+\.\d+)/i)
  const conv = clean.match(/\{\{Convert\|([\d.]+)\|m\|/i)
  const sort = clean.match(/\{\{Sort\|\d+\|[\d,]+\s*\(([\d.]+)\)\}\}/i)
  if (!Number.isFinite(rank) || !link || !(coord || dec) || !(conv || sort)) return null
  const hIdx = cells.findIndex((c) => /\{\{(Convert|Sort)\|/i.test(c))
  const floors = parseInt(cells[hIdx + 1], 10)
  const year = parseInt(cells.slice(hIdx + 2).find((c) => /^(19|20)\d\d$/.test(c)), 10)
  return {
    rank, name: (link[2] || link[1]).trim(),
    lat: coord ? dms(coord[1], coord[2], coord[3]) : Number(dec[1]), lon: coord ? -dms(coord[4], coord[5], coord[6]) : Number(dec[2]),
    heightM: parseFloat(conv ? conv[1] : sort[1]), floors: Number.isFinite(floors) ? floors : null, year: Number.isFinite(year) ? year : null,
  }
}

export function parseTallestWikitext(text) {
  const start = text.indexOf('==Tallest buildings==')
  const end = text.indexOf('=== Tallest buildings by pinnacle height ===')
  const sec = text.slice(start, end > start ? end : undefined)
  return sec.split(/\n\|-[^\n]*/).slice(1).map(parseRow).filter(Boolean)
}

const inBox = ({ lat, lon }, { s, w, n, e }) => lat >= s && lat <= n && lon >= w && lon <= e

// Architectural height: body pieces (antenna-sized pieces ignored) plus any crown (spire) meshes.
export function architecturalTop(b) {
  const minArea = 0.03 * (b.area ?? 0)
  const body = b.pieces.filter((q) => !q.outer || Math.abs(signedArea(q.outer)) >= minArea)
  return Math.max(0, ...(body.length ? body : b.pieces).map((q) => q.top), b.crownTop ?? 0)
}

export function validateSkyline(buildings, skyline, bbox) {
  const missing = [], wrongHeight = [], matches = []
  for (const e of skyline) {
    if (!inBox(e, bbox)) continue
    const p = project(e.lon, e.lat)
    let via = 'contains'
    let b = buildings.find((x) => x.polygons.some((q) => pointInRing(p, q.outer)))
    if (!b) { via = 'near'; b = buildings.find((x) => Math.hypot(x.centroid[0] - p[0], x.centroid[1] - p[1]) < 60) }
    if (!b) { missing.push(e.name); continue }
    const got = architecturalTop(b)
    matches.push({ name: e.name, via, building: b, expected: e.heightM, got })
    if (Math.abs(got - e.heightM) / e.heightM > 0.08) wrongHeight.push({ name: e.name, expected: e.heightM, got: Math.round(got * 10) / 10 })
  }
  return { missing, wrongHeight, matches }
}
